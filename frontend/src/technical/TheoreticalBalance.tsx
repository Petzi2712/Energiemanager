import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { ErrorBox, Field } from "../ui";
import { media, num } from "./types";

type Entry = {
  id: string;
  name: string;
  number: string;
  category: string;
  building: string;
  medium: string;
  unit: string;
  role: string;
  value: number;
  source: string;
};
type Balance = {
  name: string;
  entries: Entry[];
  totals: { medium: string; unit: string; role: string; value: number }[];
  missing: { id: string; name: string }[];
  covered: number;
  method: string;
};
const roles: Record<string, string> = {
  Consumption: "Verbrauch",
  Generation: "Erzeugung",
  Both: "Kombinierte Anlagen (ungeklärt)",
};
const palette = [
  "#b86616",
  "#237f91",
  "#7e62a6",
  "#4b8758",
  "#ba5263",
  "#8b743d",
  "#396db2",
  "#8c5f51",
];

export function TheoreticalBalance({
  customerId,
  nodeId,
  version,
}: {
  customerId: string;
  nodeId: string;
  version: string;
}) {
  const q = useQuery({
    queryKey: ["theory", customerId, nodeId, version],
    queryFn: () =>
      api<Balance>(`/technical/${customerId}/balance?nodeId=${nodeId}`),
  });
  const [selection, setSelection] = useState(""),
    [kind, setKind] = useState("Pie"),
    [groupBy, setGroupBy] = useState("category"),
    [percent, setPercent] = useState(10);
  const data = q.data;
  const key = (g: { medium: string; unit: string; role: string }) =>
    `${g.medium}|${g.unit}|${g.role}`;
  const active =
    data?.totals.find((g) => key(g) === selection) ||
    data?.totals.find((g) => g.role === "Consumption") ||
    data?.totals[0];
  const entries =
    data?.entries.filter((e) => active && key(e) === key(active)) || [];
  const totals = new Map<string, number>();
  for (const e of entries) {
    const label =
      groupBy === "name"
        ? `${e.name} · ${e.number}`
        : groupBy === "building"
          ? e.building
          : e.category;
    totals.set(label, (totals.get(label) || 0) + e.value);
  }
  const groups = [...totals]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const display =
    groups.length > 12
      ? [
          ...groups.slice(0, 11),
          {
            name: "Weitere Einträge",
            value: groups.slice(11).reduce((s, g) => s + g.value, 0),
          },
        ]
      : groups;
  return (
    <section className="panel theoretical-balance">
      <h2>Theoretische Jahresbilanz · {data?.name || "Gebäude / Standort"}</h2>
      <ErrorBox error={q.error} />
      {q.isLoading && <p role="status">Jahresbilanz wird berechnet …</p>}
      {data && (
        <>
          <p className="subtle">
            Abschätzung aus technischen Stammdaten und vorgegebenen
            Jahresmengen. Keine gemessene Energiebilanz.
          </p>
          {!active ? (
            <p className="notice">
              Noch keine Jahresmengen oder vollständigen
              Leistungs-/Betriebsdaten hinterlegt.
            </p>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Energieträger und Bilanz">
                  <select
                    value={key(active)}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    {data.totals.map((g) => (
                      <option key={key(g)} value={key(g)}>
                        {media[g.medium] || "Sonstige"} · {roles[g.role]} ·{" "}
                        {g.unit}/Jahr
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Diagrammart">
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="Pie">Kreisdiagramm</option>
                    <option value="Donut">Ringdiagramm</option>
                    <option value="Bar">Balkendiagramm</option>
                  </select>
                </Field>
                <Field label="Verbrauch aufschlüsseln nach">
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    <option value="category">Hardwarekategorie</option>
                    <option value="name">Anlage / Verbraucher</option>
                    <option value="building">Gebäude</option>
                  </select>
                </Field>
              </div>
              <div className="theory-total">
                <strong>
                  {num(active.value)} {active.unit}/Jahr
                </strong>
                <small>
                  {roles[active.role]} · {entries.length} berücksichtigte
                  Ansätze
                </small>
              </div>
              <EnergyChart
                groups={display}
                kind={kind}
                total={active.value}
                unit={active.unit}
              />
              {active.role === 'Consumption' && <section className="estimate-box">
                <strong>Rechnerisches Einsparszenario</strong>
                <p>
                  Die größten Verbrauchsanteile zuerst technisch prüfen.
                  Verbrauchsanteile allein belegen keine realisierbare
                  Einsparung.
                </p>
                <Field label="Angenommene Einsparung (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={percent}
                    onChange={(e) =>
                      setPercent(
                        Math.max(0, Math.min(100, Number(e.target.value))),
                      )
                    }
                  />
                </Field>
                <p>
                  {percent} % von {num(active.value)} {active.unit}/Jahr
                  entsprechen{" "}
                  <strong>
                    {num((active.value * percent) / 100)} {active.unit}/Jahr
                  </strong>
                  . Dieses Szenario ist eine frei gewählte Annahme.
                </p>
              </section>}
              <details>
                <summary>
                  Alle berücksichtigten Anlagen und Datenquellen
                </summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Anlage</th>
                        <th>Gebäude</th>
                        <th>Kategorie</th>
                        <th>Jahresmenge</th>
                        <th>Anteil</th>
                        <th>Grundlage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...entries]
                        .sort((a, b) => b.value - a.value)
                        .map((e) => (
                          <tr key={e.id}>
                            <td>{e.name}</td>
                            <td>{e.building}</td>
                            <td>{e.category}</td>
                            <td>
                              {num(e.value)} {e.unit}
                            </td>
                            <td>
                              {active.value
                                ? num((e.value / active.value) * 100)
                                : "0"}{" "}
                              %
                            </td>
                            <td>{e.source}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          {data.missing.length > 0 && (
            <p className="notice">
              {data.missing.length} aktive Hardwareeinträge ohne ausreichende
              Jahresdaten: {data.missing.map((e) => e.name).join(", ")}. Die
              Bilanz deckt nur die erfassten Ansätze ab.
            </p>
          )}
          {data.covered > 0 && (
            <p className="subtle">
              {data.covered} Unterwerte sind bereits in übergeordneten
              Gesamtansätzen enthalten und werden nicht doppelt addiert.
            </p>
          )}
          <p className="subtle">{data.method}</p>
        </>
      )}
    </section>
  );
}
function EnergyChart({
  groups,
  kind,
  total,
  unit,
}: {
  groups: { name: string; value: number }[];
  kind: string;
  total: number;
  unit: string;
}) {
  let cursor = 0;
  return (
    <figure className="theory-chart">
      <figcaption>
        Verteilung der theoretischen Jahresmenge ({unit}/Jahr)
      </figcaption>
      {kind === "Bar" ? (
        <div
          className="theory-bars"
          role="img"
          aria-label="Balkendiagramm der theoretischen Jahresbilanz"
        >
          {groups.map((g, i) => (
            <div className="theory-bar" key={g.name}>
              <span>{g.name}</span>
              <div>
                <i
                  style={{
                    width: `${total ? (g.value / Math.max(...groups.map((g) => g.value))) * 100 : 0}%`,
                    background: palette[i % palette.length],
                  }}
                />
              </div>
              <strong>
                {num(g.value)} {unit}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="theory-pie">
          <svg
            viewBox="0 0 240 240"
            role="img"
            aria-label={`${kind === "Pie" ? "Kreisdiagramm" : "Ringdiagramm"} der theoretischen Jahresbilanz`}
          >
            {total <= 0 ? (
              <circle
                cx="120"
                cy="120"
                r="90"
                fill="none"
                stroke="currentColor"
              />
            ) : (
              groups
                .filter((g) => g.value > 0)
                .map((g, i) => {
                  const fraction = g.value / total;
                  const start = cursor;
                  cursor += fraction;
                  const x = (angle: number) =>
                    120 + 98 * Math.cos(angle * 2 * Math.PI - Math.PI / 2);
                  const y = (angle: number) =>
                    120 + 98 * Math.sin(angle * 2 * Math.PI - Math.PI / 2);
                  const path = `M120,120 L${x(start)},${y(start)} A98,98 0 ${fraction > 0.5 ? 1 : 0} 1 ${x(cursor)},${y(cursor)} Z`;
                  return fraction >= 0.999999999 ? (
                    <circle
                      key={g.name}
                      cx="120"
                      cy="120"
                      r="98"
                      fill={palette[i % palette.length]}
                    >
                      <title>
                        {g.name}: {num(g.value)} {unit}
                      </title>
                    </circle>
                  ) : (
                    <path
                      key={g.name}
                      d={path}
                      fill={palette[i % palette.length]}
                      tabIndex={0}
                    >
                      <title>
                        {g.name}: {num(g.value)} {unit} ({num(fraction * 100)}{" "}
                        %)
                      </title>
                    </path>
                  );
                })
            )}
            {kind === "Donut" && (
              <circle cx="120" cy="120" r="58" className="theory-hole" />
            )}
          </svg>
          <ul>
            {groups.map((g, i) => (
              <li key={g.name}>
                <i style={{ background: palette[i % palette.length] }} />
                <span>
                  {g.name}
                  <small>
                    {num(g.value)} {unit} ·{" "}
                    {total ? num((g.value / total) * 100) : "0"} %
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
