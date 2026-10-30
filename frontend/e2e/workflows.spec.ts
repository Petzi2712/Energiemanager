import { test, expect } from '@playwright/test';
let password = process.env.E2E_ADMIN_PASSWORD || 'Start_Energie';

for (const viewport of [{ name: 'Desktop', width: 1440, height: 960 }, { name: 'Smartphone', width: 390, height: 844 }]) {
  test(`${viewport.name}: Anmeldung, Kunde anlegen, bearbeiten und abmelden`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
    await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('admin@sysdatiq.local');
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Anmelden →' }).click();
    if (password === 'Start_Energie') {
      await expect(page.getByRole('heading', { name: 'Eigenes Passwort festlegen' })).toBeVisible();
      await page.getByLabel('Startpasswort', { exact: true }).fill(password);
      await page.getByLabel('Neues Passwort', { exact: true }).fill('Browser_Energie_2026!');
      await page.getByLabel('Neues Passwort wiederholen', { exact: true }).fill('Browser_Energie_2026!');
      await page.getByRole('button', { name: 'Passwort speichern und fortfahren' }).click();
      password = 'Browser_Energie_2026!';
    }
    await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
    if (viewport.width < 760) await page.getByRole('button', { name: 'Menü öffnen' }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Kunden', exact: true }).click();
    await page.getByRole('button', { name: '+ Kunde anlegen' }).click();
    const number = `UI-${viewport.name}-${Date.now()}`;
    await page.getByLabel('Kundennummer *', { exact: true }).fill(number);
    await page.getByLabel('Firmenname *', { exact: true }).fill('Browser-Test GmbH');
    await page.getByRole('button', { name: 'Kunde speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('searchbox').fill(number);
    await expect(page.getByRole('table').getByText('Browser-Test GmbH', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Öffnen →' }).click();
    await page.getByRole('button', { name: 'Stammdaten bearbeiten' }).click();
    await page.getByLabel('Ansprechpartner', { exact: true }).fill('Browser-Test Kontakt');
    await page.getByRole('button', { name: 'Kunde speichern', exact: true }).click();
    await expect(page.getByText('Browser-Test Kontakt', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: `../artifacts/${viewport.name.toLowerCase()}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Mein Konto öffnen' }).click();
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Erstanmeldung: Kundenbenutzer muss Passwort ändern und sieht nur seinen Kunden', async ({ page }) => {
  const request = page.request;
  const token = async () => (await (await request.get('/api/auth/csrf')).json()).token;
  const login = await request.post('/api/auth/login', { headers: { 'X-CSRF-TOKEN': await token() }, data: { email: 'admin@sysdatiq.local', password } });
  expect(login.ok()).toBeTruthy();
  const rows = await (await request.get('/api/customers/')).json();
  const own = rows.find((c: { number: string }) => c.number === 'DEMO-001');
  const email = `browser-${Date.now()}@example.test`;
  const create = await request.post('/api/users/', { headers: { 'X-CSRF-TOKEN': await token() }, data: { email, name: 'Browser Erstanmeldung', role: 'CustomerUser', customerIds: [own.id] } });
  expect(create.status()).toBe(201);
  await request.post('/api/auth/logout', { headers: { 'X-CSRF-TOKEN': await token() } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill('Start_Energie');
  await page.getByRole('button', { name: 'Anmelden →' }).click();
  await expect(page.getByRole('heading', { name: 'Eigenes Passwort festlegen' })).toBeVisible();
  expect((await request.get('/api/customers/')).status()).toBe(403);
  await page.getByLabel('Startpasswort', { exact: true }).fill('Start_Energie');
  await page.getByLabel('Neues Passwort', { exact: true }).fill('Kunden_Energie_2026!');
  await page.getByLabel('Neues Passwort wiederholen', { exact: true }).fill('Kunden_Energie_2026!');
  await page.getByRole('button', { name: 'Passwort speichern und fortfahren' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Aktivitäten', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mein Unternehmen', exact: true }).click();
  await expect(page.getByRole('table').getByText(own.name, { exact: true })).toBeVisible();
  await expect(page.getByText('Weserpark Logistik GmbH')).toHaveCount(0);
});
