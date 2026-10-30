using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

// Gemeinsame, lesende Grundlage für Jahreskacheln, Hierarchiesummen und Analyseexport.
public sealed class MeterAnalytics
{
    public record Period(DateTimeOffset From, DateTimeOffset To);
    public record Actual(decimal? Value, decimal Coverage, string Status, DateTimeOffset From, DateTimeOffset To, DateTimeOffset? MeasuredFrom, DateTimeOffset? MeasuredTo, int Intervals, int OmittedIntervals);
    public record GroupTotal(string Medium, string Unit, string Direction, decimal? Value, decimal Coverage, string Status, int Meters, DateTimeOffset? MeasuredFrom, DateTimeOffset? MeasuredTo);
    public required DateTimeOffset AsOf { get; init; }
    public required List<TechnicalNode> Nodes { get; init; }
    public required List<MeasuringPoint> Points { get; init; }
    public required List<MeterAssignment> Assignments { get; init; }
    public required List<MeterInstallation> Installations { get; init; }
    public required Dictionary<Guid, MeterReading> Latest { get; init; }
    public required Dictionary<Guid, List<ConsumptionEndpoints.Segment>> Segments { get; init; }
    public required HashSet<Guid> Sites { get; init; }
    public required HashSet<Guid> ScopeNodes { get; init; }
    public required HashSet<Guid> Linked { get; init; }
    public DateOnly? DateFrom { get; init; }
    public DateOnly? DateTo { get; init; }
    public bool InScope(MeterAssignment a) => Sites.Contains(a.SiteId) && (ScopeNodes.Contains(a.NodeId) || Linked.Contains(a.PointId));
    public static DateTimeOffset Midnight(DateOnly date, string zone) {
        var time = date.ToDateTime(TimeOnly.MinValue); var tz = TimeZoneInfo.FindSystemTimeZoneById(zone);
        while (tz.IsInvalidTime(time)) time = time.AddMinutes(1);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(time, tz));
    }
    public string Zone(Guid pointId) {
        var assignment = Assignments.Where(x => x.PointId == pointId && InScope(x)).OrderByDescending(x => x.ValidFrom).First();
        return Nodes.Single(x => x.Id == assignment.SiteId).TimeZone;
    }
    public Period Range(Guid id) {
        var zone = Zone(id); var local = TimeZoneInfo.ConvertTime(AsOf, TimeZoneInfo.FindSystemTimeZoneById(zone));
        var start = Midnight(DateFrom ?? new DateOnly(local.Year, 1, 1), zone);
        var end = DateTo.HasValue ? Midnight(DateTo.Value.AddDays(1), zone) : AsOf;
        return new(start, end < AsOf ? end : AsOf);
    }
    static long Overlap(Period a, Period b) => Math.Max(0, (Math.Min(a.To.UtcTicks,b.To.UtcTicks)-Math.Max(a.From.UtcTicks,b.From.UtcTicks)));
    public List<Period> Periods(Guid pointId, bool roots) {
        var point = Points.Single(p => p.Id == pointId); var range = Range(pointId);
        var result = new List<Period>();
        foreach (var assignment in Assignments.Where(a => a.PointId == pointId && InScope(a))) {
            var end = assignment.ValidTo ?? AsOf; if (point.DeletedAt < end) end = point.DeletedAt.Value;
            var pieces = new List<Period> { new(assignment.ValidFrom, end) };
            var parent = Points.SingleOrDefault(p => p.Id == assignment.ParentPointId);
            if (roots && parent != null && parent.Medium == point.Medium && parent.Unit == point.Unit && parent.Direction == point.Direction) {
                foreach (var a in Assignments.Where(a => a.PointId == parent.Id && InScope(a))) {
                    var parentEnd = a.ValidTo ?? AsOf; if (parent.DeletedAt < parentEnd) parentEnd = parent.DeletedAt.Value;
                    pieces = pieces.SelectMany<Period,Period>(p => {
                        if (parentEnd <= p.From || a.ValidFrom >= p.To) return new[] { p };
                        var parts = new List<Period>();
                        if (p.From < a.ValidFrom) parts.Add(new(p.From,a.ValidFrom));
                        if (parentEnd < p.To) parts.Add(new(parentEnd,p.To)); return parts;
                    }).ToList();
                }
            }
            result.AddRange(pieces.Where(p => p.From < range.To && p.To > range.From && p.From < p.To));
        }
        return result;
    }
    public Actual ActualFor(Guid id, bool roots = false) {
        var range = Range(id); var periods = Periods(id, roots); var segments = Segments[id];
        var eligible = segments.Where(s => s.From >= range.From && s.To <= range.To && periods.Sum(p => Overlap(p,new(s.From,s.To))) == (s.To-s.From).Ticks).ToList();
        var omitted = segments.Count(s => Overlap(new(s.From,s.To), range) > 0 && periods.Sum(p => Overlap(p,new(s.From,s.To))) > 0 && !eligible.Contains(s));
        var last = Latest.GetValueOrDefault(id)?.At; var through = last.HasValue && last < range.To ? last.Value : range.To;
        var expected = periods.Sum(p => Overlap(p,new(range.From,through)));
        var covered = eligible.Sum(s => (s.To-s.From).Ticks);
        var coverage = expected > 0 ? Math.Min(1, (decimal)covered/expected) : 0;
        return new(eligible.Count > 0 ? eligible.Sum(s => s.Value) : null, coverage,
            eligible.Count == 0 ? "Keine Verbrauchsdifferenz" : coverage == 1 && omitted == 0 ? "Gemessen" : "Teilweise erfasst",
            range.From,range.To, eligible.Count > 0 ? eligible.Min(s => s.From) : null,eligible.Count > 0 ? eligible.Max(s => s.To) : null,eligible.Count,omitted);
    }
    public List<GroupTotal> Totals() => Points.Where(p => Periods(p.Id,true).Count > 0).GroupBy(p => new {p.Medium,p.Unit,p.Direction}).Select(group => {
        var values = group.Select(p => ActualFor(p.Id,true)).ToList(); var any = values.Any(v => v.Value.HasValue);
        return new GroupTotal(group.Key.Medium,group.Key.Unit,group.Key.Direction,any ? values.Sum(v => v.Value ?? 0) : null,
            values.Count > 0 ? values.Average(v => v.Coverage) : 0,
            !any ? "Keine Verbrauchsdifferenz" : values.All(v => v.Status == "Gemessen") ? "Gemessen" : "Teilweise erfasst",values.Count,
            values.Min(v => v.MeasuredFrom),values.Max(v => v.MeasuredTo));
    }).ToList();

    public static async Task<MeterAnalytics> Load(AppDbContext db, HttpContext c, Guid customerId, Guid? nodeId = null, Guid? siteId = null, Guid? buildingId = null, string? medium = null, DateOnly? from = null, DateOnly? to = null, int limit = 5000)
    {
        var now = DateTimeOffset.UtcNow; var sites = await TechnicalAccess.Sites(db,c,customerId);
        Require(string.IsNullOrEmpty(medium) || MeterService.Media.ContainsKey(medium),"Gültiges Medium wählen.");
        var nodes = await db.Nodes.AsNoTracking().Where(n => n.CustomerId == customerId).ToListAsync();
        TechnicalNode? Select(Guid? id,string? kind) {
            if (!id.HasValue) return null; var n = nodes.SingleOrDefault(n => n.Id == id && (kind == null || n.Kind == kind));
            Require(n != null && sites.Contains(SiteOf(n,nodes)) && (n.IsActive || c.IsAdmin()),"Freigegebener Anlagenbereich nicht gefunden.",404); return n;
        }
        var site = Select(siteId,"Site"); var building = Select(buildingId,"Building"); var node = Select(nodeId,null);
        Require(building == null || site == null || building.ParentId == site.Id,"Gebäude gehört nicht zum Standort.");
        bool Under(TechnicalNode n, Guid id) { for (var i=0;i<16;i++) {if(n.Id==id)return true;if(!n.ParentId.HasValue)return false;n=nodes.Single(x=>x.Id==n.ParentId);}return false; }
        Require(node == null || (site == null || Under(node,site.Id)) && (building == null || Under(node,building.Id)),"Anlage gehört nicht zum gewählten Bereich.");
        var root = node ?? building ?? site;
        var scope = nodes.Where(n => sites.Contains(SiteOf(n,nodes)) && (root == null || Under(n,root.Id))).Select(n=>n.Id).ToHashSet();
        var linked = nodes.Where(n => scope.Contains(n.Id) && n.MeasuringPointId.HasValue).Select(n=>n.MeasuringPointId!.Value).ToHashSet();
        var assignments = await db.Assignments.AsNoTracking().Where(a=>a.CustomerId==customerId).ToListAsync();
        var roughStart = from.HasValue ? new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue),TimeSpan.Zero).AddDays(-2) : new DateTimeOffset(now.Year,1,1,0,0,0,TimeSpan.Zero).AddDays(-2);
        var ids = assignments.Where(a=>sites.Contains(a.SiteId) && (scope.Contains(a.NodeId)||linked.Contains(a.PointId)) && a.ValidFrom < now && (a.ValidTo==null||a.ValidTo>roughStart)).Select(a=>a.PointId).Distinct().ToList();
        var points = await db.Points.IgnoreQueryFilters().AsNoTracking().Where(p=>ids.Contains(p.Id) && (medium==null||medium==""||p.Medium==medium)).OrderBy(p=>p.Id).ToListAsync();
        Require(points.Count<=limit,$"Höchstens {limit} Messstellen gleichzeitig auswerten. Einen kleineren Anlagenbereich wählen.");
        ids=points.Select(p=>p.Id).ToList(); assignments=assignments.Where(a=>ids.Contains(a.PointId)).ToList();
        var data = new MeterAnalytics { AsOf=now, Nodes=nodes, Points=points, Assignments=assignments, Installations=[], Latest=[], Segments=[],Sites=sites,ScopeNodes=scope,Linked=linked,DateFrom=from,DateTo=to };
        if(points.Count==0)return data;
        var begin=points.Min(p=>data.Range(p.Id).From);var end=points.Max(p=>data.Range(p.Id).To);
        Require(begin<end,"Analysebeginn muss vor dem aktuellen Datenstand liegen.");
        var installations=await db.Installations.AsNoTracking().Where(i=>ids.Contains(i.PointId)&&i.ValidFrom<end&&(i.ValidTo==null||i.ValidTo>begin)).ToListAsync();
        data.Installations.AddRange(installations);var installationIds=installations.Select(i=>i.Id).ToList();
        var source=db.Readings.AsNoTracking().Where(r=>installationIds.Contains(r.InstallationId)&&r.At<=now);
        Require(await source.CountAsync(r=>r.At>=begin&&r.At<=end)<=50000,"Zu viele Ablesungen. Kleineren Zeitraum oder Anlagenbereich wählen.");
        var readings=await source.Where(r=>r.At>=begin&&r.At<=end).ToListAsync();
        readings.AddRange(await source.Where(r=>r.At<begin).GroupBy(r=>r.InstallationId).Select(g=>g.OrderByDescending(r=>r.At).First()).ToListAsync());
        readings.AddRange(await source.Where(r=>r.At>end).GroupBy(r=>r.InstallationId).Select(g=>g.OrderBy(r=>r.At).First()).ToListAsync());
        var latest=await db.Readings.AsNoTracking().Where(r=>ids.Contains(r.PointId)&&r.At<=now&&db.Assignments.Any(a=>a.PointId==r.PointId&&sites.Contains(a.SiteId)&&a.ValidFrom<=r.At&&(a.ValidTo==null||r.At<a.ValidTo))).GroupBy(r=>r.PointId).Select(g=>g.OrderByDescending(r=>r.At).ThenByDescending(r=>r.CreatedAt).First()).ToListAsync();
        foreach(var r in latest)data.Latest[r.PointId]=r;
        foreach(var point in points) {
            var allowed=assignments.Where(a=>a.PointId==point.Id&&sites.Contains(a.SiteId)).ToList();
            bool Visible(MeterReading r)=>allowed.Any(a=>a.ValidFrom<=r.At&&(a.ValidTo==null||r.At<a.ValidTo));
            data.Segments[point.Id]=installations.Where(i=>i.PointId==point.Id).SelectMany(i=>{
                var rows=readings.Where(r=>r.InstallationId==i.Id).DistinctBy(r=>r.Id).OrderBy(r=>r.At).ToArray();
                return rows.Zip(rows.Skip(1),(a,b)=>new{a,b}).Where(x=>Visible(x.a)&&Visible(x.b))
                    .Select(x=>new ConsumptionEndpoints.Segment(x.a.At,x.b.At,MeterService.Delta(x.a,x.b,i)))
                    .Where(s=>allowed.Sum(a=>Overlap(new(s.From,s.To),new(a.ValidFrom,a.ValidTo??now)))==(s.To-s.From).Ticks);
            }).OrderBy(s=>s.From).ToList();
        }
        return data;
    }
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/technical/{customerId:guid}/meter-overview",async(Guid customerId,Guid? nodeId,AppDbContext db,HttpContext c)=>{
            var data=await Load(db,c,customerId,nodeId);
            var points=data.Points.Where(p=>p.DeletedAt==null&&(p.IsActive||c.IsAdmin())&&data.Assignments.Any(a=>a.PointId==p.Id&&a.ValidTo==null&&data.InScope(a))).Select(p=>{
                var latest=data.Latest.GetValueOrDefault(p.Id);var current=data.Installations.SingleOrDefault(i=>i.PointId==p.Id&&i.ValidTo==null);
                return new {pointId=p.Id,p.Name,p.Number,p.Unit,p.Medium,p.Direction,p.IsActive,latestReading=latest==null?null:new {latest.At,latest.Value,isCurrentInstallation=latest.InstallationId==current?.Id},year=data.ActualFor(p.Id)};
            });
            return Results.Ok(new {data.AsOf,points,totals=data.Totals(),method="Erfasste Ablesedifferenzen im laufenden Standortjahr mit Gerätefaktor. Zeiträume über Jahres- oder Zuordnungsgrenzen werden ohne passende Randablesung nicht hochgerechnet. Haupt- und Unterzähler werden in der Gesamtsumme nicht doppelt gezählt. Bezugs- und Liefermengen sowie Medien/Einheiten bleiben getrennt; Werte gelten bis zur jeweils letzten erfassten Ablesung."});
        }).RequireAuthorization();
    }
}
