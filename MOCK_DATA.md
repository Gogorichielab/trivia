# Mock Data

These files are temporary development fixtures for the Trivia Night app.

- `mock/questions.csv` — 40 sample questions across five rounds plus a tiebreaker.
- `mock/teams.csv` — five sample teams.

They are **not** game content. Replace them with the spreadsheets supplied by whoever is organizing your event.

## Expected question columns

`round, category, question, answer, difficulty, points, host_notes`

## Expected team columns

`team_name, table_number`

The importer is tolerant of common spreadsheet heading variations, so files from different organizers should load without reformatting.
