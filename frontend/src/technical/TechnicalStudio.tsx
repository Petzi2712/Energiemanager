import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Session } from "../api";
import { Badge, ErrorBox } from "../ui";
import {
  kinds,
  media,
  num,
  type NodeView,
  type PointView,
  type Tree,
} from "./types";
import { NodeForm, PointForm, AssignmentForm } from "./forms";
import { MeterPanel, Documents } from "./readings";
import "./technical.css";
import { TheoreticalBalance } from "./TheoreticalBalance";
import { ExcelTools } from "./ExcelTools";
import { DeleteDialog } from "../DeleteDialog";
import { CopyNode } from "./CopyNode";

export function TechnicalStudio({
  session,
  tenant,
  mode,
}: {
  session: Session;
  tenant: string;
  mode: string;
}) {
  const admin = session.role === "SystemAdmin";
  const [customer, setCustomer] = useState(
    tenant || session.customers[0]?.id || "",
  );
  const [selected, setSelected] = useState<{
    type: "node" | "point";
    id: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [copying, setCopying] = useState<NodeView["node"] | null>(null);
  const [deleting, setDeleting] = useState<NodeView["node"] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    nodeId: string;
    parentPointId: string | null;
  } | null>(null);
  const [edit, setEdit] = useState<{
    type: "node" | "point" | "assignment";
    id?: string;
    parentId?: string;
  } | null>(null);
  useEffect(() => {
    setCustomer(tenant || session.customers[0]?.id || "");
    setSelected(null);
  }, [tenant, session.customers]);
  const q = useQuery({
    queryKey: ["technical", customer],
    queryFn: () => api<Tree>(`/technical/${customer}/tree`),
    enabled: !!customer,
  });
  useEffect(() => {
    if (mode === "kataster" && !selected && q.data?.nodes.length) {
      const site = q.data.nodes.find((n) => n.node.kind === "Site");
      if (site) setSelected({ type: "node", id: site.node.id });
    }
  }, [q.data, mode, selected]);
  const tree = q.data || { nodes: [], points: [] };
  const node = tree.nodes.find((x) => x.node.id === selected?.id);
  function balanceRoot(id: string): string {
    let current = tree.nodes.find(x => x.node.id === id)?.node;
    while (current && !["Site","Building"].includes(current.kind)) current = tree.nodes.find(x => x.node.id === current?.parentId)?.node;
    return current?.id || id;
  }
  const point = tree.points.find((x) => x.point.id === selected?.id);
  const refresh = async () => {
    await q.refetch();
  };
  const onSaved = async (id?: string, type?: "node" | "point") => {
    setEdit(null);
    await refresh();
    if (id && type) setSelected({ type, id });
  };
  const matches = (text: string) =>
    text.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de"));
  const meterMatches = (p: PointView, seen: string[] = []): boolean =>
    !seen.includes(p.point.id) &&
    (matches(`${p.point.name} ${p.point.number} ${p.device?.number}`) ||
      tree.points
        .filter((c) => c.assignment.parentPointId === p.point.id)
        .some((c) => meterMatches(c, [...seen, p.point.id])));
  function meterBranch(p: PointView, path: string[] = []): React.ReactNode {
    if (path.includes(p.point.id)) return null;
    const children = tree.points.filter(
      (x) => x.assignment.parentPointId === p.point.id,
    );
    if (search && !meterMatches(p)) return null;
    return (
      <li key={p.point.id}>
        <button
          className={`tree-item ${selected?.id === p.point.id ? "current" : ""}`}
          draggable={admin && p.point.isActive}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("application/x-meter", p.point.id);
            e.dataTransfer.effectAllowed = "move";
            setDragging(p.point.id);
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            if (admin && dragging && dragging !== p.point.id) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData("application/x-meter");
            if (admin && id && id !== p.point.id) {
              setDropTarget({
                id,
                nodeId: p.assignment.nodeId,
                parentPointId: p.point.id,
              });
              setDragging(null);
            }
          }}
          title={
            admin
              ? "Ziehen, um die Hierarchie zu ändern. Alternativ „Zuordnung ändern“ verwenden."
              : undefined
          }
          onClick={() => setSelected({ type: "point", id: p.point.id })}
        >
          <span aria-hidden="true" className="meter-dot">
            ◴
          </span>
          <span>
            {p.point.name}
            <small>
              {p.point.number} · {media[p.point.medium]}
              {!p.point.isActive ? " · Inaktiv" : ""}
            </small>
          </span>
        </button>
        {children.length > 0 && (
          <ul>{children.map((c) => meterBranch(c, [...path, p.point.id]))}</ul>
        )}
      </li>
    );
  }
  function nodeBranch(v: NodeView): React.ReactNode {
    const n = v.node;
    const children = tree.nodes.filter((x) => x.node.parentId === n.id);
    const meters = tree.points.filter(
      (x) => x.assignment.nodeId === n.id && !x.assignment.parentPointId,
    );
    if (
      mode === "kataster" &&
      search &&
      !matches(`${n.name} ${n.number}`) &&
      !children.length
    )
      return null;
    return (
      <li key={n.id}>
        <details
          open={
            search || n.kind === "Site" || n.kind === "Building"
              ? true
              : undefined
          }
        >
          <summary
            onDragOver={(e) => {
              if (admin && mode === "meters" && dragging) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const id = e.dataTransfer.getData("application/x-meter");
              if (admin && mode === "meters" && id) {
                setDropTarget({ id, nodeId: n.id, parentPointId: null });
                setDragging(null);
              }
            }}
            className={dragging && mode === "meters" ? "drop-zone" : undefined}
          >
            <span aria-hidden="true">
              {n.kind === "Site" ? "⌂" : n.kind === "Building" ? "▤" : "◇"}
            </span>
            <button
              className={selected?.id === n.id ? "current" : ""}
              onClick={() => setSelected({ type: "node", id: n.id })}
            >
              {n.name}
              <small>
                {kinds[n.kind]} · {n.number}
                {!n.isActive ? " · Inaktiv" : ""}
              </small>
            </button>
          </summary>
          <ul>
            {children.map(nodeBranch)}
            {mode === "meters" &&
              Object.entries(media).map(([medium, label]) => {
                const group = meters.filter((p) => p.point.medium === medium);
                return group.length ? (
                  <li className="media-group" key={medium}>
                    <details open>
                      <summary>{label}</summary>
                      <ul>{group.map((p) => meterBranch(p))}</ul>
                    </details>
                  </li>
                ) : null;
              })}
          </ul>
        </details>
      </li>
    );
  }
  return (
    <>
      <ErrorBox error={q.error} />
      <section className="technical-toolbar">
        <div>
          <h2>
            {mode === "kataster"
              ? "Technische Kundenakte"
              : "Messstellen und Geräte"}
          </h2>
          <p className="subtle">
            {tree.nodes.filter((x) => x.node.kind === "Site").length} Standorte
            ·{" "}
            {mode === "meters"
              ? `${tree.points.length} Messstellen`
              : `${tree.nodes.filter((x) => x.node.kind === "ConsumerAsset").length} Hardwareeinträge`}
          </p>
        </div>
        {admin && (
          <div className="toolbar-actions">
            <button onClick={() => setEdit({ type: "node" })}>
              + Standort anlegen
            </button>
            {mode === "meters" && (
              <button
                className="primary"
                disabled={!tree.nodes.length}
                onClick={() =>
                  setEdit({ type: "point", parentId: node?.node.id })
                }
              >
                + Messstelle anlegen
              </button>
            )}
          </div>
        )}
      </section>
      {mode === "meters" && customer && (
        <div className="excel-toolbar">
          <ExcelTools
            key={customer}
            customerId={customer}
            points={tree.points}
            canWrite={session.role !== "Reader"}
            onImported={refresh}
          />
        </div>
      )}
      {!customer ? (
        <p>Keine Kundenfreigabe vorhanden.</p>
      ) : (
        <div className="technical-layout">
          <aside className="structure-panel">
            <label className="search">
              <span>Struktur durchsuchen</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bezeichnung oder Nummer …"
              />
            </label>
            <div className="structure-title">
              {mode === "kataster" ? "ANLAGENKATASTER" : "ZÄHLERANLAGENBAUM"}
            </div>
            {admin && mode === "meters" && (
              <p className="subtle drag-help">
                Zähler auf einen Zähler ziehen, um ihn unterzuordnen. Auf einen
                Anlagenknoten ziehen, um ihn als Hauptzähler zuzuordnen.
              </p>
            )}
            <ul className="structure-tree">
              {tree.nodes.filter((x) => !x.node.parentId).map(nodeBranch)}
            </ul>
            {!tree.nodes.length && !q.isLoading && (
              <p className="subtle">
                Noch keine freigegebene Struktur vorhanden.
              </p>
            )}
            {q.isLoading && <p role="status">Struktur wird geladen …</p>}
          </aside>
          <div className="technical-detail">
            {mode === "meters" && point && selected?.type === "point" ? (
              <MeterPanel
                key={point.point.id}
                view={point}
                tree={tree}
                admin={admin}
                canWrite={session.role !== "Reader"}
                refresh={refresh}
                onDeleted={async () => {
                  setSelected(null);
                  await refresh();
                }}
                onEdit={() => setEdit({ type: "point", id: point.point.id })}
                onAssignment={() =>
                  setEdit({ type: "assignment", id: point.point.id })
                }
              />
            ) : node ? (
              <>
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        {kinds[node.node.kind]} · {node.node.number}
                      </span>
                      <h2>{node.node.name}</h2>
                    </div>
                    <Badge active={node.node.isActive}>
                      {node.node.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </div>
                  <NodeDetails view={node} />
                  {admin && (
                    <div className="toolbar-actions">
                      <button
                        onClick={() =>
                          setEdit({ type: "node", id: node.node.id })
                        }
                      >
                        Stammdaten bearbeiten
                      </button>
                      <button className="danger" onClick={() => setDeleting(node.node)}>Katastereintrag löschen</button>
                      {node.node.kind !== "Site" && (
                        <button onClick={() => setCopying(node.node)}>
                          Eintrag kopieren
                        </button>
                      )}
                      {node.node.kind !== "ConsumerAsset" && (
                        <button
                          onClick={() =>
                            setEdit({ type: "node", parentId: node.node.id })
                          }
                        >
                          + Untereintrag anlegen
                        </button>
                      )}
                      {mode === "meters" && (
                        <button
                          onClick={() =>
                            setEdit({ type: "point", parentId: node.node.id })
                          }
                        >
                          + Messstelle zuordnen
                        </button>
                      )}
                    </div>
                  )}
                </section>
                {mode === "kataster" && (
                    <TheoreticalBalance
                      key={node.node.id}
                      customerId={customer}
                      nodeId={balanceRoot(node.node.id)}
                      canEdit={admin}
                      version={tree.nodes
                        .map((n) => `${n.node.id}:${n.node.version}`)
                        .join(",")}
                    />
                  )}
                {mode === "meters" && (
                  <section className="panel">
                    <h2>Zugeordnete Messstellen</h2>
                    {tree.points
                      .filter(
                        (x) =>
                          x.assignment.nodeId === node.node.id ||
                          x.point.id === node.node.measuringPointId,
                      )
                      .map((p) => (
                        <button
                          key={p.point.id}
                          className="point-link"
                          onClick={() =>
                            setSelected({ type: "point", id: p.point.id })
                          }
                        >
                          <span>
                            <strong>{p.point.name}</strong>
                            <small>
                              {media[p.point.medium]} · Gerät {p.device?.number}{" "}
                              ·{" "}
                              {p.latestReading
                                ? `${num(p.latestReading.value)} ${p.point.unit}`
                                : "Noch keine Ablesung"}
                            </small>
                          </span>
                          <span>→</span>
                        </button>
                      ))}
                    {!tree.points.some(
                      (x) =>
                        x.assignment.nodeId === node.node.id ||
                        x.point.id === node.node.measuringPointId,
                    ) && (
                      <p className="subtle">
                        Diesem Eintrag ist noch keine Messstelle zugeordnet.
                      </p>
                    )}
                  </section>
                )}
                <Documents nodeId={node.node.id} canWrite={admin} />
              </>
            ) : (
              <section className="panel technical-empty">
                <span className="eyebrow">
                  {mode === "kataster"
                    ? "TECHNISCHE KUNDENAUFNAHME"
                    : "ZÄHLERSTÄNDE ERFASSEN"}
                </span>
                <h2>
                  {mode === "kataster"
                    ? "Die technische Struktur Ihres Kunden."
                    : "Eine Messstelle auswählen."}
                </h2>
                <p>
                  Links einen Standort, ein Gebäude oder eine Messstelle öffnen.
                  Alle Einträge werden dauerhaft gespeichert und Änderungen
                  protokolliert.
                </p>
                {admin && (
                  <p className="subtle">
                    {mode === "kataster"
                      ? "Erfassen Sie Beleuchtung, Maschinen, Anlagentechnik, Wärmeanlagen, EDV, Serverräume und Erzeugungsanlagen wie BHKW, PV oder Windanlagen als Hardwareeinträge unter einem Gebäude."
                      : "Legen Sie Haupt- und Unterzähler an. Die Hierarchie lässt sich per Drag-and-drop oder über „Zuordnung ändern“ anpassen."}
                  </p>
                )}
                {mode === "meters" && (
                  <div className="media-legend">
                    {Object.values(media).map((m) => (
                      <Badge key={m}>{m}</Badge>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
      {dropTarget && tree.points.some((x) => x.point.id === dropTarget.id) && (
        <AssignmentForm
          view={tree.points.find((x) => x.point.id === dropTarget.id)!}
          tree={tree}
          target={dropTarget}
          onClose={() => setDropTarget(null)}
          onSaved={async () => {
            setSelected({ type: "point", id: dropTarget.id });
            setDropTarget(null);
            await refresh();
          }}
        />
      )}
      {deleting && <DeleteDialog title="Katastereintrag löschen" path={`/technical/${customer}/nodes/${deleting.id}`} version={deleting.version} description={`„${deleting.name}“ samt Dokumenten und Maßnahmen-Nachweisen löschen. Untereinträge werden nicht automatisch gelöscht. Zählerhistorien bleiben geschützt.`} onClose={() => setDeleting(null)} onDeleted={async () => { setDeleting(null); setSelected(null); await refresh(); }}/>}
      {copying && (
        <CopyNode
          source={copying}
          tree={tree}
          onClose={() => setCopying(null)}
          onSaved={async (id) => {
            setCopying(null);
            await refresh();
            setSelected({ type: "node", id });
          }}
        />
      )}
      {edit?.type === "node" && (
        <NodeForm
          customerId={customer}
          node={tree.nodes.find((x) => x.node.id === edit.id)?.node}
          parent={tree.nodes.find((x) => x.node.id === edit.parentId)?.node}
          tree={tree}
          onClose={() => setEdit(null)}
          onSaved={(id) => onSaved(id, "node")}
        />
      )}
      {edit?.type === "point" && (
        <PointForm
          customerId={customer}
          view={tree.points.find((x) => x.point.id === edit.id)}
          nodeId={edit.parentId}
          tree={tree}
          onClose={() => setEdit(null)}
          onSaved={(id) => onSaved(id, "point")}
        />
      )}
      {edit?.type === "assignment" && (
        <AssignmentForm
          view={tree.points.find((x) => x.point.id === edit.id)!}
          tree={tree}
          onClose={() => setEdit(null)}
          onSaved={() => onSaved()}
        />
      )}
    </>
  );
}
function NodeDetails({ view }: { view: NodeView }) {
  const n = view.node;
  const pairs: [string, unknown][] = [
    ["Adresse", n.address],
    ["Ansprechpartner", n.contact],
    ["Nutzung / Standorttyp", n.usage],
    ["Betriebszeiten", n.operatingHours],
    ["Arbeitstage", n.workingDays],
    ["Schichtmodell", n.shiftModel],
    ["Produktionszeiten", n.productionHours],
    ["Nutzfläche", n.usableArea == null ? "" : `${num(n.usableArea)} m²`],
    ["Beheizte Fläche", n.heatedArea == null ? "" : `${num(n.heatedArea)} m²`],
    ["Baujahr", n.year],
    ["Heizung", n.heating],
    ["Kühlung", n.cooling],
    ["Beleuchtung", n.lighting],
    ["Energieträger", n.energySources],
    ["Versorgungssysteme", n.supplySystems],
    ["Zeitzone", n.timeZone],
    ["Hardwarekategorie", n.assetType],
    [
      "Energierolle",
      (
        {
          Consumption: "Verbraucher",
          Generation: "Erzeuger",
          Both: "Verbraucher und Erzeuger",
        } as Record<string, string>
      )[n.assetRole],
    ],
    ["Hersteller", n.manufacturer],
    ["Modell", n.model],
    ["Bemerkungen", n.notes],
    ...Object.entries(n.customFields),
  ];
  return (
    <>
      <dl className="detail-grid">
        {pairs
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
      </dl>
      {n.annualEnergyValue != null ? (
        <div className="estimate-box">
          <strong>Vorgegebener theoretischer Jahreswert</strong>
          <p>
            {num(n.annualEnergyValue)} {n.annualEnergyUnit}/Jahr
          </p>
          <small>
            Dieser Gesamtansatz ersetzt gleichartige Unterwerte in der
            Jahresbilanz.
          </small>
        </div>
      ) : (
        n.kind === "ConsumerAsset" && (
          <div className="estimate-box">
            <strong>
              Rechnerische Schätzung ·{" "}
              {n.assetRole === "Generation"
                ? "Erzeugung"
                : n.assetRole === "Both"
                  ? "Energieumsatz"
                  : "Verbrauch"}
            </strong>
            <p>
              {num(n.quantity)} Stück × {num(n.systemPowerW ?? n.ratedPowerW)} W
              = {num(view.estimatedPowerKw)} kW
            </p>
            <p>
              {num(n.annualHours)} h/Jahr × Lastfaktor {num(n.loadFactor)} →{" "}
              <strong>{num(view.estimatedAnnualKwh)} kWh/Jahr</strong>
            </p>
            <small>
              Aus technischen Stammdaten berechnet. Kein gemessener
              Energieverbrauch oder Ertrag.
            </small>
          </div>
        )
      )}
    </>
  );
}
