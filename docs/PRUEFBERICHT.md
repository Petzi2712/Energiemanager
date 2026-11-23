# Prüfbericht – Version 0.8.0

Prüfung vom 23.11.2026 mit ausschließlich synthetischen Daten. Vorheriger Stand: [Version 0.7](PRUEFBERICHT-v0.7.md). Bedienung und Berechnungsgrenzen: [Version 0.8](VERSION-0.8.md).

| Prüfung | Ergebnis |
| --- | --- |
| Gemeinsamer API-Lauf auf frischer PostgreSQL-Datenbank | **121 ausgeführt, 121 bestanden**, einschließlich 19 neuer 0.8-Fälle |
| Gemeinsamer Browserlauf am endgültigen Web-Dockerimage | **17 ausgeführt, 17 bestanden**, Desktop 1440 und Smartphone 390 Pixel, Europe/Berlin |
| .NET Debug-Build und Release-Publish, SDK 10.0.403 | Erfolgreich; keine Warnungen oder Fehler; Schrift und Lizenz im Publish enthalten |
| TypeScript-/Vite-Produktionsbuild | Erfolgreich, auch im endgültigen Web-Dockerimage |
| PDF unabhängig geöffnet | PDFsharp 6.2.4; A4, zwei Testseiten, eingebettete Schrift, Unicode, Diagramm, Seitenzahlen; Text mit `pdftotext` geprüft und Seite gerendert |
| Excel unabhängig geöffnet | Mit openpyxl geöffnet; zwölf Tabellen, Vergleich 400/200 kWh, Zwischenintervalle, keine aus Benutzereingaben erzeugten Formeln |
| Archivierung und Freigabe | Bytes und Datenstand bleiben nach Messwertkorrektur unverändert; neue Erstellung erhält neue Nummer und Daten; Freigabe kopiert dieselben Quelldaten in eine weitere Version |
| Rechteprüfung | Kunden-/Standortgrenzen, entzogene Freigaben, fremde Vorlagen und Formate sowie Nur-Lese-Zugänge geprüft |
| Bestandsmigration | Isolierte Kopie mit 0.7-Schema aktualisiert; alte Spalten und Zeilenzahlen in **19 Bestandstabellen** per Prüfsumme unverändert; neue historische Herkunft `Unknown` |
| Echter Hintergrunddienst nach API-Neustart | Fälliger gespeicherter Termin automatisch geplant, eine SMTP-Annahme, eine persistente Folgeerinnerung, nächster Termin fortgeschrieben |
| Unterbrochener Versand und zweiter Neustart | Abgelaufener `Sending`-Auftrag wird `Unclear`, kein neuer Versand; bestehende SMTP-Annahme erhalten; manuelle Klärung mit Audit erfolgreich |
| Kontrollierter lokaler SMTP-Test | 450 → Retry, Retry, Failed bei drei Versuchen; 550 → Failed; Verbindungsabbruch → Unclear ohne automatische Wiederholung |
| Web-Container per HTTP | HTML, CSP, endgültiges 0.8.0-Skript und Proxy zur nativen 0.8.0-API erfolgreich |
| EF-Modell / Sperrdateien / Sicherheitsmeldungen | Keine ausstehenden Modelländerungen; gesperrter NuGet-Restore erfolgreich; keine bekannten Meldungen für NuGet inklusive transitiver Pakete und npm-Laufzeitpakete |
| Compose / Shellsyntax / Patch-Whitespace | Erfolgreich geprüft |

## Fachliche und technische Testfälle

Die neuen API-Fälle prüfen Faktoren und historische Haupt-/Unterzählerperioden, getrennte Medien und Einheiten, dokumentierte Bezugsgrößen, Vergleichsprozente, Monatsrandinterpolation, unbekannte Teilzeiträume, echte Nullwerte und Kalenderdauer bei Sommerzeitwechsel. Große zulässige Registerwerte mit Gerätefaktor dürfen keinen Zwischenüberlauf in der Intervallrechnung verursachen. Unzulässige Datumsbereiche, Medien, winzige oder fehlende Bezugsgrößenquellen werden abgewiesen.

Datenqualität und Herkunft werden getrennt geprüft. Ohne konfigurierte Tagesgrenze entstehen keine neuen Verbrauchsspitzenwarnungen. Prüfvermerke gelten je Messwertversion; eine Korrektur über der Grenze öffnet die Prüfung erneut und kann wiederum bestätigt werden. Historische Werte einer stillgelegten Messstelle bleiben prüfbar. Fehlende Austauschstände erzeugen Lücken und Hinweise statt erfundener Differenzen.

Die Berichtstests prüfen Dateisignaturen und numerische Excel-Zellen, Hash des JSON-Datenstands, unveränderte Dateien nach Korrektur, neue Versionen, parallele Erstellung mit Konfliktbehandlung, einmalige Freigabe, ausgewählte Ausgabeformate, Theorie, Maßnahmen, Logo, spätere Brandingänderungen und den Abruf nach Vorlagenlöschung. Ursprüngliche PDF-Nachweise werden als Verzeichnis aufgeführt, nicht eingebettet oder automatisch ausgewertet.

Die Versandtests prüfen in Mailpit die tatsächliche Nachricht und den geschützten Portallink, Wiederholung der Planung ohne doppelte Aufträge, Folgefristen, entzogene Standortrechte, inzwischen eingegangene Ablesungen und den Audit-Eintrag. Neustart- und SMTP-Fehlerprüfungen wurden zusätzlich mit kontrollierten Zuständen auf einer isolierten Testdatenbank ausgeführt. Es wurde keine echte externe E-Mail versendet. Eine SMTP-Annahme ist keine Zustellbestätigung; unklare Versände benötigen eine dokumentierte Entscheidung.

Der Gesamtlauf respektiert die unveränderte Login-Ratenbegrenzung. Die neuen Testclients warten bei deren HTTP-429-Antwort, statt den Schutz für den Test abzuschalten. API-Tests steuern die Versandwarteschlange mit deaktiviertem Hintergrunddienst deterministisch; dessen automatischer Betrieb wurde separat nachgewiesen.

Die beiden neuen Browserabläufe prüfen frei gewählte Vergleichszeiträume und Bezugsgrößen, 400/200 kWh mit Faktor, responsive Monatsbalken ohne Seitenüberlauf, Qualitätskacheln, echte PDF-/Excel-Downloads, archivierte Vorschau, Freigabeversionen und die Erinnerungskonfiguration inklusive Mailpit-Verarbeitung. Der mobile Versandtabellenüberlauf wurde behoben. Bestehende Importtests prüfen ihre Erfolgsmeldung jetzt innerhalb des Dialogs, damit gleichzeitige Hintergrund-Lademeldungen keinen mehrdeutigen Selektor erzeugen. Keine fachliche Prüfung wurde deaktiviert.

## Grenzen des Cloud-Nachweises

Der vollständige Backend-Dockerbuild wurde versucht. Der Cloud-Netzfilter verweigert den Download der .NET-SDK-Image-Schichten von `westus.data.mcr.microsoft.com`. Daher ist der komplette Compose-Stack hier **nicht als erfolgreich gebaut bestätigt**. PostgreSQL und Mailpit laufen als echte Dockercontainer; API und Azurite wurden nativ betrieben. Das endgültige Web-Dockerimage wurde mit aktiviertem TLS und dem Cloud-Proxy-Zertifikat gebaut und per HTTP gegen die native API geprüft.

Ein Cloud-Neustart unterbrach einen Zwischenlauf. Dateien, Dockerdaten und frühere Prüfergebnisse blieben erhalten. Die lokalen Prozesse wurden neu gestartet; der abschließende gemeinsame API-Lauf wurde auf einer weiteren frischen Datenbank vollständig wiederholt. Der lokale Rechner des Nutzers wurde dadurch nicht verändert. Die Software bleibt für lokalen Entwicklungsbetrieb freigegeben; öffentliche Produktivfreigabe und echtes SMTP sind ein späterer Meilenstein.
