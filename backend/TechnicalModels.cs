using Microsoft.EntityFrameworkCore;

namespace Energy;

public class TechnicalNode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid? ParentId { get; set; }
    public string Kind { get; set; } = "Site";
    public string Number { get; set; } = "";
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Usage { get; set; } = "";
    public string OperatingHours { get; set; } = "";
    public string WorkingDays { get; set; } = "";
    public string ShiftModel { get; set; } = "";
    public string ProductionHours { get; set; } = "";
    public decimal? UsableArea { get; set; }
    public decimal? HeatedArea { get; set; }
    public int? Year { get; set; }
    public string Heating { get; set; } = "";
    public string Cooling { get; set; } = "";
    public string Lighting { get; set; } = "";
    public string EnergySources { get; set; } = "";
    public string SupplySystems { get; set; } = "";
    public string TimeZone { get; set; } = "Europe/Berlin";
    public string AssetType { get; set; } = "";
    public string AssetRole { get; set; } = "Consumption";
    public decimal? AnnualEnergyValue { get; set; }
    public string AnnualEnergyUnit { get; set; } = "kWh";
    public string AnnualEnergyMedium { get; set; } = "Electricity";
    public string Manufacturer { get; set; } = "";
    public string Model { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public decimal RatedPowerW { get; set; }
    public decimal? SystemPowerW { get; set; }
    public decimal AnnualHours { get; set; }
    public decimal OperatingDays { get; set; }
    public decimal LoadFactor { get; set; } = 1;
    public Guid? MeasuringPointId { get; set; }
    public string Notes { get; set; } = "";
    public Dictionary<string, string> CustomFields { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class MeasuringPoint
{
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string Number { get; set; } = "";
    public string Name { get; set; } = "";
    public string Medium { get; set; } = "Electricity";
    public string Unit { get; set; } = "kWh";
    public string Quantity { get; set; } = "Energie";
    public string Direction { get; set; } = "Import";
    public int ReadingIntervalDays { get; set; } = 30;
    public decimal? MaxDailyConsumption { get; set; }
    public string Supplier { get; set; } = "";
    public string TariffReference { get; set; } = "";
    public string Notes { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public class MeterAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid PointId { get; set; }
    public Guid SiteId { get; set; }
    public Guid NodeId { get; set; }
    public Guid? ParentPointId { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
}
public class MeterDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string Number { get; set; } = "";
    public string Manufacturer { get; set; } = "";
    public string Model { get; set; } = "";
    public string MeterType { get; set; } = "";
}
public class MeterInstallation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PointId { get; set; }
    public Guid DeviceId { get; set; }
    public decimal Factor { get; set; } = 1;
    public decimal Resolution { get; set; } = 1;
    public int Decimals { get; set; }
    public decimal? RegisterLimit { get; set; }
    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
}
public class MeterReading
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PointId { get; set; }
    public Guid InstallationId { get; set; }
    public DateTimeOffset At { get; set; }
    public decimal Value { get; set; }
    public bool IsRollover { get; set; }
    public string Status { get; set; } = "Gültig";
    public string Event { get; set; } = "";
    public string Comment { get; set; } = "";
    public string Reason { get; set; } = "";
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public int Version { get; set; } = 1;
}
public class ReadingRevision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReadingId { get; set; }
    public Guid UserId { get; set; }
    public string Before { get; set; } = "";
    public string After { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}
public class MeterReplacement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PointId { get; set; }
    public Guid OldInstallationId { get; set; }
    public Guid NewInstallationId { get; set; }
    public DateTimeOffset At { get; set; }
    public string Reason { get; set; } = "";
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public bool IsIncomplete { get; set; }
}
public class SiteScope
{
    public Guid UserId { get; set; }
    public Guid CustomerId { get; set; }
    public bool Restricted { get; set; }
}
public class SitePermission
{
    public Guid UserId { get; set; }
    public Guid SiteId { get; set; }
}
public class StoredDocument
{
    public DateTimeOffset? DeletedAt { get; set; }
    public bool BlobDeleted { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid? NodeId { get; set; }
    public Guid? ReadingId { get; set; }
    public string BlobName { get; set; } = "";
    public string Name { get; set; } = "";
    public string ContentType { get; set; } = "image/jpeg";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public partial class AppDbContext
{
    public DbSet<TechnicalNode> Nodes => Set<TechnicalNode>();
    public DbSet<MeasuringPoint> Points => Set<MeasuringPoint>();
    public DbSet<MeterAssignment> Assignments => Set<MeterAssignment>();
    public DbSet<MeterDevice> Devices => Set<MeterDevice>();
    public DbSet<MeterInstallation> Installations => Set<MeterInstallation>();
    public DbSet<MeterReading> Readings => Set<MeterReading>();
    public DbSet<ReadingRevision> ReadingRevisions => Set<ReadingRevision>();
    public DbSet<MeterReplacement> Replacements => Set<MeterReplacement>();
    public DbSet<SiteScope> SiteScopes => Set<SiteScope>();
    public DbSet<SitePermission> SitePermissions => Set<SitePermission>();
    public DbSet<StoredDocument> Documents => Set<StoredDocument>();
    static void ConfigureTechnical(ModelBuilder b)
    {
        b.Entity<TechnicalNode>().HasAlternateKey(x => new { x.CustomerId, x.Id });
        b.Entity<TechnicalNode>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TechnicalNode>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => new { x.CustomerId, x.ParentId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TechnicalNode>().HasIndex(x => new { x.CustomerId, x.Number }).IsUnique();
        b.Entity<TechnicalNode>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<TechnicalNode>().Property(x => x.AnnualEnergyUnit).HasDefaultValue("kWh");
        b.Entity<TechnicalNode>().Property(x => x.AnnualEnergyMedium).HasDefaultValue("Electricity");
        var custom = b.Entity<TechnicalNode>().Property(x => x.CustomFields).HasColumnType("jsonb")
            .HasConversion(v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null), v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(v, (System.Text.Json.JsonSerializerOptions?)null)!);
        custom.Metadata.SetValueComparer(new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<Dictionary<string, string>>(
            (a, z) => System.Text.Json.JsonSerializer.Serialize(a, (System.Text.Json.JsonSerializerOptions?)null) == System.Text.Json.JsonSerializer.Serialize(z, (System.Text.Json.JsonSerializerOptions?)null),
            v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null).GetHashCode(),
            v => new Dictionary<string, string>(v)));
        b.Entity<MeasuringPoint>().HasAlternateKey(x => new { x.CustomerId, x.Id });
        b.Entity<MeasuringPoint>().HasQueryFilter(x => x.DeletedAt == null);
        b.Entity<MeasuringPoint>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<TechnicalNode>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => new { x.CustomerId, x.MeasuringPointId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeasuringPoint>().HasIndex(x => new { x.CustomerId, x.Number }).IsUnique();
        b.Entity<MeasuringPoint>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<MeterAssignment>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => new { x.CustomerId, x.PointId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterAssignment>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => new { x.CustomerId, x.NodeId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterAssignment>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => new { x.CustomerId, x.SiteId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterAssignment>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => new { x.CustomerId, x.ParentPointId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterAssignment>().HasIndex(x => x.PointId).IsUnique().HasFilter("\"ValidTo\" IS NULL");
        b.Entity<MeterDevice>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterDevice>().HasIndex(x => new { x.CustomerId, x.Number }).IsUnique();
        b.Entity<MeterInstallation>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => x.PointId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterInstallation>().HasOne<MeterDevice>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterInstallation>().HasIndex(x => x.PointId).IsUnique().HasFilter("\"ValidTo\" IS NULL");
        b.Entity<MeterInstallation>().HasIndex(x => x.DeviceId).IsUnique().HasFilter("\"ValidTo\" IS NULL");
        b.Entity<MeterReading>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => x.PointId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReading>().HasOne<MeterInstallation>().WithMany().HasForeignKey(x => x.InstallationId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReading>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReading>().HasIndex(x => new { x.InstallationId, x.At }).IsUnique();
        b.Entity<MeterReading>().HasIndex(x => new { x.PointId, x.At });
        b.Entity<MeterReading>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ReadingRevision>().HasOne<MeterReading>().WithMany().HasForeignKey(x => x.ReadingId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ReadingRevision>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReplacement>().HasOne<MeasuringPoint>().WithMany().HasForeignKey(x => x.PointId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReplacement>().HasOne<MeterInstallation>().WithMany().HasForeignKey(x => x.OldInstallationId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<MeterReplacement>().HasOne<MeterInstallation>().WithMany().HasForeignKey(x => x.NewInstallationId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<SiteScope>().HasKey(x => new { x.UserId, x.CustomerId });
        b.Entity<SiteScope>().HasOne<CustomerUser>().WithMany().HasForeignKey(x => new { x.CustomerId, x.UserId }).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SitePermission>().HasKey(x => new { x.UserId, x.SiteId });
        b.Entity<SitePermission>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SitePermission>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StoredDocument>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StoredDocument>().HasQueryFilter(x => x.DeletedAt == null);
        b.Entity<StoredDocument>().HasOne<TechnicalNode>().WithMany().HasForeignKey(x => new { x.CustomerId, x.NodeId }).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        b.Entity<StoredDocument>().HasOne<MeterReading>().WithMany().HasForeignKey(x => x.ReadingId).OnDelete(DeleteBehavior.Restrict);
        foreach (var entity in b.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties().Where(x => x.ClrType == typeof(decimal) || x.ClrType == typeof(decimal?)))
            { property.SetPrecision(24); property.SetScale(6); }
    }
}
