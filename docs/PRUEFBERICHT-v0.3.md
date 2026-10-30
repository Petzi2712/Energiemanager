# Prüfbericht – Anlagen, Zähler und Fuhrpark v0.3.0

Die Prüfungen verwenden ausschließlich synthetische Daten. Der vorherige Prüfstand bleibt in [PRUEFBERICHT-v0.2.md](PRUEFBERICHT-v0.2.md) erhalten.

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Build und Publish (.NET 10.0.403) | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich |
| Web-Containerimage | Erfolgreich gebaut; HTML, Produktionsskript v0.3.0, Branding und CSP per HTTP geprüft |
| Gemeinsamer API-Lauf auf frischer PostgreSQL-Datenbank | **53 ausgeführt, 53 bestanden**, keine übersprungenen Tests |
| Gemeinsame Browserprüfung | **7 ausgeführt, 7 bestanden**, 1440 und 390 Pixel breite Ansichten |
| Update einer mit echter Version 0.2 initialisierten Datenbank | Erfolgreich; alle alten Spalten und Zeilenzahlen in neun Tabellen per Prüfsumme identisch |
| Neue Schemaergänzungen | Bestehende Hardware erhält die Verbrauchsrolle; Branding wird initialisiert; drei Migrationen angewendet |
| Foto- und Logo-Uploads | Tatsächliche Decodierung, Normalisierung, privater Fotodownload bzw. öffentliches Anmeldelogo geprüft |
| npm-Laufzeitpakete und NuGet-Pakete inkl. transitiver Abhängigkeiten | Keine bekannten Schwachstellen gemeldet |
| Compose-Konfiguration, Shellsyntax und Patch-Whitespace | Erfolgreich geprüft |

Die 17 neuen Integrationstests prüfen öffentliches Branding und administrative Schreibrechte, Leitspruchvalidierung und Änderungskonflikte, echten Logo-Upload und Rücksetzung, benutzerbezogene Darkmodus-Persistenz, Fuhrparkanlage/-änderung/-löschung mit Fremdstandort- und Rechteprüfung, Versionskonflikte und Löschprotokolle, Zählerlöschung mit Erhalt der historischen Ablesungen, Löschschutz bei Unterzählern, Dokumentlöschung und sofortigen Entzug des Downloads, automatische 30-Tage-Vorgaben, fehlende Messintervalle ohne Extrapolation, zeitanteilige Verteilung und Gerätefaktoren, Erhalt der Energiesumme über die Gruppierungen, direkte Unterzähler ohne Enkel-Doppelzählung, Gerätewechsel mit vollständigen und fehlenden Austauschständen, 23-/25-Stunden-Tage, zeitlich gültige Hierarchieänderungen, ungültige Zeiträume, Erzeugungsanlagen, Dashboard-Kundenauswahl, historische Standortfreigaben einschließlich Schutz der Nachbarablesungen sowie die frühere Bilanz eines inzwischen gelöschten Unterzählers.

Die sieben Browserabläufe prüfen die bisherigen Kunden-/Erstanmeldungs- und technischen Abläufe sowie die neuen Funktionen auf Desktop und Smartphoneansicht: Darkmodus aktivieren und nach Neuladen prüfen, Leitspruch ändern und am Login anzeigen, Logo hochladen und Standardlogo wiederherstellen, Hardware als PV-Erzeuger erfassen, technische Fotos hochladen und löschen, Fahrzeug anlegen und löschen, automatische Diagramme und Zeitgruppierung, Kopfzeile und Kundenauswahl beim Scrollen, echte native Drag-and-drop-Zuordnung und protokolliertes Zählerlöschen. Zusätzlich werden JavaScript-Seitenfehler und horizontale Überbreite geprüft.

Ein anfänglicher Browserfehler bei der verzögerten Darkmodus-Rückmeldung wurde durch unmittelbare Umschaltung mit Rücksetzung bei Speicherfehler behoben. Die Logoauswahl bleibt beim Speichern anderer Branding-Einstellungen erhalten. Die anschließenden gemeinsamen Browser- und API-Läufe bestanden vollständig.

Die Upgradeprüfung verwendete eine separat mit dem unveränderten Commit `4156ec7` aufgebaute und befüllte 0.2-Datenbank. Danach wurde die neue API mit automatischer Migration gestartet. Prüfsummen der alten Inhalte von Kunden, Benutzern, Knoten, Messstellen, Ablesungen, Zuordnungen, Geräten, Installationen und Dokumenten blieben identisch. Die neue Hardware-Rolle wurde korrekt ergänzt. Es wurden keine technischen Demo-Daten in den Bestand eingefügt.

Ansichten: [Desktop](screenshots/verbrauch-dark-desktop.png) · [Smartphone](screenshots/verbrauch-dark-smartphone.png).

## Prüfgrenzen

Die fachlichen Prüfungen liefen mit nativer ASP.NET-Core-/Vite-Ausführung, PostgreSQL 17 und Mailpit in Docker sowie dem offiziellen Azurite-Emulator 3.35.0 mit echtem Blob-Zugriff.

Der vollständige Backend-Containerbetrieb konnte in dieser Cloud nicht erneut geprüft werden: Der erneute Abruf von `mcr.microsoft.com/dotnet/aspnet:10.0.14` scheiterte beim Image-Download mit `Forbidden` am Cloud-Netzwerkfilter. Diese Einschränkung betrifft die Testumgebung; sie belegt keinen Fehler des lokalen Docker-Rechners. Die enthaltenen Dockerdateien und der gesonderte Compose-Testlauf sind für einen Rechner mit Registry-Zugriff vorgesehen. Es wurden keine Netzwerk- oder TLS-Prüfungen umgangen.

Nicht geprüft sind der konkrete Windows-/Docker-Rechner des Benutzers nach diesem Update, physische Smartphones, ARM, Azure-Deployment, Lasttests und Produktivbetrieb. Fuhrpark-Tank-/Ladedaten, Berichte, Tarife, PDCA und KI bleiben weitere Ausbaustufen. Zeitanteilige Diagrammwerte sind keine gemessenen Tageslastgänge; fehlende Rand-/Austauschstände bleiben Datenlücken.
