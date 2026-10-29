using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using ImageMagick;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;
public interface IPrivateFileStore
{
    Task Save(string name, byte[] data, string contentType);
    Task<byte[]> Read(string name);
    Task Delete(string name);
}
public class BlobFileStore : IPrivateFileStore
{
    readonly BlobContainerClient container;
    public BlobFileStore(IConfiguration config)
    {
        var options = new BlobClientOptions(); options.Retry.MaxRetries = 2; options.Retry.NetworkTimeout = TimeSpan.FromSeconds(10); options.Retry.Delay = TimeSpan.FromMilliseconds(500);
        var connection = config["Storage:ConnectionString"] ?? "UseDevelopmentStorage=true";
        var client = new BlobServiceClient(connection, options);
        // Nur lokales Azurite läuft direkt; externe Azure-Ziele behalten die bereitgestellten Proxy-/Authentifizierungswege.
        if (client.Uri.IsLoopback || client.Uri.Scheme == "http" && client.Uri.Host == "storage")
        {
            options.Transport = new Azure.Core.Pipeline.HttpClientTransport(new HttpClient(new SocketsHttpHandler { UseProxy = false }));
            client = new BlobServiceClient(connection, options);
        }
        container = client.GetBlobContainerClient("private-documents");
    }
    public async Task Save(string name, byte[] data, string contentType)
    {
        await container.CreateIfNotExistsAsync(PublicAccessType.None);
        await using var stream = new MemoryStream(data);
        await container.GetBlobClient(name).UploadAsync(stream, new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } });
    }
    public async Task<byte[]> Read(string name) => (await container.GetBlobClient(name).DownloadContentAsync()).Value.Content.ToArray();
    public async Task Delete(string name) => await container.GetBlobClient(name).DeleteIfExistsAsync();
}
public static class DocumentEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/documents", async (HttpContext c, AppDbContext db, IPrivateFileStore store, Guid? nodeId, Guid? readingId) =>
        {
            Writer(c); Require(nodeId.HasValue ^ readingId.HasValue, "Genau einen Katastereintrag oder eine Ablesung zuordnen.");
            var customerId = await Authorize(db, c, nodeId, readingId);
            if (nodeId.HasValue) Admin(c);
            Require(c.Request.ContentLength is > 0 and <= 7 * 1024 * 1024, "Datei darf maximal 6 MB groß sein.");
            Require(c.Request.HasFormContentType, "Datei als Formular hochladen.");
            var form = await c.Request.ReadFormAsync(); var file = form.Files.GetFile("file");
            Require(file != null && file.Length is > 0 and <= 6 * 1024 * 1024, "Eine JPEG-/PNG-Datei oder beim Kataster ein PDF bis 6 MB auswählen.");
            await using var source = file!.OpenReadStream(); using var buffer = new MemoryStream(); await source.CopyToAsync(buffer); var bytes = buffer.ToArray();
            string contentType; string extension;
            if (nodeId.HasValue && bytes.AsSpan().StartsWith("%PDF-"u8)) { contentType = "application/pdf"; extension = ".pdf"; }
            else
            {
                try
                {
                    var info = new MagickImageInfo(bytes);
                    Require(info.Format is MagickFormat.Jpeg or MagickFormat.Png && info.Width > 0 && info.Height > 0 && (ulong)info.Width * info.Height <= 24000000, "Nur JPEG-/PNG-Fotos mit maximal 24 Megapixeln verwenden.");
                    using var image = new MagickImage(bytes, new MagickReadSettings { Format = info.Format });
                    image.AutoOrient(); image.Strip(); image.Resize(new MagickGeometry(2000, 2000) { Greater = true }); image.Format = MagickFormat.Jpeg; image.Quality = 85;
                    bytes = image.ToByteArray(); contentType = "image/jpeg"; extension = ".jpg";
                }
                catch (MagickException) { throw new TechnicalFault(400, "Bilddatei ist beschädigt oder nicht unterstützt."); }
            }
            Require((await db.Documents.CountAsync(x => x.CustomerId == customerId && x.NodeId == nodeId && x.ReadingId == readingId)) < 20, "Maximal 20 Dateien pro Eintrag oder Ablesung.");
            var document = new StoredDocument { CustomerId = customerId, NodeId = nodeId, ReadingId = readingId,
                Name = Path.GetFileNameWithoutExtension(file.FileName).Replace('\r', '_').Replace('\n', '_')[..Math.Min(Path.GetFileNameWithoutExtension(file.FileName).Length, 100)] + extension, ContentType = contentType };
            document.BlobName = $"{customerId}/{document.Id}{extension}";
            try { await store.Save(document.BlobName, bytes, contentType); }
            catch (RequestFailedException) { throw new TechnicalFault(503, "Dateispeicher ist nicht erreichbar. Bitte Azurite prüfen und den Upload wiederholen."); }
            db.Documents.Add(document); Security.Audit(db, c, "Dokument.Hochgeladen", document.Id.ToString(), customerId);
            try { await db.SaveChangesAsync(); } catch { await store.Delete(document.BlobName); throw; }
            return Results.Created($"/api/documents/{document.Id}", new { document.Id, document.Name, document.ContentType });
        }).RequireAuthorization();
        api.MapGet("/documents", async (Guid nodeId, AppDbContext db, HttpContext c) =>
        {
            await Authorize(db, c, nodeId, null);
            return Results.Ok(await db.Documents.Where(x => x.NodeId == nodeId).Select(x => new { x.Id, x.Name, x.ContentType, x.CreatedAt }).ToListAsync());
        }).RequireAuthorization();
        api.MapGet("/documents/{id:guid}", async (Guid id, AppDbContext db, HttpContext c, IPrivateFileStore store) =>
        {
            var doc = await db.Documents.FindAsync(id); Require(doc != null, "Datei nicht gefunden.", 404);
            await Authorize(db, c, doc!.NodeId, doc.ReadingId);
            Security.Audit(db, c, "Dokument.Gelesen", id.ToString(), doc.CustomerId); await db.SaveChangesAsync();
            return Results.File(await store.Read(doc.BlobName), doc.ContentType, doc.ContentType == "application/pdf" ? doc.Name : null, enableRangeProcessing: false);
        }).RequireAuthorization();
    }
    static async Task<Guid> Authorize(AppDbContext db, HttpContext c, Guid? nodeId, Guid? readingId)
    {
        if (nodeId.HasValue)
        {
            var node = await db.Nodes.FindAsync(nodeId.Value); Require(node != null, "Katastereintrag nicht gefunden.", 404);
            var sites = await Sites(db, c, node!.CustomerId); var nodes = await db.Nodes.Where(x => x.CustomerId == node.CustomerId).ToListAsync();
            Require(sites.Contains(SiteOf(node, nodes)) && (c.IsAdmin() || node.IsActive), "Katastereintrag nicht gefunden.", 404); return node.CustomerId;
        }
        var r = await db.Readings.FindAsync(readingId!.Value); Require(r != null, "Ablesung nicht gefunden.", 404);
        var p = await MeterService.Point(db, c, r!.PointId); var allowed = await Sites(db, c, p.CustomerId);
        Require(await MeterService.VisibleReadings(db, p.Id, allowed).AnyAsync(x => x.Id == r.Id), "Ablesung nicht gefunden.", 404); return p.CustomerId;
    }
}
