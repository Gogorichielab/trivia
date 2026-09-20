/* Spreadsheet import for the trivia app.
   Turns a questions sheet and a teams sheet into the game-file shape that
   game.js flatten() expects. Accepts .csv, .xlsx, .xls, and .json.

   Headings vary between spreadsheets, so columns are matched by a normalised
   alias list rather than an exact string. When a required column cannot be
   identified the import fails loudly with the headings it actually saw —
   never silently, and never with a half-built game. */

const QUESTION_COLUMNS = {
  round: ["round", "roundnumber", "roundno", "rd", "rnd"],
  category: ["category", "topic", "subject", "roundname", "roundtitle"],
  question: ["question", "questiontext", "text", "prompt", "q"],
  answer: ["answer", "correctanswer", "answertext", "solution", "a"],
  difficulty: ["difficulty", "level", "diff"],
  points: ["points", "pointvalue", "value", "pts", "score"],
  notes: ["hostnotes", "notes", "note", "hostnote", "alternates", "accept", "acceptableanswers"],
};

const TEAM_COLUMNS = {
  name: ["teamname", "team", "name"],
  table: ["tablenumber", "table", "tableno"],
};

// "Host Notes", "host_notes" and "HOST-NOTES " all normalise to "hostnotes".
function normalizeHeading(h) {
  return String(h == null ? "" : h).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* Maps each logical field to the actual heading in the sheet.
   Returns {resolved, missing} so the caller can report every missing column
   at once instead of one per attempt. */
function resolveColumns(headings, spec, required) {
  const seen = new Map();
  headings.forEach((h) => {
    const n = normalizeHeading(h);
    if (n && !seen.has(n)) seen.set(n, h);
  });

  const resolved = {};
  Object.entries(spec).forEach(([field, aliases]) => {
    const hit = aliases.find((a) => seen.has(a));
    if (hit) resolved[field] = seen.get(hit);
  });

  const missing = required.filter((f) => !(f in resolved));
  return { resolved, missing };
}

function cell(row, column) {
  if (!column) return "";
  const v = row[column];
  return v == null ? "" : String(v).trim();
}

class ImportError extends Error {}

function fail(message) {
  throw new ImportError(message);
}

function describeHeadings(headings) {
  const shown = headings.filter((h) => String(h || "").trim());
  return shown.length ? shown.join(", ") : "(no headings found)";
}

/* Works out what a round cell means. Sheets write this column as "1",
   "Round 1", "R1", "Tiebreaker", "TB" or "Final", so match on the shape
   rather than on an exact value:
     - a recognised tiebreaker word  -> the tiebreaker
     - anything containing a number  -> that round number ("Round 3" -> 3)
     - blank                         -> round 1, for a single-round sheet
     - anything else                 -> a problem row, reported not guessed */
function roundKind(value) {
  const v = normalizeHeading(value);
  if (v === "") return { kind: "round", number: 1 };
  // "tb" has no digits and no "tie", so it needs an exact match of its own.
  if (v === "tb" || v.includes("tie") || v.includes("final")) return { kind: "tiebreaker" };
  const digits = v.match(/\d+/);
  if (digits) {
    const number = Number(digits[0]);
    return number >= 1 ? { kind: "round", number } : { kind: "unknown" };
  }
  return { kind: "unknown" };
}

function parsePoints(value) {
  if (value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function importQuestions(rows, headings, meta = {}) {
  if (!rows.length) fail("The questions sheet has headings but no data rows.");

  const { resolved, missing } = resolveColumns(headings, QUESTION_COLUMNS, ["question", "answer"]);
  if (missing.length) {
    fail(
      `Could not find a ${missing.join(" or ")} column in the questions sheet.\n` +
        `Headings seen: ${describeHeadings(headings)}`
    );
  }

  const byRound = new Map();
  const tiebreakers = [];
  const problems = [];

  rows.forEach((row, i) => {
    const sheetLine = i + 2; // +1 for zero-index, +1 for the heading row
    const text = cell(row, resolved.question);
    const answer = cell(row, resolved.answer);

    if (!text && !answer) return; // fully blank spacer row

    if (!text) {
      problems.push(`Row ${sheetLine}: has an answer but no question.`);
      return;
    }
    if (!answer) {
      problems.push(`Row ${sheetLine}: question "${text.slice(0, 40)}…" has no answer.`);
      return;
    }

    const entry = { text, answer };
    const difficulty = cell(row, resolved.difficulty);
    const notes = cell(row, resolved.notes);
    const category = cell(row, resolved.category);
    const points = parsePoints(cell(row, resolved.points));
    if (difficulty) entry.difficulty = difficulty.toLowerCase();
    if (notes) entry.notes = notes;
    if (category) entry.category = category;
    if (points !== undefined) entry.points = points;

    const roundValue = cell(row, resolved.round);
    const round = roundKind(roundValue);
    if (round.kind === "tiebreaker") {
      tiebreakers.push(entry);
      return;
    }
    if (round.kind === "unknown") {
      problems.push(`Row ${sheetLine}: round "${roundValue}" is not a round number or a tiebreaker.`);
      return;
    }
    const roundNumber = round.number;

    if (!byRound.has(roundNumber)) byRound.set(roundNumber, { category, questions: [] });
    const bucket = byRound.get(roundNumber);
    if (!bucket.category && category) bucket.category = category;
    bucket.questions.push(entry);
  });

  if (problems.length) {
    fail(`The questions sheet has ${problems.length} problem row(s):\n` + problems.slice(0, 10).join("\n"));
  }
  if (!byRound.size) fail("No scored questions were found in the questions sheet.");

  const rounds = [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((n) => {
      const bucket = byRound.get(n);
      return {
        name: bucket.category ? `Round ${n} — ${bucket.category}` : `Round ${n}`,
        questions: bucket.questions,
      };
    });

  const game = {
    title: meta.title || "Trivia Night",
    rounds,
    tiebreaker: tiebreakers[0] || { text: "Tiebreaker", answer: "" },
  };
  if (meta.date) game.date = meta.date;
  if (tiebreakers.length > 1) game.spareTiebreakers = tiebreakers.slice(1);
  return game;
}

function importTeams(rows, headings) {
  if (!rows.length) fail("The teams sheet has headings but no data rows.");

  const { resolved, missing } = resolveColumns(headings, TEAM_COLUMNS, ["name"]);
  if (missing.length) {
    fail(
      "Could not find a team name column in the teams sheet.\n" +
        `Headings seen: ${describeHeadings(headings)}`
    );
  }

  const teams = [];
  rows.forEach((row) => {
    const name = cell(row, resolved.name);
    if (!name) return;
    const team = { name, score: 0 };
    const table = cell(row, resolved.table);
    if (table) team.table = table;
    teams.push(team);
  });

  if (!teams.length) fail("No team names were found in the teams sheet.");
  return teams;
}

/* ---- file reading ------------------------------------------------------ */

function rowsFromCsvText(text) {
  if (typeof Papa === "undefined") fail("The CSV reader (vendor/papaparse.min.js) did not load.");
  const parsed = Papa.parse(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => String(h).trim(),
  });
  // Papa reports delimiter/quote problems per row; surface them rather than
  // importing a game that silently lost a column.
  const ignorable = ["TooFewFields", "TooManyFields", "UndetectableDelimiter"];
  const real = (parsed.errors || []).filter((e) => !ignorable.includes(e.code));
  if (real.length) fail(`Could not read the CSV: ${real[0].message} (row ${real[0].row})`);
  return { rows: parsed.data || [], headings: parsed.meta.fields || [] };
}

function rowsFromWorkbook(data) {
  if (typeof XLSX === "undefined") fail("The spreadsheet reader (vendor/xlsx.full.min.js) did not load.");
  const wb = XLSX.read(data, { type: "array" });
  if (!wb.SheetNames.length) fail("That spreadsheet has no sheets in it.");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
  const headings = (grid[0] || []).map((h) => String(h).trim());
  return { rows, headings };
}

async function rowsFromFile(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return rowsFromCsvText(await file.text());
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm")) {
    return rowsFromWorkbook(new Uint8Array(await file.arrayBuffer()));
  }
  fail(`Unsupported file type: ${file.name}. Use .csv, .xlsx, .xls or .json.`);
}

/* Decides whether a sheet holds questions or teams by looking at its
   headings, so the host does not have to use two different buttons. */
function classifySheet(headings) {
  const { missing: qMissing } = resolveColumns(headings, QUESTION_COLUMNS, ["question", "answer"]);
  if (!qMissing.length) return "questions";
  const { missing: tMissing } = resolveColumns(headings, TEAM_COLUMNS, ["name"]);
  if (!tMissing.length) return "teams";
  return "unknown";
}

/**
 * Read any supported file and return what it contained.
 * @returns {Promise<{kind:"game"|"questions"|"teams", game?:Object, teams?:Array}>}
 */
async function importFile(file) {
  const name = (file.name || "").toLowerCase();

  if (name.endsWith(".json")) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      fail(`That file is not valid JSON: ${err.message}`);
    }
    if (!parsed || !Array.isArray(parsed.rounds) || !parsed.rounds.length) {
      fail("That JSON file does not look like a game file (no rounds array).");
    }
    return { kind: "game", game: parsed };
  }

  const { rows, headings } = await rowsFromFile(file);
  const kind = classifySheet(headings);

  if (kind === "questions") return { kind: "questions", game: importQuestions(rows, headings) };
  if (kind === "teams") return { kind: "teams", teams: importTeams(rows, headings) };

  fail(
    "Could not tell whether that sheet holds questions or teams.\n" +
      `Headings seen: ${describeHeadings(headings)}\n` +
      "A questions sheet needs question and answer columns. A teams sheet needs a team name column."
  );
}

/** Counts for a post-import confirmation the host can sanity-check. */
function summarizeGame(game) {
  const perRound = game.rounds.map((r) => r.questions.length);
  const total = perRound.reduce((a, b) => a + b, 0);
  return {
    rounds: game.rounds.length,
    questions: total,
    perRound,
    hasTiebreaker: Boolean(game.tiebreaker && game.tiebreaker.text && game.tiebreaker.answer),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ImportError,
    normalizeHeading,
    resolveColumns,
    importQuestions,
    importTeams,
    classifySheet,
    roundKind,
    rowsFromCsvText,
    summarizeGame,
    QUESTION_COLUMNS,
    TEAM_COLUMNS,
  };
}
