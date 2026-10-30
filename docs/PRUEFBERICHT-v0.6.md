# Prüfbericht – Kataster, Maßnahmen und Berichte v0.6.0

Ausschließlich synthetische Testdaten. Vorheriger Stand: [Version 0.5](PRUEFBERICHT-v0.5.md).

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Publish, .NET SDK 10.0.403 | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich, auch im Web-Dockerimage |
| Gemeinsamer API-Lauf auf frischer Datenbank | **91 ausgeführt, 91 bestanden** |
| Gezielte neue API-Fälle | Alle neun erfolgreich |
| Gemeinsamer Browserlauf | **13 ausgeführt, 13 bestanden**, Desktop und Smartphoneansicht |
| Diagramm-/Jahresbilanz- und neue Browserabläufe nach letzter Diagrammanpassung | Vier erneut erfolgreich |
| Web-Containerimage 0.6.0 | Gebaut; HTML, CSP und Produktionsskript per HTTP geprüft |
| Upgrade einer 0.5-Bestandskopie | Alte Inhalte und Zeilenzahlen in elf Tabellen per Prüfsumme unverändert; neue Standardwerte korrekt, API 0.6.0 |
| Vorhandene Dokumente nach Migration | Alle bisherigen Dokumente besitzen Purpose=General und bleiben im allgemeinen Dokumentenbereich zugeordnet |
| EF-Modell gegen Migration | Keine ausstehenden Modelländerungen |
| NuGet inklusive transitiver Pakete / npm-Laufzeitpakete | Keine bekannten Sicherheitsmeldungen; gesperrter NuGet-Restore erfolgreich |
| Compose-Konfiguration / Shellsyntax / Patch-Whitespace | Erfolgreich geprüft |

Die neun neuen API-Fälle prüfen einzelne Katasterlöschungen mit Audit, Begründung, Version, verschwundenen Bilanzwerten und gesperrten Dokumenten. Untereinträge und Zählerhistorien verhindern unzulässige Löschungen. Die Bilanzübersicht wird mit mehreren Gebäuden, gleichen Gebäudenamen, getrennten Medien und eingeschränkten Standortrechten geprüft. Maßnahmenstatus und Freitext bleiben gespeichert; veraltete Versionen und unberechtigte Änderungen werden abgewiesen. Maßnahmen-PDFs sind vom allgemeinen Dokumentenbereich getrennt und können gelöscht werden; falsche Dateitypen und fremde Zugriffe werden abgewiesen. Kopien übernehmen keine dokumentierte Umsetzung. Berichtsvorlagen werden angelegt, geändert und gelöscht; Hierarchie, Datum, Medium, Formate, Rollen und Standortfilter werden geprüft.

Die Kategorie-/Verbraucher-Aufschlüsselung wurde anschließend zusätzlich in beiden neuen Browserabläufen erfolgreich geprüft.

Die beiden neuen Browserabläufe auf 1440 und 390 Pixel Breite verwenden einen eigenen Testkunden mit zwei Gebäuden. Sie prüfen Gesamt- und Gebäudekarten, Ring-Voreinstellung, nebeneinanderliegende Karten auf dem Desktop, Maßnahmenstatus, Freitext, echten PDF-Upload und erneutes Aufklappen. Ein Verbraucher wird über den Löschdialog entfernt; Gesamtverbrauch und Baum werden aktualisiert. Danach wird eine individuelle Berichtsvorlage über die Oberfläche angelegt und wieder aufgerufen. Navigation, Zahnrad am Seitenleistenfuß, Eingabehilfen, Seitenausnahmen und horizontale Überbreite werden geprüft.

Der Browserlauf zeigte einen Speicherfehler bei neuen Berichtsvorlagen: Die leere interne ID wurde im Formular mitgesendet. Nach Korrektur des Formularpayloads bestanden die neuen Abläufe und der gemeinsame Lauf. Bestehende Tests wurden auf exakte Feldnamen und das jeweils richtige Gebäudediagramm eingegrenzt, da Fragezeichen-Hilfen und mehrere Diagrammkarten dieselben Beschriftungen bzw. Werte enthalten können. Keine fachlichen Prüfungen wurden deaktiviert.

Die Migration wurde auf einer getrennten Kopie des synthetischen 0.5-Prüfbestands ausgeführt. Verglichen wurden alle alten Spalten in Customers, Users, Nodes, Points, Readings, Assignments, Devices, Installations, Documents, Branding und Vehicles. Der Ausgangsbestand blieb unverändert. Die neue Dokumentart wurde ausdrücklich mit General vorbelegt; bestehende Dateien werden dadurch nicht ausgeblendet.

Ansichten: [Gebäudebilanzen](screenshots/gebaeudebilanzen-v06.png) · [Berichte auf dem Smartphone](screenshots/berichte-smartphone-v06.png).

## Prüfgrenzen

ASP.NET Core und Vite liefen nativ, PostgreSQL und Mailpit in Docker, der offizielle Azurite-Emulator lokal. Das Web-Dockerimage wurde neu gebaut und per HTTP geprüft. Der vollständige Backend-Docker-Stack wurde in dieser Cloud nicht erneut gebaut; der bereits dokumentierte MCR-Image-Download ist durch den Cloud-Netzwerkfilter eingeschränkt. `scripts/test.sh` führt über Compose jetzt alle 91 API-Fälle aus.

Nicht geprüft sind der konkrete Benutzerrechner, physische Mobilgeräte, ARM, Produktivbetrieb oder Lasttests. Die Berichtsseite speichert individuelle Konfigurationen; ausführliche PDF-/Excel-Auswertungsberichte und automatische PDF-Analyse sind eine spätere Ausbaustufe. Maßnahmenstatus und Prozentwerte sind keine nachgewiesene Einsparung. Die Löschung besitzt keine Wiederherstellungsoberfläche; Datenbank, Dateien und Anwendungsschlüssel gemeinsam sichern.
