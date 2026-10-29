# sysDATIQ – Kundenkataster und Zähleranlagenbaum (v0.2.0)

Die technische Kunden- und Zählerverwaltung aus deinem Masterprompt: eine echte Webanwendung mit React, ASP.NET Core 10 und PostgreSQL. Daten werden dauerhaft gespeichert. Der vollständige Masterprompt liegt in [docs/MASTERPROMPT.original.md](docs/MASTERPROMPT.original.md).

Ansichten der geprüften Anwendung: [Kataster/Zähler Desktop](docs/screenshots/kataster-desktop.png) · [Kataster/Zähler Smartphone](docs/screenshots/kataster-smartphone.png).

## Lokal starten

Voraussetzung: Docker mit Compose v2, beispielsweise Docker Desktop unter Windows/macOS oder Docker Engine mit Compose unter Linux. Docker Desktop muss laufen. Für den ersten Build ist Internetzugriff auf die Paket- und Containerregistries erforderlich. Auf dem Rechner sind weder Node.js noch .NET noch PostgreSQL erforderlich.

1. Das ZIP entpacken und ein Terminal im entpackten Projektordner öffnen. Dort liegt `compose.yaml`.
2. Starten:

   ```sh
   docker compose up --build -d --wait
   ```

3. Im Browser `http://localhost:8080` öffnen.

Das lokale Testpostfach Mailpit erreichst du unter `http://localhost:8025`. Passwort-Reset-Nachrichten gehen ausschließlich an diesen SMTP-Testserver. Es werden keine Nachrichten an echte Kunden versendet.

Beim ersten Start werden Migrationen angewendet und genau einmal zwei synthetische Demo-Kunden mit vier Benutzern angelegt. Folge-Starts setzen vorhandene Daten oder Passwörter nicht zurück.

## Testzugänge

| Rolle | Anmeldename | Zugriff |
| --- | --- | --- |
| Systemadministrator | `admin@sysdatiq.local` | Beide Demo-Kunden; Kunden-, Benutzerverwaltung und Audit-Protokoll |
| Kundenadministrator A | `admin@nordwerk.example` | Nur Nordwerk; freigeschaltete Benutzerverwaltung |
| Kundenbenutzer A | `ablesung@nordwerk.example` | Freigegebene Nordwerk-Anlagen, Messstellen und Ablesungen |
| Kundenleser B | `lesen@weserpark.example` | Freigegebene Weserpark-Anlagen, Messstellen und Ablesungen; keine Schreibrechte |

Das gemeinsame **lokale Startpasswort** lautet `Start_Energie`. Bei der ersten Anmeldung muss jeder Benutzer ein eigenes Passwort mit mindestens 12 Zeichen, Groß- und Kleinbuchstaben vergeben. Bis dahin sperrt auch die API die normalen Anwendungsfunktionen.

Passwort vergessen: auf der Anmeldeseite den Reset anfordern, Mailpit öffnen und dem dort angezeigten Link folgen. Ein Link gilt 30 Minuten und ist nur einmal verwendbar.

## Was du testen kannst

- Anmeldung, erzwungener Passwortwechsel, Passwortänderung, Reset und Abmeldung.
- Kunden anlegen, öffnen, ändern und deaktivieren; Stammdaten einschließlich Kontakt, Anschriften, USt-ID, Vertragsbeginn und interner Bemerkungen.
- Benutzer anlegen, Namen, Rollen, Aktivstatus und Kundenzuordnungen ändern.
- Benutzerverwaltung je Kunde freischalten. Ein Kundenadministrator darf ausschließlich Kundenbenutzer und Leser seines freigegebenen Unternehmens verwalten.
- Mandantentrennung: ein Benutzer von Kunde A erhält auch mit einer manipulierten URL keinen Zugriff auf Kunde B.
- Sofortige Beendigung bestehender Sitzungen nach Benutzerdeaktivierung oder Rechteänderung.
- Audit-Protokoll mit Benutzer, Zeitpunkt, Aktion, Ergebnis, Datensatz, Korrelations-ID und Vorher-/Nachher-Zuständen bei Änderungen.
- Bedienung auf Desktop und Smartphone; einklappbare Sidebar mit gespeichertem Zustand.
- Dauerhafte Speicherung: Kunden anlegen, `docker compose restart` ausführen, neu anmelden und Daten wieder öffnen.

Die Übersicht zählt echte Kunden und Benutzer aus der Datenbank. Es gibt keine erfundenen Messwerte oder Energiekennzahlen.

## Kundenkataster und Zähleranlagenbaum

Zusätzlich zur Benutzer- und Kundenverwaltung enthält Version 0.2:

- Kunden → Standorte → Gebäude → Bereiche/Anlagen, Verteilungen, Verbrauchergruppen und Einzelverbraucher.
- Technische Standort- und Gebäudedaten mit Flächen, Nutzung, Betriebszeiten, Versorgungssystemen, Zeitzone und individuellen Zusatzfeldern.
- Verbraucher mit Anzahl, Nenn- und Systemleistung, Jahresbetriebsstunden und Lastfaktor; elektrische Leistung und Jahresverbrauch werden ausdrücklich als **Schätzung** berechnet.
- Einen getrennten, aufklappbaren Messstellenbaum mit Haupt- und Unterzählern für Strom, Wasser, Erdgas, Wärme und Kälte.
- Messstellenstammdaten, physische Zählergeräte und getrennte Geräteperioden mit Faktor, Auflösung, Nachkommastellen und optionaler Überlaufgrenze.
- Historisierte Zuordnungen im Anlagen-/Zählerbaum, Schutz gegen Kreise und Vermischung verschiedener Medien, Einheiten oder Messrichtungen.
- Kundenportal mit manueller Zählerstandserfassung, Ereignissen, Kommentaren, Fotoaufnahme/Upload und Ablesehistorie.
- Serverseitige Prüfung von Wertebereich, Genauigkeit, Auflösung, Reihenfolge, Duplikaten, Verbrauchsgrenzen und belastbaren historischen Vergleichswerten. Auffällige Werte benötigen ausdrückliche Bestätigung und Begründung.
- Nachvollziehbare Korrekturen durch die Systemadministration und dokumentierter Zählertausch mit Alt-/Neustand. Fehlende Austauschwerte werden als unvollständig ausgewiesen.
- Verbrauchsdifferenzen je Geräteperiode und Haupt-/Unterzählerbilanz für exakt übereinstimmende Zeiträume. Datenlücken ergeben keine scheinbar vollständige Bilanz.
- Private Fotos/PDF-Dokumente am Kataster und private Ablesefotos im persistenten Azurite-Speicher. Bilder werden geprüft, verkleinert und von Metadaten bereinigt.
- Standortfreigaben pro Benutzer. Eingeschränkte Kundenadministratoren können neuen Benutzern keine weitergehenden Standortrechte geben.
- Dashboard mit echten Standort-/Messstellenzahlen, überfälligen Ablesungen und auffälligen Werten.

Ein bebilderter Arbeitsablauf und die fachlichen Grenzen stehen in [docs/KATASTER.md](docs/KATASTER.md).

**Noch nicht enthalten:** Fuhrpark, Versorgerrechnungen und Tarife, umfangreiche Diagrammkonfiguration, PDF-/Excel-Berichte, PDCA, kaufmännische Vorgänge, automatische Erinnerungen, Zeitreihenimporte und KI. Diese Module bleiben weitere Ausbaustufen des Masterprompts.

## Vorhandene Installation aktualisieren

Zuerst eine Datenbanksicherung erstellen (siehe unten). Im bestehenden Projektordner:

```sh
git pull origin main
docker compose up --build -d --wait
```

Die neue Migration ergänzt die vorhandene Datenbank. Kunden, Benutzer, Passwörter und bisherige Daten bleiben erhalten. Das neue `blob_data`-Volume enthält private Dateien. **Kein `down -v` zum Aktualisieren verwenden.** Bestehende Installationen beginnen mit einem leeren technischen Kataster, das über die Oberfläche aufgebaut wird. Die umfangreiche Demo-Struktur wird ausschließlich bei einer neuen, leeren Demo-Datenbank erzeugt.

Die lokale Testversion ist ausschließlich für Entwicklung freigegeben. Containerports für Web und Mailpit sind an `127.0.0.1` gebunden. Datenbank und Backend werden im normalen Compose-Betrieb nicht direkt am Host veröffentlicht. Ein anderer Computer oder ein echtes Smartphone kann daher nicht unmittelbar zugreifen; die Smartphone-Prüfung verwendet eine entsprechend kleine Browseransicht. Für einen späteren Netzwerk- oder Produktivbetrieb sind HTTPS, individuelle Einladungen, Secret Store, Betriebs- und Datenschutzkonzept sowie eine gesonderte Sicherheitsprüfung erforderlich. Die API verweigert den Start außerhalb der Development-Umgebung.

## Konfiguration

Die Standardwerte reichen für den lokalen Start. Bei Bedarf `.env.example` nach `.env` kopieren:

```sh
# Linux/macOS/Git Bash
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Beispiel bei belegten Ports: `APP_PORT=8090`, `MAIL_PORT=8026` und `APP_BASE_URL=http://localhost:8090` eintragen. `APP_BASE_URL` muss zur Browseradresse passen, damit Passwort-Reset-Links funktionieren. Danach erneut `docker compose up --build -d --wait` ausführen.

`POSTGRES_PASSWORD` ist ein ausschließlich lokales Entwicklungskennwort. Eine Änderung in `.env` ändert kein Kennwort einer bereits initialisierten PostgreSQL-Datenbank. Bestehende Volumes enthalten weiterhin die ursprüngliche Datenbankkonfiguration.

Branding: `frontend/public/branding.json` enthält Name, Untertitel, Logopfad und zentrale Farben. `frontend/public/logo.svg` ist ein austauschbares Beispielzeichen, kein vorgegebenes Firmenlogo. Nach einer Branding-Änderung die Webanwendung neu bauen: `docker compose up --build -d web`.

## Stoppen, Protokolle und Daten sichern

```sh
docker compose down                 # Container stoppen, Daten behalten
docker compose logs --tail=100 api  # Backend-Diagnose
docker compose ps                  # Status
```

PostgreSQL-Daten, private Dateien, Session-Schlüssel und Testpostfach liegen in benannten Docker-Volumes. **`docker compose down -v` löscht diese lokalen Daten einschließlich Benutzerpasswörtern.** Zum normalen Stoppen `-v` weglassen.

Ein binär komprimiertes Datenbankbackup ohne plattformabhängige Umleitung erzeugen:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/sysdatiq.dump'
docker compose cp db:/tmp/sysdatiq.dump ./sysdatiq.dump
```

Das Backup enthält personenbezogene Stammdaten und Passwort-Hashes. Geschützt aufbewahren. Für eine Wiederherstellungsprobe eine separate, leere Testdatenbank verwenden und `pg_restore --no-owner` gegen diese Datenbank ausführen; laufende Anwendungsdaten nicht überschreiben. Für produktiven Betrieb sind zusätzlich dokumentierte und regelmäßig geprobte Sicherungen von Dateien, Schlüsseln und Konfiguration erforderlich.

## Automatisierte Tests

Die API-Tests prüfen echte HTTP-Anfragen und eine echte PostgreSQL-Datenbank. Das Testskript erzeugt dafür ein eigenes, eindeutig benanntes Compose-Projekt, ändert nur dessen Demo-Passwörter und entfernt dessen Testvolumes anschließend. Vorhandene Anwendungsdaten bleiben erhalten.

```sh
bash scripts/test.sh
```

Unter Windows dafür Git Bash oder WSL verwenden. Standard-Testports: 18080 und 18025; bei Bedarf `TEST_APP_PORT` und `TEST_MAIL_PORT` setzen. Die 36 Integrationstests decken Authentifizierung, Passwortwechsel, Reset-E-Mail, einmalige Reset-Links, Kontosperre, Mandantentrennung, Rollenrechte, CSRF, Eingabevalidierung, Duplikate, Historisierung, Konflikte, OpenAPI und Sitzungswiderruf sowie Kataster, Standortrechte, Gerätewechsel, Überläufe, Korrekturhistorie, Bilanzierung und echten privaten Foto-Upload ab. Anschließend prüft das Skript Datenpersistenz nach einem API-Neustart.

Für Browserprüfungen sind Node.js 24 und Chromium/Playwright zusätzlich auf dem Testrechner erforderlich:

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

Die Browserprüfung verwendet den lokalen Systemadministrator. Auf einer frischen Demo-Datenbank setzt sie dessen Passwort auf `Browser_Energie_2026!`. Auf einer bereits verwendeten Datenbank vorher `E2E_ADMIN_PASSWORD` auf dessen aktuelles Passwort setzen. Die Tests erstellen gekennzeichnete Testkunden und sind deshalb für eine separate Testinstanz gedacht. `E2E_BASE_URL` überschreibt die Zieladresse. `CHROMIUM_PATH` erlaubt einen vorhandenen Chromium-Browser. Fünf Browserabläufe prüfen Desktop und Smartphone, Kundenanlage, Kataster/Verbraucherberechnung, Messstellenanlage, Ablesung mit Foto, Korrektur, Zählertausch, Seitenbreite und die Erstanmeldung eines Kundenbenutzers.

## Entwicklung ohne kompletten Container-Neubau

Der dokumentierte Standard ist Docker Compose. Für Hot Reload können Backend und Frontend mit .NET SDK 10 und Node.js 24 nativ betrieben werden; PostgreSQL und Mailpit bleiben in Docker. Zusätzlich muss Azurite mit privatem Blob-Speicher laufen. Dazu lokale Portfreigaben nur auf Loopback konfigurieren und die Laufzeitwerte setzen:

- `ConnectionStrings__Database`: erreichbare lokale PostgreSQL-Verbindung.
- `ASPNETCORE_ENVIRONMENT=Development`, `App__SeedDemo=true` für synthetische Demodaten.
- `App__DataKeyPath`: beschreibbares lokales Schlüsselverzeichnis außerhalb des Quellcodes.
- `Smtp__Host`, `Smtp__Port`: lokaler Mailpit-SMTP-Port.
- `App__BaseUrl=http://localhost:5173` bei Vite.
- `Storage__ConnectionString=UseDevelopmentStorage=true` für einen Azurite-Emulator am lokalen Standardport 10000.
- Backend: `dotnet run --project backend --urls http://127.0.0.1:8080`.
- Frontend: in `frontend` erst `npm ci`, dann `npm run dev`.

OpenAPI steht nach Anmeldung unter `/openapi/v1.json` bereit. Architektur, Berechtigungen und Ausbauplan sind in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) dokumentiert. Der tatsächlich geprüfte Stand steht in [docs/PRUEFBERICHT.md](docs/PRUEFBERICHT.md).
