# Version 0.8 – Datenqualität, Vergleiche, Berichte und Erinnerungen

Die Version ergänzt die bestehende lokale Docker-Anwendung. Bestehende Kunden, Zähler, Ablesungen, geschützte Importvorlagen, Dateien und Passwörter werden weiterverwendet. Die Migration ergänzt Tabellen und die Herkunftsspalte. Historische Herkunft bleibt ausdrücklich `Unknown`; sie wird nicht aus frei bearbeitbaren Kommentaren geraten.

## Auswertungen

Den Kunden oben auswählen und „Auswertungen“ öffnen. Voreingestellt sind die letzten 30 Kalendertage und ein Vorjahresvergleich. Beide Zeiträume können frei geändert werden, ebenso Standort, Gebäude und Medium. „Auswertung berechnen“ erzeugt Vergleichskarten, Monatsbalken und die Datenqualitätsübersicht. Kleine Ansichten umbrechen die Monate; Diagramme benötigen keinen horizontalen Bildlauf. Die Tabelle darf bei schmalem Bildschirm separat gescrollt werden.

Die Datenqualität zeigt pro Messstelle Abdeckung, letzte Ablesung, Fälligkeit nach konfiguriertem Ableseintervall, fehlende Gerätegrenzstände, offene Grenzwertprüfungen und Datenherkunft. Das Intervall und eine optionale Tagesverbrauchsgrenze werden weiterhin an der Messstelle konfiguriert. Ohne ausdrücklich gesetzte Tagesgrenze entsteht keine automatische Median- oder Verbrauchsspitzenprüfung. Die Systemadministration kann Grenzwertprüfungen mit Vermerk bestätigen. Der Vermerk gilt für genau diese Messwertversion; eine spätere Korrektur über der Grenze öffnet die Prüfung erneut. Bestätigungen ändern weder Messwerte noch Herkunft.

Unter „Bezugsgrößen und Kennzahlen“ lassen sich Fläche, Betriebsstunden und Produktionseinheiten je Zeitraum getrennt mit Quelle und Gültigkeit dokumentieren. Ohne Bezugsgröße bleibt die jeweilige Kennzahl unbekannt. Eingaben liegen zwischen 0,000001 und einer Billion; rechnerisch nicht darstellbare Kennzahlen bleiben ebenfalls unbekannt. kWh/m², kWh/Betriebsstunde und kWh/Produktionseinheit werden nur für kWh-Gruppen und vollständige Verbräuche berechnet. Historische Flächen werden nicht automatisch aus dem heutigen Kataster angenommen.

Berechnungsregeln:

- Differenzen bleiben innerhalb derselben Geräteinstallation und berücksichtigen Faktor und ausdrücklich erfasste Überläufe.
- Bekannte Intervalle werden an Zeitraum- und Monatsgrenzen zeitanteilig verteilt und gekennzeichnet. Das ist keine gemessene Lastkurve. Die bestehenden Jahreskacheln behalten ihre strengere Berechnung aus vollständig eingeschlossenen Messintervallen.
- Fehlende Daten bleiben unbekannt. Die bekannte Teilmenge wird getrennt gezeigt, echte Nullwerte bleiben Null. Prozentänderungen und Kennzahlen werden bei unvollständigen Mengen nicht behauptet.
- Haupt- und Unterzähler werden anhand der historischen Zuordnung nicht doppelt gezählt. Strom, Gas, Wasser, Einheiten und Bezug/Lieferung werden getrennt dargestellt; es gibt keine unbewiesene Umrechnung von Gasvolumen in kWh.
- Prozentänderungen vergleichen die gewählten Gesamtzeiträume. Bei unterschiedlicher Länge zusätzlich die Werte je tatsächlichem 24-Stunden-Tag beurteilen. Die Diagramme paaren die Monate nach ihrer Reihenfolge und beschriften beide Zeiträume.
- Theoretische Jahresannahmen sind von tatsächlich erfassten Periodenmengen und nachgewiesenen Einsparungen getrennt.

Grenzen: zehn Jahre je Zeitraum, 200 Messstellen und 50.000 relevante Ablesungen je Auswertungslauf. Größere Bereiche werden mit einer verständlichen Meldung abgewiesen.

## PDF und Excel

In „Berichte“ zuerst eine Berichtsvorlage anlegen oder auswählen. Darunter die gespeicherte Vorlage für die Erstellung wählen, Vergleichszeitraum und gegebenenfalls Bezugsgrößen angeben und „Neue Berichtsversion erstellen“ drücken. Standort, Gebäude, Anlage, Medium, aktueller Zeitraum, Ausgabeformate und Inhalte stammen aus der Vorlage.

Ein Bericht enthält Kundenangaben, das zum Erstellzeitpunkt geltende Logo und den Leitspruch, Verbrauchsvergleich, Monatsdiagramme, Datenqualität, Methodik und je nach Auswahl theoretische Jahresbilanz, Rohablesungen und Maßnahmenverzeichnis. PDF-Nachweise der Maßnahmen werden als Dateinamenverzeichnis aufgeführt. Die Originalnachweise werden nicht in das PDF eingebettet und nicht automatisch mit KI ausgewertet.

PDF-Ausgaben enthalten eingebettete Unicode-Schrift, Vektordiagramme, Umbrüche und Seitenzahlen. Excel enthält numerische Werte, getrennte Tabellen für Bilanz, Vergleich, Monate, Qualität, Rohdaten und Methodik; Benutzereingaben werden als Text und nicht als Excel-Formeln gespeichert. Randablesungen sind zur Nachvollziehbarkeit enthalten und können außerhalb des angefragten Zeitraums liegen. Unbekannte numerische Zellen sind leer, Null bleibt 0.

Die Erstellung liest einen konsistenten Datenbankstand. JSON-Datenstand, SHA-256 und fertige PDF-/Excel-Bytes werden dauerhaft in PostgreSQL archiviert. Die Daten enthalten auch die berechneten Intervalle und historischen Hauptzählerperioden. Nachträgliche Änderungen an Messwerten, Logo, Vorlagen oder Anlagen verändern diese Dateien nicht. Neue Erstellung erzeugt eine neue, fortlaufende Version.

„Version freigeben“ dokumentiert eine Begründung im Audit und erzeugt eine weitere Version mit Freigabestatus aus den eingefrorenen Quelldaten des Entwurfs. Es erfolgt keine Neuberechnung aus aktuellen Stammdaten. Derselbe Entwurf kann nur einmal freigegeben werden. Beide Versionen bleiben abrufbar; der Datenstand-Hash bleibt gleich, die erzeugten Dateien enthalten ihre jeweilige Versions-/Freigabemetadaten.

Beim Abruf werden aktuelle Kunden- und Standortrechte gegen die im Bericht enthaltenen Bereiche geprüft. Eine später entzogene Standortfreigabe entzieht auch den Abruf alter Berichte dieses Standorts. Das Löschen einer Vorlage löscht keine archivierten Berichte. JSON- und Berichtsexporte enthalten absichtlich Kundenangaben; nur der separat vorhandene KI-Prompt wird neutralisiert.

## Automatische Ableseerinnerungen

Nur die Systemadministration sieht diese Einstellungen unter „Berichte“. Pro Kunde sind Aktivierung, monatlicher Tag 1–28, Uhrzeit, IANA-Zeitzone, Empfänger und eine optionale Folgeerinnerung nach 1–21 Tagen wählbar (0 = aus). Empfänger müssen aktive Kundenbenutzer mit Ableserechten sein. Nur fällige aktive Messstellen ihrer aktuell erlaubten Standorte werden genannt. Es gibt keine Feiertagsregelung.

Der erste automatische Termin liegt nach dem Speichern in der Zukunft. Der Dienst kontrolliert fällige Termine alle 30 Sekunden. Nach einem längeren Ausfall plant er den aktuellen Monatszyklus nach; historische Monate werden nicht in einem Stapel nachversendet. „Fällige Erinnerungen jetzt planen“ ermöglicht einen sofortigen lokalen Funktionstest. Pro Kunde, Monat, Empfänger und Erinnerungsstufe verhindert ein eindeutiger Datenbankschlüssel doppelte Aufträge.

Die Warteschlange liegt dauerhaft in PostgreSQL. Vor dem Versand werden Aktivität, Mitgliedschaft, Standortrechte, E-Mail-Adresse, Einstellungen und noch ausstehende Ablesungen erneut geprüft. Geänderte Konfigurationen machen alte Aufträge ungültig; sie werden beim nächsten Verarbeiten abgebrochen. Bereits geplante Stufen desselben Monats werden nicht stillschweigend ersetzt. Neu hinzugefügte Empfänger können mit „jetzt planen“ Aufträge erhalten.

- **Geplant:** noch nicht fällig oder noch nicht verarbeitet.
- **Wird versendet:** Auftrag mit vorab gespeicherter dreiminütiger Bearbeitungsfrist.
- **SMTP angenommen:** Testserver hat angenommen; dies ist keine Zustell- oder Lesebestätigung.
- **Wiederholung geplant:** ausdrücklich temporäre SMTP-Ablehnung; höchstens drei automatische Versuche, mit wachsendem Abstand.
- **Fehlgeschlagen:** dauerhafte Ablehnung oder ausgeschöpfte Versuche.
- **Unklar:** Zeitüberschreitung, Verbindungsabbruch oder abgelaufene Bearbeitungsfrist nach Neustart. Kein automatischer Neuversand. Mailpit mit der Auftrags-ID prüfen und die Entscheidung mit Begründung dokumentieren.
- **Abgebrochen:** keine fälligen Messstellen mehr, Berechtigung entzogen, Einstellung geändert oder manuell beendet.

SMTP bietet keine garantierte Genau-einmal-Zustellung. Eine feste Message-ID unterstützt die Nachverfolgung, verpflichtet den Mailserver aber nicht zur Duplikatunterdrückung. Bei manueller Wiederholung eines unklaren Auftrags kann eine zweite Nachricht entstehen.

Die lokale Version lässt für Erinnerungen ausschließlich die SMTP-Hosts `mail`, `localhost`, `127.0.0.1` und `::1` zu. Docker verwendet Mailpit, erreichbar unter http://localhost:8025. Es findet kein Versand an echte Kundenpostfächer statt. Der Portallink öffnet die Zähleransicht mit Kundenauswahl; Anmeldung und Berechtigungsprüfung bleiben erforderlich. `REMINDERS_WORKER_ENABLED=false` in Compose bzw. `Reminders__WorkerEnabled=false` beim nativen API-Start deaktiviert nur den Hintergrunddienst für deterministische Tests; manuelles Verarbeiten bleibt möglich.

## Update und Datensicherung

Vor dem Update PostgreSQL-Dump und die vorhandenen Docker-Volumes sichern, besonders `postgres_data`, `blob_data` und `data_keys`. Die neuen Archivdateien und Aufträge liegen in PostgreSQL; private Nachweise weiterhin im Blob-Volume. Vorhandene `.env` und das bisherige Compose-Projekt weiterverwenden. Kein `down -v` ausführen.

Im aktualisierten Projektordner für das bisher verwendete Projekt:

```powershell
docker compose -p sysdatiq up --build --force-recreate -d --wait
```

Danach http://localhost:8080 mit Strg+F5 neu laden. `/api/health` und der Seitenleistenfuß zeigen `0.8.0`. Mailpit bleibt unter Port 8025. Bei anderem bisherigem Projektnamen diesen weiterverwenden. Der professionelle Produktivbetrieb mit echtem SMTP, öffentlichem Zugriff und Azure-Freigabe gehört zu einem weiteren Meilenstein; der lokale Entwicklungsmodus bleibt absichtlich erhalten.
