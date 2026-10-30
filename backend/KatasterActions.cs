using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public static class KatasterActions
{
    public record MeasureInput(bool Implemented, string Notes, int Version);
    public static void Map(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/technical/{customerId:guid}/nodes").RequireAuthorization();
        group.MapPut("/{id:guid}/measure", async (Guid customerId, Guid id, MeasureInput input, AppDbContext db, HttpContext c) => {
            Admin(c); await Sites(db, c, customerId);
            var node = await db.Nodes.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId);
            Require(node != null && node.IsActive && node.AssetRole == "Consumption", "Verbraucher nicht gefunden.", 404);
            Require(node!.Version == input.Version, "Komponente wurde geändert. Bitte neu laden.", 409);
            Require(input.Notes != null && input.Notes.Length <= 10000, "Maßnahmentext mit höchstens 10.000 Zeichen verwenden.");
            var before = new { node.MeasureImplemented, node.MeasureNotes };
            node.MeasureImplemented = input.Implemented; node.MeasureNotes = input.Notes!.Trim(); node.Version++; node.UpdatedAt = DateTimeOffset.UtcNow;
            Security.Audit(db, c, "Maßnahme.Geändert", id.ToString(), customerId, JsonSerializer.Serialize(new { before, node.MeasureImplemented, node.MeasureNotes }));
            await db.SaveChangesAsync(); return Results.Ok(new { node.Version });
        });
        group.MapDelete("/{id:guid}", async (Guid customerId, Guid id, [Microsoft.AspNetCore.Mvc.FromBody] DeleteInput input, AppDbContext db, HttpContext c) => {
            Admin(c); await Sites(db, c, customerId);
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var node = await db.Nodes.SingleOrDefaultAsync(x => x.Id == id && x.CustomerId == customerId);
            Require(node != null, "Katastereintrag nicht gefunden.", 404); WorkspaceEndpoints.ValidateDelete(input, node!.Version);
            Require(!await db.Nodes.AnyAsync(x => x.ParentId == id), "Zuerst die Untereinträge löschen. Es wird kein Teilbaum automatisch gelöscht.", 409);
            Require(!await db.Assignments.AnyAsync(x => x.NodeId == id || x.SiteId == id), "Der Eintrag besitzt Zählerzuordnungen oder Zählerhistorie. Zuordnungen und Historien bleiben erhalten; diesen Eintrag bei Bedarf deaktivieren.", 409);
            Require(!await db.Vehicles.AnyAsync(x => x.SiteId == id), "Zuerst die Fahrzeuge dieses Standorts umziehen oder löschen.", 409);
            Require(!await db.ReportDefinitions.AnyAsync(x => x.SiteId == id || x.BuildingId == id || x.NodeId == id), "Zuerst die zugehörigen Berichtsvorlagen ändern oder löschen.", 409);
            node.DeletedAt = DateTimeOffset.UtcNow; node.IsActive = false; node.Version++; node.UpdatedAt = DateTimeOffset.UtcNow;
            foreach (var doc in await db.Documents.Where(x => x.NodeId == id).ToListAsync()) {
                doc.DeletedAt = DateTimeOffset.UtcNow;
                Security.Audit(db, c, "Dokument.Gelöscht", doc.Id.ToString(), customerId, JsonSerializer.Serialize(new { doc.Name, nodeId = id, input.Reason }));
            }
            Security.Audit(db, c, "Kataster.Gelöscht", id.ToString(), customerId, JsonSerializer.Serialize(new { input.Reason, node }));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(new { message = "Katastereintrag gelöscht und protokolliert." });
        });
    }
}
