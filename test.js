/* Unit tests for logic.js — run with `node test.js`. */
"use strict";
const assert = require("assert");
const F = require("./logic.js");

let n = 0;
function test(name, fn) { fn(); n++; console.log("  ✓ " + name); }

// deterministic rng for reproducible shuffles
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

test("three levels, 10 x 10 each", () => {
  assert.strictEqual(F.LEVELS.length, 3);
  for (const l of F.LEVELS) { assert.strictEqual(l.top.length, 10); assert.strictEqual(l.side.length, 10); }
  assert.deepStrictEqual(F.levelById("add").top, [0,1,2,3,4,5,6,7,8,9]);
  assert.deepStrictEqual(F.levelById("sub").top, [9,10,11,12,13,14,15,16,17,18]);
  assert.deepStrictEqual(F.levelById("sub").side, [0,1,2,3,4,5,6,7,8,9]);
  assert.strictEqual(F.levelById("nope").id, "add", "unknown id falls back to the classic sheet");
});

test("a round shuffles headers as permutations; every pair appears exactly once", () => {
  for (const l of F.LEVELS) {
    for (let seed = 1; seed <= 20; seed++) {
      const r = F.makeRound(l, lcg(seed));
      assert.deepStrictEqual(r.top.slice().sort((a, b) => a - b), l.top);
      assert.deepStrictEqual(r.side.slice().sort((a, b) => a - b), l.side);
      const seen = new Set();
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) seen.add(r.top[j] + "," + r.side[i]);
      assert.strictEqual(seen.size, 100);
    }
  }
});

test("shuffle does not mutate and eventually produces different orders", () => {
  const src = [1, 2, 3, 4, 5];
  const rng = lcg(7);
  const a = F.shuffle(src, rng), b = F.shuffle(src, rng);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5]);
  assert.notDeepStrictEqual(a, b);
});

test("answers match the printed answer sheet (top + side, top − side)", () => {
  // first sheet on the PDF: top 3 2 7 8 9 5 1 0 6 4, side 3 0 2 8 6 7 5 1 9 4 → row 4 (side 8) = 11 10 15 16 17 13 9 8 14 12
  const r = { op: "+", top: [3,2,7,8,9,5,1,0,6,4], side: [3,0,2,8,6,7,5,1,9,4] };
  assert.deepStrictEqual([0,1,2,3,4,5,6,7,8,9].map((c) => F.answerAt(r, 3, c)), [11,10,15,16,17,13,9,8,14,12]);
  const s = { op: "−", top: [14, 9, 18], side: [6, 0, 9] };
  assert.strictEqual(F.answerAt(s, 0, 0), 8);   // 14 − 6
  assert.strictEqual(F.answerAt(s, 2, 1), 0);   // 9 − 9
  assert.strictEqual(F.answerAt(s, 1, 2), 18);  // 18 − 0
});

test("possible answers and digit lengths per level", () => {
  const add = F.possibleAnswers(F.levelById("add"));
  assert.deepStrictEqual(add, Array.from({ length: 19 }, (_, i) => i));
  assert.strictEqual(F.maxDigits(add), 2);
  const big = F.possibleAnswers(F.levelById("addbig"));
  assert.deepStrictEqual(big, Array.from({ length: 19 }, (_, i) => i + 10));
  assert.strictEqual(F.maxDigits(big), 2);
  const sub = F.possibleAnswers(F.levelById("sub"));
  assert.deepStrictEqual(sub, Array.from({ length: 19 }, (_, i) => i));
  assert.ok(sub.every((a) => a >= 0), "no negative differences on the subtracting sheet");
});

test("auto-advance: commit when nothing longer is possible", () => {
  const add = F.possibleAnswers(F.levelById("add"));
  for (const d of ["0", "2", "3", "4", "5", "6", "7", "8", "9"]) assert.strictEqual(F.shouldCommit(d, add, 2), true, d);
  assert.strictEqual(F.shouldCommit("1", add, 2), false, "1 could become 10–18");
  assert.strictEqual(F.shouldCommit("12", add, 2), true);
  assert.strictEqual(F.shouldCommit("19", add, 2), true, "max length always commits, even if wrong");
  const big = F.possibleAnswers(F.levelById("addbig"));
  assert.strictEqual(F.shouldCommit("1", big, 2), false);
  assert.strictEqual(F.shouldCommit("2", big, 2), false);
  assert.strictEqual(F.shouldCommit("3", big, 2), false, "3 can't be any answer here: a slip, so wait for ⌫ rather than commit a wrong square");
  assert.strictEqual(F.shouldCommit("0", big, 2), false);
  assert.strictEqual(F.shouldCommit("35", big, 2), true, "two digits is as long as it gets — commit even if wrong");
  assert.strictEqual(F.shouldCommit("05", add, 2), true);
});

test("nextEmpty skips filled squares and wraps; -1 when full", () => {
  const v = ["", "a", "", "b"];
  assert.strictEqual(F.nextEmpty(v, 0), 2);
  assert.strictEqual(F.nextEmpty(v, 2), 0);
  assert.strictEqual(F.nextEmpty(v, 3), 0);
  assert.strictEqual(F.nextEmpty(["x", "y"], 0), -1);
  assert.strictEqual(F.nextEmpty(["", "y"], 0), 0, "only the current square is empty: come back to it");
});

test("scoring counts right, wrong and blank and marks each square", () => {
  const r = { op: "+", top: [1, 2], side: [3, 4] };   // answers: 4 5 / 5 6
  const res = F.score(r, ["4", "5", "", "7"]);
  assert.deepStrictEqual({ correct: res.correct, wrong: res.wrong, blank: res.blank, total: res.total }, { correct: 2, wrong: 1, blank: 1, total: 4 });
  assert.deepStrictEqual(res.marks, ["correct", "correct", "blank", "wrong"]);
  assert.strictEqual(F.score(r, ["04", "5", "5", "6"]).correct, 4, "a leading zero is still the right number");
});

test("time formatting: countdown ceils, elapsed floors", () => {
  assert.strictEqual(F.fmtTime(F.ROUND_MS, true), "5:00");
  assert.strictEqual(F.fmtTime(299_800, true), "5:00");
  assert.strictEqual(F.fmtTime(299_000, true), "4:59");
  assert.strictEqual(F.fmtTime(1, true), "0:01");
  assert.strictEqual(F.fmtTime(0, true), "0:00");
  assert.strictEqual(F.fmtTime(-500, true), "0:00");
  assert.strictEqual(F.fmtTime(252_900), "4:12");
  assert.strictEqual(F.fmtTime(299_999), "4:59");
  assert.strictEqual(F.fmtTime(65_000), "1:05");
});

test("betterThan: goal first, then more right, then faster", () => {
  assert.strictEqual(F.betterThan({ correct: 90, ms: 300000 }, null), true);
  assert.strictEqual(F.isGoal({ correct: 98, ms: 250000, timedOut: false }), true);
  assert.strictEqual(F.isGoal({ correct: 99, ms: 300000, timedOut: true }), false);
  assert.strictEqual(F.betterThan({ correct: 98, ms: 280000, timedOut: false }, { correct: 99, ms: 300000, timedOut: true }), true, "reaching the goal beats a higher timed-out score");
  assert.strictEqual(F.betterThan({ correct: 99, ms: 300000, timedOut: true }, { correct: 98, ms: 280000, timedOut: false }), false);
  assert.strictEqual(F.betterThan({ correct: 91, ms: 300000 }, { correct: 90, ms: 100000 }), true);
  assert.strictEqual(F.betterThan({ correct: 90, ms: 200000 }, { correct: 90, ms: 250000 }), true);
  assert.strictEqual(F.betterThan({ correct: 90, ms: 250000 }, { correct: 90, ms: 250000 }), false);
  assert.strictEqual(F.betterThan({ correct: 89, ms: 1000 }, { correct: 90, ms: 300000 }), false);
});

console.log(`\n${n} tests passed`);
