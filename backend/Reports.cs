using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public class ReportDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public string Name { get; set; } = "";
    public Guid? SiteId { get; set; }
    public Guid? BuildingId { get; set; }
    public Guid? NodeId { get; set; }
    public string Medium { get; set; } = "";
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public bool IncludeTheory { get; set; } = true;
    public bool IncludeReadings { get; set; } = true;
    public bool IncludeMeasures { get; set; } = true;
    public bool Pdf { get; set; } = true;
    public bool Excel { get; set; } = true;
    public string Notes { get; set; } = "";
    public int Version { get; set; } = 1;
    public DateTimeOffset? DeletedAt { get; set; }
}
public partial class AppDbContext
{
    public DbSet<ReportDefinition> ReportDefinitions => Set<ReportDefinition>();
    static void ConfigureReports(ModelBuilder b)
    {
        b.Entity<ReportDefinition>().HasQueryFilter(x => x.DeletedAt == null);
        b.Entity<ReportDefinition>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ReportDefinition>().HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        foreach (var name in new[] { "SiteId", "BuildingId", "NodeId" })
            b.Entity<ReportDefinition>().HasOne<TechnicalNode>().WithMany().HasForeignKey("CustomerId", name).HasPrincipalKey(x => new { x.CustomerId, x.Id }).OnDelete(DeleteBehavior.Restrict);
    }
}
public static class ReportEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/reports/{customerId:guid}").RequireAuthorization();
        group.MapGet("/", async (Guid customerId, AppDbContext db, HttpContext c) => {
            var sites = await Sites(db, c, customerId);
            var all = await db.Nodes.Where(x => x.CustomerId == customerId && x.Kind == "Site" && x.IsActive).Select(x => x.Id).ToListAsync();
            var full = all.All(sites.Contains);
            return Results.Ok(await db.ReportDefinitions.Where(x => x.CustomerId == customerId && (x.SiteId.HasValue ? sites.Contains(x.SiteId.Value) : full)).OrderBy(x => x.Name).ToListAsync());
        });
        group.MapPost("/", async (Guid customerId, ReportDefinition input, AppDbContext db, HttpContext c) => {
            Admin(c); await Validate(customerId, input, db, c); input.Id = Guid.NewGuid(); input.CustomerId = customerId; input.Version = 1; input.DeletedAt = null;
            db.ReportDefinitions.Add(input); Security.Audit(db, c, "Berichtsvorlage.Angelegt", input.Id.ToString(), customerId, JsonSerializer.Serialize(input));
            await db.SaveChangesAsync(); return Results.Created($"/api/reports/{customerId}/{input.Id}", input);
        });
        group.MapPut("/{id:guid}", async (Guid customerId, Guid id, ReportDefinition input, AppDbContext db, HttpContext c) => {
            Admin(c); await Validate(customerId, input, db, c);
            var item = await db.ReportDefinitions.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Id == id);
            Require(item != null, "Berichtsvorlage nicht gefunden.", 404); Require(item!.Version == input.Version, "Berichtsvorlage wurde geändert. Bitte neu laden.", 409);
            var before = JsonSerializer.Serialize(item); input.Id = id; input.CustomerId = customerId; input.DeletedAt = null; input.Version++;
            db.Entry(item).CurrentValues.SetValues(input); Security.Audit(db, c, "Berichtsvorlage.Geändert", id.ToString(), customerId, JsonSerializer.Serialize(new { before, after = input }));
            await db.SaveChangesAsync(); return Results.Ok(item);
        });
        group.MapDelete("/{id:guid}", async (Guid customerId, Guid id, [Microsoft.AspNetCore.Mvc.FromBody] DeleteInput input, AppDbContext db, HttpContext c) => {
            Admin(c); await Sites(db, c, customerId);
            var item = await db.ReportDefinitions.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Id == id);
            Require(item != null, "Berichtsvorlage nicht gefunden.", 404); WorkspaceEndpoints.ValidateDelete(input, item!.Version);
            item.DeletedAt = DateTimeOffset.UtcNow; item.Version++;
            Security.Audit(db, c, "Berichtsvorlage.Gelöscht", id.ToString(), customerId, JsonSerializer.Serialize(new { input.Reason, item }));
            await db.SaveChangesAsync(); return Results.Ok(new { message = "Berichtsvorlage gelöscht." });
        });
    }
    static async Task Validate(Guid customerId, ReportDefinition input, AppDbContext db, HttpContext c)
    {
        var sites = await Sites(db, c, customerId); var nodes = await db.Nodes.Where(x => x.CustomerId == customerId && x.IsActive).ToListAsync();
        Require(!string.IsNullOrWhiteSpace(input.Name) && input.Name.Length <= 160 && input.Notes != null && input.Notes.Length <= 4000, "Bezeichnung bis 160 und Hinweise bis 4.000 Zeichen verwenden.");
        Require(input.From >= new DateOnly(1900, 1, 1) && input.To <= new DateOnly(2200, 12, 31) && input.From <= input.To, "Gültigen Berichtszeitraum angeben.");
        Require(input.Medium == "" || MeterService.Media.ContainsKey(input.Medium), "Unbekanntes Medium.");
        Require((input.Pdf || input.Excel) && (input.IncludeTheory || input.IncludeReadings || input.IncludeMeasures), "Mindestens ein Ausgabeformat und einen Inhalt auswählen.");
        var site = nodes.SingleOrDefault(x => x.Id == input.SiteId && x.Kind == "Site");
        Require(!input.SiteId.HasValue || site != null && sites.Contains(site.Id), "Standort dieses Kunden nicht gefunden.");
        var building = nodes.SingleOrDefault(x => x.Id == input.BuildingId && x.Kind == "Building");
        Require(!input.BuildingId.HasValue || building != null && site != null && building.ParentId == site.Id, "Gebäude muss zum ausgewählten Standort gehören.");
        var node = nodes.SingleOrDefault(x => x.Id == input.NodeId);
        Require(!input.NodeId.HasValue || node != null && node.Kind is not ("Site" or "Building") && site != null && SiteOf(node, nodes) == site.Id, "Anlage muss zum ausgewählten Standort gehören.");
        if (node != null && building != null) {
            var cursor = node;
            while (cursor.Kind != "Building" && cursor.ParentId.HasValue) cursor = nodes.Single(x => x.Id == cursor.ParentId);
            Require(cursor.Id == building.Id, "Anlage muss zum ausgewählten Gebäude gehören.");
        }
        input.Name = input.Name.Trim(); input.Notes = input.Notes!.Trim();
    }
}
