/* Slide Puzzle — original GameHub implementation.
   Classic sliding tile puzzle: order the tiles, count your moves. */
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

  const canvas = document.getElementById("game");
  const movesEl = document.getElementById("moves");
  const bestEl = document.getElementById("best");
  const timeEl = document.getElementById("time");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIZE = canvas.width;
  const N = 4;
  const CELL = SIZE / N;
  const PAD = 5;

  let tiles = [];
  let blank = N * N - 1;
  let moves = 0;
  let best = loadBest();
  let state = "ready";
  let startTime = 0;
  let elapsed = 0;
  let anim = null;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_slide-puzzle"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_slide-puzzle", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function solved() {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== i) return false;
    }
    return true;
  }

  function neighbors(index) {
    const out = [];
    const r = Math.floor(index / N);
    const c = index % N;
    if (r > 0) out.push(index - N);
    if (r < N - 1) out.push(index + N);
    if (c > 0) out.push(index - 1);
    if (c < N - 1) out.push(index + 1);
    return out;
  }

  function shuffle() {
    tiles = [];
    for (let i = 0; i < N * N; i++) tiles.push(i);
    blank = N * N - 1;
    /* Random legal moves keep the puzzle solvable. */
    let prev = -1;
    for (let i = 0; i < 220; i++) {
      const options = neighbors(blank).filter((idx) => idx !== prev);
      const pick = options[Math.floor(Math.random() * options.length)];
      tiles[blank] = tiles[pick];
      tiles[pick] = N * N - 1;
      prev = blank;
      blank = pick;
    }
    if (solved()) shuffle();
  }

  function renderHud() {
    if (movesEl) movesEl.textContent = String(moves);
    if (bestEl) bestEl.textContent = best > 0 ? String(best) : "—";
    if (timeEl) timeEl.textContent = formatTime(elapsed);
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
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
    shuffle();
    moves = 0;
    elapsed = 0;
    startTime = performance.now();
    anim = null;
    state = "running";
    hideOverlay();
    renderHud();
  }

  function finish() {
    state = "won";
    if (moves > 0 && (best === 0 || moves < best)) {
      best = moves;
      saveBest();
    }
    renderHud();
    showOverlay("Solved!", `You ordered the grid in ${moves} moves and ${formatTime(elapsed)}.`, "Shuffle again");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `${moves} moves · ${formatTime(elapsed)}.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      startTime = performance.now() - elapsed;
      hideOverlay();
    }
  }

  function slide(index) {
    if (state !== "running") return;
    if (!neighbors(blank).includes(index)) return;
    tiles[blank] = tiles[index];
    tiles[index] = N * N - 1;
    blank = index;
    moves += 1;
    renderHud();
    if (solved()) finish();
  }

  function drawTile(value, x, y) {
    const hue = 200 + (value % N) * 22;
    const grad = ctx.createLinearGradient(x, y, x, y + CELL);
    grad.addColorStop(0, `hsl(${hue}, 62%, 34%)`);
    grad.addColorStop(1, `hsl(${hue}, 55%, 22%)`);
    ctx.fillStyle = grad;
    roundRect(x + PAD, y + PAD, CELL - PAD * 2, CELL - PAD * 2, 10);
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, .5)`;
    ctx.lineWidth = 1.5;
    roundRect(x + PAD, y + PAD, CELL - PAD * 2, CELL - PAD * 2, 10);
    ctx.stroke();
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 30px ui-sans-serif, system-ui, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value + 1), x + CELL / 2, y + CELL / 2 + 2);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = "#0a1120";
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < tiles.length; i++) {
      if (i === blank) continue;
      const value = tiles[i];
      drawTile(value, (i % N) * CELL, Math.floor(i / N) * CELL);
    }
    /* Subtle empty-slot marker */
    ctx.strokeStyle = "rgba(148,163,216,.18)";
    roundRect((blank % N) * CELL + PAD, Math.floor(blank / N) * CELL + PAD, CELL - PAD * 2, CELL - PAD * 2, 10);
    ctx.stroke();
  }

  function frame() {
    requestAnimationFrame(frame);
    if (state === "running") {
      elapsed = performance.now() - startTime;
      if (timeEl && Math.floor(elapsed / 500) % 2 === 0) renderHud();
    }
    draw();
  }

  window.addEventListener("keydown", (event) => {
    if (state === "ready" || state === "won") {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        start();
      }
      return;
    }
    /* Arrow = direction the tile moves into the blank. */
    const r = Math.floor(blank / N);
    const c = blank % N;
    let target = -1;
    if (event.key === "ArrowUp" && r < N - 1) target = blank + N;
    if (event.key === "ArrowDown" && r > 0) target = blank - N;
    if (event.key === "ArrowLeft" && c < N - 1) target = blank + 1;
    if (event.key === "ArrowRight" && c > 0) target = blank - 1;
    if (target >= 0) {
      event.preventDefault();
      slide(target);
    }
    if (event.key === "p" || event.key === "P") togglePause();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state === "ready" || state === "won") {
      start();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? SIZE / rect.width : 1;
    const c = Math.floor(((event.clientX - rect.left) * scale) / CELL);
    const r = Math.floor(((event.clientY - rect.top) * scale) / CELL);
    if (c >= 0 && c < N && r >= 0 && r < N) slide(r * N + c);
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  shuffle();
  renderHud();
  state = "ready";
  showOverlay("Slide Puzzle", "Slide the tiles until the numbers read 1–15. Arrow keys or clicks both work.", "Start game");
  requestAnimationFrame(frame);
})();
