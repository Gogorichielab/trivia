/* Cross-laptop sync through the Cloudflare Worker.
 *
 * Two separate browser contexts have separate local storage, so they stand in
 * for the two host laptops. Without sync they cannot see each other at all;
 * with sync the display follows the host.
 *
 * Needs the worker running. Start it with:
 *   cd worker && npx wrangler dev --port 8787 --local
 * then run with SYNC_URL=http://localhost:8787 SYNC_TOKEN=test-token-abc
 * These tests skip when SYNC_URL is unset, so CI stays green without it.
 */

const { test, expect } = require("@playwright/test");
const path = require("node:path");

const SYNC_URL = process.env.SYNC_URL;
const SYNC_TOKEN = process.env.SYNC_TOKEN || "test-token-abc";
const QUESTIONS = path.join(__dirname, "..", "..", "mock/questions.csv");
const TEAMS = path.join(__dirname, "..", "..", "mock/teams.csv");

test.skip(!SYNC_URL, "SYNC_URL not set; worker not running");

// Game codes must be 8-64 chars to be accepted by the worker.
function newGame() {
  return "sync" + Math.random().toString(36).slice(2, 12);
}

const hostUrl = (code) =>
  `/host.html?game=${code}&sync=${encodeURIComponent(SYNC_URL)}&token=${encodeURIComponent(SYNC_TOKEN)}`;
const viewUrl = (page, code) => `/${page}.html?game=${code}&sync=${encodeURIComponent(SYNC_URL)}`;

test("the host reports sync live, not just silently failing", async ({ page }) => {
  await page.goto(hostUrl(newGame()));
  await expect(page.locator("#syncBadge")).toHaveText(/Sync live/, { timeout: 10000 });
  await expect(page.locator("#syncBadge")).toHaveClass(/live/);
});

test("a bad host token is reported rather than silently dropping writes", async ({ page }) => {
  const code = newGame();
  await page.goto(`/host.html?game=${code}&sync=${encodeURIComponent(SYNC_URL)}&token=wrong-token`);
  await page.locator("#nextButton").click();
  await expect(page.locator("#syncBadge")).toHaveText(/Host token rejected/, { timeout: 10000 });
  await expect(page.locator("#syncBadge")).toHaveClass(/error/);
});

test("the display on a second laptop follows the host", async ({ browser }) => {
  const code = newGame();
  // Separate contexts: separate local storage, as two laptops would be.
  const laptopA = await browser.newContext();
  const laptopB = await browser.newContext();

  const host = await laptopA.newPage();
  await host.goto(hostUrl(code));
  await host.setInputFiles("#file", QUESTIONS);
  await expect(host.locator("#importLog")).toContainText("Loaded 40 questions");
  await expect(host.locator("#syncBadge")).toHaveText(/Sync live/, { timeout: 10000 });

  const display = await laptopB.newPage();
  await display.goto(viewUrl("display", code));

  // The questions were loaded on laptop A only; laptop B must receive them.
  await host.locator("#nextButton").click();
  await host.locator("#nextButton").click();
  await expect(display.locator("#stage")).toContainText("largest planet", { timeout: 15000 });
  await expect(display.locator("#stage")).not.toContainText("Jupiter");

  for (let i = 0; i < 8; i++) await host.locator("#nextButton").click();
  await expect(display.locator("#stage")).toContainText("Jupiter", { timeout: 15000 });

  await laptopA.close();
  await laptopB.close();
});

test("the scoreboard on a second laptop follows the scores", async ({ browser }) => {
  const code = newGame();
  const laptopA = await browser.newContext();
  const laptopB = await browser.newContext();

  const host = await laptopA.newPage();
  await host.goto(hostUrl(code));
  await host.setInputFiles("#file", TEAMS);
  await expect(host.locator("#scoreTable tbody tr")).toHaveCount(5);

  const board = await laptopB.newPage();
  await board.goto(viewUrl("scoreboard", code));
  await expect(board.locator(".row")).toHaveCount(5, { timeout: 15000 });

  // Third team to the top, so ranking cannot pass by accident.
  const thirdScore = host.locator("#scoreTable tbody tr").nth(2).locator("td").nth(2).locator("input");
  await thirdScore.fill("2");
  await thirdScore.press("Tab");
  const firstScore = host.locator("#scoreTable tbody tr").nth(0).locator("td").nth(2).locator("input");
  await firstScore.fill("1");
  await firstScore.press("Tab");

  await expect(board.locator(".row").first()).toContainText("Trivia Newton-John", { timeout: 15000 });
  await expect(board.locator(".row").first()).toContainText("2");

  await laptopA.close();
  await laptopB.close();
});

test("a display that reconnects catches up instead of showing a stale question", async ({ browser }) => {
  const code = newGame();
  const laptopA = await browser.newContext();
  const laptopB = await browser.newContext();

  const host = await laptopA.newPage();
  await host.goto(hostUrl(code));
  await host.setInputFiles("#file", QUESTIONS);
  await expect(host.locator("#syncBadge")).toHaveText(/Sync live/, { timeout: 10000 });

  const display = await laptopB.newPage();
  await display.goto(viewUrl("display", code));
  await host.locator("#nextButton").click();
  await host.locator("#nextButton").click();
  await expect(display.locator("#stage")).toContainText("largest planet", { timeout: 15000 });

  // Display drops off the wi-fi while the host keeps going.
  await display.close();
  for (let i = 0; i < 4; i++) await host.locator("#nextButton").click();

  const reconnected = await laptopB.newPage();
  await reconnected.goto(viewUrl("display", code));
  // Must show where the host is now, not where it was when it dropped.
  await expect(reconnected.locator("#stage")).not.toContainText("largest planet", { timeout: 15000 });

  await laptopA.close();
  await laptopB.close();
});

test("the audience display cannot change a score", async ({ browser }) => {
  const code = newGame();
  const laptopA = await browser.newContext();
  const laptopB = await browser.newContext();

  const host = await laptopA.newPage();
  await host.goto(hostUrl(code));
  await host.setInputFiles("#file", TEAMS);
  await expect(host.locator("#scoreTable tbody tr")).toHaveCount(5);

  const display = await laptopB.newPage();
  await display.goto(viewUrl("display", code));
  await display.waitForTimeout(1500);

  // The viewer has no token, so a direct write must be refused by the worker.
  const status = await display.evaluate(async (url) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ index: 99, teams: [{ name: "Cheaters", score: 999 }] }),
    });
    return r.status;
  }, `${SYNC_URL}/game/${code}`);
  expect(status).toBe(403);

  await host.reload();
  await expect(host.locator("#scoreTable tbody tr")).toHaveCount(5);
  await expect(host.locator("#scoreTable tbody tr").first().locator(".total")).toHaveText("0");

  await laptopA.close();
  await laptopB.close();
});
