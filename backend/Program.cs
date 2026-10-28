using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Energy;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

if (args.Contains("--healthcheck"))
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
    try { return (await client.GetAsync("http://127.0.0.1:8080/api/health")).IsSuccessStatusCode ? 0 : 1; }
    catch (HttpRequestException) { return 1; }
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException("ConnectionStrings__Database fehlt.")));
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210_000);
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "sysdatiq.session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.SameSite = SameSiteMode.Strict; });
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["App:DataKeyPath"] ?? "/app/keys")).SetApplicationName("sysDATIQ");
builder.Services.AddOpenApi();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("authentication", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
if (!app.Environment.IsDevelopment())
    throw new InvalidOperationException("Diese erste Ausbaustufe ist ausschließlich für lokale Entwicklung freigegeben.");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    if (app.Configuration.GetValue("App:SeedDemo", false)) await Seed.Run(db, scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>());
}
app.Use(async (c, next) =>
{
    c.Response.Headers["X-Content-Type-Options"] = "nosniff";
    c.Response.Headers["Cache-Control"] = "no-store";
    try { await next(); }
    catch (DbUpdateConcurrencyException) { await Error(c, 409, "Der Datensatz wurde zwischenzeitlich geändert. Bitte neu laden."); }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
    { await Error(c, 409, "Kundennummer oder E-Mail-Adresse ist bereits vergeben."); }
    catch (PostgresException ex) when (ex.SqlState == "40001")
    { await Error(c, 409, "Parallele Änderung. Bitte neu laden und erneut versuchen."); }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Anfrage fehlgeschlagen. Korrelation {Correlation}", c.TraceIdentifier);
        await Error(c, 500, "Die Anfrage konnte nicht verarbeitet werden. Bitte erneut versuchen.");
    }
});
app.UseAuthentication();
app.Use(async (c, next) =>
{
    if (c.User.Identity?.IsAuthenticated == true)
    {
        var db = c.RequestServices.GetRequiredService<AppDbContext>();
        var u = await db.Users.Include(x => x.Memberships).ThenInclude(x => x.Customer).SingleOrDefaultAsync(x => x.Id == c.UserId());
        if (u is null || !u.IsActive || u.SessionVersion != c.User.FindFirstValue("session"))
        { await c.SignOutAsync(); await Error(c, 401, "Die Sitzung ist abgelaufen. Bitte erneut anmelden."); return; }
        c.Items["user"] = u;
        if (u.MustChangePassword && c.Request.Path.StartsWithSegments("/api") &&
            !new[] { "/api/auth/me", "/api/auth/password", "/api/auth/logout", "/api/auth/csrf", "/api/health" }.Contains(c.Request.Path.Value))
        { await Error(c, 403, "Bitte zuerst das Startpasswort ändern."); return; }
    }
    if (c.Request.Path.StartsWithSegments("/api") && !new[] { "GET", "HEAD", "OPTIONS" }.Contains(c.Request.Method))
    {
        try { await c.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(c); }
        catch (AntiforgeryValidationException) { await Error(c, 400, "Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden."); return; }
    }
    await next();
});
app.UseRateLimiter();
app.UseAuthorization();
app.MapOpenApi().RequireAuthorization();
var api = app.MapGroup("/api").AddEndpointFilter(async (context, next) =>
{
    foreach (var input in context.Arguments.Where(x => x?.GetType().Namespace == "Energy"))
    {
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(input!, new ValidationContext(input!), errors, true))
            return Results.BadRequest(new { message = string.Join(" ", errors.Select(x => x.ErrorMessage)) });
    }
    return await next(context);
});
api.MapGet("/health", async (AppDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok", phase = 1 }) : Results.StatusCode(503));
api.MapGet("/auth/csrf", (HttpContext c, IAntiforgery a) => Results.Ok(new { token = a.GetAndStoreTokens(c).RequestToken }));
AuthEndpoints.Map(api);
CustomerEndpoints.Map(api);
UserEndpoints.Map(api);
api.MapGet("/audit", async (AppDbContext db, HttpContext c, Guid? customerId, int? limit) =>
{
    if (!c.IsAdmin()) return Results.Forbid();
    var ids = await Security.AccessibleCustomers(db, c).Select(x => x.Id).ToListAsync();
    if (customerId.HasValue && !ids.Contains(customerId.Value)) return Results.NotFound();
    var q = db.Audit.Where(x => x.CustomerId == null || ids.Contains(x.CustomerId.Value));
    if (customerId.HasValue) q = q.Where(x => x.CustomerId == customerId);
    var rows = await q.OrderByDescending(x => x.At).ThenByDescending(x => x.Id).Take(Math.Clamp(limit ?? 100, 1, 200)).ToListAsync();
    Security.Audit(db, c, "Audit.Gelesen", customerId?.ToString() ?? "Übersicht", customerId);
    await db.SaveChangesAsync();
    return Results.Ok(rows);
}).RequireAuthorization();
api.MapGet("/dashboard", async (AppDbContext db, HttpContext c) =>
{
    var ids = await Security.AccessibleCustomers(db, c).Select(x => x.Id).ToListAsync();
    var users = c.IsAdmin() ? await db.Users.CountAsync(x => x.IsActive && x.Memberships.Any(m => ids.Contains(m.CustomerId))) : (int?)null;
    return Results.Ok(new { customers = ids.Count, activeUsers = users, phase = 1,
        lastLoginAt = c.Current().LastLoginAt, demo = app.Configuration.GetValue("App:SeedDemo", false) });
}).RequireAuthorization();
await app.RunAsync();
return 0;

static async Task Error(HttpContext c, int status, string message)
{
    if (c.Response.HasStarted) return;
    c.Response.StatusCode = status;
    await c.Response.WriteAsJsonAsync(new { message, correlationId = c.TraceIdentifier });
}
