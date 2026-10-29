using Microsoft.EntityFrameworkCore;

namespace Energy;
public static class TechnicalSeed
{
    public static async Task Run(AppDbContext db, Customer a, Customer b)
    {
        var user = await db.Users.SingleAsync(x => x.NormalizedEmail == "ADMIN@SYSDATIQ.LOCAL");
        var start = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(-3);
        TechnicalNode Node(Customer c, string kind, string number, string name, TechnicalNode? parent = null)
        {
            var node = new TechnicalNode { CustomerId = c.Id, Kind = kind, Number = number, Name = name, ParentId = parent?.Id, Notes = "Synthetische Demo-Struktur.", Address = kind == "Site" ? "Beispielstraße, Bremen" : "" };
            db.Nodes.Add(node); return node;
        }
        MeasuringPoint Meter(Customer c, TechnicalNode node, TechnicalNode site, string number, string name, string medium, decimal[] values, MeasuringPoint? parent = null)
        {
            var unit = medium is "Water" or "Gas" ? "m³" : "kWh";
            var point = new MeasuringPoint { CustomerId = c.Id, Number = number, Name = name, Medium = medium, Unit = unit, Quantity = unit == "m³" ? "Volumen" : "Energie", MaxDailyConsumption = 1000, Notes = "Synthetische Demo-Messwerte." };
            var (device, installation) = MeterService.Install(c.Id, point.Id, start, new DeviceInput("DEMO-" + number));
            db.Points.Add(point); db.Devices.Add(device); db.Installations.Add(installation);
            db.Assignments.Add(new MeterAssignment { CustomerId = c.Id, PointId = point.Id, NodeId = node.Id, SiteId = site.Id, ParentPointId = parent?.Id, ValidFrom = start });
            for (var i = 0; i < values.Length; i++) db.Readings.Add(MeterService.Reading(point.Id, installation.Id, new ReadingInput(start.AddMonths(i), values[i], Comment: "Synthetischer Demowert"), user.Id));
            return point;
        }
        var siteA = Node(a, "Site", "HB-01", "Standort Bremen"); siteA.UsableArea = 3600; siteA.HeatedArea = 2400; siteA.OperatingHours = "Mo–Fr 06:00–22:00"; siteA.ShiftModel = "Zweischichtbetrieb";
        var siteA2 = Node(a, "Site", "HB-02", "Lager Bremen-Nord"); Node(a, "Building", "LAG-01", "Lagerhalle", siteA2);
        var hall = Node(a, "Building", "HAL-01", "Produktionshalle", siteA); hall.UsableArea = 1800;
        var office = Node(a, "Building", "BUER-01", "Büro und Werkstatt", siteA);
        var distribution = Node(a, "Distribution", "UV-01", "Unterverteilung Produktion", hall);
        var group = Node(a, "ConsumerGroup", "BEL-01", "Beleuchtung Produktionshalle", distribution);
        var asset = Node(a, "ConsumerAsset", "LED-01", "LED-Hallenstrahler", group); asset.Quantity = 24; asset.RatedPowerW = 150; asset.AnnualHours = 2000; asset.AssetType = "Beleuchtung";
        var main = Meter(a, hall, siteA, "E-HAUPT", "Strom Hauptzähler", "Electricity", [100000,110000,122000]);
        var sub = Meter(a, distribution, siteA, "E-PROD", "Strom Produktion", "Electricity", [45000,49500,54900], main); asset.MeasuringPointId = sub.Id;
        Meter(a, office, siteA, "E-BUERO", "Strom Büro", "Electricity", [20000,22000,24400], main);
        Meter(a, office, siteA, "E-WERK", "Strom Werkstatt", "Electricity", [25000,27500,30500], main);
        foreach (var (medium, number, name) in new[] { ("Water", "W-01", "Wasser Hauptzähler"), ("Gas", "G-01", "Gas Hauptzähler"), ("Heat", "H-01", "Wärmezähler"), ("Cooling", "K-01", "Kältezähler") }) Meter(a, hall, siteA, number, name, medium, [1000,1100,1220]);
        var siteB = Node(b, "Site", "LOG-01", "Logistikstandort"); var buildingB = Node(b, "Building", "LOG-HAL", "Umschlaghalle", siteB);
        Meter(b, buildingB, siteB, "B-E-01", "Strom Logistik", "Electricity", [1000,1300,1650]);
        Meter(b, buildingB, siteB, "B-W-01", "Wasser Logistik", "Water", [50,70,95]);
        db.Audit.Add(new AuditEvent { Action = "Kataster.DemoInitialisiert", Details = "Synthetische Standort-, Anlagen- und Messstellenstrukturen, ausschließlich bei neuer Demo-Datenbank." });
        await db.SaveChangesAsync();
    }
}
