/* Glow Grid — original GameHub implementation.
   Lights Out puzzle: switch every glowing pad off. Every board is
   generated from the solved state, so it is always solvable. */
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

  const grid = document.getElementById("grid");
  const levelEl = document.getElementById("level");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  if (!grid) return;

  const N = 5;
  let lights = [];
  let level = 1;
  let moves = 0;
  let best = loadBest();
  let state = "ready";

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_glow-grid"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_glow-grid", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function idx(r, c) {
    return r * N + c;
  }

  function press(r, c, silent) {
    const flips = [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [rr, cc] of flips) {
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) lights[idx(rr, cc)] = !lights[idx(rr, cc)];
    }
    if (!silent) {
      moves += 1;
      renderHud();
    }
  }

  function newLevel() {
    lights = new Array(N * N).fill(false);
    /* Pressing from the solved state guarantees solvability. */
    const presses = Math.min(4 + level * 2, 18);
    for (let i = 0; i < presses; i++) {
      press(Math.floor(Math.random() * N), Math.floor(Math.random() * N), true);
    }
    if (lights.every((on) => !on)) newLevel();
    moves = 0;
    renderHud();
  }

  function renderHud() {
    if (levelEl) levelEl.textContent = String(level);
    if (movesEl) movesEl.textContent = String(moves);
    if (bestEl) bestEl.textContent = best > 0 ? String(best) : "—";
  }

  function renderGrid() {
    const cells = grid.querySelectorAll("button");
    for (let i = 0; i < cells.length; i++) {
      cells[i].className = lights[i] ? "cell on" : "cell";
      cells[i].setAttribute("aria-pressed", lights[i] ? "true" : "false");
    }
  }

  function showOverlay(title, text, button) {
    if (!overlay) return;
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = button;
    overlay.hidden = false;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function start() {
    level = 1;
    newLevel();
    renderGrid();
    state = "running";
    hideOverlay();
  }

  function levelDone() {
    if (level > best) {
      best = level;
      saveBest();
    }
    renderHud();
    if (level >= 30) {
      state = "won";
      showOverlay("Glow master!", `You cleared ${level} levels. Best: ${best}.`, "Play again");
      return;
    }
    state = "between";
    showOverlay(`Level ${level} cleared`, `${moves} moves. The next grid starts with more lights on.`, "Next level");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Level ${level} · ${moves} moves.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  grid.addEventListener("click", (event) => {
    const cell = event.target && event.target.closest ? event.target.closest("[data-i]") : null;
    if (!cell || state !== "running") return;
    const i = parseInt(cell.getAttribute("data-i"), 10);
    if (!Number.isFinite(i)) return;
    press(Math.floor(i / N), i % N, false);
    renderGrid();
    if (lights.every((on) => !on)) levelDone();
  });

  function advance() {
    if (state === "between") {
      level += 1;
      newLevel();
      renderGrid();
      state = "running";
      hideOverlay();
    } else {
      start();
    }
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (state === "ready" || state === "won") start();
      else if (state === "between") advance();
    }
    if (event.key === "p" || event.key === "P") togglePause();
    if (event.key === "r" || event.key === "R") {
      if (state === "running") {
        newLevel();
        renderGrid();
      }
    }
  });

  if (primaryBtn) primaryBtn.addEventListener("click", advance);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      if (state === "running") {
        newLevel();
        renderGrid();
      }
    });
  }

  /* Build the board once. */
  for (let i = 0; i < N * N; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.setAttribute("data-i", String(i));
    cell.className = "cell";
    cell.setAttribute("aria-label", `Pad row ${Math.floor(i / N) + 1} column ${(i % N) + 1}`);
    grid.appendChild(cell);
  }

  newLevel();
  renderGrid();
  state = "ready";
  showOverlay("Glow Grid", "Clicking a pad flips it and its neighbors. Turn every light off to clear the level.", "Start game");
})();
