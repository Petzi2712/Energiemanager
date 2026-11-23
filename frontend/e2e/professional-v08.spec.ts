import { test, expect, type Page } from "@playwright/test";
test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });
async function post(page: Page, path: string, data: unknown) {
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  const r = await page.request.post("/api" + path, {
    data,
    headers: { "X-CSRF-TOKEN": csrf.token },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function nav(page: Page, width: number, name: string) {
  if (width < 760)
    await page.getByRole("button", { name: "Menü öffnen" }).click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
for (const width of [1440, 390])
  test(`Version 0.8 ${width}px: Vergleich, PDF/Excel-Archiv und Erinnerungsplan`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1050 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await post(page, "/auth/login", {
      email: "admin@sysdatiq.local",
      password: process.env.E2E_ADMIN_PASSWORD || "Test_Energie_2026!",
    });
    const tag = width + "-" + Date.now();
    const customer = await post(page, "/customers/", {
      number: "V08-" + tag,
      name: "Auswertung GmbH " + tag,
    });
    const site = (
      await post(page, `/technical/${customer.id}/nodes`, {
        kind: "Site",
        name: "Werk",
        number: "S-" + tag,
      })
    ).node;
    const building = (
      await post(page, `/technical/${customer.id}/nodes`, {
        kind: "Building",
        name: "Halle A",
        number: "B-" + tag,
        parentId: site.id,
      })
    ).node;
    const meter = await post(page, `/meters/?customerId=${customer.id}`, {
      number: "M-" + tag,
      name: "Strom Hauptzähler",
      nodeId: building.id,
      at: "2023-12-31T23:00:00Z",
      initialValue: 0,
      device: { number: "D-" + tag, factor: 2 },
    });
    for (const [at, value] of [
      ["2024-01-31T23:00:00Z", 100],
      ["2024-12-31T23:00:00Z", 200],
      ["2025-01-31T23:00:00Z", 400],
    ])
      await post(page, `/meters/${meter.id}/readings`, { at, value });
    const definition = await post(page, `/reports/${customer.id}/`, {
      name: "Energieanalyse Januar",
      siteId: site.id,
      from: "2025-01-01",
      to: "2025-01-31",
    });
    await page.goto("/");
    await page
      .getByLabel("Kundenauswahl", { exact: true })
      .selectOption(customer.id);
    await nav(page, width, "Auswertungen");
    for (const [label, value] of [
      ["Zeitraum von", "2025-01-01"],
      ["Zeitraum bis", "2025-01-31"],
      ["Vergleich von", "2024-01-01"],
      ["Vergleich bis", "2024-01-31"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByText("Bezugsgrößen und Kennzahlen", { exact: true })
      .click();
    await page.getByLabel("Fläche aktuell (m²)", { exact: true }).fill("100");
    await page.getByLabel("Fläche Vergleich (m²)", { exact: true }).fill("50");
    await page
      .getByLabel("Quelle und Gültigkeit der Bezugsgrößen", { exact: true })
      .fill("Flächenplan für beide Berichtszeiträume");
    await page
      .getByRole("button", { name: "Auswertung berechnen", exact: true })
      .click();
    await expect(page.locator(".comparison-numbers")).toContainText("400 kWh");
    await expect(page.locator(".comparison-numbers")).toContainText("200 kWh");
    await expect(
      page.getByRole("heading", { name: "Datenqualität", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".quality-summary")).toContainText(
      "Ablesungen fällig",
    );
    expect(
      await page
        .locator(".month-grid")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `../artifacts/v08/auswertungen-${width}.png`,
      fullPage: true,
    });
    await nav(page, width, "Berichte");
    await page
      .getByLabel("Vorlage für Berichtserstellung", { exact: true })
      .selectOption(definition.id);
    await page
      .getByRole("button", {
        name: "Neue Berichtsversion erstellen",
        exact: true,
      })
      .click();
    const archive = page.locator(".report-archive");
    await expect(
      archive.getByRole("heading", {
        name: "Energieanalyse Januar · v1",
        exact: true,
      }),
    ).toBeVisible();
    for (const [name, signature] of [
      ["PDF herunterladen", "%PDF"],
      ["Excel herunterladen", "PK"],
    ]) {
      const download = page.waitForEvent("download");
      await archive.getByRole("button", { name, exact: true }).click();
      const file = await download;
      expect(await file.failure()).toBeNull();
      const stream = await file.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      expect(
        Buffer.concat(chunks).subarray(0, signature.length).toString(),
      ).toBe(signature);
    }
    await archive
      .getByRole("button", { name: "Datenstand ansehen", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("400 kWh");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Dialog schließen", exact: true })
      .click();
    await archive
      .getByRole("button", { name: "Version freigeben", exact: true })
      .click();
    await page
      .getByLabel("Begründung der Freigabe", { exact: true })
      .fill("Zahlen und Datenqualität im Test geprüft");
    await page
      .getByRole("button", { name: "Freigabe dokumentieren", exact: true })
      .click();
    await expect(
      archive.getByRole("heading", {
        name: "Energieanalyse Januar · v2",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      archive.getByText("Freigegeben", { exact: true }),
    ).toBeVisible();
    const reminder = page
      .locator("section.panel")
      .filter({
        has: page.getByRole("heading", {
          name: "Automatische Ableseerinnerungen",
          exact: true,
        }),
      });
    await reminder
      .getByRole("checkbox", { name: "Erinnerungen aktivieren", exact: true })
      .check();
    await reminder.getByRole("checkbox").nth(1).check();
    await reminder
      .getByRole("button", { name: "Erinnerungsplan speichern", exact: true })
      .click();
    await expect(reminder).toContainText("Erinnerungsplan gespeichert.");
    await reminder
      .getByRole("button", {
        name: "Fällige Erinnerungen jetzt planen",
        exact: true,
      })
      .click();
    await expect(reminder).toContainText("2 neue Aufträge geplant.");
    await reminder
      .getByRole("button", {
        name: "Versandwarteschlange verarbeiten",
        exact: true,
      })
      .click();
    await expect(reminder).toContainText("1 Nachrichten von SMTP angenommen.");
    await reminder
      .getByRole("button", {
        name: "Fällige Erinnerungen jetzt planen",
        exact: true,
      })
      .click();
    await expect(reminder).toContainText("0 neue Aufträge geplant.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `../artifacts/v08/berichte-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
