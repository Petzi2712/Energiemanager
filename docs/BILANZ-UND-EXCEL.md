# Theoretische Jahresbilanz und Excel-Ablesungen – Version 0.4

## Jahresbilanz im Kundenkataster

Im Kundenkataster einen Standort oder ein Gebäude öffnen. Die theoretische Jahresbilanz erscheint direkt in der Kundenakte. Grundlage sind aktive Anlagen und Verbraucher unter dem gewählten Knoten.

Bei der Aufnahme einer Anlage stehen zwei Datenwege zur Verfügung:

- Anzahl, elektrische Nenn-/Systemleistung, Jahresbetriebsstunden und Lastfaktor: Anzahl × Leistung in W / 1000 × Stunden × Lastfaktor ergibt eine elektrische Jahresenergie in kWh.
- „Vorgegebene Jahresmenge“: einen bekannten oder fachlich geschätzten Jahreswert mit Energieträger und Einheit eintragen. Er ersetzt die Leistungsschätzung dieses Eintrags. Das ist auch für Unteranlagen, Gebäude oder Standorte möglich.

MWh werden in kWh umgerechnet. Strom, Wärme, Gas, Wasser und sonstige Medien bleiben getrennt; m³ und Liter werden ohne dokumentierte Umrechnungsgrundlage nicht zu kWh addiert. Erzeuger werden separat ausgewiesen und nicht pauschal vom Verbrauch abgezogen. Kombinierte Anlagen ohne getrennte Eingangs-/Ausgangswerte erscheinen in einer eigenen Bilanz. Für ein BHKW mit getrennten Energieformen separate Ansätze unter einem Anlagenbereich anlegen.

Ein übergeordneter Jahres-Gesamtansatz ersetzt gleichartige Unterwerte desselben Mediums, derselben Einheit und Energierolle. So werden beispielsweise ein Anlagen-Gesamtwert und dessen Einzelverbraucher nicht doppelt addiert. Andere Medien bleiben zusätzlich sichtbar. Die Anzahl enthaltener Unterwerte wird angezeigt. Fehlende Hardwaredaten werden benannt; sie werden nicht als Nullverbrauch ausgegeben. Ein bewusst eingetragener Nullwert zählt dagegen als Angabe.

„Diagrammart“ wechselt zwischen Kreis, Ring und Balken. Die Aufschlüsselung ist nach Kategorie, Anlage/Verbraucher oder Gebäude wählbar. Die Wertetabelle enthält die Datenquellen. Die größten Verbrauchsanteile dienen als Ansatzpunkt für eine technische Prüfung. Das frei einstellbare Einsparszenario zeigt nur eine angenommene prozentuale Reduktion – keine gemessene oder nachgewiesene Einsparung. Es wird ausschließlich bei Verbrauch angezeigt.

Ansichten: [Desktop](screenshots/theorie-desktop.png) · [Smartphone](screenshots/theorie-smartphone.png).

## Excel-Vorlagen herunterladen

Im Zähleranlagenbaum gibt es zwei Zugänge:

1. Messstelle öffnen → „Excel-Vorlage / Import“ → „Excel-Vorlage herunterladen“.
2. „Excel-Massendownload / Import“ öffnen, Messstellen auswählen und als ZIP herunterladen. Jede Messstelle erhält ihre eigene XLSX-Datei. Dateinamen enthalten Messstellennummer und eine kurze eindeutige Kennung.

Eine Vorlage enthält Kunde, Standort, Messstelle, physisches Gerät, Einheit, Faktor, Standortzeitzone und Beginn der Geräteperiode. Diese Angaben sind geschützt. Ausschließlich die gelben Spalten **Datum/Uhrzeit** und **Zählerstand** sind zur Bearbeitung freigegeben. Pro Datei stehen 500 Eingabezeilen zur Verfügung; mehrere Ablesungen können gemeinsam erfasst werden. Zusätzliche Zeilen außerhalb des vorgesehenen Bereichs werden abgewiesen.

Der Excel-Blatt-/Arbeitsmappenschutz dient der Bedienung. Die tatsächliche Zuordnung wird zusätzlich serverseitig über eine kryptografisch geschützte Bindung an Kunde, Messstelle und Geräteperiode geprüft. Auch nach Entfernen des Blattschutzes werden veränderte feste Felder oder fremde Zählerzuordnungen nicht übernommen. Vorlagen müssen deshalb in der jeweiligen Installation erzeugt werden; Beispieldateien aus anderen Installationen sind nicht importierbar.

## Werte eintragen und zurückladen

- Die Datei in einer XLSX-fähigen Tabellenkalkulation öffnen. Format und beide ursprünglichen Arbeitsblätter beibehalten.
- Datum als Excel-Datum mit Uhrzeit oder `TT.MM.JJJJ hh:mm:ss` eintragen, in der angegebenen Standortzeitzone. Ein Datum ohne Uhrzeit bedeutet Mitternacht.
- Zählerstände als normale Zahlen eingeben. Keine Formeln verwenden. Der eingetragene Stand wird nicht mit dem Gerätefaktor multipliziert; die Software berücksichtigt den Faktor bei der Verbrauchsberechnung.
- Bei der doppelten Stunde der Winterzeit ist eine eindeutige Angabe erforderlich, etwa `2026-10-25T02:30:00+02:00`. Nicht existente Sommerzeit-Uhrzeiten werden abgewiesen. ISO-Texte mit explizitem Offset sind zulässig.
- Mehrere XLSX-Dateien auswählen oder die ausgefüllten Dateien in ein ZIP packen. Pro Upload maximal 100 Vorlagen, 5.000 ausgefüllte Zeilen und 6 MB Dateigröße insgesamt; ein ZIP darf maximal 20 MB XLSX-Dateien entpackt enthalten.
- „Dateien prüfen“ erstellt eine Vorschau. Sie zeigt neue, identische, fehlerhafte und ausdrücklich konfigurierte Grenzwertüberschreitungen. Es wird dabei noch nichts gespeichert.
- Fehler in den Dateien korrigieren und erneut prüfen. Warnungen aufgrund einer eingetragenen Tagesgrenze können nach Prüfung mit Begründung bestätigt werden.
- „Geprüfte Ablesungen importieren“ übernimmt den Stapel. Bei einem Fehler wird keine Teilmenge gespeichert. Wurden Dateien oder Messdaten nach der Vorschau verändert, muss die Vorschau neu erstellt werden. Sie gilt 30 Minuten.

Identische vorhandene Ablesungen werden übersprungen. Ein anderer Wert zum selben Zeitpunkt wird als Konflikt abgewiesen und muss über die nachvollziehbare Korrekturfunktion bearbeitet werden. Ablesungen dürfen ungeordnet in Excel stehen; die Prüfung verwendet ihre zeitliche Reihenfolge einschließlich vorhandener Vorgänger und Nachfolger. Fallende Werte, unzulässige Auflösungen, Zukunftszeiten, fehlende Standortrechte und fremde Geräteperioden werden abgewiesen. Ein Zählertausch oder Überlauf wird weiterhin gesondert dokumentiert.

Die automatische Warnung anhand des historischen Medians existiert nicht mehr. Ohne ausdrücklich gesetzte Tagesgrenze blockiert keine Verbrauchsspitzenwarnung den Import. Fachliche Grundprüfungen bleiben aktiv.

Normale Kundenbenutzer mit Schreibrechten dürfen eigene freigegebene Vorlagen importieren. Kundenleser dürfen herunterladen, aber keine Werte importieren. Jede importierte Ablesung wird mit Benutzer und Datei-/Zeilenbezug protokolliert.

## Bestand und Sicherung

Das Update ergänzt drei nullable bzw. vorbelegte Spalten an den Anlagenknoten. Vorhandene Benutzer, Messwerte, Geräte, Zuordnungen, Branding und Fahrzeuge bleiben erhalten. Neue Jahreswerte werden nicht erfunden.

Die Vorlagenbindung nutzt die persistenten Anwendungsschlüssel im `data_keys`-Volume. Bei regulären Container-Neubauten bleiben vorhandene Vorlagen verwendbar. Für Wiederherstellungen deshalb Datenbank **und Anwendungsschlüssel** sichern. Eine neu installierte, andere Datenbank kann Vorlagen aus der bisherigen Installation nicht allein anhand der sichtbaren Zählernummer übernehmen.
