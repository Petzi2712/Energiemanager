import { useState } from "react";
import { api } from "../api";
import { Dialog, ErrorBox, Field } from "../ui";
import { kinds, type Node, type Tree } from "./types";

export function CopyNode({
  source,
  tree,
  onClose,
  onSaved,
}: {
  source: Node;
  tree: Tree;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const excluded = new Set<string>();
  function visit(id: string) {
    excluded.add(id);
    for (const item of tree.nodes.filter((n) => n.node.parentId === id))
      visit(item.node.id);
  }
  visit(source.id);
  const targets = tree.nodes.filter(
    (n) =>
      n.node.isActive &&
      !excluded.has(n.node.id) &&
      (source.kind === "Building"
        ? n.node.kind === "Site"
        : !["Site", "ConsumerAsset"].includes(n.node.kind)),
  );
  const [parentId, setParent] = useState(
    targets.some((n) => n.node.id === source.parentId)
      ? source.parentId!
      : targets[0]?.node.id || "",
  );
  const [number, setNumber] = useState(
    () => source.number.slice(0, 45) + "-K" + crypto.randomUUID().slice(0, 8),
  );
  const [name, setName] = useState(source.name.slice(0, 190) + " (Kopie)"),
    [children, setChildren] = useState(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <Dialog
      title={`Katastereintrag kopieren · ${source.name}`}
      onClose={onClose}
    >
      <p>
        Die Kopie erhält eigene IDs. Technische Werte und Einsparannahmen werden
        übernommen; Zähler- und Datei-Zuordnungen bleiben am Original.
      </p>
      <ErrorBox error={error} />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const result = await api<{ id: string }>(
              `/technical/${source.customerId}/nodes/${source.id}/copy`,
              "POST",
              {
                parentId,
                number,
                name,
                includeChildren: children,
                version: source.version,
              },
            );
            await onSaved(result.id);
          } catch (error) {
            setError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Ziel der Kopie">
          <select
            required
            value={parentId}
            onChange={(e) => setParent(e.target.value)}
          >
            {targets.map((n) => (
              <option key={n.node.id} value={n.node.id}>
                {kinds[n.node.kind]} · {n.node.name} · {n.node.number}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Neue ID *">
          <input
            required
            maxLength={60}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field label="Bezeichnung der Kopie *">
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {excluded.size > 1 && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={children}
              onChange={(e) => setChildren(e.target.checked)}
            />
            Alle {excluded.size - 1} Untereinträge mitkopieren
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy || !targets.length}>
            Kopie anlegen
          </button>
        </div>
      </form>
    </Dialog>
  );
}
