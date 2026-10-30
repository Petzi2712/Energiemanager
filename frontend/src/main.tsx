import React, { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, clearCsrf, date, roleNames, type Audit, type Customer, type Session, type User } from './api';
import './style.css';
import { Badge, Dialog, ErrorBox, Field } from './ui';
import { TechnicalStudio } from './technical/TechnicalStudio';
import { SiteAccessForm } from './technical/SiteAccessForm';
import { Appearance, BrandingSettings, useBranding } from './settings';
import { Fleet } from './Fleet';
import { Reports } from './Reports';
import { InputHints } from './inputHints';

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } });
type Brand = { name: string; subtitle: string; logo: string; colors: Record<string, string> };
let brand: Brand = { name: 'sysDATIQ', subtitle: 'Energie & Effizienz', logo: '/logo.svg', colors: {} };
const emptyCustomer: Omit<Customer, 'id'> = { number: '', name: '', legalForm: '', address: '', contact: '', email: '', phone: '', vatId: '', billingAddress: '', notes: '', contractStart: null, isActive: true, allowUserManagement: false, version: 1 };
function Logo() { const q = useBranding(); return <><img className="app-logo" src={q.data?.logo || brand.logo} alt="" width="38" height="38"/><span className="wordmark">{brand.name}<small>{brand.subtitle}</small></span></>; }
function App() {
  const [session, setSession] = useState<Session | null>(null), [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const cache = useQueryClient();
  useEffect(() => { document.documentElement.dataset.theme = session?.darkMode ? 'dark' : 'light'; }, [session?.darkMode]);
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(async r => { if (r.ok) setSession(await r.json()); }).catch(() => {}).finally(() => setLoading(false));
    const clear = () => { setSession(null); cache.clear(); clearCsrf(); setExpired(true); };
    window.addEventListener('session-expired', clear); return () => window.removeEventListener('session-expired', clear);
  }, [cache]);
  const refreshSession = async () => { clearCsrf(); setSession(await api<Session>('/auth/me')); cache.clear(); };
  if (loading) return <div className="loading" role="status">Arbeitsbereich wird geladen …</div>;
  if (!session) return <Login expired={expired} onLogin={s => { clearCsrf(); setSession(s); setExpired(false); cache.clear(); }}/>;
  if (session.mustChangePassword) return <div className="gate"><div className="brand"><Logo/></div><PasswordForm first onSaved={refreshSession}/><button className="link" onClick={async () => { await api('/auth/logout', 'POST'); setSession(null); clearCsrf(); }}>Abmelden</button></div>;
  return <Workspace session={session} refreshSession={refreshSession} onLogout={async () => { await api('/auth/logout', 'POST'); setSession(null); cache.clear(); clearCsrf(); }}/>;
}
function Login({ onLogin, expired }: { onLogin: (u: Session) => void; expired: boolean }) {
  const branding = useBranding();
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState(params.has('reset') ? 'reset' : 'login');
  const [email, setEmail] = useState(params.get('email') || ''), [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setMessage(''); setBusy(true);
    try {
      if (mode === 'login') onLogin(await api<Session>('/auth/login', 'POST', { email, password }));
      else if (mode === 'forgot') setMessage((await api<{ message: string }>('/auth/forgot', 'POST', { email })).message);
      else { setMessage((await api<{ message: string }>('/auth/reset', 'POST', { email, token: params.get('reset'), newPassword: password })).message); window.history.replaceState({}, '', '/'); setMode('login'); setPassword(''); }
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <main className="login-layout">
    <aside className="login-intro"><div className="brand"><Logo/></div><div><span className="eyebrow">TECHNIK MIT ÜBERBLICK</span><h1 className="login-motto">{branding.data?.motto || "Energie verstehen.\nEffizienz gestalten."}</h1><p>Ein gemeinsamer Arbeitsplatz für Ihre Kunden und die technische Energieberatung.</p><div className="intro-line"/><p className="intro-caption">Energie- und Effizienzmanagement<br/>Anlagen, Zähler und Fuhrpark</p></div><span className="intro-footer">sysDATIQ / synMETRA</span></aside>
    <section className="login-panel"><div className="login-form"><span className="eyebrow">WILLKOMMEN IM ARBEITSBEREICH</span><h2>{mode === 'login' ? 'Anmelden' : mode === 'forgot' ? 'Passwort vergessen?' : 'Neues Passwort vergeben'}</h2><p className="subtle">{mode === 'login' ? 'Melden Sie sich mit Ihrem persönlichen Zugang an.' : 'Der Passwort-Link wird im lokalen Testpostfach bereitgestellt.'}</p>
      {expired && <div className="notice">Ihre Sitzung wurde beendet. Bitte erneut anmelden.</div>}<ErrorBox error={error}/>{message && <div className="notice success" role="status">{message}</div>}
      <form onSubmit={submit}><Field label="E-Mail-Adresse"><input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></Field>
      {mode !== 'forgot' && <Field label={mode === 'reset' ? 'Neues Passwort (mindestens 12 Zeichen)' : 'Passwort'}><input type="password" required minLength={mode === 'reset' ? 12 : 1} maxLength={200} autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)}/></Field>}
      <button className="primary wide" disabled={busy}>{busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden →' : mode === 'forgot' ? 'Reset-Link anfordern' : 'Passwort speichern'}</button></form>
      <button className="link" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(null); setMessage(''); }}>{mode === 'login' ? 'Passwort vergessen?' : 'Zur Anmeldung'}</button>
      <details className="demo"><summary>Lokale Testzugänge</summary><p>Startpasswort für alle Konten: <code>Start_Energie</code>. Beim ersten Login ist ein eigenes Passwort erforderlich.</p><dl><dt>Systemadministration</dt><dd>admin@sysdatiq.local</dd><dt>Kundenadministration A</dt><dd>admin@nordwerk.example</dd><dt>Kundenbenutzer A</dt><dd>ablesung@nordwerk.example</dd><dt>Kundenleser B</dt><dd>lesen@weserpark.example</dd></dl><p>Nur synthetische Demodaten. Passwort-E-Mails sind in Mailpit am lokal konfigurierten Port 8025 sichtbar.</p></details>
    </div><footer>Lokale Testversion · Keine Verbindung zu Azure erforderlich</footer></section>
  </main>;
}
function PasswordForm({ first = false, onSaved }: { first?: boolean; onSaved: () => Promise<void> }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [repeat, setRepeat] = useState('');
  const [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  return <section className="panel password-panel"><span className="eyebrow">{first ? 'ERSTANMELDUNG' : 'KONTOSICHERHEIT'}</span><h2>{first ? 'Eigenes Passwort festlegen' : 'Passwort ändern'}</h2><p className="subtle">Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben. {first && 'Danach wird Ihr Arbeitsbereich freigeschaltet.'}</p>
    <ErrorBox error={error}/>{done && <div className="notice success" role="status">Passwort gespeichert.</div>}
    <form onSubmit={async e => { e.preventDefault(); setError(null); setBusy(true); setDone(false); try { if (next !== repeat) throw new Error('Die neuen Passwörter stimmen nicht überein.'); await api('/auth/password', 'POST', { currentPassword: current, newPassword: next }); await onSaved(); setCurrent(''); setNext(''); setRepeat(''); setDone(true); } catch (e) { setError(e); } finally { setBusy(false); } }}>
      <Field label={first ? 'Startpasswort' : 'Bisheriges Passwort'}><input type="password" required autoComplete="current-password" maxLength={200} value={current} onChange={e => setCurrent(e.target.value)}/></Field>
      <Field label="Neues Passwort"><input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)}/></Field>
      <Field label="Neues Passwort wiederholen"><input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)}/></Field>
      <button className="primary" disabled={busy}>{busy ? 'Speichern …' : first ? 'Passwort speichern und fortfahren' : 'Passwort speichern'}</button>
    </form></section>;
}
function Workspace({ session, onLogout, refreshSession }: { session: Session; onLogout: () => Promise<void>; refreshSession: () => Promise<void> }) {
  const [view, setView] = useState('dashboard'), [collapsed, setCollapsed] = useState(localStorage.getItem('sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false), [tenant, setTenant] = useState(''), [error, setError] = useState<unknown>(null);
  const admin = session.role === 'SystemAdmin';
  const userAdmin = admin || (session.role === 'CustomerAdmin' && session.customers.some(c => c.allowUserManagement));
  const nav = [{ id: 'dashboard', label: 'Übersicht', symbol: '▦' }, { id: 'customers', label: admin ? 'Kunden' : 'Mein Unternehmen', symbol: '▤' }, { id: 'kataster', label: admin ? 'Kundenkataster' : 'Anlagenübersicht', symbol: '⌘' }, { id: 'meters', label: admin ? 'Zähleranlagenbaum' : 'Zählerablesung', symbol: '◴' }, { id: 'fleet', label: 'Fuhrpark', symbol: '▱' }, { id: 'reports', label: 'Berichte', symbol: '▥' }, ...(userAdmin ? [{ id: 'users', label: 'Benutzer', symbol: '♙' }] : []), ...(admin ? [{ id: 'audit', label: 'Aktivitäten', symbol: '≡' }] : [])];
  const navigate = (id: string) => { setView(id); setMobileOpen(false); setError(null); };
  return <div className={`workspace ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    {mobileOpen && <button className="backdrop" aria-label="Menü schließen" onClick={() => setMobileOpen(false)}/>}
    <aside className="sidebar"><button className="brand brand-button" aria-label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'} aria-expanded={!collapsed} onClick={() => { const next = !collapsed; setCollapsed(next); localStorage.setItem('sidebar', next ? 'collapsed' : 'expanded'); }}><Logo/></button><div className="side-label">ARBEITSBEREICH</div><nav aria-label="Hauptnavigation">{nav.map(n => <button key={n.id} title={n.label} aria-current={view === n.id ? 'page' : undefined} className={view === n.id ? 'selected' : ''} onClick={() => navigate(n.id)}><span className="nav-symbol" aria-hidden="true">{n.symbol}</span><span className="nav-label">{n.label}</span></button>)}</nav><div className="sidebar-bottom"><span className="status-dot"/><span className="nav-label">Lokale Testumgebung<br/><small>Energiemanagement · v0.7.0</small></span><button className="settings-gear" title="Mein Konto" aria-label="Mein Konto" aria-current={view === 'profile' ? 'page' : undefined} onClick={() => navigate('profile')}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="m10 2-1 3-2 1-3-1-2 4 2 2v2l-2 2 2 4 3-1 2 1 1 3h4l1-3 2-1 3 1 2-4-2-2v-2l2-2-2-4-3 1-2-1-1-3z" fill="none" stroke="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor"/></svg></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-toggle" aria-label="Menü öffnen" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>☰</button><span>{admin ? 'Administration' : 'Kundenportal'}</span><span>/</span><strong>{(view === 'profile' ? 'Mein Konto' : nav.find(n => n.id === view)?.label)}</strong></div><div className="header-customer"><label htmlFor="header-tenant">Kunde</label><select id="header-tenant" aria-label="Kundenauswahl" value={['kataster','meters','fleet','reports'].includes(view) ? tenant || session.customers[0]?.id || '' : tenant} onChange={e => setTenant(e.target.value)}>{!['kataster','meters','fleet','reports'].includes(view) && <option value="">Alle freigegebenen Kunden</option>}{session.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><button className="account" aria-label="Mein Konto öffnen" onClick={() => navigate('profile')}><span className="avatar">{session.name.slice(0, 1).toUpperCase()}</span><span>{session.name}<small>{roleNames[session.role]}</small></span></button></header>
      <main className="content"><div className="page-heading"><div><span className="eyebrow">{admin ? 'SYS DATIQ · ADMINISTRATION' : 'IHR KUNDENBEREICH'}</span><h1>{(view === 'profile' ? 'Mein Konto' : nav.find(n => n.id === view)?.label)}</h1></div><Badge active>Lokaler Betrieb</Badge></div><ErrorBox error={error}/>
        {view === 'dashboard' && <Dashboard session={session} navigate={navigate} tenant={tenant}/>}
        {view === 'customers' && <Customers admin={admin} tenant={tenant} afterSave={refreshSession}/>}
        {(view === 'kataster' || view === 'meters') && <TechnicalStudio key={view} session={session} tenant={tenant} mode={view}/> }
        {view === 'fleet' && <Fleet key={tenant} session={session} customerId={tenant || session.customers[0]?.id || ''}/>}
        {view === 'reports' && <Reports key={tenant} session={session} customerId={tenant || session.customers[0]?.id || ''}/>}
        {view === 'users' && userAdmin && <Users session={session} tenant={tenant}/>}
        {view === 'audit' && admin && <Activities tenant={tenant}/>}
        {view === 'profile' && <><div className="panel profile"><div><h2>{session.name}</h2><p>{session.email}</p><Badge>{roleNames[session.role]}</Badge></div><button onClick={async () => { try { await onLogout(); } catch (e) { setError(e); } }}>Abmelden</button></div><Appearance session={session} onSaved={refreshSession}/>{admin && <BrandingSettings/>}<PasswordForm onSaved={refreshSession}/></>}
        <footer className="page-footer"><span>{brand.name} · Energie & Effizienz</span><span>Kundenkataster und Zählerverwaltung</span></footer>
      </main></div></div>;
}
function Dashboard({ session, navigate, tenant }: { session: Session; navigate: (view: string) => void; tenant: string }) {
  const q = useQuery({ queryKey: ['dashboard', tenant], queryFn: () => api<{ customers: number; activeUsers: number | null; lastLoginAt: string; sites:number; measuringPoints:number; overdueReadings:number; suspiciousReadings:number }>(`/dashboard${tenant ? `?customerId=${tenant}` : ''}`) });
  const admin = session.role === 'SystemAdmin';
  return <><ErrorBox error={q.error}/><section className="welcome"><div><h2>Willkommen, {session.name}.</h2><p>Ihre Kunden und Zugriffsrechte an einem Ort.</p></div><span className="phase-number">03<span>ENERGIEMANAGEMENT</span></span></section>
    <div className="stats"><article className="panel"><span className="stat-label">FREIGEGEBENE KUNDEN</span><strong>{q.data?.customers ?? '–'}</strong><small>Eigene Kundenzuordnungen</small></article>{admin && <article className="panel"><span className="stat-label">AKTIVE BENUTZER</span><strong>{q.data?.activeUsers ?? '–'}</strong><small>In Ihren Kundenmandanten</small></article>}<article className="panel"><span className="stat-label">LETZTE ANMELDUNG</span><strong className="stat-date">{date(q.data?.lastLoginAt)}</strong><small>Persönlicher Zugang</small></article></div>
    <div className="stats"><article className="panel"><span className="stat-label">STANDORTE / MESSSTELLEN</span><strong>{q.data?.sites ?? '–'} / {q.data?.measuringPoints ?? '–'}</strong><small>Freigegebene technische Struktur</small></article><article className="panel"><span className="stat-label">ÜBERFÄLLIGE ABLESUNGEN</span><strong>{q.data?.overdueReadings ?? '–'}</strong><small>Nach konfiguriertem Ableseintervall</small></article><article className="panel"><span className="stat-label">AUFFÄLLIGE MESSWERTE</span><strong>{q.data?.suspiciousReadings ?? '–'}</strong><small>Zur fachlichen Überprüfung</small></article></div><section className="panel"><div className="section-heading"><h2>Direkt weiterarbeiten</h2><span className="subtle">Ihr Arbeitsbereich</span></div><div className="quick-actions"><button onClick={() => navigate('meters')}><span className="quick-icon">◴</span><span><strong>Zähler und Ablesungen</strong><small>Messstellen öffnen und Zählerstände erfassen</small></span><b>→</b></button><button onClick={() => navigate('customers')}><span className="quick-icon">▤</span><span><strong>{admin ? 'Kunden verwalten' : 'Unternehmensdaten ansehen'}</strong><small>{admin ? 'Stammdaten anlegen, bearbeiten und zuordnen' : 'Freigegebene Stammdaten Ihres Unternehmens'}</small></span><b>→</b></button>{(admin || session.role === 'CustomerAdmin' && session.customers.some(c => c.allowUserManagement)) && <button onClick={() => navigate('users')}><span className="quick-icon">♙</span><span><strong>Benutzer und Rechte</strong><small>Zugänge verwalten und Rollen zuweisen</small></span><b>→</b></button>}</div></section>
    <section className="scope-note"><span className="scope-index">ENTWICKLUNGSSTAND</span><div><h3>Eine echte Grundlage für die nächsten Schritte.</h3><p>Diese Version enthält Anmeldung, Passwortverwaltung, Kunden, Benutzer und Audit-Protokoll mit dauerhafter PostgreSQL-Speicherung. Standorte, Anlagen, Verbraucher und Zähler mit Ablesungen sind im Kundenkataster und Zähleranlagenbaum erreichbar. Maßnahmen mit PDF-Nachweisen und speicherbare Berichtsvorlagen sind verfügbar. Die ausführliche PDF-/Excel-Berichtserstellung folgt.</p></div></section></>;
}
function Customers({ admin, tenant, afterSave }: { admin: boolean; tenant: string; afterSave: () => Promise<void> }) {
  const cache = useQueryClient();
  const q = useQuery({ queryKey: ['customers'], queryFn: () => api<Customer[]>('/customers/') });
  const [search, setSearch] = useState(''), [edit, setEdit] = useState<Customer | 'new' | null>(null), [detail, setDetail] = useState<Customer | null>(null), [error, setError] = useState<unknown>(null);
  const rows = (q.data ?? []).filter(c => (!tenant || c.id === tenant) && `${c.name} ${c.number} ${c.contact}`.toLowerCase().includes(search.toLowerCase()));
  return <><ErrorBox error={q.error || error}/><section className="panel"><div className="section-heading"><div><h2>{admin ? 'Kundenverzeichnis' : 'Unternehmensübersicht'}</h2><p className="subtle">{rows.length} {rows.length === 1 ? 'Eintrag' : 'Einträge'} · Nur freigegebene Kunden</p></div>{admin && <button className="primary" onClick={() => setEdit('new')}>+ Kunde anlegen</button>}</div><label className="search"><span>Kunden suchen</span><input type="search" placeholder="Firma, Kundennummer oder Kontakt …" value={search} onChange={e => setSearch(e.target.value)}/></label>
      {q.isLoading ? <p role="status">Kunden werden geladen …</p> : <div className="table-scroll"><table><thead><tr><th>Nummer</th><th>Unternehmen</th><th>Ansprechpartner</th><th>Status</th><th><span className="sr-only">Aktionen</span></th></tr></thead><tbody>{rows.map(c => <tr key={c.id}><td className="mono">{c.number}</td><td><strong>{c.name}</strong><small>{c.address || 'Keine Adresse hinterlegt'}</small></td><td>{c.contact || '–'}<small>{c.email}</small></td><td><Badge active={c.isActive}>{c.isActive ? 'Aktiv' : 'Inaktiv'}</Badge></td><td><button className="table-action" onClick={async () => { try { setError(null); setDetail(await api<Customer>(`/customers/${c.id}`)); } catch (e) { setError(e); } }}>Öffnen →</button></td></tr>)}</tbody></table>{!rows.length && <p className="empty">Keine Kunden für diese Auswahl vorhanden.</p>}</div>}</section>
    {detail && <Dialog title={detail.name} onClose={() => setDetail(null)}><dl className="detail-grid">{[['Kundennummer', detail.number], ['Rechtsform', detail.legalForm], ['Anschrift', detail.address], ['Ansprechpartner', detail.contact], ['E-Mail', detail.email], ['Telefon', detail.phone], ['USt-ID', detail.vatId], ['Rechnungsanschrift', detail.billingAddress], ['Vertragsbeginn', detail.contractStart], ...(admin ? [['Interne Bemerkungen', detail.notes]] : [])].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '–'}</dd></div>)}</dl><div className="dialog-actions"><button onClick={() => setDetail(null)}>Schließen</button>{admin && <button className="primary" onClick={() => { setEdit(detail); setDetail(null); }}>Stammdaten bearbeiten</button>}</div></Dialog>}
    {edit && <CustomerForm customer={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await cache.invalidateQueries(); await afterSave(); }}/>}</>;
}
function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ ...(customer ?? emptyCustomer) }), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  const field = (key: keyof typeof emptyCustomer, label: string, required = false, maxLength = 200, type = 'text') => <Field label={label}><input type={type} required={required} maxLength={maxLength} value={String(form[key] ?? '')} onChange={e => setForm({ ...form, [key]: e.target.value || (key === 'contractStart' ? null : '') })}/></Field>;
  return <Dialog title={customer ? 'Kundenstammdaten bearbeiten' : 'Neuen Kunden anlegen'} onClose={onClose}><ErrorBox error={error}/><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); try { await api(customer ? `/customers/${customer.id}` : '/customers/', customer ? 'PUT' : 'POST', form); await onSaved(); } catch (e) { setError(e); } finally { setBusy(false); } }}><div className="form-grid">
    {field('number', 'Kundennummer *', true, 40)}{field('name', 'Firmenname *', true)}{field('legalForm', 'Rechtsform', false, 80)}{field('contact', 'Ansprechpartner', false, 160)}{field('address', 'Anschrift', false, 500)}{field('email', 'E-Mail-Adresse', false, 254, 'email')}{field('phone', 'Telefon', false, 80)}{field('vatId', 'Umsatzsteuer-ID', false, 80)}{field('billingAddress', 'Abweichende Rechnungsanschrift', false, 500)}{field('contractStart', 'Vertragsbeginn', false, 20, 'date')}
    <label className="field full"><span>Interne Bemerkungen</span><textarea maxLength={4000} rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label><label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/>Kunde aktiv</label><label className="checkbox"><input type="checkbox" checked={form.allowUserManagement} onChange={e => setForm({ ...form, allowUserManagement: e.target.checked })}/>Benutzerverwaltung durch Kundenadmin erlauben</label></div>
    <div className="dialog-actions"><button type="button" onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy}>{busy ? 'Speichern …' : 'Kunde speichern'}</button></div></form></Dialog>;
}
function Users({ session, tenant }: { session: Session; tenant: string }) {
  const admin = session.role === 'SystemAdmin';
  const managed = session.customers.filter(c => c.allowUserManagement);
  const selected = admin ? tenant : managed.find(c => c.id === tenant)?.id || managed[0]?.id;
  const cache = useQueryClient();
  const q = useQuery({ queryKey: ['users', selected], queryFn: () => api<User[]>(`/users/${selected ? `?customerId=${selected}` : ''}`) });
  const [edit, setEdit] = useState<User | 'new' | null>(null);
  const [siteUser, setSiteUser] = useState<User | null>(null);
  return <><ErrorBox error={q.error}/><section className="panel"><div className="section-heading"><div><h2>Benutzer und Berechtigungen</h2><p className="subtle">{admin ? 'Zugänge und Kundenzuordnungen verwalten' : managed.find(c => c.id === selected)?.name}</p></div><button className="primary" onClick={() => setEdit('new')}>+ Benutzer anlegen</button></div><div className="table-scroll"><table><thead><tr><th>Benutzer</th><th>Rolle</th><th>Kunden</th><th>Status</th><th><span className="sr-only">Aktionen</span></th></tr></thead><tbody>{q.data?.map(u => <tr key={u.id}><td><strong>{u.name}</strong><small>{u.email}</small></td><td>{roleNames[u.role]}</td><td>{u.customers.join(', ')}</td><td><Badge active={u.isActive}>{u.isActive ? 'Aktiv' : 'Deaktiviert'}</Badge>{u.mustChangePassword && <small>Passwortwechsel ausstehend</small>}</td><td>{(admin || ['CustomerUser', 'Reader'].includes(u.role)) && <button className="table-action" onClick={() => setEdit(u)}>Bearbeiten</button>}{admin && u.role!=='SystemAdmin' && <button className="table-action" onClick={()=>setSiteUser(u)}>Standortfreigaben</button>}</td></tr>)}</tbody></table></div>{q.isLoading && <p role="status">Benutzer werden geladen …</p>}</section>
    {siteUser && <SiteAccessForm user={siteUser} session={session} onClose={()=>setSiteUser(null)}/>}
    {edit && <UserForm user={edit === 'new' ? null : edit} session={session} selected={selected || ''} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); clearCsrf(); await cache.invalidateQueries(); }}/>}</>;
}
function UserForm({ user, session, selected, onClose, onSaved }: { user: User | null; session: Session; selected: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const admin = session.role === 'SystemAdmin';
  const [form, setForm] = useState(user ? { ...user } : { name: '', email: '', role: 'CustomerUser', isActive: true, customerIds: selected ? [selected] : [], sessionVersion: '' });
  const [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  return <Dialog title={user ? 'Benutzer bearbeiten' : 'Benutzer anlegen'} onClose={onClose}><ErrorBox error={error}/>{!user && <div className="notice">Neuer Zugang mit Startpasswort <code>Start_Energie</code>. Der Benutzer muss es bei der ersten Anmeldung ändern.</div>}<form onSubmit={async e => { e.preventDefault(); setError(null); setBusy(true); try { if (!form.customerIds.length) throw new Error('Mindestens einen Kunden auswählen.'); await api(user ? `/users/${user.id}` : '/users/', user ? 'PUT' : 'POST', form); await onSaved(); } catch (e) { setError(e); } finally { setBusy(false); } }}><div className="form-grid"><Field label="Name *"><input required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></Field><Field label="E-Mail-Adresse *"><input type="email" required readOnly={!!user} maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></Field><Field label="Rolle"><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(roleNames).filter(([key]) => admin || ['CustomerUser', 'Reader'].includes(key)).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field><label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/>Benutzer aktiv</label></div>
    <fieldset><legend>Kundenzuordnungen *</legend>{session.customers.filter(c => admin || c.id === selected).map(c => <label key={c.id} className="checkbox"><input type="checkbox" checked={form.customerIds.includes(c.id)} onChange={e => setForm({ ...form, customerIds: e.target.checked ? [...form.customerIds, c.id] : form.customerIds.filter(id => id !== c.id) })}/>{c.name}</label>)}</fieldset><div className="dialog-actions"><button type="button" onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy}>{busy ? 'Speichern …' : 'Benutzer speichern'}</button></div></form></Dialog>;
}
function Activities({ tenant }: { tenant: string }) {
  const q = useQuery({ queryKey: ['audit', tenant], queryFn: () => api<Audit[]>(`/audit${tenant ? `?customerId=${tenant}` : ''}`) });
  return <section className="panel"><div className="section-heading"><div><h2>Zugriffe und Änderungen</h2><p className="subtle">Die letzten 100 Ereignisse · Zeitangaben in Ihrer Browser-Zeitzone</p></div><button onClick={() => q.refetch()}>Aktualisieren</button></div><ErrorBox error={q.error}/><div className="table-scroll"><table><thead><tr><th>Zeitpunkt</th><th>Benutzer</th><th>Aktion</th><th>Ergebnis</th><th>Details</th></tr></thead><tbody>{q.data?.map(a => <tr key={a.id}><td className="nowrap">{date(a.at)}</td><td>{a.actor}</td><td>{a.action}</td><td><Badge active={a.result === 'Erfolgreich'}>{a.result}</Badge></td><td><details><summary>Anzeigen</summary><div className="audit-details"><strong>Datensatz</strong><code>{a.target || '–'}</code><strong>Korrelations-ID</strong><code>{a.correlationId || '–'}</code><pre>{a.details || 'Keine weiteren Angaben'}</pre></div></details></td></tr>)}</tbody></table></div>{q.isLoading && <p role="status">Aktivitäten werden geladen …</p>}</section>;
}
async function start() {
  try { const r = await fetch('/branding.json'); if (r.ok) brand = await r.json(); } catch { /* Local defaults remain usable. */ }
  for (const [key, value] of Object.entries(brand.colors)) document.documentElement.style.setProperty(`--${key}`, value);
  document.title = `${brand.name} · Energiemanagement`;
  createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><InputHints/><App/></QueryClientProvider></React.StrictMode>);
}
void start();
