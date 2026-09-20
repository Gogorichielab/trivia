const STATE_VERSION = 2;
const defaultGame = {
  title: "St. Peter Trivia Night",
  rounds: [{
    name: "Round 1 — General Knowledge",
    questions: [{ text: "Sample question: Replace this with Question 1.", answer: "Sample answer", difficulty: "easy" }],
  }],
  tiebreaker: { text: "Sample tiebreaker question.", answer: "Sample answer" },
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* The whole event sequence lives here, so host, display, tests, and recovery
 * all agree on what Previous and Next mean. Questions come first; answers are
 * reviewed after the sheets are collected. */
function flatten(game) {
  const steps = [{ type: "lobby", title: game.title || "Trivia Night" }];
  (game.rounds || []).forEach((round, roundIndex) => {
    const questions = round.questions || [];
    steps.push({ type: "round", round: roundIndex, title: round.name || `Round ${roundIndex + 1}` });
    questions.forEach((question, questionIndex) => {
      steps.push({ type: "question", round: roundIndex, q: questionIndex, roundName: round.name, ...question });
    });
    questions.forEach((question, questionIndex) => {
      steps.push({ type: "answer", round: roundIndex, q: questionIndex, roundName: round.name, ...question });
    });
    steps.push({ type: "score", round: roundIndex, title: `Enter scores for ${round.name || `Round ${roundIndex + 1}`}` });
  });
  const tie = game.tiebreaker || { text: "Tiebreaker", answer: "" };
  steps.push({ type: "tiebreaker", ...tie });
  steps.push({ type: "tiebreaker-answer", ...tie });
  steps.push({ type: "final", title: "Final Results" });
  return steps;
}

function legacyFlatten(game) {
  const steps = [];
  (game.rounds || []).forEach((round, roundIndex) => {
    steps.push({ type: "round", round: roundIndex });
    (round.questions || []).forEach((_question, questionIndex) => {
      steps.push({ type: "question", round: roundIndex, q: questionIndex });
      steps.push({ type: "answer", round: roundIndex, q: questionIndex });
    });
  });
  steps.push({ type: "final" });
  return steps;
}

function migratedIndex(state, game, steps) {
  if (!Number.isInteger(state.index)) return 0;
  if (state.version === STATE_VERSION) return Math.max(0, Math.min(state.index, steps.length - 1));
  const old = legacyFlatten(game)[state.index];
  if (!old) return 0;
  if (old.type === "final") return steps.findIndex((step) => step.type === "tiebreaker");
  const match = steps.findIndex((step) =>
    step.type === old.type && step.round === old.round && (old.q === undefined || step.q === old.q)
  );
  return match < 0 ? 0 : match;
}

function gameKey() {
  return "trivia:" + (new URLSearchParams(location.search).get("game") || "default");
}

function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(gameKey() + ":game") || JSON.stringify(defaultGame));
  } catch {
    return defaultGame;
  }
}

function saveGame(game) {
  localStorage.setItem(gameKey() + ":game", JSON.stringify(game));
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeTeam(team, roundCount) {
  const hasRoundScores = Array.isArray(team.roundScores);
  const roundScores = Array.from({ length: roundCount }, (_, index) =>
    numberOrZero(hasRoundScores ? team.roundScores[index] : 0)
  );
  /* Old state stored only one total. Preserve it as an adjustment during the
   * one-time migration instead of silently resetting a live score. */
  const adjustment = hasRoundScores ? numberOrZero(team.adjustment) : numberOrZero(team.score);
  const normalized = {
    name: String(team.name || "Unnamed Team"),
    table: team.table == null ? "" : String(team.table),
    roundScores,
    adjustment,
  };
  normalized.score = teamTotal(normalized);
  return normalized;
}

function teamTotal(team) {
  if (!Array.isArray(team.roundScores)) return numberOrZero(team.score);
  return (team.roundScores || []).reduce((sum, score) => sum + numberOrZero(score), 0) +
    numberOrZero(team.adjustment);
}

function migrateState(raw, game = defaultGame) {
  const state = raw && typeof raw === "object" ? raw : {};
  const steps = flatten(game);
  return {
    version: STATE_VERSION,
    index: migratedIndex(state, game, steps),
    teams: Array.isArray(state.teams)
      ? state.teams.map((team) => normalizeTeam(team || {}, (game.rounds || []).length))
      : [],
    timer: state.timer || null,
    ...(state.view ? { view: state.view } : {}),
  };
}

function loadState() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(gameKey()) || "{}");
  } catch {
    raw = {};
  }
  return migrateState(raw, loadGame());
}

function saveState(state) {
  const normalized = migrateState(state, loadGame());
  localStorage.setItem(gameKey(), JSON.stringify(normalized));
}

function rankTeams(teams) {
  const sorted = (teams || [])
    .map((team, order) => ({ ...team, score: teamTotal(team), order }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  let previousScore;
  let previousRank = 0;
  return sorted.map((team, index) => {
    const rank = index > 0 && team.score === previousScore ? previousRank : index + 1;
    previousScore = team.score;
    previousRank = rank;
    return { ...team, rank };
  });
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function resultsCsv(game, state) {
  const rounds = game.rounds || [];
  const headings = ["Rank", "Team", "Table", ...rounds.map((round, index) => round.name || `Round ${index + 1}`), "Adjustment", "Total"];
  const rows = rankTeams(migrateState(state, game).teams).map((team) => [
    team.rank,
    team.name,
    team.table,
    ...team.roundScores,
    team.adjustment,
    team.score,
  ]);
  return [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function resultFilename(gameCode) {
  const safe = String(gameCode || "trivia").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "trivia";
  return `${safe}-results.csv`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STATE_VERSION,
    defaultGame,
    flatten,
    normalizeTeam,
    migrateState,
    teamTotal,
    rankTeams,
    resultsCsv,
    resultFilename,
  };
}
