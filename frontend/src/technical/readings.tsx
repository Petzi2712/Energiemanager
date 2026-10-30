import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError, date } from "../api";
import { Badge, Dialog, ErrorBox, Field } from "../ui";
import { DeviceFields, type DeviceForm } from "./forms";
import { DeleteDialog } from "../DeleteDialog";
import { Consumption } from "./Consumption";
import { ExcelTools } from "./ExcelTools";
import {
  events,
  localInput,
  media,
  num,
  type Detail,
  type Document,
  type PointView,
  type Reading,
  type Tree,
} from "./types";

export async function upload(file: File, query: string) {
  const form = new FormData();
  form.set("file", file);
  return api(`/documents?${query}`, "POST", form);
}
function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (file.size > 6 * 1024 * 1024) return;
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return file.size > 6 * 1024 * 1024 ? (
    <p className="notice error">Foto ist größer als 6 MB.</p>
  ) : (
    <img
      className="photo-preview"
      src={url || undefined}
      alt="Vorschau des ausgewählten Zählerfotos"
    />
  );
}
export function Documents({
  nodeId,
  readingId,
  documents,
  canWrite,
  onSaved,
}: {
  nodeId?: string;
  readingId?: string;
  documents?: Document[];
  canWrite: boolean;
  onSaved?: () => Promise<void>;
}) {
  const q = useQuery({
    queryKey: ["documents", nodeId],
    queryFn: () => api<Document[]>(`/documents?nodeId=${nodeId}`),
    enabled: !!nodeId,
  });
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Document | null>(null);
  return (
    <section className={nodeId ? "panel" : "reading-documents"}>
      {nodeId && <h2>Fotos und technische Dokumente</h2>}
      <ErrorBox error={error || q.error} />
      <div className="document-list">
        {(documents || q.data || []).map((d) => (
          <div className="document-card" key={d.id}>
            <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">
              {d.contentType.startsWith("image/") ? (
                <img
                  src={`/api/documents/${d.id}`}
                  alt={d.name}
                  loading="lazy"
                />
              ) : (
                <span className="pdf-icon">PDF</span>
              )}
              <span>{d.name}</span>
            </a>
            {canWrite && (
              <button
                className="danger document-delete"
                onClick={() => setRemove(d)}
                aria-label={`Datei löschen: ${d.name}`}
              >
                Löschen
              </button>
            )}
          </div>
        ))}
      </div>
      {remove && (
        <DeleteDialog
          title="Datei löschen"
          path={`/documents/${remove.id}`}
          description={`„${remove.name}“ löschen? Die Löschung wird protokolliert.`}
          onClose={() => setRemove(null)}
          onDeleted={async () => {
            setRemove(null);
            if (nodeId) await q.refetch();
            await onSaved?.();
          }}
        />
      )}
      {canWrite && (
        <label className="file-label">
          {busy
            ? "Upload läuft …"
            : nodeId
              ? "Foto / PDF hinzufügen (max. 6 MB)"
              : "Ablesefoto hinzufügen (max. 6 MB)"}
          <input
            type="file"
            disabled={busy}
            accept={
              nodeId
                ? "image/jpeg,image/png,application/pdf"
                : "image/jpeg,image/png"
            }
            capture={nodeId ? undefined : "environment"}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError(undefined);
              setBusy(true);
              try {
                await upload(
                  file,
                  nodeId ? `nodeId=${nodeId}` : `readingId=${readingId}`,
                );
                if (nodeId) await q.refetch();
                await onSaved?.();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      )}
    </section>
  );
}
export function MeterPanel({
  view,
  tree,
  admin,
  canWrite,
  refresh,
  onEdit,
  onAssignment,
  onDeleted,
}: {
  view: PointView;
  tree: Tree;
  admin: boolean;
  canWrite: boolean;
  refresh: () => Promise<void>;
  onEdit: () => void;
  onAssignment: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState({ from: "", to: "" });
  const params = new URLSearchParams({ page: String(page) });
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  const q = useQuery({
    queryKey: ["meter", view.point.id, page, filter],
    queryFn: () => api<Detail>(`/meters/${view.point.id}?${params}`),
  });
  const [edit, setEdit] = useState<Reading | null>(null),
    [replacement, setReplacement] = useState(false),
    [history, setHistory] = useState(false),
    [remove, setRemove] = useState(false);
  const data = q.data;
  const current =
    data?.installations.find((i) => !i.validTo) || view.installation;
  const device =
    data?.devices.find((d) => d.id === current?.deviceId) || view.device;
  const p = data?.point || view.point;
  const timeZone =
    tree.nodes.find((n) => n.node.id === view.assignment.siteId)?.node
      .timeZone || "Europe/Berlin";
  const displayDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone,
        }).format(new Date(value))
      : "Noch keine Ablesung";
  async function reload() {
    await q.refetch();
    await refresh();
  }
  return (
    <>
      <ErrorBox error={q.error} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {media[p.medium]} · {p.number}
            </span>
            <h2>{p.name}</h2>
          </div>
          <Badge active={p.isActive}>{p.isActive ? "Aktiv" : "Inaktiv"}</Badge>
        </div>
        <dl className="meter-summary">
          <div>
            <dt>Zählernummer</dt>
            <dd>{device?.number || "–"}</dd>
          </div>
          <div>
            <dt>Letzte Ablesung</dt>
            <dd>{displayDate(view.latestReading?.at)}</dd>
          </div>
          <div>
            <dt>Letzter Stand</dt>
            <dd>
              {view.latestReading
                ? `${num(view.latestReading.value)} ${p.unit}`
                : "Noch kein Stand"}
            </dd>
          </div>
          <div>
            <dt>Faktor / Auflösung</dt>
            <dd>
              {num(current?.factor)} / {num(current?.resolution)} {p.unit}
            </dd>
          </div>
        </dl>
        <div className="toolbar-actions">
          <ExcelTools
            single
            customerId={p.customerId}
            points={[view]}
            canWrite={canWrite}
            onImported={reload}
          />
          {admin && (
            <>
              <button onClick={onEdit}>Messstelle bearbeiten</button>
              <button onClick={onAssignment}>Zuordnung ändern</button>
              <button className="danger" onClick={() => setRemove(true)}>
                Zähler löschen
              </button>
            </>
          )}
          <button onClick={() => setHistory(!history)}>
            {history ? "Gerätehistorie schließen" : "Geräte und Zuordnungen"}
          </button>
          {canWrite && p.isActive && (
            <button onClick={() => setReplacement(true)}>
              Zählertausch erfassen
            </button>
          )}
        </div>
        {data?.replacements.some((r) => r.isIncomplete) && (
          <p className="notice">
            Ein Zählertausch enthält fehlende Austauschstände. Der betroffene
            Verbrauchszeitraum ist unvollständig.
          </p>
        )}
        {history && data && (
          <div className="meter-history">
            <h3>Geräteperioden</h3>
            {data.installations.map((i) => (
              <p key={i.id}>
                <strong>
                  {data.devices.find((d) => d.id === i.deviceId)?.number}
                </strong>{" "}
                · {displayDate(i.validFrom)} bis{" "}
                {i.validTo ? displayDate(i.validTo) : "heute"} · Faktor{" "}
                {num(i.factor)}
              </p>
            ))}
            <h3>Zuordnungshistorie</h3>
            {data.assignments.map((a) => (
              <p key={a.id}>
                {tree.nodes.find((n) => n.node.id === a.nodeId)?.node.name ||
                  "Historischer Anlagenknoten"}{" "}
                · {displayDate(a.validFrom)} bis{" "}
                {a.validTo ? displayDate(a.validTo) : "heute"}
              </p>
            ))}
            {data.replacements.map((r) => (
              <p key={r.id}>
                Zählertausch {displayDate(r.at)} · {r.reason}
              </p>
            ))}
          </div>
        )}
      </section>
      {canWrite && p.isActive && (
        <ReadingForm point={view} installation={current} onSaved={reload} />
      )}
      <ReadingHistory
        data={data}
        unit={p.unit}
        timeZone={timeZone}
        displayDate={displayDate}
        admin={admin}
        canWrite={canWrite}
        busy={q.isFetching}
        reload={reload}
        onEdit={setEdit}
        onPage={setPage}
        onFilter={(next) => {
          setFilter(next);
          setPage(1);
        }}
      />
      <Consumption pointId={p.id} version={p.version} />
      {remove && (
        <DeleteDialog
          title={`Zähler löschen · ${p.name}`}
          path={`/meters/${p.id}`}
          version={p.version}
          description="Der Zähler wird aus dem Anlagenbaum entfernt. Ablesungen und Gerätehistorie bleiben zur Nachvollziehbarkeit gespeichert. Vorhandene Unterzähler zuerst umhängen oder löschen."
          onClose={() => setRemove(false)}
          onDeleted={onDeleted}
        />
      )}
      {edit && (
        <Dialog
          title="Zählerstand nachvollziehbar korrigieren"
          onClose={() => setEdit(null)}
        >
          <ReadingForm
            point={view}
            installation={
              data!.installations.find((i) => i.id === edit.installationId)!
            }
            reading={edit}
            onSaved={async () => {
              setEdit(null);
              await reload();
            }}
          />
        </Dialog>
      )}
      {replacement && (
        <ReplacementForm
          view={{ ...view, point: p }}
          onClose={() => setReplacement(false)}
          onSaved={async () => {
            setReplacement(false);
            await reload();
          }}
        />
      )}
    </>
  );
}
function ReadingHistory({
  data,
  unit,
  timeZone,
  displayDate,
  admin,
  canWrite,
  busy,
  reload,
  onEdit,
  onPage,
  onFilter,
}: {
  data?: Detail;
  unit: string;
  timeZone: string;
  displayDate: (value?: string | null) => string;
  admin: boolean;
  canWrite: boolean;
  busy: boolean;
  reload: () => Promise<void>;
  onEdit: (r: Reading) => void;
  onPage: (page: number) => void;
  onFilter: (range: { from: string; to: string }) => void;
}) {
  const [range, setRange] = useState({ from: "", to: "" }),
    [expanded, setExpanded] = useState<string | null>(null),
    [error, setError] = useState<unknown>();
  const paging = data?.paging;
  return (
    <section className="panel reading-history-panel">
      <div className="section-heading">
        <div>
          <h2>Ablesehistorie</h2>
          <p className="subtle">
            15 Einträge je Seite · Zeitangaben: {timeZone}
          </p>
        </div>
        <button disabled={busy} onClick={reload}>
          Aktualisieren
        </button>
      </div>
      <form
        autoComplete="off"
        className="history-filter"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            range.from &&
            range.to &&
            new Date(range.from) > new Date(range.to)
          ) {
            setError("Der Beginn muss vor dem Ende liegen.");
            return;
          }
          setError(undefined);
          setExpanded(null);
          onFilter({
            from: range.from ? new Date(range.from).toISOString() : "",
            to: range.to
              ? new Date(range.to)
                  .toISOString()
                  .replace(/\.\d{3}Z$/, ".999999Z")
              : "",
          });
        }}
      >
        <div className="form-grid">
          <Field label="Historie von (Browser-Ortszeit)">
            <input
              name="historyFrom"
              type="datetime-local"
              step="1"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field label="Historie bis (Browser-Ortszeit)">
            <input
              name="historyTo"
              type="datetime-local"
              step="1"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
        </div>
        <div className="toolbar-actions">
          <button disabled={busy}>Historienzeitraum übernehmen</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRange({ from: "", to: "" });
              setExpanded(null);
              setError(undefined);
              onFilter({ from: "", to: "" });
            }}
          >
            Gesamter Zeitraum
          </button>
        </div>
      </form>
      <ErrorBox error={error} />
      <div className="table-scroll">
        <table className="compact-readings">
          <thead>
            <tr>
              <th>Ablesezeitpunkt</th>
              <th>Zählerstand</th>
              <th>Verbrauch</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.readings.map(({ reading: r, consumption }) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="nowrap">{displayDate(r.at)}</td>
                  <td>
                    {num(r.value)} {unit}
                  </td>
                  <td>
                    {num(consumption)} {consumption == null ? "" : unit}
                  </td>
                  <td>
                    <Badge active={r.status === "Gültig"}>{r.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      aria-label={`Ablesedetails ${displayDate(r.at)}`}
                      aria-expanded={expanded === r.id}
                      onClick={() =>
                        setExpanded(expanded === r.id ? null : r.id)
                      }
                    >
                      {expanded === r.id ? "Schließen" : "Aufklappen"}
                    </button>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="reading-expanded">
                    <td colSpan={5}>
                      <div className="reading-detail-grid">
                        <div>
                          <h3>Ablesedetails</h3>
                          <p>
                            Gespeichert: {displayDate(r.createdAt)}
                            <br />
                            Gerät:{" "}
                            {
                              data.devices.find(
                                (d) =>
                                  d.id ===
                                  data.installations.find(
                                    (i) => i.id === r.installationId,
                                  )?.deviceId,
                              )?.number
                            }
                          </p>
                          <p>
                            {r.event}
                            {r.isRollover ? " · Überlauf" : ""}
                            <br />
                            {r.comment}
                          </p>
                          {r.reason && <p>Begründung: {r.reason}</p>}
                          {admin && (
                            <button onClick={() => onEdit(r)}>
                              Korrigieren
                            </button>
                          )}
                        </div>
                        <div>
                          <h3>Nachweis</h3>
                          <Documents
                            readingId={r.id}
                            documents={data.documents.filter(
                              (d) => d.readingId === r.id,
                            )}
                            canWrite={canWrite}
                            onSaved={reload}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!data?.readings.length && !busy && (
        <p className="empty">Keine Ablesungen im gewählten Zeitraum.</p>
      )}
      {paging && (
        <nav className="reading-pagination" aria-label="Ablesehistorie Seiten">
          <button
            disabled={busy || paging.page <= 1}
            onClick={() => {
              setExpanded(null);
              onPage(paging.page - 1);
            }}
          >
            Vorherige 15
          </button>
          <span>
            Seite {paging.page} von {paging.totalPages} · {paging.total}{" "}
            Einträge
          </span>
          <button
            disabled={busy || paging.page >= paging.totalPages}
            onClick={() => {
              setExpanded(null);
              onPage(paging.page + 1);
            }}
          >
            Nächste 15
          </button>
        </nav>
      )}
      {data && data.revisions.length > 0 && (
        <details className="revision-history">
          <summary>
            Korrekturhistorie dieser Seite ({data.revisions.length})
          </summary>
          {data.revisions.map((r) => (
            <div key={r.id}>
              <strong>
                {displayDate(r.at)} · {r.reason}
              </strong>
              <pre>
                {JSON.stringify(
                  {
                    vorher: JSON.parse(r.before),
                    nachher: JSON.parse(r.after),
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
function ReadingForm({
  point,
  installation,
  reading,
  onSaved,
}: {
  point: PointView;
  installation: PointView["installation"];
  reading?: Reading;
  onSaved: () => Promise<void>;
}) {
  const [at, setAt] = useState(
      reading ? localInput(new Date(reading.at)) : localInput(),
    ),
    [value, setValue] = useState(reading ? String(reading.value) : ""),
    [comment, setComment] = useState(reading?.comment || ""),
    [event, setEvent] = useState(reading?.event || ""),
    [reason, setReason] = useState(""),
    [rollover, setRollover] = useState(reading?.isRollover || false),
    [confirm, setConfirm] = useState(false),
    [warning, setWarning] = useState(false),
    [photo, setPhoto] = useState<File | null>(null),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  return (
    <section className={reading ? "" : "panel"}>
      {!reading && <h2>Neuen Zählerstand erfassen</h2>}
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const r = await api<Reading>(
              `/meters/${point.point.id}/readings${reading ? `/${reading.id}` : ""}`,
              reading ? "PUT" : "POST",
              {
                at: reading?.at || new Date(at).toISOString(),
                value: Number(value),
                comment,
                event,
                reason,
                isRollover: rollover,
                confirmWarning: confirm,
                version: reading?.version || 1,
              },
            );
            setValue("");
            setPhoto(null);
            setFileKey((k) => k + 1);
            if (photo) {
              try {
                await upload(photo, `readingId=${r.id}`);
              } catch {
                await onSaved();
                throw new Error(
                  "Ablesung gespeichert. Foto konnte nicht hochgeladen werden; bitte in der Historie ergänzen.",
                );
              }
            }
            setValue("");
            setComment("");
            setReason("");
            setConfirm(false);
            setWarning(false);
            setPhoto(null);
            await onSaved();
          } catch (e) {
            setError(e);
            if (e instanceof ApiError && e.status === 422) setWarning(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field
            label={`Ablesezeitpunkt (Browser-Ortszeit: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`}
          >
            <input
              type="datetime-local"
              step="1"
              required
              readOnly={!!reading}
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
          <Field label={`Zählerstand (${point.point.unit}) *`}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={installation?.resolution || "any"}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Besonderes Ereignis">
            <select value={event} onChange={(e) => setEvent(e.target.value)}>
              {events.map((v) => (
                <option key={v} value={v}>
                  {v || "Kein besonderes Ereignis"}
                </option>
              ))}
              {reading?.event === "Zählertausch" && (
                <option>Zählertausch</option>
              )}
            </select>
          </Field>
          <Field label="Kommentar">
            <textarea
              rows={2}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={rollover}
            onChange={(e) => setRollover(e.target.checked)}
          />
          Zählwerksüberlauf (nur bei konfigurierter Zählwerksgrenze)
        </label>
        {(warning || reading || rollover) && (
          <>
            <Field label="Begründung (mindestens 5 Zeichen)">
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              Auffälligen Wert nach erneuter Prüfung bestätigen
            </label>
          </>
        )}
        {!reading && (
          <Field label="Zählerfoto aufnehmen / auswählen (optional, JPEG/PNG)">
            <input
              key={fileKey}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </Field>
        )}
        {photo && (
          <>
            <p className="subtle">Ausgewählt: {photo.name}</p>
            <PhotoPreview file={photo} />
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Speichern …"
            : reading
              ? "Korrektur speichern"
              : "Zählerstand speichern"}
        </button>
      </form>
    </section>
  );
}
function ReplacementForm({
  view,
  onClose,
  onSaved,
}: {
  view: PointView;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [at, setAt] = useState(localInput()),
    [oldEnd, setOldEnd] = useState(""),
    [newStart, setNewStart] = useState(""),
    [reason, setReason] = useState(""),
    [incomplete, setIncomplete] = useState(false),
    [device, setDevice] = useState<DeviceForm>({
      number: "",
      manufacturer: "",
      model: "",
      meterType: "",
      factor: 1,
      decimals: 0,
      resolution: 1,
      registerLimit: null,
    }),
    [photos, setPhotos] = useState<{ old: File | null; next: File | null }>({
      old: null,
      next: null,
    }),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [committed, setCommitted] = useState(false);
  return (
    <Dialog
      title={`Zählertausch · ${view.point.name}`}
      onClose={() => {
        if (committed) void onSaved();
        else onClose();
      }}
    >
      <ErrorBox error={error} />
      <p className="notice">
        Die Messstelle bleibt erhalten. Zwischen Endstand des alten und
        Anfangsstand des neuen Geräts wird kein Verbrauch berechnet.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          let saved = false;
          try {
            if (
              (photos.old && oldEnd === "") ||
              (photos.next && newStart === "")
            )
              throw new Error(
                "Zum Foto des alten oder neuen Geräts bitte den zugehörigen Zählerstand angeben. Alternativ das Foto später am Katastereintrag ablegen.",
              );
            const r = await api<{
              at: string;
              oldInstallationId: string;
              newInstallationId: string;
            }>(`/meters/${view.point.id}/replacement`, "POST", {
              at: new Date(at).toISOString(),
              oldEndValue: oldEnd === "" ? null : Number(oldEnd),
              newStartValue: newStart === "" ? null : Number(newStart),
              device,
              reason,
              confirmIncomplete: incomplete,
              version: view.point.version,
            });
            setCommitted(true);
            saved = true;
            if (photos.old || photos.next) {
              const detail = await api<Detail>(`/meters/${view.point.id}`);
              for (const [file, installationId] of [
                [photos.old, r.oldInstallationId],
                [photos.next, r.newInstallationId],
              ] as const) {
                if (!file) continue;
                const reading = detail.readings.find(
                  (x) =>
                    x.reading.installationId === installationId &&
                    new Date(x.reading.at).getTime() ===
                      new Date(r.at).getTime(),
                )?.reading;
                if (reading) await upload(file, `readingId=${reading.id}`);
              }
            }
            await onSaved();
          } catch (e) {
            setError(
              saved
                ? "Zählertausch gespeichert; Foto konnte nicht vollständig hochgeladen werden. Bitte schließen und in der Ablesehistorie ergänzen."
                : e,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Ausbauzähler">
            <input readOnly value={view.device.number} />
          </Field>
          <Field label="Tauschzeitpunkt (Browser-Ortszeit)">
            <input
              type="datetime-local"
              step="1"
              required
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </Field>
          <Field label={`Alter Endzählerstand (${view.point.unit})`}>
            <input
              type="number"
              min="0"
              step="any"
              value={oldEnd}
              onChange={(e) => setOldEnd(e.target.value)}
            />
          </Field>
          <Field label={`Neuer Anfangszählerstand (${view.point.unit})`}>
            <input
              type="number"
              min="0"
              step="any"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </Field>
        </div>
        <h3>Neues Zählergerät</h3>
        <DeviceFields value={device} onChange={setDevice} />
        <Field label="Grund / Kommentar zum Zählertausch">
          <textarea
            required
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Foto alter Zähler">
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={(e) =>
                setPhotos({ ...photos, old: e.target.files?.[0] || null })
              }
            />
          </Field>
          <Field label="Foto neuer Zähler">
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={(e) =>
                setPhotos({ ...photos, next: e.target.files?.[0] || null })
              }
            />
          </Field>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={incomplete}
            onChange={(e) => setIncomplete(e.target.checked)}
          />
          Fehlende Austauschstände ausdrücklich als unvollständig dokumentieren
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            onClick={() => {
              if (committed) void onSaved();
              else onClose();
            }}
          >
            {committed ? "Fertig" : "Abbrechen"}
          </button>
          <button className="primary" disabled={busy || committed}>
            {busy ? "Speichern …" : "Zählertausch speichern"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
