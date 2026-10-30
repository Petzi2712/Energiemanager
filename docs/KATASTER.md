# Kundenkataster und Zähleranlagenbaum – Version 0.6

## Einen Kunden technisch aufnehmen

1. Als Systemadministrator anmelden und „Kundenkataster“ öffnen. Den gewünschten Kunden auswählen.
2. „Standort anlegen“: Nummer, Bezeichnung, Adresse, Kontakt, Nutzung und technische Randdaten erfassen. Die Standortzeitzone ist standardmäßig `Europe/Berlin`.
3. Den Standort auswählen und mit „Untereintrag anlegen“ Gebäude ergänzen. Zu Gebäuden können Bereiche, Anlagen, Verteilungen, Verbrauchergruppen und Einzelverbraucher angelegt werden. Die Struktur darf bis zu 16 Ebenen besitzen.
4. Verbraucher beispielsweise als Beleuchtung, Motor, Pumpe oder eigenen frei benannten Typ erfassen. Anzahl, Nennleistung und bei Bedarf tatsächliche elektrische Systemleistung inkl. Verlusten angeben. Jahresbetriebsstunden sind bereits die Gesamtstunden pro Jahr; die separat dokumentierten Betriebstage werden nicht nochmals multipliziert.
5. Fotos oder PDFs unter „Fotos und technische Dokumente“ hochladen. Erlaubt sind JPEG, PNG und PDF bis 6 MB; bis zu 20 Dateien pro Eintrag. PDF-Dateien werden als Download ausgeliefert.

Beispiel: 24 Leuchten × 150 W = 3,6 kW; bei 2.000 Jahresstunden und Lastfaktor 1 ergibt sich eine **rechnerische Schätzung von 7.200 kWh/Jahr**. Liegt eine abweichende Systemleistung vor, verwendet die Schätzung diese. Es wird kein gemessener Verbrauch daraus gemacht.

Individuelle Zusatzfelder lassen sich zunächst als JSON-Objekt mit Textwerten ergänzen, zum Beispiel `{"Geschoss":"EG","Anlagenkennzeichen":"UV-01"}`. Eine komfortablere Feldvorlagenverwaltung ist nicht Bestandteil dieser Version.

## Messstellen und Geräte anlegen

Im Kataster „Messstelle zuordnen“ oder im Zähleranlagenbaum „Messstelle anlegen“ verwenden. Die Messstelle gehört zum ausgewählten Kunden und Anlagenknoten. Unterstützt werden Strom, Wasser, Erdgas, Wärme und Kälte.

Eine Messstelle besitzt eine dauerhafte ID. Das physische Gerät wird separat geführt. Zählernummer, Hersteller, Modell und Typ gehören zum Gerät; Faktor, Auflösung, Dezimalstellen, optionaler Überlaufmodulus und Einbauzeitraum zur jeweiligen Installation. Ein Anfangsstand ist optional. Ein fehlender Anfangsstand verhindert eine vollständige Verbrauchsaussage ab dem Einbaudatum.

Haupt- und Unterzähler müssen denselben Kundenstandort, dasselbe Medium, dieselbe Einheit und dieselbe Messrichtung besitzen. Der Server verhindert Kreiszuordnungen. Im Zähleranlagenbaum erscheinen die technischen Knoten und darunter die Medien mit ihren Haupt-/Unterzählern.

„Zuordnung ändern“ schließt die alte Zuordnung zu einem angegebenen Zeitpunkt ab und legt eine neue Periode an. Dieser Zeitpunkt muss nach allen vorhandenen Ablesungen liegen. Das verhindert eine rückwirkende Umdeutung historischer Zuordnungen. Ein Hauptzähler mit Unterzählern kann den Standort erst wechseln, wenn die Unterzähler entsprechend neu zugeordnet wurden. Strukturelle Knoten werden nicht rückwirkend verschoben; bei einem neuen Standort wird ein neuer Knoten angelegt und die Messstelle versioniert umgehängt.

Geräteparameter, Medium, Einheit und Messrichtung werden nicht unprotokolliert an vorhandenen Messwerten geändert. Für Geräteänderungen wird der Zählertausch verwendet; für einen anderen Medium-/Einheitentyp eine neue Messstelle.

## Ablesung und Plausibilität

Kundenbenutzer wählen „Zählerablesung“, dann ihre freigegebene Messstelle. Die Eingabe enthält Ablesezeitpunkt, Zählerstand, Ereignis, Kommentar und optional ein Foto. Datumseingaben sind ausdrücklich Browser-Ortszeit und werden mit dem korrekten UTC-Offset übertragen. Die Ablesehistorie zeigt die konfigurierte Standortzeitzone. Die Datenbank speichert UTC; tatsächlicher Ablesezeitpunkt und Speicherzeitpunkt bleiben getrennt.

Geprüft werden Wertebereich, maximal sechs Dezimalstellen, konfigurierte Auflösung, Geräteperiode, Zukunftsdatum, doppelte Einträge sowie Vorgänger und Nachfolger. Ein Wert darf keiner späteren vorhandenen Ablesung widersprechen. Unbekannte Einheiten oder unpassende Haupt-/Unterzählerkonfigurationen werden abgelehnt.

- **Gültig:** speicherbar.
- **Auffällig:** Eine ausdrücklich konfigurierte Tagesgrenze wird überschritten. Speichern erst nach ausdrücklicher Bestätigung und einer Begründung mit mindestens fünf Zeichen. Die automatische Medianwarnung ist entfernt; ohne eingetragene Grenze gibt es keine Verbrauchsspitzenwarnung.
- **Ungültig:** abgelehnt. Es wird kein fachlich ungültiger Messwert gespeichert.

Fallende Stände werden grundsätzlich abgelehnt. Ein Überlauf benötigt einen konfigurierten Überlaufmodulus, die explizite Überlaufmarkierung und eine bestätigte Begründung. Der Modulus ist der Wert, bei dem das Register auf null springt, beispielsweise 100.000 bei einem Register von 0 bis 99.999. Überläufe werden nie automatisch als Tatsache unterstellt.

Der Verbrauch wird aus aufeinanderfolgenden Ständen desselben Geräts mit dessen Faktor berechnet. Erste Stände einer Geräteperiode besitzen keine Verbrauchsdifferenz. Die kompakte Historie zeigt höchstens 15 Ablesungen je Seite, mit Vor-/Zurückblättern und frei wählbaren Datumsgrenzen in Browser-Ortszeit. Die Endsekunde wird vollständig einbezogen. Nachweise, Kommentare und Korrekturen erscheinen beim Aufklappen einer Zeile. Der Verbrauch am Seiten-/Filterrand nutzt den vorherigen berechtigten Stand außerhalb der angezeigten Seite. Die Bilanzberechnung verwendet weiterhin alle erforderlichen Daten.

Fotos werden anhand des tatsächlichen Dateiformats decodiert. Nur JPEG und PNG bis 24 Megapixel werden angenommen, ausgerichtet, auf höchstens 2.000 × 2.000 Pixel verkleinert, von Metadaten bereinigt und als JPEG in einen privaten Blob-Container geschrieben. Der Zugriff läuft mit Benutzer-/Standortprüfung durch die API. Es gibt keine öffentlichen Blob-URLs. Ein fehlgeschlagenes Foto ändert eine bereits gespeicherte Ablesung nicht; der Nachweis kann über deren Historieneintrag ergänzt werden.

## Korrekturen und Zählertausch

Die Systemadministration kann in der Historie einen Stand mit Begründung korrigieren. Zeitpunkt und ursprünglicher Benutzer-/Speicherbezug bleiben erhalten; eine Revision hält Vorher-/Nachher-Werte fest. Veraltete Bearbeitungsstände werden als Konflikt abgewiesen.

„Zählertausch erfassen“ dokumentiert Tauschzeitpunkt, alten Endstand, neue Geräteangaben, neuen Anfangsstand und Grund. Alte und neue Geräteperiode bleiben getrennt. Zwischen altem Endstand und neuem Anfangsstand entsteht **keine Verbrauchsdifferenz**. Fotos lassen sich an den zugehörigen Austauschablesungen speichern.

Sind Austauschstände unbekannt, muss „unvollständig“ ausdrücklich bestätigt werden. Die Gerätehistorie weist den fehlenden Nachweis aus; eine betroffene Bilanz wird nicht als vollständig ausgewiesen. Fotos ohne zugehörigen numerischen Austauschstand können zunächst am Katasterknoten dokumentiert werden.

## Verbrauch und Unterzählerbilanz

Die Ansicht lädt beim Öffnen einer Messstelle automatisch die letzten 30 Tage. Datum und Uhrzeit sind frei einstellbar. „Balken gruppieren nach“ wechselt zwischen Tagen, Wochen (Montagsgrenzen), Monaten, Jahren und dem Gesamtzeitraum. Kalendergrenzen richten sich nach der Standortzeitzone; Tage bei Zeitumstellungen können 23 oder 25 Stunden lang sein.

Bekannte Zählerdifferenzen werden je Gerät mit dessen Faktor berechnet. Innerhalb eines durch zwei Ablesungen belegten Intervalls verteilt die Ansicht den Verbrauch nach der tatsächlichen Zeitdauer. Solche Balken heißen „Zeitanteilig“: Sie sind keine gemessenen Tageslastgänge. Die Summen bleiben über die Gruppierungen erhalten. Außerhalb belegter Intervalle wird nicht extrapoliert. Fehlt ein Austauschstand, entsteht eine Lücke; es wird keine Differenz zwischen alten und neuen Geräten gebildet.

Bei unvollständiger Abdeckung zeigt die Zusammenfassung den **erfassten Teilverbrauch** und den abgedeckten Zeitanteil. Ein Strich bedeutet „unbekannt“, nicht null. Ohne passende Ablesungen können auch im voreingestellten Zeitraum keine Werte erscheinen. Dann Anfangs-/Endstände ergänzen oder einen belegten Zeitraum wählen. Beim Upgrade werden keine neuen Messwerte erfunden.

Hauptzähler, direkte Unterzähler und nicht zugeordneter Verbrauch lassen sich über die Legende ein-/ausblenden. Jeder Balken hat Werteinformationen; die aufklappbare Tabelle bietet alle Werte als Text. Breite Diagramme sind innerhalb des Diagrammbereichs scrollbar. Die streng exakte API `/meters/{id}/balance` bleibt für Randablesungen ohne zeitanteilige Verteilung erhalten.

Der Hauptzählerverbrauch wird mit der Summe seiner **direkten** Unterzähler verglichen. Weitere Unterebenen werden nicht erneut addiert. Nicht zugeordneter Verbrauch = Hauptzählerverbrauch − direkte Unterzählerverbräuche. Absolutstände werden nicht gegeneinander verrechnet.

Bei Datenlücken, unterschiedlichen Einheiten oder eingeschränkten Standortrechten bleibt die Bilanz unvollständig. Zuordnungsänderungen werden in der neuen Diagrammansicht nach ihren gültigen Zeitabschnitten berücksichtigt. Unterschiedliche Medien werden getrennt behandelt. Einheiten werden in dieser Version nicht automatisch umgerechnet. Eine negative Restmenge bleibt sichtbar und führt zu einem Hinweis, das Messkonzept zu prüfen.

## Rechte und Bestandsschutz

Kundenbenutzer sehen ausschließlich freigegebene Kundenstandorte. Unter „Benutzer → Standortfreigaben“ kann die Systemadministration einzelne Standorte zulassen. Eine aktivierte Beschränkung ohne ausgewählte Standorte sperrt alle technischen Daten dieses Kunden. Kundenleser können keine Ablesungen oder Dateien anlegen. Technische Stammdaten, Korrekturen und Zuordnungen verwaltet die Systemadministration.

Eingeschränkte Kundenadministratoren vererben ihre Standortrechte an neu angelegte Benutzer. Benutzer mit umfassenderen Standortrechten dürfen sie nicht ändern. Auch historische Ablesungen und Fotos werden anhand der jeweils gültigen Standortperiode geprüft.

Anlagen können deaktiviert werden. Messstellen kann die Systemadministration mit „Zähler löschen“ und einem Löschgrund entfernen. Vorhandene Unterzähler müssen zuvor umgehängt oder gelöscht werden. Die Messstelle verschwindet aus der Bedienoberfläche und kann keine neuen Ablesungen erhalten; historische Messwerte und Geräteperioden bleiben gespeichert. Frühere Unterzählerverbräuche bleiben in historischen Hauptzählerbilanzen enthalten. Löschgrund, Benutzer, Zeitpunkt und Messstellenzustand erscheinen im Audit-Protokoll.

Fotos und technische Dateien besitzen einen Löschbutton und einen Bestätigungsdialog. Beim Kataster darf nur die Systemadministration löschen; bei Ablesefotos dürfen schreibberechtigte Benutzer ihres freigegebenen Standortes löschen. Dateien sind nach der Löschung sofort nicht mehr abrufbar. Die private Blob-Datei wird entfernt; bei vorübergehendem Speicherausfall wird die Bereinigung im Hintergrund wiederholt. Das Löschprotokoll bleibt erhalten.

Version 0.2 ergänzt bestehende Installationen per Migration. Bereits vorhandene Stammdaten und Benutzer werden nicht ersetzt. Die technische Demo-Struktur entsteht nur bei einer frisch initialisierten Demo-Datenbank: Kunde A mit zwei Standorten, Gebäuden, Verbraucherstruktur, einem Stromhauptzähler, drei Stromunterzählern und Wasser/Gas/Wärme/Kälte; Kunde B mit einem Standort, Gebäude und eigenen Messstellen. Fahrzeuge lassen sich ab Version 0.3 im eigenen Fuhrparkmenü erfassen. Es werden beim Upgrade keine Fahrzeug-Demodaten eingefügt.


## Hardware und Erzeugungsanlagen

Der Kundenkataster enthält die technische Hardwarestruktur. Unter einem Gebäude oder Anlagenbereich „Untereintrag anlegen“ und den Strukturtyp „Hardware / Verbraucher / Erzeuger“ wählen. Kategorien wie Beleuchtung, Maschinen, Wärmeanlagen, EDV, Serverraum, BHKW, Photovoltaik und Windanlage sind vorgeschlagen und frei erweiterbar. Die Energierolle unterscheidet Verbraucher, Erzeuger und kombinierte Anlagen. Hersteller, Modell, Baujahr, Energieträger, Anzahl, Leistungen, Betriebsstunden und Zusatzfelder dokumentieren die Technik. Leistung und Jahresenergie bleiben ausdrücklich technische Schätzungen.

Messstellenlisten, Zähleranlage und Ablesungen stehen ausschließlich im Zähleranlagenbaum. Der Kundenkataster zeigt die Hardware und deren Dokumente.

## Zählerhierarchie mit Drag-and-drop

Als Systemadministrator einen Zähler auf einen anderen Zähler ziehen, um ihn als Unterzähler zuzuordnen. Auf einen Anlagenknoten ziehen, um ihn dort als Hauptzähler einzuordnen. Anschließend im geöffneten Dialog Ziel und Gültigkeitsdatum bestätigen. Alternativ „Zuordnung ändern“ verwenden, insbesondere auf Touchgeräten oder mit Tastatur.

Der Server prüft Kunde, Standort, Medium, Einheit, Messrichtung und Kreisfreiheit. Historische Auswertungen behalten die zum jeweiligen Zeitraum gültige Hierarchie. Eine heute geänderte Zuordnung ordnet frühere Verbräuche nicht rückwirkend um. Das Gültigkeitsdatum muss nach den vorhandenen Ablesungen liegen.

## Fuhrpark, Branding und Darstellung

„Fuhrpark“ steht direkt unter dem Kundenkataster. Kundenauswahl in der fixierten Kopfzeile verwenden. Die Systemadministration legt Fahrzeuge an, bearbeitet deren Attribute und löscht sie mit protokolliertem Grund. Standortzuordnung ist verpflichtend; Kundenbenutzer und Leser sehen ausschließlich ihre freigegebenen Fahrzeuge. Tank-/Ladevorgänge und Fahrleistungsanalysen sind noch nicht enthalten.

„Mein Konto → Logo und Anmeldebildschirm“ ist für die Systemadministration verfügbar. Das Logo (PNG/JPEG bis 2 MB) und der mehrzeilige Leitspruch gelten anwendungsweit, einschließlich des Loginbildschirms. Das persönliche Farbschema wird unter „Darstellung → Darkmodus aktivieren“ gespeichert. Die Kopfzeile mit Kundenauswahl und Benutzer bleibt beim Scrollen sichtbar.


Ab Version 0.4 sind die theoretische Gebäude-/Standortbilanz und geschützte Excel-Ablesevorlagen ergänzt. Siehe [Bilanz und Excel](BILANZ-UND-EXCEL.md).

## Kopieren und IDs ab Version 0.5

Als Systemadministrator einen Untereintrag auswählen und „Eintrag kopieren“ öffnen. Ziel, neue ID und Bezeichnung bestimmen; wahlweise alle Untereinträge übernehmen. Die Kopie erhält neue interne Kennungen und eindeutige IDs für die Untereinträge. Technische Werte, Zusatzfelder, Aktivzustand und Einsparannahmen werden übernommen. Dokumente, Ablesungen und Messstellenzuordnungen verbleiben am Original. Kopien sind unabhängig bearbeitbar; die Aktion wird protokolliert. Standorte selbst werden nicht kopiert.

Das Katasterfeld „Nummer“ heißt jetzt „ID“, die „Messstellennummer“ heißt „ID Messstelle“. Bestehende Werte und Verknüpfungen bleiben erhalten. Im Modul „Verbrauch und Unterzählerbilanz“ liegt der Beginn standardmäßig 30 Tage vor dem Ende; getrennte Feldnamen und ausgeschaltetes Autovervollständigen vermeiden Verwechslungen mit den Historienfiltern.

## Löschen und Maßnahmen ab Version 0.6

Als Systemadministrator „Katastereintrag löschen“ öffnen und einen nachvollziehbaren Grund angeben. Der einzelne Eintrag verschwindet aus Baum und Bilanz; sein Datenbankbezug bleibt als Löschmarkierung erhalten. Zugehörige allgemeine Dateien und Maßnahmen-PDFs werden gesperrt und anschließend aus dem Blob-Speicher bereinigt. Jeder Vorgang wird protokolliert. IDs bleiben reserviert.

Untereinträge werden nicht automatisch mitgelöscht. Zuerst die Untereinträge entfernen. Vorhandene Zählerzuordnungen einschließlich Historien verhindern die Löschung; solche Einträge können bei Bedarf deaktiviert werden. Zugeordnete Fahrzeuge und Berichtsvorlagen müssen zuerst umgezogen, angepasst oder gelöscht werden. Es gibt keine Wiederherstellungsoberfläche.

„Einsparszenario je Komponente“ besitzt die Checkbox „Maßnahme umgesetzt“ und eine Schaltfläche zum Aufklappen. Dort Umsetzung und Ergebnisse beschreiben, Status/Text speichern und private PDF-Berichte bis 6 MB hochladen oder löschen. Maximal 20 Maßnahmen-PDFs je Komponente. PDF-Nachweise sind vom allgemeinen Dokumentenbereich getrennt. Die Systemadministration bearbeitet diese Angaben; freigegebene Leser können sie ansehen. Bei einer Katasterkopie bleiben Umsetzung, Texte und Nachweise am Original; die neue Anlage startet ohne dokumentierte Umsetzung.

Die Gesamtbilanz und alle aktiven freigegebenen Gebäude stehen gleichzeitig als Diagrammkarten bereit, auch beim Öffnen eines Verbrauchers. Der Ring ist die Voreinstellung. Die darunterstehenden Komponententabelle und Ausgangssumme beziehen sich auf den gewählten Standort bzw. das Gebäude des ausgewählten Eintrags. Die allgemeine Kundenübersicht umfasst nur freigegebene Standorte; Erzeugung und andere Medien bleiben getrennt.

„Mein Konto“ sitzt als Zahnrad neben der Versionsangabe unten in der Seitenleiste. Die Hauptnavigation lautet Kundenkataster, Zähleranlagenbaum, Fuhrpark, Berichte. Eingabefelder zeigen Hinweise und Beispiele über Mouseover; die Fragezeichen an Formularfeldern sind auch per Tastatur fokussierbar.
