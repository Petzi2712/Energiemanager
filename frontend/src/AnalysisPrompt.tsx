import { useRef, useState } from "react";
import { api, date } from "./api";
import { ErrorBox, Field } from "./ui";
import { media, type Node } from "./technical/types";
type Scope = {
  siteId: string | null;
  buildingId: string | null;
  nodeId: string | null;
  medium: string;
  from: string;
  to: string;
};
type Template = Scope & { id: string; name: string };
export function AnalysisPrompt({
  customerId,
  nodes,
  templates,
}: {
  customerId: string;
  nodes: Node[];
  templates: Template[];
}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState<Scope>({
    siteId: null,
    buildingId: null,
    nodeId: null,
    medium: "",
    from: `${now.getFullYear()}-01-01`,
    to: today,
  });
  const [result, setResult] = useState<{
      text: string;
      createdAt: string;
      pointCount: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [copied, setCopied] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null);
  function update(next: Scope) {
    setForm(next);
    setResult(null);
    setCopied(false);
    setError(undefined);
  }
  function under(node: Node, parent: string) {
    let cursor: Node | undefined = node;
    for (let i = 0; cursor && i < 16; i++) {
      if (cursor.id === parent) return true;
      cursor = nodes.find((n) => n.id === cursor?.parentId);
    }
    return false;
  }
  const sites = nodes.filter((n) => n.kind === "Site"),
    buildings = nodes.filter(
      (n) => n.kind === "Building" && n.parentId === form.siteId,
    ),
    assets = nodes.filter(
      (n) =>
        !["Site", "Building"].includes(n.kind) &&
        !!form.siteId &&
        under(n, form.buildingId || form.siteId),
    );
  return (
    <section className="panel analysis-prompt">
      <h2>Neutraler KI-Analyseprompt</h2>
      <p>
        Erzeugt einen Text aus den freigegebenen Verbrauchsdaten des
        ausgewählten Bereichs. Die Ausgabe verwendet neutrale Messstellen- und
        Standortbezeichnungen. Firmen-, Personen-, Anlagen- und Zählerkennungen
        sowie Freitexte und PDF-Inhalte werden ausgelassen.
      </p>
      <p className="subtle">
        Die Erstellung erfolgt lokal auf Knopfdruck. Zum Weiterverarbeiten den
        Text kopieren und in die gewünschte KI einfügen.
      </p>
      <ErrorBox error={error} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(undefined);
          setCopied(false);
          try {
            setResult(
              await api(`/reports/${customerId}/analysis-prompt`, "POST", form),
            );
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !customerId}>
          <legend>Analyseumfang</legend>
          {templates.length > 0 && (
            <Field label="Berichtsvorlage für Analyse übernehmen">
              <select
                value=""
                onChange={(event) => {
                  const t = templates.find((t) => t.id === event.target.value);
                  if (t)
                    update({
                      siteId: t.siteId,
                      buildingId: t.buildingId,
                      nodeId: t.nodeId,
                      medium: t.medium,
                      from: t.from,
                      to: t.to > today ? today : t.to,
                    });
                }}
              >
                <option value="">Optional eine Vorlage auswählen</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="form-grid">
            <Field label="Standort für KI-Analyse">
              <select
                value={form.siteId || ""}
                onChange={(e) =>
                  update({
                    ...form,
                    siteId: e.target.value || null,
                    buildingId: null,
                    nodeId: null,
                  })
                }
              >
                <option value="">Alle freigegebenen Standorte</option>
                {sites.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gebäude für KI-Analyse">
              <select
                disabled={!form.siteId}
                value={form.buildingId || ""}
                onChange={(e) =>
                  update({
                    ...form,
                    buildingId: e.target.value || null,
                    nodeId: null,
                  })
                }
              >
                <option value="">Alle Gebäude des Bereichs</option>
                {buildings.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Anlage für KI-Analyse">
              <select
                disabled={!form.siteId}
                value={form.nodeId || ""}
                onChange={(e) =>
                  update({ ...form, nodeId: e.target.value || null })
                }
              >
                <option value="">Alle Anlagen des Bereichs</option>
                {assets.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Medium für KI-Analyse">
              <select
                value={form.medium}
                onChange={(e) => update({ ...form, medium: e.target.value })}
              >
                <option value="">Alle Medien, getrennt</option>
                {Object.entries(media).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Analysebeginn">
              <input
                type="date"
                required
                min="1900-01-01"
                max={form.to}
                value={form.from}
                onChange={(e) => update({ ...form, from: e.target.value })}
              />
            </Field>
            <Field label="Analyseende">
              <input
                type="date"
                required
                min={form.from}
                max={today}
                value={form.to}
                onChange={(e) => update({ ...form, to: e.target.value })}
              />
            </Field>
          </div>
          <p className="subtle">
            Bis zu 36 Monate und 200 Messstellen je Prompt. Messlücken und
            zeitanteilig zugeordnete Monatswerte werden im Text ausgewiesen.
          </p>
          <button className="primary">
            {busy ? "Prompt wird erstellt …" : "Analyseprompt erstellen"}
          </button>
        </fieldset>
      </form>
      {result && (
        <div className="analysis-prompt-result">
          <div className="section-heading">
            <p role="status">
              Prompt erstellt · {result.pointCount} Messstellen · Datenstand{" "}
              {date(result.createdAt)}
            </p>
            <button
              onClick={async () => {
                setCopied(false);
                setError(undefined);
                try {
                  if (navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(result.text);
                      setCopied(true);
                      return;
                    } catch {
                      /* Auswahl als lokale Rückfallebene. */
                    }
                  }
                  text.current?.focus();
                  text.current?.select();
                  if (!document.execCommand("copy"))
                    throw new Error(
                      "Bitte den markierten Text mit Strg+C kopieren.",
                    );
                  setCopied(true);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Prompt kopieren
            </button>
          </div>
          {copied && (
            <p role="status" className="notice success">
              Prompt in die Zwischenablage kopiert.
            </p>
          )}
          <Field
            label="Neutraler KI-Prompt"
            help="Diesen erzeugten Text vollständig kopieren und in der gewünschten KI weiterverarbeiten. Es wird keine KI automatisch kontaktiert."
          >
            <textarea
              ref={text}
              readOnly
              rows={20}
              wrap="soft"
              value={result.text}
            />
          </Field>
        </div>
      )}
    </section>
  );
}
