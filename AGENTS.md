# AGENTS.md

## Purpose

This repository contains the **Trivia Night** application: a browser-based tool for running a live trivia game at any venue.

AI coding agents working in this repository should prioritize **game-night reliability, readability, and simplicity** over architectural sophistication. The app is reused for one event after another, so every change has to survive somebody else's game night, not just the next one.

## Read First

Before making changes, review:

1. `README.md` — current application architecture and status.
2. `TRIVIA_NIGHT_GUIDANCE.md` — reusable event plan, priorities, and run-of-show.
3. `MOCK_DATA.md` — temporary spreadsheet schemas.
4. `example.game.json` — game-data structure.
5. `docs/CLOUDFLARE.md` — hosting, sync, Access, and post-event cleanup.

Treat the guidance document as the product requirements for a game night.

## Primary Goal

The app should reliably support a live trivia event using:

- A host laptop/control view.
- An audience-facing question/answer display.
- A separate scoreboard.
- Team score tracking.
- Approximately five rounds of eight questions.
- A tiebreaker.
- Large, readable presentation on venue TVs/projectors.

The host should be able to operate the game without technical knowledge during the event.

## MVP Priorities

For any upcoming event, prioritize work in this order:

1. Reliable question and answer presentation.
2. Reliable team and score handling.
3. Cross-laptop synchronization.
4. Importing the supplied question spreadsheet.
5. Importing the supplied team spreadsheet.
6. Large, readable 1920×1080 presentation.
7. Recovery from refresh/reconnect without losing game state.

Do not spend event-critical time on cosmetic features while core game flow is incomplete.

## Tech Stack

The application is still plain HTML, CSS and JavaScript with no build step and
no framework. That is deliberate: the host must be able to open a file and have
it work. Everything below is additive to that, and the app degrades to a single
laptop if any of it is unavailable.

| Concern | Choice | Notes |
| --- | --- | --- |
| Hosting | **Cloudflare Pages** | `trivia`, served at `https://trivia.gogorichie.online`. Direct upload; no build command. |
| Host authentication | **Cloudflare Access** | Path-scoped to `trivia.gogorichie.online/host*`. Viewer pages stay open. |
| Cross-laptop sync | **Cloudflare Workers** + **Durable Objects** | `trivia-sync` at `https://trivia-sync.gogorichie.online`. One Durable Object per game code. |
| Spreadsheet import | **PapaParse** + **SheetJS** | Vendored under `vendor/`, never a CDN. |
| Unit tests | **node:test** | Built in; no test framework dependency. |
| Browser tests | **Playwright** | Run at 1920x1080 against the real pages. |
| Accessibility | **axe-core** | WCAG 2.1 A/AA on all four pages. |
| Performance/quality budgets | **Lighthouse CI** | Accessibility asserted at 100. |
| CI/CD | **GitHub Actions** | Validate, test, Lighthouse, then deploy. |
| Code scanning | **CodeQL** | GitHub *default setup*, configured in Security settings. Do not add a `codeql.yml`; an advanced config cannot coexist with default setup and will fail. |
| Dependency updates | **Dependabot** | Monthly, grouped, npm and Actions. |

### Subdomains must stay single-level

Free Universal SSL covers `*.gogorichie.online` but **not** a second level. A
hostname like `sync.trivia.gogorichie.online` would have no certificate without
paid Advanced Certificate Manager. Use `trivia-sync`, not `sync.trivia`.

### Pretty URLs change what Access must cover

Cloudflare Pages serves `host.html` at both `/host` and `/host.html`. An Access
application scoped to `/host.html` alone leaves `/host` wide open — this was a
real hole, found by testing rather than by reading. The application is scoped to
`trivia.gogorichie.online/host*`.

**Any change to page filenames means re-checking the Access path**, and
re-checking it by fetching the URL, not by reading the config.

## Current Architecture

Important files:

- `index.html` — landing page.
- `host.html` — host controls. Behind Cloudflare Access.
- `display.html` — audience display.
- `scoreboard.html` — scoreboard.
- `game.js` — shared game/state logic and `esc()`.
- `import.js` — spreadsheet import.
- `sync.js` — optional cross-laptop sync; a no-op when unconfigured.
- `timer.js` — optional question countdown; inert unless `?timer=` is given.
- `styles.css` — shared presentation styling.
- `vendor/` — PapaParse and SheetJS, vendored.
- `worker/` — the Cloudflare Worker and its Durable Object.
- `example.game.json` — example game file.
- `mock/questions.csv`, `mock/teams.csv` — temporary fixtures.

Avoid introducing a framework or build system unless there is a clear,
event-critical reason. Adding a build step means the host can no longer open the
files directly, which removes a fallback.

### Escaping

Questions, answers and team names come from a spreadsheet someone else typed.
Every value interpolated into `innerHTML` goes through `esc()` in `game.js`.
Adding a new interpolation without it is a bug, not a style preference.

## Data Sources

The final game content will come from **two spreadsheets supplied by the event organizer**:

1. Questions spreadsheet.
2. Team names spreadsheet.

The spreadsheets should become the source of truth when provided.

Do not hard-code final questions or team names into application logic.

Current mock files are development fixtures only and may be replaced at any time.

### Expected Question Fields

Current mock schema:

```text
round,category,question,answer,difficulty,points,host_notes
```

### Expected Team Fields

Current mock schema:

```text
team_name,table_number
```

Spreadsheet import is implemented in `import.js` and tolerates reasonable
heading variations. When a required column cannot be identified it fails with
the headings it actually saw, and reports problem rows by spreadsheet line
number — all of them at once, never a half-built game.

Keep it that way. Silently dropping a row is worse than refusing the file: a
question missing at Round 3 on the night cannot be recovered.

## Game State

A game state should be sufficient to restore the live game after a browser refresh.

At minimum preserve:

- Game identifier.
- Current round.
- Current question/state.
- Team names.
- Team scores.
- Loaded game data or a stable reference to it.

Do not require the host to reconstruct scores manually after a refresh.

## Cross-Laptop Sync

Implemented in `worker/` and `sync.js`. See `docs/CLOUDFLARE.md` for deployment.

The rules that matter when changing it:

- **Sync is additive and must stay that way.** With no sync configured, or the
  worker unreachable, every page falls back to local storage and behaves as it
  did before. A sync outage is not a game outage. Any change that makes a page
  depend on the worker to function is wrong.
- **Local storage is written first**, then the state is posted. The host keeps
  working when the POST fails.
- **Only the host writes.** Writes require the `HOST_TOKEN` header, compared in
  constant time. Viewer screens are handed a URL without a token, so the
  audience display and scoreboard cannot change a score. This is enforced at the
  worker, not by the page being polite — keep it that way.
- **A reconnecting screen is sent current state first**, so a laptop that
  dropped off the wi-fi catches up rather than showing a stale question.
- **Durable Object storage, not KV.** The KV free tier allows 1,000 writes a
  day and a live game writes on every score change.
- The host console shows a sync badge. Silence about sync during a game is worse
  than no sync at all; keep failures visible.

On the deployed site sync defaults on. Anywhere else — localhost, a `file://`
copy, a test run — it stays off unless `?sync=` is given, which keeps the test
suite off the production worker.

### Secrets

`HOST_TOKEN` is a Worker secret set with `wrangler secret put`. It is never in
the repository, never a `[vars]` entry, and never in a commit. The worker
refuses all writes when it is unset rather than accepting anonymous ones.

Deploys from CI need one GitHub repository secret, `CLOUDFLARE_API_TOKEN`,
scoped to Cloudflare Pages: Edit and Workers Scripts: Edit. The account ID is
an identifier rather than a credential and is a plain `env:` value in the
workflow. The deploy jobs skip with a warning when the token is absent rather
than failing the build.

## Question Timer

An optional per-question countdown, implemented in `timer.js` for #10. It is a
feature that shipped on a game day, which was only reasonable because
it is off unless asked for.

The rules that matter when changing it:

- **Off by default, and it must stay that way.** With no `?timer=` on the host
  URL, no control appears, no timer state is written, and every screen behaves
  as it did before the timer existed. A host who never asks for it should not
  be able to tell it is there.
- **The timer never drives the game.** It does not advance a question, block
  Next or Back, or change a score. At zero it says "Time's up" and waits. A
  countdown that can move the game on is a countdown that can move it on at the
  wrong moment.
- **One deadline, not a stopwatch per screen.** State is an absolute `endsAt`,
  so every screen counts down to the same moment rather than starting its own
  clock from whenever it received the state. A screen whose clock is off is
  wrong by its own skew, so the remaining time is clamped to the duration and
  can never read longer than the timer was set for.
- **Ticks repaint; they do not save.** State is written on host actions only. A
  tick that called `saveState` would post to the worker four times a second for
  the length of every question.
- **The arithmetic stays out of the DOM.** `timer.js` holds pure functions so
  the maths is tested without a browser. A timer that is wrong on the wall is
  not something to find out during a round.
- **The display needs no flag of its own.** Timer state travels with the game
  state the host already syncs. A single screen opts out with `?timer=0`.

The worker relays `timer` without an opinion about it, the same way it relays
`teams`. A worker that has not been redeployed drops the field, and the
countdown falls back to the host's own screen — the same degradation the sync
rules ask for.

## Display Requirements

The audience may be viewing from approximately 20 feet away.

Therefore:

- Prefer very large typography.
- Maintain strong contrast.
- Keep question wording visually uncluttered.
- Avoid unnecessary controls or browser-like UI on audience screens.
- Design primarily for 1920×1080 displays.
- Remain usable on smaller screens for testing.
- Do not rely on color alone to convey important information.

The audience display must never reveal an answer before the host triggers the answer-reveal state.

## Host Experience

The host console should make the normal game path obvious.

Core controls:

- Previous.
- Next.
- Reveal answer / advance state.
- Team management.
- Score entry.
- Show scoreboard.
- Load/import game data.

Potentially destructive actions such as resetting a game should require confirmation.

Avoid workflows that require editing JSON manually during the event.

## Scoring

Normal questions are currently planned for one point each, although the data model should respect a question's configured point value.

The scoreboard should:

- Rank teams by total score.
- Update after score entry.
- Remain readable on a TV.
- Preserve scores across refreshes.

Do not silently resolve ties. The game includes a separate tiebreaker.

## Question Integrity

Questions should have:

- One clear, checkable answer.
- Accepted alternate answers where needed.
- Category/round.
- Difficulty.
- Point value.
- Host notes when appropriate.

Do not change factual question content merely to make application development easier.

## Testing

`AGENTS.md` used to ask for the game flow to be tested rather than only checking
that files parse. That is now enforced by actual tests. Run them.

```bash
npm run test:unit    # importer, node:test
npm run test:e2e     # Playwright, real browser
npm test             # both
```

Sync tests need the worker and skip without it:

```bash
cd worker && npx wrangler dev --port 8787 --local
SYNC_URL=http://localhost:8787 SYNC_TOKEN=test-token-abc npx playwright test tests/e2e/sync.spec.js
```

`CHROMIUM_PATH` points Playwright at a pre-installed browser when one exists;
CI leaves it unset.

### What the tests cover

- `tests/import.test.js` — heading variants, round-column shapes, every
  loud-failure path, and the real mock spreadsheets.
- `tests/e2e/game-flow.spec.js` — the lobby → round → all questions → answer
  review → scoring → final-results walk, that the
  display never reveals an answer early, scoreboard ranking, state surviving a
  refresh, team names containing quotes and angle brackets, and question text
  rendering at 48px or larger.
- `tests/e2e/a11y.spec.js` — axe-core on all four pages, and on the host and
  display with a countdown actually on screen.
- `tests/timer.test.js` — the countdown arithmetic: `?timer=` parsing,
  pause and resume, clamping, rounding, and the spoken labels.
- `tests/e2e/timer.spec.js` — one test per acceptance criterion on #10,
  including two displays agreeing on the time left, navigation still
  working after expiry, and the timer staying invisible when not asked for.
- `tests/e2e/sync.spec.js` — two isolated browser contexts standing in for the
  two laptops, including reconnect catch-up and a viewer's write being refused.

### Before merging an event-critical change

Add a test for the behaviour you changed. A change to the game flow, the
importer, sync, or the timer without a test is not finished.

Then confirm by hand on the host laptop, in the host browser, against the real
game file — CI passing is necessary, not sufficient.

### Do not weaken a test to get green

Never skip, disable or quarantine a test to make a change pass. If a test is
wrong, fix the test and say so in the commit message.

## CI/CD

`.github/workflows/ci-cd.yml` runs on pull requests and on pushes to `main`:

1. **validate** — required files, game JSON, mock CSV schemas, page references,
   and a warning when the game fixture still holds placeholder content.
2. **test** — importer unit tests and the Playwright suite.
3. **lighthouse** — all four pages; accessibility asserted at 100.
4. **deploy** — Cloudflare Pages, on `main` only.
5. **deploy-worker** — the sync worker, on `main` only.

Do not disable validation to make a failing change pass.

### The deploy publishes the app shell only

Anything published is world-readable. `mock/questions.csv` is an answer key, and
the real game file would be another. The deploy copies only the pages, styles,
scripts and `vendor/`, then **fails** if any `.csv` or `.game.json` reaches the
publish directory. Do not add question data to that copy step.

The host loads the game file from the laptop through the file picker, which is
why none of it needs publishing.

Checking this from outside needs care. Pages answers **200 with the landing
page** for any path it does not have, so a status-code check on
`/mock/questions.csv` or `/example.game.json` returns 200 whether or not the
file was published. Compare the response body or its content type, never the
status code alone. The CI step above inspects the publish directory directly,
which is why that is the check that counts.

### CodeQL

Configured through GitHub's **default setup** in Security settings. Do not add
a CodeQL workflow file: an advanced configuration cannot coexist with default
setup, and the analysis fails with "CodeQL analyses from advanced configurations
cannot be processed when the default setup is enabled".

## General Application Development Guidance

These rules apply to all application work in this repository, not only event-critical changes.

### Documentation readability

- Write project documentation for an **8th-grade reading level** unless the document is specifically for a technical audience that requires precise technical language.
- Prefer short sentences, common words, clear headings, and concrete examples.
- Explain acronyms and specialized terms the first time they appear.
- Do not remove necessary technical accuracy just to make the wording simpler.
- README content should be understandable to someone who finds the project with no prior context.

### Work from the backlog

- Every non-trivial change should map to a GitHub **Feature**, **Task**, or **Bug**.
- Features describe a user-facing or architectural capability; Tasks are discrete implementation work; Bugs describe accepted behavior that is broken.
- When a Task belongs to a Feature, keep that relationship explicit in GitHub and in the issue description until native sub-issue relationships are available.
- Read the issue and its acceptance criteria before coding. Do not silently expand scope.
- If implementation uncovers unrelated work, create or recommend a separate Task/Bug instead of folding it into the current change.

### Design and implementation

- Prefer the smallest design that satisfies the acceptance criteria and preserves existing behavior.
- Keep UI, domain/state logic, persistence, and external-service integration separated enough to test independently.
- Treat D1 as durable relational state, R2 as object/media storage, and KV only as optional low-write/read-heavy configuration or cache. Do not use a storage service merely because it exists.
- Keep Cloudflare-specific code behind clear boundaries so core game behavior can be exercised locally.
- Preserve graceful degradation. A temporary network or sync failure must not unnecessarily make the local host unusable.
- Validate all data at trust boundaries: spreadsheet imports, query parameters, API requests, persisted records, and external responses.
- Escape untrusted content before inserting it into HTML.
- Never expose secrets, tokens, private keys, or privileged backend bindings to browser code.
- Prefer accessible semantic HTML and keyboard-operable controls. Do not rely on color alone.
- Avoid premature abstraction. Extract shared behavior when duplication is meaningful, not merely because two lines look similar.
- Delete dead code when replacing behavior; do not leave parallel implementations without a documented migration reason.

### API and data changes

- Define request/response shapes and failure behavior before adding a new API endpoint.
- Return useful, non-sensitive errors. Never leak credentials, stack traces, or internal bindings to users.
- Make destructive operations explicit and require confirmation where appropriate.
- Use versioned D1 migrations for schema changes. Do not edit deployed schema manually as the normal workflow.
- Prefer backward-compatible changes when clients may be running on multiple devices during an event.
- Keep authoritative totals derivable from auditable score data where practical rather than storing only an opaque mutable total.

### Testing and quality

- Add or update tests for changed behavior.
- Bugs should receive a regression test whenever practical.
- Test both the success path and important failure/recovery paths.
- Run the narrowest relevant tests while developing, then the full required suite before merging.
- Do not weaken assertions, disable checks, or hide errors merely to make CI pass.
- Treat lint/static-analysis/security findings as engineering feedback; fix or explicitly document legitimate exceptions.
- Verify user-facing changes in a real browser at the intended viewport in addition to automated tests.

### Pull requests and reviews

- Keep changes focused enough to review and revert independently.
- PR descriptions should explain **what changed, why, how it was tested, and any deployment/migration impact**.
- Link the Feature/Task/Bug being implemented.
- Call out D1 migrations, Cloudflare binding changes, secrets/configuration requirements, and rollback considerations.
- Do not mix unrelated cleanup with feature or bug work unless the cleanup is required for the change.

## Conventional Commits

All commit messages must follow **Conventional Commits**.

### Format

```text
<type>(optional-scope): <description>

[optional body]

[optional footer(s)]
```

Use an imperative, concise description. Keep the subject focused on the change, not the implementation process.

### Allowed types

- `feat` — a new user-facing or architectural capability.
- `fix` — a bug fix.
- `refactor` — code restructuring with no intended behavior change.
- `perf` — a performance improvement.
- `test` — adding or correcting tests.
- `docs` — documentation-only changes.
- `build` — build system, dependencies, or packaging changes.
- `ci` — CI/CD workflow changes.
- `chore` — maintenance that does not fit another type.
- `style` — formatting-only changes with no behavior change.
- `revert` — reverting a previous commit.

Prefer a useful scope when it improves clarity, such as `host`, `display`, `scoreboard`, `sync`, `worker`, `d1`, `r2`, `import`, or `ci`.

### Examples

```text
feat(import): add team spreadsheet validation
fix(sync): restore current state after reconnect
refactor(scoring): separate round totals from rendering
test(display): prevent answers from appearing before reveal
ci(deploy): publish Worker after validation passes
docs: document Cloudflare development workflow
```

### Breaking changes

Use `!` and a `BREAKING CHANGE:` footer when a change intentionally breaks an existing interface, data format, deployment contract, or API.

```text
feat(api)!: replace legacy game-state endpoint

BREAKING CHANGE: clients must use /api/games/:id/state.
```

Breaking changes require an explicit migration and rollback plan.

### Issue references

When a commit implements or fixes tracked work, reference the issue in the footer when useful:

```text
feat(d1): persist round score entries

Refs #15
```

Use `Closes #123` only when that single commit/PR actually completes the issue. Do not close a Feature when only one of its Tasks is complete.

### Commit hygiene

- One logical change per commit.
- Do not use vague subjects such as `updates`, `fix stuff`, `changes`, or `WIP` on shared branches.
- Do not bundle formatting, dependency upgrades, and behavior changes into one commit unless inseparable.
- Never mention or include secrets in a commit message.
- A commit should be safe to revert without unintentionally removing unrelated work.

## Change Strategy

Because this is a live-event application with a short deadline:

- Prefer small, understandable changes.
- Avoid broad refactors unless necessary.
- Preserve working behavior while adding features.
- Make failures visible rather than silently ignoring them.
- Keep a usable fallback path.
- Do not introduce unnecessary dependencies.
- Do not commit secrets, credentials, private keys, or service-account files.

## Game-Day Change Policy

Code **may** be pushed on game day. Event-critical work is not always finished
the night before, and forcing a hard freeze onto an unfinished MVP pushes the
event onto Plan B for reasons that were fixable.

Game-day pushes are allowed under the gates below. The gates are the point —
without them this section is just "push whatever."

### Gate 1: Hard cutoff

**All pushes stop at T-60 minutes**, the venue go/no-go checkpoint in
`TRIVIA_NIGHT_GUIDANCE.md`.

After the cutoff the repository is frozen for the night. Whatever is running on
the host laptop at T-60 is what runs the event. If it is not good enough at
that moment, the answer is Plan B, not another commit.

Never push, deploy, or reload the deployed site while a round is in progress.

### Gate 2: Scope

On game day, change only what the event needs to run:

- Bugs that block the host, display, scoreboard, or scoring.
- Getting the real question and team data into the app.
- Readability fixes on the actual venue display equipment.

Do not, on game day:

- Refactor, reorganize, or rename anything working.
- Add a framework, build step, dependency, or third-party service.
- Start work that cannot be finished and rehearsed before the cutoff.
- Touch CI validation to make a change pass.

If a fix cannot be explained in one sentence, it is not a game-day fix.

### Gate 3: Rehearsed, not just green

CI passing is necessary and not sufficient. CI checks that files parse; it does
not check that the game plays.

Before a game-day change counts as done, run it **on the host laptop, in the
host browser, against the real game file**:

1. Load the game data.
2. Advance from the lobby through a round, its questions, answer review, and
   scoring screen, then go back.
3. Add a team, change a score, confirm the scoreboard reorders.
4. Refresh every open window and confirm nothing was lost.

### Gate 4: Rollback path

Every game-day push must be revertible in under five minutes:

- Push small, single-purpose commits. No batched changes.
- Know the last good commit SHA before pushing the next one.
- Rolling back is `git revert <sha>`, push, and wait for Pages to redeploy.
- Because a redeploy is not instant, keep a known-good copy of the game file
  saved locally so the host can reload it without waiting on a deploy.

If a rollback is needed after the cutoff, do not roll back. Go to Plan B.

### Gate 5: Plan B stays warm

Plan B is not retired by a successful game-day push. Keep the slides,
the spreadsheet scoreboard, the printed answer key, and the paper tally sheet
ready until the event is over.

## Plan B Is a Feature

The no-app fallback is intentional and should remain viable:

- PowerPoint or Google Slides for questions/answers.
- Spreadsheet scoreboard.
- Printed answer key.
- Paper tally sheet.

Do not make operational plans depend exclusively on the web app until it has passed the venue rehearsal.

## Definition of Done for Event MVP

The MVP is ready for game night when:

- The event's question spreadsheet imports successfully.
- The event's team spreadsheet imports successfully.
- Host, display and scoreboard work on the intended laptops.
- Cross-laptop state synchronisation is reliable, and the host badge reads
  **Sync live**.
- Scores survive refresh and reconnect.
- The full game can be rehearsed from lobby through tiebreaker.
- Text is readable on the actual venue display equipment.
- `npm test` passes and CI is green.
- `/host` and `/host.html` both redirect to Cloudflare Access; `/display` and
  `/scoreboard` do not.
- A no-code backup is ready.

## Between Events

Work that belongs in the quiet stretch between game nights:

- Tighter Cloudflare Access policies and a shorter Access session.
- Image questions.
- CSV conversion tools.
- Improved administration tools.

These features should not compromise the stability of the core game flow.

The countdown timer shipped on a game day (#10, PR #31). Presentation
transitions and score downloads shipped later (#11 and #12, PR #39). See
**Question Timer** above for the timer rules that must remain in place.
