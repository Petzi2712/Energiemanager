using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using ClosedXML.Excel;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public record ExcelExportInput(Guid CustomerId, Guid[] PointIds);
public record ExcelBinding(int Schema, Guid CustomerId, Guid PointId, Guid InstallationId, string Unit, string TimeZone, Dictionary<string, string> Fixed);
public record ExcelPreview(string Hash, Guid UserId, Guid CustomerId, Dictionary<Guid, int> Versions, DateTimeOffset Expires);
public record ExcelFile(string Name, byte[] Bytes);
public class ExcelRow
{
    public string File { get; set; } = "";
    public int Row { get; set; }
    public Guid? PointId { get; set; }
    public string Point { get; set; } = "";
    public DateTimeOffset? At { get; set; }
    public decimal? Value { get; set; }
    public string Status { get; set; } = "Neu";
    public string Message { get; set; } = "";
}
public record ExcelCandidate(ExcelRow Row, MeasuringPoint Point, MeterInstallation Installation, MeterReading Reading);
public class ExcelPlan
{
    public List<ExcelRow> Rows { get; } = [];
    public List<ExcelCandidate> Candidates { get; } = [];
    public Dictionary<Guid, int> Versions { get; } = [];
}

public static class MeterExcel
{
    public const int FirstRow = 15, LastRow = 514, MaxRows = 5000;
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public static string FileName(MeasuringPoint p) => $"Zaehler-{new string(p.Number.Select(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-').Take(45).ToArray())}-{p.Id.ToString()[..8]}.xlsx";
    static IDataProtector Binding(IDataProtectionProvider dp) => dp.CreateProtector("sysDATIQ.MeterExcel.Template.v1");
    public static IDataProtector Preview(IDataProtectionProvider dp) => dp.CreateProtector("sysDATIQ.MeterExcel.Preview.v1");
    public static string Hash(List<ExcelFile> files) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('|', files.Select(f => Convert.ToHexString(SHA256.HashData(f.Bytes)))))));

    public static async Task<byte[]> Export(Guid id, AppDbContext db, HttpContext c, IDataProtectionProvider dp)
    {
        var p = await MeterService.Point(db, c, id);
        var assignment = await db.Assignments.SingleAsync(x => x.PointId == id && x.ValidTo == null);
        var site = await db.Nodes.SingleAsync(x => x.Id == assignment.SiteId);
        var customer = await db.Customers.SingleAsync(x => x.Id == p.CustomerId);
        var installation = await db.Installations.SingleAsync(x => x.PointId == id && x.ValidTo == null);
        var device = await db.Devices.SingleAsync(x => x.Id == installation.DeviceId);
        var fixedCells = new Dictionary<string, string> {
            ["A1"] = "sysDATIQ · Zählerablesungen", ["A3"] = "Kunde", ["B3"] = customer.Name,
            ["A4"] = "Standort", ["B4"] = site.Name, ["A5"] = "Messstelle", ["B5"] = p.Number + " · " + p.Name,
            ["A6"] = "Zählergerät", ["B6"] = device.Number, ["A7"] = "Einheit / Faktor", ["B7"] = p.Unit + " / " + installation.Factor.ToString(CultureInfo.InvariantCulture),
            ["A8"] = "Zeitzone", ["B8"] = site.TimeZone, ["A9"] = "Geräteperiode ab", ["B9"] = TimeZoneInfo.ConvertTime(installation.ValidFrom, TimeZoneInfo.FindSystemTimeZoneById(site.TimeZone)).ToString("dd.MM.yyyy HH:mm:ss", CultureInfo.InvariantCulture),
            ["A10"] = "Nur die gelben Datums- und Zählerstandsfelder ausfüllen. Bis zu 500 Ablesungen je Datei.",
            ["A11"] = "Datum: TT.MM.JJJJ hh:mm:ss (Standortzeit). Zahlen als Excel-Zahl. Keine Formeln.",
            ["A12"] = "Bei doppelter Winterzeit: Datum als ISO-Text mit Offset eingeben, z. B. 2026-10-25T02:30:00+02:00.",
            ["A14"] = "Datum / Uhrzeit", ["B14"] = "Zählerstand (" + p.Unit + ")"
        };
        var binding = new ExcelBinding(1, p.CustomerId, p.Id, installation.Id, p.Unit, site.TimeZone, fixedCells);
        using var wb = new XLWorkbook(); var sheet = wb.AddWorksheet("Ablesungen");
        sheet.Style.Font.FontName = "Calibri"; sheet.Style.Font.FontSize = 11; sheet.Style.Protection.Locked = true;
        foreach (var cell in fixedCells) sheet.Cell(cell.Key).Value = cell.Value;
        sheet.Range("A1:B1").Merge().Style.Font.SetBold().Font.SetFontSize(18);
        sheet.Range("A1:B1").Style.Fill.BackgroundColor = XLColor.FromHtml("#34383D"); sheet.Range("A1:B1").Style.Font.FontColor = XLColor.White;
        sheet.Row(1).Height = 32; sheet.Column(1).Width = 28; sheet.Column(2).Width = 75;
        sheet.Range("A3:A9").Style.Font.Bold = true;
        foreach (var row in new[] { 10, 11, 12 }) { sheet.Range($"A{row}:B{row}").Merge(); sheet.Row(row).Height = 32; sheet.Row(row).Style.Alignment.WrapText = true; }
        sheet.Range("A14:B14").Style.Fill.BackgroundColor = XLColor.FromHtml("#34383D"); sheet.Range("A14:B14").Style.Font.FontColor = XLColor.White;
        var inputs = sheet.Range($"A{FirstRow}:B{LastRow}"); inputs.Style.Protection.Locked = false; inputs.Style.Fill.BackgroundColor = XLColor.FromHtml("#FFF2CC");
        sheet.Range($"A{FirstRow}:A{LastRow}").Style.NumberFormat.Format = "dd.mm.yyyy hh:mm:ss";
        sheet.Range($"B{FirstRow}:B{LastRow}").Style.NumberFormat.Format = "0.######";
        sheet.SheetView.FreezeRows(14); sheet.PageSetup.PagesWide = 1;
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        sheet.Protect(password, XLProtectionAlgorithm.Algorithm.SHA512, XLSheetProtectionElements.SelectUnlockedCells);
        var meta = wb.AddWorksheet("Zuordnung"); meta.Cell("A1").Value = Binding(dp).Protect(JsonSerializer.Serialize(binding));
        meta.Visibility = XLWorksheetVisibility.VeryHidden; meta.Protect(password, XLProtectionAlgorithm.Algorithm.SHA512);
        wb.Protect(password, XLProtectionAlgorithm.Algorithm.SHA512);
        using var output = new MemoryStream(); wb.SaveAs(output); return output.ToArray();
    }

    static void CheckArchive(byte[] bytes)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        Require(zip.Entries.Count <= 300 && zip.Entries.Sum(x => x.Length) <= 32 * 1024 * 1024 && zip.Entries.Select(x => x.FullName).Distinct(StringComparer.OrdinalIgnoreCase).Count() == zip.Entries.Count, "Excel-Datei ist zu groß oder ungültig.");
        Require(zip.GetEntry("xl/workbook.xml") != null && zip.Entries.All(x => !x.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase) && !x.FullName.Contains("externalLinks", StringComparison.OrdinalIgnoreCase)), "Nur die heruntergeladene XLSX-Vorlage ohne Makros oder externe Verknüpfungen verwenden.");
        var sheets = zip.Entries.Where(x => x.FullName.StartsWith("xl/worksheets/") && x.FullName.EndsWith(".xml")).ToList();
        Require(sheets.Count == 2, "Die Vorlage muss ihre zwei ursprünglichen Arbeitsblätter behalten.");
        foreach (var entry in sheets) {
            using var stream = entry.Open(); using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
            var cells = 0; var rows = 0;
            while (reader.Read()) if (reader.NodeType == XmlNodeType.Element) {
                if (reader.LocalName == "c") Require(++cells <= 1200, "Zu viele Zellen in der Excel-Vorlage.");
                if (reader.LocalName == "row") Require(++rows <= 520, "Zu viele Zeilen in der Excel-Vorlage.");
            }
        }
        foreach (var entry in zip.Entries.Where(x => x.FullName.EndsWith(".rels", StringComparison.OrdinalIgnoreCase))) {
            using var stream = entry.Open(); using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
            Require(!XDocument.Load(reader).Descendants().Any(x => x.Attribute("TargetMode")?.Value == "External"), "Externe Verknüpfungen sind nicht erlaubt.");
        }
        using var workbookStream = zip.GetEntry("xl/workbook.xml")!.Open();
        using var workbookReader = XmlReader.Create(workbookStream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
        Require(!XDocument.Load(workbookReader).Descendants().Any(x => x.Name.LocalName == "workbookPr" && x.Attribute("date1904")?.Value is "1" or "true"), "Das Datumssystem der Vorlage darf nicht geändert werden.");
    }
    public static async Task<List<ExcelFile>> ReadFiles(HttpContext c, IFormCollection form)
    {
        Require(form.Files.Count is > 0 and <= 100, "1 bis 100 XLSX-Dateien oder ein ZIP auswählen.");
        var files = new List<ExcelFile>(); long expanded = 0;
        foreach (var file in form.Files) {
            Require(file.Length is > 0 and <= 6 * 1024 * 1024, "Datei ist leer oder größer als 6 MB.");
            using var buffer = new MemoryStream(); await file.CopyToAsync(buffer); var bytes = buffer.ToArray();
            if (Path.GetExtension(file.FileName).Equals(".zip", StringComparison.OrdinalIgnoreCase)) {
                using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
                foreach (var entry in zip.Entries.Where(x => !x.FullName.EndsWith('/'))) {
                    expanded += entry.Length;
                    Require(files.Count < 100 && entry.Length <= 6 * 1024 * 1024 && expanded <= 20 * 1024 * 1024 && entry.FullName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase), "ZIP darf nur bis zu 100 XLSX-Vorlagen enthalten (zusammen maximal 20 MB entpackt).");
                    using var data = new MemoryStream(); using var source = entry.Open(); await source.CopyToAsync(data);
                    files.Add(new ExcelFile(Path.GetFileName(entry.FullName), data.ToArray()));
                }
            } else { Require(file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase), "Nur XLSX-Vorlagen oder ZIP-Dateien verwenden."); files.Add(new ExcelFile(Path.GetFileName(file.FileName), bytes)); }
        }
        Require(files.Count is > 0 and <= 100, "1 bis 100 XLSX-Vorlagen auswählen."); return files;
    }
    static string CellText(IXLCell cell) { Require(!cell.HasFormula, "Formeln sind nicht erlaubt."); return cell.GetString(); }
    static DateTimeOffset Date(IXLCell cell, string zoneId)
    {
        Require(!cell.HasFormula, "Formeln sind nicht erlaubt.");
        DateTime date;
        if (cell.DataType == XLDataType.DateTime) date = cell.GetDateTime();
        else if (cell.DataType == XLDataType.Number) date = DateTime.FromOADate(cell.GetDouble());
        else {
            var text = cell.GetString().Trim();
            if (DateTimeOffset.TryParseExact(text, ["yyyy-MM-dd'T'HH:mm:sszzz", "yyyy-MM-dd'T'HH:mmzzz", "yyyy-MM-dd'T'HH:mm:ss'Z'"], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var offset)) return offset.ToUniversalTime();
            Require(DateTime.TryParseExact(text, ["dd.MM.yyyy HH:mm:ss", "dd.MM.yyyy HH:mm", "dd.MM.yyyy", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "yyyy-MM-dd"], CultureInfo.InvariantCulture, DateTimeStyles.None, out date), "Datum als Excel-Datum oder TT.MM.JJJJ hh:mm:ss angeben.");
        }
        date = new DateTime((date.Ticks + TimeSpan.TicksPerSecond / 2) / TimeSpan.TicksPerSecond * TimeSpan.TicksPerSecond, DateTimeKind.Unspecified); var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        Require(!zone.IsInvalidTime(date), "Diese Ortszeit existiert wegen der Zeitumstellung nicht.");
        Require(!zone.IsAmbiguousTime(date), "Doppelte Winterzeit: Datum als ISO-Text mit eindeutigem UTC-Offset angeben.");
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(date, zone));
    }
    static decimal Value(IXLCell cell)
    {
        Require(!cell.HasFormula, "Formeln sind nicht erlaubt.");
        if (cell.DataType == XLDataType.Number) return Convert.ToDecimal(cell.GetDouble());
        var text = cell.GetString().Trim();
        Require(decimal.TryParse(text, NumberStyles.Number, text.Contains(',') ? CultureInfo.GetCultureInfo("de-DE") : CultureInfo.InvariantCulture, out var value), "Zählerstand als Zahl eingeben.");
        return value;
    }

    public static async Task<ExcelPlan> Plan(List<ExcelFile> files, Guid customerId, AppDbContext db, HttpContext c, IDataProtectionProvider dp)
    {
        var sites = await Sites(db, c, customerId); var plan = new ExcelPlan();
        foreach (var file in files) {
            try {
                CheckArchive(file.Bytes); using var wb = new XLWorkbook(new MemoryStream(file.Bytes));
                Require(wb.Worksheets.Count == 2 && wb.Worksheets.TryGetWorksheet("Ablesungen", out var sheet) && wb.Worksheets.TryGetWorksheet("Zuordnung", out _), "Die ursprünglichen Arbeitsblätter müssen erhalten bleiben.");
                sheet = wb.Worksheet("Ablesungen"); var meta = wb.Worksheet("Zuordnung");
                Require(meta.CellsUsed().Count() == 1 && !meta.Cell("A1").HasFormula, "Vorlagenzuordnung wurde verändert.");
                var binding = JsonSerializer.Deserialize<ExcelBinding>(Binding(dp).Unprotect(meta.Cell("A1").GetString()))!;
                Require(binding.Schema == 1 && binding.CustomerId == customerId, "Vorlage gehört nicht zum gewählten Kunden oder hat ein unbekanntes Format.");
                foreach (var fixedCell in binding.Fixed) Require(CellText(sheet.Cell(fixedCell.Key)) == fixedCell.Value, "Ein geschütztes Feld wurde verändert. Neue Vorlage herunterladen.");
                foreach (var cell in sheet.CellsUsed(XLCellsUsedOptions.Contents)) {
                    var address = $"{cell.Address.ColumnLetter}{cell.Address.RowNumber}";
                    Require(!cell.HasFormula && (binding.Fixed.ContainsKey(address) || cell.Address.ColumnNumber <= 2 && cell.Address.RowNumber is >= FirstRow and <= LastRow), "Nur Datum und Zählerstand in den gelben Eingabezeilen dürfen bearbeitet werden.");
                }
                var p = await MeterService.Point(db, c, binding.PointId); Require(p.IsActive, "Messstelle ist deaktiviert.");
                var installation = await db.Installations.SingleOrDefaultAsync(x => x.Id == binding.InstallationId && x.PointId == p.Id);
                Require(installation != null && p.Unit == binding.Unit, "Gerätezuordnung oder Einheit der Vorlage ist nicht mehr gültig.");
                plan.Versions[p.Id] = p.Version;
                for (var row = FirstRow; row <= LastRow; row++) {
                    var a = sheet.Cell(row, 1); var b = sheet.Cell(row, 2);
                    if (a.IsEmpty() && b.IsEmpty()) continue;
                    Require(plan.Rows.Count < MaxRows, "Maximal 5.000 Ablesezeilen pro Import verwenden.");
                    var item = new ExcelRow { File = file.Name, Row = row, PointId = p.Id, Point = p.Name }; plan.Rows.Add(item);
                    try {
                        Require(!a.IsEmpty() && !b.IsEmpty(), "Datum und Zählerstand müssen gemeinsam ausgefüllt sein.");
                        var at = Date(a, binding.TimeZone); var value = Value(b); item.At = at; item.Value = value;
                        Require(at >= installation!.ValidFrom && (installation.ValidTo == null || at < installation.ValidTo), "Ablesung liegt außerhalb der Geräteperiode dieser Vorlage. Zählertausch separat erfassen.");
                        Require(await db.Assignments.AnyAsync(x => x.PointId == p.Id && sites.Contains(x.SiteId) && x.ValidFrom <= at && (x.ValidTo == null || at < x.ValidTo)), "Keine Standortfreigabe für diesen Zeitpunkt.", 403);
                        var reading = MeterService.Reading(p.Id, installation.Id, new ReadingInput(at, value, Comment: "Excel-Import"), c.UserId());
                        plan.Candidates.Add(new ExcelCandidate(item, p, installation, reading));
                    } catch (Exception ex) when (ex is TechnicalFault or FormatException or ArgumentException or OverflowException) { item.Status = "Fehler"; item.Message = ex is TechnicalFault ? ex.Message : "Datum oder Zahl ist ungültig."; }
                }
            } catch (Exception ex) when (ex is not OutOfMemoryException) {
                plan.Rows.Add(new ExcelRow { File = file.Name, Status = "Fehler", Message = ex is TechnicalFault ? ex.Message : "Excel-Datei ist beschädigt oder die geschützte Zählerzuordnung ist ungültig. Neue Vorlage herunterladen." });
            }
        }
        var installationIds = plan.Candidates.Select(x => x.Installation.Id).Distinct().ToList();
        var existing = await db.Readings.Where(x => installationIds.Contains(x.InstallationId)).ToListAsync();
        var seen = existing.ToDictionary(x => (x.InstallationId, x.At));
        var unique = new List<ExcelCandidate>();
        foreach (var candidate in plan.Candidates) {
            var key = (candidate.Installation.Id, candidate.Reading.At);
            if (seen.TryGetValue(key, out var other)) { candidate.Row.Status = other.Value == candidate.Reading.Value ? "Übersprungen" : "Fehler"; candidate.Row.Message = other.Value == candidate.Reading.Value ? "Identischer Stand bereits vorhanden oder mehrfach in diesem Import." : "Zu diesem Zeitpunkt existiert ein anderer Stand. Korrektur separat durchführen."; }
            else { seen.Add(key, candidate.Reading); unique.Add(candidate); }
        }
        foreach (var candidate in unique) {
            try {
                var status = await MeterService.ValidateReading(db, candidate.Point, candidate.Installation, new ReadingInput(candidate.Reading.At, candidate.Reading.Value, Comment: "Excel-Import", ConfirmWarning: true, Reason: "Prüfung in der Importvorschau"), candidate.Reading.Id, seen.Values.ToList());
                candidate.Reading.Status = status;
                if (status == "Auffällig") { candidate.Row.Status = "Warnung"; candidate.Row.Message = "Die ausdrücklich konfigurierte Tagesgrenze ist überschritten. Bestätigung mit Begründung erforderlich."; }
            } catch (TechnicalFault ex) { candidate.Row.Status = "Fehler"; candidate.Row.Message = ex.Message; }
        }
        plan.Candidates.Clear(); plan.Candidates.AddRange(unique.Where(x => x.Row.Status is "Neu" or "Warnung"));
        return plan;
    }
}

public static class MeterExcelEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/meters/{id:guid}/excel", async (Guid id, AppDbContext db, HttpContext c, IDataProtectionProvider dp) => {
            var bytes = await MeterExcel.Export(id, db, c, dp); var p = await MeterService.Point(db, c, id);
            Security.Audit(db, c, "Excel.VorlageExportiert", id.ToString(), p.CustomerId); await db.SaveChangesAsync();
            return Results.File(bytes, MeterExcel.ContentType, MeterExcel.FileName(p));
        }).RequireAuthorization();
        api.MapPost("/meter-excel/export", async (ExcelExportInput input, AppDbContext db, HttpContext c, IDataProtectionProvider dp) => {
            await Sites(db, c, input.CustomerId); Require(input.PointIds != null && input.PointIds.Length is > 0 and <= 100, "1 bis 100 Messstellen auswählen.");
            using var result = new MemoryStream();
            using (var zip = new ZipArchive(result, ZipArchiveMode.Create, true)) {
                foreach (var id in input.PointIds!.Distinct()) {
                    var p = await MeterService.Point(db, c, id); Require(p.CustomerId == input.CustomerId, "Messstelle gehört nicht zum gewählten Kunden.", 404);
                    var bytes = await MeterExcel.Export(id, db, c, dp); var entry = zip.CreateEntry(MeterExcel.FileName(p));
                    using var stream = entry.Open(); await stream.WriteAsync(bytes);
                }
            }
            Security.Audit(db, c, "Excel.VorlagenExportiert", "Massendownload", input.CustomerId, JsonSerializer.Serialize(new { input.PointIds })); await db.SaveChangesAsync();
            return Results.File(result.ToArray(), "application/zip", "Zaehler-Vorlagen.zip");
        }).RequireAuthorization();
        foreach (var commit in new[] { false, true }) {
            api.MapPost(commit ? "/meter-excel/import" : "/meter-excel/preview", async (Guid customerId, HttpContext c, AppDbContext db, IDataProtectionProvider dp) => {
                Writer(c); await Sites(db, c, customerId);
                Require(c.Request.ContentLength is > 0 and <= 7 * 1024 * 1024 && c.Request.HasFormContentType, "XLSX-/ZIP-Dateien als Formular hochladen (zusammen maximal 6 MB).");
                var form = await c.Request.ReadFormAsync(); Require(form.Files.Sum(x => x.Length) <= 6 * 1024 * 1024, "Dateien dürfen zusammen maximal 6 MB groß sein.");
                List<ExcelFile> files;
                try { files = await MeterExcel.ReadFiles(c, form); } catch (InvalidDataException) { throw new TechnicalFault(400, "ZIP-Datei ist beschädigt."); }
                await using var tx = commit ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable) : null;
                var plan = await MeterExcel.Plan(files, customerId, db, c, dp);
                var errors = plan.Rows.Count(x => x.Status == "Fehler"); var warnings = plan.Rows.Count(x => x.Status == "Warnung");
                if (!commit) {
                    var token = MeterExcel.Preview(dp).Protect(JsonSerializer.Serialize(new ExcelPreview(MeterExcel.Hash(files), c.UserId(), customerId, plan.Versions, DateTimeOffset.UtcNow.AddMinutes(30))));
                    return Results.Ok(new { rows = plan.Rows, errors, warnings, ready = plan.Candidates.Count, skipped = plan.Rows.Count(x => x.Status == "Übersprungen"), token });
                }
                ExcelPreview preview;
                try { preview = JsonSerializer.Deserialize<ExcelPreview>(MeterExcel.Preview(dp).Unprotect(form["previewToken"].ToString()))!; }
                catch (Exception ex) when (ex is CryptographicException or JsonException or ArgumentException) { throw new TechnicalFault(409, "Zuerst eine gültige Importvorschau erstellen."); }
                Require(preview.UserId == c.UserId() && preview.CustomerId == customerId && preview.Hash == MeterExcel.Hash(files) && preview.Expires > DateTimeOffset.UtcNow && preview.Versions.Count == plan.Versions.Count && preview.Versions.All(x => plan.Versions.TryGetValue(x.Key, out var version) && version == x.Value), "Dateien oder Messdaten wurden geändert. Vorschau erneut erstellen.", 409);
                Require(errors == 0, "Import enthält Fehler. Es wurde nichts gespeichert. Dateien korrigieren und erneut prüfen.", 422);
                var reason = form["reason"].ToString();
                Require(warnings == 0 || form["confirmWarnings"] == "true" && reason.Trim().Length is >= 5 and <= 1000, "Konfigurierte Grenzwertüberschreitungen mit Begründung bestätigen.", 422);
                foreach (var candidate in plan.Candidates) {
                    if (candidate.Row.Status == "Warnung") candidate.Reading.Reason = reason;
                    db.Readings.Add(candidate.Reading);
                    Security.Audit(db, c, "Ablesung.ExcelImportiert", candidate.Reading.Id.ToString(), customerId, JsonSerializer.Serialize(new { candidate.Row.File, candidate.Row.Row, reading = candidate.Reading }));
                }
                foreach (var point in plan.Candidates.Select(x => x.Point).DistinctBy(x => x.Id)) point.Version++;
                Security.Audit(db, c, "Excel.Importiert", "Stapelimport", customerId, JsonSerializer.Serialize(new { count = plan.Candidates.Count, files = files.Count, warnings }));
                await db.SaveChangesAsync(); await tx!.CommitAsync();
                return Results.Ok(new { imported = plan.Candidates.Count, skipped = plan.Rows.Count(x => x.Status == "Übersprungen") });
            }).RequireAuthorization();
        }
    }
}
