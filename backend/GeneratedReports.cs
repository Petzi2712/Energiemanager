using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public class GeneratedReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid DefinitionId { get; set; }
    public int Sequence { get; set; }
    public Guid? ReleasedFrom { get; set; }
    public string Name { get; set; } = "";
    public string Status { get; set; } = "Entwurf";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string CreatedBy { get; set; } = "";
    public Guid[] RequiredSites { get; set; } = [];
    public string SnapshotJson { get; set; } = "";
    public string SnapshotHash { get; set; } = "";
    public byte[]? Pdf { get; set; }
    public byte[]? Excel { get; set; }
}
public partial class AppDbContext
{
    public DbSet<GeneratedReport> GeneratedReports => Set<GeneratedReport>();
    static void ConfigureGenerated(ModelBuilder b)
    {
        b.Entity<GeneratedReport>().HasIndex(r => new { r.DefinitionId, r.Sequence }).IsUnique();
        b.Entity<GeneratedReport>().HasIndex(r => r.ReleasedFrom).IsUnique();
        b.Entity<GeneratedReport>().HasOne<Customer>().WithMany().HasForeignKey(r => r.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<GeneratedReport>().HasOne<ReportDefinition>().WithMany().HasForeignKey(r => r.DefinitionId).OnDelete(DeleteBehavior.Restrict);
    }
}
public record ReportCustomer(string Name, string Number, string Address);
public record ReportMeasure(string Name, string Number, decimal SavingsPercent, bool Implemented, string Notes, string[] EvidenceNames);
public record ReportSnapshot(ReportCustomer Customer, ReportDefinition Definition, string Motto, byte[]? Logo, AnalysisResult Analysis, List<TheoreticalBalance.Balance> Theory, List<ReportMeasure> Measures, string CalculationVersion = "0.8.0/1");
public record GenerateInput(int Version, AnalysisInput? Analysis = null);
public static class GeneratedReports
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
    static object View(GeneratedReport r) => new { r.Id, r.DefinitionId, r.Sequence, r.Name, r.Status, r.CreatedAt, r.CreatedBy, r.ReleasedFrom, r.SnapshotHash, pdf = r.Pdf != null, excel = r.Excel != null, pdfHash = r.Pdf == null ? null : Hash(r.Pdf), excelHash = r.Excel == null ? null : Hash(r.Excel) };
    static async Task<GeneratedReport> Accessible(AppDbContext db, HttpContext c, Guid customerId, Guid id)
    {
        var sites = await Sites(db, c, customerId); var r = await db.GeneratedReports.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId);
        Require(r != null && r.RequiredSites.All(sites.Contains), "Bericht nicht gefunden oder Standortfreigabe fehlt.", 404); return r!;
    }
    static void Render(GeneratedReport report, ReportSnapshot snapshot)
    {
        report.SnapshotJson = JsonSerializer.Serialize(snapshot, Json); report.SnapshotHash = Hash(Encoding.UTF8.GetBytes(report.SnapshotJson));
        if (snapshot.Definition.Pdf) report.Pdf = ReportFiles.Pdf(report, snapshot);
        if (snapshot.Definition.Excel) report.Excel = ReportFiles.Excel(report, snapshot);
    }
    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/reports/{customerId:guid}/generated").RequireAuthorization();
        g.MapGet("/", async (Guid customerId, AppDbContext db, HttpContext c) =>
        {
            var sites = await Sites(db, c, customerId);
            var rows = await db.GeneratedReports.AsNoTracking().Where(x => x.CustomerId == customerId).OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.DefinitionId, x.Sequence, x.Name, x.Status, x.CreatedAt, x.CreatedBy, x.ReleasedFrom, x.SnapshotHash, x.RequiredSites, pdf = x.Pdf != null, excel = x.Excel != null }).ToListAsync();
            return Results.Ok(rows.Where(x => x.RequiredSites.All(sites.Contains)));
        });
        g.MapPost("/{definitionId:guid}", async (Guid customerId, Guid definitionId, GenerateInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId);
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var d = await db.ReportDefinitions.AsNoTracking().SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Id == definitionId);
            Require(d != null, "Berichtsvorlage nicht gefunden.", 404); Require(d!.Version == input.Version, "Berichtsvorlage wurde geändert.", 409);
            var request = (input.Analysis ?? new AnalysisInput(d.From, d.To)) with { From = d.From, To = d.To, SiteId = d.SiteId, BuildingId = d.BuildingId, NodeId = d.NodeId, Medium = d.Medium };
            var analysis = await AnalysisV08.Build(db, c, customerId, request);
            var nodes = await db.Nodes.AsNoTracking().Where(n => n.CustomerId == customerId).ToListAsync();
            var rootId = d.NodeId ?? d.BuildingId ?? d.SiteId;
            var roots = rootId.HasValue ? nodes.Where(n => n.Id == rootId).ToList() : nodes.Where(n => n.Kind == "Site" && n.IsActive && analysis.RequiredSites.Contains(n.Id)).ToList();
            var theory = d.IncludeTheory ? roots.Select(n => TheoreticalBalance.Calculate(n, nodes)).ToList() : [];
            if (d.Medium != "") theory = theory.Select(b => b with { Entries = b.Entries.Where(e => e.Medium == d.Medium).ToList(), Totals = b.Totals.Where(t => t.Medium == d.Medium).ToList() }).ToList();
            bool Under(TechnicalNode n, Guid id) { for (var k = 0; k < 16; k++) { if (n.Id == id) return true; if (!n.ParentId.HasValue) return false; n = nodes.Single(x => x.Id == n.ParentId); } return false; }
            var scope = nodes.Where(n => n.IsActive && roots.Any(r => Under(n, r.Id)) && (d.Medium == "" || n.AnnualEnergyMedium == d.Medium)).ToList();
            var nodeIds = scope.Select(n => n.Id).ToArray(); var documents = await db.Documents.AsNoTracking().Where(x => x.CustomerId == customerId && x.Purpose == "Measure" && x.NodeId.HasValue && nodeIds.Contains(x.NodeId.Value)).ToListAsync();
            var measures = d.IncludeMeasures ? scope.Where(n => n.MeasureImplemented || n.MeasureNotes != "" || n.SavingsPercent > 0).Select(n => new ReportMeasure(n.Name, n.Number, n.SavingsPercent, n.MeasureImplemented, n.MeasureNotes, documents.Where(doc => doc.NodeId == n.Id).Select(doc => doc.Name).ToArray())).ToList() : [];
            var customer = await db.Customers.SingleAsync(x => x.Id == customerId); var branding = await db.Branding.AsNoTracking().SingleAsync();
            if (!d.IncludeReadings) analysis = analysis with { Current = analysis.Current with { Readings = [] }, Reference = analysis.Reference with { Readings = [] } };
            var snapshot = new ReportSnapshot(new(customer.Name, customer.Number, customer.Address), d, branding.Motto, branding.Logo, analysis, theory, measures);
            var report = new GeneratedReport { CustomerId = customerId, DefinitionId = d.Id, Sequence = 1 + (await db.GeneratedReports.Where(r => r.DefinitionId == d.Id).MaxAsync(r => (int?)r.Sequence) ?? 0), Name = d.Name, CreatedBy = c.Current().Name, RequiredSites = analysis.RequiredSites };
            Render(report, snapshot); db.GeneratedReports.Add(report); Security.Audit(db, c, "Bericht.Erstellt", report.Id.ToString(), customerId, JsonSerializer.Serialize(new { report.Sequence, report.SnapshotHash })); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Created($"/api/reports/{customerId}/generated/{report.Id}/snapshot", View(report));
        });
        g.MapPost("/{id:guid}/release", async (Guid customerId, Guid id, DeleteInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); Require((input.Reason ?? "").Trim().Length is >= 5 and <= 2000, "Freigabe mit Begründung dokumentieren (5–2.000 Zeichen).");
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var original = await Accessible(db, c, customerId, id); Require(original.Status == "Entwurf", "Nur Entwürfe können freigegeben werden.", 409);
            Require(!await db.GeneratedReports.AnyAsync(x => x.ReleasedFrom == id), "Dieser Entwurf wurde bereits freigegeben.", 409);
            var snapshot = JsonSerializer.Deserialize<ReportSnapshot>(original.SnapshotJson, Json)!;
            var r = new GeneratedReport { CustomerId = customerId, DefinitionId = original.DefinitionId, Name = original.Name, Sequence = 1 + (await db.GeneratedReports.Where(x => x.DefinitionId == original.DefinitionId).MaxAsync(x => (int?)x.Sequence) ?? 0), Status = "Freigegeben", CreatedBy = c.Current().Name, ReleasedFrom = id, RequiredSites = original.RequiredSites };
            Render(r, snapshot); db.GeneratedReports.Add(r); Security.Audit(db, c, "Bericht.Freigegeben", r.Id.ToString(), customerId, JsonSerializer.Serialize(new { input.Reason, original.Id, r.SnapshotHash })); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(View(r));
        });
        g.MapGet("/{id:guid}/snapshot", async (Guid customerId, Guid id, AppDbContext db, HttpContext c) => Results.Text((await Accessible(db, c, customerId, id)).SnapshotJson, "application/json"));
        g.MapGet("/{id:guid}/{format}", async (Guid customerId, Guid id, string format, AppDbContext db, HttpContext c) =>
        {
            var r = await Accessible(db, c, customerId, id); var bytes = format == "pdf" ? r.Pdf : format == "xlsx" ? r.Excel : null; Require(bytes != null, "Format nicht vorhanden.", 404);
            return Results.File(bytes!, format == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Energiebericht-{r.Id}-v{r.Sequence}.{format}");
        });
    }
}
