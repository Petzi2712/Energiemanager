using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public static class TheoreticalBalance
{
    public static readonly Dictionary<string, string[]> Units = new(MeterService.Media) { ["Other"] = ["kWh", "MWh", "m³", "L"] };
    public record Entry(Guid Id, string Name, string Number, string Category, string Building, string Medium, string Unit, string Role, decimal Value, string Source, decimal SavingsPercent, int Version, bool MeasureImplemented, string MeasureNotes);
    public record SavingsItem(Guid Id, decimal Percent, int Version);
    public record SavingsInput(SavingsItem[] Items);
    public static void Map(RouteGroupBuilder api)
    {
        api.MapPut("/technical/{customerId:guid}/savings", async (Guid customerId, SavingsInput input, AppDbContext db, HttpContext c) => {
            Admin(c); var sites = await Sites(db, c, customerId);
            Require(input.Items != null && input.Items.Length is > 0 and <= 500 && input.Items.Select(x => x.Id).Distinct().Count() == input.Items.Length, "1 bis 500 unterschiedliche Komponenten auswählen.");
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).ToListAsync();
            foreach (var item in input.Items!) {
                var node = nodes.SingleOrDefault(x => x.Id == item.Id);
                Require(node != null && node.IsActive && node.AssetRole == "Consumption" && sites.Contains(SiteOf(node, nodes)), "Verbraucher nicht gefunden.", 404);
                Require(node!.Version == item.Version, "Komponente wurde geändert. Bitte neu laden.", 409);
                Require(item.Percent is >= 0 and <= 100 && decimal.Round(item.Percent, 6) == item.Percent, "Einsparung als Prozentwert von 0 bis 100 angeben.");
                var before = node.SavingsPercent; node.SavingsPercent = item.Percent; node.Version++; node.UpdatedAt = DateTimeOffset.UtcNow;
                Security.Audit(db, c, "Kataster.EinsparannahmeGeändert", node.Id.ToString(), customerId, System.Text.Json.JsonSerializer.Serialize(new { before, after = item.Percent }));
            }
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { count = input.Items!.Length });
        }).RequireAuthorization();
        api.MapGet("/technical/{customerId:guid}/balance-overview", async (Guid customerId, AppDbContext db, HttpContext c) => {
            var sites = await Sites(db, c, customerId);
            var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).OrderBy(x => x.Number).ToListAsync();
            var roots = nodes.Where(x => x.Kind == "Site" && x.IsActive && sites.Contains(x.Id)).ToList();
            var siteBalances = roots.Select(x => Calculate(x, nodes)).ToList();
            var entries = siteBalances.SelectMany(x => x.Entries).ToList();
            var customerName = await db.Customers.Where(x => x.Id == customerId).Select(x => x.Name).SingleAsync();
            var total = new Balance(customerId, customerName, entries, Sum(entries), siteBalances.SelectMany(x => x.Missing).ToList(), siteBalances.Sum(x => x.Covered), "Gesamtbilanz aller freigegebenen aktiven Standorte. Gebäude werden zusätzlich jeweils eigenständig bilanziert; Gesamtansätze können deren Summe ersetzen.");
            var buildings = nodes.Where(x => x.Kind == "Building" && x.IsActive && roots.Any(r => r.Id == x.ParentId)).Select(x => Calculate(x, nodes)).ToList();
            return Results.Ok(new { total, buildings });
        }).RequireAuthorization();
        api.MapGet("/technical/{customerId:guid}/balance", async (Guid customerId, Guid nodeId, AppDbContext db, HttpContext c) => {
            var sites = await Sites(db, c, customerId);
            var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).OrderBy(x => x.Number).ToListAsync();
            var root = nodes.SingleOrDefault(x => x.Id == nodeId);
            Require(root != null && sites.Contains(SiteOf(root, nodes)) && root.Kind is "Site" or "Building", "Gebäude oder Standort nicht gefunden.", 404);
            return Results.Ok(Calculate(root!, nodes));
        }).RequireAuthorization();
    }
    public record Total(string Medium, string Unit, string Role, decimal Value);
    public record Balance(Guid Id, string Name, List<Entry> Entries, List<Total> Totals, List<object> Missing, int Covered, string Method);
    static List<Total> Sum(List<Entry> entries) => entries.GroupBy(x => new { x.Medium, x.Unit, x.Role }).Select(g => new Total(g.Key.Medium, g.Key.Unit, g.Key.Role, g.Sum(x => x.Value))).ToList();
    static Balance Calculate(TechnicalNode root, List<TechnicalNode> nodes)
    {
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
                        entries.Add(new Entry(n.Id, n.Name, n.Number, string.IsNullOrWhiteSpace(n.AssetType) ? n.Kind == "ConsumerAsset" ? "Sonstige Hardware" : "Unteranlage / Gesamtansatz" : n.AssetType, Building(n), medium, unit, n.AssetRole, value.Value, explicitValue ? "Vorgegebener Jahreswert" : "Leistung × Betriebsstunden × Lastfaktor", n.SavingsPercent, n.Version, n.MeasureImplemented, n.MeasureNotes));
                        next.Add(key);
                    }
                } else if (n.Kind == "ConsumerAsset" && !blocked.Contains(key)) missing.Add(new { n.Id, n.Name });
                foreach (var child in nodes.Where(x => x.ParentId == n.Id)) Walk(child, next);
            }
            Walk(root, []);
            var totals = Sum(entries);
            return new Balance(root.Id, root.Name, entries, totals.ToList(), missing, covered,
                "Theoretische Jahresbilanz aus aktiven Anlagen. Ein vorgegebener Jahreswert ersetzt die Leistungsschätzung. Übergeordnete Gesamtansätze ersetzen gleichartige Unterwerte, damit keine Doppelzählung entsteht. MWh werden in kWh umgerechnet; unterschiedliche Medien und Volumina bleiben getrennt. Erzeugung und kombinierte Anlagen werden separat ausgewiesen. Hoher Verbrauch ist ein Prüfhinweis, kein nachgewiesenes Einsparpotenzial.");
    }
}
