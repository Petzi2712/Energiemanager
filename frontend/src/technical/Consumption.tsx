import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Badge, ErrorBox, Field } from "../ui";
import { localInput, num } from "./types";

type Bucket = {
  from: string;
  to: string;
  consumption: number | null;
  availableConsumption: number | null;
  submeterTotal: number | null;
  unassignedConsumption: number | null;
  coverage: number;
  status: string;
};
type Series = {
  from: string;
  to: string;
  unit: string;
  status: string;
  consumption: number | null;
  availableConsumption: number | null;
  coverage: number;
  submeterTotal: number | null;
  unassignedConsumption: number | null;
  timeZone: string;
  warning: string;
  method: string;
  buckets: Bucket[];
  children: {
    pointId: string;
    name: string;
    consumption: number | null;
    unit: string;
  }[];
};
const options = {
  Day: "Tage",
  Week: "Wochen",
  Month: "Monate",
  Year: "Jahre",
  Total: "Gesamtzeitraum",
};
const last30 = () => {
  const end = new Date();
  const beginning = new Date(end.getTime() - 30 * 86400000);
  return { from: localInput(beginning), to: localInput(end) };
};

export function Consumption({
  pointId,
  version,
}: {
  pointId: string;
  version: number;
}) {
  const [range, setRange] = useState(last30),
    [applied, setApplied] = useState(range),
    [bucket, setBucket] = useState("Day");
  const [validation, setValidation] = useState<unknown>();
  const q = useQuery({
    queryKey: ["consumption", pointId, version, applied, bucket],
    queryFn: () =>
      api<Series>(
        `/meters/${pointId}/series?from=${encodeURIComponent(new Date(applied.from).toISOString())}&to=${encodeURIComponent(new Date(applied.to).toISOString())}&bucket=${bucket}`,
      ),
  });
  const data = q.data;
  return (
    <section className="panel consumption-panel">
      <div className="section-heading">
        <div>
          <h2>Verbrauch und Unterzählerbilanz</h2>
          <p className="subtle">
            Vorgabe: letzte 30 Tage · Zeitauflösung frei wählbar
          </p>
        </div>
        <button
          onClick={() => {
            const r = last30();
            setRange(r);
            setApplied(r);
            setValidation(undefined);
          }}
        >
          Letzte 30 Tage
        </button>
      </div>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (range.from >= range.to) {
            setValidation("Der Beginn muss vor dem Ende liegen.");
            return;
          }
          setValidation(undefined);
          setApplied({ ...range });
        }}
      >
        <div className="form-grid">
          <Field label="Beginn (Browser-Ortszeit)">
            <input
              required
              type="datetime-local"
              step="1"
              name="balanceFrom"
              autoComplete="off"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field label="Ende (Browser-Ortszeit)">
            <input
              required
              type="datetime-local"
              step="1"
              name="balanceTo"
              autoComplete="off"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
          <Field label="Balken gruppieren nach">
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              {Object.entries(options).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button disabled={q.isFetching}>Zeitraum übernehmen</button>
      </form>
      <ErrorBox error={validation || q.error} />
      {q.isLoading && <p role="status">Verbrauch wird berechnet …</p>}
      {data && (
        <div className="balance-result">
          <Badge active={data.status === "Gemessen"}>{data.status}</Badge>
          {data.warning && <p className="notice">{data.warning}</p>}
          <dl className="detail-grid">
            <div>
              <dt>
                {data.consumption == null
                  ? "Erfasster Teilverbrauch"
                  : "Hauptzählerverbrauch"}
              </dt>
              <dd>
                {num(data.consumption ?? data.availableConsumption)} {data.unit}
                <small>
                  {Math.round(data.coverage * 100)} % des Zeitraums durch
                  Ablesungen abgedeckt
                </small>
              </dd>
            </div>
            <div>
              <dt>Summe direkter Unterzähler</dt>
              <dd>
                {num(data.submeterTotal)} {data.unit}
              </dd>
            </div>
            <div>
              <dt>Nicht zugeordneter Verbrauch</dt>
              <dd>
                {num(data.unassignedConsumption)} {data.unit}
              </dd>
            </div>
          </dl>
          <ConsumptionChart data={data} bucket={bucket} />
          <p className="subtle">
            {data.method} Kalendergrenzen in {data.timeZone}. Fehlende Werte
            sind keine Nullverbräuche.
          </p>
          {data.coverage < 1 && (
            <p className="notice">
              Für Teile des gewählten Zeitraums fehlen Ablesungen. Ergänzen Sie
              passende Anfangs- und Endstände oder wählen Sie einen Zeitraum mit
              vorhandenen Messwerten.
            </p>
          )}
          <details className="chart-values">
            <summary>Werte und Unterzähler anzeigen</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Zeitraum</th>
                    <th>Verbrauch ({data.unit})</th>
                    <th>Unterzähler ({data.unit})</th>
                    <th>Rest ({data.unit})</th>
                    <th>Datenbasis</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buckets.map((b) => (
                    <tr key={b.from}>
                      <td>
                        {new Date(b.from).toLocaleString("de-DE", {
                          timeZone: data.timeZone,
                        })}{" "}
                        –{" "}
                        {new Date(b.to).toLocaleString("de-DE", {
                          timeZone: data.timeZone,
                        })}
                      </td>
                      <td>{num(b.consumption ?? b.availableConsumption)}</td>
                      <td>{num(b.submeterTotal)}</td>
                      <td>{num(b.unassignedConsumption)}</td>
                      <td>
                        {b.status} · {Math.round(b.coverage * 100)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.children.map((c) => (
              <p key={c.pointId}>
                {c.name}: {num(c.consumption)} {c.unit}
              </p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}

function ConsumptionChart({ data, bucket }: { data: Series; bucket: string }) {
  const [visible, setVisible] = useState([true, true, false]);
  const legends = ["Hauptzähler", "Direkte Unterzähler", "Nicht zugeordnet"];
  const colors = ["#bd650e", "#267f91", "#7c6aaf"];
  const values = (b: Bucket) => [
    b.consumption ?? b.availableConsumption,
    b.submeterTotal,
    b.unassignedConsumption,
  ];
  const all = data.buckets.flatMap(
    (b) => values(b).filter((v, i) => visible[i] && v != null) as number[],
  );
  const min = Math.min(0, ...all),
    max = Math.max(0, ...all),
    span = max - min || 1;
  const width = Math.max(680, data.buckets.length * 58 + 90),
    height = 300,
    top = 28,
    bottom = 235;
  const y = (v: number) => bottom - ((v - min) / span) * (bottom - top),
    step = (width - 90) / Math.max(1, data.buckets.length);
  const label = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", {
      timeZone: data.timeZone,
      ...(bucket === "Year"
        ? { year: "numeric" }
        : bucket === "Month"
          ? { month: "short", year: "2-digit" }
          : { day: "2-digit", month: "2-digit" }),
    });
  return (
    <figure className="consumption-chart">
      <figcaption>Verbrauch im gewählten Zeitraum ({data.unit})</figcaption>
      <div className="chart-legend">
        {legends.map((l, i) => (
          <label key={l}>
            <input
              type="checkbox"
              checked={visible[i]}
              onChange={(e) =>
                setVisible(
                  visible.map((v, j) => (j === i ? e.target.checked : v)),
                )
              }
            />
            <span style={{ background: colors[i] }} />
            {l}
          </label>
        ))}
      </div>
      {!all.length && (
        <p className="empty">
          Für diesen Zeitraum liegen keine berechenbaren Verbrauchswerte vor.
        </p>
      )}
      <div
        className="chart-scroll"
        tabIndex={0}
        aria-label="Verbrauchsdiagramm, horizontal scrollbar"
      >
        <svg
          role="img"
          aria-label={`Balkendiagramm des Verbrauchs in ${data.unit}, ${data.buckets.length} Zeitabschnitte`}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          <title>Verbrauch und Unterzählerbilanz</title>
          <desc>
            Zeitanteilige Werte und Messlücken sind je Balken beschriftet. Die
            vollständigen Werte stehen in der Tabelle unter dem Diagramm.
          </desc>
          {[min, min + span / 2, min + span].map((v, i) => (
            <g key={i}>
              <line
                x1="65"
                y1={y(v)}
                x2={width - 15}
                y2={y(v)}
                className="chart-grid"
              />
              <text x="59" y={y(v) + 4} textAnchor="end">
                {new Intl.NumberFormat("de-DE", {
                  maximumFractionDigits: 1,
                  notation: Math.abs(v) >= 100000 ? "compact" : "standard",
                }).format(v)}
              </text>
            </g>
          ))}
          <line
            x1="65"
            y1={y(0)}
            x2={width - 15}
            y2={y(0)}
            className="chart-zero"
          />
          {data.buckets.map((b, i) => (
            <g key={b.from}>
              {values(b).map((value, j) =>
                visible[j] && value != null ? (
                  <rect
                    key={j}
                    tabIndex={0}
                    x={72 + i * step + j * 12}
                    y={Math.min(y(0), y(value))}
                    width="10"
                    height={Math.max(1, Math.abs(y(value) - y(0)))}
                    fill={colors[j]}
                    opacity={j === 0 && b.coverage < 1 ? 0.55 : 1}
                    aria-label={`${label(b.from)}, ${legends[j]}: ${num(value)} ${data.unit}, ${b.status}`}
                  >
                    <title>{`${new Date(b.from).toLocaleString("de-DE", { timeZone: data.timeZone })} bis ${new Date(b.to).toLocaleString("de-DE", { timeZone: data.timeZone })}\n${legends[j]}: ${num(value)} ${data.unit}\n${b.status}, ${Math.round(b.coverage * 100)} % Abdeckung`}</title>
                  </rect>
                ) : null,
              )}
              {b.availableConsumption == null && (
                <text x={84 + i * step} y={y(0) - 7} textAnchor="middle">
                  –
                </text>
              )}
              <text x={86 + i * step} y="256" textAnchor="middle">
                {label(b.from)}
              </text>
              <text x={86 + i * step} y="275" textAnchor="middle">
                {b.status === "Unvollständig"
                  ? "Lücke"
                  : b.status === "Zeitanteilig"
                    ? "anteilig"
                    : ""}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
