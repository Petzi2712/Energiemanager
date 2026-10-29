# Kundenkataster und Zähleranlagenbaum – Version 0.2

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
- **Auffällig:** Tagesgrenze überschritten oder mehr als das Dreifache des historischen Medians bei mindestens drei geeigneten früheren Intervallen. Speichern erst nach ausdrücklicher Bestätigung und einer Begründung mit mindestens fünf Zeichen.
- **Ungültig:** abgelehnt. Es wird kein fachlich ungültiger Messwert gespeichert.

Fallende Stände werden grundsätzlich abgelehnt. Ein Überlauf benötigt einen konfigurierten Überlaufmodulus, die explizite Überlaufmarkierung und eine bestätigte Begründung. Der Modulus ist der Wert, bei dem das Register auf null springt, beispielsweise 100.000 bei einem Register von 0 bis 99.999. Überläufe werden nie automatisch als Tatsache unterstellt.

Der Verbrauch wird aus aufeinanderfolgenden Ständen desselben Geräts mit dessen Faktor berechnet. Erste Stände einer Geräteperiode besitzen keine Verbrauchsdifferenz. Die Historie liefert bis zu 500 aktuelle Ablesungen. Die Bilanzberechnung verwendet die vollständigen für den Zeitraum erforderlichen Daten unabhängig von dieser Anzeigegrenze.

Fotos werden anhand des tatsächlichen Dateiformats decodiert. Nur JPEG und PNG bis 24 Megapixel werden angenommen, ausgerichtet, auf höchstens 2.000 × 2.000 Pixel verkleinert, von Metadaten bereinigt und als JPEG in einen privaten Blob-Container geschrieben. Der Zugriff läuft mit Benutzer-/Standortprüfung durch die API. Es gibt keine öffentlichen Blob-URLs. Ein fehlgeschlagenes Foto ändert eine bereits gespeicherte Ablesung nicht; der Nachweis kann über deren Historieneintrag ergänzt werden.

## Korrekturen und Zählertausch

Die Systemadministration kann in der Historie einen Stand mit Begründung korrigieren. Zeitpunkt und ursprünglicher Benutzer-/Speicherbezug bleiben erhalten; eine Revision hält Vorher-/Nachher-Werte fest. Veraltete Bearbeitungsstände werden als Konflikt abgewiesen.

„Zählertausch erfassen“ dokumentiert Tauschzeitpunkt, alten Endstand, neue Geräteangaben, neuen Anfangsstand und Grund. Alte und neue Geräteperiode bleiben getrennt. Zwischen altem Endstand und neuem Anfangsstand entsteht **keine Verbrauchsdifferenz**. Fotos lassen sich an den zugehörigen Austauschablesungen speichern.

Sind Austauschstände unbekannt, muss „unvollständig“ ausdrücklich bestätigt werden. Die Gerätehistorie weist den fehlenden Nachweis aus; eine betroffene Bilanz wird nicht als vollständig ausgewiesen. Fotos ohne zugehörigen numerischen Austauschstand können zunächst am Katasterknoten dokumentiert werden.

## Verbrauch und Unterzählerbilanz

Bilanzbeginn und -ende auswählen. Für jede beteiligte Geräteperiode sind exakte Randablesungen erforderlich; es wird nicht still interpoliert. Gerätewechsel werden je Periode berechnet und nur bei vollständigen Übergangsdaten addiert.

Der Hauptzählerverbrauch wird mit der Summe seiner **direkten** Unterzähler verglichen. Weitere Unterebenen werden nicht erneut addiert. Nicht zugeordneter Verbrauch = Hauptzählerverbrauch − direkte Unterzählerverbräuche. Absolutstände werden nicht gegeneinander verrechnet.

Bei Datenlücken, unterschiedlichen Einheiten, eingeschränkten Standortrechten oder Zuordnungsänderungen im Zeitraum ist die Bilanz unvollständig. Unterschiedliche Medien werden getrennt behandelt. Einheiten werden in dieser Version nicht automatisch umgerechnet. Eine negative Restmenge bleibt sichtbar und führt zu einem Hinweis, das Messkonzept zu prüfen.

## Rechte und Bestandsschutz

Kundenbenutzer sehen ausschließlich freigegebene Kundenstandorte. Unter „Benutzer → Standortfreigaben“ kann die Systemadministration einzelne Standorte zulassen. Eine aktivierte Beschränkung ohne ausgewählte Standorte sperrt alle technischen Daten dieses Kunden. Kundenleser können keine Ablesungen oder Dateien anlegen. Technische Stammdaten, Korrekturen und Zuordnungen verwaltet die Systemadministration.

Eingeschränkte Kundenadministratoren vererben ihre Standortrechte an neu angelegte Benutzer. Benutzer mit umfassenderen Standortrechten dürfen sie nicht ändern. Auch historische Ablesungen und Fotos werden anhand der jeweils gültigen Standortperiode geprüft.

Anlagen und Messstellen werden deaktiviert, nicht hart gelöscht. Aktive Untereinträge müssen zuvor deaktiviert werden. Änderungen, Rechtevergaben, Ablesungen, Gerätewechsel und Dokumentzugriffe erscheinen im Audit-Protokoll.

Version 0.2 ergänzt bestehende Installationen per Migration. Bereits vorhandene Stammdaten und Benutzer werden nicht ersetzt. Die technische Demo-Struktur entsteht nur bei einer frisch initialisierten Demo-Datenbank: Kunde A mit zwei Standorten, Gebäuden, Verbraucherstruktur, einem Stromhauptzähler, drei Stromunterzählern und Wasser/Gas/Wärme/Kälte; Kunde B mit einem Standort, Gebäude und eigenen Messstellen. Fahrzeuge gehören zum späteren Fuhrparkmodul.
