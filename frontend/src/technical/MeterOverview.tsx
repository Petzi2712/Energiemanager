import { useQuery } from "@tanstack/react-query";
import { api, date } from "../api";
import { Badge, ErrorBox } from "../ui";
import { media, num } from "./types";
type Actual = {
  value: number | null;
  coverage: number;
  status: string;
  from: string;
  to: string;
  measuredFrom: string | null;
  measuredTo: string | null;
  intervals: number;
  omittedIntervals: number;
};
type Data = {
  asOf: string;
  method: string;
  totals: {
    medium: string;
    unit: string;
    direction: string;
    value: number | null;
    coverage: number;
    status: string;
    meters: number;
    measuredFrom: string | null;
    measuredTo: string | null;
  }[];
  points: {
    pointId: string;
    name: string;
    number: string;
    unit: string;
    medium: string;
    direction: string;
    isActive: boolean;
    latestReading: {
      at: string;
      value: number;
      isCurrentInstallation: boolean;
    } | null;
    year: Actual;
  }[];
};
const energyNum = (value: number | null | undefined) =>
  value != null && value !== 0 && Math.abs(value) < 0.000001
    ? new Intl.NumberFormat("de-DE", {
        notation: "scientific",
        maximumFractionDigits: 5,
      }).format(value)
    : num(value);
export function MeterOverview({
  customerId,
  nodeId,
  version,
  onSelect,
}: {
  customerId: string;
  nodeId?: string;
  version: string;
  onSelect: (id: string) => void;
}) {
  const q = useQuery({
    queryKey: ["meter-overview", customerId, nodeId, version],
    queryFn: () =>
      api<Data>(
        `/technical/${customerId}/meter-overview${nodeId ? `?nodeId=${nodeId}` : ""}`,
      ),
  });
  const data = q.data;
  return (
    <section className="panel meter-overview">
      <div className="section-heading">
        <div>
          <h2>Gesamtverbrauch im laufenden Jahr</h2>
          <p className="subtle">
            Erfasste Mengen bis zur jeweiligen letzten Ablesung · ohne doppelte
            Haupt-/Unterzählerzählung
          </p>
        </div>
        <button disabled={q.isFetching} onClick={() => q.refetch()}>
          Verbrauch aktualisieren
        </button>
      </div>
      <ErrorBox error={q.error} />
      {q.isLoading && <p role="status">Jahresverbrauch wird berechnet …</p>}
      <div className="meter-total-grid">
        {data?.totals.map((t) => (
          <article
            className="meter-total"
            key={`${t.medium}|${t.unit}|${t.direction}`}
          >
            <h3>
              {media[t.medium]} ·{" "}
              {t.direction === "Export" ? "Liefermenge" : "Bezug"}
            </h3>
            <strong>
              {energyNum(t.value)} {t.unit}
            </strong>
            <Badge active={t.status === "Gemessen"}>{t.status}</Badge>
            <small>
              {t.meters} bilanzierte Messstellenperioden
              {t.measuredTo ? ` · bis ${date(t.measuredTo)}` : ""}
            </small>
          </article>
        ))}
      </div>
      {data?.totals.length === 0 && (
        <p className="notice">
          Noch keine berechenbaren Verbrauchsintervalle in diesem Bereich
          erfasst.
        </p>
      )}
      <h3>Zugeordnete Messstellen</h3>
      <div className="meter-tile-grid">
        {data?.points.map((p) => (
          <button
            className="meter-tile"
            key={p.pointId}
            onClick={() => onSelect(p.pointId)}
          >
            <strong>{p.name}</strong>
            <small>
              ID Messstelle: {p.number} · {media[p.medium]} ·{" "}
              {p.direction === "Export" ? "Lieferung" : "Bezug"}
              {!p.isActive ? " · inaktiv" : ""}
            </small>
            <dl>
              <div>
                <dt>Aktueller Zählerstand</dt>
                <dd>
                  {p.latestReading
                    ? `${num(p.latestReading.value)} ${p.unit}`
                    : "Noch kein Stand"}
                </dd>
                <small>
                  {p.latestReading
                    ? `Stand vom ${date(p.latestReading.at)}`
                    : "Keine Ablesung erfasst"}
                  {p.latestReading && !p.latestReading.isCurrentInstallation
                    ? " · vorheriges Gerät"
                    : ""}
                </small>
              </div>
              <div>
                <dt>Erfasster Jahresverbrauch</dt>
                <dd>
                  {energyNum(p.year.value)} {p.unit}
                </dd>
                <small>
                  {p.year.status}
                  {p.year.measuredFrom
                    ? ` · ${date(p.year.measuredFrom)} bis ${date(p.year.measuredTo)}`
                    : ""}
                  {p.year.omittedIntervals > 0
                    ? " · Randintervalle nicht exakt zuordenbar"
                    : ""}
                </small>
              </div>
            </dl>
            <span className="meter-tile-open">Zähler öffnen →</span>
          </button>
        ))}
      </div>
      {data && data.points.length === 0 && (
        <p className="subtle">
          Keine aktuell zugeordneten Messstellen. Historische
          Verbrauchsintervalle können weiterhin in der Gesamtsumme enthalten
          sein.
        </p>
      )}
      {data && <p className="subtle meter-overview-method">{data.method}</p>}
    </section>
  );
}
