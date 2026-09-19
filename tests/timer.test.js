/* Unit tests for the countdown maths.
   Run with: node --test tests/
   Uses node:test, so there is nothing to install.

   The arithmetic is separated from the DOM precisely so it can be checked
   here: a timer that is wrong on the wall is not something to discover
   during a round. */

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const t = require(path.join(__dirname, "..", "timer.js"));

const T0 = 1_700_000_000_000; // an arbitrary fixed "now", so nothing is clock-dependent

test("?timer= is read the way a host is likely to type it", () => {
  assert.deepEqual(t.parseTimerParam(""), { enabled: true, duration: 45000 });
  assert.deepEqual(t.parseTimerParam("45"), { enabled: true, duration: 45000 });
  assert.deepEqual(t.parseTimerParam("30"), { enabled: true, duration: 30000 });
  assert.deepEqual(t.parseTimerParam(" 60 "), { enabled: true, duration: 60000 });
});

test("the off switches all mean off", () => {
  for (const off of ["0", "off", "OFF", "false", "no"]) {
    assert.equal(t.parseTimerParam(off).enabled, false, `${off} should disable the timer`);
  }
});

test("a value that cannot be read disables rather than guessing", () => {
  // A typo during setup must not put a wrong number in front of the room.
  for (const bad of ["abc", "-5", "4.5", "99999", String(t.TIMER_MAX_SECONDS + 1)]) {
    assert.equal(t.parseTimerParam(bad).enabled, false, `${bad} should not start a timer`);
  }
  assert.equal(t.parseTimerParam(String(t.TIMER_MAX_SECONDS)).enabled, true);
});

test("a started timer counts down to its deadline", () => {
  const timer = t.startTimer(45000, T0);
  assert.equal(t.timerRemaining(timer, T0), 45000);
  assert.equal(t.timerRemaining(timer, T0 + 15000), 30000);
  assert.equal(t.timerRemaining(timer, T0 + 45000), 0);
  assert.equal(t.isTimerRunning(timer), true);
});

test("time left never goes negative once the timer has run out", () => {
  const timer = t.startTimer(45000, T0);
  assert.equal(t.timerRemaining(timer, T0 + 90000), 0);
});

test("a display whose clock is behind cannot show more than the full duration", () => {
  // endsAt is absolute, so a screen with a skewed clock would otherwise show a
  // countdown longer than the timer was ever set for.
  const timer = t.startTimer(45000, T0);
  assert.equal(t.timerRemaining(timer, T0 - 30000), 45000);
});

test("pause holds the remaining time, resume carries it on", () => {
  const started = t.startTimer(45000, T0);
  const paused = t.pauseTimer(started, T0 + 20000);

  assert.equal(t.isTimerRunning(paused), false);
  assert.equal(t.timerRemaining(paused, T0 + 20000), 25000);
  // Still 25s later on, because a paused timer does not move.
  assert.equal(t.timerRemaining(paused, T0 + 999999), 25000);

  const resumed = t.resumeTimer(paused, T0 + 999999);
  assert.equal(t.isTimerRunning(resumed), true);
  assert.equal(t.timerRemaining(resumed, T0 + 999999), 25000);
  assert.equal(t.timerRemaining(resumed, T0 + 999999 + 25000), 0);
});

test("pausing a paused timer and resuming a running one change nothing", () => {
  const running = t.startTimer(45000, T0);
  assert.deepEqual(t.resumeTimer(running, T0 + 5000), running);

  const paused = t.pauseTimer(running, T0 + 5000);
  assert.deepEqual(t.pauseTimer(paused, T0 + 9000), paused);
});

test("no timer is a clean absence, not a zero", () => {
  assert.equal(t.timerRemaining(null, T0), null);
  assert.equal(t.isTimerRunning(null), false);
  assert.equal(t.timerView(null, T0).visible, false);
});

test("the clock reads the way it is spoken", () => {
  assert.equal(t.formatClock(45000), "0:45");
  assert.equal(t.formatClock(5000), "0:05");
  assert.equal(t.formatClock(60000), "1:00");
  assert.equal(t.formatClock(65000), "1:05");
  assert.equal(t.formatClock(0), "0:00");
  assert.equal(t.formatClock(-1000), "0:00");
});

test("seconds round up, so a fresh 45s timer reads 0:45 and not 0:44", () => {
  const timer = t.startTimer(45000, T0);
  assert.equal(t.timerView(timer, T0).text, "0:45");
  assert.equal(t.timerView(timer, T0 + 1).text, "0:45");
  assert.equal(t.timerView(timer, T0 + 1000).text, "0:44");
});

test("the view says in words what colour alone would otherwise carry", () => {
  const timer = t.startTimer(45000, T0);

  assert.equal(t.timerView(timer, T0).state, "running");
  assert.equal(t.timerView(timer, T0 + 35000).state, "warning"); // 10s left
  assert.equal(t.timerView(timer, T0 + 45000).state, "expired");
  assert.equal(t.timerView(timer, T0 + 45000).text, "Time's up");
  assert.equal(t.pauseTimer(timer, T0 + 5000) && t.timerView(t.pauseTimer(timer, T0 + 5000), T0 + 5000).state, "paused");
});

test("every visible state carries a spoken label for screen readers", () => {
  const timer = t.startTimer(45000, T0);
  assert.equal(t.timerView(timer, T0).label, "0:45 remaining");
  assert.equal(t.timerView(t.pauseTimer(timer, T0 + 5000), T0 + 5000).label, "0:40 remaining, paused");
  assert.equal(t.timerView(timer, T0 + 45000).label, "Time is up");
});
