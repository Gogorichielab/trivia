const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

async function workerModule() {
  const source = fs.readFileSync("worker/src/index.js", "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

function roomState(saved) {
  return {
    storage: {
      get: async () => saved.value,
      put: async (_key, value) => { saved.value = value; },
    },
  };
}

const game = {
  rounds: [{
    name: "Round 1",
    questions: [{ text: "Public question", answer: "Secret answer", notes: "Private host note" }],
  }],
  tiebreaker: { text: "Tie question", answer: "Tie answer" },
};

test("viewer payload exposes only the current public screen", async () => {
  const { GameRoom } = await workerModule();
  const saved = { value: { version: 2, index: 2, teams: [{ name: "Team", score: 3, private: "hidden" }], timer: null, game, rev: 4 } };
  const room = new GameRoom(roomState(saved), { HOST_TOKEN: "test-token" });

  const response = await room.fetch(new Request("https://worker.invalid/game/review001"));
  const body = await response.json();

  assert.equal(body.view.type, "question");
  assert.equal(body.view.text, "Public question");
  assert.equal(body.view.answer, undefined);
  assert.equal(body.game, undefined);
  assert.deepEqual(body.teams, [{ name: "Team", score: 3 }]);
  assert.doesNotMatch(JSON.stringify(body), /Secret answer|Private host note|Tie answer/);
});

test("tiebreaker answer stays private until its reveal step", async () => {
  const { GameRoom } = await workerModule();
  const hidden = { value: { version: 2, index: 5, teams: [], timer: null, game, rev: 1 } };
  const hiddenRoom = new GameRoom(roomState(hidden), { HOST_TOKEN: "test-token" });
  const question = await (await hiddenRoom.fetch(new Request("https://worker.invalid/game/review001"))).json();
  assert.equal(question.view.type, "tiebreaker");
  assert.equal(question.view.answer, undefined);

  const shown = { value: { ...hidden.value, index: 6 } };
  const shownRoom = new GameRoom(roomState(shown), { HOST_TOKEN: "test-token" });
  const answer = await (await shownRoom.fetch(new Request("https://worker.invalid/game/review001"))).json();
  assert.equal(answer.view.type, "tiebreaker-answer");
  assert.equal(answer.view.answer, "Tie answer");
});

test("authenticated host can recover the complete saved game", async () => {
  const { GameRoom } = await workerModule();
  const saved = { value: { version: 2, index: 2, teams: [], timer: null, game, rev: 4 } };
  const room = new GameRoom(roomState(saved), { HOST_TOKEN: "test-token" });

  const response = await room.fetch(new Request("https://worker.invalid/game/review001", {
    headers: { "x-host-token": "test-token" },
  }));
  const body = await response.json();

  assert.equal(body.game.rounds[0].questions[0].answer, "Secret answer");
  assert.equal(body.rev, 4);
});

test("worker rejects an update based on an old revision", async () => {
  const { GameRoom } = await workerModule();
  const saved = { value: { index: 2, teams: [{ name: "Team", score: 2 }], timer: null, game, rev: 5 } };
  const room = new GameRoom(roomState(saved), { HOST_TOKEN: "test-token" });

  const response = await room.fetch(new Request("https://worker.invalid/game/review001", {
    method: "POST",
    headers: { "content-type": "application/json", "x-host-token": "test-token" },
    body: JSON.stringify({ index: 1, teams: [{ name: "Team", score: 1 }], baseRev: 4 }),
  }));

  assert.equal(response.status, 409);
  assert.equal(saved.value.index, 2);
  assert.equal(saved.value.teams[0].score, 2);
});
