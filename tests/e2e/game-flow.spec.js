/* End-to-end cover for the run-of-show in TRIVIA_NIGHT_GUIDANCE.md.
   These walk the game the way the host will on the night, in a real browser,
   rather than asserting that files parse. See AGENTS.md "Testing". */

const { test, expect } = require("@playwright/test");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const QUESTIONS = path.join(root, "mock/questions.csv");
const TEAMS = path.join(root, "mock/teams.csv");

// Every test gets its own game code, so runs in parallel never share state.
function newGame() {
  return "test" + Math.random().toString(36).slice(2, 10);
}

async function openHost(page, code) {
  await page.goto(`/host.html?game=${code}`);
  await expect(page.locator("#current")).toBeVisible();
}

/** Load a spreadsheet through the host's file picker and wait for the log. */
async function importFile(page, file) {
  await page.setInputFiles("#file", file);
  const log = page.locator("#importLog");
  await expect(log).toBeVisible();
  return log;
}

async function advance(page, count = 1) {
  for (let i = 0; i < count; i++) await page.locator("#nextButton").click();
}

test.describe("the four pages load", () => {
  for (const [name, url] of [
    ["landing", "/index.html"],
    ["host", "/host.html?game=smoke"],
    ["display", "/display.html?game=smoke"],
    ["scoreboard", "/scoreboard.html?game=smoke"],
  ]) {
    test(`${name} page loads without console errors`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await expect(page.locator("body")).toBeVisible();
      expect(errors, `${name} threw: ${errors.join("; ")}`).toEqual([]);
    });
  }
});

test("host imports the questions spreadsheet and reports what it found", async ({ page }) => {
  await openHost(page, newGame());
  const log = await importFile(page, QUESTIONS);

  await expect(log).toHaveClass(/good/);
  await expect(log).toContainText("Loaded 40 questions in 5 rounds");
  await expect(log).toContainText("Round 1 — General Knowledge — 8 questions");
  await expect(log).toContainText("Round 5 — Local & Wildcard — 8 questions");
  await expect(log).toContainText("Tiebreaker: yes");
});

test("host imports the teams spreadsheet", async ({ page }) => {
  await openHost(page, newGame());
  const log = await importFile(page, TEAMS);

  await expect(log).toHaveClass(/good/);
  await expect(log).toContainText("Loaded 5 teams");
  await expect(page.locator("#scoreTable tbody tr")).toHaveCount(5);
  await expect(page.locator("#scoreTable tbody tr").first().locator("input").first()).toHaveValue("Quiz Please");
});

test("a sheet it cannot read is reported, not silently swallowed", async ({ page }, testInfo) => {
  await openHost(page, newGame());
  const bad = testInfo.outputPath("unreadable.csv");
  require("node:fs").writeFileSync(bad, "Foo,Bar\n1,2\n");

  const log = await importFile(page, bad);
  await expect(log).toHaveClass(/bad/);
  await expect(log).toContainText("Could not load");
  await expect(log).toContainText("Headings seen: Foo, Bar");
});

test("host presents every question before beginning the answer review", async ({ page }) => {
  const code = newGame();
  await openHost(page, code);
  await importFile(page, QUESTIONS);

  const current = page.locator("#current");
  await expect(current).toContainText("LOBBY");

  await advance(page);
  await expect(current).toContainText("ROUND INTRO");
  await expect(current).toContainText("Round 1 — General Knowledge");

  await advance(page);
  await expect(current).toContainText("QUESTION");
  await expect(current).toContainText("largest planet");
  await expect(current).not.toContainText("Jupiter");

  await advance(page, 8);
  await expect(current).toContainText("ANSWER 1");
  await expect(current).toContainText("Answer: Jupiter");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(current).toContainText("QUESTION");
  await expect(current).toContainText("QUESTION 8");
});

test("the audience display never shows the answer before the host reveals it", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  const display = await context.newPage();

  await openHost(host, code);
  await importFile(host, QUESTIONS);
  await display.goto(`/display.html?game=${code}`);

  await advance(host, 2); // lobby -> round -> first question
  await expect(display.locator("#stage")).toContainText("largest planet", { timeout: 5000 });
  await expect(display.locator("#stage")).not.toContainText("Jupiter");

  await advance(host, 8); // remaining questions -> first answer
  await expect(display.locator("#stage")).toContainText("Jupiter", { timeout: 5000 });

  await context.close();
});

test("scores change and the scoreboard ranks by total", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();

  await openHost(host, code);
  await importFile(host, TEAMS);

  // Give the third team the most points so ranking cannot pass by luck.
  await host.locator("#scoreTable tbody tr").nth(2).locator("td").nth(2).locator("input").fill("3");
  await host.locator("#scoreTable tbody tr").nth(2).locator("td").nth(2).locator("input").press("Tab");
  await host.locator("#scoreTable tbody tr").nth(0).locator("td").nth(2).locator("input").fill("1");
  await host.locator("#scoreTable tbody tr").nth(0).locator("td").nth(2).locator("input").press("Tab");

  const board = await context.newPage();
  await board.goto(`/scoreboard.html?game=${code}`);
  const rows = board.locator(".row");
  await expect(rows).toHaveCount(5, { timeout: 5000 });
  await expect(rows.nth(0)).toContainText("Trivia Newton-John");
  await expect(rows.nth(0)).toContainText("3");
  await expect(rows.nth(1)).toContainText("Quiz Please");

  await context.close();
});

test("host downloads a CSV with round scores and totals", async ({ page }) => {
  const code = newGame();
  await openHost(page, code);
  await importFile(page, QUESTIONS);
  await importFile(page, TEAMS);
  const score = page.locator("#scoreTable tbody tr").first().locator("td").nth(2).locator("input");
  await score.fill("6");
  await score.press("Tab");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Results" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(code + "-results.csv");
  const contents = require("node:fs").readFileSync(await download.path(), "utf8");
  expect(contents).toContain("Rank,Team,Table");
  expect(contents).toContain("Quiz Please");
  expect(contents).toContain(",6,");
});

test("presentation transitions respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/display.html?game=${newGame()}`);
  const animation = await page.locator("#stage").evaluate((element) => {
    element.classList.add("screen-change");
    return getComputedStyle(element).animationName;
  });
  expect(animation).toBe("none");
});

test("state and scores survive a refresh of every window", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();

  await openHost(host, code);
  await importFile(host, QUESTIONS);
  await importFile(host, TEAMS);
  await advance(host, 2);
  const firstRoundScore = host.locator("#scoreTable tbody tr").first().locator("td").nth(2).locator("input");
  await firstRoundScore.fill("1");
  await firstRoundScore.press("Tab");

  await host.reload();
  await expect(host.locator("#current")).toContainText("QUESTION 1");
  await expect(host.locator("#scoreTable tbody tr").first().locator(".total")).toHaveText("1");
  await expect(host.locator("#scoreTable tbody tr")).toHaveCount(5);

  await context.close();
});

test("a team name containing quotes and angle brackets is shown as text", async ({ browser }, testInfo) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await openHost(host, code);

  const tricky = testInfo.outputPath("tricky-teams.csv");
  require("node:fs").writeFileSync(tricky, 'team_name,table_number\n"The ""Quotables""",1\n<b>Bold</b> Movers,2\n');
  await importFile(host, tricky);

  await expect(host.locator("#scoreTable tbody tr")).toHaveCount(2);
  await expect(host.locator("#scoreTable tbody tr").first().locator("input").first()).toHaveValue('The "Quotables"');
  // If the markup had been injected rather than escaped, this <b> would exist.
  await expect(host.locator("#scoreTable tbody b")).toHaveCount(0);

  const board = await context.newPage();
  await board.goto(`/scoreboard.html?game=${code}`);
  await expect(board.locator(".row")).toHaveCount(2, { timeout: 5000 });
  await expect(board.locator(".row").first()).toContainText('The "Quotables"');
  await expect(board.locator(".row b:has-text('Bold')")).toHaveCount(0);

  await context.close();
});

test("reset clears scores after confirmation and keeps team names", async ({ page }) => {
  await openHost(page, newGame());
  await importFile(page, TEAMS);
  await expect(page.locator("#scoreTable tbody tr")).toHaveCount(5);
  const score = page.locator("#scoreTable tbody tr").first().locator("td").nth(2).locator("input");
  await score.fill("4");
  await score.press("Tab");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset Game" }).click();
  await expect(page.locator("#scoreTable tbody tr")).toHaveCount(5);
  await expect(page.locator("#scoreTable tbody tr").first().locator(".total")).toHaveText("0");
});

test("question text is large enough to read from the back of the room", async ({ page }) => {
  const code = newGame();
  const host = await page.context().newPage();
  await openHost(host, code);
  await importFile(host, QUESTIONS);
  await advance(host, 2);

  await page.goto(`/display.html?game=${code}`);
  const heading = page.locator("#stage h1");
  await expect(heading).toBeVisible({ timeout: 5000 });

  const size = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  // 1920x1080 viewport, audience ~20 feet back. Anything under 48px is a squint.
  expect(size, `question rendered at ${size}px`).toBeGreaterThanOrEqual(48);
});
