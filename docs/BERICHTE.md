# Berichte – Version 0.7

Unter „Berichte“ werden individuelle Vorlagen dauerhaft gespeichert. Den Kunden in der fixierten Kopfzeile wählen. Die Systemadministration kann Vorlagen anlegen, ändern und mit Begründung löschen; freigegebene Benutzer sehen passende Vorlagen.

Konfigurierbar sind Bezeichnung, gesamter Kunde oder Standort, optional Gebäude und Anlage, Medium, Beginn/Ende, die Inhalte Jahresbilanz, Ablesungen/Verbrauch, Maßnahmen/PDF-Nachweise, geplante Ausgabe PDF und/oder Excel sowie eigene Hinweise. Gebäude und Anlagen müssen innerhalb der ausgewählten Hierarchie liegen. Mindestens ein Inhalt und Ausgabeformat ist erforderlich. Gleichzeitige Änderungen werden als Konflikt erkannt.

Standortbeschränkte Benutzer sehen nur Vorlagen ihrer erlaubten Standorte. Kundenweite Vorlagen werden ihnen nur bei vollständiger Freigabe aller aktiven Standorte angezeigt. Kunden verschiedener Mandanten bleiben getrennt.

Diese Version speichert die Berichtskonfiguration. Die ausführliche PDF-Berichtserstellung, Excel-Auswertungsberichte und automatisierte Analyse hochgeladener PDFs folgen in einer späteren Ausbaustufe. Die bereits vorhandenen Excel-Ablesevorlagen bleiben im Zähleranlagenbaum nutzbar. Der Status in der Oberfläche benennt diesen Umfang ausdrücklich.

## Neutraler KI-Analyseprompt

Unterhalb der Berichtsvorlagen lässt sich per Button ein dynamischer Text aus den freigegebenen Verbrauchsdaten erstellen. Standort, Gebäude, Anlage, Medium und Zeitraum sind wählbar; eine gespeicherte Berichtsvorlage kann diese Filter vorbelegen. „Prompt kopieren“ übernimmt genau den Text in die Zwischenablage. Es wird kein KI-Dienst automatisch kontaktiert.

Der Text enthält neutrale Messstellen-/Standortbezeichnungen, erfasste Intervallmengen, einen Vergleich der letzten vollständigen Intervallmittel, Gesamtsummen ohne Doppelzählung und eine gekennzeichnete Monatsreihe. Namen, interne IDs, Zähler-/Gerätenummern, Adressen, Kontaktangaben, Kommentare, Maßnahmentexte und PDF-Inhalte werden nicht exportiert. Die Bezeichnungen gelten innerhalb des jeweiligen Datenabzugs. Filteränderungen entfernen die bisherige Ausgabe; anschließend erneut erzeugen.

Bis zu 36 Kalendermonate, 200 Messstellen und 50.000 Ablesungen im gewählten Zeitraum. Bei größeren Beständen den Zeitraum oder Anlagenbereich eingrenzen; Daten werden nicht stillschweigend abgeschnitten. [Fachliche Berechnung und Grenzen](VERBRAUCH-UND-KI-PROMPT.md).
