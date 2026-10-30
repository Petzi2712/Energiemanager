import { useState } from "react";
import { api } from "../api";
import { ErrorBox, Field } from "../ui";
import { Documents } from "./readings";

export function MeasurePanel({
  customerId,
  entry,
  implemented,
  canEdit,
  onSaved,
}: {
  customerId: string;
  entry: { id: string; name: string; measureNotes: string; version: number };
  implemented: boolean;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(entry.measureNotes),
    [version] = useState(entry.version);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <section className="measure-panel">
      <h4>Maßnahme · {entry.name}</h4>
      <ErrorBox error={error} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await api(
              `/technical/${customerId}/nodes/${entry.id}/measure`,
              "PUT",
              { implemented, notes, version },
            );
            await onSaved();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Status:{" "}
          <strong>
            {implemented ? "Maßnahme umgesetzt" : "Noch nicht umgesetzt"}
          </strong>
          . Die Einsparprozente bleiben Planungsannahmen und werden dadurch
          nicht zu gemessenen Einsparungen.
        </p>
        {canEdit && <p className="subtle">Status und Text mit „Maßnahme speichern“ übernehmen. PDF-Dateien werden direkt beim Hochladen gespeichert.</p>}
        <Field label={`Maßnahmenbeschreibung: ${entry.name}`}>
          <textarea
            rows={4}
            maxLength={10000}
            readOnly={!canEdit}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        {canEdit && (
          <button className="primary" disabled={busy}>
            Maßnahme speichern
          </button>
        )}
      </form>
      <h4>PDF-Berichte und Nachweise</h4>
      <Documents nodeId={entry.id} purpose="Measure" canWrite={canEdit} />
    </section>
  );
}
