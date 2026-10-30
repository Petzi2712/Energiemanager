import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, download, date } from "../api";
import { Dialog, ErrorBox, Field } from "../ui";
import { num, type PointView } from "./types";

type ImportRow = {
  file: string;
  row: number;
  point: string;
  at: string | null;
  value: number | null;
  status: string;
  message: string;
};
type Preview = {
  rows: ImportRow[];
  ready: number;
  skipped: number;
  errors: number;
  warnings: number;
  token: string;
};
export function ExcelTools({
  customerId,
  points,
  canWrite,
  onImported,
  single = false,
}: {
  customerId: string;
  points: PointView[];
  canWrite: boolean;
  onImported: () => Promise<void>;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!points.length}>
        {single ? "Excel-Vorlage / Import" : "Excel-Massendownload / Import"}
      </button>
      {open && (
        <Dialog
          title={
            single
              ? "Excel-Ablesungen für diesen Zähler"
              : "Excel-Vorlagen und Sammelimport"
          }
          onClose={() => setOpen(false)}
        >
          <ExcelWorkflow
            customerId={customerId}
            points={points}
            canWrite={canWrite}
            onImported={onImported}
          />
        </Dialog>
      )}
    </>
  );
}
function ExcelWorkflow({
  customerId,
  points,
  canWrite,
  onImported,
}: {
  customerId: string;
  points: PointView[];
  canWrite: boolean;
  onImported: () => Promise<void>;
}) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState(
      points.slice(0, 100).map((p) => p.point.id),
    ),
    [search, setSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]),
    [preview, setPreview] = useState<Preview | null>(null),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(""),
    [fileKey, setFileKey] = useState(0);
  const [format, setFormat] = useState("xlsx"),
    [csvPoint, setCsvPoint] = useState(
      points.length === 1 ? points[0].point.id : "",
    );
  const work = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    setDone("");
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const form = () => {
    const body = new FormData();
    for (const file of files) body.append("files", file);
    if (csvPoint) body.set("csvPointId", csvPoint);
    return body;
  };
  return (
    <div className="excel-tools">
      <p className="subtle">
        Je Zähler eine geschützte XLSX-Datei. Nur die gelben Felder für Datum
        und Zählerstand bearbeiten. Datum in der auf der Vorlage angegebenen
        Standortzeitzone eintragen. Pro Vorlage sind 500 Ablesungen möglich.
      </p>
      <ErrorBox error={error} />
      {done && (
        <p className="notice success" role="status">
          {done}
        </p>
      )}
      <h3>1. Vorlagen herunterladen</h3>
      <Field label="Vorlagenformat">
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="xlsx">Excel (XLSX)</option>
          <option value="csv">CSV</option>
        </select>
      </Field>
      {points.length > 1 && (
        <>
          <Field label="Zähler für Download suchen">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selected.length === Math.min(points.length, 100)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? points.slice(0, 100).map((p) => p.point.id)
                    : [],
                )
              }
            />
            Alle auswählen (maximal 100)
          </label>
          <div className="excel-points">
            {points
              .filter((p) =>
                `${p.point.name} ${p.point.number} ${p.device?.number}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <label className="checkbox" key={p.point.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.point.id)}
                    disabled={
                      !selected.includes(p.point.id) && selected.length >= 100
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.point.id]
                          : selected.filter((id) => id !== p.point.id),
                      )
                    }
                  />
                  <span>
                    {p.point.name}
                    <small>
                      {p.point.number} · Gerät {p.device?.number}
                    </small>
                  </span>
                </label>
              ))}
          </div>
        </>
      )}
      <button
        disabled={busy || !selected.length}
        onClick={() =>
          void work(async () => {
            if (selected.length === 1)
              await download(
                `/meters/${selected[0]}/excel?format=${format}`,
                `Zaehler-${selected[0]}.xlsx`,
              );
            else
              await download(
                "/meter-excel/export",
                "Zaehler-Vorlagen.zip",
                "POST",
                { customerId, pointIds: selected, format },
              );
          })
        }
      >
        {selected.length === 1
          ? format === "csv"
            ? "CSV-Vorlage herunterladen"
            : "Excel-Vorlage herunterladen"
          : `${selected.length} Vorlagen als ZIP herunterladen`}
      </button>
      {canWrite && (
        <>
          <hr />
          <h3>2. Ausgefüllte Vorlagen prüfen und importieren</h3>
          <p className="subtle">
            XLSX, XLSM oder CSV einzeln bzw. als ZIP hochladen. Makros werden
            nicht ausgeführt. Zusammen maximal 6 MB, 100 Vorlagen und 5.000
            ausgefüllte Zeilen. Identische vorhandene Stände werden
            übersprungen. Bei Fehlern wird der gesamte Import zurückgehalten.
          </p>
          <p className="subtle">
            Normale CSV: Spalten „Datum“ und „Zählerstand“, dazu „ID Messstelle“
            oder eine Zuordnung unten. Trennzeichen: Semikolon, Komma oder
            Tabulator. CSV hat keinen Blattschutz; Vorlagenkennungen werden
            trotzdem geprüft.
          </p>
          <Field label="CSV ohne Kennung zuordnen">
            <select
              value={csvPoint}
              disabled={busy}
              onChange={(e) => {
                setCsvPoint(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">ID Messstelle aus CSV verwenden</option>
              {points.map((p) => (
                <option key={p.point.id} value={p.point.id}>
                  {p.point.name} · {p.point.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ausgefüllte Excel-/CSV-Dateien / ZIP auswählen">
            <input
              key={fileKey}
              type="file"
              multiple
              accept=".xlsx,.xlsm,.csv,.zip"
              disabled={busy}
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setPreview(null);
                setError(undefined);
                setConfirm(false);
                setReason("");
                setDone("");
              }}
            />
          </Field>
          <button
            disabled={busy || !files.length}
            onClick={() =>
              void work(async () => {
                const result = await api<Preview>(
                  `/meter-excel/preview?customerId=${customerId}`,
                  "POST",
                  form(),
                );
                setPreview(result);
              })
            }
          >
            {busy ? "Bitte warten …" : "Dateien prüfen"}
          </button>
          {preview && (
            <section className="excel-preview">
              <h3>Importvorschau</h3>
              <p>
                {preview.ready} neue Werte · {preview.skipped} identische Werte
                · {preview.errors} Fehler · {preview.warnings}{" "}
                Grenzwertwarnungen
              </p>
              {!preview.rows.length && (
                <p className="notice">
                  Keine ausgefüllten Datums-/Zählerstandszeilen gefunden.
                </p>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Datei / Zeile</th>
                      <th>Zähler</th>
                      <th>Datum (Browserzeit)</th>
                      <th>Stand</th>
                      <th>Prüfung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.rows]
                      .sort(
                        (a, b) =>
                          Number(b.status === "Fehler") -
                          Number(a.status === "Fehler"),
                      )
                      .slice(0, 200)
                      .map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.file}
                            <small>Zeile {r.row || "–"}</small>
                          </td>
                          <td>{r.point || "–"}</td>
                          <td>{date(r.at)}</td>
                          <td>{num(r.value)}</td>
                          <td>
                            <strong>{r.status}</strong>
                            <small>{r.message}</small>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 200 && (
                <p className="subtle">
                  Die ersten 200 Zeilen werden angezeigt, Fehler stehen zuerst.
                  Alle {preview.rows.length} Zeilen wurden geprüft.
                </p>
              )}
              {preview.warnings > 0 && (
                <>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />
                    Konfigurierte Grenzwertüberschreitungen nach Prüfung
                    bestätigen
                  </label>
                  <Field label="Begründung der Grenzwertbestätigung">
                    <textarea
                      minLength={5}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  preview.errors > 0 ||
                  preview.ready === 0 ||
                  (preview.warnings > 0 &&
                    (!confirm || reason.trim().length < 5))
                }
                onClick={() =>
                  void work(async () => {
                    const body = form();
                    body.set("previewToken", preview.token);
                    body.set("confirmWarnings", String(confirm));
                    body.set("reason", reason);
                    const result = await api<{
                      imported: number;
                      skipped: number;
                    }>(
                      `/meter-excel/import?customerId=${customerId}`,
                      "POST",
                      body,
                    );
                    setDone(
                      `${result.imported} Ablesungen gespeichert, ${result.skipped} identische Werte übersprungen.`,
                    );
                    setPreview(null);
                    setFiles([]);
                    setFileKey((k) => k + 1);
                    for (const key of [
                      "technical",
                      "meter",
                      "consumption",
                      "dashboard",
                    ])
                      await cache.invalidateQueries({ queryKey: [key] });
                    await onImported();
                  })
                }
              >
                Geprüfte Ablesungen importieren
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
