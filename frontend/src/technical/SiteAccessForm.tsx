import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Session, type User } from '../api';
import { Dialog, ErrorBox, Field } from '../ui';
import type { Tree } from './types';
export function SiteAccessForm({
  user,
  session,
  onClose,
}: {
  user: User;
  session: Session;
  onClose: () => void;
}) {
  const [customer, setCustomer] = useState(user.customerIds[0] || '');
  const [restricted, setRestricted] = useState(false),
    [ids, setIds] = useState<string[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const tree = useQuery({
    queryKey: ['technical', customer],
    queryFn: () => api<Tree>(`/technical/${customer}/tree`),
    enabled: !!customer,
  });
  const q = useQuery({
    queryKey: ['site-access', user.id, customer],
    queryFn: () =>
      api<{ restricted: boolean; siteIds: string[] }>(
        `/users/${user.id}/site-access?customerId=${customer}`,
      ),
    enabled: !!customer,
  });
  useEffect(() => {
    if (q.data) {
      setRestricted(q.data.restricted);
      setIds(q.data.siteIds);
    }
  }, [q.data]);
  return (
    <Dialog title={`Standortfreigaben · ${user.name}`} onClose={onClose}>
      <ErrorBox error={error || q.error || tree.error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await api(`/users/${user.id}/site-access`, 'PUT', {
              customerId: customer,
              restricted,
              siteIds: ids,
            });
            await q.refetch();
            onClose();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Kunde für Standortfreigaben">
          <select
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setIds([]);
              setRestricted(false);
            }}
          >
            {session.customers
              .filter((c) => user.customerIds.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={restricted}
            onChange={(e) => setRestricted(e.target.checked)}
          />
          Zugriff auf ausgewählte Standorte beschränken
        </label>
        <p className="subtle">
          Ohne Beschränkung gelten alle Standorte dieses Kunden. Eine aktivierte
          Beschränkung ohne Auswahl sperrt sämtliche Standort- und
          Messstellendaten dieses Kunden.
        </p>
        {tree.data?.nodes
          .filter((n) => n.node.kind === 'Site')
          .map((n) => (
            <label className="checkbox" key={n.node.id}>
              <input
                type="checkbox"
                disabled={!restricted}
                checked={ids.includes(n.node.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, n.node.id]
                      : ids.filter((id) => id !== n.node.id),
                  )
                }
              />
              {n.node.name}
            </label>
          ))}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary" disabled={busy || q.isLoading}>
            Standortfreigaben speichern
          </button>
        </div>
      </form>
    </Dialog>
  );
}
