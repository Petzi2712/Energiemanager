using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
using static Energy.MeterService;

namespace Energy;
public static class MeterEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/meters").RequireAuthorization();
        group.MapPost("/", async (Guid customerId, PointInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await Sites(db, c, customerId); Validate(input);
            Require(input.At <= DateTimeOffset.UtcNow.AddMinutes(5), "Einbaudatum liegt in der Zukunft.");
            await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var point = new MeasuringPoint { CustomerId = customerId }; Apply(point, input);
            var assignment = await Assignment(db, customerId, point.Id, input.NodeId, input.ParentPointId, input.At);
            await CheckParent(db, point, assignment.ParentPointId);
            var (device, installation) = Install(customerId, point.Id, input.At, input.Device);
            db.Points.Add(point); db.Assignments.Add(assignment); db.Devices.Add(device); db.Installations.Add(installation);
            if (input.InitialValue.HasValue)
            {
                Value(input.InitialValue.Value, installation);
                db.Readings.Add(Reading(point.Id, installation.Id, new ReadingInput(input.At, input.InitialValue.Value, Event: "Sonstiges Ereignis", Comment: "Anfangsstand bei Inbetriebnahme"), c.UserId()));
            }
            Security.Audit(db, c, "Messstelle.Angelegt", point.Id.ToString(), customerId, JsonSerializer.Serialize(new { point, assignment, device, installation }));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Created($"/api/meters/{point.Id}", point);
        });
        group.MapPut("/{id:guid}", async (Guid id, PointInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); var p = await Point(db, c, id); Validate(input);
            Require(p.Version == input.Version, "Messstelle wurde geändert. Bitte neu laden.", 409);
            Require(p.Medium == input.Medium && p.Unit == input.Unit && p.Direction == input.Direction, "Medium, Einheit und Messrichtung bleiben für historische Messwerte unverändert. Bei Bedarf eine neue Messstelle anlegen.");
            var a = await db.Assignments.SingleAsync(x => x.PointId == id && x.ValidTo == null);
            Require(a.NodeId == input.NodeId && a.ParentPointId == input.ParentPointId, "Strukturänderungen über die historisierte Zuordnung erfassen.");
            if (!input.IsActive) Require(!await db.Assignments.AnyAsync(x => x.ParentPointId == id && x.ValidTo == null && db.Points.Any(p => p.Id == x.PointId && p.IsActive)), "Zuerst aktive Unterzähler deaktivieren.");
            var before = JsonSerializer.Serialize(p); Apply(p, input); p.Version++;
            Security.Audit(db, c, "Messstelle.Geändert", id.ToString(), p.CustomerId, JsonSerializer.Serialize(new { before = JsonDocument.Parse(before).RootElement, after = p }));
            await db.SaveChangesAsync(); return Results.Ok(p);
        });
        group.MapPost("/{id:guid}/assignment", async (Guid id, AssignmentInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var p = await Point(db, c, id); Require(p.Version == input.Version, "Messstelle wurde geändert.", 409);
            var at = input.At.ToUniversalTime(); var old = await db.Assignments.SingleAsync(x => x.PointId == id && x.ValidTo == null);
            Require(at > old.ValidFrom && at <= DateTimeOffset.UtcNow.AddMinutes(5) && !await db.Readings.AnyAsync(x => x.PointId == id && x.At >= at), "Neue Zuordnungen müssen nach der bisherigen Zuordnung und nach allen gespeicherten Ablesungen liegen.");
            var assignment = await Assignment(db, p.CustomerId, id, input.NodeId, input.ParentPointId, at); await CheckParent(db, p, assignment.ParentPointId);
            Require(old.SiteId == assignment.SiteId || !await db.Assignments.AnyAsync(x => x.ParentPointId == id && x.ValidTo == null), "Messstellen mit Unterzählern können erst nach deren Neuzuordnung den Standort wechseln.");
            old.ValidTo = at; p.Version++; await db.SaveChangesAsync(); db.Assignments.Add(assignment);
            Security.Audit(db, c, "Messstelle.Umgehängt", id.ToString(), p.CustomerId, JsonSerializer.Serialize(new { before = old, after = assignment }));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(assignment);
        });
        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db, HttpContext c) =>
        {
            var p = await Point(db, c, id); var sites = await Sites(db, c, p.CustomerId);
            var assignments = await db.Assignments.Where(x => x.PointId == id && sites.Contains(x.SiteId)).OrderBy(x => x.ValidFrom).ToListAsync();
            var installations = await db.Installations.Where(x => x.PointId == id && db.Assignments.Any(a => a.PointId == id && sites.Contains(a.SiteId) && (x.ValidTo == null || a.ValidFrom <= x.ValidTo) && (a.ValidTo == null || a.ValidTo >= x.ValidFrom))).OrderBy(x => x.ValidFrom).ToListAsync();
            var devices = await db.Devices.Where(x => installations.Select(i => i.DeviceId).Contains(x.Id)).ToListAsync();
            var rows = await VisibleReadings(db, id, sites).OrderByDescending(x => x.At).ThenByDescending(x => x.CreatedAt).Take(500).ToListAsync();
            var ordered = rows.OrderBy(x => x.At).ThenBy(x => x.CreatedAt).ToList();
            var result = rows.Select(r => { var previous = ordered.LastOrDefault(x => x.InstallationId == r.InstallationId && x.At < r.At); return new { reading = r, consumption = previous == null ? (decimal?)null : Delta(previous, r, installations.Single(i => i.Id == r.InstallationId)) }; });
            var revisions = await db.ReadingRevisions.Where(x => rows.Select(r => r.Id).Contains(x.ReadingId)).OrderByDescending(x => x.At).ToListAsync();
            var replacements = await db.Replacements.Where(x => x.PointId == id && db.Assignments.Any(a => a.PointId == id && sites.Contains(a.SiteId) && a.ValidFrom <= x.At && (a.ValidTo == null || x.At < a.ValidTo))).ToListAsync();
            var documents = await db.Documents.Where(x => x.ReadingId != null && rows.Select(r => r.Id).Contains(x.ReadingId.Value)).Select(x => new { x.Id, x.ReadingId, x.Name, x.ContentType }).ToListAsync();
            foreach (var replacement in replacements)
                replacement.IsIncomplete = !await db.Readings.AnyAsync(x => x.InstallationId == replacement.OldInstallationId && x.At == replacement.At) || !await db.Readings.AnyAsync(x => x.InstallationId == replacement.NewInstallationId && x.At == replacement.At);
            Security.Audit(db, c, "Messstelle.Gelesen", id.ToString(), p.CustomerId); await db.SaveChangesAsync();
            return Results.Ok(new { point = p, assignments, installations, devices, readings = result, revisions, replacements, documents });
        });
        group.MapPost("/{id:guid}/readings", async (Guid id, ReadingInput input, AppDbContext db, HttpContext c) =>
        {
            Writer(c); await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var p = await Point(db, c, id); Require(p.IsActive, "Messstelle ist deaktiviert.");
            var sites = await Sites(db, c, p.CustomerId); var at = input.At.ToUniversalTime();
            Require(await db.Assignments.AnyAsync(x => x.PointId == id && sites.Contains(x.SiteId) && x.ValidFrom <= at && (x.ValidTo == null || at < x.ValidTo)), "Keine Standortfreigabe für diesen Ablesezeitpunkt.", 403);
            var i = await db.Installations.Where(x => x.PointId == id && x.ValidFrom <= at && (x.ValidTo == null || at < x.ValidTo)).SingleOrDefaultAsync();
            Require(i != null, "Keine gültige Geräteinstallation für diesen Zeitpunkt.");
            var status = await ValidateReading(db, p, i!, input); var reading = Reading(id, i!.Id, input, c.UserId(), status);
            db.Readings.Add(reading); p.Version++;
            Security.Audit(db, c, "Ablesung.Angelegt", reading.Id.ToString(), p.CustomerId, JsonSerializer.Serialize(reading));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Created($"/api/meters/{id}", reading);
        });
        group.MapPut("/{id:guid}/readings/{readingId:guid}", async (Guid id, Guid readingId, ReadingInput input, AppDbContext db, HttpContext c) =>
        {
            Admin(c); await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var p = await Point(db, c, id); var r = await db.Readings.SingleOrDefaultAsync(x => x.PointId == id && x.Id == readingId);
            Require(r != null, "Ablesung nicht gefunden.", 404); Require(r!.Version == input.Version, "Ablesung wurde zwischenzeitlich geändert.", 409);
            Require(input.At.ToUniversalTime() == r.At && input.Reason?.Trim().Length >= 5, "Zeitpunkt bleibt erhalten; eine Korrektur benötigt eine Begründung.");
            var i = await db.Installations.SingleAsync(x => x.Id == r.InstallationId);
            var status = await ValidateReading(db, p, i, input, r.Id); var before = JsonSerializer.Serialize(r);
            r.Value = input.Value; r.Comment = input.Comment; r.Reason = input.Reason!; r.Event = input.Event; r.IsRollover = input.IsRollover; r.Status = status == "Auffällig" ? "Auffällig" : "Korrigiert"; r.Version++; p.Version++;
            db.ReadingRevisions.Add(new ReadingRevision { ReadingId = r.Id, UserId = c.UserId(), Before = before, After = JsonSerializer.Serialize(r), Reason = input.Reason! });
            Security.Audit(db, c, "Ablesung.Korrigiert", r.Id.ToString(), p.CustomerId, JsonSerializer.Serialize(new { before = JsonDocument.Parse(before).RootElement, after = r }));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(r);
        });
        group.MapPost("/{id:guid}/replacement", async (Guid id, ReplacementInput input, AppDbContext db, HttpContext c) =>
        {
            Writer(c); await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var p = await Point(db, c, id); Require(p.IsActive && p.Version == input.Version, "Messstelle wurde geändert oder deaktiviert. Bitte neu laden.", 409);
            var at = input.At.ToUniversalTime(); var old = await db.Installations.SingleAsync(x => x.PointId == id && x.ValidTo == null);
            Require(at > old.ValidFrom && at <= DateTimeOffset.UtcNow.AddMinutes(5) && !await db.Readings.AnyAsync(x => x.PointId == id && x.At >= at), "Zählertausch muss nach allen vorhandenen Ablesungen und innerhalb des bisherigen Gerätezeitraums liegen.");
            Require(!string.IsNullOrWhiteSpace(input.Reason), "Grund des Zählertauschs angeben.");
            Require(input.OldEndValue.HasValue && input.NewStartValue.HasValue || input.ConfirmIncomplete, "Fehlende Austauschstände führen zu unvollständigem Verbrauch. Dies ausdrücklich bestätigen.", 422);
            var (device, installation) = Install(p.CustomerId, id, at, input.Device);
            if (input.OldEndValue.HasValue)
            {
                var readingInput = new ReadingInput(at, input.OldEndValue.Value, Event: "Zählertausch", Reason: input.Reason, ConfirmWarning: true);
                var status = await ValidateReading(db, p, old, readingInput);
                db.Readings.Add(Reading(id, old.Id, readingInput, c.UserId(), status));
            }
            if (input.NewStartValue.HasValue) Value(input.NewStartValue.Value, installation);
            old.ValidTo = at; p.Version++; await db.SaveChangesAsync();
            db.Devices.Add(device); db.Installations.Add(installation);
            if (input.NewStartValue.HasValue) db.Readings.Add(Reading(id, installation.Id, new ReadingInput(at, input.NewStartValue.Value, Event: "Zählertausch", Reason: input.Reason), c.UserId()));
            var replacement = new MeterReplacement { PointId = id, OldInstallationId = old.Id, NewInstallationId = installation.Id, At = at, Reason = input.Reason, IsIncomplete = !input.OldEndValue.HasValue || !input.NewStartValue.HasValue };
            db.Replacements.Add(replacement); Security.Audit(db, c, "Zähler.Getauscht", id.ToString(), p.CustomerId, JsonSerializer.Serialize(replacement));
            await db.SaveChangesAsync(); await tx.CommitAsync(); return Results.Ok(replacement);
        });
        group.MapGet("/{id:guid}/balance", async (Guid id, DateTimeOffset from, DateTimeOffset to, AppDbContext db, HttpContext c) =>
        {
            var p = await Point(db, c, id); Require(from < to && to <= DateTimeOffset.UtcNow.AddMinutes(5), "Gültigen Bilanzzeitraum wählen.");
            from = from.ToUniversalTime(); to = to.ToUniversalTime(); var sites = await Sites(db, c, p.CustomerId);
            var assignments = await db.Assignments.Where(x => x.CustomerId == p.CustomerId && x.ValidFrom <= from && (x.ValidTo == null || x.ValidTo >= to)).ToListAsync();
            var children = assignments.Where(x => x.ParentPointId == id).ToList();
            var inaccessible = children.Any(x => !sites.Contains(x.SiteId));
            var rows = new List<object>(); decimal sum = 0; bool complete = !inaccessible && assignments.Any(x => x.PointId == id && sites.Contains(x.SiteId));
            // Jede während des Zeitraums wechselnde Zuordnung verhindert eine scheinbar exakte Bilanz.
            complete &= !await db.Assignments.AnyAsync(x => x.CustomerId == p.CustomerId && (x.ParentPointId == id || x.PointId == id) && x.ValidFrom > from && x.ValidFrom < to);
            foreach (var a in children.Where(x => sites.Contains(x.SiteId)))
            {
                var child = await db.Points.SingleAsync(x => x.Id == a.PointId); var value = await Consumption(db, child.Id, from, to);
                if (value == null || child.Unit != p.Unit || child.Medium != p.Medium || child.Direction != p.Direction) complete = false;
                sum += value ?? 0; rows.Add(new { pointId = child.Id, child.Name, consumption = value, child.Unit });
            }
            var total = complete ? await Consumption(db, id, from, to) : null; complete &= total.HasValue;
            return Results.Ok(new { from, to, p.Unit, status = complete ? "Vollständig" : "Unvollständig", consumption = total, children = rows, submeterTotal = complete ? sum : (decimal?)null,
                unassignedConsumption = complete ? total - sum : null, warning = complete && total < sum ? "Unterzählerverbrauch übersteigt den Hauptzählerverbrauch; Messkonzept prüfen." : complete ? "" : "Exakte Randablesungen, passende Einheiten und unveränderte Zuordnungen aller Messstellen sind erforderlich." });
        });
    }
    static void Validate(PointInput i)
    {
        Require(!string.IsNullOrWhiteSpace(i.Number) && !string.IsNullOrWhiteSpace(i.Name) && i.Medium != null && Media.TryGetValue(i.Medium, out var units) && units.Contains(i.Unit), "Nummer, Bezeichnung und eine zum Medium passende Einheit sind erforderlich.");
        Require(i.Direction is "Import" or "Export" && i.ReadingIntervalDays is >= 1 and <= 3660 && i.MaxDailyConsumption is not <= 0 && i.Notes != null && i.Notes.Length <= 4000 && i.Supplier != null && i.Supplier.Length <= 200 && i.TariffReference != null && i.TariffReference.Length <= 200 && i.Quantity != null && i.Quantity.Length <= 80, "Ungültige Messstellenkonfiguration.");
        Require(i.MaxDailyConsumption == null || i.MaxDailyConsumption <= 1000000000000000m && decimal.Round(i.MaxDailyConsumption.Value, 6) == i.MaxDailyConsumption, "Tagesgrenze ist zu groß oder enthält mehr als sechs Nachkommastellen.");
    }
    static void Apply(MeasuringPoint p, PointInput i)
    { p.Number = i.Number.Trim().ToUpperInvariant(); p.Name = i.Name.Trim(); p.Medium = i.Medium; p.Unit = i.Unit; p.Quantity = i.Quantity; p.Direction = i.Direction; p.ReadingIntervalDays = i.ReadingIntervalDays; p.MaxDailyConsumption = i.MaxDailyConsumption; p.Supplier = i.Supplier; p.TariffReference = i.TariffReference; p.Notes = i.Notes; p.IsActive = i.IsActive; }
    static async Task CheckParent(AppDbContext db, MeasuringPoint p, Guid? parentId)
    {
        if (parentId == null) return;
        var parent = await db.Points.SingleAsync(x => x.Id == parentId);
        Require(parent.Medium == p.Medium && parent.Unit == p.Unit && parent.Direction == p.Direction, "Haupt- und Unterzähler benötigen dasselbe Medium, dieselbe Einheit und Messrichtung.");
    }
}
