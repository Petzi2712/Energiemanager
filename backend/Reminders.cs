using System.Net.Mail;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public class ReminderSetting
{
    public Guid CustomerId { get; set; }
    public bool Enabled { get; set; }
    public string TimeZone { get; set; } = "Europe/Berlin";
    public int Day { get; set; } = 1;
    public int Hour { get; set; } = 9;
    public int Minute { get; set; }
    public int FollowUpDays { get; set; } = 7;
    public Guid[] UserIds { get; set; } = [];
    public DateTimeOffset? NextDueAt { get; set; }
    public int Version { get; set; } = 1;
}
public class ReminderDispatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid UserId { get; set; }
    public string Cycle { get; set; } = "";
    public int Stage { get; set; }
    public int SettingsVersion { get; set; }
    public string Email { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public int Attempts { get; set; }
    public DateTimeOffset DueAt { get; set; }
    public DateTimeOffset? LeaseUntil { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SentAt { get; set; }
    public string MessageId { get; set; } = "";
    public string LastError { get; set; } = "";
    public int Version { get; set; } = 1;
}
public partial class AppDbContext
{
    public DbSet<ReminderSetting> ReminderSettings => Set<ReminderSetting>();
    public DbSet<ReminderDispatch> ReminderDispatches => Set<ReminderDispatch>();
    static void ConfigureReminders(ModelBuilder b)
    {
        b.Entity<ReminderSetting>().HasKey(x => x.CustomerId);
        b.Entity<ReminderSetting>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ReminderSetting>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ReminderDispatch>().HasIndex(x => new { x.CustomerId, x.Cycle, x.Stage, x.UserId }).IsUnique();
        b.Entity<ReminderDispatch>().HasIndex(x => new { x.Status, x.DueAt });
        b.Entity<ReminderDispatch>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ReminderDispatch>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ReminderDispatch>().HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class ReminderWorker(IServiceScopeFactory factory, IConfiguration cfg, ILogger<ReminderWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!cfg.GetValue("Reminders:WorkerEnabled", true)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        do
        {
            try { using var scope = factory.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); await Reminders.PlanDue(db); await Reminders.Process(db, cfg, null); }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { log.LogError(e, "Ableseerinnerungsauftrag fehlgeschlagen; persistente Aufträge bleiben erhalten."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
public static class Reminders
{
    static string Cycle(DateTimeOffset now, string zone) => TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(zone)).ToString("yyyy-MM");
    public static DateTimeOffset Next(ReminderSetting s, DateTimeOffset after)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(s.TimeZone); var local = TimeZoneInfo.ConvertTime(after, tz); var date = new DateTime(local.Year, local.Month, s.Day, s.Hour, s.Minute, 0, DateTimeKind.Unspecified);
        while (true) { var safe = date; while (tz.IsInvalidTime(safe)) safe = safe.AddMinutes(1); var result = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(safe, tz)); if (result > after) return result; date = date.AddMonths(1); }
    }
    static async Task<HashSet<Guid>> AllowedSites(AppDbContext db, Guid userId, Guid customerId)
    {
        var sites = db.Nodes.Where(n => n.CustomerId == customerId && n.Kind == "Site" && n.IsActive);
        if (await db.SiteScopes.AnyAsync(x => x.UserId == userId && x.CustomerId == customerId && x.Restricted)) sites = sites.Where(n => db.SitePermissions.Any(x => x.UserId == userId && x.SiteId == n.Id));
        return (await sites.Select(n => n.Id).ToListAsync()).ToHashSet();
    }
    static async Task<List<MeasuringPoint>> Due(AppDbContext db, Guid customerId, Guid userId, DateTimeOffset now)
    {
        var sites = await AllowedSites(db, userId, customerId);
        var points = await db.Points.AsNoTracking().Where(p => p.CustomerId == customerId && p.IsActive && db.Assignments.Any(a => a.PointId == p.Id && a.ValidTo == null && sites.Contains(a.SiteId))).ToListAsync();
        var ids = points.Select(p => p.Id).ToArray();
        var installations = await db.Installations.AsNoTracking().Where(i => ids.Contains(i.PointId) && i.ValidTo == null).ToListAsync();
        var latest = await db.Readings.AsNoTracking().Where(r => ids.Contains(r.PointId) && r.At <= now).GroupBy(r => r.InstallationId).Select(g => g.OrderByDescending(r => r.At).First()).ToListAsync();
        return points.Where(p => { var i = installations.SingleOrDefault(i => i.PointId == p.Id); var last = latest.SingleOrDefault(r => r.InstallationId == i?.Id); return last == null || last.At.AddDays(p.ReadingIntervalDays) < now; }).ToList();
    }
    static async Task<int> Plan(AppDbContext db, ReminderSetting s, DateTimeOffset at)
    {
        var cycle = Cycle(at, s.TimeZone); var count = 0;
        foreach (var userId in s.UserIds.Distinct()) foreach (var stage in new[] { 0, 1 })
        {
            if (stage == 1 && s.FollowUpDays == 0) continue;
            if (await db.ReminderDispatches.AnyAsync(j => j.CustomerId == s.CustomerId && j.Cycle == cycle && j.Stage == stage && j.UserId == userId)) continue;
            var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId && u.IsActive && u.Role != Roles.Reader && u.Memberships.Any(m => m.CustomerId == s.CustomerId && m.Customer.IsActive));
            if (user == null || !(await Due(db, s.CustomerId, userId, DateTimeOffset.UtcNow)).Any()) continue;
            var job = new ReminderDispatch { CustomerId = s.CustomerId, UserId = userId, Cycle = cycle, Stage = stage, SettingsVersion = s.Version, Email = user.Email, DueAt = at.AddDays(stage == 1 ? s.FollowUpDays : 0) };
            job.MessageId = $"<{job.Id:N}@sysdatiq.local>"; db.ReminderDispatches.Add(job); count++;
        }
        return count;
    }
    public static async Task PlanDue(AppDbContext db)
    {
        var now = DateTimeOffset.UtcNow; var ids = await db.ReminderSettings.Where(s => s.Enabled && s.NextDueAt <= now).Select(s => s.CustomerId).ToListAsync();
        foreach (var id in ids)
        {
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var s = await db.ReminderSettings.SingleAsync(s => s.CustomerId == id);
            if (s.Enabled && s.NextDueAt <= now)
            { // Nach Ausfall nur aktuellen Zyklus nachholen, keine historischen Massenmails.
                await Plan(db, s, now); s.NextDueAt = Next(s, now); // Nur Konfigurationsänderungen ändern die Konfigurationsversion.
                foreach (var e in db.ChangeTracker.Entries<ReminderDispatch>().Where(e => e.State == EntityState.Added)) e.Entity.SettingsVersion = s.Version;
                await db.SaveChangesAsync();
            }
            await tx.CommitAsync();
        }
    }
    public static async Task<int> Process(AppDbContext db, IConfiguration cfg, Guid? customerId)
    {
        var now = DateTimeOffset.UtcNow;
        var lost = await db.ReminderDispatches.Where(j => (customerId == null || j.CustomerId == customerId) && j.Status == "Sending" && j.LeaseUntil < now).ToListAsync();
        foreach (var j in lost) { j.Status = "Unclear"; j.LastError = "Versand unterbrochen; Annahme durch SMTP unklar. Vor erneutem Versand prüfen."; j.Version++; Audit(db, j, "Erinnerung.VersandUnklar"); }
        await db.SaveChangesAsync();
        var ids = await db.ReminderDispatches.Where(j => (customerId == null || j.CustomerId == customerId) && (j.Status == "Pending" || j.Status == "Retry") && j.DueAt <= now).OrderBy(j => j.DueAt).Select(j => j.Id).Take(50).ToListAsync(); var sent = 0;
        foreach (var id in ids)
        {
            db.ChangeTracker.Clear();
            var job = await db.ReminderDispatches.SingleAsync(j => j.Id == id);
            if (job.Status is not ("Pending" or "Retry") || job.DueAt > DateTimeOffset.UtcNow) continue;
            var setting = await db.ReminderSettings.AsNoTracking().SingleAsync(s => s.CustomerId == job.CustomerId);
            var valid = setting.Enabled && setting.Version == job.SettingsVersion && setting.UserIds.Contains(job.UserId) && await db.Users.AnyAsync(u => u.Id == job.UserId && u.IsActive && u.Email == job.Email && u.Role != Roles.Reader && u.Memberships.Any(m => m.CustomerId == job.CustomerId && m.Customer.IsActive));
            var points = valid ? await Due(db, job.CustomerId, job.UserId, DateTimeOffset.UtcNow) : [];
            if (!valid || points.Count == 0) { job.Status = "Cancelled"; job.LastError = valid ? "Alle freigegebenen Messstellen abgelesen." : "Konfiguration oder Berechtigung geändert."; job.Version++; Audit(db, job, "Erinnerung.Abgebrochen"); await db.SaveChangesAsync(); continue; }
            var host = cfg["Smtp:Host"] ?? "mail";
            Require(new[] { "mail", "localhost", "127.0.0.1", "::1" }.Contains(host), "Ableseerinnerungen sind in dieser lokalen Version ausschließlich für Mailpit freigegeben.", 400);
            job.Status = "Sending"; job.Attempts++; job.LeaseUntil = DateTimeOffset.UtcNow.AddMinutes(3); job.Version++;
            try { await db.SaveChangesAsync(); } catch (DbUpdateConcurrencyException) { continue; } // Nur der erfolgreiche Besitzer sendet.
            var customer = await db.Customers.AsNoTracking().SingleAsync(x => x.Id == job.CustomerId);
            var root = cfg["App:BaseUrl"] ?? "http://localhost:8080";
            using var message = new MailMessage("noreply@sysdatiq.local", job.Email, $"sysDATIQ – {(job.Stage == 1 ? "Folgeerinnerung" : "Ableseerinnerung")} {job.Cycle}",
                $"Für {customer.Name} sind folgende Zählerablesungen fällig:\n\n" + string.Join("\n", points.Select(p => $"{p.Number} · {p.Name} ({p.Unit}), Intervall {p.ReadingIntervalDays} Tage")) + $"\n\nBitte im geschützten Portal anmelden:\n{root.TrimEnd('/')}/?readings=1&customerId={job.CustomerId}\n\nLokale Testumgebung – Mailpit. Auftrags-ID {job.Id}. Keine automatische Annahme einer Zustellung.");
            message.Headers.Add("Message-ID", job.MessageId);
            using var smtp = new SmtpClient(host, cfg.GetValue("Smtp:Port", 1025)) { Timeout = 15000 };
            try { await smtp.SendMailAsync(message).WaitAsync(TimeSpan.FromSeconds(25)); job.Status = "Sent"; job.SentAt = DateTimeOffset.UtcNow; job.LastError = "SMTP hat die Nachricht angenommen; keine Zustellbestätigung."; sent++; }
            catch (SmtpException ex) when ((int)ex.StatusCode is >= 400 and < 500) { job.Status = job.Attempts < 3 ? "Retry" : "Failed"; job.DueAt = DateTimeOffset.UtcNow.AddMinutes(5 * Math.Pow(2, job.Attempts - 1)); job.LastError = $"Temporäre SMTP-Ablehnung {(int)ex.StatusCode}."; }
            catch (SmtpException ex) when ((int)ex.StatusCode >= 500) { job.Status = "Failed"; job.LastError = $"Dauerhafte SMTP-Ablehnung {(int)ex.StatusCode}."; }
            catch (Exception ex) when (ex is SmtpException or TimeoutException or System.IO.IOException) { job.Status = "Unclear"; job.LastError = "SMTP-Annahme unklar. Vor erneutem Versand Mailpit anhand Auftrags-ID prüfen."; }
            job.LeaseUntil = null; job.Version++; Audit(db, job, "Erinnerung." + job.Status); await db.SaveChangesAsync();
        }
        return sent;
    }
    static void Audit(AppDbContext db, ReminderDispatch j, string action) => db.Audit.Add(new() { CustomerId = j.CustomerId, Actor = "Erinnerungsdienst", Action = action, Target = j.Id.ToString(), Details = JsonSerializer.Serialize(new { j.Cycle, j.Stage, j.Status, j.Attempts, j.LastError }) });
    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/reminders/{customerId:guid}").RequireAuthorization();
        g.MapGet("/", async (Guid customerId, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId);
            var setting = await db.ReminderSettings.AsNoTracking().SingleOrDefaultAsync(s => s.CustomerId == customerId) ?? new ReminderSetting { CustomerId = customerId };
            var recipients = await db.Users.Where(u => u.IsActive && u.Role != Roles.Reader && u.Memberships.Any(m => m.CustomerId == customerId)).Select(u => new { u.Id, u.Name, u.Email }).ToListAsync();
            var jobs = await db.ReminderDispatches.AsNoTracking().Where(j => j.CustomerId == customerId).OrderByDescending(j => j.CreatedAt).Take(100).ToListAsync(); return Results.Ok(new { setting, recipients, jobs, transport = "Mailpit (lokal)", workerEnabled = c.RequestServices.GetRequiredService<IConfiguration>().GetValue("Reminders:WorkerEnabled", true) });
        });
        g.MapPut("/", async (Guid customerId, ReminderSetting input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId); Require(input.Day is >= 1 and <= 28 && input.Hour is >= 0 and <= 23 && input.Minute is >= 0 and <= 59 && input.FollowUpDays is >= 0 and <= 21, "Tag 1–28, Uhrzeit 00:00–23:59 und Folgefrist 0–21 Tage angeben.");
            Require(input.UserIds != null && input.UserIds.Length <= 100, "Höchstens 100 Empfänger auswählen."); Require(!string.IsNullOrWhiteSpace(input.TimeZone), "Zeitzone angeben."); try { TimeZoneInfo.FindSystemTimeZoneById(input.TimeZone); } catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { throw new TechnicalFault(400, "Gültige IANA-Zeitzone angeben."); }
            var users = await db.Users.Where(u => input.UserIds!.Contains(u.Id) && u.IsActive && u.Role != Roles.Reader && u.Memberships.Any(m => m.CustomerId == customerId)).CountAsync(); Require(users == input.UserIds!.Distinct().Count() && (!input.Enabled || users > 0), "Aktive, schreibberechtigte Kundenbenutzer als Empfänger wählen.");
            var s = await db.ReminderSettings.SingleOrDefaultAsync(s => s.CustomerId == customerId); Require(s == null ? input.Version == 1 : s.Version == input.Version, "Einstellung wurde geändert.", 409);
            if (s == null) { s = new ReminderSetting { CustomerId = customerId }; db.ReminderSettings.Add(s); }
            s.Enabled = input.Enabled; s.Day = input.Day; s.Hour = input.Hour; s.Minute = input.Minute; s.FollowUpDays = input.FollowUpDays; s.TimeZone = input.TimeZone; s.UserIds = input.UserIds!.Distinct().ToArray(); s.Version++; s.NextDueAt = s.Enabled ? Next(s, DateTimeOffset.UtcNow) : null;
            Security.Audit(db, c, "Erinnerung.Konfiguriert", customerId.ToString(), customerId, JsonSerializer.Serialize(s)); await db.SaveChangesAsync(); return Results.Ok(s);
        });
        g.MapPost("/plan", async (Guid customerId, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId); await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var s = await db.ReminderSettings.SingleOrDefaultAsync(s => s.CustomerId == customerId); Require(s != null && s.Enabled, "Erinnerungen zuerst konfigurieren und aktivieren.");
            var count = await Plan(db, s!, DateTimeOffset.UtcNow); Security.Audit(db, c, "Erinnerung.Geplant", customerId.ToString(), customerId, $"{count} neue Aufträge; Zyklus wird nicht doppelt geplant."); await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { planned = count });
        });
        g.MapPost("/process", async (Guid customerId, AppDbContext db, HttpContext c, IConfiguration cfg) => { Admin(c); await Sites(db, c, customerId); return Results.Ok(new { sent = await Process(db, cfg, customerId) }); });
        g.MapPost("/{id:guid}/resolve", async (Guid customerId, Guid id, ResolveInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId); Require((input.Reason ?? "").Trim().Length is >= 5 and <= 2000 && new[] { "Sent", "Pending", "Cancelled" }.Contains(input.Status), "Prüfung und Entscheidung mit Begründung dokumentieren.");
            var j = await db.ReminderDispatches.SingleOrDefaultAsync(j => j.Id == id && j.CustomerId == customerId); Require(j != null, "Auftrag nicht gefunden.", 404); Require(j!.Version == input.Version && j.Status is "Unclear" or "Failed", "Auftrag geändert oder nicht klärungsbedürftig.", 409);
            j.Status = input.Status; j.Version++; j.DueAt = DateTimeOffset.UtcNow; if (input.Status == "Sent") j.SentAt = DateTimeOffset.UtcNow; j.LastError = input.Reason!.Trim(); Security.Audit(db, c, "Erinnerung.ManuellGeklärt", j.Id.ToString(), customerId, JsonSerializer.Serialize(input)); await db.SaveChangesAsync(); return Results.Ok(j);
        });
    }
    public record ResolveInput(int Version, string Status, string Reason);
}
