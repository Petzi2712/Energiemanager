using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Energy;

public static class Security
{
    public static Guid UserId(this HttpContext c) => Guid.Parse(c.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static AppUser Current(this HttpContext c) => (AppUser)c.Items["user"]!;
    public static bool IsAdmin(this HttpContext c) => c.Current().Role == Roles.Admin;
    public static bool PasswordValid(string value) => value.Length is >= 12 and <= 200 && value.Any(char.IsUpper) && value.Any(char.IsLower);
    public static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    public static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static object UserView(AppUser u) => new
    {
        u.Id, u.Email, u.Name, u.Role, u.IsActive, u.MustChangePassword, u.CreatedAt,
        u.LastLoginAt, u.SessionVersion,
        customers = u.Memberships.Where(m => m.Customer.IsActive).Select(m => new { m.Customer.Id, m.Customer.Name, m.Customer.AllowUserManagement })
    };
    public static object CustomerView(Customer c, bool internalData) => new
    {
        c.Id, c.Number, c.Name, c.LegalForm, c.Address, c.Contact, c.Email, c.Phone, c.VatId,
        c.BillingAddress, c.ContractStart, c.IsActive, c.AllowUserManagement, c.Version,
        c.CreatedAt, c.UpdatedAt, notes = internalData ? c.Notes : ""
    };
    public static IQueryable<Customer> AccessibleCustomers(AppDbContext db, HttpContext c) =>
        db.Customers.Where(x => x.Memberships.Any(m => m.UserId == c.UserId()) && (x.IsActive || c.IsAdmin()));

    public static Task SignIn(HttpContext c, AppUser u) => c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
            new Claim(ClaimTypes.Name, u.Email),
            new Claim(ClaimTypes.Role, u.Role),
            new Claim("session", u.SessionVersion)
        ], CookieAuthenticationDefaults.AuthenticationScheme)),
        new AuthenticationProperties { IsPersistent = false, AllowRefresh = false });

    public static void Audit(AppDbContext db, HttpContext c, string action, string target = "", Guid? customerId = null, string details = "", string result = "Erfolgreich", AppUser? actor = null)
    {
        actor ??= c.Items.TryGetValue("user", out var o) ? o as AppUser : null;
        db.Audit.Add(new AuditEvent { UserId = actor?.Id, Actor = actor?.Email ?? "Unbekannt", Action = action,
            Target = target, CustomerId = customerId, Details = details, Result = result, CorrelationId = c.TraceIdentifier });
    }

    public static async Task SendReset(IConfiguration cfg, AppUser user, string token)
    {
        var root = cfg["App:BaseUrl"] ?? "http://localhost:8080";
        var url = $"{root}/?reset={token}&email={Uri.EscapeDataString(user.Email)}";
        using var smtp = new SmtpClient(cfg["Smtp:Host"] ?? "mail", cfg.GetValue("Smtp:Port", 1025));
        using var mail = new MailMessage("noreply@sysdatiq.local", user.Email, "sysDATIQ – Passwort zurücksetzen",
            $"Hallo {user.Name},\n\nüber diesen Link kannst du dein Passwort innerhalb von 30 Minuten zurücksetzen:\n{url}\n\nFalls du dies nicht angefordert hast, kannst du diese Nachricht ignorieren.\n\nLokale Testumgebung sysDATIQ");
        await smtp.SendMailAsync(mail);
    }
}

public static class Seed
{
    public static async Task Run(AppDbContext db, IPasswordHasher<AppUser> hasher)
    {
        if (await db.Users.AnyAsync()) return;
        var a = new Customer { Number = "DEMO-001", Name = "Nordwerk Metalltechnik GmbH", LegalForm = "GmbH",
            Address = "Musterstraße 12, 28195 Bremen", Contact = "Alex Beispiel", Email = "kontakt@nordwerk.example",
            Notes = "Synthetische Demodaten – keine echten Kundendaten.", AllowUserManagement = true };
        var b = new Customer { Number = "DEMO-002", Name = "Weserpark Logistik GmbH", LegalForm = "GmbH",
            Address = "Beispielweg 8, 28217 Bremen", Contact = "Kim Muster", Email = "kontakt@weserpark.example",
            Notes = "Synthetische Demodaten – separater Mandant." };
        AppUser Make(string email, string name, string role, params Customer[] customers)
        {
            var u = new AppUser { Email = email, NormalizedEmail = email.ToUpperInvariant(), Name = name, Role = role };
            u.PasswordHash = hasher.HashPassword(u, "Start_Energie");
            u.Memberships = customers.Select(x => new CustomerUser { Customer = x, User = u }).ToList();
            return u;
        }
        db.Users.AddRange(
            Make("admin@sysdatiq.local", "Systemadministration", Roles.Admin, a, b),
            Make("admin@nordwerk.example", "Alex Beispiel", Roles.CustomerAdmin, a),
            Make("ablesung@nordwerk.example", "Sam Beispiel", Roles.User, a),
            Make("lesen@weserpark.example", "Kim Muster", Roles.Reader, b));
        db.Audit.Add(new AuditEvent { Action = "Demo.Initialisiert", Details = "Zwei Demo-Kunden, vier Benutzer. Keine Messwerte in Phase 1." });
        await db.SaveChangesAsync();
    }
}
