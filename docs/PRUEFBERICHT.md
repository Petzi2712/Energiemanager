# Prüfbericht – Jahresbilanz und Excel-Ablesungen v0.4.0

Ausschließlich synthetische Testdaten. Vorheriger Stand: [Version 0.3](PRUEFBERICHT-v0.3.md).

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Build / Publish, .NET 10.0.403 | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich |
| Web-Containerimage | Gebaut; HTML, CSP und Produktionsskript mit Jahresbilanz/Excel v0.4.0 per HTTP geprüft |
| API-Prüfungen | Alle **72 definierten Testfälle bestanden**: gemeinsamer Lauf mit 71 Fällen, zusätzlicher Kundenbenutzer-Rundlauf erfolgreich |
| Betroffene Prüfungen nach letzter Anpassung | 19 Excel-/Bilanz-/Grenzwertprüfungen erneut erfolgreich; Kundenbenutzer-Import zusätzlich erfolgreich |
| Gemeinsame Browserprüfung | **9 ausgeführt, 9 bestanden**, Desktop und Smartphoneansicht |
| Neue Browserabläufe gegen endgültigen Release-Build | Beide erneut erfolgreich |
| Unabhängiger XLSX-Rundlauf mit openpyxl 3.1.5 | Geschützte/entsperrte Zellen, geschützte Struktur, sehr verborgenes Zuordnungsblatt und echte Excel-Datumszellen geprüft; Datei erneut importiert |
| Vorlagenpersistenz | Vor dem API-Neustart erzeugte Vorlage nach Neustart mit denselben Schlüsseln erfolgreich importiert |
| Upgrade einer 0.3-Bestandskopie | Alte Spalten und Zeilenzahlen in elf Tabellen anhand Prüfsummen unverändert; API meldet 0.4.0 |
| EF-Modell gegen Migration | Keine ausstehenden Modelländerungen |
| NuGet inkl. transitiver Pakete / npm-Laufzeitpakete | Keine bekannten Sicherheitsmeldungen |
| Compose-Konfiguration / Shellsyntax / Patch-Whitespace | Erfolgreich geprüft |

Die neuen 14 Excel-Tests prüfen echte XLSX-Dateien über HTTP: Blatt-/Arbeitsmappenschutz, nur freigegebene Datum-/Zählerstandszellen, signierte Zählerzuordnung, Einzel- und ZIP-Export, mehrere ungeordnete Ablesungen, Mehrdatei-/ZIP-Upload, Vorschau ohne Speicherung, atomare Übernahme, identische Wiederholungen ohne Duplikate, Konflikte und fallende Werte, manipulierte feste Felder, Formeln, fremde Eingabefelder/Zeilen, geänderte Dateien und Vorschauversionen, Pflichtbestätigung ausdrücklich gesetzter Tagesgrenzen, Wegfall der Medianwarnung, Leserrechte, fehlende Vorschautokens, doppelte Winterzeit mit eindeutigem Offset, Geräteperioden nach Zählertausch und den vollständigen Export-/Importweg als normaler Kundenbenutzer.

Fünf Jahresbilanz-Tests prüfen Gebäude-/Standortsummen, die 7.200-kWh-Leistungsschätzung, MWh/kWh-Normalisierung, getrennte Erzeugung, Schutz vor doppelter Summierung übergeordneter Gesamtansätze, getrennte Medien/Volumina, deaktivierte und fehlende Werte, bewusste Nullwerte, Standort-/Kundenrechte und negative Eingaben.

Die beiden neuen Browserabläufe auf 1440 und 390 Pixel Breite wechseln Kreis-, Ring- und Balkendiagramme, prüfen die Jahresbilanz, erfassen einen Jahreswert über das Formular, laden eine echte Einzelvorlage und ein ZIP herunter, füllen diese mit mehreren Werten und importieren sie über Vorschau und Bestätigung wieder. Seitenfehler und horizontale Überbreite werden geprüft. Die bisherigen sieben Browserabläufe bestehen weiterhin.

Bei einem frühen Lauf fehlte der nach dem Umgebungswechsel gestoppte Azurite-Prozess. Nach dessen Start bestanden die beiden betroffenen Fotoprüfungen sowie der anschließende gemeinsame API-Lauf. Es wurden keine Fachprüfungen abgeschaltet.

## Prüfgrenzen

ASP.NET Core und Vite liefen nativ, PostgreSQL und Mailpit in Docker, der offizielle Azurite-Emulator lokal. Der gesamte Backend-Docker-Stack wurde in dieser Cloud nicht neu funktional geprüft; der zuvor dokumentierte MCR-Image-Download war durch den Cloud-Netzwerkfilter eingeschränkt. Der Docker-Standard für den Benutzerrechner bleibt erhalten; `scripts/test.sh` verwendet jetzt alle 72 API-Fälle.

Microsoft Excel Desktop und LibreOffice wurden hier nicht per GUI bedient. Das XLSX-Format wurde strukturell, durch die Anwendung und mit einem unabhängigen Leser/Schreiber geprüft. Nicht geprüft sind der konkrete Benutzerrechner, physische Mobilgeräte, ARM, Produktivbetrieb, Lasttests oder eine automatische Anbindung externer Importquellen.

Theoretische Jahreswerte und frei gewählte Einsparszenarien sind keine gemessenen Lastgänge oder nachgewiesenen Einsparungen. XLSX-Vorlagen werden je Installation signiert; Schlüssel und Datenbank müssen zusammen gesichert werden.
