# Mock Data

These files are temporary development fixtures for the Trivia Night app.

- `mock/questions.csv` — 40 sample questions across five rounds plus a tiebreaker.
- `mock/teams.csv` — five sample teams.

They are **not** the final game-night content. Replace them with the spreadsheets supplied by the event organizer.

## Expected question columns

`round, category, question, answer, difficulty, points, host_notes`

## Expected team columns

`team_name, table_number`

The importer should be tolerant of common spreadsheet heading variations when the final files arrive.
