# St. Peter Trivia Night

A lightweight, browser-based trivia application for **St. Peter Evangelical Lutheran Church in Gilberts, Illinois**.

The app is being built for Trivia Night on **Saturday, September 19, 2026**. It is designed to run from laptops connected to the church TVs/projector and provide separate host, audience, and scoreboard views.

## Current Status

This repository currently contains an MVP for game-night testing.

Implemented:

- Host console
- Audience-facing question/answer display
- Ranked scoreboard
- Team creation and score adjustment
- Next/Back game navigation
- Round, question, answer reveal, and tiebreaker states
- JSON game-file loading
- **Spreadsheet import for questions and teams (.csv, .xlsx)**
- **Cross-laptop synchronisation via Cloudflare Workers (optional)**
- **Read-only audience screens, enforced at the worker**
- Mock question and team datasets
- Large-format TV/projector styling
- **Unit tests for the importer and Playwright browser tests for the game flow**
- **Accessibility checks (axe-core) and Lighthouse budgets**
- GitHub Actions CI/CD pipeline
- GitHub Pages deployment workflow
- **CodeQL scanning and Dependabot updates**

Still planned:

- Host authentication (Cloudflare Access needs a domain; see below)
- Timer
- Improved score-entry workflow
- Animations/transitions
- Download/export scores

> The app runs on one laptop with no accounts at all. Cross-laptop sync is
> optional: if the worker is not configured or cannot be reached, every page
> falls back to local storage and behaves as it did before.

## App Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `host.html` | Host controls, team management, scoring, and game-file loading |
| `display.html` | Audience-facing question and answer display |
| `scoreboard.html` | Ranked team scoreboard |

Use the same game code on each view:

```text
host.html?game=k7Qm29xRtp
display.html?game=k7Qm29xRtp
scoreboard.html?game=k7Qm29xRtp
```

For the event, use a long random game code rather than an easily guessed value.

## Game Format

The current plan calls for:

- **5 rounds**
- **8 questions per round**
- **40 scored questions**
- **1 tiebreaker**
- 1 point per normal question
- Approximately 3 easy, 3 medium, and 2 hard questions per round
- A halftime break after Round 3

See [TRIVIA_NIGHT_GUIDANCE.md](TRIVIA_NIGHT_GUIDANCE.md) for the full event plan and run-of-show.

## Game Data

The host console loads a questions spreadsheet, a team list, or a JSON game
file through one file picker. Which kind of sheet it is, is worked out from the
column headings.

Headings are matched loosely, so `Host Notes`, `host_notes` and `HOST-NOTES`
all resolve, as do `1`, `Round 1`, `R3`, `Tiebreaker` and `TB` in the round
column. When a required column cannot be found, the import fails and shows the
headings it actually saw rather than importing a half-built game.

The development fixture is:

```text
fall-trivia.game.json
```

Temporary spreadsheet-style development data is stored under:

```text
mock/questions.csv
mock/teams.csv
```

These files are **mock data only**. The final questions and team names will come from spreadsheets supplied for the event.

See [MOCK_DATA.md](MOCK_DATA.md) for the current expected columns.

### Questions

Current mock schema:

```text
round,category,question,answer,difficulty,points,host_notes
```

### Teams

Current mock schema:

```text
team_name,table_number
```

The importer should tolerate reasonable variations in spreadsheet column names when the final files are provided.

## Cross-Laptop Sync

Optional, and off unless configured. See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)
for deployment, the host token, and why Cloudflare Access is not usable without
a domain.

```text
host.html?game=<code>&sync=https://<worker>.workers.dev&token=<host token>
display.html?game=<code>&sync=https://<worker>.workers.dev
```

The token goes on the host screen only. Viewer screens have nothing to send, so
they cannot change a score.

The host console shows a sync badge; at the T-60 go/no-go check it must read
**Sync live**.

## Testing

```bash
npm install
npm run test:unit    # importer unit tests
npm run test:e2e     # Playwright browser tests
npm test             # both
```

Sync tests need the worker running and skip without it:

```bash
cd worker && npx wrangler dev --port 8787 --local
SYNC_URL=http://localhost:8787 npx playwright test tests/e2e/sync.spec.js
```

## Running Locally

This is currently a static HTML/CSS/JavaScript application, so no build step is required.

For basic testing, serve the repository with a local web server. For example, with Python installed:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Opening the HTML files directly may work for basic testing, but a local web server more closely matches GitHub Pages behavior.

## CI/CD

The workflow is located at:

```text
.github/workflows/ci-cd.yml
```

On pull requests to `main`, CI:

1. Verifies required application files.
2. Validates `fall-trivia.game.json`.
3. Validates the mock question and team CSV schemas.
4. Checks important internal page references.

It also runs the importer unit tests, the Playwright browser suite, and
Lighthouse (accessibility asserted at 100). Dependabot is configured in
`.github/dependabot.yml`.

CodeQL runs through GitHub's **default setup**, enabled in the repository's
Security settings rather than by a workflow file. A committed CodeQL workflow
cannot coexist with it — the analysis is rejected with "CodeQL analyses from
advanced configurations cannot be processed when the default setup is enabled"
— so this repository has no `codeql.yml`.

Default setup scans `vendor/`, which holds third-party minified builds. If that
raises alerts nobody here can act on, exclude the path from
Security → Code scanning → CodeQL → Configure, rather than by adding a
workflow.

On successful pushes to `main`, the deployment job publishes to **GitHub Pages**.

The deploy publishes the app shell only. Anything published there is
world-readable, so question and answer data is deliberately excluded — `mock/`
holds an answer key, and the real game file would too. The deploy fails if any
question or answer data reaches the publish directory. The host loads the game
file from the laptop through the file picker.

GitHub Pages must be configured to use **GitHub Actions** as its deployment source.

## Game-Night Reliability

The application is not the only game-night option. The event plan intentionally includes a no-code fallback:

- PowerPoint or Google Slides for questions and answer reveals
- Spreadsheet-based scoreboard
- Printed answer key
- Paper tally sheet

A go/no-go test should be performed at the venue before the event. If the app is not reliable on both laptops and the church display equipment, use the fallback rather than troubleshooting during the event.

## Security

The planned one-night Firebase MVP may temporarily use permissive test-mode rules while authentication is unfinished.

When Firebase synchronization is added:

- Use a long random game code.
- Do not share host/display URLs publicly.
- Delete event game data afterward.
- Add host authentication and restrictive Firebase rules before future events.

## Repository Structure

```text
.
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci-cd.yml
│       └── codeql.yml
├── docs/
│   └── CLOUDFLARE.md
├── mock/
│   ├── questions.csv
│   └── teams.csv
├── tests/
│   ├── import.test.js
│   └── e2e/
│       ├── a11y.spec.js
│       ├── game-flow.spec.js
│       └── sync.spec.js
├── vendor/
│   ├── papaparse.min.js
│   └── xlsx.full.min.js
├── worker/
│   ├── src/index.js
│   └── wrangler.toml
├── display.html
├── fall-trivia.game.json
├── game.js
├── host.html
├── import.js
├── index.html
├── lighthouserc.json
├── MOCK_DATA.md
├── package.json
├── playwright.config.js
├── scoreboard.html
├── styles.css
├── sync.js
└── TRIVIA_NIGHT_GUIDANCE.md
```

## Event

**St. Peter Evangelical Lutheran Church**  
985 Galligan Road  
Gilberts, IL 60136

Game night: **Saturday, September 19, 2026**
