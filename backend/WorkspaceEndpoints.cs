using System.Text.Json;
using ImageMagick;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public static class WorkspaceEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/branding", async (AppDbContext db) => {
            var b = await db.Branding.SingleAsync();
            return Results.Ok(new { b.Motto, b.Version, logo = b.Logo == null ? null : $"/api/branding/logo?v={b.Version}" });
        });
        api.MapGet("/branding/logo", async (AppDbContext db) => {
            var b = await db.Branding.SingleAsync();
            return b.Logo == null ? Results.NotFound() : Results.File(b.Logo, "image/png");
        });
        api.MapPut("/branding", async (BrandingInput input, AppDbContext db, HttpContext c) => {
            Admin(c); Require(!string.IsNullOrWhiteSpace(input.Motto) && input.Motto.Length <= 240, "Leitspruch mit 1 bis 240 Zeichen angeben.");
            var b = await db.Branding.SingleAsync(); Require(b.Version == input.Version, "Darstellung wurde geändert. Bitte neu laden.", 409);
            var before = b.Motto; b.Motto = input.Motto.Trim(); b.Version++;
            Security.Audit(db, c, "Darstellung.LeitspruchGeändert", "Anmeldung", details: JsonSerializer.Serialize(new { before, after = b.Motto }));
            await db.SaveChangesAsync(); return Results.Ok(new { b.Version });
        }).RequireAuthorization();
        api.MapPost("/branding/logo", async (AppDbContext db, HttpContext c, int version) => {
            Admin(c); Require(c.Request.ContentLength is > 0 and <= 3 * 1024 * 1024 && c.Request.HasFormContentType, "PNG-/JPEG-Logo bis 2 MB auswählen.");
            var file = (await c.Request.ReadFormAsync()).Files.GetFile("file");
            Require(file != null && file.Length is > 0 and <= 2 * 1024 * 1024, "PNG-/JPEG-Logo bis 2 MB auswählen.");
            using var buffer = new MemoryStream(); await file!.CopyToAsync(buffer); var bytes = buffer.ToArray();
            try {
                var info = new MagickImageInfo(bytes);
                Require(info.Format is MagickFormat.Png or MagickFormat.Jpeg && (ulong)info.Width * info.Height <= 12000000, "Logo als PNG oder JPEG mit höchstens 12 Megapixeln verwenden.");
                using var image = new MagickImage(bytes, new MagickReadSettings { Format = info.Format });
                image.AutoOrient(); image.Strip(); image.Resize(new MagickGeometry(1200, 600) { Greater = true }); image.Format = MagickFormat.Png; bytes = image.ToByteArray();
            } catch (MagickException) { throw new TechnicalFault(400, "Logo ist beschädigt oder nicht unterstützt."); }
            var b = await db.Branding.SingleAsync(); Require(b.Version == version, "Darstellung wurde geändert. Bitte neu laden.", 409);
            b.Logo = bytes; b.Version++; Security.Audit(db, c, "Darstellung.LogoGeändert", "Anwendung und Anmeldung");
            await db.SaveChangesAsync(); return Results.Ok(new { b.Version });
        }).RequireAuthorization();
        api.MapDelete("/branding/logo", async (int version, AppDbContext db, HttpContext c) => {
            Admin(c); var b = await db.Branding.SingleAsync(); Require(b.Version == version, "Darstellung wurde geändert. Bitte neu laden.", 409);
            b.Logo = null; b.Version++; Security.Audit(db, c, "Darstellung.LogoZurückgesetzt"); await db.SaveChangesAsync(); return Results.Ok(new { b.Version });
        }).RequireAuthorization();
        api.MapPut("/account/appearance", async (AppearanceInput input, AppDbContext db, HttpContext c) => {
            c.Current().DarkMode = input.DarkMode; await db.SaveChangesAsync(); return Results.Ok(input);
        }).RequireAuthorization();

        var fleet = api.MapGroup("/fleet/{customerId:guid}").RequireAuthorization();
        fleet.MapGet("/", async (Guid customerId, AppDbContext db, HttpContext c) => {
            var sites = await Sites(db, c, customerId);
            return Results.Ok(await db.Vehicles.Where(x => x.CustomerId == customerId && sites.Contains(x.SiteId)).OrderBy(x => x.Number).ToListAsync());
        });
        fleet.MapPost("/", async (Guid customerId, Vehicle input, AppDbContext db, HttpContext c) => {
            Admin(c); await ValidateVehicle(customerId, input, db, c); input.Id = Guid.NewGuid(); input.CustomerId = customerId; input.Version = 1; input.DeletedAt = null;
            db.Vehicles.Add(input); Security.Audit(db, c, "Fahrzeug.Angelegt", input.Id.ToString(), customerId, JsonSerializer.Serialize(input));
            await db.SaveChangesAsync(); return Results.Created($"/api/fleet/{customerId}/{input.Id}", input);
        });
        fleet.MapPut("/{id:guid}", async (Guid customerId, Guid id, Vehicle input, AppDbContext db, HttpContext c) => {
            Admin(c); await ValidateVehicle(customerId, input, db, c); var v = await db.Vehicles.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Id == id);
            Require(v != null, "Fahrzeug nicht gefunden.", 404); Require(v!.Version == input.Version, "Fahrzeug wurde geändert. Bitte neu laden.", 409);
            var before = JsonSerializer.Serialize(v); input.Id = v.Id; input.CustomerId = customerId; input.DeletedAt = null; input.Version++;
            db.Entry(v).CurrentValues.SetValues(input); Security.Audit(db, c, "Fahrzeug.Geändert", id.ToString(), customerId, JsonSerializer.Serialize(new { before, after = input }));
            await db.SaveChangesAsync(); return Results.Ok(v);
        });
        fleet.MapDelete("/{id:guid}", async (Guid customerId, Guid id, [Microsoft.AspNetCore.Mvc.FromBody] DeleteInput input, AppDbContext db, HttpContext c) => {
            Admin(c); await Sites(db, c, customerId); var v = await db.Vehicles.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Id == id);
            Require(v != null, "Fahrzeug nicht gefunden.", 404); ValidateDelete(input, v!.Version);
            v.DeletedAt = DateTimeOffset.UtcNow; v.Version++;
            Security.Audit(db, c, "Fahrzeug.Gelöscht", id.ToString(), customerId, JsonSerializer.Serialize(new { input.Reason, vehicle = v }));
            await db.SaveChangesAsync(); return Results.Ok(new { message = "Fahrzeug gelöscht und protokolliert." });
        });
    }
    public static void ValidateDelete(DeleteInput input, int version)
    {
        Require(input.Version == version, "Datensatz wurde geändert. Bitte neu laden.", 409);
        Require(input.Reason?.Trim().Length is >= 5 and <= 1000, "Löschgrund mit 5 bis 1.000 Zeichen angeben.");
    }
    static async Task ValidateVehicle(Guid customerId, Vehicle v, AppDbContext db, HttpContext c)
    {
        var sites = await Sites(db, c, customerId); Require(sites.Contains(v.SiteId), "Einen freigegebenen Standort des Kunden wählen.");
        Require(!string.IsNullOrWhiteSpace(v.Number) && v.Number.Length <= 60 && !string.IsNullOrWhiteSpace(v.Name) && v.Name.Length <= 200, "Fahrzeug-ID und Bezeichnung sind erforderlich.");
        foreach (var p in typeof(Vehicle).GetProperties().Where(x => x.PropertyType == typeof(string)))
            Require(p.GetValue(v) is string text && text.Length <= (p.Name == "Notes" ? 4000 : 200), "Ungültige oder zu lange Fahrzeugangabe.");
        Require(v.InitialMileage is >= 0 and <= 10000000 && v.RatedPowerKw is not < 0 and not > 100000 && v.BatteryKwh is not < 0 and not > 100000 && (v.FirstRegistration == null || v.FirstRegistration >= new DateOnly(1900, 1, 1) && v.FirstRegistration <= DateOnly.FromDateTime(DateTime.UtcNow)), "Kilometerstand, Leistung, Batterie oder Erstzulassung außerhalb des gültigen Bereichs.");
        v.Number = v.Number.Trim().ToUpperInvariant(); v.Name = v.Name.Trim();
    }
}
