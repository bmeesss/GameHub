/* Sudoku — original GameHub implementation.
   Full puzzle engine: shuffled solutions, unique-solution digging,
   notes, hints, three difficulties, mistake limit. */
"use strict";
(function () {
  const shell = document.getElementById("shell");
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (shell && shell.requestFullscreen) {
          shell.requestFullscreen();
        }
      } catch (err) { /* fullscreen unsupported */ }
    });
  }

  const boardEl = document.getElementById("board");
  const mistakesEl = document.getElementById("mistakes");
  const hintsEl = document.getElementById("hints");
  const timerEl = document.getElementById("timer");
  const newBtn = document.getElementById("newBtn");
  const modeRow = document.getElementById("modeRow");
  const notesBtn = document.getElementById("notesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const eraseBtn = document.getElementById("eraseBtn");
  const padEl = document.getElementById("pad");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!boardEl || !padEl) return;

  const BASE = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ];
  const HOLES = { easy: 38, medium: 46, hard: 52 };
  const MAX_MISTAKES = 3;

  let diff = "easy";
  let solution = [];
  let puzzle = [];
  let entries = [];
  let notes = [];
  let cells = [];
  let selected = null;
  let notesMode = false;
  let mistakes = 0;
  let hints = 3;
  let seconds = 0;
  let timerId = null;
  let over = false;

  function shuffled(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function shuffledSolution() {
    const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const rowOrder = [];
    for (const band of shuffled([0, 1, 2])) {
      for (const row of shuffled([0, 1, 2])) rowOrder.push(band * 3 + row);
    }
    const colOrder = [];
    for (const stack of shuffled([0, 1, 2])) {
      for (const col of shuffled([0, 1, 2])) colOrder.push(stack * 3 + col);
    }
    const grid = rowOrder.map((r) => colOrder.map((c) => digits[BASE[r][c] - 1]));
    if (Math.random() < 0.5) {
      return grid[0].map((_, c) => grid.map((row) => row[c]));
    }
    return grid;
  }

  function findEmpty(grid) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (!grid[y][x]) return [x, y];
      }
    }
    return null;
  }

  function validPlacement(grid, x, y, value) {
    for (let i = 0; i < 9; i++) {
      if (grid[y][i] === value || grid[i][x] === value) return false;
    }
    const bx = Math.floor(x / 3) * 3;
    const by = Math.floor(y / 3) * 3;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        if (grid[by + dy][bx + dx] === value) return false;
      }
    }
    return true;
  }

  function countSolutions(grid, limit) {
    const empty = findEmpty(grid);
    if (!empty) return 1;
    const [x, y] = empty;
    let count = 0;
    for (let value = 1; value <= 9; value++) {
      if (!validPlacement(grid, x, y, value)) continue;
      grid[y][x] = value;
      count += countSolutions(grid, limit - count);
      grid[y][x] = 0;
      if (count >= limit) return count;
    }
    return count;
  }

  function digPuzzle(full, holes) {
    const grid = full.map((row) => row.slice());
    const positions = shuffled(Array.from({ length: 81 }, (_, i) => i));
    let dug = 0;
    for (const pos of positions) {
      if (dug >= holes) break;
      const x = pos % 9;
      const y = Math.floor(pos / 9);
      const mirror = (8 - y) * 9 + (8 - x);
      const mx = mirror % 9;
      const my = Math.floor(mirror / 9);
      const backup = grid[y][x];
      const backupMirror = grid[my][mx];
      grid[y][x] = 0;
      grid[my][mx] = 0;
      const trial = grid.map((row) => row.slice());
      if (countSolutions(trial, 2) === 1) {
        dug += (pos === mirror ? 1 : 2);
      } else {
        grid[y][x] = backup;
        grid[my][mx] = backupMirror;
      }
    }
    return grid;
  }

  function fmtTime(total) {
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function renderHud() {
    if (mistakesEl) mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
    if (hintsEl) hintsEl.textContent = String(hints);
    if (timerEl) timerEl.textContent = fmtTime(seconds);
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      seconds += 1;
      renderHud();
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function buildCells() {
    while (boardEl.firstChild) boardEl.firstChild.remove();
    cells = [];
    for (let i = 0; i < 81; i++) {
      const x = i % 9;
      const y = Math.floor(i / 9);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell" + (x % 3 === 2 && x !== 8 ? " box-r" : "") + (y % 3 === 2 && y !== 8 ? " box-b" : "");
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = String(i);
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function paintCell(index) {
    const cell = cells[index];
    const x = index % 9;
    const y = Math.floor(index / 9);
    while (cell.firstChild) cell.firstChild.remove();
    cell.classList.remove("given", "error", "selected", "peer", "same");
    if (puzzle[y][x]) {
      cell.classList.add("given");
      cell.textContent = String(puzzle[y][x]);
      cell.setAttribute("aria-label", `Given ${puzzle[y][x]}`);
      return;
    }
    const value = entries[y][x];
    if (value) {
      cell.textContent = String(value);
      if (value !== solution[y][x]) cell.classList.add("error");
      cell.setAttribute("aria-label", `Cell, ${value}`);
    } else {
      const marks = notes[y][x];
      if (marks.size) {
        const wrap = document.createElement("span");
        wrap.className = "notes";
        wrap.setAttribute("aria-hidden", "true");
        for (let n = 1; n <= 9; n++) {
          const slot = document.createElement("span");
          slot.textContent = marks.has(n) ? String(n) : "";
          wrap.appendChild(slot);
        }
        cell.appendChild(wrap);
      }
      cell.setAttribute("aria-label", "Empty cell");
    }
    if (selected !== null) {
      const sx = selected % 9;
      const sy = Math.floor(selected / 9);
      if (index === selected) cell.classList.add("selected");
      else if (x === sx || y === sy || (Math.floor(x / 3) === Math.floor(sx / 3) && Math.floor(y / 3) === Math.floor(sy / 3))) {
        cell.classList.add("peer");
      }
      const selValue = entries[sy][sx] || puzzle[sy][sx];
      const ownValue = entries[y][x] || puzzle[y][x];
      if (selValue && ownValue === selValue && index !== selected) cell.classList.add("same");
    }
  }

  function paintAll() {
    for (let i = 0; i < 81; i++) paintCell(i);
  }

  function newGame() {
    solution = shuffledSolution();
    puzzle = digPuzzle(solution, HOLES[diff] || HOLES.easy);
    entries = Array.from({ length: 9 }, () => Array(9).fill(0));
    notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    selected = null;
    mistakes = 0;
    hints = 3;
    seconds = 0;
    over = false;
    setNotes(false);
    buildCells();
    paintAll();
    if (overlay) overlay.hidden = true;
    startTimer();
    renderHud();
  }

  function setNotes(on) {
    notesMode = on;
    if (notesBtn) {
      notesBtn.textContent = on ? "Notes: on" : "Notes: off";
      notesBtn.setAttribute("aria-pressed", String(on));
    }
  }

  function select(index) {
    selected = index;
    paintAll();
  }

  function enterNumber(value) {
    if (over || selected === null) return;
    const x = selected % 9;
    const y = Math.floor(selected / 9);
    if (puzzle[y][x]) return;
    if (notesMode && !entries[y][x]) {
      const marks = notes[y][x];
      if (marks.has(value)) marks.delete(value);
      else marks.add(value);
      paintAll();
      return;
    }
    if (entries[y][x] === value) return;
    entries[y][x] = value;
    notes[y][x].clear();
    if (value !== solution[y][x]) {
      mistakes += 1;
      renderHud();
      if (mistakes >= MAX_MISTAKES) {
        lose();
        return;
      }
    }
    paintAll();
    checkWin();
  }

  function erase() {
    if (over || selected === null) return;
    const x = selected % 9;
    const y = Math.floor(selected / 9);
    if (puzzle[y][x]) return;
    entries[y][x] = 0;
    notes[y][x].clear();
    paintAll();
  }

  function useHint() {
    if (over || hints <= 0) return;
    const candidates = [];
    for (let i = 0; i < 81; i++) {
      const x = i % 9;
      const y = Math.floor(i / 9);
      if (!puzzle[y][x] && entries[y][x] !== solution[y][x]) candidates.push(i);
    }
    if (!candidates.length) return;
    hints -= 1;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    entries[Math.floor(pick / 9)][pick % 9] = solution[Math.floor(pick / 9)][pick % 9];
    notes[Math.floor(pick / 9)][pick % 9].clear();
    selected = pick;
    renderHud();
    paintAll();
    checkWin();
  }

  function checkWin() {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const value = entries[y][x] || puzzle[y][x];
        if (value !== solution[y][x]) return;
      }
    }
    over = true;
    stopTimer();
    if (overlayTitle) overlayTitle.textContent = "Puzzle solved!";
    if (overlayText) overlayText.textContent = `Beautiful logic — completed in ${fmtTime(seconds)} with ${mistakes} mistake${mistakes === 1 ? "" : "s"}.`;
    if (overlay) overlay.hidden = false;
  }

  function lose() {
    over = true;
    stopTimer();
    paintAll();
    if (overlayTitle) overlayTitle.textContent = "Out of mistakes";
    if (overlayText) overlayText.textContent = "Three wrong entries ends the run. A fresh puzzle awaits!";
    if (overlay) overlay.hidden = false;
  }

  function buildPad() {
    while (padEl.firstChild) padEl.firstChild.remove();
    for (let n = 1; n <= 9; n++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(n);
      button.setAttribute("aria-label", `Enter ${n}`);
      button.dataset.number = String(n);
      padEl.appendChild(button);
    }
  }

  boardEl.addEventListener("click", (event) => {
    const cell = event.target && event.target.closest ? event.target.closest(".cell") : null;
    if (!cell || over) return;
    const index = parseInt(cell.dataset.index, 10);
    if (Number.isFinite(index)) select(index);
  });

  padEl.addEventListener("click", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("[data-number]") : null;
    if (!button) return;
    enterNumber(parseInt(button.dataset.number, 10));
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyN") {
      setNotes(!notesMode);
      return;
    }
    if (event.code === "Backspace" || event.code === "Delete" || event.code === "Digit0") {
      event.preventDefault();
      erase();
      return;
    }
    const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (match) {
      enterNumber(parseInt(match[1], 10));
      return;
    }
    if (selected !== null && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const [dx, dy] = moves[event.code];
      const nx = Math.min(8, Math.max(0, (selected % 9) + dx));
      const ny = Math.min(8, Math.max(0, Math.floor(selected / 9) + dy));
      select(ny * 9 + nx);
    }
  });

  if (notesBtn) notesBtn.addEventListener("click", () => setNotes(!notesMode));
  if (hintBtn) hintBtn.addEventListener("click", useHint);
  if (eraseBtn) eraseBtn.addEventListener("click", erase);
  if (newBtn) newBtn.addEventListener("click", newGame);
  if (primaryBtn) primaryBtn.addEventListener("click", newGame);
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-diff]") : null;
      if (!button) return;
      diff = button.getAttribute("data-diff") || "easy";
      const buttons = modeRow.querySelectorAll("button");
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn === button));
      }
      newGame();
    });
  }

  buildPad();
  newGame();
})();
