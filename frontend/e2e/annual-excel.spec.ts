import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

async function post(page: Page, path: string, data: unknown) {
  const csrf = await (await page.request.get('/api/auth/csrf')).json();
  const r = await page.request.post('/api' + path, { headers: { 'X-CSRF-TOKEN': csrf.token }, data });
  expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
}
async function nav(page: Page, width: number, name: string) {
  if (width < 760) await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
}
function fillExcel(source: string, target: string, zip = false) {
  execFileSync(process.env.PYTHON_PATH || 'python3', ['-c', `
import sys,datetime as dt,zipfile,io
from pathlib import Path
sys.path.insert(0,sys.argv[3])
from test_excel import filled,bundle
now=dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
def values(v,bulk=False):return {'A15':(now-(dt.timedelta(hours=12) if bulk else dt.timedelta(days=2))).isoformat(),'B15':v,'A16':(now-(dt.timedelta(hours=6) if bulk else dt.timedelta(days=1))).isoformat(),'B16':v+25}
raw=Path(sys.argv[1]).read_bytes()
if sys.argv[4]=='zip':
 with zipfile.ZipFile(io.BytesIO(raw)) as z:raw=bundle([(name,filled(z.read(name),values(200+i*100,True))) for i,name in enumerate(z.namelist())])
else:raw=filled(raw,values(125))
Path(sys.argv[2]).write_bytes(raw)
`, source, target, resolve('../tests'), zip ? 'zip' : 'xlsx']);
}
for (const width of [1440, 390]) {
  test(`Jahresbilanz und Excel ${width}px: Diagramme, Einzel- und Sammelimport`, async ({ page }) => {
    test.setTimeout(90000); await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await post(page, '/auth/login', { email: 'admin@sysdatiq.local', password: process.env.E2E_ADMIN_PASSWORD || 'Test_Energie_2026!' });
    const customer = (await (await page.request.get('/api/customers/')).json()).find((c: { number: string }) => c.number === 'DEMO-001');
    const suffix = `${width}-${Date.now()}`;
    const node = async (body: object) => (await post(page, `/technical/${customer.id}/nodes`, { number: crypto.randomUUID().slice(0, 14), ...body })).node;
    const site = await node({ kind: 'Site', name: 'UI Bilanzstandort ' + suffix });
    const building = await node({ kind: 'Building', parentId: site.id, name: 'UI Bilanzgebäude ' + suffix });
    await node({ kind: 'ConsumerAsset', parentId: building.id, name: 'UI LED ' + suffix, assetType: 'Beleuchtung', quantity: 24, ratedPowerW: 150, annualHours: 2000 });
    await node({ kind: 'ConsumerAsset', parentId: building.id, name: 'UI Maschine ' + suffix, assetType: 'Maschinen', annualEnergyValue: 2.8, annualEnergyUnit: 'MWh' });
    await node({ kind: 'ConsumerAsset', parentId: building.id, name: 'UI PV ' + suffix, assetType: 'PV', assetRole: 'Generation', annualEnergyValue: 5000 });
    const meters = [];
    for (const i of [1, 2]) meters.push(await post(page, '/meters/?customerId=' + customer.id, { number: 'XLS-' + suffix + '-' + i, name: 'UI Excelzähler ' + suffix + '-' + i, nodeId: building.id, at: new Date(Date.now() - 20 * 86400000).toISOString(), device: { number: 'EX-' + suffix + '-' + i }, initialValue: 0 }));
    await page.goto('/'); await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
    await page.getByLabel('Kundenauswahl', { exact: true }).selectOption(customer.id);
    await nav(page, width, 'Kundenkataster');
    await page.getByRole('button', { name: new RegExp('UI Bilanzgebäude ' + suffix) }).click();
    await expect(page.locator('.theory-total')).toContainText('10.000 kWh/Jahr');
    await expect(page.getByLabel('Diagrammart', { exact: true })).toHaveValue('Donut');
    await expect(page.locator('.building-chart-grid .theory-hole').first()).toBeVisible();
    await page.getByLabel('Diagrammart', { exact: true }).selectOption('Bar');
    await expect(page.locator('.building-chart-grid').getByRole('img', { name: 'Balkendiagramm der theoretischen Jahresbilanz' }).first()).toBeVisible();
    await page.getByLabel('Diagrammart', { exact: true }).selectOption('Donut');
    await page.getByLabel('Verbrauch aufschlüsseln nach', { exact: true }).selectOption('name');
    await page.locator('.building-chart-grid .theory-chart').first().screenshot({ path: `../artifacts/theory-${width}.png` });
    await page.getByRole('button', { name: '+ Untereintrag anlegen', exact: true }).click();
    await page.getByLabel('Strukturtyp', { exact: true }).selectOption('ConsumerAsset');
    await page.getByLabel('ID *', { exact: true }).fill('J-' + suffix);
    await page.getByLabel('Bezeichnung *', { exact: true }).fill('UI Jahresbedarf ' + suffix);
    await page.getByLabel('Vorgegebene Jahresmenge (optional)', { exact: true }).fill('5000');
    await page.getByRole('button', { name: 'Katastereintrag speichern', exact: true }).click();
    await expect(page.getByText('5.000 kWh/Jahr', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: new RegExp('UI Bilanzgebäude ' + suffix) }).click();
    await expect(page.locator('.theory-total')).toContainText('15.000 kWh/Jahr');
    await nav(page, width, 'Zähleranlagenbaum');
    await page.locator('.structure-tree').getByRole('button', { name: new RegExp('UI Excelzähler ' + suffix + '-1') }).click();
    await page.getByRole('button', { name: 'Excel-Vorlage / Import', exact: true }).click();
    const firstDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Excel-Vorlage herunterladen', exact: true }).click();
    const workbook = await firstDownload; expect(workbook.suggestedFilename()).toContain('XLS-');
    const source = resolve(`../artifacts/template-${suffix}.xlsx`), target = resolve(`../artifacts/filled-${suffix}.xlsx`);
    await workbook.saveAs(source); fillExcel(source, target);
    await page.getByLabel('Ausgefüllte Excel-/CSV-Dateien / ZIP auswählen', { exact: true }).setInputFiles(target);
    await page.getByRole('button', { name: 'Dateien prüfen', exact: true }).click();
    await expect(page.getByText('2 neue Werte · 0 identische Werte · 0 Fehler · 0 Grenzwertwarnungen')).toBeVisible();
    await page.getByRole('button', { name: 'Geprüfte Ablesungen importieren', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('2 Ablesungen gespeichert');
    await page.getByRole('button', { name: 'Dialog schließen' }).click();
    await expect(page.getByRole('cell', { name: '150 kWh', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Excel-Massendownload / Import', exact: true }).click();
    await page.getByLabel('Alle auswählen (maximal 100)', { exact: true }).uncheck();
    for (const i of [1, 2]) await page.getByRole('checkbox', { name: new RegExp('UI Excelzähler ' + suffix + '-' + i) }).check();
    const zipDownload = page.waitForEvent('download'); await page.getByRole('button', { name: '2 Vorlagen als ZIP herunterladen', exact: true }).click();
    const archive = await zipDownload; const zipSource = resolve(`../artifacts/templates-${suffix}.zip`), zipTarget = resolve(`../artifacts/filled-${suffix}.zip`);
    await archive.saveAs(zipSource); fillExcel(zipSource, zipTarget, true);
    // Beide Dateien enthalten weitere Ablesungen nach den bisher importierten Ständen.
    await page.getByLabel('Ausgefüllte Excel-/CSV-Dateien / ZIP auswählen', { exact: true }).setInputFiles(zipTarget);
    await page.getByRole('button', { name: 'Dateien prüfen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Importvorschau', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Geprüfte Ablesungen importieren' })).toBeEnabled();
    await page.getByRole('button', { name: 'Geprüfte Ablesungen importieren' }).click();
    await expect(page.getByRole('status')).toContainText('4 Ablesungen gespeichert');
    await page.getByRole('button', { name: 'Dialog schließen' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
