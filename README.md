# 🔥 Five Minute Frenzy

**Play it here → https://trawleylab.github.io/five-minute-frenzy/**

The Math-Drills *Five Minute Adding Frenzy* sheet as an app. A 10 × 10 grid
with shuffled numbers across the top and down the side; every square is the
sum (or difference) of its column and row headers. Five minutes on the clock.
Goal: 98 out of 100 in under five minutes.

A ScupperLab production — Henry's adding and subtracting speed trainer.

## The four sheets

- **➕ Adding Frenzy** — 0 to 9 across and down, sums 0–18. The classic sheet.
- **💪 Adding Frenzy · Big** — 5 to 14, sums 10–28. The push.
- **➖ Subtracting Frenzy** — 9 to 18 across the top, 0 to 9 down the side;
  top number take away side number, differences 0–18.
- **✖️ Multiplying Frenzy** — the times tables, **and the only sheet with no
  clock**. Each sheet draws ten of the thirteen numbers 0 to 12 for the top
  and another ten for the side, so the tables on offer change every time and
  products run from 0 to 144.

Every top/side pair appears exactly once per sheet, just like the paper.

## How a round works

1. Tap a sheet → 3 · 2 · 1 · Go! The clock starts and the first square glows.
   (The times-table sheet skips the countdown and shows **No clock ✨** where
   the timer would be. Its time is still recorded and shown at the end, but
   never while he's working.)
2. Type the answer on the big keypad. A square moves on **by itself** the
   moment what you've typed is a possible answer that can't grow into a
   longer one (2–9 commit instantly on the classic sheet; 1 waits for a
   second digit or ➜). On the times-table sheet almost everything waits,
   because 3 could still become 36 — so ➜ glows whenever an entry is sitting
   ready to commit. It glows for any complete-looking number, right or wrong,
   so it never hints at the answer. ⌫ removes the last digit you typed, even
   if the square has already moved on — so a slip is one tap away.
3. Tap any square to jump to it; ➜ skips a square (it comes round again at
   the end). Physical keyboard works too: digits, Backspace, Enter/Tab/Space
   for next, arrows to move.
4. Tap **Finish** (it lights up when every square is filled; ➜ finishes too
   once the sheet is full) or wait for the buzzer. Marking happens at the
   end, like the paper: green = right, red = wrong with the right answer
   underneath, grey = blank.

Scores go into a history with a best per sheet (reaching the goal beats any
score that didn't). A round in progress survives the iPad killing the app:
the deadline is wall-clock, so relaunching picks it up with the right time
left. If the clock ran out while the app was closed, the round isn't counted.

## Install on iPad

Safari → the link above → Share → **Add to Home Screen**. Offline after the
first load; deploys reach installed iPads on their next online launch.

## Stack

Vanilla HTML/CSS/JS, no dependencies. `logic.js` holds the pure rules (sheet
generation, auto-advance, scoring) and is unit-tested with `node test.js`.
WebAudio-synthesised sound. GitHub Pages from `main`.

Deploy: `../bump.sh five-minute-frenzy` (bumps `version.js`, which names the
service-worker cache), commit, push.
