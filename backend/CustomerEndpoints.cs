using System.Text.Json;
using System.Net.Mail;
using Microsoft.EntityFrameworkCore;

namespace Energy;

public static class CustomerEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var routes = api.MapGroup("/customers").RequireAuthorization();
        routes.MapGet("/", async (AppDbContext db, HttpContext c) =>
        {
            var rows = await Security.AccessibleCustomers(db, c).OrderBy(x => x.Number).ToListAsync();
            return Results.Ok(rows.Select(x => Security.CustomerView(x, c.IsAdmin())));
        });
        routes.MapGet("/{id:guid}", async (Guid id, AppDbContext db, HttpContext c) =>
        {
            var customer = await Security.AccessibleCustomers(db, c).SingleOrDefaultAsync(x => x.Id == id);
            if (customer is null) return Results.NotFound();
            Security.Audit(db, c, "Kunde.Gelesen", id.ToString(), id); await db.SaveChangesAsync();
            return Results.Ok(Security.CustomerView(customer, c.IsAdmin()));
        });
        routes.MapPost("/", async (CustomerInput input, AppDbContext db, HttpContext c) =>
        {
            if (!c.IsAdmin()) return Results.Forbid();
            var error = Validate(input); if (error is not null) return Results.BadRequest(new { message = error });
            var customer = new Customer(); Apply(customer, input);
            db.Customers.Add(customer); db.Memberships.Add(new CustomerUser { Customer = customer, UserId = c.UserId() });
            Security.Audit(db, c, "Kunde.Angelegt", customer.Id.ToString(), customer.Id,
                JsonSerializer.Serialize(Security.CustomerView(customer, true)));
            await db.SaveChangesAsync();
            return Results.Created($"/api/customers/{customer.Id}", Security.CustomerView(customer, true));
        });
        routes.MapPut("/{id:guid}", async (Guid id, CustomerInput input, AppDbContext db, HttpContext c) =>
        {
            if (!c.IsAdmin()) return Results.Forbid();
            var customer = await Security.AccessibleCustomers(db, c).SingleOrDefaultAsync(x => x.Id == id);
            if (customer is null) return Results.NotFound();
            if (input.Version != customer.Version) return Results.Conflict(new { message = "Der Kunde wurde zwischenzeitlich geändert. Bitte neu laden." });
            var error = Validate(input); if (error is not null) return Results.BadRequest(new { message = error });
            var before = Security.CustomerView(customer, true);
            Apply(customer, input); customer.Version++; customer.UpdatedAt = DateTimeOffset.UtcNow;
            Security.Audit(db, c, "Kunde.Geändert", id.ToString(), id,
                JsonSerializer.Serialize(new { before, after = Security.CustomerView(customer, true) }));
            await db.SaveChangesAsync(); return Results.Ok(Security.CustomerView(customer, true));
        });
    }
    static string? Validate(CustomerInput i)
    {
        if (string.IsNullOrWhiteSpace(i.Number) || string.IsNullOrWhiteSpace(i.Name)) return "Kundennummer und Firmenname sind erforderlich.";
        if (!string.IsNullOrEmpty(i.Email) && !MailAddress.TryCreate(i.Email, out _)) return "Bitte eine gültige E-Mail-Adresse eingeben.";
        return null;
    }
    static void Apply(Customer c, CustomerInput i)
    {
        c.Number = i.Number.Trim().ToUpperInvariant(); c.Name = i.Name.Trim(); c.LegalForm = i.LegalForm ?? "";
        c.Address = i.Address ?? ""; c.Contact = i.Contact ?? ""; c.Email = i.Email ?? ""; c.Phone = i.Phone ?? "";
        c.VatId = i.VatId ?? ""; c.BillingAddress = i.BillingAddress ?? ""; c.Notes = i.Notes ?? "";
        c.ContractStart = i.ContractStart; c.IsActive = i.IsActive; c.AllowUserManagement = i.AllowUserManagement;
    }
}
