import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Session } from "./api";
import { ErrorBox, Field } from "./ui";

export type Branding = { motto: string; logo: string | null; version: number };
export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: () => api<Branding>("/branding"),
  });
}
export function Appearance({
  session,
  onSaved,
}: {
  session: Session;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(session.darkMode);
  useEffect(() => setEnabled(session.darkMode), [session.darkMode]);
  return (
    <section className="panel appearance-panel">
      <h2>Darstellung</h2>
      <ErrorBox error={error} />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={async (e) => {
            const next = e.target.checked;
            setEnabled(next);
            document.documentElement.dataset.theme = next ? "dark" : "light";
            setBusy(true);
            setError(undefined);
            try {
              await api("/account/appearance", "PUT", { darkMode: next });
              await onSaved();
            } catch (e) {
              setEnabled(session.darkMode);
              document.documentElement.dataset.theme = session.darkMode
                ? "dark"
                : "light";
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        />
        Darkmodus aktivieren
      </label>
      <p className="subtle">
        Diese Einstellung wird für Ihr Benutzerkonto gespeichert.
      </p>
    </section>
  );
}
export function BrandingSettings() {
  const q = useBranding();
  return (
    <>
      <ErrorBox error={q.error} />
      {q.data && <BrandingForm value={q.data} />}
    </>
  );
}
function BrandingForm({ value }: { value: Branding }) {
  const cache = useQueryClient();
  const [motto, setMotto] = useState(value.motto),
    [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  useEffect(() => setMotto(value.motto), [value.motto]);
  const save = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      await action();
      await cache.invalidateQueries({ queryKey: ["branding"] });
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel branding-settings">
      <h2>Logo und Anmeldebildschirm</h2>
      <p className="subtle">
        Diese Einstellungen gelten für die gesamte Anwendung und sind auch vor
        der Anmeldung sichtbar.
      </p>
      <ErrorBox error={error} />
      {saved && (
        <p className="notice success" role="status">
          Darstellung gespeichert.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(() =>
            api("/branding", "PUT", { motto, version: value.version }),
          );
        }}
      >
        <Field label="Leitspruch auf dem Anmeldebildschirm">
          <textarea
            required
            maxLength={240}
            rows={3}
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
          />
        </Field>
        <div className="login-preview">
          <small>Vorschau</small>
          <p>{motto}</p>
        </div>
        <button className="primary" disabled={busy}>
          Leitspruch speichern
        </button>
      </form>
      <hr />
      <img
        className="branding-preview"
        src={value.logo || "/logo.svg"}
        alt="Aktuelles Anwendungslogo"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!file) return;
          void save(() => {
            const f = new FormData();
            f.set("file", file);
            return api(`/branding/logo?version=${value.version}`, "POST", f);
          });
        }}
      >
        <Field label="Neues Logo (PNG/JPEG, maximal 2 MB)">
          <input
            type="file"
            required
            accept="image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Field>
        <div className="toolbar-actions">
          <button disabled={busy || !file} className="primary">
            Logo hochladen
          </button>
          {value.logo && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void save(() =>
                  api(`/branding/logo?version=${value.version}`, "DELETE"),
                )
              }
            >
              Standardlogo wiederherstellen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
