# AGENTS.md

## Purpose

This repository contains the **St. Peter Trivia Night** application for St. Peter Evangelical Lutheran Church in Gilberts, Illinois.

AI coding agents working in this repository should prioritize **game-night reliability, readability, and simplicity** over architectural sophistication. The immediate event is Saturday, September 19, 2026.

## Read First

Before making changes, review:

1. `README.md` — current application architecture and status.
2. `TRIVIA_NIGHT_GUIDANCE.md` — event plan, priorities, run-of-show, and MVP scope.
3. `MOCK_DATA.md` — temporary spreadsheet schemas.
4. `fall-trivia.game.json` — current game-data structure.

Treat the guidance document as the product requirements for the event.

## Primary Goal

The app should reliably support a live trivia event using:

- A host laptop/control view.
- An audience-facing question/answer display.
- A separate scoreboard.
- Team score tracking.
- Approximately five rounds of eight questions.
- A tiebreaker.
- Large, readable presentation on church TVs/projectors.

The host should be able to operate the game without technical knowledge during the event.

## MVP Priorities

For the September 19 event, prioritize work in this order:

1. Reliable question and answer presentation.
2. Reliable team and score handling.
3. Cross-laptop synchronization.
4. Importing the supplied question spreadsheet.
5. Importing the supplied team spreadsheet.
6. Large, readable 1920×1080 presentation.
7. Recovery from refresh/reconnect without losing game state.

Do not spend event-critical time on cosmetic features while core game flow is incomplete.

## Current Architecture

The application is intentionally lightweight and currently uses static HTML, CSS, and JavaScript.

Important files:

- `index.html` — landing page.
- `host.html` — host controls.
- `display.html` — audience display.
- `scoreboard.html` — scoreboard.
- `game.js` — shared game/state logic.
- `styles.css` — shared presentation styling.
- `fall-trivia.game.json` — development game file.
- `mock/questions.csv` — temporary question data.
- `mock/teams.csv` — temporary team data.

Avoid introducing a framework or build system unless there is a clear, event-critical reason.

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

Spreadsheet import should tolerate reasonable heading variations and provide a useful error when required information cannot be identified.

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

The planned MVP uses Firebase for synchronization between devices.

When implementing synchronization:

- Host actions should update audience and scoreboard views quickly.
- Refreshing any screen should restore the current state.
- A temporarily disconnected display should catch up when it reconnects.
- Avoid allowing the audience display or scoreboard to modify scores.
- Keep Firebase configuration separate from game content.

For the one-night MVP, test-mode rules may be used only as described in `TRIVIA_NIGHT_GUIDANCE.md`. Use a long random game identifier and do not expose host URLs to guests.

Authentication and restrictive rules are post-event priorities unless they can be completed without risking the MVP.

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

Before merging event-critical changes, verify at minimum:

1. Landing page loads.
2. Host page loads.
3. Audience display loads.
4. Scoreboard loads.
5. A game can be loaded.
6. Host can advance through round → question → answer.
7. Back navigation works.
8. Teams can be loaded/created.
9. Scores can be changed.
10. Scoreboard ranking updates correctly.
11. Refresh does not lose live state.
12. Two-laptop synchronization works when Firebase is enabled.

Test the actual game flow rather than only checking that files parse.

## CI/CD

GitHub Actions workflow:

```text
.github/workflows/ci-cd.yml
```

Pull requests and pushes should pass CI before being considered ready.

Do not disable validation simply to make a failing change pass.

Production deployment is through GitHub Pages from `main`.

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
- Readability fixes on the actual church display equipment.

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
2. Advance round → question → answer, and go back.
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

- The final question spreadsheet imports successfully.
- The final team spreadsheet imports successfully.
- Host, display, and scoreboard work on the intended laptops.
- Cross-laptop state synchronization is reliable.
- Scores survive refresh/reconnect.
- The full game can be rehearsed from lobby through tiebreaker.
- Text is readable on the actual church display equipment.
- CI passes.
- A no-code backup is ready.

## After the Event

Post-event improvements may include:

- Host authentication.
- Locked-down Firebase security rules.
- Countdown timer.
- Animations and transitions.
- Image questions.
- CSV conversion tools.
- Score downloads/exports.
- Improved administration tools.

These features should not compromise the stability of the event MVP.
