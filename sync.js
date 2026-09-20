/* Optional cross-laptop sync through the Cloudflare Worker in worker/. */
(function () {
  const params = new URLSearchParams(location.search);
  const CONFIG_KEY = gameKey() + ":sync";
  const PRODUCTION_HOST = "trivia.gogorichie.online";
  const PRODUCTION_SYNC = "https://trivia-sync.gogorichie.online";
  const isHostPage = /\/(host|host\.html)$/.test(location.pathname);

  function isLocalSync(url) {
    try {
      const parsed = new URL(url);
      return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
        ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function readConfig() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch {
      stored = {};
    }
    const onProduction = location.hostname === PRODUCTION_HOST;
    const requested = params.get("sync");
    let url = onProduction ? PRODUCTION_SYNC : requested || stored.url || "";
    let error = "";
    if (
      requested &&
      ((onProduction && requested.replace(/\/+$/, "") !== PRODUCTION_SYNC) ||
        (!onProduction && !isLocalSync(requested)))
    ) {
      error = "Untrusted sync address rejected";
      url = onProduction ? PRODUCTION_SYNC : "";
    }
    if (!onProduction && url && !isLocalSync(url)) {
      error = "Untrusted saved sync address removed";
      url = "";
    }
    url = url.replace(/\/+$/, "");
    const suppliedToken = isHostPage ? params.get("token") || "" : "";
    const legacyTokenIsTrusted =
      !stored.tokenUrl &&
      String(stored.url || "").replace(/\/+$/, "") === url &&
      (onProduction ? url === PRODUCTION_SYNC : isLocalSync(url));
    const hasHostStorage = Boolean(stored.token) && (stored.tokenUrl === url || legacyTokenIsTrusted);
    const token = isHostPage && (suppliedToken || hasHostStorage)
      ? suppliedToken || stored.token || ""
      : "";
    if (url && isHostPage) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, token, tokenUrl: token ? url : "" }));
      } catch {
        /* private window */
      }
    } else if (error) {
      try {
        localStorage.removeItem(CONFIG_KEY);
      } catch {
        /* private window */
      }
    }
    return { url, token, error, hasHostStorage };
  }

  const { url, token, error: configError, hasHostStorage } = readConfig();
  const listeners = [];
  let status = configError ? "error" : url ? "connecting" : "off";
  let statusDetail = configError;
  window.syncStatus = () => status;
  window.onSyncStatus = (fn) => {
    listeners.push(fn);
    fn(status, statusDetail);
  };
  function setStatus(next, detail) {
    status = next;
    statusDetail = detail || "";
    listeners.forEach((fn) => {
      try {
        fn(next, detail);
      } catch {
        /* a broken indicator must not break the game */
      }
    });
  }

  if (!url) return;
  const base = `${url}/game/${encodeURIComponent(params.get("game") || "default")}`;
  let knownRev = 0;
  let pending = null;
  let sending = false;
  let socketOpen = false;
  let localDirty = false;

  function storeRemoteState(state) {
    localStorage.setItem(
      gameKey(),
      JSON.stringify({
        index: state.index,
        teams: state.teams || [],
        timer: state.timer || null,
        view: state.view || null,
      })
    );
    if (state.game) localStorage.setItem(gameKey() + ":game", JSON.stringify(state.game));
    else if (state.view && !isHostPage && !hasHostStorage) localStorage.removeItem(gameKey() + ":game");
    knownRev = Number.isInteger(state.rev) ? state.rev : knownRev;
    window.dispatchEvent(new CustomEvent("trivia-sync-state", { detail: state }));
    if (typeof window.render === "function") window.render();
  }

  async function pump() {
    if (sending || !pending || !token) return;
    sending = true;
    const next = pending;
    pending = null;
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", "x-host-token": token },
        body: JSON.stringify({ ...next, baseRev: knownRev }),
        keepalive: true,
      });
      const result = await response.json().catch(() => null);
      if (response.ok) {
        knownRev = result && Number.isInteger(result.rev) ? result.rev : knownRev + 1;
      } else {
        pending = pending || next;
        if (response.status === 409) {
          setStatus("error", "Another host changed the game — reload before continuing");
        } else if (response.status === 403) {
          setStatus("error", "Host token rejected");
        } else {
          setStatus("error", `Worker returned ${response.status}`);
        }
      }
    } catch {
      pending = pending || next;
      setStatus("offline", "Changes saved on this laptop; reconnecting…");
    } finally {
      sending = false;
      if (!pending && socketOpen) setStatus("live");
      else if (pending && socketOpen && status !== "error") setTimeout(pump, 1000);
    }
  }

  if (token && typeof window.saveState === "function") {
    const localSave = window.saveState;
    window.saveState = function (state) {
      localSave(state);
      localDirty = true;
      pending = {
        index: state.index,
        teams: state.teams,
        timer: state.timer || null,
        game: loadGame(),
      };
      pump();
    };
  }

  /* Restore a live game before a fresh host can replace it with local defaults.
   * A host action made while this request is loading still wins. */
  if (isHostPage && token) {
    fetch(base, { headers: { "x-host-token": token } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Worker returned ${response.status}`);
        const state = await response.json();
        knownRev = state.rev || 0;
        if (!localDirty && state.rev > 0) storeRemoteState(state);
      })
      .catch((err) => setStatus("offline", err.message));
  }

  let socket = null;
  let backoff = 1000;
  let closed = false;
  function applyState(state) {
    if (!state || typeof state !== "object") return;
    try {
      if (!token && !isHostPage) storeRemoteState(state);
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
      socketOpen = true;
      if (configError) {
        setStatus("error", configError);
      } else if (isHostPage && !token) {
        setStatus("error", "Host token required for live updates");
      } else if (pending) {
        setStatus("connecting", "Sending saved changes…");
        pump();
      } else {
        setStatus("live");
      }
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
      socketOpen = false;
      setStatus("offline", "Reconnecting…");
      retry();
    });
    socket.addEventListener("error", () => setStatus("offline", "Connection error"));
  }
  function retry() {
    if (closed) return;
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 15000);
  }
  window.addEventListener("beforeunload", () => {
    closed = true;
    if (socket) try { socket.close(); } catch { /* already gone */ }
  });
  connect();
})();
