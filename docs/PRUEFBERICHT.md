# Prüfbericht – Kundenkataster und Zähleranlagenbaum v0.2.0

Geprüft am 29.10.2026 mit ausschließlich synthetischen Testdaten. Der frühere Stand bleibt in [PRUEFBERICHT-phase1.md](PRUEFBERICHT-phase1.md) erhalten.

| Prüfung | Ergebnis |
| --- | --- |
| Backend Release-Build und Publish (.NET 10.0.403) | Erfolgreich, keine Warnungen oder Fehler |
| Frontend TypeScript-/Vite-Produktionsbuild | Erfolgreich |
| Web-Container | Erfolgreich gebaut; HTML, Branding, Anwendungsskript und Foto-Vorschau-CSP per HTTP geprüft |
| Neue PostgreSQL-Datenbank mit beiden Migrationen | Erfolgreich initialisiert, reproduzierbare technische Demo-Daten |
| Bisherige API-Integrationstests | **16 ausgeführt, 16 bestanden** |
| Neue fachliche API-Integrationstests | **20 ausgeführt, 20 bestanden** |
| Gemeinsamer API-Lauf auf frischer Datenbank | **36 ausgeführt, 36 bestanden**, keine übersprungenen Tests |
| Gemeinsame Browserprüfung | **5 ausgeführt, 5 bestanden**, Desktop und Smartphone |
| Upgrade einer Kopie der Phase-1-Datenbank | Erfolgreich; sämtliche Kundenstammdaten sowie Benutzer-, Rollen- und Aktivierungsdaten unverändert |
| Demo-Verhalten beim Upgrade | Keine technischen Demo-Einträge in vorhandene Daten eingefügt |
| Azurite mit echtem Blob-Zugriff | Foto gespeichert, JPEG abrufbar, Metadaten entfernt, anderer Mandant abgewiesen |
| Dateipersistenz | Foto nach Azurite-Neustart anhand SHA256 unverändert abrufbar |
| npm-/NuGet-Prüfungen inkl. transitiver App-Pakete | Keine bekannten Schwachstellen gemeldet |
| Compose-Konfiguration und Shell-Testskript | Strukturell bzw. syntaktisch gültig |

Die neuen API-Tests prüfen Demo-Struktur und die 7.200-kWh-Schätzung für 24 × 150-W-Leuchten, Katasteranlage und Änderungskonflikte, mandantenfremde Elternknoten, Verbrauchsdifferenzen, Duplikate, fallende Stände und Genauigkeit, Warnungen mit Bestätigung, explizite Überläufe, rückdatierte Eingaben mit Folgeablesung, Revisionen, Gerätewechsel und periodenbezogene Faktoren, fehlende Austauschwerte, Haupt-/Unterzählerbilanz ohne Doppelzählung, gemischte Medien, Kreiszuordnungen, historisierte Standortwechsel, Standortrechte, Leserrechte, Deaktivierung mit aktiven Untereinträgen, privaten Foto-Upload, Metadatenbereinigung, eingeschränkte Delegation durch Kundenadministratoren und reale Dashboard-Zahlen.

Die Browserabläufe umfassen die bisherigen Kunden- und Erstanmeldungsabläufe und zusätzlich auf Desktop (1440 × 1000) und Smartphone (390 × 844): Standort, Gebäude und Verbraucher anlegen; Leistung und geschätzten Jahresbedarf prüfen; Messstelle mit Anfangsstand und Faktor anlegen; Zählerstand mit Foto speichern; Verbrauch anzeigen; einen Wert mit Begründung korrigieren; Zählertausch mit separatem Neuanfang erfassen. JavaScript-Seitenfehler und horizontale Überbreite werden ebenfalls geprüft.

Während der Entwicklung wurden Formularbeschriftungen, die Auswahlfelder eindeutig zuordnen, die Aktualisierung nach Gerätewechseln und die Vererbung eingeschränkter Standortrechte gezielt geprüft. Ein anfangs fehlgeschlagener Bilanztest verwendete einen nicht URL-kodierten UTC-Offset; mit korrekt kodierten Zeitstempeln besteht er. Die Upgrade-Prüfung wurde mit dem aktuellen Release-Build ausgeführt; ein veralteter Debug-Build wurde von EF Core wegen fehlender Migration zu Recht abgewiesen. Die Modellprüfung wurde nicht deaktiviert.

## Prüfgrenzen

Die fachlichen Tests liefen hier mit nativer ASP.NET-Core-/Vite-Ausführung, PostgreSQL und Mailpit in Docker sowie dem offiziellen lokalen Azurite-Emulator. Der Benutzer hat den funktionierenden Docker-Betrieb von Phase 1 bestätigt. Diese Angabe ersetzt keine Prüfung des neuen vollständigen Compose-Stacks in dieser Cloud.

Der komplette Backend-/Azurite-Containerbuild bleibt durch den bereits dokumentierten Cloud-Netzwerkfilter für den MCR-Blobhost eingeschränkt. Das enthaltene Testskript prüft auf einem Rechner mit Registry-Zugriff den vollständigen Compose-Betrieb mit 36 API-Tests in einem eigenen Testprojekt. Neue Basisimages wurden nicht über unzulässige Netzwerkwege geladen. TLS-, Signatur- und Paketprüfungen wurden nicht abgeschaltet.

Nicht geprüft: Betrieb auf dem konkreten Benutzerrechner nach diesem Update, physische Smartphone-Hardware, Windows/macOS/ARM, Azure-Deployment, Produktionssicherheit, Lasttests und noch nicht implementierte Module wie Fuhrpark, Berichte, PDCA, kaufmännische Vorgänge und KI. Es findet keine automatische Zählerstanderkennung statt.

Die wiederverwendbaren Cloud-Felder `install_script` und `start_skill` wurden einschließlich des privaten lokalen Dateispeichers als Entwurf aktualisiert und die entsprechenden Installations-/Startschritte ausgeführt. Für die Übernahme in eine neue Cloud-Version müssen die Änderungen in den Umgebungseinstellungen geprüft, gespeichert und die Umgebung veröffentlicht werden. Der Entwurf führt diese Veröffentlichung nicht selbst aus.
