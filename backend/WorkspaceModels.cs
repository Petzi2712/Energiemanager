using Microsoft.EntityFrameworkCore;

namespace Energy;

public class AppBranding
{
    public int Id { get; set; } = 1;
    public string Motto { get; set; } = "Energie verstehen.\nEffizienz gestalten.";
    public byte[]? Logo { get; set; }
    public int Version { get; set; } = 1;
}

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid SiteId { get; set; }
    public string Number { get; set; } = "";
    public string Plate { get; set; } = "";
    public string Name { get; set; } = "";
    public string Manufacturer { get; set; } = "";
    public string Model { get; set; } = "";
    public string VehicleType { get; set; } = "Pkw";
    public string DriveType { get; set; } = "Verbrennungsmotor";
    public string Fuel { get; set; } = "Diesel";
    public string Vin { get; set; } = "";
    public DateOnly? FirstRegistration { get; set; }
    public decimal InitialMileage { get; set; }
    public decimal? RatedPowerKw { get; set; }
    public decimal? BatteryKwh { get; set; }
    public string Notes { get; set; } = "";
    public int Version { get; set; } = 1;
    public DateTimeOffset? DeletedAt { get; set; }
}

public record DeleteInput(int Version, string Reason);
public record BrandingInput(string Motto, int Version);
public record AppearanceInput(bool DarkMode);

public partial class AppDbContext
{
    public DbSet<AppBranding> Branding => Set<AppBranding>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    static void ConfigureWorkspace(ModelBuilder b)
    {
        b.Entity<AppBranding>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<AppBranding>().HasData(new AppBranding());
        b.Entity<Vehicle>().HasQueryFilter(x => x.DeletedAt == null);
        b.Entity<Vehicle>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Vehicle>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => new { x.CustomerId, x.SiteId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Vehicle>().HasIndex(x => new { x.CustomerId, x.Number }).IsUnique().HasFilter("\"DeletedAt\" IS NULL");
        b.Entity<Vehicle>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<Vehicle>().Property(x => x.InitialMileage).HasPrecision(24, 6);
        b.Entity<Vehicle>().Property(x => x.RatedPowerKw).HasPrecision(24, 6);
        b.Entity<Vehicle>().Property(x => x.BatteryKwh).HasPrecision(24, 6);
    }
}
