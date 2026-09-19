/* Accessibility checks, run with axe-core.

   For this app the point is less compliance than legibility: the audience is
   roughly 20 feet from the screen, and AGENTS.md asks for strong contrast and
   for information not to be carried by colour alone. */

const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const path = require("node:path");

const QUESTIONS = path.join(__dirname, "..", "..", "mock/questions.csv");

function newGame() {
  return "a11y" + Math.random().toString(36).slice(2, 10);
}

/** Runs axe and returns violations, ignoring rules that need a real doc lang. */
async function scan(page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations;
}

function describe(violations) {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.html).slice(0, 3).join("\n    ")}`)
    .join("\n  ");
}

test("landing page has no accessibility violations", async ({ page }) => {
  await page.goto("/index.html");
  const violations = await scan(page);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
});

test("host console has no accessibility violations", async ({ page }) => {
  await page.goto(`/host.html?game=${newGame()}`);
  await page.setInputFiles("#file", QUESTIONS);
  await expect(page.locator("#importLog")).toBeVisible();
  const violations = await scan(page);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
});

test("audience display has no accessibility violations", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto(`/host.html?game=${code}`);
  await host.setInputFiles("#file", QUESTIONS);
  await expect(host.locator("#importLog")).toBeVisible();
  await host.getByRole("button", { name: "Next" }).click();

  const display = await context.newPage();
  await display.goto(`/display.html?game=${code}`);
  await expect(display.locator("#stage h1")).toBeVisible({ timeout: 5000 });

  const violations = await scan(display);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
  await context.close();
});

test("scoreboard has no accessibility violations", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto(`/host.html?game=${code}`);
  await host.setInputFiles("#file", path.join(__dirname, "..", "..", "mock/teams.csv"));
  await expect(host.locator("#importLog")).toBeVisible();

  const board = await context.newPage();
  await board.goto(`/scoreboard.html?game=${code}`);
  await expect(board.locator(".row").first()).toBeVisible({ timeout: 5000 });

  const violations = await scan(board);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
  await context.close();
});

test("the audience display stays accessible with a countdown on screen", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto(`/host.html?game=${code}&timer=45`);
  await host.setInputFiles("#file", QUESTIONS);
  await expect(host.locator("#importLog")).toBeVisible();
  await host.getByRole("button", { name: "Next" }).click();

  const display = await context.newPage();
  await display.goto(`/display.html?game=${code}`);
  await expect(display.locator("#timerBar")).toBeVisible({ timeout: 5000 });

  const violations = await scan(display);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
  await context.close();
});

test("the host console stays accessible with the timer panel on", async ({ page }) => {
  await page.goto(`/host.html?game=${newGame()}&timer=45`);
  await page.setInputFiles("#file", QUESTIONS);
  await expect(page.locator("#importLog")).toBeVisible();
  await expect(page.locator("#timerPanel")).toBeVisible();

  const violations = await scan(page);
  expect(violations, `\n  ${describe(violations)}`).toEqual([]);
});
