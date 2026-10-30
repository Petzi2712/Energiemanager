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
  test(`Version 0.7 ${width}px: Jahreskacheln, Gesamtsumme, passendes Diagramm und neutraler Prompt`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 1050 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await post(page, "/auth/login", {
      email: "admin@sysdatiq.local",
      password: process.env.E2E_ADMIN_PASSWORD || "Test_Energie_2026!",
    });
    const tag = `${width}-${Date.now()}`;
    const customer = await post(page, "/customers/", {
      number: "SECRET-" + tag,
      name: "Vertraulicher Kunde " + tag,
      address: "Geheimstraße 99",
      contact: "Geheime Person",
      email: "geheim@example.test",
    });
    const node = async (body: object) =>
      (
        await post(page, `/technical/${customer.id}/nodes`, {
          number: crypto.randomUUID().slice(0, 10),
          ...body,
        })
      ).node;
    const site = await node({ kind: "Site", name: "Vertraulicher Standort" }),
      a = await node({
        kind: "Building",
        parentId: site.id,
        name: "Geheime Halle A",
      }),
      b = await node({
        kind: "Building",
        parentId: site.id,
        name: "Geheime Halle B",
      });
    const year = new Date().getUTCFullYear();
    const start = `${year - 1}-12-31T23:00:00Z`;
    const now = Date.now(),
      first = new Date(now - 15 * 86400000).toISOString(),
      last = new Date(now - 86400000).toISOString();
    const meter = async (
      name: string,
      nodeId: string,
      parentPointId: string | null = null,
      factor = 1,
    ) =>
      post(page, "/meters/?customerId=" + customer.id, {
        number: crypto.randomUUID().slice(0, 12),
        name,
        nodeId,
        parentPointId,
        at: start,
        initialValue: 0,
        device: {
          number: "PRIVATE-DEVICE-" + crypto.randomUUID().slice(0, 8),
          factor,
        },
        notes: "Privater Hinweis",
      });
    const main = await meter("Privater Hauptzähler", a.id, null, 2),
      child = await meter("Privater Unterzähler", a.id, main.id),
      other = await meter("Privater Nebenzähler", b.id);
    for (const [p, v] of [
      [main, 100],
      [child, 40],
      [other, 20],
    ] as const)
      await post(page, `/meters/${p.id}/readings`, {
        at: first,
        value: v,
        comment: "Privater Kommentar",
      });
    for (const [p, v] of [
      [main, 150],
      [child, 60],
      [other, 40],
    ] as const)
      await post(page, `/meters/${p.id}/readings`, { at: last, value: v });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Übersicht", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Kundenauswahl", { exact: true })
      .selectOption(customer.id);
    await nav(page, width, "Zähleranlagenbaum");
    const totals = page.locator(".meter-total-grid");
    await expect(totals).toContainText("340 kWh");
    await expect(page.locator(".meter-tile")).toHaveCount(3);
    const tile = page
      .locator(".meter-tile")
      .filter({ has: page.getByText("Privater Hauptzähler", { exact: true }) });
    await expect(tile).toContainText("150 kWh");
    await expect(tile).toContainText("300 kWh");
    await page
      .locator(".structure-tree")
      .getByRole("button", { name: /Vertraulicher Standort/ })
      .click();
    await expect(totals).toContainText("340 kWh");
    await page
      .locator(".structure-tree")
      .getByRole("button", { name: /Geheime Halle A/ })
      .click();
    await expect(totals).toContainText("300 kWh");
    await expect(page.locator(".meter-tile")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Gesamter Zählerbestand", exact: true })
      .click();
    await expect(totals).toContainText("340 kWh");
    await page
      .locator(".meter-overview")
      .screenshot({ path: `../artifacts/jahreskacheln-${width}.png` });
    await page
      .locator(".structure-tree")
      .getByRole("button", { name: /Privater Hauptzähler/ })
      .click();
    expect(
      await page
        .locator(".consumption-panel")
        .evaluate(
          (e) =>
            !!(
              e.compareDocumentPosition(
                document.querySelector(".reading-history-panel")!,
              ) & Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
    ).toBeTruthy();
    await expect(page.locator(".consumption-config")).not.toHaveAttribute(
      "open",
      "",
    );
    await expect(
      page.getByLabel("Beginn (Browser-Ortszeit)", { exact: true }),
    ).not.toBeVisible();
    const chart = page.locator(".chart-responsive");
    await expect(chart.getByRole("img")).toBeVisible();
    expect(
      await chart.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBeTruthy();
    expect(
      await chart
        .getByRole("img")
        .evaluate(
          (e) =>
            e.getBoundingClientRect().width <=
            e.parentElement!.getBoundingClientRect().width + 1,
        ),
    ).toBeTruthy();
    await page.locator(".consumption-config > summary").click();
    await page
      .getByLabel("Balken gruppieren nach", { exact: true })
      .selectOption("Month");
    await page
      .getByRole("button", { name: "Zeitraum übernehmen", exact: true })
      .click();
    await expect(page.locator(".consumption-config")).not.toHaveAttribute(
      "open",
      "",
    );
    await expect(
      page.getByRole("img", { name: /Balkendiagramm des Verbrauchs/ }),
    ).toBeVisible();
    await page
      .locator(".consumption-panel")
      .screenshot({ path: `../artifacts/verbrauch-passend-${width}.png` });
    await nav(page, width, "Berichte");
    await expect(
      page.getByLabel("Neutraler KI-Prompt", { exact: true }),
    ).toHaveCount(0);
    const external: string[] = [];
    const listener = (r: { url: () => string }) => {
      if (
        !r
          .url()
          .startsWith(
            new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:5188").origin,
          )
      )
        external.push(r.url());
    };
    page.on("request", listener);
    await page
      .getByRole("button", { name: "Analyseprompt erstellen", exact: true })
      .click();
    const prompt = page.getByLabel("Neutraler KI-Prompt", { exact: true });
    await expect(prompt).toBeVisible();
    const value = await prompt.inputValue();
    expect(value).toContain("Messstelle 001");
    expect(value).toContain("Monatliche Gesamtreihe");
    for (const privateValue of [
      customer.name,
      customer.number,
      customer.id,
      site.name,
      site.id,
      main.name,
      main.number,
      main.id,
      "Geheimstraße",
      "Geheime Person",
      "Privater Kommentar",
      "Privater Hinweis",
    ])
      expect(value).not.toContain(privateValue);
    await page
      .getByRole("button", { name: "Prompt kopieren", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Zwischenablage kopiert" }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      value,
    );
    expect(external).toEqual([]);
    page.off("request", listener);
    await page
      .locator(".analysis-prompt")
      .screenshot({ path: `../artifacts/analyseprompt-${width}.png` });
    await page
      .getByLabel("Standort für KI-Analyse", { exact: true })
      .selectOption(site.id);
    await expect(prompt).toHaveCount(0);
    await page
      .getByLabel("Gebäude für KI-Analyse", { exact: true })
      .selectOption(b.id);
    await page
      .getByRole("button", { name: "Analyseprompt erstellen", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "1 Messstellen" }),
    ).toBeVisible();
    expect(await prompt.inputValue()).toContain("erfasst: 40");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
