# Trivia Night Plan

A reusable playbook for running one trivia night with this app. Copy it, fill
in your own dates and names, and work down it.

The short version: **write the questions first, get the no-app backup ready
second, and make the go/no-go call at the venue one hour before start.** The
night should be able to happen whether or not the app cooperates.

---

## 1. Priorities

Work in this order. Each step is useful even if you never reach the next one.

| Order | Task | Time | Why first |
| --- | --- | --- | --- |
| 1 | Write the questions (Section 3) | 2–3 hrs | Both the app and Plan B need them |
| 2 | Build Plan B: slides and a score spreadsheet (Section 5) | 45 min | Guarantees the night happens |
| 3 | Print answer sheets and the answer key | 30 min | Needed either way |
| 4 | Load the game file and rehearse on both laptops | 30 min | Finds problems while you can still fix them |
| 5 | Confirm sync, Access, and the deployed site | 30 min | Only matters if you are using two laptops |

---

## 2. Prep Schedule

### Two weeks out

- [ ] Pick the date, venue, and start time; confirm the room has a TV or projector.
- [ ] Decide the round categories (Section 3) and who is writing each one.
- [ ] Confirm who is hosting and who is grading.

### One week out

- [ ] Questions written, fact-checked, and read aloud once.
- [ ] Question and team spreadsheets saved in the importer's column format.
- [ ] Plan B deck and score spreadsheet built from the same questions.

### Two days out

- [ ] Full rehearsal: load the game file, click lobby → tiebreaker, refresh every screen.
- [ ] Both laptops tested on the actual cables and display.
- [ ] Answer sheets, answer key, and tally sheet printed.

### Game day

- [ ] Supplies packed (Section 6).
- [ ] Known-good copy of the game file saved locally on the host laptop.
- [ ] Run-of-show (Section 4) in hand.

### Security note for a single night

If you are running without host sign-in, lower the risk the cheap way:

- Use a long, random game code (like `?game=k7Qm29xRtp`), not something guessable.
- Don't share the display or scoreboard URLs with guests.
- Delete the game data after the event.

### Pushing code on game day

Game-day pushes are allowed, but gated. See **Game-Day Change Policy** in
`AGENTS.md` for the full rules. The short version:

- **All pushes stop at T-60**, the go/no-go checkpoint in Section 4.
- Fix only what blocks the event running. No refactors, no new dependencies.
- Rehearse each change on the host laptop before calling it done. CI passing
  is not the same as the game playing.
- Small, single-purpose commits, so a revert takes minutes.
- Never push or reload the deployed site mid-round.
- Plan B stays ready regardless of how well the pushes go.

---

## 3. Content Plan

### Format

- **5 rounds × 8 questions = 40 questions**, plus 1 tiebreaker
- **1 point per question** (optional: final round worth 2 points each)
- **Mix per round:** 3 easy, 3 medium, 2 hard
- **About 2 hours total** with a halftime break

### Suggested rounds

| Round | Category | Notes |
| --- | --- | --- |
| 1 | General Knowledge | Easy warm-up to get everyone playing |
| 2 | History | Mix of U.S. and world |
| 3 | Science & Nature | Halftime break follows |
| 4 | Movies, TV & Music | Crowd favorite; keep it across decades |
| 5 | Local & Wildcard | Questions about your town, venue, or group |
| Tiebreaker | Number question | Closest answer wins, e.g. "How many feet tall is…" |

### Question-writing checklist

- [ ] One clear, checkable answer per question
- [ ] Host note for acceptable alternates (spellings, "1776" vs "July 4, 1776")
- [ ] Read each question aloud once; cut any that take more than 15 seconds to read
- [ ] Two spare questions, in case one gets spoiled or thrown out
- [ ] Double-check facts from a second source
- [ ] Save as a game file (see `example.game.json`) **and** paste into the Plan B slides

### Answer sheet (print one per team per round, plus spares)

```
TEAM NAME: ______________________     ROUND: ____

1. ________________________________
2. ________________________________
3. ________________________________
4. ________________________________
5. ________________________________
6. ________________________________
7. ________________________________
8. ________________________________
                                  SCORE: ____ / 8
```

---

## 4. Game Night Run-of-Show

| Time | What happens | Who / notes |
| --- | --- | --- |
| T–90 min | Arrive, set up laptops, TV, projector, cables | Host |
| T–75 min | Connect to Wi-Fi, open all three pages, test hotspot | Host |
| T–60 min | **Go/no-go check:** click Next through one test question on both screens | Host decides: app or Plan B |
| T–45 min | Lay out answer sheets, pens, table numbers | Helper |
| T–30 min | Doors open; register teams and enter names | Helper takes names, host enters them |
| 0:00 | Welcome and rules (5 min) | Host |
| 0:05 | Round 1: questions, collect sheets, reveal answers | ~15 min per round |
| 0:20 | Round 2 | |
| 0:35 | Round 3 | |
| 0:50 | **Halftime break (10 min):** show scoreboard, refill drinks | Grade Round 3 during the break |
| 1:00 | Round 4 | |
| 1:15 | Round 5 | |
| 1:30 | Tiebreaker if needed, final scores, winners, prizes | Host |
| 1:45 | Thank-yous and teardown | Everyone |

### Each round, step by step

1. Show the category card and read the round title.
2. Show each question and read it aloud twice. Give 45 seconds per question.
   The app can count this down on the audience screen. It is off unless you
   ask for it: add `&timer=45` to the host address. A phone timer works too.
3. After question 8: "Pens down, pass your sheets forward."
4. Reveal answers one by one while a helper grades.
5. Use the round score-entry screen to enter each team's total. The overall
   scoreboard updates automatically.
6. After the final round, use the tiebreaker when needed, show final results,
   and download the results CSV.

### Rules to announce

- No phones or internet during rounds.
- One answer sheet per team per round; the team name goes on every sheet.
- Spelling doesn't have to be perfect if the answer is clear.
- The host's ruling is final, kindly given.

---

## 5. Plan B (No App)

Build this before you rely on the app, so you're covered no matter what.

- **Question display:** a Google Slides or PowerPoint deck on Laptop B and the projector. Make one slide for each category card, one for each question, and one for each answer, in the reveal order.
- **Scoreboard:** a Google Sheet on Laptop A's TV, with columns for Team, R1–R5, and Total. Sort by Total after each round, and zoom to 200%.
- **Backup of the backup:** printed answer key and paper tally sheet.

Switching from the app to Plan B should take about 5 minutes. Keep both open until you've made the go/no-go call.

---

## 6. Supplies Checklist

- [ ] Both laptops and chargers
- [ ] HDMI cables for the TV and projector, plus adapters
- [ ] Extension cord and power strip
- [ ] Phone hotspot ready
- [ ] Answer sheets: (number of teams × 5 rounds) + 20 spares
- [ ] Pens (2 per team), clipboards if tables are small
- [ ] Printed answer key with host notes
- [ ] Paper score tally sheet
- [ ] Phone timer as a backup
- [ ] Prizes for 1st place (and maybe a funny last-place prize)
- [ ] Table numbers or tent cards

---

## 7. After the Event

- [ ] Delete the event's game data from the sync Worker
- [ ] Archive the question file so the same questions aren't reused by accident
- [ ] Note what dragged or confused people, and fix it before the next one
- [ ] File any app bugs you hit while they're still fresh
