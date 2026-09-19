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
- Mock question and team datasets
- Large-format TV/projector styling
- GitHub Actions CI/CD pipeline
- GitHub Pages deployment workflow

Still planned:

- Cross-laptop Firebase synchronization
- Spreadsheet import for the final questions
- Spreadsheet import for the final team list
- Host authentication and locked-down Firebase rules
- Timer
- Improved score-entry workflow
- Animations/transitions
- Download/export scores

> The current MVP uses browser local storage. Cross-laptop synchronization is not yet complete.

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

The application can load a JSON game file.

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

On successful pushes to `main`, the deployment job publishes the static site to **GitHub Pages**.

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
│   └── workflows/
│       └── ci-cd.yml
├── mock/
│   ├── questions.csv
│   └── teams.csv
├── display.html
├── fall-trivia.game.json
├── game.js
├── host.html
├── index.html
├── MOCK_DATA.md
├── scoreboard.html
├── styles.css
└── TRIVIA_NIGHT_GUIDANCE.md
```

## Event

**St. Peter Evangelical Lutheran Church**  
985 Galligan Road  
Gilberts, IL 60136

Game night: **Saturday, September 19, 2026**
