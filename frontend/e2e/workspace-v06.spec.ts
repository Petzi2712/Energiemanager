import { test, expect, type Page } from "@playwright/test";
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
  test(`Version 0.6 ${width}px: Gebäude, Maßnahme, PDF, Löschen, Berichte und Eingabehilfen`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1050 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await post(page, "/auth/login", {
      email: "admin@sysdatiq.local",
      password: process.env.E2E_ADMIN_PASSWORD || "Test_Energie_2026!",
    });
    const tag = `${width}-${Date.now()}`;
    const customer = await post(page, "/customers/", {
      number: "V06-" + tag,
      name: "V06 Testbetrieb " + tag,
    });
    const node = async (body: object) =>
      (
        await post(page, `/technical/${customer.id}/nodes`, {
          number: crypto.randomUUID().slice(0, 10),
          ...body,
        })
      ).node;
    const site = await node({ name: "V06 Standort", kind: "Site" });
    const a = await node({
      name: "V06 Halle A",
      kind: "Building",
      parentId: site.id,
    });
    const b = await node({
      name: "V06 Halle B",
      kind: "Building",
      parentId: site.id,
    });
    const lamp = await node({
      name: "V06 Beleuchtung",
      kind: "ConsumerAsset",
      parentId: a.id,
      annualEnergyValue: 1000,
      savingsPercent: 10,
    });
    await node({
      name: "V06 Maschine",
      kind: "ConsumerAsset",
      parentId: b.id,
      annualEnergyValue: 2000,
    });
    const temporary = await node({
      name: "V06 Ausbaugerät",
      kind: "ConsumerAsset",
      parentId: a.id,
      annualEnergyValue: 50,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Übersicht", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Kundenauswahl", { exact: true })
      .selectOption(customer.id);
    if (width < 760)
      await page.getByRole("button", { name: "Menü öffnen" }).click();
    const labels = await page
      .getByRole("navigation", { name: "Hauptnavigation" })
      .getByRole("button")
      .allTextContents();
    expect(
      labels.findIndex((x) => x.includes("Zähleranlagenbaum")),
    ).toBeLessThan(labels.findIndex((x) => x.includes("Fuhrpark")));
    expect(labels.findIndex((x) => x.includes("Berichte"))).toBe(
      labels.findIndex((x) => x.includes("Fuhrpark")) + 1,
    );
    await expect(
      page
        .getByRole("navigation")
        .getByRole("button", { name: "Mein Konto", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".sidebar-bottom")
        .getByRole("button", { name: "Mein Konto", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Kundenkataster", exact: true })
      .click();
    await expect(page.locator(".building-chart-card")).toHaveCount(3);
    await expect(page.getByLabel("Diagrammart", { exact: true })).toHaveValue(
      "Donut",
    );
    const overall = page.locator(
      `.building-chart-card[data-building-id="${customer.id}"]`,
    );
    await expect(overall).toContainText("3.050 kWh/Jahr");
    await expect(
      overall.getByRole("img", {
        name: "Ringdiagramm der theoretischen Jahresbilanz",
      }),
    ).toBeVisible();
    await expect(
      page.locator(`.building-chart-card[data-building-id="${a.id}"]`),
    ).toContainText("1.050 kWh/Jahr");
    await expect(
      page.locator(`.building-chart-card[data-building-id="${b.id}"]`),
    ).toContainText("2.000 kWh/Jahr");
    if (width === 1440) {
      const boxes = await page
        .locator(".building-chart-card")
        .evaluateAll((xs) =>
          xs.slice(0, 2).map((x) => x.getBoundingClientRect().top),
        );
      expect(Math.abs(boxes[0] - boxes[1])).toBeLessThan(2);
    }
    await page.getByRole("button", { name: /V06 Halle A/ }).click();
    await page.getByLabel("Verbrauch aufschlüsseln nach", { exact: true }).selectOption("category");
    await expect(page.locator(`.building-chart-card[data-building-id="${a.id}"]`)).toContainText("Sonstige Hardware");
    await page.getByLabel("Verbrauch aufschlüsseln nach", { exact: true }).selectOption("name");
    await expect(page.locator(`.building-chart-card[data-building-id="${a.id}"]`)).toContainText("V06 Beleuchtung");
    await page.locator(".building-chart-grid").screenshot({ path: `../artifacts/gebaeudebilanzen-${width}.png` });
    const measure = page.getByRole("checkbox", {
      name: `Maßnahme umgesetzt: ${lamp.name} · ${lamp.number}`,
      exact: true,
    });
    await measure.check();
    await page
      .getByLabel(`Maßnahmenbeschreibung: ${lamp.name}`, { exact: true })
      .fill("LED-Tausch abgeschlossen. Abnahme am Standort dokumentiert.");
    await page
      .getByLabel("PDF-Bericht hinzufügen (max. 6 MB)", { exact: true })
      .setInputFiles({
        name: "abnahme.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
        ),
      });
    await expect(
      page.locator(".measure-panel").getByRole("link", { name: /abnahme.pdf/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Maßnahme speichern", exact: true })
      .click();
    await expect(page.locator(".measure-panel")).toHaveCount(0);
    await expect(measure).toBeChecked();
    await page
      .getByRole("button", {
        name: `Maßnahme aufklappen: ${lamp.name} · ${lamp.number}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel(`Maßnahmenbeschreibung: ${lamp.name}`, { exact: true }),
    ).toHaveValue(/LED-Tausch/);
    await expect(
      page.locator(".measure-panel").getByRole("link", { name: /abnahme.pdf/ }),
    ).toBeVisible();
    await page
      .locator(".structure-tree")
      .getByRole("button", { name: /V06 Ausbaugerät/ })
      .click();
    await page
      .getByRole("button", { name: "Katastereintrag löschen", exact: true })
      .click();
    await page
      .getByLabel("Löschgrund", { exact: true })
      .fill("Gerät dauerhaft ausgebaut");
    await page
      .getByRole("button", { name: "Löschen bestätigen", exact: true })
      .click();
    await expect(
      page
        .locator(".structure-tree")
        .getByRole("button", { name: /V06 Ausbaugerät/ }),
    ).toHaveCount(0);
    await expect(overall).toContainText("3.000 kWh/Jahr");
    await nav(page, width, "Berichte");
    await page
      .getByRole("button", { name: "+ Berichtsvorlage anlegen", exact: true })
      .click();
    const name = page.getByLabel("Bezeichnung der Berichtsvorlage *", {
      exact: true,
    });
    await expect(name).toHaveAttribute(
      "title",
      /Bezeichnung|Bezeichnung|Aussagekräftige/,
    );
    await page
      .getByRole("button", {
        name: "Eingabehilfe: Bezeichnung der Berichtsvorlage *",
        exact: true,
      })
      .hover();
    await expect(
      page
        .getByRole("tooltip")
        .filter({ hasText: "Aussagekräftige Bezeichnung" }),
    ).toBeVisible();
    await name.fill("Jahresbericht Halle A");
    await page
      .getByLabel("Standort für Bericht", { exact: true })
      .selectOption(site.id);
    await page
      .getByLabel("Gebäude für Bericht", { exact: true })
      .selectOption(a.id);
    await page
      .getByLabel("Anlage für Bericht", { exact: true })
      .selectOption(lamp.id);
    await page
      .getByLabel("Medium für Bericht", { exact: true })
      .selectOption("Electricity");
    await page
      .getByLabel("Individuelle Berichtshinweise", { exact: true })
      .fill("Verbrauch und Maßnahmen für die Beleuchtung analysieren.");
    const missing = await page
      .getByRole("dialog")
      .locator("input,select,textarea")
      .evaluateAll(
        (xs) => xs.filter((x) => !(x as HTMLInputElement).title).length,
      );
    expect(missing).toBe(0);
    await page
      .getByRole("button", { name: "Berichtsvorlage speichern", exact: true })
      .click();
    await expect(page.locator(".report-card")).toContainText(
      "Jahresbericht Halle A",
    );
    await expect(page.locator(".report-card")).toContainText("V06 Beleuchtung");
    await nav(page, width, "Kundenkataster");
    await nav(page, width, "Berichte");
    await expect(page.locator(".report-card")).toHaveCount(1);
    await page
      .locator(".reports-panel")
      .screenshot({ path: `../artifacts/berichte-${width}.png` });
    if (width < 760)
      await page.getByRole("button", { name: "Menü öffnen" }).click();
    await page
      .locator(".sidebar-bottom")
      .getByRole("button", { name: "Mein Konto", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Mein Konto", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
