using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public class QualityReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReadingId { get; set; }
    public int ReadingVersion { get; set; }
    public Guid UserId { get; set; }
    public string Note { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}
public partial class AppDbContext
{
    public DbSet<QualityReview> QualityReviews => Set<QualityReview>();
    static void ConfigureV08(ModelBuilder b)
    {
        b.Entity<QualityReview>().HasIndex(x => new { x.ReadingId, x.ReadingVersion }).IsUnique();
        b.Entity<QualityReview>().HasOne<MeterReading>().WithMany().HasForeignKey(x => x.ReadingId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<QualityReview>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReading>().Property(x => x.Source).HasDefaultValue("Unknown");
        ConfigureGenerated(b); ConfigureReminders(b);
    }
}
public record AnalysisInput(DateOnly From, DateOnly To, DateOnly? CompareFrom = null, DateOnly? CompareTo = null,
    Guid? SiteId = null, Guid? BuildingId = null, Guid? NodeId = null, string Medium = "",
    decimal? AreaM2 = null, decimal? ReferenceAreaM2 = null, decimal? OperatingHours = null, decimal? ReferenceOperatingHours = null,
    decimal? ProductionUnits = null, decimal? ReferenceProductionUnits = null, string DenominatorSource = "");
public record AnalysisGroup(string Medium, string Unit, string Direction, decimal? Value, decimal? Available, decimal Coverage, bool Estimated, int Meters, decimal Days);
public record AnalysisMonth(string Month, List<AnalysisGroup> Groups);
public record RawReading(Guid Id, Guid PointId, string Meter, Guid InstallationId, DateTimeOffset At, decimal Value, decimal Factor, string Source, string Status, int Version, bool IsRollover, decimal? RegisterLimit, bool Reviewed, string ReviewNote, bool NeedsReview);
public record FrozenSegment(Guid PointId, DateTimeOffset From, DateTimeOffset To, decimal Value);
public record FrozenRootPeriod(Guid PointId, DateTimeOffset From, DateTimeOffset To);
public record QualityMeter(Guid PointId, string Name, string Number, string Medium, string Unit, decimal Coverage, DateTimeOffset? LatestAt,
    bool Overdue, int IntervalDays, decimal? DailyLimit, int OpenChecks, int IncompleteReplacements, List<string> Issues, Dictionary<string, int> Sources);
public record AnalysisPeriod(DateOnly From, DateOnly To, List<AnalysisGroup> Groups, List<AnalysisMonth> Months, List<QualityMeter> Quality, List<RawReading> Readings, List<FrozenSegment> Segments, List<FrozenRootPeriod> RootPeriods);
public record Comparison(string Medium, string Unit, string Direction, decimal? Current, decimal? Reference, decimal? ChangePercent,
    decimal? CurrentPerDay, decimal? ReferencePerDay, decimal? PerArea, decimal? ReferencePerArea, decimal? PerHour, decimal? ReferencePerHour, decimal? PerProductionUnit, decimal? ReferencePerProductionUnit);
public record AnalysisResult(DateTimeOffset AsOf, AnalysisInput Input, AnalysisPeriod Current, AnalysisPeriod Reference, List<Comparison> Comparisons, Guid[] RequiredSites, string Method);
public static class AnalysisV08
{
    public const string Method = "Bekannte Ablesedifferenzen mit Gerätefaktor; Monats- und Randintervalle zeitanteilig verteilt (keine Lastgangmessung). Fehlende Intervalle bleiben unbekannt, Teilmengen sind keine Vollverbräuche. Haupt-/Unterzähler werden je historischer Zuordnung nicht doppelt gezählt. Medien, Einheiten und Flussrichtungen bleiben getrennt. Vergleich und Kennzahlen nur bei vollständiger Abdeckung; Kennzahlen außerhalb des dezimalen Zahlenbereichs bleiben unbekannt; unterschiedliche Zeiträume zusätzlich je tatsächlichem 24-Stunden-Tag. Bezugsgrößen sind dokumentierte Eingaben, keine automatisch rückwirkend angenommenen Flächen. Auffälligkeiten nur nach ausdrücklich konfigurierter Tagesgrenze; Herkunft und Prüfung sind unabhängig. Theorie ist eine Jahresannahme und kein gemessener Periodenverbrauch oder Einsparnachweis.";
    public static void Validate(AnalysisInput input)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
        Require(input.From >= new DateOnly(1901, 1, 1) && input.From <= input.To && input.To <= today && input.To.DayNumber - input.From.DayNumber <= 366 * 10, "Zeitraum bis heute mit höchstens zehn Jahren wählen.");
        Require(input.CompareFrom.HasValue == input.CompareTo.HasValue, "Beide Vergleichsdaten angeben.");
        if (input.CompareFrom.HasValue) Require(input.CompareFrom >= new DateOnly(1900, 1, 1) && input.CompareFrom <= input.CompareTo && input.CompareTo <= today && input.CompareTo.Value.DayNumber - input.CompareFrom.Value.DayNumber <= 366 * 10, "Gültigen Vergleichszeitraum mit höchstens zehn Jahren wählen.");
        var values = new[] { input.AreaM2, input.ReferenceAreaM2, input.OperatingHours, input.ReferenceOperatingHours, input.ProductionUnits, input.ReferenceProductionUnits };
        Require(values.All(x => !x.HasValue || x >= 0.000001m && x <= 1_000_000_000_000m), "Bezugsgrößen müssen zwischen 0,000001 und 1 Billion liegen.");
        Require(input.DenominatorSource != null && input.DenominatorSource.Length <= 2000 && (!values.Any(x => x.HasValue) || input.DenominatorSource.Trim().Length >= 5), "Quelle und Gültigkeit der Bezugsgrößen dokumentieren (5–2.000 Zeichen).");
    }
    public static async Task<AnalysisResult> Build(AppDbContext db, HttpContext c, Guid customerId, AnalysisInput input)
    {
        Validate(input);
        var a = await MeterAnalytics.Load(db, c, customerId, input.NodeId, input.SiteId, input.BuildingId, input.Medium, input.From, input.To, 200);
        var b = await MeterAnalytics.Load(db, c, customerId, input.NodeId, input.SiteId, input.BuildingId, input.Medium, input.CompareFrom ?? input.From.AddYears(-1), input.CompareTo ?? input.To.AddYears(-1), 200);
        var current = await Period(db, a); var reference = await Period(db, b);
        static decimal? Divide(decimal? value, decimal? denominator) { try { return value.HasValue && denominator > 0 ? value / denominator : null; } catch (OverflowException) { return null; } }
        static decimal? Change(decimal? value,decimal? reference) { try { return reference>0 && value.HasValue ? (value-reference)/reference*100 : null; } catch (OverflowException) { return null; } }
        var keys = current.Groups.Concat(reference.Groups).Select(g => (g.Medium, g.Unit, g.Direction)).Distinct();
        var comparisons = keys.Select(k =>
        {
            var x = current.Groups.SingleOrDefault(g => (g.Medium, g.Unit, g.Direction) == k); var y = reference.Groups.SingleOrDefault(g => (g.Medium, g.Unit, g.Direction) == k);
            return new Comparison(k.Medium, k.Unit, k.Direction, x?.Value, y?.Value, Change(x?.Value,y?.Value),
                Divide(x?.Value, x?.Days), Divide(y?.Value, y?.Days), k.Unit == "kWh" ? Divide(x?.Value, input.AreaM2) : null, k.Unit == "kWh" ? Divide(y?.Value, input.ReferenceAreaM2) : null,
                k.Unit == "kWh" ? Divide(x?.Value, input.OperatingHours) : null, k.Unit == "kWh" ? Divide(y?.Value, input.ReferenceOperatingHours) : null,
                k.Unit == "kWh" ? Divide(x?.Value, input.ProductionUnits) : null, k.Unit == "kWh" ? Divide(y?.Value, input.ReferenceProductionUnits) : null);
        }).ToList();
        var required = a.Nodes.Where(n => a.ScopeNodes.Contains(n.Id)).Select(n => SiteOf(n, a.Nodes)).Concat(a.Assignments.Concat(b.Assignments).Where(t => a.Sites.Contains(t.SiteId)).Select(t => t.SiteId)).Distinct().ToArray();
        return new(a.AsOf, input, current, reference, comparisons, required, Method);
    }
    static ConsumptionEndpoints.Amount Amount(MeterAnalytics d, Guid id, bool roots, DateOnly? from = null, DateOnly? to = null)
    {
        var range = d.Range(id); var zone = d.Zone(id);
        var start = from.HasValue ? MeterAnalytics.Midnight(from.Value, zone) : range.From;
        var end = to.HasValue ? MeterAnalytics.Midnight(to.Value.AddDays(1), zone) : range.To;
        if (end > d.AsOf) end = d.AsOf;
        var assignments = d.Periods(id, roots).Select(p => new MeterAssignment { ValidFrom = p.From, ValidTo = p.To }).ToList();
        return ConsumptionEndpoints.Calculate(start, end, d.Segments[id], assignments, true);
    }
    static List<AnalysisGroup> Groups(MeterAnalytics d, DateOnly? from = null, DateOnly? to = null)
    {
        return d.Points.Where(p => d.Periods(p.Id, true).Count > 0).GroupBy(p => new { p.Medium, p.Unit, p.Direction }).Select(g =>
        {
            var rows = g.Select(p =>
            {
                var period = d.Range(p.Id); var zone = d.Zone(p.Id); var s = from.HasValue ? MeterAnalytics.Midnight(from.Value, zone) : period.From; var e = to.HasValue ? MeterAnalytics.Midnight(to.Value.AddDays(1), zone) : period.To; if (e > d.AsOf) e = d.AsOf;
                var expected = d.Periods(p.Id, true).Sum(t => Math.Max(0, Math.Min(e.UtcTicks, t.To.UtcTicks) - Math.Max(s.UtcTicks, t.From.UtcTicks)));
                var amount = ConsumptionEndpoints.Calculate(s, e, d.Segments[p.Id], d.Periods(p.Id, true).Select(t => new MeterAssignment { ValidFrom = t.From, ValidTo = t.To }).ToList(), false);
                return new { amount, expected, days = (e - s).Ticks / (decimal)TimeSpan.TicksPerDay };
            }).Where(x => x.expected > 0).ToList();
            var complete = rows.Count > 0 && rows.All(x => x.amount.Value.HasValue); var any = rows.Any(x => x.amount.Available.HasValue);
            var ticks = rows.Sum(x => (decimal)x.expected);
            return new AnalysisGroup(g.Key.Medium, g.Key.Unit, g.Key.Direction, complete ? rows.Sum(x => x.amount.Value!.Value) : null, any ? rows.Sum(x => x.amount.Available ?? 0) : null,
                ticks > 0 ? rows.Sum(x => x.amount.Coverage * x.expected) / ticks : 0, rows.Any(x => x.amount.Estimated), rows.Count, rows.Count > 0 ? rows.Average(x => x.days) : 0);
        }).Where(g => g.Meters > 0).ToList();
    }
    static async Task<AnalysisPeriod> Period(AppDbContext db, MeterAnalytics d)
    {
        var readings = d.SourceReadings;
        var ids = readings.Select(r => r.Id).ToArray();
        var reviews = await db.QualityReviews.AsNoTracking().Where(r => ids.Contains(r.ReadingId)).ToListAsync();
        var flagged = new HashSet<Guid>();
        foreach (var installation in d.Installations)
        {
            var point = d.Points.Single(p => p.Id == installation.PointId);
            if (!point.MaxDailyConsumption.HasValue) continue;
            var ordered = readings.Where(r => r.InstallationId == installation.Id).OrderBy(r => r.At).ToArray();
            foreach (var pair in ordered.Zip(ordered.Skip(1))) if (d.Segments[point.Id].Any(v => v.From == pair.First.At && v.To == pair.Second.At) && MeterService.Delta(pair.First, pair.Second, installation) / ((decimal)(pair.Second.At - pair.First.At).Ticks / TimeSpan.TicksPerDay) > point.MaxDailyConsumption.Value) flagged.Add(pair.Second.Id);
        }
        var pointIds = d.Points.Select(p => p.Id).ToArray();
        var currentInstallations = await db.Installations.AsNoTracking().Where(i => pointIds.Contains(i.PointId) && i.ValidTo == null).ToDictionaryAsync(i => i.PointId, i => i.Id);
        var quality = new List<QualityMeter>();
        foreach (var p in d.Points)
        {
            var range = d.Range(p.Id); var amount = Amount(d, p.Id, false); var last = d.Latest.GetValueOrDefault(p.Id);
            var rows = readings.Where(r => r.PointId == p.Id && r.At >= range.From && r.At <= range.To).ToList();
            var open = rows.Count(r => flagged.Contains(r.Id) && !reviews.Any(v => v.ReadingId == r.Id && v.ReadingVersion == r.Version));
            var replacements = d.Installations.Where(i => i.PointId == p.Id).GroupBy(i => i.ValidFrom).SelectMany(g => g).ToList();
            var incomplete = replacements.Count(i => (i.ValidFrom >= range.From && !readings.Any(r => r.InstallationId == i.Id && r.At == i.ValidFrom)) || (i.ValidTo.HasValue && i.ValidTo <= range.To && !readings.Any(r => r.InstallationId == i.Id && r.At == i.ValidTo)));
            var current = d.Assignments.Any(a => a.PointId == p.Id && a.ValidTo == null && d.InScope(a)) && p.DeletedAt == null && p.IsActive;
            var overdue = current && (last == null || last.At.AddDays(p.ReadingIntervalDays) < d.AsOf || currentInstallations.GetValueOrDefault(p.Id) != last.InstallationId);
            var issues = new List<string>(); if (overdue) issues.Add("Ablesung fällig / aktuelles Gerät ohne Stand"); if (amount.Coverage < 1) issues.Add("Zeitraum nicht vollständig erfasst"); if (open > 0) issues.Add("Offene Grenzwertprüfung"); if (incomplete > 0) issues.Add("Gerätegrenzstände fehlen"); if (amount.Estimated) issues.Add("Randwerte zeitanteilig verteilt");
            quality.Add(new(p.Id, p.Name, p.Number, p.Medium, p.Unit, amount.Coverage, last?.At, overdue, p.ReadingIntervalDays, p.MaxDailyConsumption, open, incomplete, issues, rows.GroupBy(r => r.Source).ToDictionary(g => g.Key, g => g.Count())));
        }
        var months = new List<AnalysisMonth>(); var cursor = d.DateFrom!.Value; var end = d.DateTo!.Value;
        while (cursor <= end) { var next = new DateOnly(cursor.Year, cursor.Month, 1).AddMonths(1); var stop = next.AddDays(-1); if (stop > end) stop = end; months.Add(new(cursor.ToString("yyyy-MM"), Groups(d, cursor, stop))); cursor = next; }
        var raw = readings.Select(r => new RawReading(r.Id, r.PointId, d.Points.Single(p => p.Id == r.PointId).Number, r.InstallationId, r.At, r.Value, d.Installations.Single(i => i.Id == r.InstallationId).Factor, r.Source, r.Status, r.Version, r.IsRollover, d.Installations.Single(i => i.Id == r.InstallationId).RegisterLimit, reviews.Any(v => v.ReadingId == r.Id && v.ReadingVersion == r.Version), reviews.SingleOrDefault(v => v.ReadingId == r.Id && v.ReadingVersion == r.Version)?.Note ?? "", flagged.Contains(r.Id))).OrderBy(r => r.Meter).ThenBy(r => r.At).ToList();
        return new(d.DateFrom.Value, d.DateTo.Value, Groups(d), months, quality, raw, d.Segments.SelectMany(k => k.Value.Select(v => new FrozenSegment(k.Key, v.From, v.To, v.Value))).ToList(), d.Points.SelectMany(p => d.Periods(p.Id, true).Select(v => new FrozenRootPeriod(p.Id, v.From, v.To))).ToList());
    }
    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/analysis/{customerId:guid}", async (Guid customerId, AnalysisInput input, AppDbContext db, HttpContext c) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead);
            var result = await Build(db, c, customerId, input); await tx.CommitAsync(); return Results.Ok(result);
        }).RequireAuthorization();
        api.MapPost("/quality/readings/{readingId:guid}/review", async (Guid readingId, DeleteInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); var row = await db.Readings.SingleOrDefaultAsync(r => r.Id == readingId); Require(row != null, "Ablesung nicht gefunden.", 404);
            var point = await db.Points.IgnoreQueryFilters().SingleAsync(p => p.Id == row!.PointId);
            var sites = await Sites(db, c, point.CustomerId);
            Require(await db.Assignments.AnyAsync(a => a.PointId == point.Id && sites.Contains(a.SiteId) && a.ValidFrom <= row!.At && (a.ValidTo == null || row.At < a.ValidTo)), "Standortfreigabe fehlt.", 404);
            Require(row!.Version == input.Version, "Ablesung wurde geändert.", 409);
            var previous = await db.Readings.Where(r => r.InstallationId == row.InstallationId && r.At < row.At).OrderByDescending(r => r.At).FirstOrDefaultAsync();
            var installation = await db.Installations.SingleAsync(i => i.Id == row.InstallationId);
            var flagged = point.MaxDailyConsumption.HasValue && previous != null && MeterService.Delta(previous,row,installation) / ((decimal)(row.At-previous.At).Ticks / TimeSpan.TicksPerDay) > point.MaxDailyConsumption.Value;
            Require(flagged && (input.Reason ?? "").Trim().Length is >= 5 and <= 2000, "Auffällige Ablesung mit 5–2.000 Zeichen Prüfvermerk bestätigen.");
            db.QualityReviews.Add(new() { ReadingId = readingId, ReadingVersion = row.Version, UserId = c.UserId(), Note = input.Reason!.Trim() });
            Security.Audit(db, c, "Datenqualität.Geprüft", readingId.ToString(), point.CustomerId, System.Text.Json.JsonSerializer.Serialize(input)); await db.SaveChangesAsync(); return Results.Ok(new { message = "Prüfung dokumentiert; Messwert und Herkunft unverändert." });
        }).RequireAuthorization();
    }
}
