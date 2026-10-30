import { useState } from "react";
import { api } from "../api";
import { Dialog, ErrorBox, Field } from "../ui";
import {
  emptyNode,
  kinds,
  localInput,
  media,
  units,
  type Node,
  type Point,
  type PointView,
  type Tree,
} from "./types";

export function NodeForm({
  customerId,
  node,
  parent,
  tree,
  onClose,
  onSaved,
}: {
  customerId: string;
  node?: Node;
  parent?: Node;
  tree: Tree;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    ...emptyNode,
    ...node,
    ...(!node
      ? {
          parentId: parent?.id || null,
          kind: parent
            ? parent.kind === "Site"
              ? "Building"
              : "Area"
            : "Site",
        }
      : {}),
  });
  const [custom, setCustom] = useState(
    JSON.stringify(form.customFields, null, 2),
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const text = (key: keyof typeof form, label: string, required = false) => (
    <Field label={label}>
      <input
        required={required}
        maxLength={key === "name" ? 200 : key === "number" ? 60 : 1000}
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  const numeric = (
    key: keyof typeof form,
    label: string,
    nullable = false,
    max?: number,
  ) => (
    <Field label={label}>
      <input
        type="number"
        min="0"
        max={max}
        step={key === "quantity" || key === "year" ? 1 : "any"}
        required={!nullable}
        value={form[key] == null ? "" : Number(form[key])}
        onChange={(e) =>
          setForm({
            ...form,
            [key]:
              e.target.value === "" && nullable ? null : Number(e.target.value),
          })
        }
      />
    </Field>
  );
  return (
    <Dialog
      title={
        node ? "Katastereintrag bearbeiten" : `${kinds[form.kind]} anlegen`
      }
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          setBusy(true);
          try {
            const customFields = JSON.parse(custom);
            if (
              !customFields ||
              Array.isArray(customFields) ||
              Object.values(customFields).some((v) => typeof v !== "string")
            )
              throw new Error(
                "Zusatzfelder als JSON-Objekt mit Textwerten angeben.",
              );
            const result = await api<{ node: Node }>(
              `/technical/${customerId}/nodes${node ? `/${node.id}` : ""}`,
              node ? "PUT" : "POST",
              { ...form, customFields },
            );
            await onSaved(result.node.id);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Strukturtyp">
            <select
              disabled={!!node || !parent || parent.kind === "Site"}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {Object.entries(kinds)
                .filter(([k]) =>
                  node
                    ? k === node.kind
                    : !parent
                      ? k === "Site"
                      : parent.kind === "Site"
                        ? k === "Building"
                        : !["Site", "Building"].includes(k),
                )
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </Field>
          {text("number", "Nummer *", true)}
          {text("name", "Bezeichnung *", true)}
          {text("usage", "Nutzung / Standorttyp")}
          {form.kind === "Site" && (
            <>
              {text("address", "Adresse")}
              {text("contact", "Ansprechpartner")}
              {text("timeZone", "Standortzeitzone (IANA)")}
              {text("workingDays", "Arbeitstage")}
              {text("shiftModel", "Schichtmodell")}
              {text("productionHours", "Produktionszeiten")}
              {text("energySources", "Energieträger")}
              {text("supplySystems", "Versorgungssysteme")}
            </>
          )}
          {["Site", "Building"].includes(form.kind) && (
            <>
              {numeric("usableArea", "Nutzfläche (m²)", true)}
              {numeric("heatedArea", "Beheizte Fläche (m²)", true)}
              {numeric("year", "Baujahr", true, 2200)}
              {text("heating", "Heizungsart")}
              {text("cooling", "Kühlungsart")}
              {text("lighting", "Beleuchtungstechnik")}
            </>
          )}
          {text("operatingHours", "Betriebs-/Nutzungszeiten")}
          {form.kind === "ConsumerAsset" && (
            <>
              <Field label="Hardwarekategorie">
                <input
                  list="hardware-types"
                  maxLength={1000}
                  value={form.assetType}
                  onChange={(e) =>
                    setForm({ ...form, assetType: e.target.value })
                  }
                />
              </Field>
              <datalist id="hardware-types">
                {[
                  "Beleuchtung",
                  "Maschinen",
                  "Anlagentechnik",
                  "Wärmeanlagen",
                  "Lüftung / Klima",
                  "Kälteanlagen",
                  "Druckluft",
                  "EDV-Technik",
                  "Serverraum",
                  "BHKW",
                  "Photovoltaik",
                  "Windanlage",
                  "Batteriespeicher",
                  "Sonstige Verbraucher",
                  "Sonstige Erzeugungsanlagen",
                ].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              <Field label="Energierolle">
                <select
                  value={form.assetRole}
                  onChange={(e) =>
                    setForm({ ...form, assetRole: e.target.value })
                  }
                >
                  <option value="Consumption">Verbraucher</option>
                  <option value="Generation">Erzeuger</option>
                  <option value="Both">Verbraucher und Erzeuger</option>
                </select>
              </Field>
              {text("energySources", "Energieträger / Energieformen")}
              {text("manufacturer", "Hersteller")}
              {text("model", "Modell")}
              {numeric("year", "Baujahr", true, 2200)}
              {numeric("quantity", "Anzahl", false, 1000000)}
              {numeric(
                "ratedPowerW",
                "Nenn-/Leuchtmittelleistung je Stück (W)",
              )}
              {numeric(
                "systemPowerW",
                "Elektrische Systemleistung je Stück inkl. Verluste (W)",
                true,
              )}
              {numeric(
                "annualHours",
                "Betriebsstunden pro Jahr (h)",
                false,
                8784,
              )}
              {numeric("operatingDays", "Betriebstage pro Jahr", false, 366)}
              {numeric("loadFactor", "Lastfaktor (0 bis 1)", false, 1)}
            </>
          )}
          <div className="full annual-input">
            <h3>Theoretischer Jahresbedarf / Jahresertrag</h3>
            <p className="subtle">
              Optionaler Gesamtansatz für diesen Eintrag. Ohne Jahreswert wird
              bei Hardware die elektrische Energie aus Leistung und
              Betriebsstunden geschätzt. Ein Gesamtansatz ersetzt gleichartige
              Unterwerte.
            </p>
          </div>
          {numeric(
            "annualEnergyValue",
            "Vorgegebene Jahresmenge (optional)",
            true,
          )}
          {form.kind !== "ConsumerAsset" && (
            <Field label="Energierolle des Jahresansatzes">
              <select
                value={form.assetRole}
                onChange={(e) =>
                  setForm({ ...form, assetRole: e.target.value })
                }
              >
                <option value="Consumption">Verbraucher</option>
                <option value="Generation">Erzeuger</option>
                <option value="Both">
                  Verbraucher und Erzeuger (ungeklärt)
                </option>
              </select>
            </Field>
          )}
          <Field label="Energieträger der Jahresmenge">
            <select
              value={form.annualEnergyMedium}
              onChange={(e) =>
                setForm({
                  ...form,
                  annualEnergyMedium: e.target.value,
                  annualEnergyUnit: e.target.value === "Water" ? "m³" : "kWh",
                })
              }
            >
              {Object.entries({ ...media, Other: "Sonstige" }).map(
                ([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Einheit der Jahresmenge">
            <select
              value={form.annualEnergyUnit}
              onChange={(e) =>
                setForm({ ...form, annualEnergyUnit: e.target.value })
              }
            >
              {(form.annualEnergyMedium === "Other"
                ? ["kWh", "MWh", "m³", "L"]
                : units[form.annualEnergyMedium]
              ).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <label className="field full">
            <span>Technische Bemerkungen</span>
            <textarea
              maxLength={4000}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label className="field full">
            <span>
              Individuelle Zusatzfelder (JSON, z. B. {`{"Geschoss":"EG"}`})
            </span>
            <textarea
              rows={3}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Eintrag aktiv
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Speichern …" : "Katastereintrag speichern"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function PointForm({
  customerId,
  view,
  nodeId,
  tree,
  onClose,
  onSaved,
}: {
  customerId: string;
  view?: PointView;
  nodeId?: string;
  tree: Tree;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    number: view?.point.number || "",
    name: view?.point.name || "",
    nodeId: view?.assignment.nodeId || nodeId || tree.nodes[0]?.node.id || "",
    parentPointId: view?.assignment.parentPointId || null,
    at: localInput(),
    medium: view?.point.medium || "Electricity",
    unit: view?.point.unit || "kWh",
    quantity: view?.point.quantity || "Energie",
    direction: view?.point.direction || "Import",
    readingIntervalDays: view?.point.readingIntervalDays || 30,
    maxDailyConsumption: view?.point.maxDailyConsumption ?? null,
    supplier: view?.point.supplier || "",
    tariffReference: view?.point.tariffReference || "",
    notes: view?.point.notes || "",
    isActive: view?.point.isActive ?? true,
    version: view?.point.version || 1,
  });
  const [device, setDevice] = useState({
    number: view?.device.number || "",
    manufacturer: view?.device.manufacturer || "",
    model: view?.device.model || "",
    meterType: view?.device.meterType || "",
    factor: view?.installation.factor ?? 1,
    decimals: view?.installation.decimals ?? 0,
    resolution: view?.installation.resolution ?? 1,
    registerLimit: view?.installation.registerLimit ?? null,
  });
  const [initial, setInitial] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={
        view ? "Messstelle bearbeiten" : "Messstelle mit Zählergerät anlegen"
      }
      onClose={onClose}
    >
      <ErrorBox error={error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          setBusy(true);
          try {
            const p = await api<Point>(
              `/meters/${view ? view.point.id : `?customerId=${customerId}`}`,
              view ? "PUT" : "POST",
              {
                ...form,
                at: new Date(form.at).toISOString(),
                device,
                initialValue: initial === "" ? null : Number(initial),
              },
            );
            await onSaved(p.id);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Messstellennummer *">
            <input
              required
              maxLength={60}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </Field>
          <Field label="Messstellenbezeichnung *">
            <input
              required
              maxLength={200}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Zuordnung im Anlagenkataster">
            <select
              disabled={!!view}
              value={form.nodeId}
              onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
            >
              {tree.nodes
                .filter((x) => x.node.isActive)
                .map((v) => (
                  <option key={v.node.id} value={v.node.id}>
                    {kinds[v.node.kind]} · {v.node.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Medium">
            <select
              disabled={!!view}
              value={form.medium}
              onChange={(e) =>
                setForm({
                  ...form,
                  medium: e.target.value,
                  unit: units[e.target.value][0],
                  quantity:
                    units[e.target.value][0] === "m³" ? "Volumen" : "Energie",
                })
              }
            >
              {Object.entries(media).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Einheit">
            <select
              disabled={!!view}
              value={form.unit}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit: e.target.value,
                  quantity: e.target.value === "m³" ? "Volumen" : "Energie",
                })
              }
            >
              {units[form.medium].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Messrichtung">
            <select
              disabled={!!view}
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
            >
              <option value="Import">Bezug / Verbrauch</option>
              <option value="Export">Einspeisung</option>
            </select>
          </Field>
          <Field label="Übergeordnete Messstelle">
            <select
              disabled={!!view}
              value={form.parentPointId || ""}
              onChange={(e) =>
                setForm({ ...form, parentPointId: e.target.value || null })
              }
            >
              <option value="">Hauptzähler / eigenständige Messstelle</option>
              {tree.points
                .filter(
                  (x) =>
                    x.point.id !== view?.point.id &&
                    x.point.medium === form.medium &&
                    x.point.unit === form.unit &&
                    x.point.direction === form.direction,
                )
                .map((p) => (
                  <option key={p.point.id} value={p.point.id}>
                    {p.point.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Messgröße">
            <input
              maxLength={80}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Ableseintervall (Tage)">
            <input
              type="number"
              required
              min="1"
              max="3660"
              value={form.readingIntervalDays}
              onChange={(e) =>
                setForm({
                  ...form,
                  readingIntervalDays: Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label={`Tagesgrenze (${form.unit}/Tag, optional)`}>
            <input
              type="number"
              min="0"
              step="any"
              value={form.maxDailyConsumption ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxDailyConsumption:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Versorger">
            <input
              maxLength={200}
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </Field>
          <Field label="Tarifreferenz">
            <input
              maxLength={200}
              value={form.tariffReference}
              onChange={(e) =>
                setForm({ ...form, tariffReference: e.target.value })
              }
            />
          </Field>
        </div>
        {!view && (
          <>
            <h3>Physisches Zählergerät</h3>
            <DeviceFields value={device} onChange={setDevice} />
            <div className="form-grid">
              <Field label="Einbauzeitpunkt (Browser-Ortszeit)">
                <input
                  type="datetime-local"
                  step="1"
                  required
                  value={form.at}
                  onChange={(e) => setForm({ ...form, at: e.target.value })}
                />
              </Field>
              <Field label={`Anfangsstand (${form.unit}, optional)`}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={initial}
                  onChange={(e) => setInitial(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
        {view && (
          <p className="subtle">
            Gerätewerte ändern sich über „Zählertausch“, Anlagenzuordnungen über
            „Zuordnung ändern“. Historische Werte bleiben erhalten.
          </p>
        )}
        <Field label="Technische Bemerkungen">
          <textarea
            maxLength={4000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Messstelle aktiv
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Speichern …" : "Messstelle speichern"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export type DeviceForm = {
  number: string;
  manufacturer: string;
  model: string;
  meterType: string;
  factor: number;
  decimals: number;
  resolution: number;
  registerLimit: number | null;
};
export function DeviceFields({
  value,
  onChange,
}: {
  value: DeviceForm;
  onChange: (v: DeviceForm) => void;
}) {
  return (
    <div className="form-grid">
      {(["number", "manufacturer", "model", "meterType"] as const).map(
        (key, index) => (
          <Field
            key={key}
            label={
              ["Zählernummer *", "Hersteller", "Modell", "Zählertyp"][index]
            }
          >
            <input
              required={key === "number"}
              maxLength={key === "number" ? 100 : 200}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </Field>
        ),
      )}
      {(["factor", "decimals", "resolution", "registerLimit"] as const).map(
        (key, index) => (
          <Field
            key={key}
            label={
              [
                "Zählerfaktor",
                "Nachkommastellen (0–6)",
                "Zählerauflösung",
                "Zählwerksgrenze / Überlaufmodulus (optional)",
              ][index]
            }
          >
            <input
              type="number"
              required={key !== "registerLimit"}
              min={key === "decimals" ? 0 : 0.000001}
              max={key === "decimals" ? 6 : undefined}
              step={key === "decimals" ? 1 : "any"}
              value={value[key] ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]:
                    e.target.value === "" && key === "registerLimit"
                      ? null
                      : Number(e.target.value),
                })
              }
            />
          </Field>
        ),
      )}
    </div>
  );
}
export function AssignmentForm({
  view,
  tree,
  onClose,
  onSaved,
  target,
}: {
  view: PointView;
  target?: { nodeId: string; parentPointId: string | null };
  tree: Tree;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [nodeId, setNodeId] = useState(
      target?.nodeId || view.assignment.nodeId,
    ),
    [parent, setParent] = useState(
      target ? target.parentPointId || "" : view.assignment.parentPointId || "",
    ),
    [at, setAt] = useState(localInput()),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  return (
    <Dialog title="Zählerzuordnung zeitlich versionieren" onClose={onClose}>
      <ErrorBox error={error} />
      <p className="subtle">
        Die bisherige Zuordnung wird abgeschlossen. Der Zeitpunkt muss nach
        allen vorhandenen Ablesungen liegen.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await api(`/meters/${view.point.id}/assignment`, "POST", {
              nodeId,
              parentPointId: parent || null,
              at: new Date(at).toISOString(),
              version: view.point.version,
            });
            await onSaved();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Neue Zuordnung im Anlagenkataster">
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            {tree.nodes
              .filter((n) => n.node.isActive)
              .map((n) => (
                <option key={n.node.id} value={n.node.id}>
                  {n.node.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Übergeordnete Messstelle">
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Keine / Hauptzähler</option>
            {tree.points
              .filter(
                (p) =>
                  p.point.id !== view.point.id &&
                  p.point.medium === view.point.medium &&
                  p.point.unit === view.point.unit,
              )
              .map((p) => (
                <option key={p.point.id} value={p.point.id}>
                  {p.point.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Gültig ab (Browser-Ortszeit)">
          <input
            type="datetime-local"
            step="1"
            required
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </Field>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy}>
            Zuordnung speichern
          </button>
        </div>
      </form>
    </Dialog>
  );
}
