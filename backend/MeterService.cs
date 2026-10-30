using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;
public static class MeterService
{
    public static readonly Dictionary<string, string[]> Media = new() { ["Electricity"] = ["kWh", "MWh"], ["Water"] = ["m³"], ["Gas"] = ["m³", "kWh"], ["Heat"] = ["kWh", "MWh"], ["Cooling"] = ["kWh", "MWh"] };
    public static readonly string[] Events = ["", "Wartung", "Reparatur", "Produktionsstillstand", "Außergewöhnlicher Verbrauch", "Betriebsurlaub", "Technische Störung", "Zählertausch", "Sonstiges Ereignis"];
    public static async Task<MeasuringPoint> Point(AppDbContext db, HttpContext c, Guid id)
    {
        var point = await db.Points.SingleOrDefaultAsync(x => x.Id == id);
        Require(point != null, "Messstelle nicht gefunden.", 404);
        var sites = await Sites(db, c, point!.CustomerId);
        Require((point.IsActive || c.IsAdmin()) && await db.Assignments.AnyAsync(x => x.PointId == id && x.ValidTo == null && sites.Contains(x.SiteId)), "Messstelle nicht gefunden.", 404);
        return point;
    }
    public static IQueryable<MeterReading> VisibleReadings(AppDbContext db, Guid pointId, HashSet<Guid> sites) => db.Readings.Where(r => r.PointId == pointId && db.Assignments.Any(a => a.PointId == pointId && sites.Contains(a.SiteId) && a.ValidFrom <= r.At && (a.ValidTo == null || r.At < a.ValidTo)));
    public static async Task<MeterAssignment> Assignment(AppDbContext db, Guid customerId, Guid pointId, Guid nodeId, Guid? parentId, DateTimeOffset at)
    {
        var nodes = await db.Nodes.Where(x => x.CustomerId == customerId).ToListAsync();
        var node = nodes.SingleOrDefault(x => x.Id == nodeId);
        Require(node != null && node.IsActive, "Ein aktiver Standort oder Anlagenknoten dieses Kunden ist erforderlich.");
        var siteId = SiteOf(node!, nodes);
        Require(nodes.Single(x => x.Id == siteId).IsActive, "Der Standort ist deaktiviert.");
        var seen = new HashSet<Guid> { pointId };
        var next = parentId;
        while (next.HasValue)
        {
            Require(seen.Add(next.Value), "Die Zählerhierarchie darf keinen Kreis enthalten.");
            var parent = await db.Points.SingleOrDefaultAsync(x => x.Id == next && x.CustomerId == customerId && x.IsActive);
            var a = await db.Assignments.SingleOrDefaultAsync(x => x.PointId == next && x.ValidTo == null);
            Require(parent != null && a != null && a.SiteId == siteId && a.ValidFrom <= at, "Haupt- und Unterzähler müssen zum gleichen aktiven Kundenstandort gehören und zeitlich passend zugeordnet sein.");
            next = a!.ParentPointId;
            Require(seen.Count <= 32, "Maximale Zählertiefe überschritten.");
        }
        return new MeterAssignment { CustomerId = customerId, PointId = pointId, NodeId = nodeId, SiteId = siteId, ParentPointId = parentId, ValidFrom = at.ToUniversalTime() };
    }
    public static void ValidateDevice(DeviceInput? d)
    {
        Require(d != null && !string.IsNullOrWhiteSpace(d.Number) && d.Number.Length <= 100 && d.Manufacturer != null && d.Model != null && d.MeterType != null && d.Manufacturer.Length <= 200 && d.Model.Length <= 200 && d.MeterType.Length <= 200, "Zählernummer und gültige Geräteangaben sind erforderlich.");
        Require(d!.Factor is > 0 and <= 1000000 && d.Decimals is >= 0 and <= 6 && d.Resolution > 0 && d.RegisterLimit is not <= 0 && (d.RegisterLimit == null || d.RegisterLimit <= 1000000000000000m), "Zählerfaktor, Auflösung, Dezimalstellen oder Zählwerksgrenze sind ungültig.");
        Require(decimal.Round(d.Factor, 6) == d.Factor && d.Resolution <= 1000000000000000m && decimal.Round(d.Resolution, 6) == d.Resolution && (d.RegisterLimit == null || decimal.Round(d.RegisterLimit.Value, 6) == d.RegisterLimit), "Faktor, Auflösung und Zählwerksgrenze dürfen maximal sechs Nachkommastellen enthalten.");
    }
    public static (MeterDevice device, MeterInstallation installation) Install(Guid customerId, Guid pointId, DateTimeOffset at, DeviceInput d)
    {
        ValidateDevice(d);
        var device = new MeterDevice { CustomerId = customerId, Number = d.Number.Trim(), Manufacturer = d.Manufacturer, Model = d.Model, MeterType = d.MeterType };
        var installation = new MeterInstallation { PointId = pointId, DeviceId = device.Id, Factor = d.Factor, Decimals = d.Decimals, Resolution = d.Resolution, RegisterLimit = d.RegisterLimit, ValidFrom = at.ToUniversalTime() };
        return (device, installation);
    }
    public static decimal Delta(MeterReading a, MeterReading b, MeterInstallation installation) => (b.Value - a.Value + (b.IsRollover ? installation.RegisterLimit ?? 0 : 0)) * installation.Factor;
    public static void Value(decimal value, MeterInstallation i)
    {
        Require(value is >= 0 and <= 1000000000000000m && decimal.Round(value, i.Decimals) == value && (i.RegisterLimit == null || value < i.RegisterLimit), "Zählerstand außerhalb des Wertebereichs oder zu viele Nachkommastellen.");
        Require(value % i.Resolution == 0, "Der Zählerstand passt nicht zur konfigurierten Zählerauflösung.");
    }
    public static async Task<string> ValidateReading(AppDbContext db, MeasuringPoint p, MeterInstallation i, ReadingInput input, Guid? exclude = null, IReadOnlyList<MeterReading>? source = null)
    {
        Value(input.Value, i);
        var at = input.At.ToUniversalTime();
        Require(at <= DateTimeOffset.UtcNow.AddMinutes(5) && at >= i.ValidFrom && (i.ValidTo == null || at <= i.ValidTo), "Der Ablesezeitpunkt liegt außerhalb der Geräteperiode oder in der Zukunft.");
        Require(input.Comment != null && input.Reason != null && input.Event != null && input.Comment.Length <= 2000 && input.Reason.Length <= 2000 && Events.Contains(input.Event), "Ungültiger Ereignistyp oder zu langer Kommentar.");
        Require(source == null ? !await db.Readings.AnyAsync(x => x.InstallationId == i.Id && x.At == at && x.Id != exclude) : !source.Any(x => x.InstallationId == i.Id && x.At == at && x.Id != exclude), "Zu diesem Zeitpunkt existiert bereits ein Zählerstand.", 409);
        var rows = source == null ? await db.Readings.Where(x => x.InstallationId == i.Id && x.Id != exclude).OrderBy(x => x.At).ToListAsync() : source.Where(x => x.InstallationId == i.Id && x.Id != exclude).OrderBy(x => x.At).ToList();
        var previous = rows.LastOrDefault(x => x.At < at); var following = rows.FirstOrDefault(x => x.At > at);
        var candidate = new MeterReading { At = at, Value = input.Value, IsRollover = input.IsRollover };
        var warnings = new List<string>();
        if (input.IsRollover)
        {
            Require(previous != null && i.RegisterLimit.HasValue && input.Value < previous.Value, "Ein bestätigter Zählwerksüberlauf benötigt eine definierte Zählwerksgrenze und einen fallenden Stand.");
            warnings.Add("Zählwerksüberlauf: Verbrauch wird mit der dokumentierten Zählwerksgrenze berechnet.");
        }
        else if (previous != null && input.Value < previous.Value)
            throw new TechnicalFault(400, i.RegisterLimit.HasValue ? "Der Zählerstand ist niedriger als der vorherige. Überlauf ausdrücklich bestätigen oder Zählertausch erfassen." : "Der Zählerstand ist niedriger als der vorherige. Zählertausch separat erfassen oder Eingabe korrigieren.");
        if (following != null) Require(Delta(candidate, following, i) >= 0 && (!following.IsRollover || following.Value < candidate.Value), "Der Wert widerspricht der nachfolgenden Ablesung.");
        if (previous != null && p.MaxDailyConsumption.HasValue)
        {
            var daily = Delta(previous, candidate, i) / (decimal)(at - previous.At).TotalDays;
            if (p.MaxDailyConsumption.HasValue && daily > p.MaxDailyConsumption) warnings.Add("Der Verbrauch überschreitet die konfigurierte Tagesgrenze.");
        }
        Require(warnings.Count == 0 || input.ConfirmWarning && input.Reason!.Trim().Length >= 5, string.Join(" ", warnings) + " Bitte prüfen und mit Begründung bestätigen.", 422);
        return warnings.Count > 0 ? "Auffällig" : "Gültig";
    }
    public static MeterReading Reading(Guid pointId, Guid installationId, ReadingInput input, Guid userId, string status = "Gültig") => new()
    { PointId = pointId, InstallationId = installationId, At = input.At.ToUniversalTime(), Value = input.Value, Comment = input.Comment, Event = input.Event, Reason = input.Reason, IsRollover = input.IsRollover, CreatedBy = userId, Status = status };

    public static async Task<decimal?> Consumption(AppDbContext db, Guid pointId, DateTimeOffset from, DateTimeOffset to)
    {
        var installations = await db.Installations.Where(x => x.PointId == pointId && x.ValidFrom < to && (x.ValidTo == null || x.ValidTo > from)).OrderBy(x => x.ValidFrom).ToListAsync();
        decimal sum = 0; var cursor = from;
        foreach (var i in installations)
        {
            var start = i.ValidFrom > from ? i.ValidFrom : from;
            var end = i.ValidTo.HasValue && i.ValidTo < to ? i.ValidTo.Value : to;
            if (start > cursor) return null;
            var readings = await db.Readings.Where(x => x.InstallationId == i.Id && x.At >= start && x.At <= end).OrderBy(x => x.At).ToListAsync();
            if (readings.Count < 2 || readings[0].At != start || readings[^1].At != end) return null;
            sum += readings.Zip(readings.Skip(1), (a, b) => Delta(a, b, i)).Sum(); cursor = end;
        }
        return cursor == to && installations.Count > 0 ? sum : null;
    }
}
