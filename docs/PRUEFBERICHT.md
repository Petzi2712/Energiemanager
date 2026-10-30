# Prüfbericht – Komponenten, Import und Historie v0.5.0

Ausschließlich synthetische Testdaten. Vorheriger Stand: [Version 0.4](PRUEFBERICHT-v0.4.md).

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Publish, .NET SDK 10.0.403 | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich, auch im Web-Dockerimage |
| Gemeinsamer API-Lauf auf frischer Datenbank | **82 ausgeführt, 82 bestanden** |
| Gezielte neue API-Prüfung | Alle zehn neuen Fälle erfolgreich |
| Gemeinsamer Browserlauf | **11 ausgeführt, 11 bestanden**, Desktop und Smartphoneansicht |
| Neue Browserabläufe | Beide auch einzeln erfolgreich, 1440 und 390 Pixel, Browserzeitzone Europe/Berlin |
| Web-Containerimage 0.5.0 | Gebaut; HTML, CSP und Produktionsskript mit neuen Funktionen per HTTP geprüft |
| Upgrade einer 0.4-Bestandskopie | Alte Inhalte und Zeilenzahlen in elf Tabellen per Prüfsumme unverändert; Einsparannahmen 0 %, API 0.5.0 |
| EF-Modell gegen Migration | Keine ausstehenden Modelländerungen |
| NuGet mit transitiven Paketen / npm-Laufzeitpakete | Keine bekannten Sicherheitsmeldungen; gesperrter NuGet-Restore erfolgreich |
| Compose-Konfiguration / Shellsyntax / Patch-Whitespace | Erfolgreich geprüft |

Die zehn neuen API-Fälle prüfen eigene CSVs mit ausdrücklich gewählter Messstelle, Schutz gegen Zuordnungswechsel nach der Vorschau, ID-Spalten, Trennzeichen und Zeichensätze, signierte CSV-Vorlagen und veränderte Metadaten, getrennte Datum-/Uhrzeitspalten, Einheiten und fehlerhafte Spaltenzahlen. Dazu kommen XLSM mit Macro-Content-Type, VBA-Beziehung und inertem VBA-Testteil, ein gemischter XLSM-/CSV-Stapel, gespeicherte komponentenweise Einsparprozente mit Rollen-, Bereichs- und Versionsprüfung sowie atomare Teilbaumkopien ohne Übernahme von Messstellenverweisen. Die Historie wird mit 33 Ablesungen über drei Seiten und einem begrenzten Zeitraum geprüft, einschließlich der Verbrauchsdifferenz über Seiten-/Filtergrenzen hinweg.

Die beiden neuen Browserabläufe legen Anlagen und Verbraucher an, kopieren einen Teilbaum und prüfen die neuen ID-Feldnamen. Sie setzen unterschiedliche Einsparprozente, wählen Komponenten einzeln aus und speichern die Annahmen. Die kompakte Historie zeigt 15/15/2 Zeilen, lädt ein Ablesefoto erst beim Aufklappen und filtert einen frei gewählten Zeitraum einschließlich der letzten Sekunde. Für „Verbrauch und Unterzählerbilanz“ werden Beginn vor Ende, genau 30 Tage Abstand und getrennte Feldnamen geprüft. Anschließend wird eine echte CSV über Vorschau und Bestätigung importiert. Seitenfehler und horizontale Überbreite werden geprüft. Die bisherigen neun Browserabläufe bestehen weiterhin.

Beim XLSM-Test wurde zunächst ein Lesefehler durch XML-Namespacepräfixe sichtbar. Die Paketkonvertierung normalisiert die Paketwurzeln; anschließend bestanden der gezielte und der gemeinsame Lauf. Beim Historienfilter wird die gesamte ausgewählte Endsekunde berücksichtigt, damit Ablesungen mit Sekundenbruchteilen enthalten sind.

Die Migration wurde ausschließlich auf einer separaten Kopie des synthetischen 0.4-Prüfbestands ausgeführt. Verglichen wurden alte Spalten in Customers, Users, Nodes, Points, Readings, Assignments, Devices, Installations, Documents, Branding und Vehicles. Der Ausgangsbestand wurde nicht verändert.

Ansicht: [Kompakte Ablesehistorie](screenshots/historie-kompakt-v05.png).

## Prüfgrenzen

ASP.NET Core und Vite liefen nativ, PostgreSQL und Mailpit in Docker, der offizielle Azurite-Emulator lokal. Das Web-Dockerimage wurde neu gebaut und per HTTP geprüft. Der vollständige Backend-Docker-Stack wurde in dieser Cloud nicht erneut gebaut; der bereits dokumentierte MCR-Image-Download ist durch den Cloud-Netzwerkfilter eingeschränkt. `scripts/test.sh` verwendet über Compose jetzt alle 82 API-Fälle.

Microsoft Excel Desktop und LibreOffice wurden hier nicht per GUI bedient. Die XLSM-Prüfung verwendet ein paketgetreues Testdokument mit inertem VBA-Teil; VBA wird nicht ausgeführt. Nicht geprüft sind der konkrete Benutzerrechner, physische Mobilgeräte, ARM, Produktivbetrieb, Lasttests oder automatische Importquellen.

Einsparprozente sind Planungsannahmen. CSV bietet keinen Blattschutz; signierte Metadaten werden beim Import geprüft. Datenbank und Anwendungsschlüssel müssen gemeinsam gesichert werden.
