import { test, expect } from '@playwright/test';
function localAt(days: number, minutes = 0) {
  const d = new Date(Date.now() - days * 86400000 + minutes * 60000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
for (const width of [1440, 390]) {
  test(`Kataster und Zähler: ${width}px – Anlage, Ablesung, Foto, Korrektur und Tausch`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page
      .getByLabel('E-Mail-Adresse', { exact: true })
      .fill('admin@sysdatiq.local');
    await page
      .getByLabel('Passwort', { exact: true })
      .fill(process.env.E2E_ADMIN_PASSWORD || 'Test_Energie_2026!');
    await page.getByRole('button', { name: 'Anmelden →' }).click();
    await expect(
      page.getByRole('heading', { name: 'Übersicht', exact: true }),
    ).toBeVisible();
    if (width < 760)
      await page.getByRole('button', { name: 'Menü öffnen' }).click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Kundenkataster', exact: true })
      .click();
    const customer = page.getByLabel('Kundenauswahl', { exact: true });
    if (await customer.count())
      await customer.selectOption({ label: 'Nordwerk Metalltechnik GmbH' });
    const suffix = `${width}-${Date.now()}`;
    await page
      .getByRole('button', { name: '+ Standort anlegen', exact: true })
      .click();
    await page.getByLabel('ID *', { exact: true }).fill('UI-S-' + suffix);
    await page
      .getByLabel('Bezeichnung *', { exact: true })
      .fill('UI Standort ' + suffix);
    await page
      .getByLabel('Adresse', { exact: true })
      .fill('Teststraße 8, Bremen');
    await page
      .getByRole('button', { name: 'Katastereintrag speichern' })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page
      .getByRole('button', { name: '+ Untereintrag anlegen', exact: true })
      .click();
    await page.getByLabel('ID *', { exact: true }).fill('UI-B-' + suffix);
    await page
      .getByLabel('Bezeichnung *', { exact: true })
      .fill('UI Halle ' + suffix);
    await page
      .getByRole('button', { name: 'Katastereintrag speichern' })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page
      .getByRole('button', { name: '+ Untereintrag anlegen', exact: true })
      .click();
    await page
      .getByLabel('Strukturtyp', { exact: true })
      .selectOption('ConsumerAsset');
    await page.getByLabel('ID *', { exact: true }).fill('UI-V-' + suffix);
    await page
      .getByLabel('Bezeichnung *', { exact: true })
      .fill('UI Beleuchtung ' + suffix);
    await page.getByLabel('Anzahl', { exact: true }).fill('24');
    await page
      .getByLabel('Nenn-/Leuchtmittelleistung je Stück (W)', { exact: true })
      .fill('150');
    await page
      .getByLabel('Betriebsstunden pro Jahr (h)', { exact: true })
      .fill('2000');
    await page
      .getByRole('button', { name: 'Katastereintrag speichern' })
      .click();
    await expect(
      page.locator('.building-chart-card').filter({ has: page.getByRole('heading', { name: 'UI Halle ' + suffix, exact: true }) }).getByText('7.200 kWh/Jahr', { exact: true }),
    ).toBeVisible();
    if (width < 760) await page.getByRole('button', { name: 'Menü öffnen' }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Zähleranlagenbaum', exact: true }).click();
    await page.getByRole('button', { name: '+ Messstelle anlegen', exact: true }).click();
    await page.getByLabel('Zuordnung im Anlagenkataster', { exact: true }).selectOption({ label: 'Hardware / Verbraucher / Erzeuger · UI Beleuchtung ' + suffix });
    await page
      .getByLabel('ID Messstelle *', { exact: true })
      .fill('UI-M-' + suffix);
    await page
      .getByLabel('Messstellenbezeichnung *', { exact: true })
      .fill('UI Stromzähler ' + suffix);
    await page
      .getByLabel('Zählernummer *', { exact: true })
      .fill('UI-G-' + suffix);
    await page.getByLabel('Zählerfaktor', { exact: true }).fill('2');
    await page
      .getByLabel('Einbauzeitpunkt (Browser-Ortszeit)', { exact: true })
      .fill(localAt(2));
    await page
      .getByLabel('Anfangsstand (kWh, optional)', { exact: true })
      .fill('100');
    await page.getByRole('button', { name: 'Messstelle speichern' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'UI Stromzähler ' + suffix,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel('Zählerstand (kWh) *', { exact: true }).fill('120');
    await page
      .getByLabel('Zählerfoto aufnehmen / auswählen (optional, JPEG/PNG)', { exact: true })
      .setInputFiles('e2e/fixtures/meter.png');
    await page
      .getByRole('button', { name: 'Zählerstand speichern', exact: true })
      .click();
    const row = page.getByRole('row').filter({ hasText: '120 kWh' });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole('cell', { name: '40 kWh', exact: true }),
    ).toBeVisible();
    await row.getByRole('button', { name: /Ablesedetails/ }).click();
    await expect(page.getByRole('img', { name: 'meter.jpg', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Korrigieren', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Zählerstand (kWh) *', { exact: true }).fill('125');
    await dialog
      .getByLabel('Begründung (mindestens 5 Zeichen)', { exact: true })
      .fill('Ablesefehler anhand Foto korrigiert');
    await dialog
      .getByRole('button', { name: 'Korrektur speichern', exact: true })
      .click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: '125 kWh' })
        .getByRole('cell', { name: '50 kWh', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Zählertausch erfassen', exact: true })
      .click();
    await dialog
      .getByLabel('Tauschzeitpunkt (Browser-Ortszeit)', { exact: true })
      .fill(localAt(0, 1));
    await dialog
      .getByLabel('Alter Endzählerstand (kWh)', { exact: true })
      .fill('130');
    await dialog
      .getByLabel('Neuer Anfangszählerstand (kWh)', { exact: true })
      .fill('10');
    await dialog
      .getByLabel('Zählernummer *', { exact: true })
      .fill('UI-NEU-' + suffix);
    await dialog
      .getByLabel('Grund / Kommentar zum Zählertausch', { exact: true })
      .fill('Gerät im Browsertest ausgetauscht');
    await dialog
      .getByRole('button', { name: 'Zählertausch speichern', exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByText('UI-NEU-' + suffix, { exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../artifacts/kataster-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
