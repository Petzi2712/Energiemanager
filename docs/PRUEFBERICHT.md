# Prüfbericht – Jahresverbrauch, Diagramme und neutraler KI-Prompt v0.7.0

Ausschließlich synthetische Testdaten. Vorheriger Stand: [Version 0.6](PRUEFBERICHT-v0.6.md).

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Publish, .NET SDK 10.0.403 | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich, auch im Web-Dockerimage |
| Gemeinsamer API-Lauf auf frischer Datenbank | **102 ausgeführt, 102 bestanden** |
| Gemeinsamer Browserlauf | **15 ausgeführt, 15 bestanden**, Desktop und Smartphoneansicht |
| Neue Browserabläufe | Beide erfolgreich, 1440 und 390 Pixel, Europe/Berlin |
| Zwischenablage und ausgehende Anfragen | Kopierter Text entspricht der erzeugten Ausgabe; während Erstellung/Kopie keine externen Anfragen im Browser |
| Diagrammbreite | Vollständiges SVG innerhalb der verfügbaren Breite; kein horizontaler Überlauf auf Desktop oder Smartphone |
| Web-Containerimage 0.7.0 | Gebaut; HTML, CSP und endgültiges Produktionsskript per HTTP geprüft |
| Update einer 0.6-Bestandskopie | Alte Inhalte und Zeilenzahlen in zwölf Tabellen per Prüfsumme unverändert; API 0.7.0 |
| EF-Modell gegen Migration | Keine ausstehenden Modelländerungen, keine neue Schema-Migration |
| NuGet inklusive transitiver Pakete / npm-Laufzeitpakete | Keine bekannten Sicherheitsmeldungen; gesperrter NuGet-Restore erfolgreich |
| Compose-Konfiguration / Shellsyntax / Patch-Whitespace | Erfolgreich geprüft |

Die elf neuen API-Fälle prüfen echte Jahresmengen und den letzten Zählerstand, Gerätefaktoren, Haupt-/Unter-/Unterunterzähler ohne Doppelzählung, getrennte Medien und Messrichtungen, fehlende Jahresrandablesungen, bekannte Nullwerte, Gerätewechsel, historische Umhängungen, Gebäudebereiche, explizite Messstellenverweise und Mengen inzwischen gelöschter Messstellen. Sehr kleine von null verschiedene Verbrauchsmengen bleiben bis zur Promptausgabe erhalten.

Der neutrale Prompt wird auf Veränderung durch neue Ablesungen, normierte Intervallmittel, Monatsqualität, Bereichsfilter, fehlende Daten, Zeitraumgrenzen und Kunden-/Standortrechte geprüft. Vertrauliche Testnamen, Adressen, Kontakte, Kennungen und Freitexte fehlen in der Ausgabe. Ein eingeschränkter Standortleser erhält auch nach einer Umhängung keine Intervallmengen aus dem gesperrten Standort. Unzulässige oder extrem zukünftige Datumswerte werden abgewiesen.

Die beiden neuen Browserabläufe verwenden einen eigenen Testkunden mit zwei Gebäuden, einem Haupt-/Unterzähler und einer unabhängigen Messstelle. Sie prüfen 150 kWh Zählerstand gegenüber 300 kWh tatsächlichem Jahresverbrauch bei Faktor 2 und die Gesamtsumme 340 kWh statt einer doppelten Summe mit Unterzähler. Standort-, Gebäude- und Gesamtauswahl, Abschnittsreihenfolge, zunächst geschlossene Konfiguration und das Schließen nach Übernahme werden geprüft. Das Diagramm bleibt vollständig innerhalb der Breite. Anschließend werden Prompt und Kopie erzeugt, private Testangaben ausgeschlossen und ein Gebäudefilter erneut angewendet.

Die Regressionstests nutzen nun ausdrücklich die Strukturleiste und öffnen die einklappbare Konfiguration vor Änderungen. Die Medien-Vorauswahl der theoretischen Bilanz bevorzugt die Daten des geöffneten Bereichs; eine kundenweite Wasserbilanz verdeckt dadurch keine vorhandenen Stromwerte des ausgewählten Gebäudes. Wiederholte Jahreswerte werden am jeweiligen Anlagenbereich geprüft. Die Datums-Testhilfe verwendet die vom Browser normalisierte Schreibweise bei Sekundenwert 00.

Der Cloud-Lauf wurde während der Abschlussarbeit durch einen Umgebungsneustart unterbrochen. Die bereits abgeschlossenen 102 API-Ergebnisse und Dateien blieben erhalten. Die lokalen Testdienste wurden wieder gestartet und der gemeinsame Browserlauf anschließend vollständig ausgeführt. Es wurden keine fachlichen Prüfungen deaktiviert.

Für das Update wurden alle bisherigen Inhalte in Customers, Users, Nodes, Points, Readings, Assignments, Devices, Installations, Documents, Branding, Vehicles und ReportDefinitions verglichen. Die Ausgangsdatenbank blieb unverändert. Neue Berechnungen und Promptausgaben benötigen keine zusätzliche Tabelle.

Ansichten: [Jahreskacheln](screenshots/jahreskacheln-v07.png) · [Verbrauch auf dem Smartphone](screenshots/verbrauch-ohne-scrollen-v07.png).

## Prüfgrenzen

ASP.NET Core und Vite liefen nativ, PostgreSQL und Mailpit in Docker, der offizielle Azurite-Emulator lokal. Das Web-Dockerimage wurde neu gebaut und per HTTP geprüft. Der vollständige Backend-Docker-Stack wurde in dieser Cloud nicht erneut gebaut; der bereits dokumentierte MCR-Image-Download ist durch den Cloud-Netzwerkfilter eingeschränkt. `scripts/test.sh` verwendet über Compose alle 102 API-Fälle.

Nicht geprüft sind der konkrete Benutzerrechner, physische Mobilgeräte, ARM, Produktivbetrieb oder Lasttests. Der erzeugte Prompt wird nicht automatisch an eine KI gesendet und führt keine KI-Analyse aus. Die Qualität einer späteren externen Auswertung wurde nicht bewertet. Neutrale Bezeichnungen lassen Namen und Kennungen weg; sie sind kein Nachweis einer vollständigen Anonymität von Verbrauchsmustern.

Jahreskacheln zeigen tatsächlich erfasste vollständige Intervalle, gegebenenfalls als Teilwert bis zur letzten Ablesung. Die Verbrauchsdiagramme und die Monatsreihe im Prompt können bekannte Intervalle zeitanteilig verteilen; diese Werte bleiben gekennzeichnet und ersetzen keine gemessenen Lastgänge. Aus fehlenden Daten werden weder Nullverbrauch noch Einsparungen oder gesicherte Ursachen abgeleitet.
