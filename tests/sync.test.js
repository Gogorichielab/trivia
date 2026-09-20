const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const gameSource = fs.readFileSync("game.js", "utf8");
const syncSource = fs.readFileSync("sync.js", "utf8");

function response(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function browser({ search, hostname = "trivia.gogorichie.online", pathname = "/host", stored = {}, fetch }) {
  const data = new Map(Object.entries(stored));
  const sockets = [];
  const timers = [];
  class Socket {
    constructor(url) { this.url = url; this.handlers = {}; sockets.push(this); }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    emit(name, event = {}) { this.handlers[name]?.(event); }
    close() {}
  }
  class Event { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  const context = {
    URL, URLSearchParams, Promise,
    location: { search, hostname, pathname },
    localStorage: {
      getItem: (key) => data.get(key) || null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    },
    WebSocket: Socket,
    CustomEvent: Event,
    setTimeout: (fn) => { timers.push(fn); },
    fetch,
    addEventListener() {},
    dispatchEvent() {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(gameSource, context);
  vm.runInContext(syncSource, context);
  return { context, data, sockets, timers };
}

test("production rejects a custom endpoint without sending it the saved token", async () => {
  const calls = [];
  const trusted = "https://trivia-sync.gogorichie.online";
  const app = browser({
    search: "?game=review001&sync=https://attacker.invalid",
    stored: {
      "trivia:review001:sync": JSON.stringify({ url: trusted, token: "dummy", tokenUrl: trusted }),
    },
    fetch: (url, options = {}) => {
      calls.push({ url, options });
      return response(200, { index: 0, teams: [], game: null, rev: 0 });
    },
  });

  app.context.saveState({ index: 1, teams: [] });
  await new Promise(setImmediate);

  assert.ok(calls.length >= 2);
  assert.ok(calls.every((call) => call.url.startsWith(trusted)));
  assert.ok(calls.every((call) => !call.url.includes("attacker.invalid")));
});

test("host without a token never reports live updates", () => {
  const app = browser({
    search: "?game=review001",
    fetch: () => response(200, {}),
  });
  app.sockets[0].emit("open");
  assert.equal(app.context.syncStatus(), "error");
});

test("viewer discards a stale full-game answer cache", () => {
  const app = browser({
    search: "?game=review001",
    pathname: "/display",
    stored: { "trivia:review001:game": JSON.stringify({ answer: "old secret" }) },
    fetch: () => response(200, {}),
  });
  app.sockets[0].emit("message", {
    data: JSON.stringify({ type: "state", state: {
      index: 1,
      teams: [],
      view: { type: "question", text: "Public question" },
      rev: 2,
    } }),
  });
  assert.equal(app.data.has("trivia:review001:game"), false);
});

test("fresh host restores the authoritative game and scores", async () => {
  const savedGame = { rounds: [{ name: "Saved", questions: [] }], tiebreaker: { text: "Tie", answer: "1" } };
  const app = browser({
    search: "?game=review001&token=dummy",
    fetch: (_url, options = {}) => {
      if (!options.method) return response(200, {
        index: 3,
        teams: [{ name: "Recovered", score: 9 }],
        timer: null,
        game: savedGame,
        rev: 7,
      });
      return response(200, { rev: 8 });
    },
  });
  await new Promise(setImmediate);

  assert.equal(app.context.loadState().index, 3);
  assert.equal(app.context.loadState().teams[0].score, 9);
  assert.equal(app.context.loadGame().rounds[0].name, "Saved");
});

test("failed host update is retried after the socket reconnects", async () => {
  let posts = 0;
  const app = browser({
    search: "?game=review001&token=dummy",
    fetch: (_url, options = {}) => {
      if (!options.method) return response(200, { index: 0, teams: [], game: null, rev: 0 });
      posts += 1;
      return posts === 1 ? Promise.reject(new Error("offline")) : response(200, { rev: 1 });
    },
  });
  app.context.saveState({ index: 1, teams: [{ name: "Team", score: 1 }] });
  await new Promise(setImmediate);
  app.sockets[0].emit("open");
  await new Promise(setImmediate);

  assert.equal(posts, 2);
  assert.equal(app.context.syncStatus(), "live");
});
