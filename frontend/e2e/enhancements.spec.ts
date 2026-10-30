import { test, expect, type Page } from "@playwright/test";

const password = process.env.E2E_ADMIN_PASSWORD || "Test_Energie_2026!";
async function mutate(
  page: Page,
  path: string,
  data?: unknown,
  method = "POST",
) {
  const csrf = await (await page.request.get("/api/auth/csrf")).json();
  const response = await page.request.fetch("/api" + path, {
    method,
    headers: { "X-CSRF-TOKEN": csrf.token },
    ...(data ? { data } : {}),
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function navigate(page: Page, width: number, name: string) {
  if (width < 760)
    await page.getByRole("button", { name: "Menü öffnen" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}

for (const width of [1440, 390]) {
  test(`Version 0.3 ${width}px: Branding, Hardware, Fuhrpark, Diagramm, Drag-and-drop und Löschen`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width < 760 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mutate(page, "/auth/login", {
      email: "admin@sysdatiq.local",
      password,
    });
    const original = await (await page.request.get("/api/branding")).json();
    const customers = await (await page.request.get("/api/customers/")).json();
    const customer = customers.find(
      (c: { number: string }) => c.number === "DEMO-001",
    );
    const suffix = `${width}-${Date.now()}`;
    const site = (
      await mutate(page, `/technical/${customer.id}/nodes`, {
        number: "00-S-" + suffix,
        name: "UI Energiestandort " + suffix,
        kind: "Site",
      })
    ).node;
    const building = (
      await mutate(page, `/technical/${customer.id}/nodes`, {
        number: "00-B-" + suffix,
        name: "UI Technikgebäude " + suffix,
        kind: "Building",
        parentId: site.id,
      })
    ).node;
    const at = new Date(Date.now() - 32 * 86400000).toISOString();
    const root = await mutate(page, "/meters/?customerId=" + customer.id, {
      number: "00-H-" + suffix,
      name: "UI Hauptzähler " + suffix,
      nodeId: building.id,
      at,
      device: { number: "00-GH-" + suffix },
      initialValue: 0,
    });
    const child = await mutate(page, "/meters/?customerId=" + customer.id, {
      number: "00-U-" + suffix,
      name: "UI Unterzähler " + suffix,
      nodeId: building.id,
      at,
      device: { number: "00-GU-" + suffix },
      initialValue: 0,
    });
    await mutate(page, `/meters/${root.id}/readings`, {
      at: new Date(Date.now() - 86400000).toISOString(),
      value: 3100,
    });
    await mutate(page, `/meters/${child.id}/readings`, {
      at: new Date(Date.now() - 86400000).toISOString(),
      value: 1550,
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Übersicht", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Kundenauswahl", { exact: true })
      .selectOption(customer.id);
    await page.getByRole("button", { name: "Mein Konto öffnen" }).click();
    await page.getByLabel("Darkmodus aktivieren", { exact: true }).check();
    await expect(page.getByLabel("Darkmodus aktivieren", { exact: true })).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Mein Konto öffnen" }).click();
    const motto = "Energie gemeinsam verstehen.\nNachhaltig besser werden.";
    await page.getByLabel("Leitspruch auf dem Anmeldebildschirm", { exact: true }).fill(motto);
    await page
      .getByRole("button", { name: "Leitspruch speichern", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/branding")).json()).motto,
      )
      .toBe(motto);
    await page
      .getByLabel("Neues Logo (PNG/JPEG, maximal 2 MB)", { exact: true })
      .setInputFiles("e2e/fixtures/meter.png");
    await page
      .getByRole("button", { name: "Logo hochladen", exact: true })
      .click();
    await expect(page.locator(".app-logo").first()).toHaveAttribute(
      "src",
      /\/api\/branding\/logo/,
    );
    await page
      .getByRole("button", { name: "Standardlogo wiederherstellen" })
      .click();
    await expect(page.locator(".app-logo").first()).toHaveAttribute(
      "src",
      "/logo.svg",
    );

    await navigate(page, width, "Kundenkataster");
    await page
      .getByLabel("Kundenauswahl", { exact: true })
      .selectOption(customer.id);
    await page
      .getByRole("button", { name: new RegExp("UI Technikgebäude " + suffix) })
      .click();
    await expect(page.getByRole("button", { name: /Messstelle/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("heading", { name: "Zugeordnete Messstellen" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "+ Untereintrag anlegen", exact: true })
      .click();
    await page
      .getByLabel("Strukturtyp", { exact: true })
      .selectOption("ConsumerAsset");
    await page.getByLabel("ID *", { exact: true }).fill("PV-" + suffix);
    await page
      .getByLabel("Bezeichnung *", { exact: true })
      .fill("UI Photovoltaik " + suffix);
    await page
      .getByLabel("Hardwarekategorie", { exact: true })
      .fill("Photovoltaik");
    await page
      .getByLabel("Energierolle", { exact: true })
      .selectOption("Generation");
    await page
      .getByLabel("Nenn-/Leuchtmittelleistung je Stück (W)", { exact: true })
      .fill("30000");
    await page
      .getByLabel("Betriebsstunden pro Jahr (h)", { exact: true })
      .fill("900");
    await page
      .getByRole("button", { name: "Katastereintrag speichern", exact: true })
      .click();
    await expect(
      page.getByText("27.000 kWh/Jahr", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Foto / PDF hinzufügen (max. 6 MB)", { exact: true })
      .setInputFiles("e2e/fixtures/meter.png");
    await expect(
      page.getByRole("img", { name: "meter.jpg", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Datei löschen: meter.jpg", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Löschen bestätigen", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "meter.jpg", exact: true }),
    ).toHaveCount(0);

    await navigate(page, width, "Fuhrpark");
    await page
      .getByRole("button", { name: "+ Fahrzeug anlegen", exact: true })
      .click();
    await page
      .getByLabel("Fahrzeug-ID *", { exact: true })
      .fill("UI-F-" + suffix);
    await page
      .getByLabel("Fahrzeugbezeichnung *", { exact: true })
      .fill("UI Transporter " + suffix);
    await page.getByLabel("Kennzeichen", { exact: true }).fill("HB-ENERGIE");
    await page
      .getByRole("button", { name: "Fahrzeug speichern", exact: true })
      .click();
    const vehicle = page
      .getByRole("row")
      .filter({ hasText: "UI Transporter " + suffix });
    await expect(vehicle).toBeVisible();
    await vehicle.getByRole("button", { name: "Fahrzeug löschen" }).click();
    await page
      .getByLabel("Löschgrund", { exact: true })
      .fill("Fahrzeug verkauft im Browsertest");
    await page
      .getByRole("button", { name: "Löschen bestätigen", exact: true })
      .click();
    await expect(vehicle).toHaveCount(0);

    await navigate(page, width, "Zähleranlagenbaum");
    const rootButton = page.getByRole("button", {
      name: new RegExp("UI Hauptzähler " + suffix),
    });
    const childButton = page.getByRole("button", {
      name: new RegExp("UI Unterzähler " + suffix),
    });
    await rootButton.click();
    await expect(
      page.getByRole("img", { name: /Balkendiagramm des Verbrauchs/ }),
    ).toBeVisible();
    await expect(page.locator(".chart-scroll rect").first()).toBeVisible();
    await page.getByLabel("Balken gruppieren nach", { exact: true }).selectOption("Month");
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(
                `/api/meters/${root.id}/series?bucket=Month`,
              )
            ).json()
          ).bucket,
      )
      .toBe("Month");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(
      Math.abs((await page.locator(".topbar").boundingBox())!.y),
    ).toBeLessThan(2);
    await expect(page.getByLabel("Kundenauswahl", { exact: true })).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    // Native HTML-DnD funktioniert auch im schmalen Browser; Tastatur-/Touch-Alternative ist das Zuordnungsformular.
    await childButton.dragTo(rootButton);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByLabel("Übergeordnete Messstelle", { exact: true }),
    ).toHaveValue(root.id);
    await page
      .getByRole("button", { name: "Zuordnung speichern", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const detail = await (
      await page.request.get("/api/meters/" + child.id)
    ).json();
    expect(
      detail.assignments.find((a: { validTo: string | null }) => !a.validTo)
        .parentPointId,
    ).toBe(root.id);
    await rootButton.click();
    await page.getByLabel("Balken gruppieren nach", { exact: true }).selectOption("Week");
    await page.evaluate(() =>
      document.querySelector(".consumption-panel")?.scrollIntoView(),
    );
    await expect(page.getByRole("button", { name: "Zeitraum übernehmen", exact: true })).toBeEnabled();
    await expect(page.locator(".chart-scroll rect").first()).toBeVisible();
    await page.locator(".consumption-panel").screenshot({ path: `../artifacts/diagramm-dark-${width}.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../artifacts/verbrauch-dark-${width}.png`, fullPage: true });
    await childButton.click();
    await page
      .getByRole("button", { name: "Zähler löschen", exact: true })
      .click();
    await page
      .getByLabel("Löschgrund", { exact: true })
      .fill("Browsertest abgeschlossen");
    await page
      .getByRole("button", { name: "Löschen bestätigen", exact: true })
      .click();
    await expect(childButton).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Mein Konto öffnen" }).click();
    await page.getByLabel("Darkmodus aktivieren", { exact: true }).uncheck();
    await expect(page.getByLabel("Darkmodus aktivieren", { exact: true })).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Abmelden", exact: true }).click();
    await expect(page.locator(".login-motto")).toHaveText(motto);
    await mutate(page, "/auth/login", {
      email: "admin@sysdatiq.local",
      password,
    });
    const current = await (await page.request.get("/api/branding")).json();
    await mutate(
      page,
      "/branding",
      { motto: original.motto, version: current.version },
      "PUT",
    );
    expect(errors).toEqual([]);
  });
}
