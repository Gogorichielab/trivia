# Cross-laptop sync on Cloudflare

The app works on one laptop with no Cloudflare account at all. This document
covers the optional worker in `worker/`, which lets the host drive an audience
display running on a **second** laptop.

If the worker is not configured, or is unreachable during the event, every page
falls back to local storage and behaves exactly as it did before. A sync outage
is not a game outage.

---

## What is used, and what is not

| Service | Used | Why |
| --- | --- | --- |
| **Workers** | Yes | Hosts the sync endpoint. Free plan: 100,000 requests/day. |
| **Durable Objects** | Yes | One object per game code holds state and fans changes out over WebSocket. SQLite-backed classes are the ones on the free plan. |
| **Workers Secrets** | Yes | Holds `HOST_TOKEN`. Free. |
| **Pages** | No | The site already deploys to GitHub Pages. Moving would gain nothing here. |
| **KV** | No | The free tier allows 1,000 writes/day. A live game writes on every score change and every question advance, which is uncomfortably close. Durable Object storage has no such daily write cap. |
| **D1** | No | A relational database for four fields of state would be more to go wrong, not less. |
| **R2** | No | Nothing large enough to need object storage. |
| **Turnstile** | No | No public form to protect. |
| **Zaraz / Web Analytics** | No | Nobody needs attendance analytics for a church trivia night, and it adds a third-party script to a page that must work offline. |
| **Access** | See below | Needs a domain. |

> Free-tier limits move. Check
> <https://developers.cloudflare.com/workers/platform/limits/> and
> <https://developers.cloudflare.com/durable-objects/platform/pricing/>
> before relying on them for an event.

---

## Deploying the worker

You need a free Cloudflare account. No card is required for the Workers free
plan.

```bash
cd worker
npm install
npx wrangler login          # opens a browser
npx wrangler deploy
```

Deploy prints your worker URL, something like:

```
https://st-peter-trivia-sync.<your-subdomain>.workers.dev
```

Then set the host token. This is the only thing standing between the audience
and your scoreboard, so make it long and random:

```bash
# Generate one:
openssl rand -hex 24

npx wrangler secret put HOST_TOKEN
# paste the value when prompted
```

Check it took:

```bash
curl https://st-peter-trivia-sync.<your-subdomain>.workers.dev/health
# {"ok":true,"hostTokenSet":true}
```

If `hostTokenSet` is `false`, the worker refuses every write rather than
accepting anonymous ones. Set the secret before the event.

### Lock the origin down

While testing, `ALLOWED_ORIGIN` is `*`. Before the event, set it in
`worker/wrangler.toml` to your Pages origin and redeploy:

```toml
[vars]
ALLOWED_ORIGIN = "https://gogorichielab.github.io"
```

---

## Using it on the night

Open each screen with the same game code. Use a long random code — a short one
is guessable, and a guessed code reaches a live game. The worker rejects codes
shorter than 8 characters.

**Host laptop** (the token goes on this screen only):

```
host.html?game=k7Qm29xRtpLm42&sync=https://<worker>.workers.dev&token=<host token>
```

**Display laptop:**

```
display.html?game=k7Qm29xRtpLm42&sync=https://<worker>.workers.dev
scoreboard.html?game=k7Qm29xRtpLm42&sync=https://<worker>.workers.dev
```

The settings are remembered per game code, so a refresh does not need the full
URL again.

### The badge is the go/no-go signal

The host console shows a sync badge. At the T-60 check, it must read
**Sync live** in green.

| Badge | Meaning |
| --- | --- |
| `Sync off — this laptop only` | No `sync=` in the URL. Host and display must be on the same laptop. |
| `Sync connecting…` | Opening the socket. Should settle within a second or two. |
| `Sync live` | Connected. Changes reach the other laptop. |
| `Sync offline` | Cannot reach the worker; retrying with backoff. The game still runs locally. |
| `Sync error — Host token rejected` | The `token=` value is wrong. Fix it, or drop `sync=` and run on one laptop. |

---

## Why the display cannot change a score

`AGENTS.md` asks that the audience display and scoreboard not be able to modify
scores. That is enforced at the worker, not in the page:

- Writes are `POST`, and require the `x-host-token` header.
- The token is compared in constant time, so it cannot be guessed a character
  at a time by timing responses.
- Viewer screens are given the URL **without** a token, so they have nothing to
  send. Messages they push over the WebSocket are ignored.

There is a test for exactly this: a display page issuing a direct `POST` gets a
403 and the host's scores are unchanged
(`tests/e2e/sync.spec.js`, "the audience display cannot change a score").

---

## Cloudflare Access — read this before planning on it

Access is free for up to 50 users, and would let you put an email one-time-code
in front of the host page.

**It needs a domain you have added to Cloudflare.** Access policies attach to a
hostname in a zone you control. It cannot protect a bare `*.workers.dev` or a
production `*.pages.dev` URL. A domain costs money each year, so on a
strictly-free footing Access is not available.

The `HOST_TOKEN` above is the free substitute. It is weaker — a token in a URL
can be shoulder-surfed or land in a screenshot — so:

- Do not project the host screen.
- Do not share the host URL in any group chat.
- Rotate the token after the event: `npx wrangler secret put HOST_TOKEN`.

If you already have a domain on Cloudflare, add Access afterwards:

1. Zero Trust → Access → Applications → Add a self-hosted application.
2. Point it at your host page's hostname and path.
3. Policy: Allow, with an Emails rule listing the host and helpers.
4. Keep `HOST_TOKEN` as well. Two locks are better than one.

---

## After the event

`AGENTS.md` asks for the game data to be deleted afterwards.

```bash
# Rotate the token so old URLs stop working.
cd worker && npx wrangler secret put HOST_TOKEN

# Or remove the worker and its stored state entirely.
npx wrangler delete
```

---

## Running it locally

```bash
cd worker
echo 'HOST_TOKEN="test-token-abc"' > .dev.vars   # already gitignored
npx wrangler dev --port 8787 --local
```

Then, from the repository root:

```bash
SYNC_URL=http://localhost:8787 SYNC_TOKEN=test-token-abc npx playwright test tests/e2e/sync.spec.js
```

These tests skip when `SYNC_URL` is unset, so CI stays green without a worker.
