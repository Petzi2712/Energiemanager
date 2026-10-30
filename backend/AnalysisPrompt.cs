using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using static Energy.TechnicalAccess;
namespace Energy;

public static class AnalysisPrompt
{
    public record Input(DateOnly From, DateOnly To, Guid? SiteId = null, Guid? BuildingId = null, Guid? NodeId = null, string Medium = "");
    static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");
    static string N(decimal? value) => value.HasValue ? (value.Value!=0 && Math.Abs(value.Value)<0.000001m ? value.Value.ToString("0.######E+0",De) : value.Value.ToString("0.######",De)) : "unbekannt";
    static string D(DateTimeOffset? date) => date?.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture) ?? "unbekannt";
    static string Medium(string key) => key switch {"Electricity"=>"Strom","Heat"=>"Wärme","Cooling"=>"Kälte","Gas"=>"Gas","Water"=>"Wasser",_=>"Sonstiges"};
    // Ausschließlich kontrollierte Messmetadaten ausgeben, niemals Namen, Nummern,
    // GUIDs, Adressen, Benutzer, Kommentare, Dateinamen oder Maßnahmentexte.
    static string Unit(string value) => new[]{"kWh","MWh","m³"}.Contains(value) ? value : "unbekannte Einheit";
    public static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/reports/{customerId:guid}/analysis-prompt",async(Guid customerId,Input input,AppDbContext db,HttpContext c)=>{
            Require(input.From>=new DateOnly(1900,1,1)&&input.To<=DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1)&&input.From<=input.To&&input.To<input.From.AddMonths(36),"Analysezeitraum von höchstens 36 Monaten bis heute wählen.");
            var data=await MeterAnalytics.Load(db,c,customerId,input.NodeId,input.SiteId,input.BuildingId,input.Medium,input.From,input.To,200);
            var text=Build(data,input);
            Security.Audit(db,c,"Analyseprompt.Erstellt","Neutrale Verbrauchsdaten",customerId,System.Text.Json.JsonSerializer.Serialize(new{input.From,input.To,points=data.Points.Count}));await db.SaveChangesAsync();
            return Results.Ok(new{text,createdAt=data.AsOf,pointCount=data.Points.Count});
        }).RequireAuthorization();
    }
    public static string Build(MeterAnalytics data,Input input)
    {
        var output=new StringBuilder();
        output.AppendLine("Aufgabe: Neutrale Analyse eines Energie- und Verbrauchsmesssystems");
        output.AppendLine("Analysiere die nachfolgenden Messdaten sachlich und ergebnisoffen. Arbeite ausschließlich mit diesen Daten. Neutrale Bezeichnungen stehen für Messstellen und Standorte; Namen und Kennungen sind nicht enthalten. Die neutralen Bezeichnungen gelten innerhalb dieses Datenabzugs.");
        output.AppendLine($"Analysezeitraum: {input.From:yyyy-MM-dd} bis {input.To:yyyy-MM-dd} einschließlich Enddatum, jeweils in der Standortzeitzone; Datenstand UTC: {data.AsOf:yyyy-MM-dd HH:mm:ss}.");
        output.AppendLine("Regeln: Trenne gemessene Intervallverbräuche, zeitanteilige Monatszuordnungen, unbekannte Werte und Hypothesen. Unbekannt bedeutet nicht null. Beziehe unterschiedliche Medien, Einheiten und Bezugs-/Liefermengen nicht ohne dokumentierte Umrechnung aufeinander. Addiere Haupt- und Unterzähler nicht doppelt. Vergleiche ähnliche Zeiträume, Abdeckung und Intervalllängen. Leite aus interpolierten Monatsmengen keine gemessenen Tagesprofile, Spitzenlasten oder Betriebszeiten ab.");
        output.AppendLine("Wetter, Produktion, Belegung, Öffnungszeiten, Preise und Umsetzungsdaten sind nicht mitgeliefert. Unterstelle keine Ursachen, Einsparungen oder Maßnahmenwirkungen. Benenne mögliche Erklärungen als zu prüfende Hypothesen und fordere die dafür fehlenden Informationen an. Extrapoliere unvollständige Jahre nicht stillschweigend.");
        output.AppendLine("Rechenbasis: Differenzen aufeinanderfolgender Ablesungen je Geräteperiode × Gerätefaktor, einschließlich dokumentierter Überläufe und Gerätewechsel. Daten ohne ausreichende Standortfreigabe und Messlücken werden ausgelassen. Exakte Intervallmengen über Analysegrenzen sind im erfassten Teilwert nicht enthalten. Monatswerte werden innerhalb bekannter Intervalle zeitanteilig zugeordnet und entsprechend gekennzeichnet; außerhalb bekannter Intervalle gibt es keine Hochrechnung.");
        if(data.Points.Count==0){output.AppendLine("Datenlage: Im gewählten Bereich liegen keine freigegebenen Messstellen vor. Eine Verbrauchsanalyse ist damit nicht möglich. Benenne die erforderlichen Messdaten.");return output.ToString();}
        var aliases=data.Points.Select((p,i)=>(p.Id,Alias:$"Messstelle {i+1:000}")).ToDictionary(x=>x.Id,x=>x.Alias);
        var siteIds=data.Assignments.Where(data.InScope).Select(a=>a.SiteId).Distinct().OrderBy(id=>id).ToList();
        var sites=siteIds.Select((id,i)=>(id,Alias:$"Standort {i+1:00}")).ToDictionary(x=>x.id,x=>x.Alias);
        output.AppendLine();output.AppendLine("1. Messstellen und erfasste Intervallmengen (keine theoretischen Jahreswerte)");
        foreach(var p in data.Points) {
            var a=data.Assignments.Where(a=>a.PointId==p.Id&&data.InScope(a)).OrderByDescending(a=>a.ValidFrom).First();
            var actual=data.ActualFor(p.Id);var parent=a.ParentPointId.HasValue&&aliases.TryGetValue(a.ParentPointId.Value,out var alias)?alias:"keine im ausgewählten Bereich";
            output.AppendLine($"{aliases[p.Id]} | {sites[a.SiteId]} | Übergeordnet (letzte Zuordnung im Bereich): {parent} | {Medium(p.Medium)} | {Unit(p.Unit)} | {(p.Direction=="Export"?"Lieferung":"Bezug")} | erfasst: {N(actual.Value)} | Abdeckung bis zur letzten Ablesung: {N(actual.Coverage*100)} % | {actual.Status} | Messzeitraum UTC: {D(actual.MeasuredFrom)} bis {D(actual.MeasuredTo)} | vollständige Intervalle: {actual.Intervals} | nicht exakt zuordenbare Randintervalle: {actual.OmittedIntervals}.");
            var range=data.Range(p.Id);var periods=data.Periods(p.Id,false);
            var rows=data.Segments[p.Id].Where(s=>s.From>=range.From&&s.To<=range.To&&periods.Any(a=>a.From<=s.From&&a.To>=s.To)).TakeLast(2).ToArray();
            if(rows.Length==2) {
                var before=rows[0].Value/(decimal)(rows[0].To-rows[0].From).TotalDays;var after=rows[1].Value/(decimal)(rows[1].To-rows[1].From).TotalDays;
                var change=before==0?"Prozentvergleich bei vorher null nicht definiert":$"Änderung {N((after-before)/before*100)} %";
                output.AppendLine($"  Letzte zwei vollständige Intervalle: {D(rows[0].From)}–{D(rows[0].To)} ({N((decimal)(rows[0].To-rows[0].From).TotalDays)} Tage), {N(before)} {Unit(p.Unit)}/Tag im Mittel; danach {D(rows[1].From)}–{D(rows[1].To)} ({N((decimal)(rows[1].To-rows[1].From).TotalDays)} Tage), {N(after)} {Unit(p.Unit)}/Tag im Mittel; {change}. Dies sind Intervallmittelwerte, keine gemessenen Tageslastgänge.");
            }
        }
        output.AppendLine();output.AppendLine("2. Gesamtsummen ohne doppelte Haupt-/Unterzählerzählung");
        foreach(var g in data.Totals())output.AppendLine($"{Medium(g.Medium)} | {Unit(g.Unit)} | {(g.Direction=="Export"?"Lieferung":"Bezug")} | erfasst: {N(g.Value)} | {g.Status} | bilanzierte Messstellenperioden: {g.Meters} | Messzeitraum UTC: {D(g.MeasuredFrom)} bis {D(g.MeasuredTo)}.");
        output.AppendLine();output.AppendLine("3. Monatliche Gesamtreihe nach historischen Zuordnungen");
        output.AppendLine("Spalten: Monat | Medium | Einheit | Richtung | bekannte Monatsmenge | zeitliche Datenabdeckung | Qualität. Hauptzähler ersetzen ihre Unterzähler nur während der jeweiligen Zuordnung im gewählten Bereich. Zeitanteilige Mengen dienen dem Vergleich, sind keine einzeln gemessenen Monatswerte.");
        for(var month=new DateOnly(input.From.Year,input.From.Month,1);month<=input.To;month=month.AddMonths(1)) {
            var start=month<input.From?input.From:month;var finish=month.AddMonths(1);if(finish>input.To.AddDays(1))finish=input.To.AddDays(1);
            foreach(var group in data.Points.GroupBy(p=>new{p.Medium,p.Unit,p.Direction})) {
                decimal known=0;long expected=0;decimal covered=0;bool any=false,estimated=false;
                foreach(var p in group) {
                    var zone=data.Zone(p.Id);var a=MeterAnalytics.Midnight(start,zone);var b=MeterAnalytics.Midnight(finish,zone);if(b>data.AsOf)b=data.AsOf;if(a>=b)continue;
                    var periods=data.Periods(p.Id,true).Where(x=>x.From<b&&x.To>a).ToList();
                    var ticks=periods.Sum(x=>Math.Max(0,Math.Min(x.To.UtcTicks,b.UtcTicks)-Math.Max(x.From.UtcTicks,a.UtcTicks)));if(ticks==0)continue;
                    var amount=ConsumptionEndpoints.Calculate(a,b,data.Segments[p.Id],periods.Select(x=>new MeterAssignment{ValidFrom=x.From,ValidTo=x.To}).ToList(),false);
                    expected+=ticks;covered+=ticks*amount.Coverage;estimated|=amount.Estimated;
                    if(amount.Available.HasValue){any=true;known+=amount.Available.Value;}
                }
                if(expected>0)output.AppendLine($"{month:yyyy-MM} | {Medium(group.Key.Medium)} | {Unit(group.Key.Unit)} | {(group.Key.Direction=="Export"?"Lieferung":"Bezug")} | {N(any?known:null)} | {N(covered/expected*100)} % | {(!any?"unbekannt":covered<expected?(estimated?"Teilwert, zeitanteilig verteilt, Messlücken":"Teilwert mit Messlücken"):estimated?"zeitanteilig verteilt":"aus Randablesungen gemessen")}");
            }
        }
        output.AppendLine();output.AppendLine("Gewünschtes Ergebnis: (1) Datenqualität und Grenzen, (2) nachvollziehbare Veränderungen und Verbrauchsverhalten mit Zahlen und Bezugszeitraum, (3) mögliche Auffälligkeiten mit alternativen Erklärungen und Unsicherheit, (4) priorisierte Prüf- und Verbesserungsansätze samt benötigten Zusatzdaten, (5) offene Fragen. Trenne Beobachtung, Hypothese und Empfehlung. Vermeide unbelegte Schuldzuweisungen, erfundene Messwerte, pauschale Einsparversprechen und Rückschlüsse auf die Identität des Betriebs.");
        return output.ToString();
    }
}
