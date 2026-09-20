/* End-to-end cover for the optional question countdown (#10).

   One test per acceptance criterion on the issue, driven the way the host
   would drive it. The countdown is a post-event extra, so the first thing
   these check is that it stays out of the way until it is asked for. */

const { test, expect } = require("@playwright/test");
const path = require("node:path");

const QUESTIONS = path.join(__dirname, "..", "..", "mock/questions.csv");

function newGame() {
  return "timer" + Math.random().toString(36).slice(2, 10);
}

/** Opens the host, loads the real mock questions, and stops on Question 1. */
async function hostOnFirstQuestion(page, code, query = "&timer=45") {
  await page.goto(`/host.html?game=${code}${query}`);
  await page.setInputFiles("#file", QUESTIONS);
  await expect(page.locator("#importLog")).toBeVisible();
  await page.locator("#nextButton").click(); // lobby -> round card
  await page.locator("#nextButton").click(); // round card -> question
  await expect(page.locator("#current")).toContainText("QUESTION");
}

test.describe("off unless asked for", () => {
  test("no timer appears anywhere without the flag", async ({ browser }) => {
    const code = newGame();
    const context = await browser.newContext();
    const host = await context.newPage();
    await hostOnFirstQuestion(host, code, "");

    await expect(host.locator("#timerPanel")).toBeHidden();

    const display = await context.newPage();
    await display.goto(`/display.html?game=${code}`);
    await expect(display.locator("#stage h1")).toBeVisible({ timeout: 5000 });
    await expect(display.locator("#timerBar")).toBeHidden();

    await context.close();
  });

  test("timer=0 turns it off again for a game that had one", async ({ page }) => {
    const code = newGame();
    await hostOnFirstQuestion(page, code); // runs a timer, and remembers the setting
    await expect(page.locator("#timerPanel")).toBeVisible();

    await page.goto(`/host.html?game=${code}&timer=0`);
    await expect(page.locator("#timerPanel")).toBeHidden();

    // And the display is left clear rather than holding the last countdown.
    const display = await page.context().newPage();
    await display.goto(`/display.html?game=${code}`);
    await expect(display.locator("#timerBar")).toBeHidden();
  });

  test("a display can opt out even while the host runs a timer", async ({ browser }) => {
    const code = newGame();
    const context = await browser.newContext();
    const host = await context.newPage();
    await hostOnFirstQuestion(host, code);

    const muted = await context.newPage();
    await muted.goto(`/display.html?game=${code}&timer=0`);
    await expect(muted.locator("#stage h1")).toBeVisible({ timeout: 5000 });
    await expect(muted.locator("#timerBar")).toBeHidden();

    await context.close();
  });
});

test("the audience display shows the time remaining, counting down", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await hostOnFirstQuestion(host, code);

  const display = await context.newPage();
  await display.goto(`/display.html?game=${code}`);

  const bar = display.locator("#timerBar");
  await expect(bar).toBeVisible({ timeout: 5000 });
  await expect(bar).toHaveText(/^0:4\d$/); // started at 45s and already moving

  const first = await bar.textContent();
  await expect(bar).not.toHaveText(first, { timeout: 5000 });

  await context.close();
});

test("the host can restart and clear the timer", async ({ page }) => {
  const code = newGame();
  await hostOnFirstQuestion(page, code);

  const readout = page.locator("#timerReadout");
  await expect(readout).toHaveText(/^0:4\d$/);

  // Let it run down a little, then restart and confirm it went back to full.
  await expect(readout).toHaveText("0:43", { timeout: 5000 });
  await page.getByRole("button", { name: "Restart timer" }).click();
  await expect(readout).toHaveText(/^0:4[45]$/);

  await page.getByRole("button", { name: "Clear timer" }).click();
  await expect(readout).toHaveText("—");
});

test("the host can pause and resume", async ({ page }) => {
  const code = newGame();
  await hostOnFirstQuestion(page, code);

  const readout = page.locator("#timerReadout");
  await page.getByRole("button", { name: "Pause timer" }).click();

  const held = await readout.textContent();
  await page.waitForTimeout(1500);
  await expect(readout).toHaveText(held); // a paused timer does not move

  await page.getByRole("button", { name: "Resume timer" }).click();
  await expect(readout).not.toHaveText(held, { timeout: 5000 });
});

test("the timer never blocks navigation, even after it runs out", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  // One second, so the test can wait out a genuine expiry rather than faking it.
  await hostOnFirstQuestion(host, code, "&timer=1");

  const display = await context.newPage();
  await display.goto(`/display.html?game=${code}`);
  await expect(display.locator("#timerBar")).toHaveText("Time's up", { timeout: 5000 });

  // The host is still in charge of where the game goes.
  await host.locator("#nextButton").click();
  await expect(host.locator("#current")).toContainText("QUESTION 2");
  await expect(display.locator("#stage")).not.toContainText("Jupiter");

  await host.getByRole("button", { name: "Back" }).click();
  await expect(host.locator("#current")).toContainText("QUESTION");

  await context.close();
});

test("each question gets a fresh countdown and answer review gets none", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await hostOnFirstQuestion(host, code);

  const display = await context.newPage();
  await display.goto(`/display.html?game=${code}`);
  const bar = display.locator("#timerBar");
  await expect(bar).toBeVisible({ timeout: 5000 });

  // The next question starts over at the full 45, not where the last left off.
  await host.locator("#nextButton").click();
  await expect(host.locator("#current")).toContainText("QUESTION 2");
  await expect(bar).toBeVisible({ timeout: 5000 });
  await expect(bar).toHaveText(/^0:4[45]$/);

  // After all eight questions, answer review is not a timed moment.
  for (let i = 0; i < 7; i++) await host.locator("#nextButton").click();
  await expect(host.locator("#current")).toContainText("ANSWER 1");
  await expect(bar).toBeHidden({ timeout: 5000 });

  await context.close();
});

test("two displays agree on how long is left", async ({ browser }) => {
  const code = newGame();
  const context = await browser.newContext();
  const host = await context.newPage();
  await hostOnFirstQuestion(host, code);

  const tv = await context.newPage();
  const projector = await context.newPage();
  await tv.goto(`/display.html?game=${code}`);
  await projector.goto(`/display.html?game=${code}`);

  await expect(tv.locator("#timerBar")).toBeVisible({ timeout: 5000 });
  await expect(projector.locator("#timerBar")).toBeVisible({ timeout: 5000 });

  // Read both as close together as possible; they count down to one shared
  // deadline, so they may differ by the second that ticked between reads.
  const [a, b] = await Promise.all([
    tv.locator("#timerBar").textContent(),
    projector.locator("#timerBar").textContent(),
  ]);
  const seconds = (clock) => Number(clock.split(":")[1]);
  expect(Math.abs(seconds(a) - seconds(b)), `tv read ${a}, projector read ${b}`).toBeLessThanOrEqual(1);

  await context.close();
});

test("a timer survives a refresh of the host", async ({ page }) => {
  const code = newGame();
  await hostOnFirstQuestion(page, code);
  await expect(page.locator("#timerReadout")).toHaveText("0:43", { timeout: 5000 });

  await page.reload();
  // Still counting the same question down, and the panel is still on without
  // the flag needing to be in the URL again.
  await expect(page.locator("#timerPanel")).toBeVisible();
  await expect(page.locator("#timerReadout")).toHaveText(/^0:4[012]$/);
});
