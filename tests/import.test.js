/* Unit tests for the spreadsheet importer.
   Run with: node --test tests/
   Uses node:test, so there is nothing to install. */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
// import.js reads Papa/XLSX as browser globals; supply Papa for the CSV tests.
global.Papa = require(path.join(root, "vendor/papaparse.min.js"));
const imp = require(path.join(root, "import.js"));

/** Parse CSV text the way the host page would, then import it. */
function importCsv(csv) {
  const { rows, headings } = imp.rowsFromCsvText(csv);
  const kind = imp.classifySheet(headings);
  if (kind === "unknown") throw new imp.ImportError("unclassifiable");
  if (kind === "teams") return { kind, teams: imp.importTeams(rows, headings) };
  return { kind, game: imp.importQuestions(rows, headings) };
}

test("imports the real mock questions sheet", () => {
  const csv = fs.readFileSync(path.join(root, "mock/questions.csv"), "utf8");
  const { game } = importCsv(csv);
  const s = imp.summarizeGame(game);

  assert.equal(s.rounds, 5, "five rounds");
  assert.equal(s.questions, 40, "forty scored questions");
  assert.deepEqual(s.perRound, [8, 8, 8, 8, 8], "eight per round");
  assert.ok(s.hasTiebreaker, "tiebreaker present");

  assert.equal(game.rounds[0].name, "Round 1 — General Knowledge");
  assert.equal(game.tiebreaker.answer, "5280");

  // Host notes carry the accepted alternates; losing them changes grading.
  const stopSign = game.rounds[0].questions.find((q) => q.text.includes("stop sign"));
  assert.equal(stopSign.notes, "Accept eight");
  assert.equal(stopSign.difficulty, "easy");
  assert.equal(stopSign.points, 1);
});

test("imports the real mock teams sheet", () => {
  const csv = fs.readFileSync(path.join(root, "mock/teams.csv"), "utf8");
  const { kind, teams } = importCsv(csv);

  assert.equal(kind, "teams");
  assert.equal(teams.length, 5);
  assert.deepEqual(teams[0], { name: "The Reformation Ringers", score: 0, table: "1" });
  assert.ok(teams.every((t) => t.score === 0), "every team starts on zero");
});

test("tolerates the heading styles spreadsheets actually use", () => {
  const variants = {
    "title case with spaces": "Round,Category,Question,Answer,Difficulty,Points,Host Notes\n1,GK,Q?,A,easy,1,\n",
    snake_case: "round_number,topic,question_text,correct_answer\n1,GK,Q?,A\n",
    abbreviations: "Rd,Subject,Q,A\n1,GK,Q?,A\n",
    "upper case with punctuation": "ROUND #,CATEGORY:,QUESTION!,ANSWER.\n1,GK,Q?,A\n",
    "columns in any order": "Answer,Question,Round\nA,Q?,1\n",
  };
  for (const [label, csv] of Object.entries(variants)) {
    const { game } = importCsv(csv);
    assert.equal(imp.summarizeGame(game).questions, 1, label);
  }
});

test("reads a round column however the sheet writes it", () => {
  const cases = [
    ["1", { kind: "round", number: 1 }],
    ["Round 1", { kind: "round", number: 1 }],
    ["R3", { kind: "round", number: 3 }],
    ["", { kind: "round", number: 1 }],
    ["Tiebreaker", { kind: "tiebreaker" }],
    ["TB", { kind: "tiebreaker" }],
    ["Final", { kind: "tiebreaker" }],
    ["Tiebreaker 1", { kind: "tiebreaker" }],
    ["zzz", { kind: "unknown" }],
  ];
  for (const [input, want] of cases) {
    assert.deepEqual(imp.roundKind(input), want, `round cell ${JSON.stringify(input)}`);
  }
});

test("reads a teams sheet that has only a name column", () => {
  // A single-column CSV gives Papa no delimiter to detect; that is not an error.
  const { teams } = importCsv("Team\nPew Crew\nGrace Notes\n");
  assert.deepEqual(teams.map((t) => t.name), ["Pew Crew", "Grace Notes"]);
});

test("keeps rounds in numeric order regardless of row order", () => {
  const { game } = importCsv("Round,Question,Answer\n3,Qc,Ac\n1,Qa,Aa\n2,Qb,Ab\n");
  assert.deepEqual(game.rounds.map((r) => r.name), ["Round 1", "Round 2", "Round 3"]);
});

test("skips fully blank spacer rows without counting them", () => {
  const { game } = importCsv("Round,Question,Answer\n1,Q?,A\n,,\n1,Q2?,A2\n");
  assert.equal(imp.summarizeGame(game).questions, 2);
});

test("keeps a comma that is inside a quoted question", () => {
  const { game } = importCsv('Round,Question,Answer\n1,"Which city, in France?",Paris\n');
  assert.equal(game.rounds[0].questions[0].text, "Which city, in France?");
});

test("fails loudly rather than importing a half-built game", () => {
  const cases = [
    ["a question with no answer", "Round,Question,Answer\n1,Q?,A\n1,Q2?,\n", /problem row/],
    ["headings but no data rows", "Round,Question,Answer\n", /no data rows/],
    ["a round value it cannot read", "Round,Question,Answer\nzzz,Q?,A\n", /problem row/],
    ["a sheet it cannot classify", "Foo,Bar\n1,2\n", /unclassifiable/],
    ["questions with no answer column", "Round,Question\n1,Q?\n", /unclassifiable/],
  ];
  for (const [label, csv, pattern] of cases) {
    assert.throws(() => importCsv(csv), pattern, label);
  }
});

test("names the headings it saw when a column is missing", () => {
  // The host needs to know what to fix, not just that something broke.
  assert.throws(
    () => imp.importQuestions([{ Round: "1", Query: "Q?" }], ["Round", "Query"]),
    (err) => err instanceof imp.ImportError && /Round, Query/.test(err.message),
    "error message lists the actual headings"
  );
});

test("reports every problem row at once, not just the first", () => {
  try {
    importCsv("Round,Question,Answer\n1,Q1?,\n1,Q2?,\n1,Q3?,\n");
    assert.fail("should have thrown");
  } catch (err) {
    assert.match(err.message, /3 problem row\(s\)/);
    assert.match(err.message, /Row 2/);
    assert.match(err.message, /Row 4/, "row numbers match the spreadsheet, counting the heading row");
  }
});
