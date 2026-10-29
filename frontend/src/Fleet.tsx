import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Session } from "./api";
import { Dialog, ErrorBox, Field } from "./ui";
import { DeleteDialog } from "./DeleteDialog";
import { num, type Tree } from "./technical/types";

type Vehicle = {
  id: string;
  number: string;
  plate: string;
  name: string;
  manufacturer: string;
  model: string;
  vehicleType: string;
  driveType: string;
  fuel: string;
  vin: string;
  siteId: string;
  firstRegistration: string | null;
  initialMileage: number;
  ratedPowerKw: number | null;
  batteryKwh: number | null;
  notes: string;
  version: number;
};
const empty: Vehicle = {
  id: "",
  number: "",
  plate: "",
  name: "",
  manufacturer: "",
  model: "",
  vehicleType: "Pkw",
  driveType: "Verbrennungsmotor",
  fuel: "Diesel",
  vin: "",
  siteId: "",
  firstRegistration: null,
  initialMileage: 0,
  ratedPowerKw: null,
  batteryKwh: null,
  notes: "",
  version: 1,
};

export function Fleet({
  session,
  customerId,
}: {
  session: Session;
  customerId: string;
}) {
  const q = useQuery({
    queryKey: ["fleet", customerId],
    queryFn: () => api<Vehicle[]>(`/fleet/${customerId}/`),
    enabled: !!customerId,
  });
  const tree = useQuery({
    queryKey: ["technical", customerId],
    queryFn: () => api<Tree>(`/technical/${customerId}/tree`),
    enabled: !!customerId,
  });
  const [edit, setEdit] = useState<Vehicle | null>(null),
    [remove, setRemove] = useState<Vehicle | null>(null),
    [search, setSearch] = useState("");
  const sites =
    tree.data?.nodes.filter((x) => x.node.kind === "Site" && x.node.isActive) ||
    [];
  const admin = session.role === "SystemAdmin";
  return (
    <>
      <ErrorBox error={q.error || tree.error} />
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Fahrzeuge und technische Attribute</h2>
            <p className="subtle">
              {q.data?.length || 0} Fahrzeuge · Standortbezogene Kundenakte
            </p>
          </div>
          {admin && (
            <button
              className="primary"
              disabled={!sites.length}
              onClick={() => setEdit({ ...empty, siteId: sites[0].node.id })}
            >
              + Fahrzeug anlegen
            </button>
          )}
        </div>
        {!sites.length && (
          <p className="notice">
            Bitte zuerst einen Standort im Kundenkataster anlegen.
          </p>
        )}
        <Field label="Fahrzeuge suchen">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kennzeichen, Bezeichnung oder Fahrzeug-ID …"
          />
        </Field>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fahrzeug</th>
                <th>Technik</th>
                <th>Standort</th>
                <th>Attribute</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {q.data
                ?.filter((v) =>
                  `${v.number} ${v.plate} ${v.name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.name}</strong>
                      <small>
                        {v.number} · {v.plate || "Ohne Kennzeichen"}
                      </small>
                    </td>
                    <td>
                      {v.manufacturer} {v.model}
                      <small>
                        {v.vehicleType} · {v.driveType} · {v.fuel}
                      </small>
                    </td>
                    <td>
                      {sites.find((x) => x.node.id === v.siteId)?.node.name ||
                        "Standort"}
                    </td>
                    <td>
                      <details>
                        <summary>Attribute anzeigen</summary>
                        <dl>
                          <dt>Kilometerstand bei Aufnahme</dt>
                          <dd>{num(v.initialMileage)} km</dd>
                          <dt>Leistung</dt>
                          <dd>{num(v.ratedPowerKw)} kW</dd>
                          <dt>Batteriekapazität</dt>
                          <dd>{num(v.batteryKwh)} kWh</dd>
                          <dt>Erstzulassung</dt>
                          <dd>{v.firstRegistration || "–"}</dd>
                          <dt>Fahrgestellnummer</dt>
                          <dd>{v.vin || "–"}</dd>
                          <dt>Bemerkungen</dt>
                          <dd>{v.notes || "–"}</dd>
                        </dl>
                      </details>
                    </td>
                    <td>
                      {admin && (
                        <div className="toolbar-actions">
                          <button onClick={() => setEdit(v)}>Bearbeiten</button>
                          <button
                            className="danger"
                            onClick={() => setRemove(v)}
                          >
                            Fahrzeug löschen
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {q.isLoading ? (
          <p role="status">Fahrzeuge werden geladen …</p>
        ) : (
          !q.data?.length && (
            <p className="empty">Noch keine Fahrzeuge hinterlegt.</p>
          )
        )}
      </section>
      {edit && (
        <VehicleForm
          vehicle={edit}
          sites={sites.map((x) => x.node)}
          customerId={customerId}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            setEdit(null);
            await q.refetch();
          }}
        />
      )}
      {remove && (
        <DeleteDialog
          title={`Fahrzeug löschen · ${remove.name}`}
          path={`/fleet/${customerId}/${remove.id}`}
          version={remove.version}
          description="Das Fahrzeug wird aus dem Fuhrpark entfernt. Die Löschung wird mit Begründung protokolliert."
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
function VehicleForm({
  vehicle,
  sites,
  customerId,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle;
  sites: { id: string; name: string }[];
  customerId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [v, setV] = useState(vehicle),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const text = (key: keyof Vehicle, label: string, required = false) => (
    <Field label={label}>
      <input
        required={required}
        maxLength={key === "number" ? 60 : 200}
        value={String(v[key] ?? "")}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <Dialog
      title={v.id ? "Fahrzeug bearbeiten" : "Fahrzeug anlegen"}
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const { id, ...input } = v;
            await api(`/fleet/${customerId}/${id}`, id ? "PUT" : "POST", input);
            await onSaved();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {text("number", "Fahrzeug-ID *", true)}
          {text("name", "Fahrzeugbezeichnung *", true)}
          {text("plate", "Kennzeichen")}
          {text("manufacturer", "Hersteller")}
          {text("model", "Modell")}
          {text("vehicleType", "Fahrzeugtyp (z. B. Pkw, Lkw, Stapler)")}
          {text("driveType", "Antriebsart (z. B. Elektro, Hybrid)")}
          {text("fuel", "Kraftstoff / Energieträger")}
          {text("vin", "Fahrgestellnummer")}
          <Field label="Standort">
            <select
              value={v.siteId}
              onChange={(e) => setV({ ...v, siteId: e.target.value })}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Erstzulassung">
            <input
              type="date"
              value={v.firstRegistration || ""}
              onChange={(e) =>
                setV({ ...v, firstRegistration: e.target.value || null })
              }
            />
          </Field>
          {(["initialMileage", "ratedPowerKw", "batteryKwh"] as const).map(
            (key, i) => (
              <Field
                key={key}
                label={
                  [
                    "Kilometerstand bei Aufnahme (km)",
                    "Nennleistung (kW)",
                    "Batteriekapazität (kWh)",
                  ][i]
                }
              >
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  required={i === 0}
                  value={v[key] ?? ""}
                  onChange={(e) =>
                    setV({
                      ...v,
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
            ),
          )}
        </div>
        <Field label="Bemerkungen">
          <textarea
            maxLength={4000}
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
          />
        </Field>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy}>
            Fahrzeug speichern
          </button>
        </div>
      </form>
    </Dialog>
  );
}
