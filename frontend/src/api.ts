export type Customer = {
  id: string; number: string; name: string; legalForm: string; address: string; contact: string;
  email: string; phone: string; vatId: string; billingAddress: string; notes: string;
  contractStart: string | null; isActive: boolean; allowUserManagement: boolean; version: number;
};
export type Member = { id: string; name: string; allowUserManagement: boolean };
export type Session = { id: string; name: string; email: string; role: string; mustChangePassword: boolean; darkMode: boolean; customers: Member[] };
export type User = { id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; sessionVersion: string; customerIds: string[]; customers: string[]; lastLoginAt: string | null };
export type Audit = { id: number; at: string; actor: string; action: string; target: string; result: string; details: string; correlationId: string };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
let csrf: string | null = null;
export function clearCsrf() { csrf = null; }
export async function request(path: string, method = 'GET', body?: unknown): Promise<Response> {
  if (method !== 'GET' && !csrf) {
    const r = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    if (!r.ok) throw new ApiError(r.status, 'Sicherheitsprüfung konnte nicht geladen werden.');
    csrf = (await r.json()).token;
  }
  const r = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-TOKEN': csrf! } : {}) },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => null);
    if (r.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(r.status, data?.message || ({ 400: 'Bitte Eingaben prüfen.', 401: 'Bitte neu anmelden.', 403: 'Für diese Aktion fehlt die Berechtigung.', 404: 'Datensatz nicht gefunden.', 429: 'Zu viele Versuche. Bitte eine Minute warten.' }[r.status] ?? 'Der Dienst ist momentan nicht erreichbar.'));
  }
  return r;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  return (await request(path, method, body)).json().catch(() => null) as Promise<T>;
}
export async function download(path: string, name: string, method = 'GET', body?: unknown) {
  const r = await request(path, method, body); const url = URL.createObjectURL(await r.blob());
  const disposition = r.headers.get('Content-Disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const a = document.createElement('a'); a.href = url; a.download = encoded ? decodeURIComponent(encoded) : disposition.match(/filename="?([^";]+)"?/i)?.[1] || name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const roleNames: Record<string, string> = { SystemAdmin: 'Systemadministrator', CustomerAdmin: 'Kundenadministrator', CustomerUser: 'Kundenbenutzer', Reader: 'Kundenleser' };
export function date(value?: string | null) { return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Noch keine Anmeldung'; }
