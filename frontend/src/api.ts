export type Customer = {
  id: string; number: string; name: string; legalForm: string; address: string; contact: string;
  email: string; phone: string; vatId: string; billingAddress: string; notes: string;
  contractStart: string | null; isActive: boolean; allowUserManagement: boolean; version: number;
};
export type Member = { id: string; name: string; allowUserManagement: boolean };
export type Session = { id: string; name: string; email: string; role: string; mustChangePassword: boolean; customers: Member[] };
export type User = { id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; sessionVersion: string; customerIds: string[]; customers: string[]; lastLoginAt: string | null };
export type Audit = { id: number; at: string; actor: string; action: string; target: string; result: string; details: string; correlationId: string };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let csrf: string | null = null;
export function clearCsrf() { csrf = null; }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET' && !csrf) {
    const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    if (!r.ok) throw new ApiError(r.status, 'Sicherheitsprüfung konnte nicht geladen werden.');
    csrf = (await r.json()).token;
  }
  const r = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-TOKEN': csrf! } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(r.status, data?.message || ({ 400: 'Bitte Eingaben prüfen.', 401: 'Bitte neu anmelden.', 403: 'Für diese Aktion fehlt die Berechtigung.', 404: 'Datensatz nicht gefunden.', 429: 'Zu viele Versuche. Bitte eine Minute warten.' }[r.status] ?? 'Der Dienst ist momentan nicht erreichbar.'));
  }
  return data as T;
}
export const roleNames: Record<string, string> = { SystemAdmin: 'Systemadministrator', CustomerAdmin: 'Kundenadministrator', CustomerUser: 'Kundenbenutzer', Reader: 'Kundenleser' };
export function date(value?: string | null) { return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Noch keine Anmeldung'; }
