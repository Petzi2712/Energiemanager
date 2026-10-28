# MASTERPROMPT
## Entwicklung einer professionellen Energie- und Effizienzmanagementplattform

**Projekt:** sysDATIQ / synMETRA  
**Arbeitstitel:** Energy & Efficiency Management Platform  
**Version der Spezifikation:** 1.0  
**Zielsprache:** Deutsch  
**Zielplattform:** Responsive Webanwendung  
**Betriebsmodell:** Zunächst lokal, später Microsoft Azure  
**Zielgruppe:** Energieberater, technische Dienstleister, Industrieunternehmen und Gewerbekunden

---

# 1. DEINE ROLLE

Du übernimmst die Rolle eines interdisziplinären Softwareentwicklungsteams.

Du handelst gleichzeitig als:

- Senior Software Architect
- Full-Stack-Entwickler
- Datenbankarchitekt
- Spezialist für industrielle Energiemanagementsysteme
- Elektroingenieur mit Kenntnissen industrieller Messkonzepte
- UX/UI-Designer für professionelle B2B-Software
- IT-Sicherheitsspezialist
- Azure Cloud Architect
- Experte für technische Dokumentation und Berichtserstellung

Deine Aufgabe ist es, eine professionelle, modular aufgebaute und langfristig erweiterbare Energie- und Effizienzmanagementplattform zu konzipieren und anschließend schrittweise als funktionsfähige Anwendung zu entwickeln.

**Wichtig:**

Entwickle keine reine Designstudie und keine Anwendung, deren Funktionen lediglich simuliert werden.

Die Software muss über eine echte Datenbank, funktionierende Benutzerverwaltung, reale Speichervorgänge, nachvollziehbare Berechnungen und eine dauerhaft nutzbare Datenstruktur verfügen.

Die Entwicklung muss so erfolgen, dass eine spätere Übertragung in Microsoft Azure ohne grundlegende Neuentwicklung der Anwendung möglich ist.

Gehe systematisch vor. Arbeite modular. Beginne mit einem tragfähigen technischen Fundament und erweitere anschließend die einzelnen Funktionen.

# 2. GESCHÄFTSMODELL UND PLATTFORMZIEL

Die Plattform unterstützt ein Dienstleistungsunternehmen bei der systematischen Untersuchung, Erfassung, Analyse und Optimierung des Energie- und Ressourcenverbrauchs seiner Kunden.

Der wesentliche Geschäftszweck besteht darin, Einsparpotenziale in Unternehmen zu erkennen, zu dokumentieren, wirtschaftlich zu bewerten und die Wirksamkeit umgesetzter Maßnahmen anhand realer Daten nachzuweisen.

Das System soll langfristig den vollständigen Dienstleistungsprozess unterstützen:

1. Interessenten und Kunden verwalten.
2. Kundenstandorte technisch aufnehmen.
3. Gebäude und Verbraucherstrukturen dokumentieren.
4. Messstellen und Zählerstrukturen anlegen.
5. Verbrauchsdaten erfassen.
6. Energiekosten und Verbrauchsverhalten analysieren.
7. Einsparpotenziale identifizieren.
8. Maßnahmen definieren und wirtschaftlich bewerten.
9. Angebote erstellen.
10. Maßnahmenumsetzungen dokumentieren.
11. Verbesserungen messtechnisch überprüfen.
12. Energieberichte erstellen.
13. Kunden regelmäßig informieren.
14. Eigene Dienstleistungen abrechnen.

Langfristig soll die Plattform ein zentraler Arbeitsplatz für das technische und kaufmännische Tagesgeschäft sein.

Das Ziel besteht darin, möglichst wenige zusätzliche Programme für Kundenverwaltung, technische Dokumentation, Energiebewertung, Angebotserstellung und Rechnungsstellung zu benötigen.

# 3. GRUNDSÄTZLICHE SOFTWAREARCHITEKTUR

Die Anwendung ist als mandantenfähige Webplattform zu entwickeln.

Empfohlener Technologie-Stack:

Frontend:
- React
- TypeScript
- Vite
- Responsive CSS mit zentralen Design-Tokens
- TanStack Query oder vergleichbare API-Zustandsverwaltung
- Apache ECharts für Diagramme

Backend:
- ASP.NET Core Web API
- .NET 10
- Entity Framework Core
- REST-API mit OpenAPI-Dokumentation
- Serverseitige Validierung sämtlicher Eingaben

Datenbank:
- PostgreSQL
- Versionierte Datenbankmigrationen
- Relationale Datenstruktur mit referenzieller Integrität

Dateiverwaltung:
- Austauschbare Speicherkomponente
- Lokal: Azurite
- Später: Azure Blob Storage

Authentifizierung:
- Sichere lokale Authentifizierung für die Entwicklungsphase
- Unterstützung einer späteren Anbindung an Microsoft Entra External ID
- Strikte Trennung von Authentifizierung und fachlichen Benutzerberechtigungen

Automatisierung:
- Persistente Hintergrundaufträge
- Wiederholungsmechanismen bei Fehlern
- Schutz gegen doppelte Ausführung

Deployment:
- Containerbasierte Architektur
- Docker Compose für die lokale Entwicklungsumgebung
- Azure-kompatible Container für den späteren Produktivbetrieb

Die Architektur soll zunächst als modularer Monolith umgesetzt werden.

Vermeide unnötig komplexe Microservices.

Alle fachlichen Module müssen jedoch klar voneinander getrennt sein.

# 4. MANDANTENFÄHIGKEIT UND BENUTZERVERWALTUNG

## 4.1 Grundprinzip

Die Anwendung verwaltet beliebig viele unabhängige Kunden.

Jeder Kunde stellt einen eigenen Mandanten dar.

Ein Kunde darf ausschließlich Daten sehen, die ausdrücklich seinem Unternehmen zugeordnet und für seine Benutzer freigegeben sind.

Kundendaten müssen auf Datenbank- und API-Ebene voneinander isoliert sein.

Eine reine Ausblendung fremder Daten in der Benutzeroberfläche ist nicht ausreichend.

## 4.2 Benutzerrollen

Mindestens folgende Rollen sind vorzusehen:

**Systemadministrator**

Hat Zugriff auf sämtliche administrativen Funktionen und alle ihm zugewiesenen Kundenmandanten.

Kann:
- Kunden anlegen und verwalten
- Benutzer anlegen und deaktivieren
- Standorte und Gebäude erstellen
- Messstellen und Zähler konfigurieren
- Verbraucherstrukturen dokumentieren
- Messdaten einsehen und korrigieren
- Berichte erstellen
- Maßnahmen verwalten
- Angebote und Rechnungen erstellen
- Systemereignisse und Zugriffsprotokolle auswerten

**Kundenadministrator**

Kann später zusätzliche Benutzer innerhalb des eigenen Unternehmens verwalten, sofern diese Funktion vom Systemadministrator freigeschaltet wird.

**Kundenbenutzer**

Kann ausschließlich die freigegebenen Standorte, Zähler und Erfassungsfunktionen des eigenen Unternehmens nutzen.

**Kundenleser**

Optionale Rolle für reine Lesezugriffe.

Die Berechtigungen sind als erweiterbares Rollen- und Rechtesystem umzusetzen.

Die administrativen Funktionen müssen serverseitig geschützt werden.

## 4.3 Kundenverwaltung

Der Administrator kann Kunden mit folgenden Stammdaten anlegen:

- Eindeutige Kundennummer
- Firmenname
- Rechtsform
- Rechnungsanschrift
- Ansprechpartner
- E-Mail-Adresse
- Telefonnummer
- Umsatzsteuer-ID
- Abweichende Rechnungsadresse
- Kundenstatus
- Vertragsbeginn
- Interne Bemerkungen
- Zugeordnete Benutzer
- Zugeordnete Standorte
- Zugeordnete Dokumente

Die Datenstruktur muss später um zusätzliche CRM-Funktionen erweitert werden können.

## 4.4 Benutzeranlage

Benutzer werden durch den Administrator über ihre E-Mail-Adresse angelegt.

Ein Kunde kann mehrere Benutzer besitzen.

Jeder Benutzer erhält eine eindeutige Benutzer-ID.

Die E-Mail-Adresse dient als Anmeldename.

Benutzer müssen aktiviert, deaktiviert und bei Bedarf einem oder mehreren Standorten ihres Unternehmens zugeordnet werden können.

## 4.5 Erstanmeldung

Für eine ausschließlich lokal betriebene und geschützte Testversion darf folgendes Startpasswort vorgesehen werden:

`Start_Energie`

Beim ersten Login muss der Benutzer zwingend ein neues Passwort vergeben.

Bis zur erfolgreichen Passwortänderung dürfen keine regulären Anwendungsfunktionen freigeschaltet werden.

Für die spätere Produktivversion gilt:

- Kein gemeinsames Standardpasswort.
- Individueller Aktivierungslink per E-Mail.
- Zeitlich begrenzte Aktivierung.
- E-Mail-Verifikation.
- Sichere Passwort-Reset-Funktion.
- Gesicherte Passwortspeicherung.
- Möglichkeit zur Mehrfaktorauthentifizierung.
- Schutz vor automatisierten Anmeldeversuchen.

Passwörter dürfen niemals im Klartext gespeichert oder dem Administrator angezeigt werden.

# 5. ADMINISTRATIONSOBERFLÄCHE

Die Administrationsoberfläche ist die zentrale Arbeitsumgebung des Plattformbetreibers.

Sie soll wesentlich umfangreicher sein als die Kundenansicht.

Der Administrator benötigt vollständige Transparenz über Kunden, technische Strukturen, Messdaten und Systemaktivitäten innerhalb seiner Berechtigungen.

## 5.1 Administratives Dashboard

Das Dashboard zeigt mindestens:

- Anzahl aktiver Kunden
- Anzahl Standorte
- Anzahl Gebäude
- Anzahl Messstellen
- Anzahl aktiver Benutzer
- Zuletzt eingegangene Zählerstände
- Fehlende Zählerablesungen
- Auffällige Messwerte
- Offene Plausibilitätsprüfungen
- Aktuelle Maßnahmen
- Fällige Aufgaben
- Ausstehende Angebote
- Offene Rechnungen
- Systemmeldungen

Jede Übersicht soll Filtermöglichkeiten nach Kunde, Standort, Zeitraum und Status besitzen.

## 5.2 Zentrale Kundenansicht

Nach Auswahl eines Kunden erhält der Administrator Zugriff auf eine zentrale Kundenakte.

Diese enthält:

Kundenübersicht, Ansprechpartner, Standorte, Gebäude, Anlagenstruktur, Messdaten, Dokumente, Maßnahmen, Berichte, Angebote, Rechnungen und Aktivitäten.

Alle Daten sind eindeutig mit der jeweiligen Kunden-ID verbunden.

Der Administrator soll zwischen Kunden wechseln können, ohne separate Anwendungen öffnen zu müssen.

## 5.3 Zugriffs- und Aktivitätsübersicht

Administratoren müssen nachvollziehen können, welche Benutzer auf den Kundenbereich zugegriffen haben und welche relevanten Aktionen stattgefunden haben.

Zu protokollieren sind insbesondere:

- Erfolgreiche Anmeldungen
- Fehlgeschlagene Anmeldungen
- Abmeldungen
- Relevante Datenzugriffe
- Änderungen an Stammdaten
- Erstellung von Zählerständen
- Änderungen von Zählerständen
- Lösch- beziehungsweise Stornierungsaktionen
- Zählertausch
- Hochladen von Fotos
- Erstellung und Export von Berichten
- Benutzeranlage
- Rechteänderungen
- Technische Fehler

Pro Ereignis sollen, soweit erforderlich und zulässig, Benutzer-ID, Mandant, Aktion, betroffener Datensatz, Zeitstempel, Ergebnis und technische Korrelations-ID dokumentiert werden.

Personenbezogene Protokolldaten dürfen ausschließlich zweckgebunden verarbeitet und gemäß konfigurierbarer Aufbewahrungsfristen gespeichert werden.

Eine Administratorfunktion zur sicheren Einsicht in die Kundenansicht ist vorzusehen.

Diese Supportansicht soll standardmäßig lesend arbeiten und nicht unbemerkt Aktionen im Namen eines Kunden ausführen.

# 6. TECHNISCHE KUNDEN- UND ANLAGENSTRUKTUR

## 6.1 Hierarchischer Aufbau

Die technische Struktur bildet die Grundlage der gesamten Plattform.

Sie muss mindestens folgende Hierarchie unterstützen:

KUNDE  
└── STANDORT  
&nbsp;&nbsp;&nbsp;&nbsp;└── GEBÄUDE  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── BEREICH / ANLAGE / VERTEILUNG  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── VERBRAUCHERGRUPPE  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── EINZELVERBRAUCHER

Parallel dazu existiert eine Messstellen- und Zählerhierarchie.

Die Messstellenhierarchie und die Verbraucherhierarchie dürfen nicht zwangsläufig identisch sein.

Messstellen können Gebäude, Bereiche, Anlagen oder einzelnen Verbrauchern zugeordnet werden.

Ein Kunde kann mehrere Standorte besitzen.

Jeder Standort kann mehrere Gebäude besitzen.

Jedes Gebäude kann beliebig viele Unterbereiche, Verteilungen und Verbraucheranlagen enthalten.

## 6.2 Standortaufnahme

Für jeden Standort müssen folgende Daten erfassbar sein:

- Standortbezeichnung
- Adresse
- Standortnummer
- Ansprechpartner
- Standorttyp
- Betriebszeiten
- Arbeitstage
- Schichtmodell
- Produktionszeiten
- Nutzfläche
- Beheizte Fläche
- Baujahr, sofern relevant
- Relevante technische Besonderheiten
- Energieträger
- Vorhandene Hauptzähler
- Vorhandene Unterzähler
- Vorhandene Versorgungssysteme
- Vorhandene technische Dokumentation
- Fotos
- Freitextnotizen

Zusätzliche individuelle Datenfelder sollen administrativ ergänzt werden können.

## 6.3 Gebäudeaufnahme

Gebäude müssen eigene Stammdaten besitzen.

Dazu gehören beispielsweise:

- Gebäudebezeichnung
- Gebäudenummer
- Gebäudenutzung
- Fläche
- Baujahr
- Beheizungsart
- Kühlungsart
- Beleuchtungstechnik
- Nutzungszeiten
- Besondere Verbraucher
- Zugeordnete Messstellen
- Zugeordnete technische Anlagen

Gebäude müssen unabhängig voneinander ausgewertet werden können, sofern die Messdaten dies ermöglichen.

## 6.4 Verbraucherstruktur

Der Administrator muss beim ersten Kundenbesuch eine vollständige technische Verbraucherstruktur aufbauen können.

Die Struktur muss flexibel und individuell erweiterbar sein.

Beispiel:

Standort 1  
→ Produktionshalle  
→ Unterverteilung UV-01  
→ Beleuchtung Produktionshalle  
→ LED-Hallenstrahler  
→ 24 Stück  
→ 150 W je Leuchte

Weiteres Beispiel:

Standort 1  
→ Werkstatt  
→ Unterverteilung UV-02  
→ Beleuchtung Werkstatt  
→ Konventionelle Leuchtstofflampen  
→ 36 Stück  
→ 58 W je Leuchtmittel

Bei der Beleuchtung muss zwischen Leuchtmittelleistung und tatsächlicher elektrischer Systemleistung unterschieden werden können.

Vorschaltgeräte und zusätzliche Verluste müssen bei Bedarf berücksichtigt werden.

## 6.5 Individuelle Verbraucher

Für jeden Verbraucher sollen mindestens folgende Daten erfassbar sein:

- Verbraucher-ID
- Bezeichnung
- Verbrauchertyp
- Übergeordnete Anlage
- Hersteller
- Modell
- Baujahr
- Anzahl
- Nennleistung
- Einheit
- Betriebsstunden
- Betriebstage
- Lastfaktor
- Geschätzter Jahresverbrauch
- Messwertbasierter Jahresverbrauch, falls verfügbar
- Zugeordnete Messstelle
- Technische Bemerkungen
- Fotos
- Dokumente

Unterstützte Verbraucherarten sollen unter anderem sein:

Beleuchtung, Motoren, Pumpen, Lüftungsanlagen, Kompressoren, Druckluftsysteme, Heizungen, Kälteanlagen, Klimaanlagen, Produktionsmaschinen, IT-Technik und sonstige Verbraucher.

Individuelle Verbrauchertypen müssen durch den Administrator ergänzt werden können.

## 6.6 Berechnung elektrischer Verbraucher

Die Anwendung soll aus Anzahl, elektrischer Leistung und Betriebsstunden einen rechnerischen Energiebedarf ermitteln können.

Beispiel:

24 LED-Leuchten mit jeweils 150 W ergeben:

Gesamte installierte Leistung = 3,6 kW.

Bei 2.000 Betriebsstunden pro Jahr:

Theoretischer Jahresverbrauch = 7.200 kWh.

Diese Ergebnisse sind als rechnerische Schätzungen zu kennzeichnen.

Derartige Schätzwerte dürfen nicht mit tatsächlich gemessenen Verbräuchen gleichgesetzt werden.

Lastfaktoren und zeitliche Nutzungsmuster müssen berücksichtigt werden können.

Die Datenstruktur soll für spätere Simulationen geeignet sein.

# 7. MESSSTELLEN- UND ZÄHLERVERWALTUNG

## 7.1 Unterstützte Medien

Der Administrator muss Messstellen für folgende Medien anlegen können:

- Elektrische Energie
- Wasser
- Erdgas
- Wärme
- Kälte

Zusätzlich ist ein Modul für den Fuhrpark vorzusehen.

Die Architektur muss weitere Energieträger ermöglichen.

## 7.2 Messstellenstammdaten

Jede Messstelle benötigt mindestens:

- Eindeutige Messstellen-ID
- Messstellenbezeichnung
- Kunde
- Standort
- Gebäude
- Bereich
- Medium
- Messgröße
- Maßeinheit
- Zählertyp
- Zählernummer
- Hersteller
- Modell
- Einbaudatum
- Zählerfaktor
- Zählerauflösung
- Anzahl der Nachkommastellen
- Obergrenze des Zählwerks, sofern vorhanden
- Messrichtung
- Ableseintervall
- Aktivstatus
- Technische Bemerkungen

Zusätzliche Angaben:

- Hauptzähler oder Unterzähler
- Übergeordnete Messstelle
- Nachgeordnete Messstellen
- Zugeordneter Verbraucherbereich
- Versorger
- Tarifbezug

Die Berechtigungen der Kundenbenutzer werden auf Ebene der freigegebenen Messstellen beziehungsweise Standorte geprüft.

## 7.3 Trennung zwischen Messstelle und Zählergerät

Eine Messstelle ist ein dauerhaft bestehender logischer Messpunkt.

Ein physisches Zählergerät kann ausgetauscht werden.

Deshalb müssen diese beiden Objekte getrennt gespeichert werden.

Ein Zählertausch darf die Identität der Messstelle nicht verändern.

Die historischen Zählergeräte und deren Messwerte müssen nachvollziehbar bleiben.

## 7.4 Zählerhierarchie

Die Anwendung muss Haupt- und Unterzähler verwalten können.

Beispiel:

Strom Hauptzähler  
├── Unterzähler Produktionshalle  
├── Unterzähler Büro  
└── Unterzähler Werkstatt

Die Zuordnung muss zeitlich versioniert sein.

Wenn ein Unterzähler später an einem anderen Standort eingesetzt oder einer anderen Hauptmessstelle zugeordnet wird, darf die historische Zuordnung nicht überschrieben werden.

## 7.5 Energiebilanzierung

Das System muss den Verbrauch einer Hauptmessstelle mit den Verbrauchswerten ihrer Unterzähler vergleichen können.

Beispiel:

Hauptzähler: 100.000 kWh

Unterzähler Produktionshalle: 45.000 kWh  
Unterzähler Büro: 20.000 kWh  
Unterzähler Werkstatt: 25.000 kWh

Nicht zugeordneter Verbrauch:

10.000 kWh

Die Berechnungen müssen auf dem Verbrauch innerhalb identischer Zeiträume basieren.

Es dürfen nicht die absoluten Zählerstände voneinander subtrahiert werden.

Doppelzählungen müssen verhindert werden.

Unterzähler dürfen bei der Standortgesamtbilanz nicht erneut zum Hauptzählerverbrauch addiert werden.

Die Software muss unvollständige Messintervalle erkennen und kennzeichnen.

Für die Bilanzierung müssen Messrichtung, Einheiten, Messfaktoren und zeitliche Messstellenzuordnungen berücksichtigt werden.

Umrechnungen zwischen unterschiedlichen Energieeinheiten dürfen nur auf Basis definierter Umrechnungsregeln stattfinden.

Die Bilanzierung verschiedener Medien ist getrennt durchzuführen.

# 8. KUNDENPORTAL

## 8.1 Grundprinzip

Das Kundenportal muss bewusst einfach gehalten werden.

Der Kunde soll keine technisch überladene Energiemanagementoberfläche erhalten.

Die erste Version dient hauptsächlich zur manuellen Erfassung von Zählerständen.

Der Kunde darf keine administrativen Funktionen sehen.

Nicht freigegebene Funktionen dürfen auch nicht über direkte API-Aufrufe erreichbar sein.

## 8.2 Grundlayout

Das Layout besteht aus:

**Links:** Einklappbare Sidebar.

**Rechts:** Hauptarbeitsbereich.

**Oben links:** Quadratisches Firmenlogo.

**Oben rechts:** Angemeldeter Benutzer.

Das Logo dient gleichzeitig zum Ein- und Ausklappen der Sidebar.

Die Bedienbarkeit dieser Funktion muss visuell erkennbar sein.

Die Sidebar zeigt die durch den Administrator angelegte Messstellenstruktur.

Beispiel:

Standort Bremen  
├── Gebäude 1  
│   ├── Strom  
│   │   ├── Hauptzähler  
│   │   ├── Büro  
│   │   └── Werkstatt  
│   ├── Wasser  
│   └── Wärme  
└── Gebäude 2  
    ├── Strom  
    └── Gas

Die Darstellung erfolgt über einen übersichtlichen, aufklappbaren Strukturbaum.

Der Kunde kann eine Messstelle auswählen.

Danach öffnet sich rechts die entsprechende Eingabemaske.

## 8.3 Zählerstandserfassung

Die Eingabemaske enthält:

**Messstelle:** Vorausgewählt und nicht frei manipulierbar.

**Datum:** Datum der tatsächlichen Ablesung.

**Uhrzeit:** Uhrzeit der tatsächlichen Ablesung.

**Zählerstand:** Numerisches Eingabefeld mit korrekter Einheit.

**Kommentar:** Optionales Textfeld.

**Besonderes Ereignis:** Auswahlfeld.

**Foto aufnehmen:** Kamerafunktion beziehungsweise Bild-Upload.

**Zählertausch:** Checkbox.

**Speichern:** Deutlich erkennbarer Button.

Ereignistypen:

- Wartung
- Reparatur
- Produktionsstillstand
- Außergewöhnlicher Verbrauch
- Betriebsurlaub
- Technische Störung
- Zählertausch
- Sonstiges Ereignis

Der Kunde kann einen frei formulierten Kommentar hinzufügen.

Datum und Uhrzeit werden mit dem aktuellen Zeitpunkt vorbelegt, müssen jedoch bearbeitbar sein.

Das System muss zwischen Ablesezeitpunkt und tatsächlichem Speicherzeitpunkt unterscheiden.

## 8.4 Plausibilitätsprüfung

Jeder eingetragene Zählerstand muss serverseitig überprüft werden.

Die Prüfung umfasst:

- Gültige numerische Eingabe
- Zulässige Dezimalstellen
- Zulässige Wertebereiche
- Plausibler zeitlicher Verlauf
- Vergleich mit dem vorherigen Zählerstand
- Vergleich mit historischen Verbrauchswerten
- Prüfung von Zählerfaktoren
- Prüfung auf doppelte Einträge
- Prüfung auf außergewöhnliche Verbrauchsänderungen
- Erkennung negativer Zählerstandsdifferenzen
- Erkennung einer möglichen Zählwerksüberlaufung

Unplausible Werte dürfen nicht kommentarlos übernommen werden.

Es muss zwischen drei Ergebnissen unterschieden werden:

**Gültig:** Wert kann gespeichert werden.

**Auffällig:** Benutzer erhält eine Warnung und kann den Wert nach erneuter Prüfung gegebenenfalls mit Begründung bestätigen.

**Ungültig:** Eingabe wird abgelehnt.

Eine auffällige Eingabe muss im Administrationsbereich sichtbar sein.

Plausibilitätsgrenzen sollen pro Messstelle konfigurierbar sein.

Historische Vergleichswerte dürfen erst verwendet werden, wenn eine ausreichend belastbare Datengrundlage besteht.

Bei fehlenden Vergleichswerten dürfen keine scheinbar präzisen Auffälligkeitsbewertungen erfunden werden.

## 8.5 Zählertausch

Bei Aktivierung der Checkbox „Zählertausch“ erscheint ein erweitertes Formular.

Dieses enthält:

- Datum und Uhrzeit des Tauschs
- Ausbauzähler
- Alter Endzählerstand
- Neue Zählernummer
- Neuer Anfangszählerstand
- Optional neuer Hersteller
- Optional neuer Zählerfaktor
- Grund des Tauschs
- Kommentar
- Optional Foto des alten Zählers
- Optional Foto des neuen Zählers

Die Messstelle bleibt erhalten.

Das alte Zählergerät wird historisch abgeschlossen.

Das neue Zählergerät wird der Messstelle zugeordnet.

Verbräuche vor und nach dem Austausch werden getrennt je Geräteperiode berechnet und anschließend bei ausreichenden Daten zeitlich korrekt zusammengeführt.

**Es darf niemals eine normale Verbrauchsdifferenz zwischen altem Endzählerstand und neuem Anfangszählerstand berechnet werden.**

Fehlen die erforderlichen Austauschwerte, muss der betroffene Verbrauchszeitraum als unvollständig gekennzeichnet werden.

## 8.6 Fotoaufnahme

Der Benutzer kann ein Foto des Zählers erstellen oder hochladen.

Die Funktion muss auf Smartphones über die geräteeigene Kamera nutzbar sein.

Auf Desktopgeräten muss alternativ der Upload einer Bilddatei funktionieren.

Bilder werden gespeichert und mit der jeweiligen Ablesung verknüpft.

Vorzusehen sind:

- Bildgrößenbegrenzung
- Zulässige Dateitypen
- Sichere Verarbeitung
- Geschützter Dateizugriff
- Bildvorschau
- Fehlerbehandlung beim Upload
- Datenschutzgerechte Behandlung von Bildmetadaten

Eine automatische Zählerstanderkennung ist zunächst nicht erforderlich, soll später jedoch integriert werden können.

## 8.7 Eingabehistorie für Kunden

Der Kunde soll eine einfache Liste seiner gespeicherten Zählerstände einsehen können.

Darstellung:

Datum | Uhrzeit | Messstelle | Zählerstand | Einheit | Status

Korrekturen müssen nachvollziehbar bleiben.

Bereits gespeicherte Werte dürfen nicht unprotokolliert überschrieben werden.

# 9. FUHRPARKMANAGEMENT

Die Plattform benötigt ein separates Modul zur Erfassung von Fahrzeugdaten.

## 9.1 Fahrzeugstammdaten

Der Administrator kann Fahrzeuge anlegen.

Felder:

- Fahrzeug-ID
- Kennzeichen
- Fahrzeugbezeichnung
- Hersteller
- Modell
- Fahrzeugtyp
- Antriebsart
- Kraftstoffart
- Standortzuordnung
- Erstzulassung
- Kilometerstand bei Aufnahme
- Bemerkungen

## 9.2 Verbrauchserfassung

Kundenbenutzer können folgende Werte eingeben:

- Datum
- Uhrzeit, falls erforderlich
- Kilometerstand
- Getankte Kraftstoffmenge
- Kraftstoffart
- Kosten
- Volltankung ja/nein
- Kommentar
- Optional Belegfoto

Bei Elektrofahrzeugen muss alternativ eine geladene Energiemenge in kWh erfassbar sein.

## 9.3 Auswertung

Die Software soll bei ausreichend geeigneten Datensätzen folgende Kennzahlen berechnen:

- Gefahrene Kilometer
- Kraftstoffverbrauch
- Kraftstoffkosten
- Durchschnittlicher Verbrauch
- Verbrauch je 100 km
- Energiekosten je Kilometer

Der tatsächliche Durchschnittsverbrauch aus Tankvorgängen ist nur bei einer geeigneten Datenbasis zuverlässig berechenbar.

Unvollständige Tankvorgänge und nicht dokumentierte Betankungen müssen bei der Berechnung berücksichtigt werden.

Kilometerstandsrücksetzungen und Fahrzeugwechsel dürfen historische Ergebnisse nicht verfälschen.

# 10. HISTORISIERUNG UND AUDIT-LOGGING

Die Anwendung muss sämtliche fachlich relevanten Änderungen nachvollziehbar dokumentieren.

Zählerstände, Stammdatenänderungen, Zählertauschvorgänge, Maßnahmenänderungen und administrative Aktionen benötigen eine zuverlässige Historie.

Für veränderbare Datensätze ist eine Versionierung vorzusehen.

Beispiel:

Version 1: Zählerstand 12.450 kWh  
Version 2: Korrektur auf 12.540 kWh

Beide Zustände bleiben nachvollziehbar.

Zu dokumentieren sind:

- Ursprünglicher Wert
- Neuer Wert
- Ändernder Benutzer
- Änderungszeitpunkt
- Änderungsgrund
- Betroffener Datensatz

Löschungen fachlich relevanter Datensätze erfolgen grundsätzlich als nachvollziehbare Deaktivierung, Stornierung oder versionierte Korrektur.

Gesetzlich erforderliche Löschungen personenbezogener Daten und festgelegte Aufbewahrungsfristen müssen trotzdem umsetzbar bleiben.

Audit-Logs dürfen nicht mit normalen technischen Debug-Logs vermischt werden.

Technische Logs müssen bei Bedarf automatisch bereinigt werden können.

# 11. ENERGIEDATEN UND AUSWERTUNGEN

## 11.1 Verbrauchsberechnung

Die Software muss aus aufeinanderfolgenden Zählerständen den tatsächlichen Verbrauch berechnen.

Die Berechnung berücksichtigt:

- Ablesezeitpunkt
- Zählerstand
- Messfaktor
- Gerätestatus
- Zählertausch
- Zählerüberlauf
- Messrichtung
- Mögliche Messwertkorrekturen

Messwerte und berechnete Verbräuche müssen getrennt gespeichert beziehungsweise eindeutig getrennt bereitgestellt werden.

Die Originalmesswerte bleiben erhalten.

## 11.2 Datenqualität

Jeder Messwert muss einen Qualitätsstatus erhalten können.

Beispiele:

- Manuell erfasst
- Automatisch importiert
- Plausibilisiert
- Auffällig
- Geschätzt
- Korrigiert
- Unvollständig
- Technisch ungültig

Geschätzte Daten müssen grundsätzlich als Schätzung erkennbar bleiben.

## 11.3 Grafische Auswertung

Im Administrationsbereich muss ein frei konfigurierbares Diagrammmodul entstehen.

Mögliche Diagrammtypen:

- Liniendiagramm
- Balkendiagramm
- Gestapeltes Balkendiagramm
- Flächendiagramm
- Vergleichsdiagramm
- Zeitreihendarstellung
- Verbrauchsverteilung
- Standortvergleich
- Soll-Ist-Vergleich

Der Administrator kann auswählen:

- Kunde
- Standort
- Gebäude
- Messstelle
- Medium
- Zeitraum
- Vergleichszeitraum
- Diagrammtyp
- Aggregationsintervall
- Einheiten
- Diagrammtitel

Die Software darf unterschiedliche Messintervalle nicht ohne erkennbare Datenqualitätsregeln vergleichen.

Bei unvollständigen Daten müssen Diagramme die Datenlücken kenntlich machen.

## 11.4 Energiekosten

Die Software muss Energiepreise und Tarife verwalten können.

Vorzusehen sind:

- Preis pro Verbrauchseinheit
- Grundpreis
- Abrechnungszeitraum
- Gültigkeitsbeginn
- Gültigkeitsende
- Optional Leistungspreis
- Weitere Kostenbestandteile
- Steuerliche Behandlung
- Währung

Historische Preise müssen erhalten bleiben.

Kostenberechnungen müssen sich auf den jeweils gültigen Tarif beziehen.

# 12. ENERGIEABRECHNUNGEN DER VERSORGER

Beim ersten Kundenbesuch sollen die vorhandenen Energieabrechnungen erfasst werden können.

Der Administrator muss Versorgerrechnungen hochladen und deren Inhalte strukturiert übertragen können.

## 12.1 Rechnungsinformationen

Folgende Daten sollen mindestens erfassbar sein:

- Kunde
- Standort
- Versorger
- Vertragsnummer
- Rechnungsnummer
- Medium
- Abrechnungsbeginn
- Abrechnungsende
- Verbrauch
- Einheit
- Arbeitspreis
- Grundpreis
- Leistungspreis, sofern vorhanden
- Weitere Abgaben und Preisbestandteile
- Netto-Gesamtkosten
- Umsatzsteuer
- Brutto-Gesamtkosten
- Rechnungsdokument

Die Datenerfassung erfolgt zunächst manuell.

Später soll eine KI-gestützte Dokumentenauslesung möglich sein.

Automatisch ausgelesene Rechnungsdaten müssen vor ihrer fachlichen Übernahme überprüft werden können.

## 12.2 Historische Rechnungen

Die Anwendung muss mehrere Abrechnungsjahre verwalten können.

Beispielsweise:

2023  
2024  
2025  
2026

Historische Rechnungen dürfen nicht überschrieben werden.

## 12.3 Kosten- und Verbrauchsanalyse

Die Plattform soll ermöglichen:

- Jahresverbrauchsvergleich
- Kostenvergleich
- Preisentwicklung
- Verbrauchsentwicklung
- Spezifische Energiekosten
- Erkennung auffälliger Veränderungen
- Vergleich von Rechnungsmengen und eigenen Messdaten

Unterschiede zwischen Versorgerabrechnung und interner Messdatenerfassung müssen als solche ausgewiesen werden.

Die Anwendung darf fehlende Messdaten nicht ohne Kennzeichnung durch Rechnungswerte ersetzen.

# 13. PDCA-MASSNAHMENMANAGEMENT

Das Maßnahmenmanagement ist ein zentrales Geschäftsmodul.

Die Plattform muss den vollständigen Verbesserungsprozess nach dem PDCA-Prinzip unterstützen.

## 13.1 PLAN – Maßnahmen planen

Der Administrator kann eine neue Einsparmaßnahme erstellen.

Felder:

- Maßnahmen-ID
- Kunde
- Standort
- Gebäude
- Betroffene Anlage
- Maßnahmenbezeichnung
- Ausgangssituation
- Beschreibung des Einsparpotenzials
- Vorgeschlagene technische Lösung
- Erwartete Energieeinsparung
- Erwartete Kosteneinsparung
- Geschätzte Investition
- Erwartete Amortisationsdauer
- Priorität
- Verantwortlicher
- Geplanter Umsetzungstermin
- Status
- Bemerkungen
- Dokumente

Die erwartete Einsparung kann aus Messdaten, technischen Berechnungen oder fachlich begründeten Annahmen ermittelt werden.

Die Berechnungsmethode ist zu dokumentieren.

## 13.2 DO – Umsetzung

Nach Freigabe kann eine Maßnahme in den Status „In Umsetzung“ wechseln.

Die Umsetzung wird dokumentiert.

Erfasst werden:

- Tatsächlicher Umsetzungsbeginn
- Tatsächliches Umsetzungsende
- Ausgeführte Arbeiten
- Tatsächliche Investitionskosten
- Dienstleister
- Eingebaute Komponenten
- Fotos vorher/nachher
- Technische Dokumentation
- Abweichungen von der Planung

## 13.3 CHECK – Überprüfung

Nach Umsetzung soll die Wirksamkeit der Maßnahme geprüft werden.

Hierzu werden geeignete Verbrauchswerte vor und nach der Umsetzung verglichen.

Die Software muss eine Referenzperiode und eine Vergleichsperiode definieren können.

Beispiel:

Maßnahme: Beleuchtungsaustausch.

Referenzverbrauch: 25.000 kWh/Jahr.

Erwarteter Verbrauch nach Umstellung: 12.000 kWh/Jahr.

Prognostizierte Einsparung: 13.000 kWh/Jahr.

Später wird der tatsächlich gemessene Verbrauch herangezogen.

Wichtig:

Wenn Produktionsmengen, Betriebszeiten oder andere Einflussgrößen den Verbrauch wesentlich beeinflussen, muss die Software entsprechende Anpassungen und eine belastbare Vergleichsmethodik ermöglichen.

Eine bloße Verbrauchsverringerung darf nicht automatisch als kausal nachgewiesene Einsparung ausgegeben werden.

## 13.4 ACT – Verbesserung

Nach der Bewertung wird die Maßnahme abgeschlossen, angepasst oder in eine neue Verbesserungsrunde überführt.

Die Anwendung dokumentiert:

- Erreichte Einsparung
- Abweichung zur Planung
- Wirtschaftliches Ergebnis
- Technische Bewertung
- Weitere Handlungsempfehlungen
- Folgemaßnahmen

## 13.5 Maßnahmenübersicht

Der Administrator benötigt eine zentrale Maßnahmenliste.

Mögliche Status:

- Idee
- Potenzial erkannt
- In Prüfung
- Geplant
- Angebot erstellt
- Vom Kunden freigegeben
- In Umsetzung
- Umgesetzt
- In Wirksamkeitsprüfung
- Erfolgreich abgeschlossen
- Abgelehnt
- Zurückgestellt

Die Maßnahmen sollen filterbar und priorisierbar sein.

# 14. ENERGIEBERICHTE UND DOKUMENTATION

Die Berichtserstellung muss professionell und für die direkte Weitergabe an Geschäftskunden geeignet sein.

Die Software soll Dokumente selbstständig aus den vorhandenen Daten erzeugen können.

## 14.1 Dokumenttypen

Vorzusehen sind:

- Technischer Standortaufnahmebericht
- Anlagenkataster
- Zählerverzeichnis
- Verbraucherstruktur
- Energieverbrauchsbericht
- Energiekostenbericht
- Jahresvergleich
- Maßnahmenkatalog
- Einsparpotenzialanalyse
- Umsetzungsbericht
- Wirksamkeitsnachweis
- Regelmäßiger Energiereport

## 14.2 Berichtsgestaltung

Jeder Bericht besitzt ein professionelles Corporate Design.

Gestaltung:

- Firmenlogo
- Einheitliche Typografie
- Grau-orange Akzentfarben
- Weißer Hintergrund
- Klare Tabellen
- Hochwertige Diagramme
- Einheitliche Kopf- und Fußzeilen
- Automatische Seitenzahlen
- Dokumentdatum
- Kundendaten
- Standortbezeichnung
- Dokumentversion

Bei umfangreichen Dokumenten:

- Deckblatt
- Inhaltsverzeichnis
- Zusammenfassung
- Datengrundlage
- Technische Bewertung
- Ergebnisse
- Maßnahmen
- Anlagen

Diagramme müssen in hoher Auflösung beziehungsweise als geeignete Vektorgrafik ausgegeben werden.

Die Berichte dürfen nicht wie einfache Browserausdrucke wirken.

## 14.3 Exportfunktionen

Jede geeignete Dokumentation muss als PDF und gegebenenfalls Excel-Datei exportiert werden können.

Excel-Exporte sollen:

- Strukturierte Tabellenblätter
- Professionelle Formatierung
- Filterfunktionen
- Geeignete Zahlenformate
- Datenquelleninformationen
- Nachvollziehbare Berechnungsgrundlagen

enthalten.

## 14.4 Berichtsvorlagen

Berichte werden aus wiederverwendbaren Vorlagen erstellt.

Der Administrator kann definieren:

- Titel
- Berichtszeitraum
- Enthaltene Standorte
- Enthaltene Messstellen
- Diagramme
- Tabellen
- Maßnahmen
- Textbausteine

Die Berichtserstellung soll später zeitgesteuert automatisiert werden können.

# 15. KAUFMÄNNISCHE VERWALTUNG

Die Plattform soll langfristig auch die kaufmännische Abwicklung des eigenen Dienstleistungsunternehmens übernehmen.

Alle Vorgänge müssen mit der zentralen Kundenakte verbunden sein.

## 15.1 Angebotserstellung

Administratoren können Angebote erstellen.

Angebotsdaten:

- Angebotsnummer
- Kunde
- Standort
- Ansprechpartner
- Angebotsdatum
- Gültigkeitsdauer
- Leistungsbeschreibung
- Einzelpositionen
- Menge
- Einheit
- Einzelpreis
- Gesamtpreis
- Umsatzsteuer
- Zahlungsbedingungen
- Bemerkungen

Angebote müssen professionelle PDF-Dokumente erzeugen.

Maßnahmen aus dem Maßnahmenmanagement sollen später direkt in Angebotspositionen überführt werden können.

## 15.2 Aufträge

Aus akzeptierten Angeboten können Aufträge erstellt werden.

Angebot und Auftrag bleiben miteinander verbunden.

## 15.3 Rechnungen

Aus abgeschlossenen Leistungen sollen Rechnungen erstellt werden können.

Erforderlich sind:

- Eindeutige Rechnungsnummern
- Rechnungsdatum
- Leistungsdatum oder Leistungszeitraum
- Kundendaten
- Rechnungspositionen
- Steuerinformationen
- Gesamtbetrag
- Zahlungsziel
- Rechnungsstatus
- Dokumentarchiv

Die Architektur ist auf strukturierte elektronische Rechnungsformate vorzubereiten.

Für den deutschen Geschäftsbetrieb sind insbesondere XRechnung und ZUGFeRD sowie die jeweils geltenden Anforderungen an elektronische Rechnungen zu berücksichtigen.

Die rechtliche und steuerliche Konformität ist vor dem Produktiveinsatz gesondert zu prüfen.

## 15.4 Dokumentenverknüpfung

Angebote, Aufträge, Rechnungen und Maßnahmen sollen gegenseitig referenzierbar sein.

Beispiel:

Kunde  
→ Standort  
→ Einsparmaßnahme  
→ Angebot  
→ Auftrag  
→ Rechnung  
→ Umsetzungsdokumentation  
→ Wirksamkeitsprüfung

# 16. AUTOMATISCHE ZÄHLERABLESEERINNERUNG

Das System benötigt eine automatisierte Erinnerungsfunktion.

## 16.1 Grundeinstellung

Standardmäßig sollen Kunden einmal monatlich per E-Mail an die Zählerablesung erinnert werden.

Der Zeitpunkt muss pro Kunde einstellbar sein.

Beispielsweise:

Jeden Monat am ersten Werktag.

## 16.2 Erinnerungsinhalt

Die Nachricht enthält:

- Firmenname
- Kundenansprache
- Aufforderung zur Zählerablesung
- Liste relevanter Messstellen beziehungsweise Anzahl offener Ablesungen
- Gewünschten Ablesetermin
- Sicheren Link zur Kundenplattform

## 16.3 Erweiterte Erinnerungen

Optional:

- Erneute Erinnerung nach definierter Frist
- Benachrichtigung des Administrators
- Übersicht über ausstehende Ablesungen

Der Versand muss protokolliert werden.

Doppelte E-Mails aufgrund technischer Wiederholungen müssen verhindert werden.

In der lokalen Entwicklungsumgebung ist ein Test-E-Mail-System zu verwenden, das keine echten Nachrichten an Kunden verschickt.

# 17. SPÄTERE AUTOMATISIERTE DATENIMPORTFUNKTION

Die Plattform muss bereits strukturell für automatisierte Messdaten vorbereitet werden.

In einem späteren Entwicklungsschritt sollen Messwerte beispielsweise im 15-Minuten-Takt importiert werden können.

Mögliche Datenquellen:

- CSV
- Excel
- REST-API
- Energiemanagementsysteme
- Gebäudeleittechnik
- IoT-Gateways
- Externe Messdatendienstleister

Für die erste Ausbaustufe genügt ein konzipierter und dokumentierter Importmechanismus.

## 17.1 Importanforderungen

- Zuordnung zu einer Messstelle
- Zeitstempel
- Messwert
- Einheit
- Datenquelle
- Importzeitpunkt
- Qualitätsstatus
- Fehlerstatus

Bei Importen muss zwischen kumulierten Zählerständen, Intervallverbräuchen und Leistungswerten unterschieden werden.

Diese Größen dürfen nicht miteinander verwechselt werden.

## 17.2 Zeitreihen

Intervallmessungen müssen zeitlich korrekt gespeichert werden.

Die Speicherung soll UTC-Zeitstempel verwenden.

Die Darstellung erfolgt in der jeweiligen Standortzeitzone.

Sommerzeitwechsel dürfen keine doppelten oder falsch zugeordneten Messintervalle verursachen.

Große Datenmengen müssen effizient verarbeitet werden können.

# 18. SPÄTERE KI-INTEGRATION

Die Software ist so aufzubauen, dass künftig KI-Funktionen integriert werden können.

Die KI-Funktionen dürfen nicht unmittelbar und unkontrolliert operative Messwerte verändern.

Mögliche Erweiterungen:

**Anomalieerkennung**

Automatische Erkennung ungewöhnlicher Verbrauchsverläufe.

**Potenzialanalyse**

Identifikation auffälliger Grundlasten, ungewöhnlicher Betriebszeiten und technischer Optimierungsmöglichkeiten.

**Automatische Berichtstexte**

Erstellung fachlicher Berichtsentwürfe auf Basis validierter Kennzahlen.

**Rechnungsanalyse**

Strukturierte Auslesung hochgeladener Versorgerrechnungen.

**Fotoerkennung**

Auslesen von Zählerständen anhand fotografierter Zähler.

**Maßnahmenvorschläge**

Vorschläge zur Energieeinsparung auf Basis vorhandener Mess- und Anlageninformationen.

**Verbrauchsprognosen**

Prognose zukünftiger Verbrauchswerte bei ausreichender Datenbasis.

## 18.1 Anforderungen an KI-Funktionen

- KI-Funktionen müssen einzeln aktivierbar sein.
- Automatisierte Vorschläge sind zu kennzeichnen.
- Der Administrator muss Ergebnisse bestätigen können.
- Die Berechnungsgrundlagen müssen nachvollziehbar sein.
- Verwendete Datenquellen und Modellversionen müssen dokumentierbar sein.
- Kundendaten dürfen nicht unkontrolliert an externe KI-Dienstleister übertragen werden.
- Eine spätere Anbindung an geeignete Azure-KI-Dienste muss möglich sein.
- KI-Ausgaben dürfen keine gemessenen Werte ersetzen.

Die Plattform muss ohne KI vollständig funktionsfähig bleiben.

# 19. BENUTZEROBERFLÄCHE UND CORPORATE DESIGN

## 19.1 Designphilosophie

Die Anwendung muss wie eine hochwertige industrielle B2B-Software wirken.

Orientiere dich an der sachlichen, funktionalen Designsprache professioneller technischer Anwendungen.

Vermeide ausdrücklich das Erscheinungsbild typischer KI-generierter SaaS-Dashboards.

Nicht gewünscht sind:

- Übermäßige Farbverläufe
- Bunte Dashboardkarten
- Unnötige Animationen
- Dekorative 3D-Elemente
- Überdimensionierte Icons
- Verspielte Benutzerführung
- Unnötig große Rundungen
- Ineffiziente Flächennutzung

Gewünscht sind:

- Klare Linien
- Präzise Abstände
- Hochwertige Typografie
- Konsequent einheitliche Tabellen
- Schlichte Bedienelemente
- Funktionale Icons
- Ruhige Gestaltung
- Klare Informationshierarchie
- Gute Lesbarkeit
- Hohe Informationsdichte im Administrationsbereich

## 19.2 Farbgestaltung

Das Design orientiert sich am bestehenden Firmenlogo.

Primärfarben:

- Dunkelgrau
- Mittelgrau
- Orange
- Weiß

Vorgeschlagene Ausgangswerte:

Dunkelgrau: `#34383D`  
Mittelgrau: `#858B91`  
Akzentorange: `#F28C28`  
Hintergrund: `#F5F6F7`  
Weiß: `#FFFFFF`

Die Farbwerte müssen später einfach an das endgültige Logo angepasst werden können.

Orange dient als Akzentfarbe.

Die Oberfläche soll hauptsächlich in Grau- und Weißtönen gestaltet werden.

Warnungen, Fehler und Erfolgsmeldungen erhalten eigene, zurückhaltende Statusfarben.

## 19.3 Logo

Das Logo ist quadratisch.

Es befindet sich links oben in der Anwendung.

Das Logo soll als eigenständige Datei eingebunden werden können.

Es muss möglich sein, das Logo später ohne Codeänderung auszutauschen.

Ein Klick auf das Logo klappt die Sidebar ein beziehungsweise aus.

Das Branding muss zentral konfigurierbar sein.

## 19.4 Sidebar

Die Sidebar befindet sich auf Desktopgeräten links.

Sie muss folgende Eigenschaften besitzen:

- Einklappbar
- Eindeutige aktive Auswahl
- Hierarchische Darstellung
- Übersichtliche Einrückungen
- Gut erkennbare Haupt- und Unterpunkte
- Scrollbar bei langen Strukturen
- Wiederherstellung des letzten Darstellungszustands

## 19.5 Arbeitsbereich

Der Arbeitsbereich befindet sich rechts.

Er zeigt den Inhalt des ausgewählten Navigationspunkts.

Die Oberflächen sind aufgabenorientiert zu gestalten.

Beispiel Kundenportal:

Überschrift: Stromzähler Produktionshalle

Darunter:

Zählernummer: 12345678  
Letzte Ablesung: 15.10.2026  
Letzter Stand: 24.560 kWh

Darunter die neue Eingabemaske.

Alle Angaben müssen gut lesbar und sinnvoll angeordnet sein.

## 19.6 Responsive Design

Die Anwendung muss auf folgenden Geräten funktionieren:

- Desktop-PC
- Notebook
- Tablet
- Smartphone

Auf Smartphones wird die Sidebar als einklappbares Navigationsmenü dargestellt.

Die Zählerstandserfassung muss ohne horizontales Scrollen möglich sein.

Eingabefelder müssen groß genug für eine sichere Touchbedienung sein.

Numerische Felder sollen auf Smartphones die passende Bildschirmtastatur öffnen.

Datum, Uhrzeit und Fotoaufnahme müssen mobil einfach bedienbar sein.

## 19.7 Barrierearme Gestaltung

Berücksichtige:

- Ausreichende Kontraste
- Beschriftete Formularfelder
- Tastaturbedienbarkeit
- Sichtbare Fokuszustände
- Verständliche Fehlermeldungen
- Geeignete Touchgrößen
- Semantische HTML-Struktur

# 20. DATENBANKMODELL

Entwickle ein normalisiertes relationales Datenmodell.

Mindestens folgende fachliche Entitäten sind erforderlich:

**Kunden und Berechtigungen**
- Customer
- User
- CustomerUser
- Role
- Permission
- UserRole
- UserSitePermission

**Standorte und technische Strukturen**
- Site
- Building
- Area
- Distribution
- ConsumerGroup
- ConsumerAsset
- ConsumerSpecification

**Messstellen**
- MeasuringPoint
- MeterDevice
- MeterInstallation
- MeterHierarchyAssignment
- MeterReading
- MeterReadingRevision
- MeterReplacement
- MeterQualityFlag

**Energiedaten**
- IntervalMeasurement
- EnergyTariff
- EnergyPricePeriod
- EnergyBalance
- EnergyBaseline
- EnergyKpiDefinition

**Fuhrpark**
- Vehicle
- FuelEntry
- MileageEntry

**Versorgerabrechnungen**
- UtilitySupplier
- UtilityContract
- UtilityInvoice
- UtilityInvoicePosition

**Maßnahmen**
- ImprovementMeasure
- MeasureCalculation
- MeasureImplementation
- MeasureVerification

**Dokumente**
- Document
- DocumentVersion
- DocumentRelation
- ReportTemplate
- GeneratedReport

**Kaufmännische Verwaltung**
- Offer
- OfferPosition
- CustomerOrder
- Invoice
- InvoicePosition

**System**
- AuditEvent
- SystemEvent
- Notification
- ScheduledJob
- EmailDispatch
- ImportJob
- ImportRecord

Jede Entität benötigt geeignete Primärschlüssel, Fremdschlüssel, Zeitstempel und Statusinformationen.

Mandantenbezogene Entitäten müssen eindeutig einem Kunden zugeordnet werden können.

Die Datenbank muss spätere Schemaerweiterungen ohne Verlust bestehender Messwerte ermöglichen.

Für Zeitreihendaten sind geeignete Indizes und bei wachsendem Datenvolumen Partitionierungsstrategien vorzusehen.

Numerische Verbrauchs- und Kostenwerte sind mit geeigneten exakten Zahlentypen zu speichern.

Finanzbeträge dürfen nicht mit ungenauen Gleitkommazahlen berechnet werden.

# 21. SICHERHEIT UND DATENSCHUTZ

Die Plattform muss bereits während der Entwicklung grundlegende Anforderungen an eine sichere Geschäftsanwendung erfüllen.

Vorzusehen sind:

- Sichere Passwortverarbeitung
- HTTPS im produktiven Betrieb
- Serverseitige Autorisierung
- Strikte Mandantentrennung
- Validierung sämtlicher Eingaben
- Schutz gegen SQL-Injection
- Schutz gegen Cross-Site-Scripting
- Schutz gegen Cross-Site-Request-Forgery
- Schutz vor unberechtigtem Dateizugriff
- Sichere Session-Verwaltung
- Schutz vor Brute-Force-Angriffen
- Verwaltung von Geheimnissen über Umgebungsvariablen beziehungsweise Secret Stores
- Backup-Konzept
- Wiederherstellungskonzept
- Fehlerprotokollierung
- Konfigurierbare Datenaufbewahrung
- Datenschutzgerechte Export- und Löschverfahren

Kundendaten sind vertraulich zu behandeln.

Eine produktive Bereitstellung darf erst nach einer gesonderten Sicherheits- und Datenschutzprüfung erfolgen.

Die technische Umsetzung soll Datenschutzanforderungen insbesondere durch Datenminimierung, Zweckbindung und Zugriffsbeschränkung unterstützen.

# 22. LOKALE ENTWICKLUNGS- UND TESTUMGEBUNG

Die vollständige Entwicklungsumgebung soll zunächst ohne Microsoft Azure funktionieren.

Verwende Docker Compose.

Die Entwicklungsumgebung soll enthalten:

- Frontend
- Backend
- PostgreSQL
- Azurite für die Dateispeicherung
- Lokales Test-E-Mail-System
- Bei Bedarf einen Hintergrundprozess für geplante Aufgaben

Ein einziger dokumentierter Startbefehl soll die notwendigen Container starten.

Die Testumgebung benötigt keine kostenpflichtigen Cloud-Dienste.

Sämtliche Daten sollen in persistenten lokalen Volumes gespeichert werden.

Eine `.env.example` muss die erforderlichen Konfigurationswerte dokumentieren.

Vertrauliche Zugangsdaten dürfen nicht im Quellcode abgelegt werden.

## 22.1 Testdaten

Erstelle ein reproduzierbares Demo-Datenset mit:

Zwei voneinander getrennten Kunden.

Kunde A besitzt:
- Zwei Standorte
- Mehrere Gebäude
- Einen Stromhauptzähler
- Drei Stromunterzähler
- Einen Wasserzähler
- Einen Gaszähler
- Einen Wärmezähler
- Einen Kältezähler
- Zwei Fahrzeuge
- Mehrere Verbrauchergruppen

Kunde B besitzt:
- Einen Standort
- Ein Gebäude
- Mehrere Messstellen

Erstelle Testbenutzer mit unterschiedlichen Berechtigungen.

Beide Kunden müssen vollständig voneinander getrennt sein.

Die Testdaten sollen realistische Messwertverläufe enthalten.

Zusätzlich sind gezielte Prüfszenarien vorzusehen:

- Normaler Zählerstand
- Auffällig hoher Verbrauch
- Fehlerhaft niedriger Zählerstand
- Zählertausch
- Fehlende Ablesung
- Korrektur eines gespeicherten Werts
- Doppelte Eingabe
- Unvollständige Messreihe

# 23. TESTS UND QUALITÄTSSICHERUNG

Implementiere automatisierte Tests.

Mindestens:

**Authentifizierung**

Prüfe Anmeldung, Passwortwechsel, Passwort-Reset und Sitzungsbeendigung.

**Mandantentrennung**

Ein Benutzer von Kunde A darf niemals Daten von Kunde B lesen oder verändern.

Prüfe ausdrücklich manipulierte API-Anfragen mit fremden Datensatz-IDs.

**Zählerberechnung**

Prüfe korrekte Verbrauchsdifferenzen.

**Zählertausch**

Prüfe, dass der Unterschied zwischen altem und neuem Zählergerät nicht als Verbrauch interpretiert wird.

**Unterzähler**

Prüfe korrekte Summen und Restverbräuche.

**Plausibilität**

Prüfe normale, auffällige und ungültige Werte.

**Historisierung**

Prüfe, dass Änderungen nachvollziehbar bleiben.

**Benachrichtigungen**

Prüfe monatliche Erinnerungen und Schutz gegen Doppelversand.

**Dokumentenexport**

Prüfe, dass PDF- und Excel-Dateien tatsächlich erzeugt werden.

**Responsive Bedienung**

Prüfe die wichtigsten Arbeitsabläufe auf Desktop- und Smartphone-Bildschirmgrößen.

# 24. ENTWICKLUNGSREIHENFOLGE

Entwickle die Plattform in klar definierten Phasen.

## PHASE 1 – Technisches Fundament

Ziel: Eine dauerhaft nutzbare Basis.

Umfang:

- Projektstruktur
- Datenbank
- Backend
- Frontend
- Docker Compose
- Authentifizierung
- Rollen und Berechtigungen
- Mandantentrennung
- Benutzerverwaltung
- Kundenverwaltung
- Administrationsoberfläche
- Responsive Grundlayout
- Sidebar
- Logo
- Audit-Logging

Ergebnis:

Eine lokal startbare Webanwendung mit funktionierender Anmeldung und echter Kundenverwaltung.

## PHASE 2 – Standort- und Zählerverwaltung

Umfang:

- Standorte
- Gebäude
- Bereiche
- Messstellen
- Haupt- und Unterzähler
- Zuordnung der Messstellen
- Historisierung der technischen Struktur
- Kundenportal
- Manuelle Zählerstandserfassung
- Plausibilitätsprüfung
- Zählertausch
- Fotoaufnahme
- Zählerstandshistorie

Ergebnis:

Ein Kunde kann sich anmelden und reale Zählerstände seiner freigegebenen Messstellen erfassen.

## PHASE 3 – Technisches Anlagenkataster

Umfang:

- Individuelle Verbraucherstruktur
- Verteilungen
- Beleuchtungsanlagen
- Motoren
- Weitere Verbraucher
- Leistungsberechnungen
- Betriebsstunden
- Technische Standortaufnahme
- Fuhrpark

Ergebnis:

Der Administrator kann einen Kundenstandort vollständig technisch aufnehmen und dokumentieren.

## PHASE 4 – Energiemanagement und Berichte

Umfang:

- Verbrauchsberechnungen
- Energiebilanzierung
- Unterzählerverrechnung
- Historische Vergleiche
- Versorgerrechnungen
- Tarife
- Energiekosten
- Kennzahlen
- Diagramme
- Professionelle PDF-Berichte
- Excel-Exporte
- Monatliche Ableseerinnerungen

Ergebnis:

Die Plattform liefert fachlich nachvollziehbare Energiedokumentationen und Verbrauchsberichte.

## PHASE 5 – PDCA und kaufmännische Verwaltung

Umfang:

- Maßnahmenmanagement
- Einsparpotenzialberechnungen
- Maßnahmenüberwachung
- Wirksamkeitsprüfung
- Angebotserstellung
- Auftragsverwaltung
- Rechnungsstellung
- Verknüpfung technischer und kaufmännischer Prozesse

Ergebnis:

Die Plattform unterstützt den gesamten Beratungs- und Dienstleistungsprozess.

## PHASE 6 – Automatisierung und KI

Umfang:

- Import von 15-Minuten-Messdaten
- Automatisierte Datenverarbeitung
- Weiterentwickelte Anomalieerkennung
- KI-gestützte Potenzialanalysen
- Automatische Berichtsentwürfe
- Zählerstanderkennung aus Bildern
- Automatisierte Berichtszustellung
- Erweiterte Prognosemodelle

Ergebnis:

Eine skalierbare und zunehmend automatisierte Energieeffizienzplattform.

# 25. ANFORDERUNGEN AN DIE IMPLEMENTIERUNG

Beachte bei der gesamten Entwicklung folgende Regeln:

1. Entwickle die Software nachvollziehbar und modular.

2. Verwende eine zentrale Konfiguration für Farben, Logo und Anwendungstitel.

3. Verwende eine echte PostgreSQL-Datenbank.

4. Erstelle alle erforderlichen Datenbankmigrationen.

5. Implementiere sämtliche Benutzerberechtigungen auch im Backend.

6. Verwende keine fest codierten Kundendaten außerhalb ausdrücklich gekennzeichneter Testdaten.

7. Erzeuge keine vorgetäuschten Ergebnisse.

8. Verwende keine Platzhalter-Schaltflächen ohne Funktion, sofern diese nicht ausdrücklich als noch nicht verfügbar gekennzeichnet sind.

9. Erstelle nachvollziehbare Fehlermeldungen.

10. Behalte stets die spätere Azure-Bereitstellung im Blick.

11. Dokumentiere Entscheidungen und technische Abhängigkeiten.

12. Ergänze automatisierte Tests für geschäftskritische Funktionen.

13. Trenne Messdaten, berechnete Verbräuche, Prognosen und Schätzwerte.

14. Stelle sicher, dass historische Daten bei Stammdatenänderungen nicht verfälscht werden.

15. Gestalte den Kundenbereich konsequent einfacher als den Administrationsbereich.

16. Entwickle zunächst ohne externe KI-Abhängigkeiten.

17. Berücksichtige von Beginn an, dass später große Mengen zeitaufgelöster Messwerte gespeichert werden.

# 26. DEINE ERSTE KONKRETE AUFGABE

Beginne nicht damit, alle Module gleichzeitig zu programmieren.

Erstelle zunächst:

**A. Technische Systemarchitektur**

Zeige die Komponenten der Anwendung und ihre Beziehungen.

**B. Datenbankkonzept**

Erstelle ein nachvollziehbares relationales Datenmodell mit allen wesentlichen Beziehungen.

**C. Rollen- und Berechtigungskonzept**

Definiere exakt, welche Benutzer welche Aktionen ausführen dürfen.

**D. Bildschirmstruktur**

Entwickle eine logische Navigationsstruktur für Admin- und Kundenbereich.

**E. Designsystem**

Definiere Farben, Typografie, Abstände, Tabellen, Buttons und Formulare.

**F. Entwicklungsplan**

Leite einen konkreten Implementierungsplan aus den definierten Phasen ab.

**G. Lokal ausführbare Grundanwendung**

Implementiere anschließend Phase 1 als vollständige, funktionsfähige Anwendung.

Die Grundanwendung muss auf dem lokalen Rechner startbar sein.

Liefere dafür:

- Vollständigen Quellcode
- Docker-Konfiguration
- Datenbankmigrationen
- Beispieldaten
- Testzugänge
- Startanleitung
- Automatisierte Basistests

Prüfe nach jeder Entwicklungsphase, ob die bisherige Funktionalität weiterhin korrekt arbeitet.

Führe keine grundlegenden Architekturänderungen ohne fachliche Begründung durch.

**ENTSCHEIDENDES PROJEKTZIEL:**

Entwickle keine kurzfristige Demonstrationsanwendung.

Schaffe die technische Grundlage für eine langfristig nutzbare Energie- und Effizienzmanagementplattform, die von einer Einzelperson betrieben werden kann, aber später zahlreiche Geschäftskunden, Standorte, Messstellen und Benutzer zuverlässig verwalten kann.

Die Anwendung muss professionell, übersichtlich, sicher, technisch nachvollziehbar und wirtschaftlich erweiterbar sein.

Beginne jetzt mit der Systemarchitektur, dem Datenbankmodell, dem Berechtigungskonzept und der Definition des ersten funktionsfähigen Entwicklungsabschnitts.