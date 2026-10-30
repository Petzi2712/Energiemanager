# Jahresverbrauch und neutraler KI-Prompt – Version 0.7

## Tatsächliche Jahresmengen

„Aktueller Zählerstand“ bedeutet die letzte gespeicherte Ablesung, mit deren Datum. Es gibt keine automatische Live-Abfrage des Geräts. Fehlt am aktuell eingebauten Gerät ein Stand, kann der letzte dokumentierte Stand des vorherigen Geräts mit entsprechender Kennzeichnung erscheinen.

Der Jahresverbrauch nutzt aufeinanderfolgende Ablesungen derselben Geräteperiode. Differenz × Gerätefaktor ergibt die Menge; bestätigte Überläufe und Gerätewechsel werden berücksichtigt. Es werden keine Stände verschiedener Geräte direkt voneinander abgezogen. Die Jahresgrenze wird in der Zeitzone der letzten Zuordnung im gewählten Bereich bestimmt. Bei späterem Einbau beginnt die vorhandene Messstellenperiode entsprechend später.

Die Jahreskachel addiert ausschließlich vollständig innerhalb des Jahres und des erlaubten Anlagenbereichs liegende Messintervalle. Fehlt ein Stand an der Jahres- oder Zuordnungsgrenze, wird das betroffene Randintervall nicht als tatsächliche Jahresmenge hochgerechnet. Verbleibende bekannte Intervalle erscheinen als Teilwert mit Zeitraum und Status. Kein berechenbares Intervall ergibt „–“, ein tatsächlich gemessener Nullverbrauch dagegen 0. Kleine von null verschiedene Mengen bleiben erhalten und werden gegebenenfalls wissenschaftlich dargestellt. Die zeitliche Abdeckung bezieht sich auf die zugeordneten Perioden bis zur letzten Ablesung; seitdem wird kein Verbrauch erfunden.

Die Summe im Kunden-/Standort-/Gebäudebereich zählt historische Hauptzählerperioden. Unterzähler werden nur während einer innerhalb desselben Bereichs vorhandenen passenden Hauptzählerzuordnung ausgeschlossen. Eine spätere Umhängung wird ab ihrem Datum berücksichtigt. Messstellen mit inzwischen gelöschten Datensätzen können historische Mengen beitragen. Unterschiedliche Medien, Einheiten und Messrichtungen werden getrennt ausgegeben; MWh und kWh werden in dieser gemessenen Übersicht nicht stillschweigend zusammengezählt. Eingeschränkte Standortrechte gelten auch für alte Perioden und Nachbarablesungen.

## Verbrauchsdiagramm

Die Verbrauchsansicht steht vor der Historie. „Zeitraum und Darstellung anpassen“ ist zunächst geschlossen. Beginn/Ende verwenden Browser-Ortszeit; die Zeitabschnitte der Berechnung folgen der Standortzeitzone. Tage, Wochen, Monate, Jahre oder Gesamtzeitraum sind wählbar.

Das Diagramm zeichnet alle gelieferten Zeitabschnitte innerhalb der verfügbaren Breite. Balkenbreite und Datumsbeschriftungen passen sich der Breite an. Es ist kein horizontales Scrollen nötig. Eine ausgedünnte Datumsachse entfernt keine Daten. Einzelwerte stehen weiterhin über die Balkenhinweise und in der aufklappbaren Tabelle zur Verfügung. Bei sehr vielen Abschnitten ist eine gröbere Zeitauflösung sinnvoll; die API begrenzt die Reihe auf 2.000 Abschnitte.

Die bestehende Verbrauchsreihe kann bekannte Intervalle zeitanteilig auf Tage oder Monate verteilen. Das ist ausdrücklich von den tatsächlichen vollständigen Intervallmengen der Jahreskacheln zu unterscheiden. Fehlende Anfangs-/Endstände und Austauschwerte bleiben Datenlücken.

## Prompt für eine externe KI

Unter „Berichte“ den gewünschten Umfang festlegen und „Analyseprompt erstellen“ drücken. Der Text erscheint darunter und kann mit „Prompt kopieren“ übernommen werden. Eine Berichtsvorlage kann die Filter vorbelegen. Die Erstellung und Speicherung der zugrunde liegenden Daten bleiben lokal; nur der Benutzer entscheidet über das anschließende Einfügen des Texts in eine externe KI.

Der Prompt enthält ausschließlich kontrollierte Messmetadaten, Mengen, Zeiträume, Qualitätsmerkmale und neutrale Bezeichnungen. Firmen-/Personenangaben, Anschriften, Namen und Nummern von Anlagen, Zählern und Geräten, GUIDs, Freitexte, PDF-Inhalte und Benutzerangaben werden ausgelassen. Die neutralen Bezeichnungen sind kein dauerhafter Zuordnungsschlüssel über unterschiedliche Datenabzüge hinweg.

Erfasste Intervallmengen und Veränderungen der letzten zwei vollständigen Intervallmittel werden beschrieben. Die Mittelwerte sind auf die tatsächliche Intervalllänge normiert und stellen keine gemessenen Tagesprofile dar. Die Monatsreihe verteilt bekannte Intervallmengen zeitanteilig und benennt dies sowie fehlende Abdeckung. Haupt-/Unterzählerzuordnungen gelten historisch. Monate oder Werte ohne ausreichende Daten werden nicht als Nullverbrauch ausgegeben.

Der Arbeitsauftrag fordert die KI auf, Beobachtung, Hypothese und Empfehlung zu trennen. Wetter, Produktion, Belegung, Betriebszeiten und Preise sind nicht mitgeliefert. Ursachen, Einsparungen oder Maßnahmenwirkungen dürfen daraus nicht als bewiesen angenommen werden. Der Text erfragt dafür benötigte Zusatzdaten und unterbindet stillschweigende Jahreshochrechnungen. Es wird keine KI-Analyse automatisch ausgeführt.

Die Erstellung wird mit Benutzer, Zeitraum und Messstellenanzahl protokolliert. Die erzeugte Promptausgabe wird nicht als zusätzlicher Bericht in der Datenbank gespeichert. Standort- und Kundenfreigaben werden serverseitig geprüft. Maximal 36 Kalendermonate und 200 Messstellen pro Prompt; bei mehr als 50.000 relevanten Ablesungen den Umfang eingrenzen.

Version 0.7 verändert das Datenbankschema nicht. Bestehende Dateien, Ablesungen, Vorlagen und Anwendungsschlüssel bleiben erhalten.
