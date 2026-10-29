using Microsoft.EntityFrameworkCore;

namespace Energy;

public static class Roles
{
    public const string Admin = "SystemAdmin";
    public const string CustomerAdmin = "CustomerAdmin";
    public const string User = "CustomerUser";
    public const string Reader = "Reader";
    public static readonly string[] All = [Admin, CustomerAdmin, User, Reader];
}

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = Roles.User;
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = true;
    public string SessionVersion { get; set; } = Guid.NewGuid().ToString();
    public int FailedLogins { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }
    public List<CustomerUser> Memberships { get; set; } = [];
}

public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Number { get; set; } = "";
    public string Name { get; set; } = "";
    public string LegalForm { get; set; } = "";
    public string Address { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string VatId { get; set; } = "";
    public string BillingAddress { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateOnly? ContractStart { get; set; }
    public bool IsActive { get; set; } = true;
    public bool AllowUserManagement { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<CustomerUser> Memberships { get; set; } = [];
}

public class CustomerUser
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
}

public class AuditEvent
{
    public long Id { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? UserId { get; set; }
    public string Actor { get; set; } = "System";
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public string Result { get; set; } = "Erfolgreich";
    public string Details { get; set; } = "";
    public string CorrelationId { get; set; } = "";
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public class PasswordReset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Used { get; set; }
}

public partial class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerUser> Memberships => Set<CustomerUser>();
    public DbSet<AuditEvent> Audit => Set<AuditEvent>();
    public DbSet<PasswordReset> PasswordResets => Set<PasswordReset>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        ConfigureTechnical(b);
        b.Entity<AppUser>().HasIndex(x => x.NormalizedEmail).IsUnique();
        b.Entity<AppUser>().Property(x => x.Email).HasMaxLength(254);
        b.Entity<AppUser>().Property(x => x.NormalizedEmail).HasMaxLength(254);
        b.Entity<AppUser>().Property(x => x.Name).HasMaxLength(160);
        b.Entity<AppUser>().Property(x => x.SessionVersion).IsConcurrencyToken();
        b.Entity<Customer>().HasIndex(x => x.Number).IsUnique();
        b.Entity<Customer>().Property(x => x.Number).HasMaxLength(40);
        b.Entity<Customer>().Property(x => x.Name).HasMaxLength(200);
        b.Entity<Customer>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<CustomerUser>().HasKey(x => new { x.CustomerId, x.UserId });
        b.Entity<CustomerUser>().HasOne(x => x.Customer).WithMany(x => x.Memberships).HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<CustomerUser>().HasOne(x => x.User).WithMany(x => x.Memberships).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<PasswordReset>().HasIndex(x => x.TokenHash).IsUnique();
        b.Entity<PasswordReset>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        b.Entity<AuditEvent>().HasIndex(x => new { x.CustomerId, x.At });
        b.Entity<AuditEvent>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<AuditEvent>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
