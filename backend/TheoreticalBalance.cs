using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public static class TheoreticalBalance
{
    public static readonly Dictionary<string, string[]> Units = new(MeterService.Media) { ["Other"] = ["kWh", "MWh", "m³", "L"] };
    public record Entry(Guid Id, string Name, string Number, string Category, string Building, string Medium, string Unit, string Role, decimal Value, string Source);
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/technical/{customerId:guid}/balance", async (Guid customerId, Guid nodeId, AppDbContext db, HttpContext c) => {
            var sites = await Sites(db, c, customerId);
            var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).OrderBy(x => x.Number).ToListAsync();
            var root = nodes.SingleOrDefault(x => x.Id == nodeId);
            Require(root != null && sites.Contains(SiteOf(root, nodes)) && root.Kind is "Site" or "Building", "Gebäude oder Standort nicht gefunden.", 404);
            var entries = new List<Entry>(); var missing = new List<object>(); var covered = 0;
            bool Active(TechnicalNode n) => n.IsActive && (n.ParentId == null || Active(nodes.Single(x => x.Id == n.ParentId)));
            string Building(TechnicalNode n) => n.Kind == "Building" ? n.Name : n.ParentId.HasValue ? Building(nodes.Single(x => x.Id == n.ParentId)) : "Standortübergreifend";
            void Walk(TechnicalNode n, HashSet<string> blocked) {
                if (!Active(n)) return;
                var explicitValue = n.AnnualEnergyValue.HasValue;
                decimal? value = explicitValue ? n.AnnualEnergyValue : n.Kind == "ConsumerAsset" && n.AnnualHours > 0 && (n.SystemPowerW ?? n.RatedPowerW) > 0 ? n.Quantity * (n.SystemPowerW ?? n.RatedPowerW) / 1000m * n.AnnualHours * n.LoadFactor : null;
                var unit = explicitValue ? n.AnnualEnergyUnit : "kWh";
                if (unit == "MWh") { unit = "kWh"; value *= 1000; }
                var medium = explicitValue ? n.AnnualEnergyMedium : "Electricity";
                var key = $"{medium}|{unit}|{n.AssetRole}";
                var next = new HashSet<string>(blocked);
                if (value.HasValue) {
                    if (blocked.Contains(key)) covered++;
                    else {
                        entries.Add(new Entry(n.Id, n.Name, n.Number, string.IsNullOrWhiteSpace(n.AssetType) ? n.Kind == "ConsumerAsset" ? "Sonstige Hardware" : "Unteranlage / Gesamtansatz" : n.AssetType, Building(n), medium, unit, n.AssetRole, value.Value, explicitValue ? "Vorgegebener Jahreswert" : "Leistung × Betriebsstunden × Lastfaktor"));
                        next.Add(key);
                    }
                } else if (n.Kind == "ConsumerAsset" && !blocked.Contains(key)) missing.Add(new { n.Id, n.Name });
                foreach (var child in nodes.Where(x => x.ParentId == n.Id)) Walk(child, next);
            }
            Walk(root!, []);
            var totals = entries.GroupBy(x => new { x.Medium, x.Unit, x.Role }).Select(g => new { g.Key.Medium, g.Key.Unit, g.Key.Role, value = g.Sum(x => x.Value) });
            return Results.Ok(new { root!.Id, root.Name, entries, totals, missing, covered,
                method = "Theoretische Jahresbilanz aus aktiven Anlagen. Ein vorgegebener Jahreswert ersetzt die Leistungsschätzung. Übergeordnete Gesamtansätze ersetzen gleichartige Unterwerte, damit keine Doppelzählung entsteht. MWh werden in kWh umgerechnet; unterschiedliche Medien und Volumina bleiben getrennt. Erzeugung und kombinierte Anlagen werden separat ausgewiesen. Hoher Verbrauch ist ein Prüfhinweis, kein nachgewiesenes Einsparpotenzial." });
        }).RequireAuthorization();
    }
}
