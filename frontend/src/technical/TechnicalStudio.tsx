import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Session, date } from '../api';
import { Badge, Dialog, ErrorBox, Field } from '../ui';
import {
  kinds,
  media,
  num,
  type Node,
  type NodeView,
  type PointView,
  type Tree,
} from './types';
import { NodeForm, PointForm, AssignmentForm } from './forms';
import { MeterPanel, Documents } from './readings';
import './technical.css';

export function TechnicalStudio({
  session,
  tenant,
  mode,
  onCustomerChange,
}: {
  session: Session;
  tenant: string;
  mode: string;
  onCustomerChange: (id: string) => void;
}) {
  const admin = session.role === 'SystemAdmin';
  const [customer, setCustomer] = useState(
    tenant || session.customers[0]?.id || '',
  );
  const [selected, setSelected] = useState<{
    type: 'node' | 'point';
    id: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<{
    type: 'node' | 'point' | 'assignment';
    id?: string;
    parentId?: string;
  } | null>(null);
  useEffect(() => {
    setCustomer(tenant || session.customers[0]?.id || '');
    setSelected(null);
  }, [tenant, session.customers]);
  const q = useQuery({
    queryKey: ['technical', customer],
    queryFn: () => api<Tree>(`/technical/${customer}/tree`),
    enabled: !!customer,
  });
  const tree = q.data || { nodes: [], points: [] };
  const node = tree.nodes.find((x) => x.node.id === selected?.id);
  const point = tree.points.find((x) => x.point.id === selected?.id);
  const refresh = async () => {
    await q.refetch();
  };
  const onSaved = async (id?: string, type?: 'node' | 'point') => {
    setEdit(null);
    await refresh();
    if (id && type) setSelected({ type, id });
  };
  const matches = (text: string) =>
    text.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'));
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
    const hit = matches(
      `${p.point.name} ${p.point.number} ${p.device?.number}`,
    );
    if (search && !meterMatches(p)) return null;
    return (
      <li key={p.point.id}>
        <button
          className={`tree-item ${selected?.id === p.point.id ? 'current' : ''}`}
          onClick={() => setSelected({ type: 'point', id: p.point.id })}
        >
          <span aria-hidden="true" className="meter-dot">
            ◴
          </span>
          <span>
            {p.point.name}
            <small>
              {p.point.number} · {media[p.point.medium]}
              {!p.point.isActive ? ' · Inaktiv' : ''}
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
      mode === 'kataster' &&
      search &&
      !matches(`${n.name} ${n.number}`) &&
      !children.length
    )
      return null;
    return (
      <li key={n.id}>
        <details
          open={
            search || n.kind === 'Site' || n.kind === 'Building'
              ? true
              : undefined
          }
        >
          <summary>
            <span aria-hidden="true">
              {n.kind === 'Site' ? '⌂' : n.kind === 'Building' ? '▤' : '◇'}
            </span>
            <button
              className={selected?.id === n.id ? 'current' : ''}
              onClick={() => setSelected({ type: 'node', id: n.id })}
            >
              {n.name}
              <small>
                {kinds[n.kind]} · {n.number}
                {!n.isActive ? ' · Inaktiv' : ''}
              </small>
            </button>
          </summary>
          <ul>
            {children.map(nodeBranch)}
            {mode === 'meters' &&
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
            {mode === 'kataster'
              ? 'Technische Kundenakte'
              : 'Messstellen und Geräte'}
          </h2>
          <p className="subtle">
            {tree.nodes.filter((x) => x.node.kind === 'Site').length} Standorte
            · {tree.points.length} Messstellen
          </p>
        </div>
        {session.customers.length > 1 && (
          <Field label="Kunde für Kataster">
            <select
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setSelected(null);
                onCustomerChange(e.target.value);
              }}
            >
              {session.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {admin && (
          <div className="toolbar-actions">
            <button onClick={() => setEdit({ type: 'node' })}>
              + Standort anlegen
            </button>
            <button
              className="primary"
              disabled={!tree.nodes.length}
              onClick={() =>
                setEdit({ type: 'point', parentId: node?.node.id })
              }
            >
              + Messstelle anlegen
            </button>
          </div>
        )}
      </section>
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
              {mode === 'kataster' ? 'ANLAGENKATASTER' : 'ZÄHLERANLAGENBAUM'}
            </div>
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
            {point && selected?.type === 'point' ? (
              <MeterPanel
                key={point.point.id}
                view={point}
                tree={tree}
                admin={admin}
                canWrite={session.role !== 'Reader'}
                refresh={refresh}
                onEdit={() => setEdit({ type: 'point', id: point.point.id })}
                onAssignment={() =>
                  setEdit({ type: 'assignment', id: point.point.id })
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
                      {node.node.isActive ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                  <NodeDetails view={node} />
                  {admin && (
                    <div className="toolbar-actions">
                      <button
                        onClick={() =>
                          setEdit({ type: 'node', id: node.node.id })
                        }
                      >
                        Stammdaten bearbeiten
                      </button>
                      {node.node.kind !== 'ConsumerAsset' && (
                        <button
                          onClick={() =>
                            setEdit({ type: 'node', parentId: node.node.id })
                          }
                        >
                          + Untereintrag anlegen
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setEdit({ type: 'point', parentId: node.node.id })
                        }
                      >
                        + Messstelle zuordnen
                      </button>
                    </div>
                  )}
                </section>
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
                          setSelected({ type: 'point', id: p.point.id })
                        }
                      >
                        <span>
                          <strong>{p.point.name}</strong>
                          <small>
                            {media[p.point.medium]} · Gerät {p.device?.number} ·{' '}
                            {p.latestReading
                              ? `${num(p.latestReading.value)} ${p.point.unit}`
                              : 'Noch keine Ablesung'}
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
                <Documents nodeId={node.node.id} canWrite={admin} />
              </>
            ) : (
              <section className="panel technical-empty">
                <span className="eyebrow">
                  {mode === 'kataster'
                    ? 'TECHNISCHE KUNDENAUFNAHME'
                    : 'ZÄHLERSTÄNDE ERFASSEN'}
                </span>
                <h2>
                  {mode === 'kataster'
                    ? 'Die technische Struktur Ihres Kunden.'
                    : 'Eine Messstelle auswählen.'}
                </h2>
                <p>
                  Links einen Standort, ein Gebäude oder eine Messstelle öffnen.
                  Alle Einträge werden dauerhaft gespeichert und Änderungen
                  protokolliert.
                </p>
                {admin && (
                  <p className="subtle">
                    Beginnen Sie mit einem Standort, ergänzen Sie Gebäude und
                    Anlagen und ordnen Sie anschließend Haupt- und Unterzähler
                    zu.
                  </p>
                )}
                <div className="media-legend">
                  {Object.values(media).map((m) => (
                    <Badge key={m}>{m}</Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {edit?.type === 'node' && (
        <NodeForm
          customerId={customer}
          node={tree.nodes.find((x) => x.node.id === edit.id)?.node}
          parent={tree.nodes.find((x) => x.node.id === edit.parentId)?.node}
          tree={tree}
          onClose={() => setEdit(null)}
          onSaved={(id) => onSaved(id, 'node')}
        />
      )}
      {edit?.type === 'point' && (
        <PointForm
          customerId={customer}
          view={tree.points.find((x) => x.point.id === edit.id)}
          nodeId={edit.parentId}
          tree={tree}
          onClose={() => setEdit(null)}
          onSaved={(id) => onSaved(id, 'point')}
        />
      )}
      {edit?.type === 'assignment' && (
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
    ['Adresse', n.address],
    ['Ansprechpartner', n.contact],
    ['Nutzung / Standorttyp', n.usage],
    ['Betriebszeiten', n.operatingHours],
    ['Arbeitstage', n.workingDays],
    ['Schichtmodell', n.shiftModel],
    ['Produktionszeiten', n.productionHours],
    ['Nutzfläche', n.usableArea == null ? '' : `${num(n.usableArea)} m²`],
    ['Beheizte Fläche', n.heatedArea == null ? '' : `${num(n.heatedArea)} m²`],
    ['Baujahr', n.year],
    ['Heizung', n.heating],
    ['Kühlung', n.cooling],
    ['Beleuchtung', n.lighting],
    ['Energieträger', n.energySources],
    ['Versorgungssysteme', n.supplySystems],
    ['Zeitzone', n.timeZone],
    ['Verbrauchertyp', n.assetType],
    ['Hersteller', n.manufacturer],
    ['Modell', n.model],
    ['Bemerkungen', n.notes],
    ...Object.entries(n.customFields),
  ];
  return (
    <>
      <dl className="detail-grid">
        {pairs
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
      </dl>
      {n.kind === 'ConsumerAsset' && (
        <div className="estimate-box">
          <strong>Rechnerische Schätzung</strong>
          <p>
            {num(n.quantity)} Stück × {num(n.systemPowerW ?? n.ratedPowerW)} W ={' '}
            {num(view.estimatedPowerKw)} kW
          </p>
          <p>
            {num(n.annualHours)} h/Jahr × Lastfaktor {num(n.loadFactor)} →{' '}
            <strong>{num(view.estimatedAnnualKwh)} kWh/Jahr</strong>
          </p>
          <small>
            Aus technischen Stammdaten berechnet. Dies ist kein gemessener
            Verbrauch.
          </small>
        </div>
      )}
    </>
  );
}
