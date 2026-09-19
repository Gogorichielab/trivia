/* Optional per-question countdown.
 *
 * Off unless asked for. Without ?timer= on the host URL nothing here writes
 * state, no controls appear, and every screen behaves exactly as it did
 * before. That is deliberate: AGENTS.md files the countdown under "After the
 * Event", so it must be possible to run a whole trivia night as though this
 * file were not here.
 *
 * Turning it on:
 *   host.html?game=<code>&timer=45     45 seconds per question
 *   host.html?game=<code>&timer        the 45s default
 *   host.html?game=<code>&timer=0      off again, and forgets the setting
 *
 * The audience display needs no flag. Timer state travels with the game state
 * the host already syncs, so a display shows a countdown whenever one is
 * running and shows nothing when one is not. A display that should stay clear
 * regardless can opt out with ?timer=0.
 *
 * The timer never controls the game. It does not advance a question, block
 * Next or Back, or change a score. When it reaches zero it says so and stops.
 * The host stays in charge, which is the same reason Plan B exists.
 */

const TIMER_DEFAULT_SECONDS = 45;
// An hour is far past anything a trivia round needs; beyond it, assume a typo.
const TIMER_MAX_SECONDS = 3600;

/* Reads ?timer= and remembers it per game code, so a refresh mid-round does
 * not silently drop back to no timer. Mirrors how sync.js remembers its URL.
 *
 * Returns { enabled, duration } with duration in milliseconds. */
function timerConfig(search, storageKey) {
  const raw = new URLSearchParams(search).get("timer");
  const stored = readStoredTimer(storageKey);

  // Nothing in the URL: fall back to whatever this game code last used.
  if (raw === null) return stored || { enabled: false, duration: TIMER_DEFAULT_SECONDS * 1000 };

  const parsed = parseTimerParam(raw);
  writeStoredTimer(storageKey, parsed);
  return parsed;
}

/* ?timer= values, in the order a host is likely to type them wrong. */
function parseTimerParam(raw) {
  const value = String(raw).trim();
  if (value === "") return { enabled: true, duration: TIMER_DEFAULT_SECONDS * 1000 };
  if (/^(0|off|false|no)$/i.test(value)) return { enabled: false, duration: TIMER_DEFAULT_SECONDS * 1000 };

  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds > 0 && seconds <= TIMER_MAX_SECONDS) {
    return { enabled: true, duration: seconds * 1000 };
  }
  // A value we cannot read means off rather than a guessed duration: a typo
  // during setup should not put a wrong number on the wall.
  return { enabled: false, duration: TIMER_DEFAULT_SECONDS * 1000 };
}

function readStoredTimer(storageKey) {
  if (!storageKey || typeof localStorage === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!stored || typeof stored !== "object") return null;
    const duration = Number(stored.duration);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return { enabled: Boolean(stored.enabled), duration };
  } catch {
    return null; // private window, or something else wrote here
  }
}

function writeStoredTimer(storageKey, config) {
  if (!storageKey || typeof localStorage === "undefined") return;
  try {
    if (config.enabled) localStorage.setItem(storageKey, JSON.stringify(config));
    else localStorage.removeItem(storageKey);
  } catch {
    /* private window; the URL flag still works for this tab */
  }
}

/* ---- timer state ------------------------------------------------------- */

/* The shape stored on the game state as `timer`:
 *
 *   running   { duration, endsAt: <epoch ms>, remaining: null }
 *   paused    { duration, endsAt: null, remaining: <ms left> }
 *   none      null
 *
 * `endsAt` is an absolute time so that every screen counts down to the same
 * moment rather than each running its own stopwatch from whenever it happened
 * to receive the state. The cost is that a display whose clock is off shows a
 * countdown that is off by the same amount; clampRemaining below bounds how
 * far wrong that can look, and the host's own screen is always right. */

function startTimer(duration, now) {
  return { duration, endsAt: now + duration, remaining: null };
}

function pauseTimer(timer, now) {
  if (!timer || timer.endsAt === null) return timer; // already paused, or none
  return { duration: timer.duration, endsAt: null, remaining: clampRemaining(timer, now) };
}

function resumeTimer(timer, now) {
  if (!timer || timer.remaining === null) return timer; // already running, or none
  return { duration: timer.duration, endsAt: now + timer.remaining, remaining: null };
}

function isTimerRunning(timer) {
  return Boolean(timer && timer.endsAt !== null && timer.remaining === null);
}

/* Milliseconds left, or null when there is no timer. Never negative, and
 * never more than the timer was set for. */
function timerRemaining(timer, now) {
  if (!timer) return null;
  return clampRemaining(timer, now);
}

function clampRemaining(timer, now) {
  const duration = Number(timer.duration) || 0;
  const left = timer.endsAt === null ? Number(timer.remaining) || 0 : timer.endsAt - now;
  if (!Number.isFinite(left) || left < 0) return 0;
  return Math.min(left, duration);
}

/* "0:45", "0:05", "1:05". Rounds up so a fresh 45s timer reads 0:45 rather
 * than 0:44, and only reaches 0:00 when the time is genuinely gone. */
function formatClock(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
}

/* What a screen should show. Kept separate from the DOM so it can be tested
 * without a browser, and so the host and the display cannot drift apart. */
function timerView(timer, now) {
  if (!timer) return { visible: false, text: "", label: "", state: "none" };
  const left = clampRemaining(timer, now);
  const paused = timer.endsAt === null;
  const expired = left <= 0;
  // The state word is what carries the meaning; colour only reinforces it.
  // AGENTS.md asks for information not to depend on colour alone.
  const state = expired ? "expired" : paused ? "paused" : left <= 10000 ? "warning" : "running";
  return {
    visible: true,
    text: expired ? "Time's up" : formatClock(left),
    label: expired ? "Time is up" : formatClock(left) + " remaining" + (paused ? ", paused" : ""),
    state,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TIMER_DEFAULT_SECONDS,
    TIMER_MAX_SECONDS,
    parseTimerParam,
    startTimer,
    pauseTimer,
    resumeTimer,
    isTimerRunning,
    timerRemaining,
    formatClock,
    timerView,
  };
}
