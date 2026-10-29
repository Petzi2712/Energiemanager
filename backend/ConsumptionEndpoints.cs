using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public static class ConsumptionEndpoints
{
    public record Segment(DateTimeOffset From, DateTimeOffset To, decimal Value);
    public record Amount(decimal? Value, decimal? Available, decimal Coverage, bool Estimated);
    public record Bucket(DateTimeOffset From, DateTimeOffset To, decimal? Consumption, decimal? AvailableConsumption, decimal? SubmeterTotal, decimal? UnassignedConsumption, decimal Coverage, string Status);

    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/meters/{id:guid}/series", async (Guid id, DateTimeOffset? from, DateTimeOffset? to, string? bucket, AppDbContext db, HttpContext c) =>
        {
            var point = await MeterService.Point(db, c, id); var sites = await Sites(db, c, point.CustomerId);
            var end = (to ?? DateTimeOffset.UtcNow).ToUniversalTime(); var start = (from ?? end.AddDays(-30)).ToUniversalTime();
            bucket ??= "Day";
            Require(start < end && end <= DateTimeOffset.UtcNow.AddMinutes(5) && end - start <= TimeSpan.FromDays(366 * 30), "Zeitraum von höchstens 30 Jahren bis heute auswählen.");
            Require(new[] { "Day", "Week", "Month", "Year", "Total" }.Contains(bucket), "Ungültige Zeitauflösung.");
            var current = await db.Assignments.SingleAsync(x => x.PointId == id && x.ValidTo == null);
            var zoneId = await db.Nodes.Where(x => x.Id == current.SiteId).Select(x => x.TimeZone).SingleAsync();
            var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
            var assignments = await db.Assignments.Where(x => x.CustomerId == point.CustomerId && (x.PointId == id || x.ParentPointId == id) && x.ValidFrom < end && (x.ValidTo == null || x.ValidTo > start)).ToListAsync();
            Require(assignments.Where(x => x.PointId == id).All(x => sites.Contains(x.SiteId)), "Für diesen Zeitraum fehlen Standortfreigaben.", 403);
            var childIds = assignments.Where(x => x.ParentPointId == id && sites.Contains(x.SiteId)).Select(x => x.PointId).Distinct().ToList();
            var points = await db.Points.IgnoreQueryFilters().Where(x => x.Id == id || childIds.Contains(x.Id)).ToListAsync();
            var ids = points.Select(x => x.Id).ToList();
            var installations = await db.Installations.Where(x => ids.Contains(x.PointId) && x.ValidFrom < end && (x.ValidTo == null || x.ValidTo > start)).ToListAsync();
            var installationIds = installations.Select(x => x.Id).ToList();
            // Beide Nachbarablesungen laden: Randwerte dürfen innerhalb eines bekannten Intervalls liegen.
            var source = db.Readings.Where(x => installationIds.Contains(x.InstallationId));
            var readings = await source.Where(x => x.At >= start && x.At <= end).ToListAsync();
            readings.AddRange(await source.Where(x => x.At < start).GroupBy(x => x.InstallationId).Select(g => g.OrderByDescending(x => x.At).First()).ToListAsync());
            readings.AddRange(await source.Where(x => x.At > end).GroupBy(x => x.InstallationId).Select(g => g.OrderBy(x => x.At).First()).ToListAsync());
            var accessPeriods = await db.Assignments.Where(x => ids.Contains(x.PointId)).ToListAsync();
            var segments = points.ToDictionary(p => p.Id, p => installations.Where(i => i.PointId == p.Id).SelectMany(i => {
                var rows = readings.Where(r => r.InstallationId == i.Id).OrderBy(r => r.At).ToArray();
                return rows.Zip(rows.Skip(1), (a, b) => new Segment(a.At, b.At, MeterService.Delta(a, b, i)))
                    .Where(s => accessPeriods.Where(a => a.PointId == p.Id && sites.Contains(a.SiteId)).Sum(a => Overlap(s.From, s.To, a.ValidFrom, a.ValidTo ?? s.To)) == (s.To - s.From).Ticks);
            }).OrderBy(s => s.From).ToList());
            var incompatible = points.Any(p => p.Unit != point.Unit || p.Medium != point.Medium || p.Direction != point.Direction);
            var inaccessible = assignments.Any(a => a.ParentPointId == id && !sites.Contains(a.SiteId));
            Amount Main(DateTimeOffset a, DateTimeOffset b) => Calculate(a, b, segments[id], assignments.Where(x => x.PointId == id && sites.Contains(x.SiteId)).ToList(), true);
            Amount Child(Guid childId, DateTimeOffset a, DateTimeOffset b) => Calculate(a, b, segments[childId], assignments.Where(x => x.PointId == childId && x.ParentPointId == id && sites.Contains(x.SiteId)).ToList(), false);
            (decimal? sum, decimal? rest, bool estimated) Balance(DateTimeOffset a, DateTimeOffset b, Amount main) {
                var amounts = childIds.Select(child => Child(child, a, b)).ToList();
                var complete = !incompatible && !inaccessible && amounts.All(x => x.Value.HasValue);
                decimal? sum = complete ? amounts.Sum(x => x.Value!.Value) : null;
                return (sum, main.Value.HasValue && sum.HasValue ? main.Value - sum : null, amounts.Any(x => x.Estimated));
            }
            var buckets = new List<Bucket>(); var cursor = start;
            while (cursor < end) {
                Require(buckets.Count < 2000, "Zu viele Balken. Eine gröbere Zeitauflösung wählen.");
                var next = bucket == "Total" ? end : Next(cursor, bucket, zone); if (next > end) next = end;
                var main = Main(cursor, next); var balance = Balance(cursor, next, main);
                buckets.Add(new Bucket(cursor, next, main.Value, main.Available, balance.sum, balance.rest, main.Coverage,
                    main.Value == null ? "Unvollständig" : main.Estimated || balance.estimated ? "Zeitanteilig" : "Gemessen"));
                cursor = next;
            }
            var total = Main(start, end); var totals = Balance(start, end, total);
            var children = childIds.Select(childId => { var p = points.Single(p => p.Id == childId); var value = Child(childId, start, end); return new { pointId = p.Id, p.Name, p.Unit, consumption = value.Value, availableConsumption = value.Available, value.Coverage }; });
            var status = total.Value == null || totals.sum == null ? "Unvollständig" : total.Estimated || totals.estimated ? "Zeitanteilig" : "Gemessen";
            return Results.Ok(new { from = start, to = end, bucket, timeZone = zoneId, point.Unit, status, consumption = total.Value, availableConsumption = total.Available,
                coverage = total.Coverage, submeterTotal = totals.sum, unassignedConsumption = totals.rest, children, buckets,
                warning = incompatible || inaccessible ? "Die Unterzählerbilanz ist wegen unterschiedlicher Messeinheiten oder fehlender Freigaben unvollständig." : totals.rest < 0 ? "Unterzählerverbrauch übersteigt den Hauptzählerverbrauch. Messkonzept prüfen." : "",
                method = "Bekannte Zählerdifferenzen werden mit dem Gerätefaktor berechnet. Zwischen Ablesungen wird der Verbrauch zeitanteilig verteilt. Außerhalb bekannter Messintervalle und bei fehlenden Austauschständen bleiben Lücken. Direkte Unterzähler werden nur während ihrer jeweiligen Zuordnung berücksichtigt." });
        }).RequireAuthorization();
    }
    public static Amount Calculate(DateTimeOffset from, DateTimeOffset to, List<Segment> segments, List<MeterAssignment> assignments, bool requireWholePeriod)
    {
        decimal sum = 0; long covered = 0, expected = 0; bool estimated = false;
        foreach (var assignment in assignments) {
            var a = assignment.ValidFrom > from ? assignment.ValidFrom : from;
            var b = assignment.ValidTo.HasValue && assignment.ValidTo < to ? assignment.ValidTo.Value : to;
            if (a >= b) continue; expected += (b - a).Ticks;
            foreach (var s in segments) {
                var left = s.From > a ? s.From : a; var right = s.To < b ? s.To : b;
                if (right <= left) continue;
                var ticks = (right - left).Ticks; covered += ticks;
                sum += s.Value * ticks / (s.To - s.From).Ticks;
                estimated |= left != s.From || right != s.To;
            }
        }
        if (requireWholePeriod) expected = (to - from).Ticks;
        return new Amount(covered == expected ? sum : null, covered > 0 || expected == 0 ? sum : null, expected == 0 ? 1 : (decimal)covered / expected, estimated);
    }
    static long Overlap(DateTimeOffset from, DateTimeOffset to, DateTimeOffset a, DateTimeOffset b)
    {
        var left = a > from ? a : from; var right = b < to ? b : to;
        return right > left ? (right - left).Ticks : 0;
    }
    static DateTimeOffset Next(DateTimeOffset cursor, string bucket, TimeZoneInfo zone)
    {
        var local = TimeZoneInfo.ConvertTime(cursor, zone).DateTime;
        var next = bucket switch {
            "Week" => local.Date.AddDays(7 - ((int)local.DayOfWeek + 6) % 7),
            "Month" => new DateTime(local.Year, local.Month, 1).AddMonths(1),
            "Year" => new DateTime(local.Year + 1, 1, 1),
            _ => local.Date.AddDays(1)
        };
        // Bei seltenen Zeitzonen mit übersprungener Mitternacht zur nächsten gültigen Minute gehen.
        while (zone.IsInvalidTime(next)) next = next.AddMinutes(1);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(next, DateTimeKind.Unspecified), zone));
    }
}
