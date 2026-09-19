# St. Peter Trivia Night

St. Peter Trivia Night is a simple web app for running a live trivia game at **St. Peter Evangelical Lutheran Church in Gilberts, Illinois**.

The app gives the host one screen to run the game, an audience screen for questions and answers, and a scoreboard screen. It is built to work on church laptops and large TVs or projectors.

The live app is at <https://trivia.gogorichie.online>.

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

This project was built for a church trivia night. The main goals are simple:

- Make the game easy for a volunteer to run.
- Make questions easy to read from across the room.
- Keep scores safe if a browser is refreshed.
- Let separate laptops stay in sync.
- Keep a simple backup plan if the internet or cloud service fails.

The project uses plain HTML, CSS, and JavaScript. There is no web framework or build step. This keeps the app small and makes it possible to run a local copy if needed.

## Current features

The project currently includes:

- Host controls with Previous and Next buttons.
- Question and answer reveal screens.
- Team creation and score changes.
- A ranked scoreboard.
- CSV and Excel imports for questions and teams.
- Five-round games and a tiebreaker.
- Local browser storage for game state.
- Optional cross-laptop sync using Cloudflare Workers and Durable Objects.
- Cloudflare Access protection for the host page.
- A host token that protects game-changing API requests.
- Automated unit, browser, accessibility, and Lighthouse tests.
- GitHub Actions for testing and deployment.
- CodeQL security scanning and Dependabot updates.

Some planned work is still tracked in GitHub Issues. This includes better scoring tools, timers, animations, score exports, and a larger Cloudflare data model.

## How a game works

A normal game follows this path:

1. The host loads the question file.
2. The host loads the team file.
3. The host starts a round.
4. The audience sees a question.
5. The host reveals the answer.
6. The host updates team scores.
7. The game continues through the remaining rounds.
8. A tiebreaker is available if needed.

The current event format supports five rounds with eight questions per round, plus a tiebreaker.

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

Files in the `mock/` folder are test data. They are not the final event questions.

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

The deployed app uses a Cloudflare Worker and Durable Objects to share live game state between laptops.

The host is allowed to change the game. Audience and scoreboard screens are read-only.

If sync stops working, the host can keep using its local copy. The cloud service is an extra feature, not a requirement for basic game play.

For setup, deployment, and recovery details, see `docs/CLOUDFLARE.md`.
That file also explains how to roll back a bad deploy, for both the app and the Worker.

## Security

The host side has two protections:

- **Cloudflare Access** controls who can open the host page.
- **HOST_TOKEN** controls who can send game-changing requests to the Worker.

The token is stored as a Cloudflare secret and is not committed to this repository.

Question and answer files are also kept out of the public deployment. The host loads them from the local laptop.

## Testing

Install the development packages:

```bash
npm install
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

The browser tests check important game behavior such as importing files, moving from question to answer, scoring teams, refreshing the browser, and keeping answers hidden until the host reveals them.

Cross-laptop sync tests use a local Cloudflare Worker and are documented in `docs/CLOUDFLARE.md`.

## Main project files

| File or folder | Purpose |
| --- | --- |
| `host.html` | Host controls |
| `display.html` | Audience screen |
| `scoreboard.html` | Scoreboard |
| `game.js` | Shared game and local-state logic |
| `import.js` | Question and team file import |
| `sync.js` | Optional cross-laptop sync |
| `worker/` | Cloudflare sync Worker |
| `tests/` | Automated tests |
| `mock/` | Development question and team files |
| `docs/CLOUDFLARE.md` | Cloudflare setup and operations |
| `TRIVIA_NIGHT_GUIDANCE.md` | Event and game-night guidance |
| `AGENTS.md` | Instructions for AI coding agents |

## Game-night backup

The web app is not the only way to run the event. A backup plan can use slides for questions, a spreadsheet for scores, a printed answer key, and a paper tally sheet.

This is intentional. A trivia night should not stop because a web service or Wi-Fi connection has a problem.

## Church

**St. Peter Evangelical Lutheran Church**  
985 Galligan Road  
Gilberts, IL 60136

Original game night: **September 19, 2026**
