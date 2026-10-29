using System.ComponentModel.DataAnnotations;

namespace Energy;
public record DeviceInput([property: Required, MaxLength(100)] string Number, string Manufacturer = "", string Model = "", string MeterType = "", decimal Factor = 1, int Decimals = 0, decimal Resolution = 1, decimal? RegisterLimit = null);
public record PointInput(
    [property: Required, MaxLength(60)] string Number, [property: Required, MaxLength(200)] string Name,
    Guid NodeId, Guid? ParentPointId, DateTimeOffset At, DeviceInput Device, decimal? InitialValue = null,
    string Medium = "Electricity", string Unit = "kWh", string Quantity = "Energie", string Direction = "Import",
    int ReadingIntervalDays = 30, decimal? MaxDailyConsumption = null, string Supplier = "", string TariffReference = "", string Notes = "", bool IsActive = true, int Version = 1);
public record AssignmentInput(Guid NodeId, Guid? ParentPointId, DateTimeOffset At, int Version);
public record ReadingInput(DateTimeOffset At, decimal Value, string Comment = "", string Event = "", string Reason = "", bool ConfirmWarning = false, bool IsRollover = false, int Version = 1);
public record ReplacementInput(DateTimeOffset At, decimal? OldEndValue, decimal? NewStartValue, DeviceInput Device, [property: Required, MaxLength(2000)] string Reason, int Version, bool ConfirmIncomplete = false);
public record SiteAccessInput(Guid CustomerId, bool Restricted, Guid[] SiteIds);
public sealed class TechnicalFault(int status, string message) : Exception(message) { public int Status { get; } = status; }

public static class TechnicalAccess
{
    public static void Require(bool condition, string message, int status = 400) { if (!condition) throw new TechnicalFault(status, message); }
    public static void Admin(HttpContext c) => Require(c.IsAdmin(), "Diese Funktion ist der Systemadministration vorbehalten.", 403);
    public static void Writer(HttpContext c) => Require(c.Current().Role != Roles.Reader, "Dieser Zugang besitzt nur Leserechte.", 403);
    public static async Task<HashSet<Guid>> Sites(AppDbContext db, HttpContext c, Guid customerId)
    {
        Require(await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(Security.AccessibleCustomers(db, c), x => x.Id == customerId), "Kunde nicht gefunden.", 404);
        var sites = db.Nodes.Where(x => x.CustomerId == customerId && x.Kind == "Site" && (x.IsActive || c.IsAdmin()));
        if (!c.IsAdmin() && await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(db.SiteScopes, x => x.UserId == c.UserId() && x.CustomerId == customerId && x.Restricted))
            sites = sites.Where(x => db.SitePermissions.Any(p => p.UserId == c.UserId() && p.SiteId == x.Id));
        return (await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(sites.Select(x => x.Id))).ToHashSet();
    }
    public static Guid SiteOf(TechnicalNode node, IReadOnlyList<TechnicalNode> nodes)
    {
        var current = node;
        for (var i = 0; i < 16; i++)
        {
            if (current.Kind == "Site") return current.Id;
            current = nodes.SingleOrDefault(x => x.Id == current.ParentId) ?? throw new TechnicalFault(400, "Ungültige technische Hierarchie.");
        }
        throw new TechnicalFault(400, "Die maximale Strukturtiefe ist überschritten.");
    }
}
