using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;
public static class TechnicalEndpoints
{
    public static readonly string[] Kinds = ["Site", "Building", "Area", "Distribution", "ConsumerGroup", "ConsumerAsset"];
    public static void Map(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/technical/{customerId:guid}").RequireAuthorization();
        group.MapGet("/tree", async (Guid customerId, AppDbContext db, HttpContext c) =>
        {
            var sites = await Sites(db, c, customerId);
            var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).OrderBy(x => x.Number).ToListAsync();
            var visible = nodes.Where(x => sites.Contains(SiteOf(x, nodes)) && (c.IsAdmin() || x.IsActive)).ToList();
            var assignments = await db.Assignments.Where(x => x.CustomerId == customerId && x.ValidTo == null && sites.Contains(x.SiteId)).ToListAsync();
            var pointIds = assignments.Select(x => x.PointId).ToList();
            var points = await db.Points.Where(x => pointIds.Contains(x.Id) && (x.IsActive || c.IsAdmin())).OrderBy(x => x.Number).ToListAsync();
            var installations = await db.Installations.Where(x => pointIds.Contains(x.PointId) && x.ValidTo == null).ToListAsync();
            var deviceIds = installations.Select(x => x.DeviceId).ToList();
            var devices = await db.Devices.Where(x => deviceIds.Contains(x.Id)).ToListAsync();
            // Nur Ablesungen aus erlaubten Standortperioden ausgeben, auch nach einer Umhängung.
            var readings = await db.Readings.Where(x => pointIds.Contains(x.PointId) && db.Assignments.Any(a => a.PointId == x.PointId && sites.Contains(a.SiteId) && a.ValidFrom <= x.At && (a.ValidTo == null || x.At < a.ValidTo)))
                .GroupBy(x => x.PointId).Select(g => g.OrderByDescending(x => x.At).ThenByDescending(x => x.CreatedAt).First()).ToListAsync();
            return Results.Ok(new { nodes = visible.Select(View), points = points.Select(p => new { point = p, assignment = assignments.Single(x => x.PointId == p.Id), installation = installations.SingleOrDefault(x => x.PointId == p.Id), device = devices.SingleOrDefault(x => x.Id == installations.SingleOrDefault(i => i.PointId == p.Id)?.DeviceId), latestReading = readings.SingleOrDefault(x => x.PointId == p.Id) }) });
        });
        group.MapPost("/nodes", async (Guid customerId, TechnicalNode input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId);
            input.Id = Guid.NewGuid(); input.CustomerId = customerId; input.Version = 1;
            input.CreatedAt = input.UpdatedAt = DateTimeOffset.UtcNow;
            await ValidateNode(input, db);
            db.Nodes.Add(input); Security.Audit(db, c, "Kataster.Angelegt", input.Id.ToString(), customerId, JsonSerializer.Serialize(input));
            await db.SaveChangesAsync(); return Results.Created($"/api/technical/{customerId}/nodes/{input.Id}", View(input));
        });
        group.MapPut("/nodes/{id:guid}", async (Guid customerId, Guid id, TechnicalNode input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId);
            var node = await db.Nodes.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId);
            Require(node != null, "Eintrag nicht gefunden.", 404);
            Require(node!.Version == input.Version, "Der Eintrag wurde geändert. Bitte neu laden.", 409);
            Require(node.ParentId == input.ParentId && node.Kind == input.Kind, "Strukturtyp und übergeordneter Knoten bleiben historisch erhalten. Für einen neuen Standort einen neuen Eintrag anlegen.");
            if (!input.IsActive)
                Require(!await db.Nodes.AnyAsync(x => x.ParentId == id && x.IsActive) && !await db.Assignments.AnyAsync(x => x.NodeId == id && x.ValidTo == null && db.Points.Any(p => p.Id == x.PointId && p.IsActive)), "Zuerst aktive Untereinträge und zugeordnete Messstellen deaktivieren.");
            var before = JsonSerializer.Serialize(node);
            input.Id = node.Id; input.CustomerId = node.CustomerId; input.CreatedAt = node.CreatedAt; input.Version = node.Version + 1; input.UpdatedAt = DateTimeOffset.UtcNow;
            await ValidateNode(input, db); db.Entry(node).CurrentValues.SetValues(input);
            Security.Audit(db, c, "Kataster.Geändert", id.ToString(), customerId, JsonSerializer.Serialize(new { before = JsonDocument.Parse(before).RootElement, after = input }));
            await db.SaveChangesAsync(); return Results.Ok(View(node));
        });
        api.MapGet("/users/{id:guid}/site-access", async (Guid id, Guid customerId, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId);
            Require(await db.Memberships.AnyAsync(x => x.UserId == id && x.CustomerId == customerId), "Benutzerzuordnung nicht gefunden.", 404);
            return Results.Ok(new { customerId, restricted = await db.SiteScopes.AnyAsync(x => x.UserId == id && x.CustomerId == customerId && x.Restricted), siteIds = await db.SitePermissions.Where(x => x.UserId == id && db.Nodes.Any(n => n.Id == x.SiteId && n.CustomerId == customerId)).Select(x => x.SiteId).ToListAsync() });
        }).RequireAuthorization();
        api.MapPut("/users/{id:guid}/site-access", async (Guid id, SiteAccessInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); var sites = await Sites(db, c, input.CustomerId);
            Require(await db.Memberships.AnyAsync(x => x.UserId == id && x.CustomerId == input.CustomerId), "Benutzerzuordnung nicht gefunden.", 404);
            Require(input.SiteIds != null && input.SiteIds.Length <= 100 && input.SiteIds.All(sites.Contains), "Ungültige Standortfreigabe.");
            var scope = await db.SiteScopes.FindAsync(id, input.CustomerId);
            if (scope == null) { scope = new SiteScope { UserId = id, CustomerId = input.CustomerId }; db.SiteScopes.Add(scope); }
            scope.Restricted = input.Restricted;
            var old = await db.SitePermissions.Where(x => x.UserId == id && db.Nodes.Any(n => n.Id == x.SiteId && n.CustomerId == input.CustomerId)).ToListAsync();
            db.SitePermissions.RemoveRange(old.Where(x => !input.SiteIds!.Contains(x.SiteId)));
            foreach (var site in input.SiteIds!.Distinct().Where(s => old.All(x => x.SiteId != s))) db.SitePermissions.Add(new SitePermission { UserId = id, SiteId = site });
            Security.Audit(db, c, "Standortfreigabe.Geändert", id.ToString(), input.CustomerId, JsonSerializer.Serialize(input));
            await db.SaveChangesAsync(); return Results.Ok(input);
        }).RequireAuthorization();
    }
    static object View(TechnicalNode node) => new { node, estimatedPowerKw = node.Kind == "ConsumerAsset" ? node.Quantity * (node.SystemPowerW ?? node.RatedPowerW) / 1000m : (decimal?)null,
        estimatedAnnualKwh = node.Kind == "ConsumerAsset" ? node.Quantity * (node.SystemPowerW ?? node.RatedPowerW) / 1000m * node.AnnualHours * node.LoadFactor : (decimal?)null };
    static async Task ValidateNode(TechnicalNode n, AppDbContext db)
    {
        Require(Kinds.Contains(n.Kind) && !string.IsNullOrWhiteSpace(n.Name) && !string.IsNullOrWhiteSpace(n.Number), "Typ, Bezeichnung und Nummer sind erforderlich.");
        Require(n.AssetRole is "Consumption" or "Generation" or "Both", "Energierolle muss Verbraucher, Erzeuger oder beides sein.");
        Require(n.AnnualEnergyValue is not < 0 && TheoreticalBalance.Units.TryGetValue(n.AnnualEnergyMedium, out var annualUnits) && annualUnits.Contains(n.AnnualEnergyUnit), "Jahresmenge und zum Energieträger passende Einheit angeben.");
        Require(n.Number.Length <= 60 && n.Name.Length <= 200, "Nummer oder Bezeichnung zu lang.");
        foreach (var p in typeof(TechnicalNode).GetProperties().Where(x => x.PropertyType == typeof(decimal) || x.PropertyType == typeof(decimal?)))
            if (p.GetValue(n) is decimal value) Require(Math.Abs(value) <= 1000000000000000m && decimal.Round(value, 6) == value, "Zahlen dürfen maximal sechs Nachkommastellen und einen Betrag von höchstens 10¹⁵ enthalten.");
        foreach (var p in typeof(TechnicalNode).GetProperties().Where(x => x.PropertyType == typeof(string)))
            Require(p.GetValue(n) is string text && text.Length <= (p.Name == "Notes" ? 4000 : 1000), "Textfelder dürfen maximal 1.000 Zeichen enthalten; Bemerkungen maximal 4.000.");
        Require(n.CustomFields != null && n.CustomFields.Count <= 30 && n.CustomFields.All(x => x.Key.Length is > 0 and <= 80 && x.Value != null && x.Value.Length <= 1000), "Maximal 30 Zusatzfelder mit kurzen Bezeichnungen und Werten verwenden.");
        Require(n.Quantity is >= 1 and <= 1000000 && n.RatedPowerW is >= 0 and <= 1000000000 && n.SystemPowerW is not < 0 && n.SystemPowerW is not > 1000000000 && n.AnnualHours is >= 0 and <= 8784 && n.OperatingDays is >= 0 and <= 366 && n.LoadFactor is >= 0 and <= 1 && n.UsableArea is not < 0 && n.HeatedArea is not < 0 && (n.Year == null || n.Year is >= 1000 and <= 2200), "Flächen, Baujahr, Anzahl, Leistungen, Betriebsstunden oder Lastfaktor liegen außerhalb des zulässigen Bereichs.");
        Require(TimeZoneInfo.TryFindSystemTimeZoneById(n.TimeZone, out _), "Unbekannte Standortzeitzone.");
        if (n.Kind == "Site") Require(n.ParentId == null, "Ein Standort liegt direkt unter dem Kunden.");
        else
        {
            var parent = await db.Nodes.SingleOrDefaultAsync(x => x.Id == n.ParentId && x.CustomerId == n.CustomerId);
            Require(parent != null && (!n.IsActive || parent.IsActive), "Übergeordneter Eintrag fehlt oder ist deaktiviert.");
            Require(n.Kind == "Building" ? parent!.Kind == "Site" : parent!.Kind is not ("Site" or "ConsumerAsset"), "Gebäude gehören zu einem Standort; technische Anlagen und Verbraucher zu einem Gebäude oder Unterbereich.");
            var nodes = await db.Nodes.Where(x => x.CustomerId == n.CustomerId).ToListAsync(); SiteOf(n, nodes);
        }
        if (n.MeasuringPointId.HasValue) Require(await db.Points.AnyAsync(x => x.Id == n.MeasuringPointId && x.CustomerId == n.CustomerId), "Die Messstelle gehört nicht zu diesem Kunden.");
        n.Number = n.Number.Trim().ToUpperInvariant(); n.Name = n.Name.Trim();
    }
}
