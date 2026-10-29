using Microsoft.EntityFrameworkCore;

namespace Energy;
public static class DashboardEndpoints
{
    public static void Map(RouteGroupBuilder api, IConfiguration config)
    {
        api.MapGet("/dashboard", async (AppDbContext db, HttpContext c, Guid? customerId) =>
        {
            var customerIds = await Security.AccessibleCustomers(db, c).Select(x => x.Id).ToListAsync();
            if (customerId.HasValue) { TechnicalAccess.Require(customerIds.Contains(customerId.Value), "Kunde nicht gefunden.", 404); customerIds = [customerId.Value]; }
            var sites = new HashSet<Guid>();
            foreach (var id in customerIds) sites.UnionWith(await TechnicalAccess.Sites(db, c, id));
            var assignments = await db.Assignments.Where(x => sites.Contains(x.SiteId) && x.ValidTo == null).ToListAsync();
            var pointIds = assignments.Select(x => x.PointId).ToList();
            var points = await db.Points.Where(x => pointIds.Contains(x.Id) && x.IsActive).ToListAsync();
            var activeIds = points.Select(x => x.Id).ToList();
            var latest = await db.Readings.Where(x => activeIds.Contains(x.PointId) && db.Assignments.Any(a => a.PointId == x.PointId && sites.Contains(a.SiteId) && a.ValidFrom <= x.At && (a.ValidTo == null || x.At < a.ValidTo)))
                .GroupBy(x => x.PointId).Select(g => g.OrderByDescending(x => x.At).ThenByDescending(x => x.CreatedAt).First()).ToListAsync();
            var overdue = points.Count(p => (latest.SingleOrDefault(r => r.PointId == p.Id)?.At ?? assignments.Single(a => a.PointId == p.Id).ValidFrom).AddDays(p.ReadingIntervalDays) < DateTimeOffset.UtcNow);
            return Results.Ok(new { customers = customerIds.Count, activeUsers = c.IsAdmin() ? await db.Users.CountAsync(x => x.IsActive && x.Memberships.Any(m => customerIds.Contains(m.CustomerId))) : (int?)null,
                phase = 3, lastLoginAt = c.Current().LastLoginAt, demo = config.GetValue("App:SeedDemo", false), sites = sites.Count, measuringPoints = points.Count, overdueReadings = overdue,
                suspiciousReadings = await db.Readings.CountAsync(x => activeIds.Contains(x.PointId) && x.Status == "Auffällig" && db.Assignments.Any(a => a.PointId == x.PointId && sites.Contains(a.SiteId) && a.ValidFrom <= x.At && (a.ValidTo == null || x.At < a.ValidTo))),
                recentReadings = latest.OrderByDescending(x => x.CreatedAt).Take(8).Select(r => new { r.Id, r.PointId, pointName = points.Single(p => p.Id == r.PointId).Name, unit = points.Single(p => p.Id == r.PointId).Unit, r.Value, r.At, r.Status }) });
        }).RequireAuthorization();
    }
}
