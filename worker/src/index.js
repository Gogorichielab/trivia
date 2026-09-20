/* Cross-laptop sync for the trivia app.
 *
 * One Durable Object per game code holds the authoritative state. The host
 * posts state to it; the display and scoreboard hold a WebSocket open and are
 * pushed each change. A reconnecting screen is sent the current state first,
 * so a laptop that dropped off the wi-fi catches up rather than showing a
 * stale question.
 *
 * Only the host can write, and only with the host token. The display and
 * scoreboard are read-only by construction -- there is no message they can
 * send that changes a score.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function cors(env) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-host-token",
    "access-control-max-age": "86400",
  };
}

function json(body, init = {}, env = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...cors(env), ...(init.headers || {}) },
  });
}

/* Compares in constant time so a wrong token cannot be guessed a character at
 * a time by timing the response. */
function tokensMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function hostIsAuthorized(request, env) {
  return Boolean(env.HOST_TOKEN) && tokensMatch(request.headers.get("x-host-token") || "", env.HOST_TOKEN);
}

/* Build the one screen viewers may see. The complete game contains the answer
 * key and host notes, so it must never cross the public API. */
function publicView(game, index) {
  if (!game || !Array.isArray(game.rounds)) return null;
  let position = 0;
  for (let round = 0; round < game.rounds.length; round++) {
    const entry = game.rounds[round] || {};
    if (position++ === index) return { type: "round", title: entry.name || `Round ${round + 1}` };
    for (let question = 0; question < (entry.questions || []).length; question++) {
      const item = entry.questions[question] || {};
      const common = { round, question, roundName: entry.name || `Round ${round + 1}`, text: item.text || "" };
      if (position++ === index) return { type: "question", ...common };
      if (position++ === index) return { type: "answer", ...common, answer: item.answer || "" };
    }
  }
  const tie = game.tiebreaker || {};
  return position === index ? { type: "final", text: tie.text || "" } : null;
}

function publicState(state) {
  return {
    index: state.index,
    teams: (state.teams || []).map((team) => ({ name: team.name || "", score: Number(team.score) || 0 })),
    timer: state.timer || null,
    view: publicView(state.game, state.index),
    rev: state.rev || 0,
    updatedAt: state.updatedAt || null,
  };
}

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async load() {
    if (this.cached === undefined) {
      this.cached = (await this.state.storage.get("game")) || { index: 0, teams: [], timer: null, game: null, rev: 0 };
    }
    return this.cached;
  }

  async save(next) {
    this.cached = next;
    await this.state.storage.put("game", next);
  }

  broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const ws of this.sockets) {
      try {
        ws.send(message);
      } catch {
        this.sockets.delete(ws); // peer went away mid-send
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/ws")) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.add(server);

      // Send current state immediately, so a reconnecting screen catches up.
      server.send(JSON.stringify({ type: "state", state: publicState(await this.load()) }));

      server.addEventListener("close", () => this.sockets.delete(server));
      server.addEventListener("error", () => this.sockets.delete(server));
      // Viewers are read-only; ignore anything they send.
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "GET") {
      const state = await this.load();
      return json(hostIsAuthorized(request, this.env) ? state : publicState(state), {}, this.env);
    }

    if (request.method === "POST") {
      const expected = this.env.HOST_TOKEN;
      if (!expected) {
        return json({ error: "Worker has no HOST_TOKEN set; refusing writes." }, { status: 503 }, this.env);
      }
      if (!tokensMatch(request.headers.get("x-host-token") || "", expected)) {
        return json({ error: "Bad host token." }, { status: 403 }, this.env);
      }

      let incoming;
      try {
        incoming = await request.json();
      } catch {
        return json({ error: "Body was not valid JSON." }, { status: 400 }, this.env);
      }

      const current = await this.load();
      if (Number.isInteger(incoming.baseRev) && incoming.baseRev !== (current.rev || 0)) {
        return json(
          { error: "Game state changed; refresh before writing.", state: current },
          { status: 409 },
          this.env
        );
      }
      const next = {
        index: Number.isInteger(incoming.index) ? incoming.index : current.index,
        teams: Array.isArray(incoming.teams) ? incoming.teams : current.teams,
        // Optional countdown. Stored and relayed as sent; the worker has no
        // opinion about it beyond keeping every screen on the same one.
        timer: incoming.timer === undefined ? current.timer || null : incoming.timer,
        game: incoming.game === undefined ? current.game : incoming.game,
        rev: (current.rev || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.save(next);
      this.broadcast({ type: "state", state: publicState(next) });
      return json(next, {}, this.env);
    }

    return json({ error: "Method not allowed." }, { status: 405 }, this.env);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, hostTokenSet: Boolean(env.HOST_TOKEN) }, {}, env);
    }

    // /game/<code>            current state (GET) or new state (POST)
    // /game/<code>/ws         WebSocket for displays
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "game" || !parts[1]) {
      return json({ error: "Use /game/<code> or /game/<code>/ws" }, { status: 404 }, env);
    }

    const code = parts[1];
    // A short code is guessable, and a guessed code reaches a live game.
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
      return json(
        { error: "Game code must be 8-64 characters of letters, numbers, - or _." },
        { status: 400 },
        env
      );
    }

    const id = env.GAME_ROOM.idFromName(code);
    return env.GAME_ROOM.get(id).fetch(request);
  },
};
