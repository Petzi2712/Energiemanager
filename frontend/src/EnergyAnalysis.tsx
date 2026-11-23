import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Session } from "./api";
import { Field, ErrorBox } from "./ui";
import { media, type Tree } from "./technical/types";
export type AnalysisInput = {
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  siteId: string | null;
  buildingId: string | null;
  nodeId: string | null;
  medium: string;
  areaM2: number | null;
  referenceAreaM2: number | null;
  operatingHours: number | null;
  referenceOperatingHours: number | null;
  productionUnits: number | null;
  referenceProductionUnits: number | null;
  denominatorSource: string;
};
export function initialAnalysis(): AnalysisInput {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const end = fmt(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  const oldEnd = new Date(now);
  oldEnd.setFullYear(oldEnd.getFullYear() - 1);
  const oldStart = new Date(start);
  oldStart.setFullYear(oldStart.getFullYear() - 1);
  return {
    from: fmt(start),
    to: end,
    compareFrom: fmt(oldStart),
    compareTo: fmt(oldEnd),
    siteId: null,
    buildingId: null,
    nodeId: null,
    medium: "",
    areaM2: null,
    referenceAreaM2: null,
    operatingHours: null,
    referenceOperatingHours: null,
    productionUnits: null,
    referenceProductionUnits: null,
    denominatorSource: "",
  };
}
type Group = {
  medium: string;
  unit: string;
  direction: string;
  value: number | null;
  available: number | null;
  coverage: number;
  estimated: boolean;
  meters: number;
  days: number;
};
type Raw = {
  id: string;
  pointId: string;
  at: string;
  value: number;
  source: string;
  status: string;
  version: number;
  reviewed: boolean;
  needsReview: boolean;
};
type Quality = {
  pointId: string;
  name: string;
  number: string;
  medium: string;
  unit: string;
  coverage: number;
  latestAt: string | null;
  overdue: boolean;
  intervalDays: number;
  dailyLimit: number | null;
  openChecks: number;
  incompleteReplacements: number;
  issues: string[];
  sources: Record<string, number>;
};
type Period = {
  from: string;
  to: string;
  groups: Group[];
  months: { month: string; groups: Group[] }[];
  quality: Quality[];
  readings: Raw[];
};
type Comparison = {
  medium: string;
  unit: string;
  direction: string;
  current: number | null;
  reference: number | null;
  changePercent: number | null;
  currentPerDay: number | null;
  referencePerDay: number | null;
  perArea: number | null;
  referencePerArea: number | null;
  perHour: number | null;
  referencePerHour: number | null;
  perProductionUnit: number | null;
  referencePerProductionUnit: number | null;
};
export type AnalysisResult = {
  asOf: string;
  current: Period;
  reference: Period;
  comparisons: Comparison[];
  method: string;
};
export const number = (n: number | null | undefined) =>
  n == null
    ? "unbekannt"
    : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(n);
export function ComparisonFields({
  value,
  onChange,
  dates = true,
}: {
  value: AnalysisInput;
  onChange: (v: AnalysisInput) => void;
  dates?: boolean;
}) {
  return (
    <>
      <div className="form-grid">
        {(dates
          ? [
              ["from", "Zeitraum von"],
              ["to", "Zeitraum bis"],
            ]
          : []
        )
          .concat([
            ["compareFrom", "Vergleich von"],
            ["compareTo", "Vergleich bis"],
          ])
          .map(([key, label]) => (
            <Field label={label} key={key}>
              <input
                type="date"
                required
                value={String(value[key as keyof AnalysisInput])}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              />
            </Field>
          ))}
      </div>
      <details>
        <summary>Bezugsgrößen und Kennzahlen</summary>
        <p className="subtle">
          Für jeden Zeitraum getrennt eintragen. Nur dokumentierte, zum Zeitraum
          passende Größen verwenden. Ohne Eingabe bleibt die Kennzahl unbekannt.
        </p>
        <div className="form-grid">
          {[
            ["areaM2", "Fläche aktuell (m²)"],
            ["referenceAreaM2", "Fläche Vergleich (m²)"],
            ["operatingHours", "Betriebsstunden aktuell"],
            ["referenceOperatingHours", "Betriebsstunden Vergleich"],
            ["productionUnits", "Produktionseinheiten aktuell"],
            ["referenceProductionUnits", "Produktionseinheiten Vergleich"],
          ].map(([key, label]) => (
            <Field
              label={label}
              key={key}
              help="Positive Bezugsgröße für genau diesen Zeitraum, z. B. 1.250 m² oder 320 Betriebsstunden. Quelle unten dokumentieren."
            >
              <input
                type="number"
                min="0.000001"
                step="any"
                value={value[key as keyof AnalysisInput] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [key]:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </div>
        <Field
          label="Quelle und Gültigkeit der Bezugsgrößen"
          help="Zum Beispiel: Nutzfläche aus Plan vom 01.01.; Betriebsstunden aus BDE für die beiden ausgewählten Zeiträume."
        >
          <textarea
            maxLength={2000}
            value={value.denominatorSource}
            onChange={(e) =>
              onChange({ ...value, denominatorSource: e.target.value })
            }
          />
        </Field>
      </details>
    </>
  );
}
export function AnalysisDisplay({
  data,
  admin = false,
  onReviewed,
}: {
  data: AnalysisResult;
  admin?: boolean;
  onReviewed?: () => void;
}) {
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<Raw | null>(null),
    [note, setNote] = useState("");
  return (
    <>
      <ErrorBox error={error} />
      <p className="subtle">
        Datenstand: {new Date(data.asOf).toLocaleString("de-DE")} ·
        Prozentänderungen beziehen sich auf die ausgewählten Gesamtzeiträume.
        Bei unterschiedlicher Länge Werte je Tag vergleichen.
      </p>
      <div className="analysis-cards">
        {data.comparisons.map((c) => (
          <article
            className="report-card"
            key={[c.medium, c.unit, c.direction].join()}
          >
            <h3>
              {media[c.medium] || c.medium} · {c.unit} ·{" "}
              {c.direction === "Import" ? "Bezug" : "Lieferung"}
            </h3>
            <div className="comparison-numbers">
              <div>
                <small>Aktuell</small>
                <strong>
                  {number(c.current)} {c.unit}
                </strong>
              </div>
              <div>
                <small>Vergleich</small>
                <strong>
                  {number(c.reference)} {c.unit}
                </strong>
              </div>
            </div>
            <p>
              Änderung: <b>{number(c.changePercent)} %</b>
            </p>
            <p>
              Je 24 Stunden: {number(c.currentPerDay)} /{" "}
              {number(c.referencePerDay)} {c.unit}
            </p>
            <dl className="detail-grid">
              <div>
                <dt>kWh/m² (aktuell / Vergleich)</dt>
                <dd>
                  {number(c.perArea)} / {number(c.referencePerArea)}
                </dd>
              </div>
              <div>
                <dt>kWh/Betriebsstunde</dt>
                <dd>
                  {number(c.perHour)} / {number(c.referencePerHour)}
                </dd>
              </div>
              <div>
                <dt>kWh/Produktionseinheit</dt>
                <dd>
                  {number(c.perProductionUnit)} /{" "}
                  {number(c.referencePerProductionUnit)}
                </dd>
              </div>
            </dl>
            {data.current.groups
              .filter(
                (g) =>
                  g.medium === c.medium &&
                  g.unit === c.unit &&
                  g.direction === c.direction,
              )
              .map((g) => (
                <p className="notice" key={g.medium}>
                  Bekannte Teilmenge {number(g.available)} {g.unit} · Abdeckung{" "}
                  {number(g.coverage * 100)} %
                  {g.estimated && " · zeitanteilig verteilt"}
                </p>
              ))}
            <MonthChart
              current={data.current}
              reference={data.reference}
              group={c}
            />
          </article>
        ))}
      </div>
      {data.current.groups.length === 0 && (
        <p>Keine freigegebenen Messstellen in diesem Bereich.</p>
      )}
      <h3>Datenqualität</h3>
      <div className="quality-summary">
        {[
          ["Messstellen", data.current.quality.length],
          [
            "Ablesungen fällig",
            data.current.quality.filter((q) => q.overdue).length,
          ],
          [
            "Offene Grenzwertprüfungen",
            data.current.quality.reduce((n, q) => n + q.openChecks, 0),
          ],
          [
            "Unvollständige Zeiträume",
            data.current.quality.filter((q) => q.coverage < 1).length,
          ],
        ].map(([label, count]) => (
          <div className="report-card" key={label}>
            <small>{label}</small>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <th>Messstelle</th>
              <th>Abdeckung</th>
              <th>Letzte Ablesung</th>
              <th>Hinweise / Herkunft</th>
            </tr>
          </thead>
          <tbody>
            {data.current.quality.map((q) => (
              <tr key={q.pointId}>
                <td>
                  {q.number}
                  <br />
                  {q.name}
                  <small>
                    {media[q.medium]} · {q.unit}
                  </small>
                </td>
                <td>{number(q.coverage * 100)} %</td>
                <td>
                  {q.latestAt
                    ? new Date(q.latestAt).toLocaleString("de-DE")
                    : "kein Stand"}
                  <small>
                    Intervall {q.intervalDays} Tage · Grenze{" "}
                    {number(q.dailyLimit)}
                  </small>
                </td>
                <td>
                  {q.issues.join("; ") || "Keine offenen Hinweise"}
                  <small>
                    Herkunft:{" "}
                    {Object.entries(q.sources)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "keine Ablesungen"}
                  </small>
                  {admin && q.openChecks > 0 && (
                    <details>
                      <summary>Grenzwertprüfungen bearbeiten</summary>
                      {data.current.readings
                        .filter(
                          (r) =>
                            r.pointId === q.pointId &&
                            r.needsReview &&
                            !r.reviewed,
                        )
                        .map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setReview(r);
                              setNote("");
                              setError(null);
                            }}
                          >
                            Stand {number(r.value)} vom{" "}
                            {new Date(r.at).toLocaleDateString("de-DE")} prüfen
                          </button>
                        ))}
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {review && (
        <form
          className="notice"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/quality/readings/${review.id}/review`, "POST", {
                version: review.version,
                reason: note,
              });
              setReview(null);
              onReviewed?.();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h4>Grenzwertprüfung dokumentieren</h4>
          <Field label="Prüfvermerk">
            <textarea
              minLength={5}
              maxLength={2000}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <button disabled={busy} className="primary">
            Prüfung bestätigen
          </button>
          <button type="button" onClick={() => setReview(null)}>
            Abbrechen
          </button>
        </form>
      )}
      <details>
        <summary>Berechnung und fachliche Grenzen</summary>
        <p>{data.method}</p>
        <p>
          Herkunft: Manual = manuell, Excel = XLSX/XLSM, Csv = CSV, Unknown =
          historisch nicht eindeutig gespeichert. Herkunft ist keine
          Qualitätsbewertung. Alte Werte werden nicht anhand frei bearbeitbarer
          Kommentare zugeordnet.
        </p>
      </details>
    </>
  );
}
function MonthChart({
  current,
  reference,
  group,
}: {
  current: Period;
  reference: Period;
  group: Comparison;
}) {
  const amount = (p: Period) =>
    p.months.map((m) => ({
      label: m.month,
      value:
        m.groups.find(
          (g) =>
            g.medium === group.medium &&
            g.unit === group.unit &&
            g.direction === group.direction,
        )?.value ?? null,
    }));
  const a = amount(current),
    b = amount(reference);
  const count = Math.max(a.length, b.length);
  const max = Math.max(1, ...a.concat(b).map((x) => x.value ?? 0));
  return (
    <div className="monthly-comparison">
      <p>
        <span className="chart-key current" /> Aktuell{" "}
        <span className="chart-key reference" /> Vergleich · Monate nach
        Reihenfolge des Zeitraums
      </p>
      <div className="month-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="month-pair">
            <div className="month-bars">
              {[a[i], b[i]].map((x, j) => (
                <div
                  key={j}
                  className={`month-bar ${j ? "reference" : "current"}`}
                  style={{
                    height:
                      x?.value == null
                        ? "4px"
                        : `${Math.max(1, (x.value / max) * 120)}px`,
                  }}
                  title={`${x?.label || "kein Monat"}: ${number(x?.value)} ${group.unit}`}
                >
                  <span>{x?.value == null ? "Lücke" : number(x.value)}</span>
                </div>
              ))}
            </div>
            <small>
              {a[i]?.label || "—"}
              <br />
              {b[i]?.label || "—"}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
export function EnergyAnalysis({
  customerId,
  session,
}: {
  customerId: string;
  session: Session;
}) {
  const [form, setForm] = useState(initialAnalysis),
    [request, setRequest] = useState<AnalysisInput | null>(null);
  const tree = useQuery({
    queryKey: ["technical", customerId],
    queryFn: () => api<Tree>(`/technical/${customerId}/tree`),
    enabled: !!customerId,
  });
  const result = useQuery({
    queryKey: ["energy-analysis", customerId, request],
    queryFn: () =>
      api<AnalysisResult>(`/analysis/${customerId}`, "POST", request),
    enabled: !!customerId && !!request,
    retry: false,
  });
  const nodes = tree.data?.nodes.map((x) => x.node) || [];
  return (
    <section className="panel">
      <h2>Vergleich und Datenqualität</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (JSON.stringify(form) === JSON.stringify(request))
            void result.refetch();
          else setRequest({ ...form });
        }}
      >
        <details open>
          <summary>Zeiträume und Umfang konfigurieren</summary>
          <div className="form-grid">
            <Field label="Standort für Auswertung">
              <select
                value={form.siteId || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    siteId: e.target.value || null,
                    buildingId: null,
                    nodeId: null,
                  })
                }
              >
                <option value="">Alle freigegebenen Standorte</option>
                {nodes
                  .filter((n) => n.kind === "Site")
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Gebäude für Auswertung">
              <select
                value={form.buildingId || ""}
                disabled={!form.siteId}
                onChange={(e) =>
                  setForm({ ...form, buildingId: e.target.value || null })
                }
              >
                <option value="">Alle Gebäude</option>
                {nodes
                  .filter(
                    (n) => n.kind === "Building" && n.parentId === form.siteId,
                  )
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Medium für Auswertung">
              <select
                value={form.medium}
                onChange={(e) => setForm({ ...form, medium: e.target.value })}
              >
                <option value="">Alle Medien getrennt</option>
                {Object.entries(media).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ComparisonFields value={form} onChange={setForm} />
        </details>
        <button className="primary" disabled={result.isFetching || !customerId}>
          {result.isFetching ? "Berechnung läuft …" : "Auswertung berechnen"}
        </button>
      </form>
      <ErrorBox error={tree.error || result.error} />
      {result.data && (
        <AnalysisDisplay
          data={result.data}
          admin={session.role === "SystemAdmin"}
          onReviewed={() => void result.refetch()}
        />
      )}
    </section>
  );
}
