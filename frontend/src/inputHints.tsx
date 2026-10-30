import { useEffect } from "react";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export function fieldHelp(
  label: string,
  type = "text",
  min?: string | number,
  max?: string | number,
) {
  const name = label.toLowerCase();
  const rules: [RegExp, string][] = [
    [
      /e-?mail/,
      "Vollständige E-Mail-Adresse eingeben, z. B. energie@beispiel.de.",
    ],
    [
      /passwort.*wiederholen/,
      "Das neue Passwort ein zweites Mal unverändert eingeben.",
    ],
    [
      /neues passwort/,
      "Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben wählen. Eine eigene lange Passphrase verwenden.",
    ],
    [/passwort/, "Das persönliche Passwort dieses Zugangs eingeben."],
    [
      /id messstelle/,
      "Eindeutige ID innerhalb des Kunden, z. B. STROM-HALLE-01. Bestehende Zuordnungen bleiben an dieser Messstelle.",
    ],
    [
      /^id\b|neue id|fahrzeug-id|nummer/,
      "Eindeutige Kennung innerhalb des Kunden, z. B. HALLE-01. Maximal 60 Zeichen für Kataster- und Messstellen-IDs.",
    ],
    [
      /einsparung|einsparannahme/,
      "Angenommene Reduktion von 0 bis 100 Prozent, z. B. 15 für 15 %. Dies ist eine Planungsannahme.",
    ],
    [
      /maßnahme umgesetzt/,
      "Ankreuzen, sobald die Maßnahme tatsächlich umgesetzt ist. Details und Nachweise aufklappen und den Status speichern.",
    ],
    [
      /maßnahmen.*text|maßnahmen.*notiz|maßnahmenbeschreibung/,
      "Maßnahme, Umsetzung und Ergebnis beschreiben, z. B. Leuchten am 15.10. ausgetauscht. Ein PDF kann separat als Nachweis ergänzt werden.",
    ],
    [
      /tagesgrenze/,
      "Optionaler maximaler Tagesverbrauch in der angezeigten Einheit. Beispiel: 500 kWh/Tag. Leer lassen, um keine Spitzenwarnung auszulösen.",
    ],
    [
      /zählerstand|anfangsstand|alt.*stand|neu.*stand/,
      "Kumulierten Stand vom Zählerdisplay eintragen, z. B. 12345,6. Die Einheit beachten; den Gerätefaktor nicht selbst multiplizieren.",
    ],
    [
      /lastfaktor/,
      "Anteil der mittleren Leistung an der Nennleistung zwischen 0 und 1, z. B. 0,7.",
    ],
    [
      /jahresbetriebsstunden|betriebsstunden/,
      "Betriebsstunden pro Jahr angeben, z. B. 2000. Maximal 8784 Stunden im Schaltjahr.",
    ],
    [
      /jahresmenge/,
      "Bekannte oder geschätzte Jahresmenge in der gewählten Einheit, z. B. 25000 kWh. Ersetzt die Leistungsschätzung dieses Eintrags.",
    ],
    [
      /systemleistung|nennleistung/,
      "Leistung in der angegebenen Einheit eintragen, z. B. 50 W pro Leuchte. Anzahl wird bei der Schätzung zusätzlich berücksichtigt.",
    ],
    [
      /auflösung/,
      "Kleinste zulässige Änderung des Zählerstands, z. B. 0,1. Muss zu den Nachkommastellen passen.",
    ],
    [
      /faktor/,
      "Geräte-/Wandlerfaktor, z. B. 1 für direkte Messung oder 100 für einen Wandler.",
    ],
    [
      /überlauf/,
      "Registerwert beim Umsprung auf Null, z. B. 100000 bei fünf Vorkommastellen. Leer lassen, wenn kein Überlauf vorgesehen ist.",
    ],
    [
      /löschgrund|begründung/,
      "Nachvollziehbaren Grund mit mindestens 5 Zeichen angeben, z. B. Anlage dauerhaft demontiert. Wird protokolliert.",
    ],
    [
      /zeitzone/,
      "Standortzeitzone wählen, z. B. Europe/Berlin. Sie gilt für Ablesungen ohne ausdrücklichen UTC-Offset.",
    ],
    [
      /pdf|datei|foto|logo|upload/,
      "Passendes Dateiformat und die angezeigte Größenbegrenzung beachten. Beispiel: bericht.pdf bzw. zaehler.jpg.",
    ],
    [
      /medium|energieträger/,
      "Passendes Medium auswählen, z. B. Strom oder Wärme. Verschiedene Medien werden getrennt bilanziert.",
    ],
    [
      /einheit/,
      "Zur Messgröße passende Einheit wählen, z. B. kWh für Energie oder m³ für Volumen.",
    ],
    [
      /bericht.*name|bezeichnung|^name/,
      "Aussagekräftige Bezeichnung verwenden, z. B. Produktionshalle Nord oder Jahresanalyse 2026.",
    ],
    [
      /datum|zeitpunkt|beginn|ende|gültig|historie (von|bis)|zeitraum/,
      "Datum und gegebenenfalls Uhrzeit wählen. Beispiel: 15.10.2026 08:00. Bei „Browser-Ortszeit“ gilt die Zeitzone Ihres Browsers. Beginn muss vor Ende liegen.",
    ],
    [
      /gebäude|standort|anlage|zuordnung/,
      "Passenden Eintrag des ausgewählten Kunden wählen. Beispiel: Standort Bremen → Halle Nord → Beleuchtung.",
    ],
    [
      /bemerkung|freitext|hinweis|notiz/,
      "Ergänzende Angaben frei beschreiben, z. B. Betriebszeiten oder die Grundlage einer Schätzung.",
    ],
    [
      /adresse/,
      "Vollständige Adresse eingeben, z. B. Musterstraße 12, 28195 Bremen.",
    ],
    [
      /suchen|durchsuchen|filter/,
      "Nach Name oder ID filtern, z. B. HALLE-01. Ein leeres Suchfeld zeigt alle freigegebenen Einträge.",
    ],
    [
      /rolle/,
      "Berechtigungsumfang wählen: Systemadministration, Kundenadministration, Kundenbenutzer oder Leser.",
    ],
  ];
  const specific = rules.find(([rule]) => rule.test(name));
  if (specific) return specific[1];
  if (type === "checkbox")
    return "Ankreuzen, um diese Option zu aktivieren; abwählen, um sie auszuschließen.";
  if (type === "number")
    return `Zahl in der angegebenen Einheit eingeben${min !== undefined && min !== "" ? `, mindestens ${min}` : ""}${max !== undefined && max !== "" ? `, höchstens ${max}` : ""}. Beispiel: ${max !== undefined && Number(max) <= 1 ? "0,5" : "10"}.`;
  if (type === "date" || type === "datetime-local")
    return "Gültiges Datum auswählen, z. B. 15.10.2026. Beginn und Ende in aufsteigender Reihenfolge angeben.";
  if (type === "select-one" || type === "select-multiple")
    return "Passenden Eintrag aus der Liste auswählen. Die Auswahl bestimmt die zugeordneten Daten.";
  return `Angabe zu „${label.replace(/\s*\*$/, "")}“ eintragen. Die angezeigte Einheit und gegebenenfalls Pflichtangabe beachten.`;
}

// Erfasst auch Suchfelder, Tabellenfelder, Uploads und Filter außerhalb von Field.
export function InputHints() {
  useEffect(() => {
    function enhance(root: ParentNode) {
      root
        .querySelectorAll<Control>("input:not([type=hidden]),select,textarea")
        .forEach((control) => {
          if (control.title) return;
          const label =
            control.getAttribute("aria-label") ||
            Array.from(control.labels || [])
              .map((x) => x.textContent)
              .join(" ")
              .trim() ||
            control.getAttribute("placeholder") ||
            "Eingabe";
          control.title = fieldHelp(
            label,
            control.type,
            control instanceof HTMLInputElement ? control.min : undefined,
            control instanceof HTMLInputElement ? control.max : undefined,
          );
        });
    }
    enhance(document);
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof Element) {
            enhance(node.parentElement || node);
          }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
