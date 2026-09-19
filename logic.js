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
    {
      id: "mult",
      op: "×",
      emoji: "✖️",
      name: "Multiplying Frenzy",
      sub: "0 to 12 · no clock",
      hint: "Top number times side number.",
      // 13 possible headers, 10 columns: each sheet draws a different ten, so
      // the tables that appear change every time.
      top: range(0, 12),
      side: range(0, 12),
      pick: 10,
      untimed: true,
    },
  ];

  const ROUND_MS = 5 * 60 * 1000;
  const GOAL = 98;

  function levelById(id) { return LEVELS.find((l) => l.id === id) || LEVELS[0]; }

  function compute(op, top, side) {
    if (op === "+") return top + side;
    if (op === "×") return top * side;
    return top - side;
  }

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

  // A level's headers come from a pool. Most levels use the whole pool (ten of
  // ten, so the sheet is a permutation); a level with `pick` draws that many of
  // them at random, without repeats, so no column is a duplicate of another.
  function headerPool(level, axis) { return axis === "top" ? level.top : level.side; }
  function headerCount(level, axis) { return level.pick || headerPool(level, axis).length; }
  function cellCount(level) { return headerCount(level, "top") * headerCount(level, "side"); }

  function pickHeaders(level, axis, rng) {
    const drawn = shuffle(headerPool(level, axis), rng);
    return level.pick ? drawn.slice(0, level.pick) : drawn;
  }

  // Are these headers a legitimate draw for this level? (Right count, all from
  // the pool, no repeats.) Used to vet a saved round before resuming it.
  function validHeaders(level, arr, axis) {
    const pool = headerPool(level, axis);
    if (!Array.isArray(arr) || arr.length !== headerCount(level, axis)) return false;
    const seen = new Set();
    for (const v of arr) {
      if (!Number.isInteger(v) || pool.indexOf(v) === -1 || seen.has(v)) return false;
      seen.add(v);
    }
    return true;
  }

  // One sheet: column headers across the top, row headers down the side.
  // Every top/side pair appears exactly once, like the printed sheet.
  function makeRound(level, rng) {
    return {
      levelId: level.id,
      op: level.op,
      top: pickHeaders(level, "top", rng),
      side: pickHeaders(level, "side", rng),
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
  // An untimed sheet records timedOut false, so it only has to reach 98.
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
    headerPool, headerCount, cellCount, pickHeaders, validHeaders,
    shouldCommit, nextEmpty, score, fmtTime, betterThan, isGoal,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Frenzy = api;
})(typeof self !== "undefined" ? self : this);
