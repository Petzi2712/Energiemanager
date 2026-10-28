using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Energy;

public static class UserEndpoints
{
    static async Task<bool> CanManage(AppDbContext db, HttpContext c, Guid? customerId)
    {
        if (c.IsAdmin()) return true;
        return c.Current().Role == Roles.CustomerAdmin && customerId.HasValue &&
            await Security.AccessibleCustomers(db, c).AnyAsync(x => x.Id == customerId && x.AllowUserManagement);
    }
    static object View(AppUser u, HashSet<Guid> visible) => new
    {
        u.Id, u.Email, u.Name, u.Role, u.IsActive, u.MustChangePassword, u.SessionVersion, u.LastLoginAt,
        customerIds = u.Memberships.Where(m => visible.Contains(m.CustomerId)).Select(m => m.CustomerId),
        customers = u.Memberships.Where(m => visible.Contains(m.CustomerId)).Select(m => m.Customer.Name)
    };
    public static void Map(RouteGroupBuilder api)
    {
        var routes = api.MapGroup("/users").RequireAuthorization();
        routes.MapGet("/", async (AppDbContext db, HttpContext c, Guid? customerId) =>
        {
            if (!await CanManage(db, c, customerId)) return Results.Forbid();
            var visible = (await Security.AccessibleCustomers(db, c).Select(x => x.Id).ToListAsync()).ToHashSet();
            if (customerId.HasValue && !visible.Contains(customerId.Value)) return Results.NotFound();
            var query = db.Users.Include(x => x.Memberships).ThenInclude(x => x.Customer)
                .Where(x => x.Memberships.Any(m => visible.Contains(m.CustomerId)) || (x.Id == c.UserId()));
            if (customerId.HasValue) query = query.Where(x => x.Memberships.Any(m => m.CustomerId == customerId));
            if (!c.IsAdmin()) query = query.Where(x => x.Role != Roles.Admin);
            var rows = await query.OrderBy(x => x.Name).ToListAsync();
            return Results.Ok(rows.Select(x => View(x, visible)));
        });
        routes.MapPost("/", async (UserInput input, AppDbContext db, HttpContext c, IPasswordHasher<AppUser> hasher) =>
        {
            var ids = input.CustomerIds?.Distinct().ToArray() ?? [];
            var error = await Validate(db, c, input.Name, input.Role, ids);
            if (error is not null) return Results.Json(new { message = error }, statusCode: 403);
            var u = new AppUser { Email = input.Email.Trim().ToLowerInvariant(), NormalizedEmail = input.Email.Trim().ToUpperInvariant(),
                Name = input.Name.Trim(), Role = input.Role, IsActive = input.IsActive };
            u.PasswordHash = hasher.HashPassword(u, "Start_Energie");
            u.Memberships = ids.Select(id => new CustomerUser { CustomerId = id, User = u }).ToList();
            db.Users.Add(u);
            foreach (var id in ids) Security.Audit(db, c, "Benutzer.Angelegt", u.Id.ToString(), id, JsonSerializer.Serialize(new { u.Email, u.Role, u.Name, u.IsActive }));
            await db.SaveChangesAsync();
            return Results.Created($"/api/users/{u.Id}", new { u.Id, u.Email, u.Name });
        });
        routes.MapPut("/{id:guid}", async (Guid id, UserUpdateInput input, AppDbContext db, HttpContext c) =>
        {
            var ids = input.CustomerIds?.Distinct().ToArray() ?? [];
            var error = await Validate(db, c, input.Name, input.Role, ids);
            if (error is not null) return Results.Json(new { message = error }, statusCode: 403);
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var u = await db.Users.Include(x => x.Memberships).ThenInclude(x => x.Customer).SingleOrDefaultAsync(x => x.Id == id);
            if (u is null) return Results.NotFound();
            var visible = (await Security.AccessibleCustomers(db, c).Select(x => x.Id).ToListAsync()).ToHashSet();
            if (!u.Memberships.Any(m => visible.Contains(m.CustomerId))) return Results.NotFound();
            if (u.Memberships.Any(m => !visible.Contains(m.CustomerId))) return Results.Json(new { message = "Der Benutzer besitzt weitere Kundenzuordnungen. Nur eine Administration mit Zugriff auf alle Zuordnungen darf ihn ändern." }, statusCode: 403);
            if (!c.IsAdmin() && (u.Role is Roles.Admin or Roles.CustomerAdmin || u.Memberships.Count != 1 || ids.Length != 1 || u.Memberships[0].CustomerId != ids[0])) return Results.Forbid();
            if (u.SessionVersion != input.SessionVersion) return Results.Conflict(new { message = "Benutzer wurde geändert. Bitte neu laden." });
            if (u.Id == c.UserId() && (!input.IsActive || input.Role != u.Role))
                return Results.BadRequest(new { message = "Eigene Rolle und eigener Aktivstatus können hier nicht geändert werden." });
            if (u.IsActive && u.Role == Roles.Admin && (!input.IsActive || input.Role != Roles.Admin) &&
                await db.Users.CountAsync(x => x.IsActive && x.Role == Roles.Admin) <= 1)
                return Results.BadRequest(new { message = "Mindestens ein aktiver Systemadministrator muss erhalten bleiben." });
            var before = new { u.Name, u.Role, u.IsActive, customerIds = u.Memberships.Select(m => m.CustomerId).ToArray() };
            u.Name = input.Name.Trim(); u.Role = input.Role; u.IsActive = input.IsActive; u.SessionVersion = Guid.NewGuid().ToString();
            var removed = u.Memberships.Where(m => !ids.Contains(m.CustomerId)).ToList();
            db.Memberships.RemoveRange(removed);
            foreach (var cid in ids.Where(cid => !u.Memberships.Any(m => m.CustomerId == cid))) db.Memberships.Add(new CustomerUser { CustomerId = cid, UserId = u.Id });
            foreach (var cid in ids.Union(before.customerIds)) Security.Audit(db, c, "Benutzer.Geändert", u.Id.ToString(), cid,
                JsonSerializer.Serialize(new { before, after = new { u.Name, u.Role, u.IsActive, customerIds = ids } }));
            await db.SaveChangesAsync(); await tx.CommitAsync();
            if (u.Id == c.UserId()) await Security.SignIn(c, u);
            return Results.Ok(new { message = "Benutzer gespeichert. Bestehende Sitzungen wurden beendet." });
        });
    }
    static async Task<string?> Validate(AppDbContext db, HttpContext c, string name, string role, Guid[] ids)
    {
        if (string.IsNullOrWhiteSpace(name) || !Roles.All.Contains(role) || ids.Length == 0 || ids.Length > 100)
            return "Name, gültige Rolle und mindestens eine Kundenzuordnung sind erforderlich.";
        var allowed = await Security.AccessibleCustomers(db, c).Where(x => x.IsActive).Select(x => x.Id).ToListAsync();
        if (ids.Any(id => !allowed.Contains(id))) return "Die Kundenzuordnung ist nicht erlaubt.";
        if (c.IsAdmin()) return null;
        if (role is not (Roles.User or Roles.Reader) || ids.Length != 1 || !await CanManage(db, c, ids[0]))
            return "Diese Benutzerverwaltung ist nicht freigegeben.";
        return null;
    }
}
