import { useState } from "react";
import { api } from "./api";
import { Dialog, ErrorBox, Field } from "./ui";

export function DeleteDialog({
  title,
  path,
  version,
  description,
  onClose,
  onDeleted,
}: {
  title: string;
  path: string;
  version?: number;
  description: string;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{description}</p>
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await api(path, "DELETE", { version, reason });
            await onDeleted();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {version !== undefined && (
          <Field label="Löschgrund">
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="danger" disabled={busy}>
            {busy ? "Löschen …" : "Löschen bestätigen"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
