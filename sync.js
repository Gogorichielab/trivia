/* Optional cross-laptop sync through the Cloudflare Worker in worker/.
 *
 * This file is deliberately additive. When sync is not configured, or the
 * worker is unreachable, every page behaves exactly as it did before: local
 * storage stays the source of truth and the worker is only a way of pushing
 * that state to the other laptop. A sync outage must never take the game down.
 *
 * On the deployed site, sync is on by default and points at the production
 * worker, so game-night URLs stay short:
 *   https://trivia.gogorichie.online/host?game=<code>&token=<host token>
 *   https://trivia.gogorichie.online/display?game=<code>
 *   https://trivia.gogorichie.online/scoreboard?game=<code>
 *
 * Anywhere else -- localhost, a file:// copy, a test run -- sync stays off
 * unless a ?sync= URL is given. That keeps local work and the test suite off
 * the production worker, and keeps a laptop copy working with no network.
 *
 * The token belongs on the host screen only. Without it a screen can read the
 * game but cannot change it, which is what keeps the audience display from
 * being able to alter a score. The host console is additionally behind
 * Cloudflare Access; see docs/CLOUDFLARE.md.
 */

(function () {
  const params = new URLSearchParams(location.search);
  const CONFIG_KEY = gameKey() + ":sync";

  // The deployed site talks to the production worker without being told to.
  // Any other origin must opt in with ?sync=, so tests and offline copies
  // never reach for the network.
  const PRODUCTION_HOST = "trivia.gogorichie.online";
  const PRODUCTION_SYNC = "https://trivia-sync.gogorichie.online";

  // Remembered per game code, so a refresh does not need the URL again.
  function readConfig() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch {
      stored = {};
    }
    const onProduction = location.hostname === PRODUCTION_HOST;
    const url = params.get("sync") || stored.url || (onProduction ? PRODUCTION_SYNC : "");
    const token = params.get("token") || stored.token || "";
    if (url) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, token }));
      } catch {
        /* private window; carry on without remembering */
      }
    }
    return { url: url.replace(/\/+$/, ""), token };
  }

  const { url, token } = readConfig();
  // A host page is authoritative even when no sync token was supplied. Without
  // this guard, production sync treats /host as a viewer, immediately applies
  // the worker's state, and can overwrite locally imported teams/questions.
  const isHostPage = /\/(host|host\.html)$/.test(location.pathname);

  // Tell the host what sync is doing. Silence during a game is the one thing
  // worse than no sync at all, so this is visible rather than console-only.
  const listeners = [];
  let status = url ? "connecting" : "off";
  window.syncStatus = () => status;
  window.onSyncStatus = (fn) => {
    listeners.push(fn);
    fn(status);
  };
  function setStatus(next, detail) {
    status = next;
    listeners.forEach((fn) => {
      try {
        fn(next, detail);
      } catch {
        /* a broken indicator must not break the game */
      }
    });
  }

  if (!url) return; // not configured: pages keep working on local storage alone

  const base = `${url}/game/${encodeURIComponent(params.get("game") || "default")}`;

  /* ---- host -> worker -------------------------------------------------- */

  // Wrap saveState rather than replacing it: local storage is still written
  // first, so the host keeps working if the POST fails.
  if (token && typeof window.saveState === "function") {
    const localSave = window.saveState;
    window.saveState = function (state) {
      localSave(state);
      const body = JSON.stringify({ index: state.index, teams: state.teams, timer: state.timer || null, game: loadGame() });
      fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", "x-host-token": token },
        body,
        keepalive: true,
      })
        .then((r) => {
          if (r.ok) setStatus("live");
          else if (r.status === 403) setStatus("error", "Host token rejected");
          else setStatus("error", `Worker returned ${r.status}`);
        })
        .catch(() => setStatus("offline", "Could not reach the worker"));
    };
  }

  /* ---- worker -> screens ----------------------------------------------- */

  let socket = null;
  let backoff = 1000;
  let closed = false;

  function applyState(state) {
    if (!state || typeof state !== "object") return;
    try {
      const local = loadState();
      // The host is authoritative for its own screen; it posts, it does not
      // take state back from the worker. Viewers follow.
      if (!token && !isHostPage) {
        localStorage.setItem(
          gameKey(),
          JSON.stringify({ index: state.index, teams: state.teams || [], timer: state.timer || null })
        );
        if (state.game) localStorage.setItem(gameKey() + ":game", JSON.stringify(state.game));
        // Never reload in response to sync. A socket can deliver its first
        // state before a page's inline render() function exists; reloading at
        // that moment creates a permanent reload loop.
        if (typeof window.render === "function") window.render();
      }
    } catch {
      /* a malformed push must not wedge the screen */
    }
  }

  function connect() {
    if (closed) return;
    const wsUrl = base.replace(/^http/, "ws") + "/ws";
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      setStatus("offline", "Could not open a socket");
      return retry();
    }

    socket.addEventListener("open", () => {
      backoff = 1000;
      setStatus("live");
    });
    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") applyState(msg.state);
      } catch {
        /* ignore anything we cannot parse */
      }
    });
    socket.addEventListener("close", () => {
      setStatus("offline", "Reconnecting…");
      retry();
    });
    socket.addEventListener("error", () => {
      setStatus("offline", "Connection error");
    });
  }

  function retry() {
    if (closed) return;
    // Church wi-fi drops; keep trying, but back off to 15s rather than
    // hammering the worker from three screens at once.
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 15000);
  }

  window.addEventListener("beforeunload", () => {
    closed = true;
    if (socket) try { socket.close(); } catch { /* already gone */ }
  });

  connect();
})();
