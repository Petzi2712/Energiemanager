import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
async function post(page: Page, path: string, data: unknown) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const r = await page.request.post('/api' + path, { headers: { 'X-CSRF-TOKEN': csrf.token }, data });
  expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
}
async function nav(page: Page, width: number, name: string) {
  if (width < 760) await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
async function local(page: Page, at: string) {
  return page.evaluate(at => { const d = new Date(at); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }, at);
}
for (const width of [1440, 390]) {
  test(`Version 0.5 ${width}px: Komponenten, Kopie, kompakte Historie und CSV`, async ({ page }) => {
    test.setTimeout(90000); await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await post(page, '/auth/login', { email: 'admin@sysdatiq.local', password: process.env.E2E_ADMIN_PASSWORD || 'Test_Energie_2026!' });
    const customer = (await (await page.request.get('/api/customers/')).json()).find((c: { number: string }) => c.number === 'DEMO-001');
    const suffix = `${width}-${Date.now()}`;
    const node = async (body: object) => (await post(page, `/technical/${customer.id}/nodes`, { number: crypto.randomUUID().slice(0, 12), ...body })).node;
    const site = await node({ name: 'V05 Standort ' + suffix, kind: 'Site' });
    const building = await node({ name: 'V05 Gebäude ' + suffix, kind: 'Building', parentId: site.id });
    const group = await node({ name: 'V05 Anlage ' + suffix, kind: 'Area', parentId: building.id });
    const a = await node({ name: 'V05 LED ' + suffix, kind: 'ConsumerAsset', parentId: group.id, annualEnergyValue: 1000 });
    const b = await node({ name: 'V05 Maschine ' + suffix, kind: 'ConsumerAsset', parentId: group.id, annualEnergyValue: 2000 });
    const now = new Date(); const initial = new Date(now.getTime() - 60 * 86400000);
    const p = await post(page, '/meters/?customerId=' + customer.id, { number: 'P-' + suffix, name: 'V05 Zähler ' + suffix, nodeId: building.id, at: initial.toISOString(), initialValue: 0, device: { number: 'D-' + suffix } });
    const dates: string[] = [];
    let lastReading;
    for (let value = 1; value <= 31; value++) { const at = new Date(now.getTime() - 50 * 86400000 + value * 3600000).toISOString(); dates[value] = at; lastReading = await post(page, `/meters/${p.id}/readings`, { at, value }); }
    const token = await (await page.request.get('/api/auth/csrf')).json();
    const upload = await page.request.post(`/api/documents?readingId=${lastReading.id}`, { headers: { 'X-CSRF-TOKEN': token.token }, multipart: { file: { name: 'proof.png', mimeType: 'image/png', buffer: readFileSync('e2e/fixtures/meter.png') } } });
    expect(upload.ok()).toBeTruthy();
    await page.goto('/'); await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
    await page.getByLabel('Kundenauswahl', { exact: true }).selectOption(customer.id);
    await nav(page, width, 'Kundenkataster');
    await page.getByRole('button', { name: new RegExp('V05 Anlage ' + suffix) }).click();
    await page.getByRole('button', { name: 'Stammdaten bearbeiten', exact: true }).click();
    await expect(page.getByLabel('ID *', { exact: true })).toHaveValue(group.number);
    await expect(page.getByLabel('Nummer *', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await page.getByRole('button', { name: 'Eintrag kopieren', exact: true }).click();
    await page.getByLabel('Neue ID *', { exact: true }).fill('COPY-' + suffix);
    await page.getByLabel('Bezeichnung der Kopie *', { exact: true }).fill('V05 Kopie ' + suffix);
    await page.getByRole('button', { name: 'Kopie anlegen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'V05 Kopie ' + suffix, exact: true })).toBeVisible();
    await page.getByRole('button', { name: new RegExp('V05 Gebäude ' + suffix) }).click();
    await expect(page.locator('.theory-total')).toContainText('6.000 kWh/Jahr');
    await page.getByRole('spinbutton', { name: `Einsparung (%): ${a.name} · ${a.number}`, exact: true }).fill('10');
    await page.getByRole('spinbutton', { name: `Einsparung (%): ${b.name} · ${b.number}`, exact: true }).fill('25');
    await expect(page.getByTestId('component-savings')).toHaveText('600 kWh/Jahr');
    await page.getByRole('button', { name: 'Auswahl aufheben' }).click();
    await expect(page.getByTestId('component-savings')).toHaveText('0 kWh/Jahr');
    await page.getByRole('checkbox', { name: `Komponente auswählen: ${a.name} · ${a.number}`, exact: true }).check();
    await expect(page.getByTestId('component-savings')).toHaveText('100 kWh/Jahr');
    await page.getByRole('checkbox', { name: `Komponente auswählen: ${b.name} · ${b.number}`, exact: true }).check();
    await page.getByRole('button', { name: 'Einsparannahmen speichern' }).click();
    await expect(page.getByRole('status')).toContainText('Einsparannahmen gespeichert');
    await page.getByRole('checkbox', { name: 'Diagramm mit angenommener Einsparung anzeigen', exact: true }).check();
    await page.locator('.savings-scenario').screenshot({ path: `../artifacts/komponenten-${width}.png` });
    await nav(page, width, 'Zähleranlagenbaum');
    await page.getByRole('button', { name: new RegExp('V05 Zähler ' + suffix) }).click();
    await page.getByRole('button', { name: 'Messstelle bearbeiten', exact: true }).click();
    await expect(page.getByLabel('ID Messstelle *', { exact: true })).toHaveValue(p.number);
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    const history = page.locator('.reading-history-panel');
    const rows = history.locator('tbody > tr:not(.reading-expanded)');
    await expect(rows).toHaveCount(15);
    await expect(history.getByRole('columnheader', { name: 'Nachweis', exact: true })).toHaveCount(0);
    await expect(history.getByRole('img')).toHaveCount(0);
    await rows.first().getByRole('button', { name: /Ablesedetails/ }).click();
    await expect(history.getByRole('img', { name: 'proof.jpg', exact: true })).toBeVisible();
    await rows.first().getByRole('button', { name: /Ablesedetails/ }).click();
    await expect(history.getByRole('img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nächste 15', exact: true }).click();
    await expect(history).toContainText('Seite 2 von 3'); await expect(rows).toHaveCount(15);
    await page.getByRole('button', { name: 'Nächste 15', exact: true }).click();
    await expect(history).toContainText('Seite 3 von 3'); await expect(rows).toHaveCount(2);
    await page.getByLabel('Historie von (Browser-Ortszeit)', { exact: true }).fill(await local(page, dates[10]));
    await page.getByLabel('Historie bis (Browser-Ortszeit)', { exact: true }).fill(await local(page, dates[13]));
    await page.getByRole('button', { name: 'Historienzeitraum übernehmen' }).click();
    await expect(rows).toHaveCount(4); await expect(history).toContainText('Seite 1 von 1');
    await page.getByRole('button', { name: 'Gesamter Zeitraum', exact: true }).click(); await expect(rows).toHaveCount(15);
    await history.screenshot({ path: `../artifacts/historie-kompakt-${width}.png` });
    const from = page.getByLabel('Beginn (Browser-Ortszeit)', { exact: true }), to = page.getByLabel('Ende (Browser-Ortszeit)', { exact: true });
    const values = { from: await from.inputValue(), to: await to.inputValue() };
    expect(values.from < values.to).toBeTruthy();
    expect(await page.evaluate(v => new Date(v.to).getTime() - new Date(v.from).getTime(), values)).toBe(30 * 86400000);
    await expect(from).toHaveAttribute('name', 'balanceFrom'); await expect(to).toHaveAttribute('name', 'balanceTo');
    await page.getByRole('button', { name: 'Excel-Vorlage / Import', exact: true }).click();
    await expect(page.getByLabel('Ausgefüllte Excel-/CSV-Dateien / ZIP auswählen', { exact: true })).toHaveAttribute('accept', '.xlsx,.xlsm,.csv,.zip');
    const at = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0,19) + 'Z';
    await page.getByLabel('Ausgefüllte Excel-/CSV-Dateien / ZIP auswählen', { exact: true }).setInputFiles({ name: 'ablesung.csv', mimeType: 'text/csv', buffer: Buffer.from(`Datum;Zählerstand\r\n${at};100\r\n`) });
    await page.getByRole('button', { name: 'Dateien prüfen', exact: true }).click();
    await expect(page.getByText('1 neue Werte · 0 identische Werte · 0 Fehler · 0 Grenzwertwarnungen')).toBeVisible();
    await page.getByRole('button', { name: 'Geprüfte Ablesungen importieren' }).click();
    await expect(page.getByRole('status')).toContainText('1 Ablesungen gespeichert');
    await page.getByRole('button', { name: 'Dialog schließen' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); expect(errors).toEqual([]);
  });
}
