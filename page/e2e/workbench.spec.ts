import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

import { port, python, root } from "./runtime";

const run = promisify(execFile);

test("one workbench retains independent edits, adds plots live, and exports the selected figure", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const figures = page.getByRole("navigation", {
    name: "Figures",
    exact: true,
  });
  const toolbar = page.getByRole("toolbar", { name: "Format selection" });
  await expect(figures.getByRole("button")).toHaveCount(1);
  const firstCatalog = await (await request.get("/api/figures")).json();
  await expect(toolbar.getByLabel("Line width")).toBeEnabled();
  await expect(
    page.getByRole("toolbar", { name: "Quick line adjustments" }),
  ).toBeVisible();
  await expect(page.locator("details[open]")).toHaveCount(0);

  await page
    .getByRole("toolbar", { name: "Quick line adjustments" })
    .getByLabel("Line width")
    .fill("3.5");
  await page
    .getByRole("toolbar", { name: "Quick line adjustments" })
    .getByLabel("Line width")
    .press("Tab");
  await expect(
    page
      .getByRole("toolbar", { name: "Quick line adjustments" })
      .getByLabel("Line width"),
  ).toHaveValue("3.5");
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(
              `/api/result?figure=${firstCatalog.figures[0].id}`,
            )
          ).json()
        ).revision,
    )
    .toBeGreaterThan(1);

  const appended = await run(
    python,
    [
      "-m",
      "molplot",
      "serve",
      "page/e2e/fixtures/second.py",
      "--port",
      String(port),
      "--no-open",
    ],
    { cwd: root },
  );
  expect(appended.stdout).toContain("existing workbench");
  await expect(figures.getByRole("button")).toHaveCount(3);
  // New plots appear without stealing the selection or resetting the edit.
  await expect(
    figures.getByRole("button", { name: "1 First figure" }),
  ).toHaveAttribute("aria-pressed", "true");
  const catalog = await (await request.get("/api/figures")).json();
  expect(catalog.instanceId).toBe(firstCatalog.instanceId);

  await figures.getByRole("button", { name: "2 New figure 1" }).click();
  await expect
    .poll(async () =>
      Number(await toolbar.getByLabel("Line width").inputValue()),
    )
    .toBeCloseTo(1.5, 3);
  await figures.getByRole("button", { name: "1 First figure" }).click();
  await expect(toolbar.getByLabel("Line width")).toHaveValue("3.5");

  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  const tree = page.getByRole("navigation", { name: "Scene", exact: true });
  await tree
    .getByRole("button", { name: "title First figure", exact: true })
    .click();
  await expect(toolbar.getByLabel("Font size")).toBeEnabled();
  await expect(toolbar.getByLabel("Line width")).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "Quick line adjustments" }),
  ).toHaveCount(0);
  await expect(page.getByText("Markers", { exact: true })).toHaveCount(0);
  await toolbar.getByLabel("Font size").fill("16");
  await toolbar.getByLabel("Font size").press("Tab");
  await expect(toolbar.getByLabel("Font size")).toHaveValue("16");
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "Bold", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(
    page.getByText("Presets and global style", { exact: true }),
  ).toBeVisible();
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(page.locator("details[open]")).toHaveCount(0);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^first(?:-1)?\.pdf$/);
  await page.reload();
  await expect(
    page
      .getByRole("navigation", { name: "Figures", exact: true })
      .getByRole("button"),
  ).toHaveCount(3);
  await expect(
    page
      .getByRole("toolbar", { name: "Format selection" })
      .getByLabel("Line width"),
  ).toHaveValue("3.5");
});

test("a delayed edit response cannot replace a newly selected figure", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const catalog = await (await request.get("/api/figures")).json();
  const figures = page.getByRole("navigation", {
    name: "Figures",
    exact: true,
  });
  const toolbar = page.getByRole("toolbar", { name: "Format selection" });
  await expect(toolbar.getByLabel("Line width")).toBeEnabled();
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received: () => void = () => {};
  const responseReady = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route("**/api/commands", async (route) => {
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await toolbar.getByLabel("Line width").fill("4");
  await toolbar.getByLabel("Line width").press("Tab");
  await responseReady;
  try {
    await figures.getByRole("button", { name: "2 New figure 1" }).click();
    await expect
      .poll(async () =>
        Number(await toolbar.getByLabel("Line width").inputValue()),
      )
      .toBeCloseTo(1.5, 3);
  } finally {
    release();
  }
  // The old figure's command succeeds, while its delayed UI response is ignored.
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`/api/result?figure=${catalog.figures[0].id}`)
          ).json()
        ).revision,
    )
    .toBeGreaterThan(2);
  await expect(
    figures.getByRole("button", { name: "2 New figure 1" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () =>
      Number(await toolbar.getByLabel("Line width").inputValue()),
    )
    .toBeCloseTo(1.5, 3);
  await figures.getByRole("button", { name: "1 First figure" }).click();
  await expect(toolbar.getByLabel("Line width")).toHaveValue("4");
});

test("the compact layout keeps both side panels usable on a narrow window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page
      .getByRole("toolbar", { name: "Format selection" })
      .getByLabel("Line width"),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open left panel", exact: true })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Figures", exact: true })
      .getByRole("button"),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Close side panel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open right panel", exact: true })
    .click();
  await expect(
    page.getByText("Advanced settings", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("details[open]")).toHaveCount(0);
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(
    page.getByText("Presets and global style", { exact: true }),
  ).toBeVisible();
});

test("a clicked curve opens a working quick panel that follows zoom and dismisses on Escape", async ({
  page,
}) => {
  await page.goto("/");
  const quick = page.getByRole("toolbar", { name: "Quick line adjustments" });
  await expect(quick).toBeVisible();
  // Use the actual artist path rather than assuming a canvas size or zoom.
  const at = await page
    .locator('[aria-label="Figure canvas"] svg path')
    .evaluateAll((paths) => {
      const path = paths.find(
        (el) =>
          el.parentElement?.id.includes("series") &&
          el instanceof SVGPathElement,
      ) as SVGPathElement;
      if (!path) throw new Error("No series path found");
      const point = path.getPointAtLength(path.getTotalLength() * 0.35);
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error("Curve is not mounted");
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
  await page.mouse.click(at.x, at.y);
  await expect(quick).toBeVisible();
  const near = await quick.boundingBox();
  if (!near) throw new Error("Quick panel is missing");
  expect(
    Math.hypot(
      Math.max(near.x - at.x, at.x - near.x - near.width, 0),
      Math.max(near.y - at.y, at.y - near.y - near.height, 0),
    ),
  ).toBeLessThanOrEqual(18);
  // Blank paper dismisses without changing the plot. The same line reopens it.
  const paper = await page
    .locator('[aria-label="Figure canvas"] svg')
    .first()
    .boundingBox();
  if (!paper) throw new Error("Figure is missing");
  await page.mouse.click(paper.x + 8, paper.y + 8);
  await expect(quick).toHaveCount(0);
  await page.mouse.move(at.x, at.y);
  await expect(quick).toHaveCount(0);
  await page.mouse.click(at.x, at.y);
  await expect(quick).toBeVisible();
  await quick.getByLabel("Line width").click();
  await expect(quick).toBeVisible();
  await quick.getByLabel("Line colour").fill("#cc0000");
  await expect(
    page
      .getByRole("toolbar", { name: "Format selection" })
      .getByLabel("Line colour"),
  ).toHaveValue("#cc0000");
  await quick.getByLabel("Line style").selectOption("dashed");
  await expect(
    page
      .getByRole("toolbar", { name: "Format selection" })
      .getByLabel("Line style"),
  ).toHaveValue("dashed");
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, -100);
  await expect(quick).toBeVisible();
  const box = await quick.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("Quick panel is not visible");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  await quick.getByLabel("Line width").press("Escape");
  await expect(quick).toHaveCount(0);
  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  await page
    .getByRole("button", { name: "title First figure", exact: true })
    .click();
  await expect(quick).toHaveCount(0);
  await page
    .getByRole("button", { name: "series First curve", exact: true })
    .click();
  await expect(quick).toBeVisible();
});
