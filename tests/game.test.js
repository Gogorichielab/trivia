const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  STATE_VERSION,
  flatten,
  migrateState,
  teamTotal,
  rankTeams,
  resultsCsv,
  resultFilename,
} = require("../game.js");

const game = {
  title: "Test Night",
  rounds: [
    { name: "Round 1", questions: [{ text: "Q1", answer: "A1" }, { text: "Q2", answer: "A2" }] },
    { name: "Round 2", questions: [{ text: "Q3", answer: "A3", points: 2 }] },
  ],
  tiebreaker: { text: "Tie question", answer: "Tie answer" },
};

test("game flow presents every question before the round answer review", () => {
  assert.deepEqual(flatten(game).map((step) => step.type), [
    "lobby",
    "round", "question", "question", "answer", "answer", "score",
    "round", "question", "answer", "score",
    "tiebreaker", "tiebreaker-answer", "final",
  ]);
});

test("old total-only team state migrates without losing the score", () => {
  const migrated = migrateState({ index: 2, teams: [{ name: "Legacy", table: 4, score: 7 }] }, game);
  assert.equal(migrated.version, STATE_VERSION);
  assert.equal(flatten(game)[migrated.index].type, "answer");
  assert.equal(flatten(game)[migrated.index].q, 0);
  assert.deepEqual(migrated.teams[0].roundScores, [0, 0]);
  assert.equal(migrated.teams[0].adjustment, 7);
  assert.equal(teamTotal(migrated.teams[0]), 7);
});

test("round totals and adjustments produce the overall score", () => {
  assert.equal(teamTotal({ roundScores: [6, 8, 4], adjustment: -1 }), 17);
});

test("tied teams share a rank and the next rank is skipped", () => {
  const ranked = rankTeams([
    { name: "A", roundScores: [8], adjustment: 0 },
    { name: "B", roundScores: [8], adjustment: 0 },
    { name: "C", roundScores: [5], adjustment: 0 },
  ]);
  assert.deepEqual(ranked.map((team) => team.rank), [1, 1, 3]);
});

test("results export includes round breakdowns, adjustments, totals, and safe CSV quoting", () => {
  const csv = resultsCsv(game, {
    index: 0,
    teams: [
      { name: "Team, One", table: "1", roundScores: [8, 6], adjustment: 1 },
      { name: "Team Two", table: "2", roundScores: [7, 6], adjustment: 0 },
    ],
  });
  assert.match(csv, /Rank,Team,Table,Round 1,Round 2,Adjustment,Total/);
  assert.match(csv, /1,"Team, One",1,8,6,1,15/);
  assert.match(csv, /2,Team Two,2,7,6,0,13/);
});

test("results filename uses the game identifier safely", () => {
  assert.equal(resultFilename("SPLC 2026/final"), "SPLC-2026-final-results.csv");
});
