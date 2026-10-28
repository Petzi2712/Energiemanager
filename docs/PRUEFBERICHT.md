# Prüfbericht – lokale Grundanwendung v0.1.0

Geprüft am 28.10.2026 in einer Debian-Cloud-Umgebung. Die Prüfungen verwenden ausschließlich synthetische Demo- und Testdaten.

| Prüfung | Ergebnis |
| --- | --- |
| .NET SDK 10.0.403 aus offizieller Distribution | SHA512 gegen offizielle Release-Metadaten geprüft |
| Backend Restore mit Sperrdatei und Release-Publish | Erfolgreich, keine Compilerwarnungen oder -fehler |
| Frontend TypeScript- und Vite-Produktionsbuild | Erfolgreich, auch im tatsächlichen Node-/Nginx-Container |
| Initiale PostgreSQL-Migration und Seed | Erfolgreich gegen PostgreSQL 17 im Container |
| Wiederholter Start und Migration | Bestehendes Schema erkannt; kein erneuter Seed |
| API-Integrationstests | **16 ausgeführt, 16 bestanden** auf frischer separater Testdatenbank |
| Browser: Desktop 1440 × 960 | Anmeldung, Kunde anlegen/ändern, Abmeldung bestanden; keine JavaScript-Seitenfehler |
| Browser: Smartphone 390 × 844 | Derselbe Ablauf bestanden; keine horizontale Überbreite der Seite |
| Browser: neuer Kundenbenutzer | Pflichtpasswortwechsel und Beschränkung auf eigenen Kunden bestanden |
| Persistenz | Geändertes Passwort und gespeicherter Kunde nach Backend- und PostgreSQL-Neustart vorhanden |
| Web-Container | Nginx-Konfiguration, tatsächliche HTML-/JS-/Logo-/Branding-Auslieferung und CSP geprüft |
| Compose-Konfiguration und Shell-Testskript | Strukturell bzw. syntaktisch gültig |
| npm audit | Keine bekannten Schwachstellen gemeldet |
| NuGet-Prüfung einschließlich transitiver Pakete | Keine bekannten Schwachstellen gemeldet |
| Wiederverwendbare Cloud-Installation und nativer Start | Wiederholbar ausgeführt; API, Datenbank und Frontend antworten |

Die 16 API-Tests prüfen Pflichtpasswortwechsel, Datenbankbereitschaft, anonymen Zugriff, manipulierte mandantenfremde IDs, Leserrechte, Kundenanlage/Bearbeitung/Persistenz und Historie, Konflikte, Duplikate und Eingabevalidierung, CSRF, eingeschränkte Kundenadministration, Sitzungswiderruf bei Deaktivierung, echten Reset-Versand an Mailpit mit einmaligem Token, Kontosperre nach Fehlversuchen, Abmeldung, OpenAPI/Dashboard, vertrauliche interne Notizen und Schutz vor eigener Deaktivierung.

Während der Prüfung wurden ein mobiler Überlauf durch ein absolut positioniertes Tabellenlabel, die mobile Beschriftung des Kontobuttons und Leserechte im Web-Container korrigiert. Die betroffenen Prüfungen wurden erfolgreich wiederholt. Die Paketprüfung führte zu korrigierten Vite- und .NET-Patchversionen; Prüfungen wurden ohne deaktivierte TLS- oder Integritätsprüfung ausgeführt.

## Konkrete Testgrenze

Der vollständige Build des **Backend-Containers** und damit der gesamte unveränderte Compose-Start wurden hier **nicht erfolgreich ausgeführt**. Die Cloud-Netzwerkregel erlaubt `mcr.microsoft.com`, blockiert aber dessen tatsächlichen Blob-Downloadhost `westcentralus.data.mcr.microsoft.com` mit HTTP 403. Die notwendige Ergänzung wurde im Cloud-Konfigurationsentwurf gespeichert; sie war zur Prüfung noch nicht auf die laufende Instanz angewendet.

Deshalb liefen die fachlichen API- und Browserprüfungen mit nativem ASP.NET Core und Vite, verbunden mit echtem PostgreSQL und Mailpit in Docker. Das Web-Containerimage wurde separat erfolgreich gebaut und gestartet. Dies belegt die geprüften Anwendungsfunktionen, ersetzt jedoch nicht die noch ausstehende Gesamtprüfung des Docker-Compose-Betriebs. `scripts/test.sh` liegt für diese Gesamtprüfung auf einem Rechner mit Zugriff auf die erforderlichen Registries bei.

Nicht geprüft: Ausführung auf dem Rechner des Benutzers, Windows/macOS/ARM, Azure-Deployment, Last- und Penetrationstests, produktive Datenschutz-/Aufbewahrungsprozesse, Backup-Restore und die noch nicht implementierten Energiemodule. Die Browserprüfungen verwenden das vorhandene Chromium mit Playwright; kein physisches Smartphone war angeschlossen.

Die Anwendung ist eine lokal funktionsgeprüfte Phase-1-Grundlage. Eine Veröffentlichung der Cloud-Konfiguration oder ein Produktivbetrieb ist damit nicht nachgewiesen.

Für weitere Cloud-Tasks sind `install_script` und `start_skill` im Konfigurationsentwurf gespeichert. Sie beschreiben die tatsächlich geprüfte native Cloud-Variante und den erforderlichen Neustart der Prozesse. Die zusätzliche Netzwerkfreigabe ist ebenfalls als Entwurf gespeichert. Zum Übernehmen müssen die Änderungen in den Umgebungseinstellungen geprüft, gespeichert und die Umgebung veröffentlicht werden. Speichern des Entwurfs führt keine Skripte aus und belegt keine Veröffentlichung oder Wiederherstellung in einer neuen Task.
