using System.Globalization;
using ClosedXML.Excel;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
namespace Energy;

// Eingebettete Schrift: identische Unicode-Ausgabe unter Linux, Windows und Docker.
public sealed class ReportFontResolver : IFontResolver
{
    public FontResolverInfo ResolveTypeface(string familyName, bool bold, bool italic) => new("DejaVuSans");
    public byte[] GetFont(string faceName) => File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fonts", "DejaVuSans.ttf"));
}
public static class ReportFiles
{
    static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");
    static string N(decimal? v) => v.HasValue ? v.Value.ToString("#,0.######", De) : "unbekannt";
    static readonly object FontLock = new();
    public static byte[] Pdf(GeneratedReport report, ReportSnapshot s)
    {
        lock (FontLock) { if (GlobalFontSettings.FontResolver == null) GlobalFontSettings.FontResolver = new ReportFontResolver(); }
        using var pdf = new PdfDocument(); pdf.Info.Title = s.Definition.Name; pdf.Info.Author = "sysDATIQ"; pdf.Info.Subject = $"{report.Status} v{report.Sequence} – Datenstand {s.Analysis.AsOf:O}";
        using var pages = new Pages(pdf, report, s);
        pages.Title(s.Definition.Name);
        if (s.Logo != null) { using var logo = XImage.FromStream(new MemoryStream(s.Logo)); var width = Math.Min(180, logo.PointWidth); var height = width * logo.PointHeight / logo.PointWidth; if (height > 70) { width *= 70 / height; height = 70; } pages.Image(logo, width, height); }
        pages.Text(s.Motto); pages.Text($"{s.Customer.Name} · ID {s.Customer.Number}"); pages.Text(s.Customer.Address);
        pages.Text($"Berichtsversion {report.Sequence} · {report.Status} · erstellt von {report.CreatedBy}");
        pages.Text($"Erstellt: {report.CreatedAt:yyyy-MM-dd HH:mm} UTC · Datenstand: {s.Analysis.AsOf:yyyy-MM-dd HH:mm} UTC");
        pages.Text($"Zeitraum {s.Analysis.Current.From:dd.MM.yyyy} bis {s.Analysis.Current.To:dd.MM.yyyy} (einschließlich, Standortzeit)");
        pages.Text($"Vergleich {s.Analysis.Reference.From:dd.MM.yyyy} bis {s.Analysis.Reference.To:dd.MM.yyyy}"); pages.Text(s.Definition.Notes);
        pages.Heading("Verbrauch und Vergleich");
        foreach (var x in s.Analysis.Comparisons)
        {
            pages.Heading($"{x.Medium} / {x.Unit} / {x.Direction}");
            pages.Text($"Vollständig erfasster Verbrauch: {N(x.Current)} {x.Unit} · Vergleich: {N(x.Reference)} {x.Unit}");
            pages.Text($"Änderung: {N(x.ChangePercent)} % · je 24 h: {N(x.CurrentPerDay)} / {N(x.ReferencePerDay)} {x.Unit}");
            pages.Text($"kWh/m²: {N(x.PerArea)} / {N(x.ReferencePerArea)} · kWh/Betriebsstunde: {N(x.PerHour)} / {N(x.ReferencePerHour)}");
            pages.Text($"kWh/Produktionseinheit: {N(x.PerProductionUnit)} / {N(x.ReferencePerProductionUnit)}");
            var g = s.Analysis.Current.Groups.SingleOrDefault(g => g.Medium == x.Medium && g.Unit == x.Unit && g.Direction == x.Direction);
            if (g != null) pages.Text($"Bekannte Teilmenge: {N(g.Available)} {x.Unit} · Abdeckung {N(g.Coverage * 100)} % · {(g.Estimated ? "zeitanteilig verteilt" : "ohne Randinterpolation")}");
            pages.Chart(s.Analysis.Current.Months.Select(m => (m.Month, m.Groups.SingleOrDefault(g => g.Medium == x.Medium && g.Unit == x.Unit && g.Direction == x.Direction)?.Value)).ToList(), x.Unit);
        }
        if (!string.IsNullOrWhiteSpace(s.Analysis.Input.DenominatorSource)) pages.Text("Quelle der Bezugsgrößen: " + s.Analysis.Input.DenominatorSource);
        pages.Heading("Datenqualität je Messstelle");
        foreach (var q in s.Analysis.Current.Quality)
        {
            pages.Text($"{q.Number} · {q.Name} · {q.Medium}/{q.Unit}: {N(q.Coverage * 100)} % abgedeckt");
            pages.Text($"Letzte Ablesung {q.LatestAt:yyyy-MM-dd HH:mm} UTC · Intervall {q.IntervalDays} Tage · Tagesgrenze {N(q.DailyLimit)}");
            pages.Text(q.Issues.Count == 0 ? "Keine offenen Hinweise im Zeitraum." : string.Join("; ", q.Issues));
            pages.Text("Herkunft: " + string.Join(", ", q.Sources.Select(x => $"{x.Key}: {x.Value}")));
        }
        if (s.Definition.IncludeTheory)
        {
            pages.Heading("Theoretische Jahresbilanz – Jahresannahmen");
            foreach (var b in s.Theory)
            {
                pages.Heading(b.Name); foreach (var t in b.Totals) pages.Text($"{t.Medium}/{t.Unit}/{t.Role}: {N(t.Value)} pro Jahr");
                foreach (var e in b.Entries) pages.Text($"{e.Building} · {e.Number} {e.Name}: {N(e.Value)} {e.Unit}/Jahr · {e.Source}");
                pages.Text($"{b.Missing.Count} Komponenten ohne Verbrauchsansatz; {b.Covered} Unteransätze durch Gesamtansätze ersetzt.");
            }
        }
        if (s.Definition.IncludeMeasures)
        {
            pages.Heading("Maßnahmen und Nachweisverzeichnis");
            foreach (var m in s.Measures) { pages.Text($"{m.Number} {m.Name} · Annahme {N(m.SavingsPercent)} % · {(m.Implemented ? "umgesetzt" : "offen")}"); pages.Text(m.Notes); pages.Text("PDF-Nachweise (Dateinamen zum Datenstand): " + string.Join(", ", m.EvidenceNames)); }
            pages.Text("Nachweisdateien werden im Verzeichnis aufgeführt und nicht in diesen Bericht eingebettet. Eine Umsetzung bestätigt keine rechnerisch nachgewiesene Einsparung.");
        }
        pages.Heading("Berechnung, Quellen und Archivierung"); pages.Text(s.Analysis.Method);
        pages.Text($"Rohdaten: {s.Analysis.Current.Readings.Count} aktuelle und {s.Analysis.Reference.Readings.Count} Vergleichsablesungen einschließlich erforderlicher Randablesungen. Vollständige Zeilen im eingefrorenen JSON-Datenstand und, falls gewählt, Excel-Export. Historische Herkunft Unknown bleibt unbekannt.");
        pages.Text($"Berechnungsversion: {s.CalculationVersion} · Vorlage v{s.Definition.Version}"); pages.Text("SHA-256 des unveränderlichen JSON-Datenstands:"); pages.Text(report.SnapshotHash);
        pages.Text("Berichts-ID: " + report.Id); pages.Finish(); using var stream = new MemoryStream(); pdf.Save(stream, false); return stream.ToArray();
    }
    sealed class Pages : IDisposable
    {
        readonly PdfDocument pdf; readonly GeneratedReport report; readonly ReportSnapshot snapshot; XGraphics? g; double y;
        readonly XFont normal = new("DejaVuSans", 9); readonly XFont heading = new("DejaVuSans", 13); readonly XFont title = new("DejaVuSans", 21);
        public Pages(PdfDocument pdf, GeneratedReport report, ReportSnapshot snapshot) { this.pdf = pdf; this.report = report; this.snapshot = snapshot; New(); }
        void New() { g?.Dispose(); var page = pdf.AddPage(); page.Size = PdfSharp.PageSize.A4; g = XGraphics.FromPdfPage(page); y = 48; g.DrawString("sysDATIQ · Energiebericht", normal, XBrushes.Teal, new XPoint(42, 26)); }
        void Space(double h) { if (y + h > 775) New(); }
        public void Title(string value) { Space(60); Wrap(value, title, 27); y += 12; }
        public void Heading(string value) { Space(58); y += 12; Wrap(value, heading, 20); y += 7; }
        public void Text(string? value) { if (string.IsNullOrWhiteSpace(value)) return; Wrap(value, normal, 14); y += 5; }
        void Wrap(string value, XFont font, double step) { foreach (var paragraph in value.Replace("\r", "").Split('\n')) { var line = ""; foreach (var word in paragraph.Split(' ')) { if (g!.MeasureString(line + word, font).Width > 505 && line.Length > 0) { Space(step); g.DrawString(line, font, XBrushes.Black, new XPoint(42, y)); y += step; line = ""; } var pending = word; while (g.MeasureString(pending, font).Width > 505) { var take = Math.Min(60, pending.Length); Space(step); g.DrawString(pending[..take], font, XBrushes.Black, new XPoint(42, y)); y += step; pending = pending[take..]; } line += pending + " "; } Space(step); g!.DrawString(line, font, XBrushes.Black, new XPoint(42, y)); y += step; } }
        public void Image(XImage image, double w, double h) { Space(h + 12); g!.DrawImage(image, 42, y, w, h); y += h + 12; }
        public void Chart(List<(string Label, decimal? Value)> values, string unit)
        {
            // Bis zu 12 Monatsbalken je Seite, feste Breite und Vektorausgabe.
            var max = values.Where(v => v.Value.HasValue).Select(v => v.Value!.Value).DefaultIfEmpty(0).Max();
            foreach (var chunk in values.Chunk(12))
            {
                Space(210); var top = y; var width = 500d / chunk.Length;
                for (var i = 0; i < chunk.Length; i++) { var x = 42 + i * width; var h = max > 0 ? (double)(chunk[i].Value ?? 0) / (double)max * 125 : 0; var barWidth = Math.Min(38, Math.Max(2, width - 9)); g!.DrawRectangle(XBrushes.Teal, x + (width - barWidth) / 2, top + 130 - h, barWidth, h); g.DrawString(chunk[i].Value.HasValue ? N(chunk[i].Value) : "Lücke", new XFont("DejaVuSans", 7), XBrushes.Black, new XPoint(x + (width - barWidth) / 2, top + 145)); g.DrawString(chunk[i].Label, new XFont("DejaVuSans", 7), XBrushes.Black, new XPoint(x + (width - barWidth) / 2, top + 160)); }
                y = top + 180; Text("Monate · " + unit + " · Lücken werden nicht als Null dargestellt.");
            }
        }
        public void Finish() { g?.Dispose(); g = null; for (var i = 0; i < pdf.PageCount; i++) { using var footer = XGraphics.FromPdfPage(pdf.Pages[i], XGraphicsPdfPageOptions.Append); footer.DrawString($"v{report.Sequence} · {report.Status} · {snapshot.Analysis.AsOf:yyyy-MM-dd} UTC · Seite {i + 1}/{pdf.PageCount}", new XFont("DejaVuSans", 8), XBrushes.Gray, new XPoint(42, 813)); } }
        public void Dispose() => g?.Dispose();
    }
    public static byte[] Excel(GeneratedReport r, ReportSnapshot s)
    {
        using var wb = new XLWorkbook();
        void Sheet(string name, string[] headers, IEnumerable<object?[]> rows) { var sh = wb.AddWorksheet(name); for (var i = 0; i < headers.Length; i++) sh.Cell(1, i + 1).Value = headers[i]; var n = 2; foreach (var row in rows) { for (var i = 0; i < row.Length; i++) { var cell = sh.Cell(n, i + 1); switch (row[i]) { case null: break; case decimal d: cell.Value = (double)d; cell.Style.NumberFormat.Format = "0.######"; break; case int j: cell.Value = j; break; case bool b: cell.Value = b; break; default: cell.Value = row[i]!.ToString() ?? ""; break; } } n++; } sh.Range(1, 1, 1, headers.Length).Style.Font.Bold = true; sh.SheetView.FreezeRows(1); sh.Range(1, 1, Math.Max(1, n - 1), headers.Length).SetAutoFilter(); sh.Columns().AdjustToContents(10, 65); sh.Rows().Style.Alignment.Vertical = XLAlignmentVerticalValues.Top; }
        Sheet("Bericht", ["Merkmal", "Wert"], new List<object?[]> { new[] { "Kunde", s.Customer.Name }, new[] { "Kunden-ID", s.Customer.Number }, new[] { "Adresse", s.Customer.Address }, new[] { "Titel", s.Definition.Name }, new object?[] { "Version", r.Sequence }, new[] { "Status", r.Status }, new[] { "Berichts-ID", r.Id.ToString() }, new[] { "Erstellt UTC", r.CreatedAt.ToString("O") }, new[] { "Datenstand UTC", s.Analysis.AsOf.ToString("O") }, new[] { "SHA256 JSON", r.SnapshotHash }, new[] { "Quelle Bezugsgrößen", s.Analysis.Input.DenominatorSource }, new[] { "Berechnung", s.CalculationVersion }, new[] { "Von", s.Analysis.Current.From.ToString() }, new[] { "Bis einschließlich", s.Analysis.Current.To.ToString() }, new[] { "Vergleich von", s.Analysis.Reference.From.ToString() }, new[] { "Vergleich bis", s.Analysis.Reference.To.ToString() } });
        Sheet("Vergleich", ["Medium", "Einheit", "Richtung", "Verbrauch", "Referenz", "Änderung %", "pro Tag", "Referenz pro Tag", "kWh/m²", "Referenz kWh/m²", "kWh/h", "Referenz kWh/h", "kWh/Produktion", "Referenz kWh/Produktion"], s.Analysis.Comparisons.Select(x => new object?[] { x.Medium, x.Unit, x.Direction, x.Current, x.Reference, x.ChangePercent, x.CurrentPerDay, x.ReferencePerDay, x.PerArea, x.ReferencePerArea, x.PerHour, x.ReferencePerHour, x.PerProductionUnit, x.ReferencePerProductionUnit }));
        var periods = new[] { ("Aktuell", s.Analysis.Current), ("Referenz", s.Analysis.Reference) };
        Sheet("Bilanz", ["Zeitraum", "Medium", "Einheit", "Richtung", "Vollverbrauch", "Bekannte Teilmenge", "Abdeckung", "Zeitanteilig", "Messstellen", "Tage"], periods.SelectMany(p => p.Item2.Groups.Select(g => new object?[] { p.Item1, g.Medium, g.Unit, g.Direction, g.Value, g.Available, g.Coverage, g.Estimated, g.Meters, g.Days })));
        Sheet("Monate", ["Zeitraum", "Monat", "Medium", "Einheit", "Richtung", "Vollverbrauch", "Teilmenge", "Abdeckung", "Zeitanteilig"], periods.SelectMany(p => p.Item2.Months.SelectMany(m => m.Groups.Select(g => new object?[] { p.Item1, m.Month, g.Medium, g.Unit, g.Direction, g.Value, g.Available, g.Coverage, g.Estimated }))));
        Sheet("Datenqualität", ["Zeitraum", "ID", "Messstelle", "Medium", "Einheit", "Abdeckung", "Letzte Ablesung UTC", "Fällig", "Intervall Tage", "Tagesgrenze", "Offene Prüfungen", "Gerätegrenzstände fehlen", "Hinweise", "Herkunft"], periods.SelectMany(p => p.Item2.Quality.Select(q => new object?[] { p.Item1, q.Number, q.Name, q.Medium, q.Unit, q.Coverage, q.LatestAt?.ToString("O"), q.Overdue, q.IntervalDays, q.DailyLimit, q.OpenChecks, q.IncompleteReplacements, string.Join("; ", q.Issues), string.Join("; ", q.Sources.Select(x => $"{x.Key}: {x.Value}")) })));
        if (s.Definition.IncludeReadings) foreach (var p in periods) Sheet("Rohdaten " + p.Item1, ["ID Ablesung", "ID Messstelle", "ID Gerätinstallation", "Datum UTC", "Zählerstand", "Faktor", "Herkunft", "Status", "Version", "Überlauf", "Registergrenze", "Geprüft", "Prüfvermerk", "Grenzwertprüfung nötig"], p.Item2.Readings.Select(x => new object?[] { x.Id, x.Meter, x.InstallationId, x.At.ToString("O"), x.Value, x.Factor, x.Source, x.Status, x.Version, x.IsRollover, x.RegisterLimit, x.Reviewed, x.ReviewNote, x.NeedsReview }));
        if (s.Definition.IncludeTheory) Sheet("Theorie Jahresannahme", ["Bereich", "Gebäude", "Komponente", "ID", "Medium", "Einheit", "Rolle", "Jahreswert", "Quelle", "Einsparannahme %"], s.Theory.SelectMany(b => b.Entries.Select(e => new object?[] { b.Name, e.Building, e.Name, e.Number, e.Medium, e.Unit, e.Role, e.Value, e.Source, e.SavingsPercent })));
        if (s.Definition.IncludeMeasures) Sheet("Maßnahmen", ["Komponente", "ID", "Annahme %", "Umgesetzt", "Vermerk", "Nachweisverzeichnis"], s.Measures.Select(m => new object?[] { m.Name, m.Number, m.SavingsPercent, m.Implemented, m.Notes, string.Join("; ", m.EvidenceNames) }));
        Sheet("Berechnete Intervalle", ["Zeitraum", "ID Messstelle", "Von UTC", "Bis UTC", "Verbrauch mit Faktor"], periods.SelectMany(p => p.Item2.Segments.Select(x => new object?[] {p.Item1,x.PointId,x.From.ToString("O"),x.To.ToString("O"),x.Value})));
        Sheet("Bilanzzuordnung", ["Zeitraum", "ID Messstelle", "Hauptzählung von UTC", "Hauptzählung bis UTC"], periods.SelectMany(p => p.Item2.RootPeriods.Select(x => new object?[] {p.Item1,x.PointId,x.From.ToString("O"),x.To.ToString("O")})));
        Sheet("Methodik", ["Thema", "Dokumentation"], new[] { new object?[] { "Berechnung", s.Analysis.Method }, new object?[] { "Unbekannt", "Leere numerische Zellen sind unbekannt. Echte Null bleibt 0." }, new object?[] { "Nachweise", "PDF-Nachweise als Dateinamenverzeichnis, nicht eingebettet." }, new object?[] { "Bezugsgrößen", System.Text.Json.JsonSerializer.Serialize(s.Analysis.Input, GeneratedReports.Json) }, new object?[] { "Archiv", "Datei aus eingefrorenem Datenstand. Korrekturen nur in neuen Berichtsversionen." } });
        using var stream = new MemoryStream(); wb.SaveAs(stream); return stream.ToArray();
    }
}
