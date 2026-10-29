import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, date } from '../api';
import { Badge, Dialog, ErrorBox, Field } from '../ui';
import { DeviceFields, type DeviceForm } from './forms';
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
} from './types';

export async function upload(file: File, query: string) {
  const form = new FormData();
  form.set('file', file);
  return api(`/documents?${query}`, 'POST', form);
}
function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
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
    queryKey: ['documents', nodeId],
    queryFn: () => api<Document[]>(`/documents?nodeId=${nodeId}`),
    enabled: !!nodeId,
  });
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  return (
    <section className={nodeId ? 'panel' : 'reading-documents'}>
      {nodeId && <h2>Fotos und technische Dokumente</h2>}
      <ErrorBox error={error} />
      <div className="document-list">
        {(documents || q.data || []).map((d) => (
          <a
            key={d.id}
            href={`/api/documents/${d.id}`}
            target="_blank"
            rel="noreferrer"
          >
            {d.contentType.startsWith('image/') ? (
              <img src={`/api/documents/${d.id}`} alt={d.name} loading="lazy" />
            ) : (
              <span className="pdf-icon">PDF</span>
            )}
            <span>{d.name}</span>
          </a>
        ))}
      </div>
      {canWrite && (
        <label className="file-label">
          {busy
            ? 'Upload läuft …'
            : nodeId
              ? 'Foto / PDF hinzufügen (max. 6 MB)'
              : 'Ablesefoto hinzufügen (max. 6 MB)'}
          <input
            type="file"
            disabled={busy}
            accept={
              nodeId
                ? 'image/jpeg,image/png,application/pdf'
                : 'image/jpeg,image/png'
            }
            capture={nodeId ? undefined : 'environment'}
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
                e.target.value = '';
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
}: {
  view: PointView;
  tree: Tree;
  admin: boolean;
  canWrite: boolean;
  refresh: () => Promise<void>;
  onEdit: () => void;
  onAssignment: () => void;
}) {
  const q = useQuery({
    queryKey: ['meter', view.point.id],
    queryFn: () => api<Detail>(`/meters/${view.point.id}`),
  });
  const [edit, setEdit] = useState<Reading | null>(null),
    [replacement, setReplacement] = useState(false),
    [history, setHistory] = useState(false);
  const data = q.data;
  const current =
    data?.installations.find((i) => !i.validTo) || view.installation;
  const device =
    data?.devices.find((d) => d.id === current?.deviceId) || view.device;
  const p = data?.point || view.point;
  const timeZone =
    tree.nodes.find((n) => n.node.id === view.assignment.siteId)?.node
      .timeZone || 'Europe/Berlin';
  const displayDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone,
        }).format(new Date(value))
      : 'Noch keine Ablesung';
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
          <Badge active={p.isActive}>{p.isActive ? 'Aktiv' : 'Inaktiv'}</Badge>
        </div>
        <dl className="meter-summary">
          <div>
            <dt>Zählernummer</dt>
            <dd>{device?.number || '–'}</dd>
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
                : 'Noch kein Stand'}
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
          {admin && (
            <>
              <button onClick={onEdit}>Messstelle bearbeiten</button>
              <button onClick={onAssignment}>Zuordnung ändern</button>
            </>
          )}
          <button onClick={() => setHistory(!history)}>
            {history ? 'Gerätehistorie schließen' : 'Geräte und Zuordnungen'}
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
                </strong>{' '}
                · {displayDate(i.validFrom)} bis{' '}
                {i.validTo ? displayDate(i.validTo) : 'heute'} · Faktor{' '}
                {num(i.factor)}
              </p>
            ))}
            <h3>Zuordnungshistorie</h3>
            {data.assignments.map((a) => (
              <p key={a.id}>
                {tree.nodes.find((n) => n.node.id === a.nodeId)?.node.name ||
                  'Historischer Anlagenknoten'}{' '}
                · {displayDate(a.validFrom)} bis{' '}
                {a.validTo ? displayDate(a.validTo) : 'heute'}
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
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Ablesehistorie</h2>
            <p className="subtle">
              Maximal 500 aktuelle Ablesungen · Geräteperioden · {timeZone}
            </p>
          </div>
          <button onClick={reload}>Aktualisieren</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ablesezeitpunkt</th>
                <th>Zählerstand</th>
                <th>Verbrauch</th>
                <th>Status / Ereignis</th>
                <th>Nachweis</th>
              </tr>
            </thead>
            <tbody>
              {data?.readings.map(({ reading: r, consumption }) => (
                <tr key={r.id}>
                  <td>
                    {displayDate(r.at)}
                    <small>Gespeichert: {displayDate(r.createdAt)}</small>
                    <small>
                      {
                        data.devices.find(
                          (d) =>
                            d.id ===
                            data.installations.find(
                              (i) => i.id === r.installationId,
                            )?.deviceId,
                        )?.number
                      }
                    </small>
                  </td>
                  <td>
                    {num(r.value)} {p.unit}
                  </td>
                  <td>
                    {num(consumption)} {consumption == null ? '' : p.unit}
                  </td>
                  <td>
                    <Badge active={r.status === 'Gültig'}>{r.status}</Badge>
                    <small>
                      {r.event}
                      {r.isRollover ? ' · Überlauf' : ''}
                    </small>
                    <small>{r.comment}</small>
                    {r.reason && <small>Begründung: {r.reason}</small>}
                  </td>
                  <td>
                    {admin && (
                      <button
                        className="table-action"
                        onClick={() => setEdit(r)}
                      >
                        Korrigieren
                      </button>
                    )}
                    <Documents
                      readingId={r.id}
                      documents={data.documents.filter(
                        (d) => d.readingId === r.id,
                      )}
                      canWrite={canWrite}
                      onSaved={reload}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.readings.length && (
          <p className="empty">Noch keine Ablesung vorhanden.</p>
        )}
        {data && data.revisions.length > 0 && (
          <details className="revision-history">
            <summary>Korrekturhistorie ({data.revisions.length})</summary>
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
      <Balance pointId={p.id} />
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
function ReadingForm({
  point,
  installation,
  reading,
  onSaved,
}: {
  point: PointView;
  installation: PointView['installation'];
  reading?: Reading;
  onSaved: () => Promise<void>;
}) {
  const [at, setAt] = useState(
      reading ? localInput(new Date(reading.at)) : localInput(),
    ),
    [value, setValue] = useState(reading ? String(reading.value) : ''),
    [comment, setComment] = useState(reading?.comment || ''),
    [event, setEvent] = useState(reading?.event || ''),
    [reason, setReason] = useState(''),
    [rollover, setRollover] = useState(reading?.isRollover || false),
    [confirm, setConfirm] = useState(false),
    [warning, setWarning] = useState(false),
    [photo, setPhoto] = useState<File | null>(null),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  return (
    <section className={reading ? '' : 'panel'}>
      {!reading && <h2>Neuen Zählerstand erfassen</h2>}
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const r = await api<Reading>(
              `/meters/${point.point.id}/readings${reading ? `/${reading.id}` : ''}`,
              reading ? 'PUT' : 'POST',
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
            setValue('');
            setPhoto(null);
            setFileKey((k) => k + 1);
            if (photo) {
              try {
                await upload(photo, `readingId=${r.id}`);
              } catch {
                await onSaved();
                throw new Error(
                  'Ablesung gespeichert. Foto konnte nicht hochgeladen werden; bitte in der Historie ergänzen.',
                );
              }
            }
            setValue('');
            setComment('');
            setReason('');
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
              step={installation?.resolution || 'any'}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Field label="Besonderes Ereignis">
            <select value={event} onChange={(e) => setEvent(e.target.value)}>
              {events.map((v) => (
                <option key={v} value={v}>
                  {v || 'Kein besonderes Ereignis'}
                </option>
              ))}
              {reading?.event === 'Zählertausch' && (
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
            ? 'Speichern …'
            : reading
              ? 'Korrektur speichern'
              : 'Zählerstand speichern'}
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
    [oldEnd, setOldEnd] = useState(''),
    [newStart, setNewStart] = useState(''),
    [reason, setReason] = useState(''),
    [incomplete, setIncomplete] = useState(false),
    [device, setDevice] = useState<DeviceForm>({
      number: '',
      manufacturer: '',
      model: '',
      meterType: '',
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
              (photos.old && oldEnd === '') ||
              (photos.next && newStart === '')
            )
              throw new Error(
                'Zum Foto des alten oder neuen Geräts bitte den zugehörigen Zählerstand angeben. Alternativ das Foto später am Katastereintrag ablegen.',
              );
            const r = await api<{
              at: string;
              oldInstallationId: string;
              newInstallationId: string;
            }>(`/meters/${view.point.id}/replacement`, 'POST', {
              at: new Date(at).toISOString(),
              oldEndValue: oldEnd === '' ? null : Number(oldEnd),
              newStartValue: newStart === '' ? null : Number(newStart),
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
                ? 'Zählertausch gespeichert; Foto konnte nicht vollständig hochgeladen werden. Bitte schließen und in der Ablesehistorie ergänzen.'
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
            {committed ? 'Fertig' : 'Abbrechen'}
          </button>
          <button className="primary" disabled={busy || committed}>
            {busy ? 'Speichern …' : 'Zählertausch speichern'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
type BalanceResult = {
  status: string;
  consumption: number | null;
  submeterTotal: number | null;
  unassignedConsumption: number | null;
  unit: string;
  warning: string;
  children: {
    pointId: string;
    name: string;
    consumption: number | null;
    unit: string;
  }[];
};
function Balance({ pointId }: { pointId: string }) {
  const [from, setFrom] = useState(
      localInput(new Date(Date.now() - 30 * 86400000)),
    ),
    [to, setTo] = useState(localInput()),
    [result, setResult] = useState<BalanceResult | null>(null),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>Verbrauch und Unterzählerbilanz</h2>
      <p className="subtle">
        Für eine exakte Bilanz müssen Randablesungen zum selben Zeitpunkt
        vorliegen. Direkte Unterzähler werden einmal berücksichtigt.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            setResult(
              await api<BalanceResult>(
                `/meters/${pointId}/balance?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`,
              ),
            );
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Bilanzbeginn (Browser-Ortszeit)">
            <input
              type="datetime-local"
              step="1"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Bilanzende (Browser-Ortszeit)">
            <input
              type="datetime-local"
              step="1"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <button disabled={busy}>Bilanz berechnen</button>
      </form>
      <ErrorBox error={error} />
      {result && (
        <div className="balance-result">
          <Badge active={result.status === 'Vollständig'}>
            {result.status}
          </Badge>
          {result.warning && <p className="notice">{result.warning}</p>}
          <dl className="detail-grid">
            <div>
              <dt>Hauptzählerverbrauch</dt>
              <dd>
                {num(result.consumption)} {result.unit}
              </dd>
            </div>
            <div>
              <dt>Summe direkter Unterzähler</dt>
              <dd>
                {num(result.submeterTotal)} {result.unit}
              </dd>
            </div>
            <div>
              <dt>Nicht zugeordneter Verbrauch</dt>
              <dd>
                {num(result.unassignedConsumption)} {result.unit}
              </dd>
            </div>
          </dl>
          {result.children.map((c) => (
            <p key={c.pointId}>
              {c.name}: {num(c.consumption)} {c.unit}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
