# Trivia Night

Trivia Night is a simple web app for running a live trivia game at any venue — a hall, a pub, a classroom, a fundraiser.

The app gives the host one screen to run the game, an audience screen for questions and answers, and a scoreboard screen. It is built to work on ordinary laptops driving large TVs or projectors.

A live instance runs at <https://trivia.gogorichie.online>.

## What the app does

The app has three main screens:

| Screen | What it does |
| --- | --- |
| Host | Runs the game, loads questions and teams, and changes scores |
| Display | Shows rounds, questions, and answers to the audience |
| Scoreboard | Shows team rankings and scores |

The host can load questions and team names from CSV or Excel files. The app checks the files and gives a useful error if something is wrong.

The app can also keep two laptops in sync. For example, one laptop can run the host screen while another laptop is connected to the projector.

## Why this project exists

This project was built to run a live trivia night without a lot of moving parts. The main goals are simple:

- Make the game easy for a volunteer to run.
- Make questions easy to read from across the room.
- Keep scores safe if a browser is refreshed.
- Let separate laptops stay in sync.
- Keep a simple backup plan if the internet or cloud service fails.

The project uses plain HTML, CSS, and JavaScript. There is no web framework or build step. This keeps the app small and makes it possible to run a local copy if needed.

## Current features

The project currently includes:

- Host controls that name the next game step.
- Separate question and answer-review phases.
- Round-by-round score entry with automatic totals.
- A ranked scoreboard that preserves ties.
- Final results and a downloadable CSV report.
- CSV and Excel imports for questions and teams.
- Five-round games and a tiebreaker.
- An optional 45-second countdown for each question, off unless you ask for it.
- Local browser storage for game state.
- Optional cross-laptop sync using Cloudflare Workers and Durable Objects.
- Cloudflare Access protection for the host page.
- A host token that protects game-changing API requests.
- Automated unit, browser, accessibility, and Lighthouse tests.
- GitHub Actions for testing and deployment.
- CodeQL security scanning and Dependabot updates.

Short presentation transitions are included and turn off automatically when a
device requests reduced motion.

### Question timer

The timer is off by default. A whole game can be run without it.

To switch it on, add `&timer=45` to the host address:

```
host.html?game=k7Qm29xRtp&timer=45
```

The number is how many seconds each question gets. Use `&timer=0` to turn it
off again.

Once it is on:

- Every question starts its own countdown. Round cards and answers do not.
- The audience screen shows the time left. It needs no address of its own.
- The host can restart, pause, or clear the timer at any point.
- The timer never moves the game along. When it runs out it says "Time's up"
  and waits for you. Next and Back keep working the whole time.

To keep one screen clear while others show the countdown, add `&timer=0` to
that screen's address.

## How a game works

A normal game follows this path:

1. The host loads the question and team files.
2. The lobby stays on screen until everyone is ready.
3. The host shows the round title and every question.
4. After answer sheets are collected, the host reviews every answer.
5. The host enters one score per team for that round.
6. The game continues through the remaining rounds.
7. A tiebreaker question and answer are available.
8. The final-results screen announces the winner or tied winners.
9. The host downloads a CSV file with every round score and total.

The default format is five rounds with eight questions per round, plus a tiebreaker. Question and team files decide the actual shape of a game.

## Question and team files

The host can load CSV or Excel files. The app uses the column headings to decide whether a file contains questions or teams.

A question file can use columns like:

```text
round,category,question,answer,difficulty,points,host_notes
```

A team file can use:

```text
team_name,table_number
```

The importer accepts common heading differences. For example, `Host Notes`, `host_notes`, and similar names can be understood.

Files in the `mock/` folder are sample data. Replace them with your own questions and teams for a real game.

See `MOCK_DATA.md` for more details.

## Running the app locally

You do not need a build step.

From the project folder, start a basic local web server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

The app can work without Cloudflare sync. In that mode, each laptop uses its own browser storage.

## Cross-laptop sync

The deployed app uses a Cloudflare Worker and Durable Objects to share live
game state between laptops. The saved state includes the current step, loaded
game, teams, table numbers, round scores, adjustments, totals, and timer.

The host is allowed to change the game. Audience and scoreboard screens are read-only.

If sync stops working, the host keeps using its local copy and retries the
newest complete state. A fresh host browser restores the authoritative Durable
Object state before it makes changes.

For setup, deployment, and recovery details, see `docs/CLOUDFLARE.md`.
That file also explains how to roll back a bad deploy, for both the app and the Worker.

## Security

The host side has two protections:

- **Cloudflare Access** controls who can open the host page.
- **HOST_TOKEN** controls who can send game-changing requests to the Worker.

The token is stored as a Cloudflare secret and is not committed to this repository.

Question and answer files are also kept out of the public deployment. The host loads them from the local laptop.

## Testing

Install the exact development package versions from the lockfile:

```bash
npm ci
```

Run all tests:

```bash
npm test
```

You can also run them separately:

```bash
npm run test:unit
npm run test:e2e
```

The browser tests check important game behavior such as importing files,
showing every question before answer review, scoring teams, refreshing the
browser, and keeping answers hidden until the host reveals them.

Cross-laptop sync tests use a local Cloudflare Worker and are documented in `docs/CLOUDFLARE.md`.

## Main project files

| File or folder | Purpose |
| --- | --- |
| `host.html` | Host controls |
| `display.html` | Audience screen |
| `scoreboard.html` | Scoreboard |
| `game.js` | Shared game and local-state logic |
| `import.js` | Question and team file import |
| `timer.js` | Optional question countdown |
| `sync.js` | Optional cross-laptop sync |
| `worker/` | Cloudflare sync Worker |
| `tests/` | Automated tests |
| `mock/` | Development question and team files |
| `docs/CLOUDFLARE.md` | Cloudflare setup and operations |
| `example.game.json` | Example game-file structure |
| `TRIVIA_NIGHT_GUIDANCE.md` | Reusable event planning and run-of-show guide |
| `AGENTS.md` | Instructions for AI coding agents |

## Game-night backup

The web app is not the only way to run the event. A backup plan can use slides for questions, a spreadsheet for scores, a printed answer key, and a paper tally sheet.

This is intentional. A trivia night should not stop because a web service or Wi-Fi connection has a problem.

## Reusing the app

Nothing in the app is tied to one venue or one night. To run your own event:

1. Put your questions and teams in CSV or Excel files using the columns above.
2. Serve the files in this folder from any static host, or run them locally.
3. Pick a fresh `?game=` code for each event and use it on all three screens.
4. Optionally deploy the Worker in `worker/` if you need two laptops in sync.

See `TRIVIA_NIGHT_GUIDANCE.md` for a run-of-show you can reuse each time.
