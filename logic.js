/* ============ Five Minute Frenzy — pure logic ============
   Loaded by the app (self.Frenzy) and by test.js under node (module.exports).
   No DOM, no timers; the only randomness is the injectable rng. */
(function (root) {
  "use strict";

  const range = (lo, hi) => { const a = []; for (let n = lo; n <= hi; n++) a.push(n); return a; };

  const LEVELS = [
    {
      id: "add",
      op: "+",
      emoji: "➕",
      name: "Adding Frenzy",
      sub: "0 to 9 · the classic sheet",
      hint: "Top number plus side number.",
      top: range(0, 9),
      side: range(0, 9),
    },
    {
      id: "addbig",
      op: "+",
      emoji: "💪",
      name: "Adding Frenzy · Big",
      sub: "5 to 14 · sums up to 28",
      hint: "Top number plus side number.",
      top: range(5, 14),
      side: range(5, 14),
    },
    {
      id: "sub",
      op: "−",
      emoji: "➖",
      name: "Subtracting Frenzy",
      sub: "9 to 18 take away 0 to 9",
      hint: "Top number take away side number.",
      top: range(9, 18),
      side: range(0, 9),
    },
  ];

  const ROUND_MS = 5 * 60 * 1000;
  const GOAL = 98;

  function levelById(id) { return LEVELS.find((l) => l.id === id) || LEVELS[0]; }

  function compute(op, top, side) { return op === "+" ? top + side : top - side; }

  // Fisher–Yates with an injectable rng (Math.random by default)
  function shuffle(arr, rng) {
    const a = arr.slice();
    const r = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // One sheet: shuffled column headers (top) and row headers (side).
  // Every top/side pair appears exactly once, like the printed sheet.
  function makeRound(level, rng) {
    return {
      levelId: level.id,
      op: level.op,
      top: shuffle(level.top, rng),
      side: shuffle(level.side, rng),
    };
  }

  function answerAt(round, r, c) { return compute(round.op, round.top[c], round.side[r]); }

  function possibleAnswers(level) {
    const set = new Set();
    for (const t of level.top) for (const s of level.side) set.add(compute(level.op, t, s));
    return Array.from(set).sort((a, b) => a - b);
  }

  function maxDigits(answers) { return answers.reduce((m, a) => Math.max(m, String(a).length), 1); }

  // After a digit is typed, should the square commit and move on?
  // Yes when the entry is as long as any answer can be, or when it IS a
  // possible answer and no longer answer starts with it (waiting can't help).
  // A stray digit that can't be any answer waits, so a slip can be ⌫'d.
  function shouldCommit(typed, answers, maxLen) {
    if (typed.length >= maxLen) return true;
    const n = Number(typed);
    if (String(n) !== typed || answers.indexOf(n) === -1) return false;
    return !answers.some((a) => { const s = String(a); return s.length > typed.length && s.indexOf(typed) === 0; });
  }

  // Index of the next empty cell strictly after `from`, wrapping; -1 if none.
  function nextEmpty(values, from) {
    const n = values.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (values[i] === "") return i;
    }
    return -1;
  }

  function score(round, values) {
    const n = round.side.length, m = round.top.length;
    let correct = 0, wrong = 0, blank = 0;
    const marks = new Array(n * m);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < m; c++) {
        const i = r * m + c;
        const v = values[i];
        if (v === "" || v == null) { blank++; marks[i] = "blank"; }
        else if (Number(v) === answerAt(round, r, c)) { correct++; marks[i] = "correct"; }
        else { wrong++; marks[i] = "wrong"; }
      }
    }
    return { correct, wrong, blank, total: n * m, marks };
  }

  // "m:ss". Countdowns use ceil (0:00 only at zero); elapsed times floor like a stopwatch.
  function fmtTime(ms, ceil) {
    const s = Math.max(0, ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  // The sheet's own goal: 98 or better, and the clock didn't beat you.
  function isGoal(h) { return !!h && h.correct >= GOAL && !h.timedOut; }

  // Is result a better than result b? Reaching the goal beats not reaching it;
  // then more correct wins; ties go to the faster time.
  function betterThan(a, b) {
    if (!b) return true;
    const ga = isGoal(a), gb = isGoal(b);
    if (ga !== gb) return ga;
    if (a.correct !== b.correct) return a.correct > b.correct;
    return a.ms < b.ms;
  }

  const api = {
    LEVELS, ROUND_MS, GOAL,
    levelById, shuffle, makeRound, answerAt, possibleAnswers, maxDigits,
    shouldCommit, nextEmpty, score, fmtTime, betterThan, isGoal,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Frenzy = api;
})(typeof self !== "undefined" ? self : this);
