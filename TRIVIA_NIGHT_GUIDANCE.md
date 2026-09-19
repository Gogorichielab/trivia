# Trivia Night Plan

**Game night:** Saturday, September 19, 2026  
**Prepared:** Friday, September 18, 2026

Building the full app in one day is a stretch. This plan builds a pared-down version today and gets a no-code backup ready first, so the night works even if the app doesn't. You make the go/no-go call at the venue, one hour before start.

---

## 1. Priorities

Work in this order. Each step is useful even if you never reach the next one.

| Order | Task | Time | Why first |
| --- | --- | --- | --- |
| 1 | Write the questions (Section 3) | 2–3 hrs | Both the app and Plan B need them |
| 2 | Build Plan B: slides and a score spreadsheet (Section 5) | 45 min | Guarantees the night happens |
| 3 | Print answer sheets and the answer key | 30 min | Needed either way |
| 4 | Build the app MVP (Section 2) | 4–6 hrs | Nice to have for tomorrow |
| 5 | Rehearse on both laptops | 30 min | Finds problems while you can still fix them |

---

## 2. App Build Schedule (Today)

### What to build for tomorrow (MVP)

| Build it | Skip until after tomorrow |
| --- | --- |
| Phase 1: three pages live on GitHub Pages | Host sign-in (Phase 3) |
| Phase 2: Firebase sync between laptops | Animations and fancy transitions |
| Phase 4: load the game file, then Next/Back through the states | Images in questions |
| Basic score grid that saves to Firebase | CSV converter, Download scores button |
| Big, readable text on display and scoreboard | Countdown timer (optional; off unless you add `&timer=45`) |

### Security shortcut for one night

Skipping sign-in means using Firebase "test mode" rules, which let anyone write. To lower the risk:

- Use a long, random game code (like `?game=k7Qm29xRtp`), not `FALL26`.
- Don't share the display or scoreboard URLs with guests.
- Delete the game data from Firebase afterward, and add sign-in (Phase 3) before the next event.

### Time blocks

| Block | Work | Done when |
| --- | --- | --- |
| 1 (1 hr) | Repo, three pages, turn on Pages | All three URLs load on both laptops |
| 2 (1.5 hrs) | Firebase project, test-mode rules, sync | Next on Laptop A changes Laptop B |
| 3 (1.5 hrs) | Load game file; Lobby → RoundIntro → Question → AnswerReveal → ScoreEntry → Final | You can click through a whole round |
| 4 (1 hr) | Score grid and ranked scoreboard | Scores survive refreshing every page |
| 5 (30 min) | Big fonts, 1920 × 1080 layout | Readable from 20 feet away |
| **Checkpoint** | **Tonight, before bed** | **If Block 3 isn't working, stop building and use Plan B** |

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
- [ ] Save as `fall-trivia.game.json` (for the app) **and** paste into the Plan B slides

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
5. Enter scores, then save; the scoreboard updates.

### Rules to announce

- No phones or internet during rounds.
- One answer sheet per team per round; the team name goes on every sheet.
- Spelling doesn't have to be perfect if the answer is clear.
- The host's ruling is final, kindly given.

---

## 5. Plan B (No App)

Build this before the app, so you're covered no matter what.

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

## 7. After Tomorrow

- [ ] Delete tonight's game data from Firebase
- [ ] Add host sign-in and locked-down rules (Phase 3)
- [ ] Add a timer, animations, and the Download scores button
- [ ] Note what dragged or confused people, and fix it for next time
