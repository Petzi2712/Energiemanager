import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Session } from "./api";
import { Dialog, ErrorBox, Field } from "./ui";
import { DeleteDialog } from "./DeleteDialog";
import { media, type Node, type Tree } from "./technical/types";

type Definition = {
  id: string;
  name: string;
  siteId: string | null;
  buildingId: string | null;
  nodeId: string | null;
  medium: string;
  from: string;
  to: string;
  includeTheory: boolean;
  includeReadings: boolean;
  includeMeasures: boolean;
  pdf: boolean;
  excel: boolean;
  notes: string;
  version: number;
};
export function Reports({
  session,
  customerId,
}: {
  session: Session;
  customerId: string;
}) {
  const admin = session.role === "SystemAdmin";
  const q = useQuery({
    queryKey: ["reports", customerId],
    queryFn: () => api<Definition[]>(`/reports/${customerId}/`),
    enabled: !!customerId,
  });
  const tree = useQuery({
    queryKey: ["technical", customerId],
    queryFn: () => api<Tree>(`/technical/${customerId}/tree`),
    enabled: !!customerId,
  });
  const [edit, setEdit] = useState<Definition | "new" | null>(null),
    [remove, setRemove] = useState<Definition | null>(null);
  const nodes = tree.data?.nodes.map((x) => x.node) || [];
  return (
    <>
      <section className="panel reports-panel">
        <div className="section-heading">
          <div>
            <h2>Berichtsvorlagen</h2>
            <p className="subtle">
              Individuelle Auswertung je Kunde, Standort, Gebäude, Anlage und
              Medium
            </p>
          </div>
          {admin && (
            <button
              className="primary"
              disabled={!customerId}
              onClick={() => setEdit("new")}
            >
              + Berichtsvorlage anlegen
            </button>
          )}
        </div>
        <p className="notice">
          Hier legen Sie Umfang, Zeitraum und Inhalte künftiger Berichte fest.
          Die Vorlagen werden gespeichert. Die ausführliche
          PDF-Berichtserstellung und der Excel-Auswertungsexport folgen in einer
          späteren Ausbaustufe.
        </p>
        <ErrorBox error={q.error || tree.error} />
        {q.isLoading && <p role="status">Vorlagen werden geladen …</p>}
        {!customerId && <p>Kein Kunde freigegeben.</p>}
        <div className="report-cards">
          {q.data?.map((item) => (
            <article className="report-card" key={item.id}>
              <h3>{item.name}</h3>
              <dl className="detail-grid">
                <div>
                  <dt>Umfang</dt>
                  <dd>
                    {nodes.find(
                      (n) =>
                        n.id ===
                        (item.nodeId || item.buildingId || item.siteId),
                    )?.name || "Gesamter Kunde"}
                  </dd>
                </div>
                <div>
                  <dt>Medium</dt>
                  <dd>{media[item.medium] || "Alle Medien, getrennt"}</dd>
                </div>
                <div>
                  <dt>Zeitraum</dt>
                  <dd>
                    {item.from.split("-").reverse().join(".")} –{" "}
                    {item.to.split("-").reverse().join(".")}
                  </dd>
                </div>
                <div>
                  <dt>Geplante Ausgabe</dt>
                  <dd>
                    {[
                      item.pdf && "PDF-Bericht",
                      item.excel && "Excel-Auswertung",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              </dl>
              <p>
                {[
                  item.includeTheory && "Theoretische Bilanz",
                  item.includeReadings && "Ablesungen und Verbrauch",
                  item.includeMeasures && "Maßnahmen und PDF-Nachweise",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.notes && <p className="report-notes">{item.notes}</p>}
              {admin && (
                <div className="toolbar-actions">
                  <button onClick={() => setEdit(item)}>
                    Vorlage bearbeiten
                  </button>
                  <button className="danger" onClick={() => setRemove(item)}>
                    Vorlage löschen
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {q.data?.length === 0 && (
          <p className="subtle">
            Für diesen Kunden sind noch keine freigegebenen Berichtsvorlagen
            angelegt.
          </p>
        )}
      </section>
      {edit && (
        <ReportForm
          key={edit === "new" ? "new" : edit.id}
          customerId={customerId}
          nodes={nodes}
          value={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            setEdit(null);
            await q.refetch();
          }}
        />
      )}{" "}
      {remove && (
        <DeleteDialog
          title="Berichtsvorlage löschen"
          path={`/reports/${customerId}/${remove.id}`}
          version={remove.version}
          description={`Die Vorlage „${remove.name}“ löschen und protokollieren.`}
          onClose={() => setRemove(null)}
          onDeleted={async () => {
            setRemove(null);
            await q.refetch();
          }}
        />
      )}
    </>
  );
}
function ReportForm({
  customerId,
  nodes,
  value,
  onClose,
  onSaved,
}: {
  customerId: string;
  nodes: Node[];
  value?: Definition;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState<Definition>(
    value || {
      id: "",
      name: "",
      siteId: null,
      buildingId: null,
      nodeId: null,
      medium: "",
      from: `${today.getFullYear()}-01-01`,
      to: localDate,
      includeTheory: true,
      includeReadings: true,
      includeMeasures: true,
      pdf: true,
      excel: true,
      notes: "",
      version: 1,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  function belongs(n: Node, parent: string) {
    let cursor: Node | undefined = n;
    for (let i = 0; cursor && i < 16; i++) {
      if (cursor.id === parent) return true;
      cursor = nodes.find((x) => x.id === cursor?.parentId);
    }
    return false;
  }
  const sites = nodes.filter((n) => n.kind === "Site" && n.isActive),
    buildings = nodes.filter(
      (n) => n.kind === "Building" && n.isActive && n.parentId === form.siteId,
    );
  const assets = nodes.filter(
    (n) =>
      n.isActive &&
      !["Site", "Building"].includes(n.kind) &&
      !!form.siteId &&
      belongs(n, form.buildingId || form.siteId),
  );
  return (
    <Dialog
      title={value ? "Berichtsvorlage bearbeiten" : "Berichtsvorlage anlegen"}
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await api(
              `/reports/${customerId}/${value?.id || ""}`,
              value ? "PUT" : "POST",
              { ...form, id: value?.id },
            );
            await onSaved();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Bezeichnung der Berichtsvorlage *">
            <input
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Standort für Bericht">
            <select
              value={form.siteId || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  siteId: e.target.value || null,
                  buildingId: null,
                  nodeId: null,
                })
              }
            >
              <option value="">Gesamter Kunde</option>
              {sites.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gebäude für Bericht">
            <select
              disabled={!form.siteId}
              value={form.buildingId || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  buildingId: e.target.value || null,
                  nodeId: null,
                })
              }
            >
              <option value="">Alle Gebäude des Umfangs</option>
              {buildings.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anlage für Bericht">
            <select
              disabled={!form.siteId}
              value={form.nodeId || ""}
              onChange={(e) =>
                setForm({ ...form, nodeId: e.target.value || null })
              }
            >
              <option value="">Alle Anlagen des Umfangs</option>
              {assets.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medium für Bericht">
            <select
              value={form.medium}
              onChange={(e) => setForm({ ...form, medium: e.target.value })}
            >
              <option value="">Alle Medien, getrennt</option>
              {Object.entries(media).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Berichtszeitraum von">
            <input
              type="date"
              required
              min="1900-01-01"
              max="2200-12-31"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
          </Field>
          <Field label="Berichtszeitraum bis">
            <input
              type="date"
              required
              min={form.from}
              max="2200-12-31"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </Field>
        </div>
        <fieldset>
          <legend>Inhalte und geplante Ausgabe</legend>
          {(
            [
              ["includeTheory", "Theoretische Jahresbilanz"],
              ["includeReadings", "Ablesungen und Verbrauch"],
              ["includeMeasures", "Maßnahmen und PDF-Nachweise"],
              ["pdf", "PDF-Bericht"],
              ["excel", "Excel-Auswertung"],
            ] as const
          ).map(([key, label]) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Field label="Individuelle Berichtshinweise">
          <textarea
            rows={3}
            maxLength={4000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy}>
            Berichtsvorlage speichern
          </button>
        </div>
      </form>
    </Dialog>
  );
}
