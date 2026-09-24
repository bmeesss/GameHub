/* Pixel Puzzles — original GameHub implementation.
   Falling-block stacker: 7 pieces, bag randomizer, ghost, levels. */
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
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const touchControls = document.getElementById("touchControls");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const COLS = 10;
  const ROWS = 20;
  const CELL = canvas.width / COLS;
  const PIECES = {
    I: { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: "#22d3ee" },
    O: { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: "#fbbf24" },
    T: { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: "#a78bfa" },
    S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#4ade80" },
    Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#fb7185" },
    J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#60a5fa" },
    L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#fb923c" }
  };
  const LINE_SCORES = [0, 100, 300, 500, 800];

  let state = "ready";
  let grid = [];
  let bag = [];
  let current = null;
  let next = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropAcc = 0;
  let last = 0;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function dropInterval() {
    return Math.max(80, 800 * Math.pow(0.85, level - 1));
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (linesEl) linesEl.textContent = String(lines);
    if (levelEl) levelEl.textContent = String(level);
  }

  function showOverlay(title, text, button) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = button;
    if (overlay) overlay.hidden = false;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function drawFromBag() {
    if (bag.length === 0) {
      bag = Object.keys(PIECES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function spawn() {
    const kind = next || drawFromBag();
    next = drawFromBag();
    current = {
      kind,
      cells: PIECES[kind].cells.map(([x, y]) => ({ x, y })),
      x: 3,
      y: kind === "I" ? -1 : 0
    };
    if (collides(current.cells, current.x, current.y)) {
      gameOver();
    }
  }

  function collides(cells, ox, oy) {
    for (const cell of cells) {
      const x = cell.x + ox;
      const y = cell.y + oy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function rotateCells(cells) {
    const rotated = cells.map(({ x, y }) => ({ x: 2 - y, y: x }));
    const minX = Math.min(...rotated.map((c) => c.x));
    const minY = Math.min(...rotated.map((c) => c.y));
    return rotated.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  }

  function tryRotate() {
    if (!current || state !== "running") return;
    const rotated = rotateCells(current.cells);
    const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
    for (const [kx, ky] of kicks) {
      if (!collides(rotated, current.x + kx, current.y + ky)) {
        current.cells = rotated;
        current.x += kx;
        current.y += ky;
        return;
      }
    }
  }

  function move(dx, dy) {
    if (!current || state !== "running") return false;
    if (!collides(current.cells, current.x + dx, current.y + dy)) {
      current.x += dx;
      current.y += dy;
      return true;
    }
    return false;
  }

  function hardDrop() {
    if (!current || state !== "running") return;
    let distance = 0;
    while (!collides(current.cells, current.x, current.y + 1)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    lock();
  }

  function lock() {
    const color = PIECES[current.kind].color;
    for (const cell of current.cells) {
      const x = cell.x + current.x;
      const y = cell.y + current.y;
      if (y < 0) {
        gameOver();
        return;
      }
      grid[y][x] = color;
    }
    clearLines();
    dropAcc = 0;
    spawn();
    renderHud();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared += 1;
        y += 1;
      }
    }
    if (cleared > 0) {
      lines += cleared;
      score += LINE_SCORES[cleared] * level;
      level = 1 + Math.floor(lines / 10);
    }
  }

  function start() {
    grid = emptyGrid();
    bag = [];
    next = null;
    score = 0;
    lines = 0;
    level = 1;
    dropAcc = 0;
    state = "running";
    hideOverlay();
    renderHud();
    spawn();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Score ${score} · ${lines} lines · Level ${level}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    showOverlay("Stacked out!", `You scored ${score} points and cleared ${lines} lines.`, "Play again");
  }

  function drawBlock(px, py, size, color, ghost) {
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.28;
    else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = ghost ? "#94a3d8" : color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = ghost ? "transparent" : "rgba(255, 255, 255, 0.35)";
    if (!ghost) ctx.fillRect(px + 3, py + 3, size - 6, 4);
    ctx.strokeStyle = ghost ? "rgba(148, 163, 216, 0.8)" : "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawBlock(x * CELL, y * CELL, CELL, grid[y][x], false);
      }
    }
    if (current && state !== "over") {
      let ghostY = current.y;
      while (!collides(current.cells, current.x, ghostY + 1)) ghostY += 1;
      for (const cell of current.cells) {
        drawBlock((cell.x + current.x) * CELL, (cell.y + ghostY) * CELL, CELL, null, true);
      }
      const color = PIECES[current.kind].color;
      for (const cell of current.cells) {
        drawBlock((cell.x + current.x) * CELL, (cell.y + current.y) * CELL, CELL, color, false);
      }
    }
    if (next) {
      ctx.fillStyle = "rgba(242, 245, 255, 0.75)";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("NEXT", canvas.width - 10, 18);
      const color = PIECES[next].color;
      for (const cell of PIECES[next].cells) {
        drawBlock(canvas.width - 74 + cell.x * 14, 26 + cell.y * 14, 14, color, false);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === "running" && current) {
      dropAcc += dt * 1000;
      const interval = dropInterval();
      while (dropAcc >= interval && state === "running") {
        dropAcc -= interval;
        if (!move(0, 1)) {
          lock();
          break;
        }
      }
    }
    render();
  }

  function act(action) {
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    if (state !== "running") return;
    if (action === "left") move(-1, 0);
    else if (action === "right") move(1, 0);
    else if (action === "down") {
      if (move(0, 1)) {
        score += 1;
        renderHud();
      }
    }
    else if (action === "rotate") tryRotate();
    else if (action === "drop") hardDrop();
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
    if (event.repeat && event.code !== "ArrowDown") return;
    if (event.code === "ArrowLeft" || event.code === "KeyA") act("left");
    else if (event.code === "ArrowRight" || event.code === "KeyD") act("right");
    else if (event.code === "ArrowDown" || event.code === "KeyS") act("down");
    else if (event.code === "ArrowUp" || event.code === "KeyX" || event.code === "KeyW") act("rotate");
    else if (event.code === "Space") act("drop");
    else if (event.code === "KeyP" || event.code === "Escape") togglePause();
    else if (event.code === "Enter" && state !== "running") {
      if (state === "paused") togglePause();
      else start();
    }
  });
  if (touchControls) {
    touchControls.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (button) act(button.getAttribute("data-act"));
    });
  }
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  grid = emptyGrid();
  renderHud();
  requestAnimationFrame(frame);
})();
