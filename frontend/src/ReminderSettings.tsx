import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Field, ErrorBox, Dialog } from "./ui";
type Setting = {
  customerId: string;
  enabled: boolean;
  timeZone: string;
  day: number;
  hour: number;
  minute: number;
  followUpDays: number;
  userIds: string[];
  version: number;
  nextDueAt: string | null;
};
type Job = {
  id: string;
  cycle: string;
  stage: number;
  email: string;
  status: string;
  attempts: number;
  dueAt: string;
  lastError: string;
  messageId: string;
  version: number;
};
type Data = {
  setting: Setting;
  recipients: { id: string; name: string; email: string }[];
  jobs: Job[];
  transport: string;
  workerEnabled: boolean;
};
const status: Record<string, string> = {
  Pending: "Geplant",
  Sending: "Wird versendet",
  Sent: "SMTP angenommen",
  Retry: "Wiederholung geplant",
  Failed: "Fehlgeschlagen",
  Unclear: "Unklar – Prüfung nötig",
  Cancelled: "Abgebrochen",
};
export function ReminderSettings({ customerId }: { customerId: string }) {
  const q = useQuery({
    queryKey: ["reminders", customerId],
    queryFn: () => api<Data>(`/reminders/${customerId}/`),
    enabled: !!customerId,
    refetchInterval: 30000,
  });
  const [edit, setEdit] = useState<Setting | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [resolve, setResolve] = useState<Job | null>(null),
    [decision, setDecision] = useState("Cancelled"),
    [reason, setReason] = useState("");
  const s = edit || q.data?.setting;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
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
    <section className="panel">
      <h2>Automatische Ableseerinnerungen</h2>
      <p>
        Monatliche Planung und eine optionale Folgeerinnerung, nur für fällige
        Messstellen der freigegebenen Standorte. Versand in dieser lokalen
        Version ausschließlich an Mailpit.
      </p>
      <ErrorBox error={error || q.error} />
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {s && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/reminders/${customerId}/`, "PUT", s);
              setEdit(null);
              setNotice(
                "Erinnerungsplan gespeichert. Der erste automatische Termin liegt in der Zukunft.",
              );
            });
          }}
        >
          <label className="checkbox">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => setEdit({ ...s, enabled: e.target.checked })}
            />
            Erinnerungen aktivieren
          </label>
          <div className="form-grid">
            {[
              ["day", "Tag im Monat", 1, 28],
              ["hour", "Stunde", 0, 23],
              ["minute", "Minute", 0, 59],
              ["followUpDays", "Folgeerinnerung nach Tagen (0 = aus)", 0, 21],
            ].map(([key, label, min, max]) => (
              <Field key={key} label={String(label)}>
                <input
                  required
                  type="number"
                  min={min}
                  max={max}
                  value={s[key as keyof Setting] as number}
                  onChange={(e) =>
                    setEdit({ ...s, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
            <Field
              label="Zeitzone für Erinnerungen"
              help="IANA-Zeitzone, z. B. Europe/Berlin. Sommerzeit wird berücksichtigt; keine Feiertagsregelung."
            >
              <input
                required
                value={s.timeZone}
                onChange={(e) => setEdit({ ...s, timeZone: e.target.value })}
              />
            </Field>
          </div>
          <fieldset>
            <legend>Empfänger mit Ableserechten</legend>
            {q.data?.recipients.map((u) => (
              <label className="checkbox" key={u.id}>
                <input
                  type="checkbox"
                  checked={s.userIds.includes(u.id)}
                  onChange={(e) =>
                    setEdit({
                      ...s,
                      userIds: e.target.checked
                        ? [...s.userIds, u.id]
                        : s.userIds.filter((id) => id !== u.id),
                    })
                  }
                />
                {u.name} · {u.email}
              </label>
            ))}
          </fieldset>
          <p>
            Nächster automatischer Termin:{" "}
            {q.data?.setting.nextDueAt
              ? new Date(q.data.setting.nextDueAt).toLocaleString("de-DE")
              : "nicht aktiviert"}{" "}
            · Hintergrunddienst:{" "}
            {q.data?.workerEnabled
              ? "aktiv"
              : "für diesen Testlauf deaktiviert"}
          </p>
          <button className="primary" disabled={busy || !customerId}>
            Erinnerungsplan speichern
          </button>
        </form>
      )}
      <div className="button-row">
        <button
          disabled={busy || !q.data?.setting.enabled || !!edit}
          onClick={() =>
            void run(async () => {
              const r = await api<{ planned: number }>(
                `/reminders/${customerId}/plan`,
                "POST",
              );
              setNotice(
                `${r.planned} neue Aufträge geplant. Derselbe Monatszyklus wird nicht doppelt angelegt.`,
              );
            })
          }
        >
          Fällige Erinnerungen jetzt planen
        </button>
        <button
          disabled={busy || !!edit}
          onClick={() =>
            void run(async () => {
              const r = await api<{ sent: number }>(
                `/reminders/${customerId}/process`,
                "POST",
              );
              setNotice(
                `${r.sent} Nachrichten von SMTP angenommen. In Mailpit prüfen.`,
              );
            })
          }
        >
          Versandwarteschlange verarbeiten
        </button>
      </div>
      <details open>
        <summary>Versandprotokoll (letzte 100 Aufträge)</summary>
        <p className="subtle">
          „SMTP angenommen“ ist keine Zustellbestätigung. Bei „Unklar“ zuerst
          Mailpit mit der Auftrags-ID prüfen. Erneutes Senden kann eine bereits
          angenommene Nachricht duplizieren.
        </p>
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Zyklus / Stufe</th>
                <th>Empfänger</th>
                <th>Status</th>
                <th>Termin / Versuche</th>
                <th>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    {j.cycle}
                    <small>
                      {j.stage ? "Folgeerinnerung" : "Erste Erinnerung"}
                    </small>
                  </td>
                  <td>{j.email}</td>
                  <td>{status[j.status] || j.status}</td>
                  <td>
                    {new Date(j.dueAt).toLocaleString("de-DE")}
                    <small>{j.attempts} Versuche</small>
                  </td>
                  <td>
                    {j.lastError}
                    <details>
                      <summary>Auftrags-ID</summary>
                      <small>
                        {j.id}
                        <br />
                        {j.messageId}
                      </small>
                    </details>
                    {["Unclear", "Failed"].includes(j.status) && (
                      <button
                        onClick={() => {
                          setResolve(j);
                          setReason("");
                          setDecision("Cancelled");
                        }}
                      >
                        Versand klären
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {resolve && (
        <Dialog title="Versandstatus klären" onClose={() => setResolve(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(
                  `/reminders/${customerId}/${resolve.id}/resolve`,
                  "POST",
                  { version: resolve.version, status: decision, reason },
                );
                setResolve(null);
              });
            }}
          >
            <Field label="Ergebnis der Mailpit-Prüfung">
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="Cancelled">Auftrag abbrechen</option>
                <option value="Sent">Annahme in Mailpit bestätigt</option>
                <option value="Pending">
                  Erneut senden (Duplikat möglich)
                </option>
              </select>
            </Field>
            <Field label="Begründung der Versandklärung">
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Entscheidung dokumentieren
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
