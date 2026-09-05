/* ============ Five Minute Frenzy ============
   The Math-Drills "Five Minute Frenzy" sheet as an app: a 10 × 10 grid of
   shuffled numbers, every square the sum (or difference) of its column and
   row headers, five minutes on the clock, marked at the end like the paper.
   A ScupperLab production — vanilla JS, no dependencies, offline-first. */

"use strict";

const F = self.Frenzy;
const app = document.getElementById("app");
const fxLayer = document.getElementById("fx-layer");

/* ---------- persistence ---------- */
const STORE_KEY = "frenzy.v1";
const ROUND_KEY = "frenzy.round";
const HISTORY_MAX = 300;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        return { muted: !!s.muted, history: Array.isArray(s.history) ? s.history : [] };
      }
    }
  } catch (e) { /* ignore */ }
  return { muted: false, history: [] };
}
const store = loadStore();
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

function historyFor(levelId) { return store.history.filter((h) => h.level === levelId); }
function bestFor(levelId) {
  let best = null;
  for (const h of historyFor(levelId)) if (F.betterThan(h, best)) best = h;
  return best;
}

/* ---------- sound (WebAudio, synthesised — no assets) ---------- */
let audioCtx = null;
function ac() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  return audioCtx;
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioCtx && audioCtx.state !== "running") audioCtx.resume().catch(() => {});
});

function tone(freq, dur, type, vol, when = 0, glideTo = null) {
  const ctx = ac();
  if (!ctx || store.muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const sfx = {
  tap() { tone(600, 0.06, "sine", 0.12); },
  key() { tone(1000, 0.035, "square", 0.035); },
  count() { tone(660, 0.12, "sine", 0.18); },
  go() { tone(880, 0.12, "sine", 0.2); tone(1320, 0.3, "sine", 0.2, 0.12); },
  tick() { tone(1400, 0.03, "square", 0.05); },
  buzzer() { tone(220, 0.6, "sawtooth", 0.14, 0, 110); },
  finish() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, "triangle", 0.16, i * 0.12)); },
  goal() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, "triangle", 0.18, i * 0.11));
    tone(1568, 0.6, "sine", 0.16, 0.6);
  },
};

/* ---------- tiny DOM helpers ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(cls, text, onClick) {
  const b = el("button", cls, text);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
function isStandalone() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}
function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}
function toast(msg) {
  const t = el("div", "toast", msg);
  fxLayer.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function burst() {
  const emojis = ["🔥", "⭐", "🎉", "✨", "🧡"];
  for (let i = 0; i < 28; i++) {
    const s = el("span", "confetti", emojis[i % emojis.length]);
    s.style.left = (Math.random() * 100) + "%";
    s.style.animationDelay = (Math.random() * 0.8) + "s";
    s.style.fontSize = (20 + Math.random() * 24) + "px";
    fxLayer.appendChild(s);
    setTimeout(() => s.remove(), 3800);
  }
}

/* ---------- confirm popover ---------- */
let modal = null;
function confirmBox(title, sub, okLabel, onOk, cancelLabel = "Keep going") {
  closeConfirm();
  const bd = el("div", "confirm-backdrop");
  const box = el("div", "confirm");
  box.append(el("div", "c-title", title), el("div", "c-sub", sub));
  const row = el("div", "c-row");
  row.append(
    btn("big-btn", cancelLabel, () => { sfx.tap(); closeConfirm(); }),
    btn("big-btn primary", okLabel, () => { sfx.tap(); closeConfirm(); onOk(); })
  );
  box.appendChild(row);
  bd.appendChild(box);
  bd.addEventListener("pointerdown", (e) => { if (e.target === bd) closeConfirm(); });
  document.body.appendChild(bd);
  modal = bd;
}
function closeConfirm() { if (modal) { modal.remove(); modal = null; } }

/* ---------- home ---------- */
function renderHome() {
  stopRound();
  document.body.dataset.screen = "home";
  const home = el("div", "home");
  home.appendChild(el("h1", null, "🔥 Five Minute Frenzy"));
  home.appendChild(el("p", "tagline",
    "Fill every square before the clock runs out. Goal: 98 out of 100 in under five minutes."));

  const row = el("div", "mode-row");
  for (const level of F.LEVELS) {
    const b = btn("mode-btn", null, () => { sfx.tap(); startRound(level); });
    b.appendChild(el("span", "mode-emoji", level.emoji));
    b.appendChild(el("span", "mode-name", level.name));
    b.appendChild(el("span", "mode-sub", level.sub));
    const best = bestFor(level.id);
    b.appendChild(el("span", "mode-best",
      best ? `Best ${best.correct}/100 · ${best.timedOut ? "time's up" : F.fmtTime(best.ms)}` : "No rounds yet"));
    row.appendChild(b);
  }
  home.appendChild(row);

  const pills = el("div", "pill-row");
  pills.appendChild(btn("pill-btn", "📜 History", () => { sfx.tap(); renderHistory(); }));
  home.appendChild(pills);

  if (!isStandalone()) {
    home.appendChild(el("p", "install-hint", "On the iPad: Share → Add to Home Screen. Works offline after that."));
  }
  home.appendChild(el("div", "scupperlab",
    `A ScupperLab production  ·  v${self.APP_VERSION || "?"}${self.APP_DATE ? " · " + self.APP_DATE : ""}`));
  app.replaceChildren(home);
}

/* ---------- history ---------- */
function renderHistory() {
  stopRound();
  document.body.dataset.screen = "history";
  const page = el("div", "history");
  const top = el("div", "topbar");
  top.append(
    btn("quit-btn wide", "‹ Home", () => { sfx.tap(); renderHome(); }),
    el("div", "tb-level", "History")
  );
  page.appendChild(top);

  if (!store.history.length) {
    page.appendChild(el("p", "empty", "No rounds yet. Go on — five minutes!"));
  } else {
    const bests = {};
    for (const l of F.LEVELS) bests[l.id] = bestFor(l.id);
    const list = el("div", "hist-list");
    store.history.slice().reverse().forEach((h) => {
      const lvl = F.levelById(h.level);
      const goal = h.correct >= F.GOAL && !h.timedOut;
      const row = el("div", "hist-row" + (bests[h.level] === h ? " best" : "") + (goal ? " goal" : ""));
      row.append(
        el("span", "h-level", `${lvl.emoji} ${lvl.name}`),
        el("span", "h-score", `${h.correct}/100`),
        el("span", "h-time", h.timedOut ? "⏰ 5:00" : F.fmtTime(h.ms)),
        el("span", "h-when", fmtWhen(h.when))
      );
      list.appendChild(row);
    });
    page.appendChild(list);
    page.appendChild(el("p", "hist-key", "⭐ best for that level · green = 98+ in under five minutes"));
    page.appendChild(btn("pill-btn danger", "Clear history", () => {
      sfx.tap();
      confirmBox("Clear all history?", "Every score and best will be gone.", "Clear", () => {
        store.history = [];
        saveStore();
        renderHistory();
      }, "Cancel");
    }));
  }
  app.replaceChildren(page);
}

/* ---------- the round ---------- */
let round = null;   // state
let ui = null;      // DOM refs for the play screen
let gridRO = null;

function stopRound() {
  closeConfirm();
  if (round) {
    if (round.timerId) clearInterval(round.timerId);
    if (round.countdownId) clearTimeout(round.countdownId);
  }
  if (gridRO) { gridRO.disconnect(); gridRO = null; }
  window.removeEventListener("resize", fitGrid);
  window.removeEventListener("orientationchange", fitGrid);
  round = null;
  ui = null;
}

function saveRoundProgress() {
  if (!round || !round.live || round.finished) return;
  try {
    localStorage.setItem(ROUND_KEY, JSON.stringify({
      levelId: round.level.id, data: round.data, values: round.values,
      sel: round.sel, startAt: round.startAt, deadline: round.deadline,
    }));
  } catch (e) { /* ignore */ }
}
function clearRoundProgress() { try { localStorage.removeItem(ROUND_KEY); } catch (e) { /* ignore */ } }
function loadRoundProgress() {
  try {
    const raw = localStorage.getItem(ROUND_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || !s.data || !Array.isArray(s.values)) return null;
    const level = F.levelById(s.levelId);
    if (level.id !== s.levelId) return null;
    const n = level.top.length * level.side.length;
    if (s.values.length !== n || !s.values.every((v) => typeof v === "string")) return null;
    if (!Array.isArray(s.data.top) || !Array.isArray(s.data.side)) return null;
    if (s.data.top.length !== level.top.length || s.data.side.length !== level.side.length) return null;
    if (typeof s.startAt !== "number" || typeof s.deadline !== "number") return null;
    if (typeof s.sel !== "number" || s.sel < 0 || s.sel >= n) s.sel = 0;
    s.data.op = level.op;
    return { level, saved: s };
  } catch (e) { return null; }
}

function startRound(level, saved) {
  stopRound();
  const answers = F.possibleAnswers(level);
  const n = level.top.length * level.side.length;
  round = {
    level,
    data: saved ? saved.data : F.makeRound(level),
    values: saved ? saved.values.slice() : new Array(n).fill(""),
    answers,
    maxLen: F.maxDigits(answers),
    sel: saved ? saved.sel : 0,
    fresh: true,
    live: false,
    finished: false,
    startAt: saved ? saved.startAt : 0,
    deadline: saved ? saved.deadline : 0,
    lastTickSec: null,
    timerId: null,
    countdownId: null,
  };
  renderRoundScreen();
  if (saved) {
    goLive();
    if (round && !round.finished) toast(`Picked up where you left off · ${F.fmtTime(round.deadline - Date.now(), true)} left`);
  } else {
    runCountdown();
  }
}

function renderRoundScreen() {
  document.body.dataset.screen = "play";
  const { level, data } = round;
  const n = data.side.length, m = data.top.length;
  const play = el("div", "play");

  // top bar: quit · level · timer · filled · finish
  const top = el("div", "topbar");
  const quit = btn("quit-btn", "✕", () => {
    if (!round || round.finished) return;
    sfx.tap();
    confirmBox("Quit this round?", "It won't be counted.", "Quit", () => { clearRoundProgress(); renderHome(); });
  });
  quit.setAttribute("aria-label", "Quit round");
  const timer = el("div", "tb-timer", F.fmtTime(F.ROUND_MS, true));
  const filled = el("div", "tb-filled");
  const filledN = el("b", null, "0");
  filled.append(filledN, ` / ${n * m}`);
  const finish = btn("finish-btn", "Finish", onFinishTap);
  top.append(quit, el("div", "tb-level", level.name), timer, filled, finish);

  // the grid
  const arena = el("div", "arena");
  const wrap = el("div", "grid-wrap");
  const grid = el("div", "grid");
  const cells = [], topHd = [], sideHd = [];
  grid.appendChild(el("div", "hd corner", level.op));
  for (let c = 0; c < m; c++) { const h = el("div", "hd top", String(data.top[c])); topHd.push(h); grid.appendChild(h); }
  for (let r = 0; r < n; r++) {
    const h = el("div", "hd side", String(data.side[r])); sideHd.push(h); grid.appendChild(h);
    for (let c = 0; c < m; c++) {
      const i = r * m + c;
      const cell = el("div", "cell", round.values[i]);
      cell.dataset.i = i;
      cells.push(cell);
      grid.appendChild(cell);
    }
  }
  grid.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".cell");
    if (!t) return;
    e.preventDefault();
    if (!round || !round.live || round.finished || modal) return;
    select(Number(t.dataset.i), true);
    sfx.key();
  });
  wrap.appendChild(grid);

  // the keypad
  const pad = el("div", "pad");
  const q = el("div", "question");
  const qExpr = el("span", "q-expr");
  const qAns = el("span", "q-ans");
  const qTyped = el("span", "q-typed");
  qAns.append(qTyped, el("i", "caret"));
  q.append(qExpr, el("span", "q-eq", "="), qAns);
  const keys = el("div", "keys");
  for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "next"]) {
    const b = el("button", "key" + (k === "back" ? " key-back" : k === "next" ? " key-next" : ""),
      k === "back" ? "⌫" : k === "next" ? "➜" : k);
    b.type = "button";
    b.dataset.key = k;
    b.setAttribute("aria-label", k === "back" ? "Backspace" : k === "next" ? "Next square" : k);
    keys.appendChild(b);
  }
  keys.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-key]");
    if (!b) return;
    e.preventDefault();
    b.classList.add("down");
    setTimeout(() => b.classList.remove("down"), 90);
    pressKey(b.dataset.key);
  });
  const hint = el("div", "pad-hint", `${level.hint} Tap ➜ to move on.`);
  pad.append(q, keys, hint);

  arena.append(wrap, pad);

  const countdown = el("div", "countdown");
  const cdNum = el("div", "cd-num", "");
  const cdCap = el("div", "cd-cap", "Type the answer for the glowing square. It moves on by itself.");
  countdown.append(cdNum, cdCap);
  countdown.hidden = true;

  play.append(top, arena, countdown);
  app.replaceChildren(play);

  ui = { play, timer, filledN, finish, grid, wrap, cells, topHd, sideHd, qExpr, qTyped, hint, countdown, cdNum, n, m };
  fitGrid();
  // belt and braces: the observer catches layout changes, the window events
  // catch rotations and viewport changes that some engines don't observe
  if (window.ResizeObserver) { gridRO = new ResizeObserver(fitGrid); gridRO.observe(wrap); }
  window.addEventListener("resize", fitGrid);
  window.addEventListener("orientationchange", fitGrid);
  requestAnimationFrame(fitGrid);
  paintSelection();
  updateFilled();
}

function fitGrid() {
  if (!ui) return;
  const w = ui.wrap.clientWidth, h = ui.wrap.clientHeight;
  const side = Math.max(0, Math.floor(Math.min(w, h)));
  ui.grid.style.width = side + "px";
  ui.grid.style.height = side + "px";
  ui.grid.style.setProperty("--cell", (side / (ui.m + 1)) + "px");
}

function runCountdown() {
  const cd = ui.countdown;
  cd.hidden = false;
  const steps = ["3", "2", "1", "Go!"];
  let k = 0;
  const step = () => {
    if (!round || round.finished || !ui) return;
    const s = steps[k];
    ui.cdNum.textContent = s;
    cd.classList.toggle("go", s === "Go!");
    ui.cdNum.classList.remove("pop");
    void ui.cdNum.offsetWidth;
    ui.cdNum.classList.add("pop");
    if (s === "Go!") {
      sfx.go();
      goLive();
      round.countdownId = setTimeout(() => { if (ui) ui.countdown.hidden = true; }, 450);
    } else {
      sfx.count();
      k++;
      round.countdownId = setTimeout(step, 750);
    }
  };
  step();
}

function goLive() {
  round.live = true;
  if (!round.startAt) {
    round.startAt = Date.now();
    round.deadline = round.startAt + F.ROUND_MS;
  }
  select(round.sel, true);
  round.timerId = setInterval(tick, 200);
  saveRoundProgress();
  tick();
}

function tick() {
  if (!round || !round.live || round.finished || !ui) return;
  const rem = round.deadline - Date.now();
  ui.timer.textContent = F.fmtTime(rem, true);
  const secLeft = Math.ceil(rem / 1000);
  if (secLeft <= 10) {
    ui.timer.classList.add("urgent");
    if (rem > 0 && secLeft !== round.lastTickSec) { round.lastTickSec = secLeft; sfx.tick(); }
  }
  if (rem <= 0) finishRound(true);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

/* ---------- input ---------- */
function select(i, fresh) {
  round.sel = i;
  round.fresh = fresh;
  paintSelection();
  saveRoundProgress();
}

function paintSelection() {
  const { cells, topHd, sideHd, m } = ui;
  const i = round.sel, r = Math.floor(i / m), c = i % m;
  cells.forEach((cell, k) => cell.classList.toggle("sel", k === i));
  topHd.forEach((h, k) => h.classList.toggle("hl", k === c));
  sideHd.forEach((h, k) => h.classList.toggle("hl", k === r));
  ui.qExpr.textContent = `${round.data.top[c]} ${round.data.op} ${round.data.side[r]}`;
  ui.qTyped.textContent = round.values[i];
}

function setValue(i, v) {
  round.values[i] = v;
  ui.cells[i].textContent = v;
  if (i === round.sel) ui.qTyped.textContent = v;
  updateFilled();
  saveRoundProgress();
}

function updateFilled() {
  const count = round.values.reduce((a, v) => a + (v !== "" ? 1 : 0), 0);
  ui.filledN.textContent = String(count);
  const all = count === round.values.length;
  ui.finish.classList.toggle("ready", all);
  ui.finish.textContent = all ? "Finish ✓" : "Finish";
  ui.hint.textContent = all
    ? "Every square is filled — tap Finish ✓ to stop the clock!"
    : `${round.level.hint} Tap ➜ to move on.`;
  ui.hint.classList.toggle("ready", all);
}

function pressKey(k) {
  if (!round || !round.live || round.finished || modal) return;
  if (/^[0-9]$/.test(k)) typeDigit(k);
  else if (k === "back") backspace();
  else if (k === "next") { sfx.key(); advance(); }
}

function typeDigit(d) {
  const i = round.sel;
  let cur = round.fresh ? "" : round.values[i];
  if (cur.length >= round.maxLen) cur = "";   // overflow: start the square again
  const typed = cur + d;
  round.fresh = false;
  setValue(i, typed);
  sfx.key();
  if (F.shouldCommit(typed, round.answers, round.maxLen)) advance();
}

function backspace() {
  const i = round.sel;
  const cur = round.values[i];
  sfx.key();
  if (cur.length) { round.fresh = false; setValue(i, cur.slice(0, -1)); }
  else if (i > 0) select(i - 1, false);     // step back to edit, keep what's there
}

// Move to the next empty square after the current one (wrapping), so skipped
// squares come round again at the end. Nowhere to go = everything's filled.
function advance() {
  const next = F.nextEmpty(round.values, round.sel);
  if (next === -1) { round.fresh = true; return; }
  select(next, true);
}

function moveSel(delta) {
  const j = round.sel + delta;
  if (j >= 0 && j < round.values.length) select(j, true);
}

document.addEventListener("keydown", (e) => {
  if (!round || !round.live || round.finished || modal || !ui) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (/^[0-9]$/.test(k)) { e.preventDefault(); pressKey(k); }
  else if (k === "Backspace" || k === "Delete") { e.preventDefault(); pressKey("back"); }
  else if (k === "Enter" || k === "Tab" || k === " ") { e.preventDefault(); pressKey("next"); }
  else if (k === "ArrowRight") { e.preventDefault(); moveSel(1); }
  else if (k === "ArrowLeft") { e.preventDefault(); moveSel(-1); }
  else if (k === "ArrowUp") { e.preventDefault(); moveSel(-ui.m); }
  else if (k === "ArrowDown") { e.preventDefault(); moveSel(ui.m); }
});

/* ---------- finishing ---------- */
function onFinishTap() {
  if (!round || !round.live || round.finished) return;
  sfx.tap();
  const blank = round.values.filter((v) => v === "").length;
  if (blank === 0) { finishRound(false); return; }
  confirmBox(`Finish with ${blank} blank?`, "Blank squares score nothing. The clock keeps running.", "Finish",
    () => finishRound(false));
}

function finishRound(timedOut) {
  if (!round || round.finished) return;
  round.finished = true;
  round.live = false;
  if (round.timerId) { clearInterval(round.timerId); round.timerId = null; }
  closeConfirm();
  const ms = timedOut ? F.ROUND_MS : Math.max(0, Math.min(F.ROUND_MS, Date.now() - round.startAt));
  const res = F.score(round.data, round.values);
  const prevBest = bestFor(round.level.id);
  const entry = {
    level: round.level.id, when: new Date().toISOString(),
    correct: res.correct, wrong: res.wrong, blank: res.blank, ms, timedOut: !!timedOut,
  };
  store.history.push(entry);
  if (store.history.length > HISTORY_MAX) store.history = store.history.slice(-HISTORY_MAX);
  saveStore();
  clearRoundProgress();
  const goal = entry.correct >= F.GOAL && !timedOut;
  if (timedOut) sfx.buzzer(); else if (goal) sfx.goal(); else sfx.finish();
  renderResults(entry, res, prevBest, goal);
}

function renderResults(entry, res, prevBest, goal) {
  document.body.dataset.screen = "results";
  const { level, data, values } = round;
  const n = data.side.length, m = data.top.length;
  const isBest = F.betterThan(entry, prevBest);

  const page = el("div", "results");
  const side = el("div", "r-side");
  const card = el("div", "score-card" + (goal ? " goal" : ""));
  card.appendChild(el("div", "kicker", `${level.emoji} ${level.name}`));
  const big = el("div", "big-score");
  big.append(el("b", null, String(entry.correct)), el("span", null, ` / ${res.total}`));
  card.appendChild(big);
  card.appendChild(el("div", "score-line",
    `⏱ ${entry.timedOut ? "Time's up" : F.fmtTime(entry.ms)}   ✅ ${entry.correct}   ❌ ${entry.wrong}   ⬜ ${entry.blank}`));
  let verdict;
  if (goal) verdict = "🔥 Frenzy Master! 98 or better in under five minutes.";
  else if (entry.timedOut && entry.correct >= F.GOAL) verdict = "So close! 98+ — now beat the clock.";
  else if (!prevBest) verdict = "First round done. The goal is 98 in under 5:00.";
  else if (isBest) verdict = "⭐ New best for this level!";
  else verdict = `Goal: 98 in under 5:00 · your best is ${prevBest.correct} in ${prevBest.timedOut ? "5:00" : F.fmtTime(prevBest.ms)}`;
  card.appendChild(el("div", "verdict", verdict));
  side.appendChild(card);
  side.appendChild(el("p", "review-key",
    "Green = right · Red = wrong, the right answer is underneath · Grey = blank"));
  const btns = el("div", "btn-row");
  btns.append(
    btn("big-btn primary", "Again 🔁", () => { sfx.tap(); startRound(level); }),
    btn("big-btn", "Home", () => { sfx.tap(); renderHome(); })
  );
  side.appendChild(btns);

  // the marked sheet
  const wrap = el("div", "review-wrap");
  const grid = el("div", "grid review");
  grid.appendChild(el("div", "hd corner", data.op));
  for (let c = 0; c < m; c++) grid.appendChild(el("div", "hd top", String(data.top[c])));
  for (let r = 0; r < n; r++) {
    grid.appendChild(el("div", "hd side", String(data.side[r])));
    for (let c = 0; c < m; c++) {
      const i = r * m + c;
      const mark = res.marks[i];
      const cell = el("div", "cell " + mark);
      if (mark === "correct") cell.textContent = values[i];
      else {
        if (mark === "wrong") cell.appendChild(el("span", "was", values[i]));
        cell.appendChild(el("span", "ans", String(F.answerAt(data, r, c))));
      }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);

  page.append(side, wrap);
  app.replaceChildren(page);
  if (goal) burst();
}

/* ---------- mute + boot ---------- */
const muteBtn = document.getElementById("mute-btn");
function paintMute() { muteBtn.textContent = store.muted ? "🔇" : "🔊"; }
muteBtn.addEventListener("click", () => {
  store.muted = !store.muted;
  saveStore();
  paintMute();
  if (!store.muted) sfx.tap();
});
paintMute();

// A round in progress survives the iPad killing the app: the deadline is
// wall-clock, so we simply pick it up (or mark it, if the clock ran out).
const resume = loadRoundProgress();
if (resume) startRound(resume.level, resume.saved);
else renderHome();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
