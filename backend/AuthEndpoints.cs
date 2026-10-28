using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Energy;

public static class AuthEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/auth/login", async (LoginInput input, AppDbContext db, IPasswordHasher<AppUser> hasher, HttpContext c) =>
        {
            var email = input.Email.Trim().ToUpperInvariant();
            var user = await db.Users.Include(x => x.Memberships).ThenInclude(x => x.Customer).SingleOrDefaultAsync(x => x.NormalizedEmail == email);
            var dummy = new AppUser();
            var hash = user?.PasswordHash ?? hasher.HashPassword(dummy, "unused-dummy-hash");
            var check = hasher.VerifyHashedPassword(user ?? dummy, hash, input.Password);
            if (user is null || !user.IsActive || user.LockedUntil > DateTimeOffset.UtcNow || check == PasswordVerificationResult.Failed)
            {
                if (user is not null && user.IsActive && !(user.LockedUntil > DateTimeOffset.UtcNow))
                {
                    user.FailedLogins++;
                    if (user.FailedLogins >= 5) { user.LockedUntil = DateTimeOffset.UtcNow.AddMinutes(15); user.FailedLogins = 0; }
                }
                Security.Audit(db, c, "Anmeldung.Fehlgeschlagen", result: "Abgelehnt", actor: user);
                await db.SaveChangesAsync();
                return Results.Json(new { message = "Anmeldung nicht möglich. Zugangsdaten prüfen; nach mehreren Fehlversuchen 15 Minuten warten." }, statusCode: 401);
            }
            if (check == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, input.Password);
            user.FailedLogins = 0; user.LockedUntil = null; user.LastLoginAt = DateTimeOffset.UtcNow;
            Security.Audit(db, c, "Anmeldung.Erfolgreich", actor: user);
            await db.SaveChangesAsync();
            await Security.SignIn(c, user);
            return Results.Ok(Security.UserView(user));
        }).RequireRateLimiting("authentication");
        api.MapGet("/auth/me", (HttpContext c) => Results.Ok(Security.UserView(c.Current()))).RequireAuthorization();
        api.MapPost("/auth/logout", async (HttpContext c, AppDbContext db) =>
        {
            var u = c.Current(); u.SessionVersion = Guid.NewGuid().ToString();
            Security.Audit(db, c, "Abmeldung"); await db.SaveChangesAsync();
            await c.SignOutAsync(); return Results.Ok(new { message = "Abgemeldet." });
        }).RequireAuthorization();
        api.MapPost("/auth/password", async (PasswordInput input, HttpContext c, AppDbContext db, IPasswordHasher<AppUser> hasher) =>
        {
            var u = c.Current();
            if (!Security.PasswordValid(input.NewPassword)) return Results.BadRequest(new { message = "Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben verwenden." });
            if (input.CurrentPassword == input.NewPassword) return Results.BadRequest(new { message = "Bitte ein neues Passwort wählen." });
            if (hasher.VerifyHashedPassword(u, u.PasswordHash, input.CurrentPassword) == PasswordVerificationResult.Failed)
                return Results.BadRequest(new { message = "Das bisherige Passwort ist falsch." });
            u.PasswordHash = hasher.HashPassword(u, input.NewPassword); u.MustChangePassword = false;
            u.SessionVersion = Guid.NewGuid().ToString();
            Security.Audit(db, c, "Passwort.Geändert"); await db.SaveChangesAsync();
            await Security.SignIn(c, u); return Results.Ok(Security.UserView(u));
        }).RequireAuthorization().RequireRateLimiting("authentication");
        api.MapPost("/auth/forgot", async (ForgotInput input, AppDbContext db, HttpContext c, IConfiguration cfg, ILogger<AppUser> logger) =>
        {
            var email = input.Email.Trim().ToUpperInvariant();
            var u = await db.Users.SingleOrDefaultAsync(x => x.NormalizedEmail == email && x.IsActive);
            if (u is not null)
            {
                var token = Security.NewToken();
                var prior = await db.PasswordResets.Where(x => x.UserId == u.Id && !x.Used).ToListAsync();
                prior.ForEach(x => x.Used = true);
                var reset = new PasswordReset { UserId = u.Id, TokenHash = Security.HashToken(token), ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30) };
                db.PasswordResets.Add(reset);
                await db.SaveChangesAsync();
                try
                {
                    await Security.SendReset(cfg, u, token);
                    Security.Audit(db, c, "Passwort.ResetAngefordert", actor: u);
                }
                catch (System.Net.Mail.SmtpException)
                {
                    reset.Used = true;
                    Security.Audit(db, c, "Passwort.ResetVersandFehlgeschlagen", result: "Fehler", actor: u);
                    logger.LogWarning("Lokaler SMTP-Versand fehlgeschlagen. Korrelation {Correlation}", c.TraceIdentifier);
                }
                await db.SaveChangesAsync();
            }
            return Results.Ok(new { message = "Falls ein aktives Konto existiert, wurde eine Nachricht an das lokale Testpostfach gesendet." });
        }).RequireRateLimiting("authentication");
        api.MapPost("/auth/reset", async (ResetInput input, AppDbContext db, IPasswordHasher<AppUser> hasher, HttpContext c) =>
        {
            if (!Security.PasswordValid(input.NewPassword)) return Results.BadRequest(new { message = "Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben verwenden." });
            var hash = Security.HashToken(input.Token);
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var reset = await db.PasswordResets.Include(x => x.User).SingleOrDefaultAsync(x => x.TokenHash == hash);
            if (reset is null || reset.Used || reset.ExpiresAt < DateTimeOffset.UtcNow || !reset.User.IsActive || reset.User.NormalizedEmail != input.Email.Trim().ToUpperInvariant())
                return Results.BadRequest(new { message = "Der Link ist ungültig oder abgelaufen." });
            var u = reset.User;
            if (hasher.VerifyHashedPassword(u, u.PasswordHash, input.NewPassword) != PasswordVerificationResult.Failed)
                return Results.BadRequest(new { message = "Bitte ein neues Passwort wählen." });
            u.PasswordHash = hasher.HashPassword(u, input.NewPassword); u.MustChangePassword = false;
            u.SessionVersion = Guid.NewGuid().ToString(); u.FailedLogins = 0; u.LockedUntil = null;
            var all = await db.PasswordResets.Where(x => x.UserId == u.Id && !x.Used).ToListAsync(); all.ForEach(x => x.Used = true);
            Security.Audit(db, c, "Passwort.Zurückgesetzt", actor: u);
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { message = "Passwort gespeichert. Bitte neu anmelden." });
        }).RequireRateLimiting("authentication");
    }
}
