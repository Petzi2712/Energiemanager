# Theoretische Jahresbilanz und Ableseimport – Version 0.6

## Jahresbilanz im Kundenkataster

Im Kundenkataster einen Standort oder ein Gebäude öffnen. Die theoretische Jahresbilanz erscheint direkt in der Kundenakte. Grundlage sind aktive Anlagen und Verbraucher unter dem gewählten Knoten.

Bei der Aufnahme einer Anlage stehen zwei Datenwege zur Verfügung:

- Anzahl, elektrische Nenn-/Systemleistung, Jahresbetriebsstunden und Lastfaktor: Anzahl × Leistung in W / 1000 × Stunden × Lastfaktor ergibt eine elektrische Jahresenergie in kWh.
- „Vorgegebene Jahresmenge“: einen bekannten oder fachlich geschätzten Jahreswert mit Energieträger und Einheit eintragen. Er ersetzt die Leistungsschätzung dieses Eintrags. Das ist auch für Unteranlagen, Gebäude oder Standorte möglich.

MWh werden in kWh umgerechnet. Strom, Wärme, Gas, Wasser und sonstige Medien bleiben getrennt; m³ und Liter werden ohne dokumentierte Umrechnungsgrundlage nicht zu kWh addiert. Erzeuger werden separat ausgewiesen und nicht pauschal vom Verbrauch abgezogen. Kombinierte Anlagen ohne getrennte Eingangs-/Ausgangswerte erscheinen in einer eigenen Bilanz. Für ein BHKW mit getrennten Energieformen separate Ansätze unter einem Anlagenbereich anlegen.

Ein übergeordneter Jahres-Gesamtansatz ersetzt gleichartige Unterwerte desselben Mediums, derselben Einheit und Energierolle. So werden ein Anlagen-Gesamtwert und dessen Einzelverbraucher nicht doppelt addiert. Andere Medien bleiben zusätzlich sichtbar. Die Anzahl enthaltener Unterwerte wird angezeigt. Fehlende Hardwaredaten werden benannt; sie werden nicht als Nullverbrauch ausgegeben. Ein bewusst eingetragener Nullwert zählt dagegen als Angabe.

Gesamtverbrauch aller freigegebenen Standorte und jedes aktive Gebäude werden gemeinsam angezeigt. Auf großen Bildschirmen stehen die Karten nebeneinander und umbrechen bei Platzmangel. Ohne passende Jahreswerte erscheint ein Hinweis. Der ausgewählte Standort bzw. das Gebäude steuert die Komponententabelle; die Diagrammübersicht bleibt kundenweit. Standard ist das Ringdiagramm.

„Diagrammart“ wechselt zwischen Kreis, Ring und Balken. Die Aufschlüsselung ist nach Kategorie, Anlage/Verbraucher oder Gebäude wählbar. Die Wertetabelle enthält die Datenquellen.

## Einsparung je Komponente

Unter der Verbrauchsbilanz die gewünschten Komponenten ankreuzen. Für jeden berücksichtigten Ansatz lässt sich eine eigene angenommene Einsparung von 0 bis 100 Prozent erfassen. Beispielsweise ergeben 10 % von 1.000 kWh und 25 % von 2.000 kWh insgesamt 600 kWh/Jahr angenommene Ersparnis. Abgewählte Komponenten tragen keine Einsparung bei.

Die Systemadministration speichert die Prozentwerte über „Einsparannahmen speichern“. Sie sind auch im Katasterformular als „Angenommene Einsparung (%)“ bearbeitbar und bleiben nach einem Neustart erhalten. Gleichzeitige Änderungen werden als Konflikt gemeldet. Die Auswahl der Komponenten und der Diagrammzustand gehören nur zur aktuellen Ansicht. Leser können Komponenten mit ihren gespeicherten Annahmen vergleichen.

„Diagramm mit angenommener Einsparung anzeigen“ zeigt die verbleibende Jahresmenge. Der ursprüngliche Gesamtwert bleibt als Ausgangsbilanz ausgewiesen. Es werden nur die tatsächlich in der Bilanz enthaltenen Ansätze angeboten; durch einen Gesamtansatz abgedeckte Unterwerte erscheinen dort nicht zusätzlich. Einsparszenarien sind Planungsannahmen und keine gemessenen oder nachgewiesenen Einsparungen.

Die Spalte „Maßnahme umgesetzt“ dokumentiert die tatsächliche Umsetzung. Aufklappen ermöglicht Freitext und private PDF-Nachweise. Status und Text ausdrücklich speichern. Der Status verändert weder Ausgangsverbrauch noch die fachliche Einstufung der Prozentannahmen.

## Vorlagen herunterladen

Im Zähleranlagenbaum gibt es zwei Zugänge:

1. Messstelle öffnen → „Excel-Vorlage / Import“ → Format wählen und Vorlage herunterladen.
2. „Excel-Massendownload / Import“ öffnen, Messstellen und Format wählen und als ZIP herunterladen. Jede Messstelle erhält ihre eigene XLSX- oder CSV-Datei. Dateinamen enthalten die ID Messstelle und eine kurze eindeutige Kennung.

Eine XLSX-Vorlage enthält Kunde, Standort, Messstelle, physisches Gerät, Einheit, Faktor, Standortzeitzone und Beginn der Geräteperiode. Ausschließlich die gelben Spalten **Datum/Uhrzeit** und **Zählerstand** sind zur Bearbeitung freigegeben. Pro Datei stehen 500 Eingabezeilen zur Verfügung. Zusätzliche Zeilen außerhalb des vorgesehenen Bereichs werden abgewiesen.

Der Excel-Blatt-/Arbeitsmappenschutz unterstützt die Bedienung. Die tatsächliche Zuordnung wird zusätzlich serverseitig über eine kryptografisch geschützte Bindung an Kunde, Messstelle und Geräteperiode geprüft. Auch nach Entfernen des Blattschutzes werden veränderte feste Felder oder fremde Zählerzuordnungen nicht übernommen. Vorlagen müssen in der jeweiligen Installation erzeugt werden; Dateien aus einer anderen Installation sind nicht allein anhand der sichtbaren ID importierbar.

## XLSX und XLSM ausfüllen

- Datei in einer Tabellenkalkulation öffnen. Format und beide ursprünglichen Arbeitsblätter beibehalten. Eine als XLSM gespeicherte Vorlage wird ebenfalls angenommen; Makrobestandteile werden vor dem Einlesen entfernt. Makros werden weder ausgeführt noch auf dem Server gespeichert.
- Datum als Excel-Datum mit Uhrzeit oder `TT.MM.JJJJ hh:mm:ss` eintragen, in der angegebenen Standortzeitzone. Ein Datum ohne Uhrzeit bedeutet Mitternacht.
- Zählerstände als normale Zahlen eingeben. Keine Formeln verwenden. Der Gerätefaktor wird erst bei der Verbrauchsberechnung berücksichtigt.
- Bei der doppelten Stunde der Winterzeit ist eine eindeutige Angabe erforderlich, etwa `2026-10-25T02:30:00+02:00`. Nicht existente Sommerzeit-Uhrzeiten werden abgewiesen. ISO-Texte mit explizitem Offset sind zulässig.

## CSV verwenden

Eine heruntergeladene CSV-Vorlage enthält eine signierte Zuordnung und feste Metadaten. Diese Zeilen unverändert lassen und unter `Datum;Zählerstand` Ablesungen ergänzen. CSV unterstützt keinen Blattschutz: Die Metadaten sind technisch editierbar, Änderungen werden beim Import aber abgewiesen.

Eigene CSV-Dateien brauchen eine Kopfzeile mit `Datum` und `Zählerstand`. Ohne ID-Spalte im Importdialog die Messstelle ausdrücklich auswählen; beim Einzelimport ist die geöffnete Messstelle vorbelegt. Für Stapeldateien die Spalte `ID Messstelle` verwenden. Die ID muss zu einer vorhandenen, freigegebenen Messstelle des gewählten Kunden gehören. CSV erzeugt keine neuen Messstellen.

```csv
Datum;Zählerstand;ID Messstelle
15.10.2026 08:00:00;12345,6;STROM-001
16.10.2026 08:00:00;12401,2;STROM-001
```

Semikolon, Komma und Tabulator sowie UTF-8, UTF-16 und Latin-1 werden unterstützt. Bei Komma als Trennzeichen Dezimalkommas in Anführungszeichen setzen. Die Zeilen müssen dieselbe Spaltenzahl wie die Kopfzeile besitzen. Optional sind getrennte `Datum`-/`Uhrzeit`-Spalten sowie `Einheit` möglich; die Einheit muss zur Messstelle passen. Zeiten ohne Offset gelten in der Standortzeitzone. Ein über „Speichern unter CSV“ exportiertes Ableseblatt kann ebenfalls anhand seiner festen Messstellen-/Geräteangaben gelesen werden.

## Vorschau und Stapelimport

Mehrere XLSX-, XLSM- und CSV-Dateien auswählen oder gemischt in ein ZIP packen. Maximal 100 Dateien, 5.000 ausgefüllte Zeilen und 6 MB Upload insgesamt; ein ZIP darf maximal 20 MB Dateien entpackt enthalten. Verschachtelte ZIPs und externe Arbeitsmappenverknüpfungen sind nicht zulässig.

„Dateien prüfen“ erstellt eine Vorschau mit neuen, identischen, fehlerhaften und grenzwertüberschreitenden Werten. Es wird noch nichts gespeichert. Fehler korrigieren und erneut prüfen. Warnungen aufgrund einer ausdrücklich eingetragenen Tagesgrenze können mit Begründung bestätigt werden. Ohne gesetzte Tagesgrenze gibt es keine historische Medianwarnung.

„Geprüfte Ablesungen importieren“ übernimmt den gesamten Stapel in einer Transaktion. Bei Fehlern wird keine Teilmenge gespeichert. Ändern sich Dateien, CSV-Zuordnung oder Messdaten nach der Vorschau, muss erneut geprüft werden. Die Vorschau gilt 30 Minuten.

Identische vorhandene Ablesungen werden übersprungen. Ein anderer Wert zum selben Zeitpunkt wird als Konflikt abgewiesen und muss über die Korrekturfunktion bearbeitet werden. Ungeordnete Zeilen werden chronologisch geprüft, einschließlich vorhandener Vorgänger und Nachfolger. Fallende Werte, unzulässige Auflösungen, Zukunftszeiten, fehlende Standortrechte und fremde Geräteperioden werden abgewiesen. Ein Zählertausch oder Überlauf wird weiterhin gesondert dokumentiert.

Normale Kundenbenutzer mit Schreibrechten dürfen freigegebene Messstellen importieren. Kundenleser dürfen herunterladen, aber keine Werte importieren. Jede importierte Ablesung wird mit Benutzer und Datei-/Zeilenbezug protokolliert.

## Bestand und Sicherung

Version 0.5 ergänzt die Spalte für die Einsparannahme mit dem Startwert 0 %. Die Umbenennung der ID-Felder betrifft die Oberfläche. Bestehende Benutzer, IDs, Messwerte und Verknüpfungen bleiben erhalten.

Die Vorlagenbindung nutzt die persistenten Anwendungsschlüssel im `data_keys`-Volume. Bei regulären Container-Neubauten bleiben bereits erzeugte Vorlagen verwendbar. Datenbank **und Anwendungsschlüssel** zusammen sichern. Für das Update weder Volumes löschen noch den bisherigen Compose-Projektnamen wechseln.
