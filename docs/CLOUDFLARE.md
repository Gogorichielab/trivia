# Cloudflare setup

Everything below is **already deployed and working**. This document is the
record of what exists, how to change it, and how to take it down afterwards.

| Thing | Where |
| --- | --- |
| App | <https://trivia.gogorichie.online> |
| Host console | <https://trivia.gogorichie.online/host> (behind Access) |
| Sync worker | <https://trivia-sync.gogorichie.online> |
| Pages project | `st-peter-trivia` (also at `st-peter-trivia.pages.dev`) |
| Worker | `st-peter-trivia-sync` |
| Access application | "St. Peter Trivia - Host Console" |
| Zero Trust team | `gogorichiellc.cloudflareaccess.com` |

The app still runs on one laptop with no network at all. Sync and Access are
additive: if Cloudflare has a bad night, open the files locally and the game
works exactly as it did before.

---

## Game-night URLs

Use a long random game code — the worker rejects anything under 8 characters,
because a short code is guessable and a guessed code reaches a live game.

**Host laptop** (the token goes on this screen only):

```
https://trivia.gogorichie.online/host?game=k7Qm29xRtpLm42&token=<host token>
```

**Display laptop:**

```
https://trivia.gogorichie.online/display?game=k7Qm29xRtpLm42
https://trivia.gogorichie.online/scoreboard?game=k7Qm29xRtpLm42
```

No `&sync=` is needed: on the deployed site sync is on by default. Settings are
remembered per game code, so a refresh does not need the full URL again.

### The badge is the go/no-go signal

At the T-60 check the host console badge must read **Sync live** in green.

| Badge | Meaning |
| --- | --- |
| `Sync live` | Connected. Changes reach the other laptop. |
| `Sync connecting…` | Opening the socket. Should settle in a second or two. |
| `Sync off — this laptop only` | Not configured. Host and display must share one laptop. |
| `Sync offline` | Cannot reach the worker; retrying with backoff. The game still runs locally. |
| `Sync error — Host token rejected` | The `token=` value is wrong. Fix it, or drop it and run on one laptop. |

---

## Two locks on the host console

Access and the host token protect different things, and both are needed.

**Cloudflare Access** decides *who may open the page*. It is scoped to
`trivia.gogorichie.online/host*` and currently allows one identity:
`Richard@gogorichie.com`, by email one-time code. Viewer pages are deliberately
outside it — nobody wants an auth prompt on a TV.

> ### The pretty-URL trap
>
> Cloudflare Pages serves `host.html` at **both** `/host` and `/host.html`. An
> Access application scoped to `/host.html` alone leaves `/host` completely
> open. That happened here and was caught by fetching the URL, not by reading
> the config.
>
> The wildcard `host*` covers both. **If page filenames ever change, re-test
> this by fetching the URL:**
>
> ```bash
> curl -s -o /dev/null -w "%{http_code}\n" https://trivia.gogorichie.online/host       # expect 302
> curl -s -o /dev/null -w "%{http_code}\n" https://trivia.gogorichie.online/host.html  # expect 302
> curl -s -o /dev/null -w "%{http_code}\n" https://trivia.gogorichie.online/display    # expect 200
> ```

**`HOST_TOKEN`** decides *who may change the game*. It is a Worker secret, sent
as `x-host-token` and compared in constant time so it cannot be guessed a
character at a time by timing responses. Viewer screens are handed a URL without
it, so the audience display cannot change a score — enforced at the worker, not
by the page being polite.

There is a test for exactly this: a display page issuing a direct `POST` gets a
403 and the host's scores are unchanged (`tests/e2e/sync.spec.js`, "the audience
display cannot change a score").

A token in a URL can still be shoulder-surfed or land in a screenshot, so:

- Do not project the host screen.
- Do not share the host URL in any group chat.
- Rotate it after the event (below).

### Adding another host

Zero Trust → Access → Applications → "St. Peter Trivia - Host Console" →
Policies → add the email. They get a one-time code by email. No password.

---

## Which free services are used

| Service | Used | Why |
| --- | --- | --- |
| **Pages** | Yes | Static hosting on a custom domain, free and unmetered for this size. |
| **Workers** | Yes | The sync endpoint. Free plan: 100,000 requests/day. |
| **Durable Objects** | Yes | One object per game code, holding state and fanning changes out over WebSocket. |
| **Workers Secrets** | Yes | `HOST_TOKEN`. |
| **Access (Zero Trust)** | Yes | Free for up to 50 users. Needs a domain in your Cloudflare account, which `gogorichie.online` is. |
| **DNS** | Yes | `trivia` and `trivia-sync` records, both proxied. |
| **Universal SSL** | Yes | Free, and the reason both subdomains are single-level. |
| **KV** | No | The free tier allows 1,000 writes/day. A live game writes on every score change and every question advance. Durable Object storage has no daily write cap. |
| **D1** | No | A live game is one small, frequently changing state document. The Durable Object already stores it consistently beside the WebSocket connections. |
| **R2** | No | Nothing large enough to need object storage. |
| **Turnstile** | No | No public form to protect. |
| **Zaraz / Web Analytics** | No | Nobody needs attendance analytics for a trivia night, and it adds a third-party script to a page that must work offline. |
| **Images / Stream** | No | Not free, and no image or video questions yet. |

> Free-tier limits move. Check
> <https://developers.cloudflare.com/workers/platform/limits/> and
> <https://developers.cloudflare.com/durable-objects/platform/pricing/>
> before relying on them for an event.

### Subdomains must stay single-level

Free Universal SSL covers `*.gogorichie.online` but **not** a second level.
`sync.trivia.gogorichie.online` would have no certificate without paid Advanced
Certificate Manager. That is why the worker is at `trivia-sync`, not
`sync.trivia`.

---

## Deploying by hand

CI deploys on every push to `main` once the repository secrets are set (below).
To deploy by hand:

```bash
# Worker
cd worker
npm install
npx wrangler login
npx wrangler deploy

# App
cd ..
rm -rf _site && mkdir _site
cp index.html host.html display.html scoreboard.html styles.css game.js import.js sync.js _site/
cp -r vendor _site/vendor
npx wrangler pages deploy _site --project-name=st-peter-trivia --branch=main
```

Check the worker afterwards:

```bash
curl https://trivia-sync.gogorichie.online/health
# {"ok":true,"hostTokenSet":true}
```

If `hostTokenSet` is `false` the worker refuses every write rather than
accepting anonymous ones. Set the secret before the event.

### Automatic deploys from CI

The `deploy` and `deploy-worker` jobs skip with a warning until **one** GitHub
repository secret exists:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A token with **Cloudflare Pages: Edit** and **Workers Scripts: Edit** |

The account ID is not a secret — it is a plain `env:` value in
`.github/workflows/ci-cd.yml`, and it appears in this document too.

### Creating the token

1. Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token**.
2. Choose **Create Custom Token**.
3. Name it something like `st-peter-trivia deploys`.
4. Permissions — add exactly these two, and nothing else:
   - `Account` · `Cloudflare Pages` · **Edit**
   - `Account` · `Workers Scripts` · **Edit**
5. Account Resources: **Include** → `Richard@gogorichie.com's Account`.
6. Optionally set a TTL. A token that expires is one less thing to remember.
7. **Continue to summary** → **Create Token**, then copy the value — Cloudflare
   shows it once.

### Storing it

GitHub → the repository → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**.

- Name: `CLOUDFLARE_API_TOKEN`
- Secret: the token value

### Checking it worked

Actions → **CI/CD** → **Run workflow** on `main`. The deploy jobs should run
rather than logging "CLOUDFLARE_API_TOKEN is not set; skipping deploy".

---

## Rolling back a bad deploy

Sometimes a deploy makes things worse. The app and the worker roll back
separately, and each one takes about a minute. Neither step needs a code
change, so you can do this during an event.

Work out which one broke first. If the pages load but the screens stop
following each other, it is the worker. If a page is blank or broken, it is
the app.

### Roll back the app (Pages)

Every Pages deploy is kept. Going back to an earlier one does not delete the
newer one.

1. Cloudflare dashboard → **Workers & Pages** → **st-peter-trivia**.
2. Open the **Deployments** tab.
3. Find the last deployment that worked. Check the commit message and time.
4. Use the **...** menu on that row → **Rollback to this deployment**.
5. Confirm. The custom domain serves the older build within a few seconds.

Reload `https://trivia.gogorichie.online` in a private window to check. A
private window avoids showing you a cached copy of the broken version.

### Roll back the worker

```bash
cd worker
npx wrangler deployments list     # shows recent versions, newest first
npx wrangler rollback [version-id] # leave the ID off to pick the previous one
```

Then check it answers:

```bash
curl https://trivia-sync.gogorichie.online/health
# {"ok":true,"hostTokenSet":true}
```

A rollback does **not** clear `HOST_TOKEN`, and it does **not** erase games
already stored in Durable Object storage. Screens reconnect on their own
within about 15 seconds, because `sync.js` keeps retrying with a backoff.

### What recovery preserves

Each game code maps to one Durable Object. Its state includes:

- The loaded game and current presentation step.
- Team names and table numbers.
- Each round score, manual adjustments, and calculated totals.
- The current question timer.
- A revision number that stops an older browser update from replacing newer
  scores.

The same state is cached in the host browser. If a write fails, the host keeps
working locally and retries the newest complete state. A fresh host browser
uses an authenticated read to restore the saved game before it can write.

D1 is not used for this workflow. Durable Objects fit the current need because
each live game is a small state document with frequent writes and connected
WebSocket viewers. A future reporting system that needs queries across many
events could add D1 separately.

### If you cannot reach the dashboard

The app is built to survive this. Sync is a convenience, not a requirement.

- Open each screen without `?sync=` on the URL. Every page then runs on local
  storage alone, exactly as it did before sync existed.
- The host laptop keeps the full game. Load the game file again with the file
  picker if you need to.
- If that still does not work, switch to Plan B. See
  `TRIVIA_NIGHT_GUIDANCE.md`.

### After you roll back

Open an issue describing what broke before you try the fix again. A rollback
hides the problem; it does not solve it.

---

## After the event

`AGENTS.md` asks for game data to be deleted afterwards.

```bash
# Rotate the host token so old URLs stop working.
cd worker && npx wrangler secret put HOST_TOKEN
```

To remove the sync backend and its stored games entirely:

```bash
npx wrangler delete           # deletes the worker and its Durable Objects
```

Tighten or remove Access in Zero Trust → Access → Applications.

---

## Running it locally

```bash
cd worker
echo 'HOST_TOKEN="test-token-abc"' > .dev.vars   # gitignored
npx wrangler dev --port 8787 --local
```

Then from the repository root:

```bash
SYNC_URL=http://localhost:8787 SYNC_TOKEN=test-token-abc npx playwright test tests/e2e/sync.spec.js
```

These tests skip when `SYNC_URL` is unset, so CI stays green without a worker.
Local pages never reach the production worker: sync only defaults on when the
page is served from `trivia.gogorichie.online`.
