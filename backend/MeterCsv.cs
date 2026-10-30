using System.Globalization;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;

namespace Energy;

public static class MeterCsv
{
    static string Quote(string value) => "\"" + value.Replace("\"", "\"\"") + "\"";
    public static byte[] Export(byte[] workbook)
    {
        using var wb = new XLWorkbook(new MemoryStream(workbook)); var sheet = wb.Worksheet("Ablesungen");
        var result = new StringBuilder("#sysDATIQ;1\r\n#Zuordnung;").Append(Quote(wb.Worksheet("Zuordnung").Cell("A1").GetString())).Append("\r\n");
        foreach (var item in new[] { ("#Messstelle", "B5"), ("#Geraet", "B6"), ("#Einheit", "B7"), ("#Zeitzone", "B8") }) result.Append(item.Item1).Append(';').Append(Quote(sheet.Cell(item.Item2).GetString())).Append("\r\n");
        result.Append("Datum;Zählerstand\r\n");
        for (var i = MeterExcel.FirstRow; i <= MeterExcel.LastRow; i++) result.Append(";\r\n");
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(result.ToString())).ToArray();
    }
    static string Normalize(string value) => new string(value.Trim().ToLowerInvariant().Select(ch => ch switch { 'ä' => 'a', 'ö' => 'o', 'ü' => 'u', 'ß' => 's', _ => ch }).Where(char.IsLetterOrDigit).ToArray());
    static string Decode(byte[] bytes)
    {
        if (bytes.AsSpan().StartsWith(new byte[] { 0xff, 0xfe })) return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
        if (bytes.AsSpan().StartsWith(new byte[] { 0xfe, 0xff })) return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
        try { return new UTF8Encoding(false, true).GetString(bytes).TrimStart('\ufeff'); }
        catch (DecoderFallbackException) { return Encoding.Latin1.GetString(bytes); }
    }
    static List<string[]> Parse(byte[] bytes)
    {
        var text = Decode(bytes); var first = text.Split('\n', 2)[0];
        char delimiter = new[] { ';', '\t', ',' }.OrderByDescending(ch => first.Count(c => c == ch)).First();
        var rows = new List<string[]>(); var row = new List<string>(); var cell = new StringBuilder(); bool quoted = false;
        void Cell() { Require(cell.Length <= 8000 && row.Count < 20, "CSV-Feld oder Spaltenzahl ist zu groß."); row.Add(cell.ToString()); cell.Clear(); }
        void Row() { Cell(); rows.Add(row.ToArray()); row.Clear(); Require(rows.Count <= 6000, "Zu viele CSV-Zeilen."); }
        for (var i = 0; i < text.Length; i++) {
            var ch = text[i];
            if (quoted) { if (ch == '"') { if (i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; } else quoted = false; } else cell.Append(ch); }
            else if (ch == '"' && cell.Length == 0) quoted = true;
            else if (ch == delimiter) Cell();
            else if (ch is '\r' or '\n') { if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++; Row(); }
            else cell.Append(ch);
            Require(cell.Length <= 8000, "CSV-Feld ist zu groß.");
        }
        Require(!quoted, "CSV enthält ein nicht geschlossenes Anführungszeichen.");
        if (cell.Length > 0 || row.Count > 0) Row(); return rows;
    }
    public static async Task Add(ExcelFile file, Guid customerId, Guid? csvPointId, AppDbContext db, HttpContext c, IDataProtectionProvider dp, HashSet<Guid> sites, ExcelPlan plan)
    {
        var rows = Parse(file.Bytes); Require(rows.Count > 0, "CSV enthält keine Daten.");
        ExcelBinding? binding = null;
        var tokenRows = rows.Where(r => r[0] == "#Zuordnung").ToList();
        Require(tokenRows.Count <= 1, "CSV enthält mehrere Vorlagenkennungen.");
        if (tokenRows.Count == 1) {
            var token = tokenRows[0]; Require(token.Length == 2, "CSV-Vorlagenkennung ist ungültig.");
            binding = JsonSerializer.Deserialize<ExcelBinding>(MeterExcel.Binding(dp).Unprotect(token[1]));
            Require(binding != null && binding.Schema == 1 && binding.CustomerId == customerId, "CSV-Vorlage gehört nicht zum gewählten Kunden.");
            foreach (var item in new[] { ("#Messstelle", "B5"), ("#Geraet", "B6"), ("#Einheit", "B7"), ("#Zeitzone", "B8") }) {
                var fixedRows = rows.Where(r => r[0] == item.Item1).ToList();
                Require(fixedRows.Count == 1 && fixedRows[0].Length == 2 && fixedRows[0][1] == binding!.Fixed[item.Item2], "Ein festes CSV-Vorlagenfeld wurde verändert.");
            }
        }
        var headerIndex = rows.FindIndex(r => r.Any(x => new[] { "datum", "datumuhrzeit", "zeitstempel", "timestamp", "date" }.Contains(Normalize(x))) && r.Any(x => Normalize(x).StartsWith("zahlerstand") || new[] { "stand", "wert", "value", "reading" }.Contains(Normalize(x))));
        Require(headerIndex is >= 0 and <= 20, "CSV-Kopfzeile mit Datum und Zählerstand nicht gefunden.");
        var headers = rows[headerIndex].Select(Normalize).ToArray();
        var dateCol = Array.FindIndex(headers, x => new[] { "datum", "datumuhrzeit", "zeitstempel", "timestamp", "date" }.Contains(x));
        var valueCol = Array.FindIndex(headers, x => x.StartsWith("zahlerstand") || new[] { "stand", "wert", "value", "reading" }.Contains(x));
        var idCol = Array.FindIndex(headers, x => new[] { "idmessstelle", "messstellenid", "messstellennummer", "pointid" }.Contains(x));
        var timeCol = Array.FindIndex(headers, x => x is "uhrzeit" or "time");
        var unitCol = Array.FindIndex(headers, x => x is "einheit" or "unit");
        string? templateId = null; string? templateDevice = null;
        if (binding == null) {
            templateId = rows.Take(headerIndex).FirstOrDefault(r => r.Length >= 2 && new[] { "messstelle", "idmessstelle" }.Contains(Normalize(r[0])))?.ElementAt(1).Split(" · ")[0].Trim();
            templateDevice = rows.Take(headerIndex).FirstOrDefault(r => r.Length >= 2 && new[] { "zahlergerat" }.Contains(Normalize(r[0])))?.ElementAt(1).Trim();
        }
        using var parser = new XLWorkbook(); var cells = parser.AddWorksheet("Parser");
        for (var index = headerIndex + 1; index < rows.Count; index++) {
            if (rows[index].All(string.IsNullOrWhiteSpace)) continue;
            Require(plan.Rows.Count < MeterExcel.MaxRows, "Maximal 5.000 Ablesezeilen pro Import verwenden.");
            var item = new ExcelRow { File = file.Name, Row = index + 1 }; plan.Rows.Add(item);
            try {
                var fields = rows[index]; Require(fields.Length == headers.Length, "CSV-Zeile hat eine andere Spaltenzahl als die Kopfzeile. Dezimalkommas bei Komma-Trennzeichen in Anführungszeichen setzen.");
                Require(fields.Length > Math.Max(dateCol, valueCol) && !string.IsNullOrWhiteSpace(fields[dateCol]) && !string.IsNullOrWhiteSpace(fields[valueCol]), "Datum und Zählerstand müssen ausgefüllt sein.");
                Guid pointId;
                if (binding != null) pointId = binding.PointId;
                else if (idCol >= 0 && fields.Length > idCol && !string.IsNullOrWhiteSpace(fields[idCol]) || !string.IsNullOrWhiteSpace(templateId)) {
                    var code = (idCol >= 0 && fields.Length > idCol && !string.IsNullOrWhiteSpace(fields[idCol]) ? fields[idCol] : templateId)!.Trim().ToUpperInvariant();
                    var match = await db.Points.SingleOrDefaultAsync(x => x.CustomerId == customerId && x.Number == code);
                    Require(match != null, "ID Messstelle dieses Kunden nicht gefunden.", 404); pointId = match!.Id;
                } else { Require(csvPointId.HasValue, "CSV ohne ID Messstelle: im Importdialog die Messstelle auswählen."); pointId = csvPointId!.Value; }
                Require(!csvPointId.HasValue || pointId == csvPointId.Value, "CSV-Zuordnung und gewählte Messstelle stimmen nicht überein.");
                var p = await MeterService.Point(db, c, pointId); Require(p.CustomerId == customerId && p.IsActive, "Aktive Messstelle dieses Kunden nicht gefunden.", 404);
                if (unitCol >= 0 && !string.IsNullOrWhiteSpace(fields[unitCol])) Require(fields[unitCol].Trim() == p.Unit, "CSV-Einheit stimmt nicht mit der Messstelle überein.");
                item.PointId = p.Id; item.Point = p.Name; plan.Versions[p.Id] = p.Version;
                var assignment = await db.Assignments.SingleAsync(x => x.PointId == p.Id && x.ValidTo == null);
                var zone = binding?.TimeZone ?? await db.Nodes.Where(x => x.Id == assignment.SiteId).Select(x => x.TimeZone).SingleAsync();
                cells.Cell("A1").Value = fields[dateCol] + (timeCol >= 0 && !string.IsNullOrWhiteSpace(fields[timeCol]) ? " " + fields[timeCol] : ""); cells.Cell("B1").Value = fields[valueCol];
                var at = MeterExcel.Date(cells.Cell("A1"), zone); var value = MeterExcel.Value(cells.Cell("B1")); item.At = at; item.Value = value;
                var installation = binding != null ? await db.Installations.SingleOrDefaultAsync(x => x.Id == binding.InstallationId && x.PointId == p.Id) : await db.Installations.SingleOrDefaultAsync(x => x.PointId == p.Id && x.ValidFrom <= at && (x.ValidTo == null || at < x.ValidTo));
                Require(installation != null && (binding == null || p.Unit == binding.Unit) && at >= installation.ValidFrom && (installation.ValidTo == null || at < installation.ValidTo), "Datum passt nicht zur Geräteperiode dieser Vorlage.");
                if (templateDevice != null) Require(await db.Devices.AnyAsync(x => x.Id == installation!.DeviceId && x.Number == templateDevice), "CSV gehört zu einem anderen Zählergerät.");
                Require(await db.Assignments.AnyAsync(x => x.PointId == p.Id && sites.Contains(x.SiteId) && x.ValidFrom <= at && (x.ValidTo == null || at < x.ValidTo)), "Keine Standortfreigabe für diesen Zeitpunkt.", 403);
                plan.Candidates.Add(new ExcelCandidate(item, p, installation!, MeterService.Reading(p.Id, installation!.Id, new ReadingInput(at, value, Comment: "CSV-Import"), c.UserId())));
            } catch (Exception ex) when (ex is TechnicalFault or FormatException or ArgumentException or OverflowException) { item.Status = "Fehler"; item.Message = ex is TechnicalFault ? ex.Message : "CSV-Datum oder Zählerstand ist ungültig."; }
        }
    }
}
