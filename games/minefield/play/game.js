/* Minefield — original GameHub implementation.
   Minesweeper-style logic puzzle with 3 difficulties and safe first click. */
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
  const mineCountEl = document.getElementById("mineCount");
  const timerEl = document.getElementById("timer");
  const flagBtn = document.getElementById("flagBtn");
  const newBtn = document.getElementById("newBtn");
  const modeRow = document.getElementById("modeRow");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!boardEl) return;

  const DIFFS = {
    easy: { size: 9, mines: 10 },
    medium: { size: 12, mines: 22 },
    hard: { size: 16, mines: 45 }
  };

  let diff = "easy";
  let size = 9;
  let mineTotal = 10;
  let mines = [];
  let open = [];
  let flagged = [];
  let cells = [];
  let started = false;
  let over = false;
  let flagMode = false;
  let seconds = 0;
  let timerId = null;
  let longPressTimer = null;

  function neighbors(index) {
    const x = index % size;
    const y = Math.floor(index / size);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size) out.push(ny * size + nx);
      }
    }
    return out;
  }

  function adjacentMines(index) {
    return neighbors(index).filter((i) => mines[i]).length;
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      seconds += 1;
      if (timerEl) timerEl.textContent = String(seconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function renderCounts() {
    const flags = flagged.filter(Boolean).length;
    if (mineCountEl) mineCountEl.textContent = String(Math.max(mineTotal - flags, 0));
    if (timerEl) timerEl.textContent = String(seconds);
  }

  function build() {
    const config = DIFFS[diff] || DIFFS.easy;
    size = config.size;
    mineTotal = config.mines;
    mines = Array(size * size).fill(false);
    open = Array(size * size).fill(false);
    flagged = Array(size * size).fill(false);
    cells = [];
    started = false;
    over = false;
    seconds = 0;
    stopTimer();
    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    while (boardEl.firstChild) boardEl.firstChild.remove();
    for (let i = 0; i < size * size; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Cell ${i + 1}`);
      cell.dataset.index = String(i);
      boardEl.appendChild(cell);
      cells.push(cell);
    }
    if (overlay) overlay.hidden = true;
    renderCounts();
  }

  function plantMines(safeIndex) {
    const forbidden = new Set([safeIndex, ...neighbors(safeIndex)]);
    let placed = 0;
    let guard = 0;
    while (placed < mineTotal && guard < 20000) {
      guard += 1;
      const index = Math.floor(Math.random() * size * size);
      if (mines[index] || forbidden.has(index)) continue;
      mines[index] = true;
      placed += 1;
    }
  }

  function paint(index) {
    const cell = cells[index];
    if (!cell || !open[index]) return;
    cell.classList.add("open");
    cell.disabled = true;
    if (mines[index]) {
      cell.textContent = "●";
      cell.classList.add("boom");
      return;
    }
    const count = adjacentMines(index);
    if (count > 0) {
      cell.textContent = String(count);
      cell.setAttribute("data-n", String(count));
    } else {
      cell.textContent = "";
    }
  }

  function reveal(index) {
    if (over || flagged[index] || open[index]) return;
    if (!started) {
      started = true;
      plantMines(index);
      startTimer();
    }
    if (mines[index]) {
      open[index] = true;
      paint(index);
      lose();
      return;
    }
    const stack = [index];
    while (stack.length) {
      const current = stack.pop();
      if (open[current] || flagged[current]) continue;
      open[current] = true;
      paint(current);
      if (adjacentMines(current) === 0) {
        for (const next of neighbors(current)) {
          if (!open[next] && !flagged[next]) stack.push(next);
        }
      }
    }
    checkWin();
  }

  function toggleFlag(index) {
    if (over || open[index]) return;
    flagged[index] = !flagged[index];
    const cell = cells[index];
    cell.classList.toggle("flagged", flagged[index]);
    cell.textContent = flagged[index] ? "⚑" : "";
    cell.setAttribute("aria-label", flagged[index] ? `Cell ${index + 1}, flagged` : `Cell ${index + 1}`);
    renderCounts();
  }

  function checkWin() {
    const opened = open.filter(Boolean).length;
    if (opened === size * size - mineTotal) {
      over = true;
      stopTimer();
      for (let i = 0; i < mines.length; i++) {
        if (mines[i] && !flagged[i]) {
          flagged[i] = true;
          cells[i].classList.add("flagged");
          cells[i].textContent = "⚑";
        }
      }
      renderCounts();
      if (overlayTitle) overlayTitle.textContent = "Minefield cleared!";
      if (overlayText) overlayText.textContent = `Flawless logic — ${mineTotal} mines flagged in ${seconds} seconds.`;
      if (overlay) overlay.hidden = false;
    }
  }

  function lose() {
    over = true;
    stopTimer();
    for (let i = 0; i < mines.length; i++) {
      if (mines[i] && !flagged[i]) {
        open[i] = true;
        paint(i);
      }
    }
    if (overlayTitle) overlayTitle.textContent = "Boom!";
    if (overlayText) overlayText.textContent = "You hit a mine. Study the numbers and try again.";
    if (overlay) overlay.hidden = false;
  }

  function setFlagMode(on) {
    flagMode = on;
    if (flagBtn) {
      flagBtn.textContent = on ? "Flag: on" : "Flag: off";
      flagBtn.setAttribute("aria-pressed", String(on));
    }
  }

  boardEl.addEventListener("click", (event) => {
    const cell = event.target && event.target.closest ? event.target.closest(".cell") : null;
    if (!cell) return;
    const index = parseInt(cell.dataset.index, 10);
    if (!Number.isFinite(index)) return;
    if (flagMode) toggleFlag(index);
    else reveal(index);
  });
  boardEl.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const cell = event.target && event.target.closest ? event.target.closest(".cell") : null;
    if (!cell) return;
    const index = parseInt(cell.dataset.index, 10);
    if (Number.isFinite(index)) toggleFlag(index);
  });
  boardEl.addEventListener("touchstart", (event) => {
    const cell = event.target && event.target.closest ? event.target.closest(".cell") : null;
    if (!cell) return;
    const index = parseInt(cell.dataset.index, 10);
    if (!Number.isFinite(index)) return;
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => toggleFlag(index), 450);
  }, { passive: true });
  boardEl.addEventListener("touchend", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  boardEl.addEventListener("touchmove", () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  if (flagBtn) flagBtn.addEventListener("click", () => setFlagMode(!flagMode));
  if (newBtn) newBtn.addEventListener("click", build);
  if (primaryBtn) primaryBtn.addEventListener("click", build);
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-diff]") : null;
      if (!button) return;
      diff = button.getAttribute("data-diff") || "easy";
      const buttons = modeRow.querySelectorAll("button");
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn === button));
      }
      build();
    });
  }

  build();
})();
