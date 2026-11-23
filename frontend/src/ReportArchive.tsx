import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, download, type Session } from "./api";
import { ErrorBox, Field, Dialog } from "./ui";
import {
  AnalysisDisplay,
  ComparisonFields,
  initialAnalysis,
  type AnalysisResult,
} from "./EnergyAnalysis";
import type { Definition } from "./Reports";
type Report = {
  id: string;
  definitionId: string;
  sequence: number;
  name: string;
  status: string;
  createdAt: string;
  createdBy: string;
  releasedFrom: string | null;
  snapshotHash: string;
  pdf: boolean;
  excel: boolean;
};
export function ReportArchive({
  customerId,
  session,
  definitions,
}: {
  customerId: string;
  session: Session;
  definitions: Definition[];
}) {
  const admin = session.role === "SystemAdmin",
    [selected, setSelected] = useState(""),
    [form, setForm] = useState(initialAnalysis),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState<{ analysis: AnalysisResult } | null>(null),
    [release, setRelease] = useState<Report | null>(null),
    [reason, setReason] = useState("");
  const q = useQuery({
    queryKey: ["generated-reports", customerId],
    queryFn: () => api<Report[]>(`/reports/${customerId}/generated/`),
    enabled: !!customerId,
  });
  const definition = definitions.find((d) => d.id === selected);
  async function action(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await q.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel report-archive">
      <h2>Berichte erstellen und archivieren</h2>
      <p>
        PDF und Excel werden aus einem eingefrorenen Datenstand erzeugt. Spätere
        Korrekturen verändern archivierte Dateien nicht. Eine Freigabe erzeugt
        eine weitere Version aus denselben Daten.
      </p>
      <ErrorBox error={error || q.error} />
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {admin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              if (!definition) return;
              await api(
                `/reports/${customerId}/generated/${definition.id}`,
                "POST",
                { version: definition.version, analysis: form },
              );
              setNotice("Berichtsversion mit PDF/Excel gespeichert.");
            });
          }}
        >
          <Field label="Vorlage für Berichtserstellung">
            <select
              required
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                const d = definitions.find((x) => x.id === e.target.value);
                if (d) {
                  const yearBefore = (v: string) => {
                    const [y, m, day] = v.split("-").map(Number);
                    const date = new Date(y - 1, m - 1, day);
                    if (date.getMonth() !== m - 1) date.setDate(0);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  };
                  setForm({
                    ...initialAnalysis(),
                    from: d.from,
                    to: d.to,
                    compareFrom: yearBefore(d.from),
                    compareTo: yearBefore(d.to),
                  });
                }
              }}
            >
              <option value="">Gespeicherte Vorlage auswählen</option>
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.from} – {d.to}
                </option>
              ))}
            </select>
          </Field>
          {definition && (
            <>
              <p>
                Zeitraum und Anlagenumfang kommen aus Vorlage v
                {definition.version}.
              </p>
              <ComparisonFields dates={false} value={form} onChange={setForm} />
            </>
          )}
          <button disabled={busy || !definition} className="primary">
            {busy
              ? "Bericht wird erstellt …"
              : "Neue Berichtsversion erstellen"}
          </button>
        </form>
      )}
      <div className="report-cards">
        {q.data?.map((r) => (
          <article className="report-card" key={r.id}>
            <h3>
              {r.name} · v{r.sequence}
            </h3>
            <p>
              <span
                className={`badge ${r.status === "Freigegeben" ? "positive" : ""}`}
              >
                {r.status}
              </span>{" "}
              · {new Date(r.createdAt).toLocaleString("de-DE")} · {r.createdBy}
            </p>
            <small className="snapshot-hash">
              Datenstand SHA-256: {r.snapshotHash}
            </small>
            <div className="button-row">
              {r.pdf && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() =>
                      download(
                        `/reports/${customerId}/generated/${r.id}/pdf`,
                        "Bericht.pdf",
                      ),
                    )
                  }
                >
                  PDF herunterladen
                </button>
              )}
              {r.excel && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() =>
                      download(
                        `/reports/${customerId}/generated/${r.id}/xlsx`,
                        "Bericht.xlsx",
                      ),
                    )
                  }
                >
                  Excel herunterladen
                </button>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () =>
                    setPreview(
                      await api(
                        `/reports/${customerId}/generated/${r.id}/snapshot`,
                      ),
                    ),
                  )
                }
              >
                Datenstand ansehen
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    download(
                      `/reports/${customerId}/generated/${r.id}/snapshot`,
                      "Datenstand.json",
                    ),
                  )
                }
              >
                JSON-Datenstand
              </button>
              {admin &&
                r.status === "Entwurf" &&
                !q.data?.some((x) => x.releasedFrom === r.id) && (
                  <button
                    onClick={() => {
                      setRelease(r);
                      setReason("");
                    }}
                  >
                    Version freigeben
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
      {q.data?.length === 0 && <p>Noch keine erzeugten Berichte.</p>}
      {preview && (
        <Dialog
          title="Archivierter Datenstand"
          onClose={() => setPreview(null)}
        >
          <AnalysisDisplay data={preview.analysis} />
        </Dialog>
      )}
      {release && (
        <Dialog
          title="Berichtsversion freigeben"
          onClose={() => setRelease(null)}
        >
          <p>
            Die Freigabe erzeugt eine weitere Version mit den eingefrorenen
            Quelldaten dieses Entwurfs.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api(
                  `/reports/${customerId}/generated/${release.id}/release`,
                  "POST",
                  { version: release.sequence, reason },
                );
                setRelease(null);
                setNotice("Freigegebene Version archiviert.");
              });
            }}
          >
            <Field label="Begründung der Freigabe">
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Freigabe dokumentieren
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
