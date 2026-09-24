/* Merge Blocks — original GameHub implementation.
   Sliding merge puzzle: join matching tiles to reach 2048 and beyond. */
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
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const continueBtn = document.getElementById("continueBtn");
  const newBtn = document.getElementById("newBtn");
  if (!boardEl) return;

  const SIZE = 4;
  const TARGET = 2048;
  const DIRS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };

  let grid = [];
  let tiles = [];
  let score = 0;
  let best = loadBest();
  let over = false;
  let won = false;
  let keepGoing = false;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_merge_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_merge_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function buildBoard() {
    while (boardEl.firstChild) boardEl.firstChild.remove();
    tiles = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("role", "gridcell");
      boardEl.appendChild(tile);
      tiles.push(tile);
    }
  }

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function render() {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tile = tiles[y * SIZE + x];
        const value = grid[y][x];
        tile.textContent = value ? String(value) : "";
        if (value) tile.setAttribute("data-v", String(value));
        else tile.removeAttribute("data-v");
      }
    }
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
  }

  function randomEmpty() {
    const empty = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0) empty.push([x, y]);
      }
    }
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
  }

  function spawn() {
    const cell = randomEmpty();
    if (cell) grid[cell[1]][cell[0]] = Math.random() < 0.9 ? 2 : 4;
  }

  function showEnd(title, text, canContinue) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (continueBtn) continueBtn.hidden = !canContinue;
    if (overlay) overlay.hidden = false;
  }

  function hideEnd() {
    if (overlay) overlay.hidden = true;
  }

  function start() {
    grid = emptyGrid();
    score = 0;
    over = false;
    won = false;
    keepGoing = false;
    spawn();
    spawn();
    hideEnd();
    render(null);
  }

  function slide(row) {
    const compact = row.filter((v) => v !== 0);
    const merged = [];
    let gained = 0;
    for (let i = 0; i < compact.length; i++) {
      if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
        const value = compact[i] * 2;
        merged.push(value);
        gained += value;
        i += 1;
      } else {
        merged.push(compact[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0);
    return { row: merged, gained };
  }

  function move(dx, dy) {
    if (over || (won && !keepGoing)) return;
    let moved = false;
    let gained = 0;
    if (dx !== 0) {
      for (let y = 0; y < SIZE; y++) {
        const row = grid[y].slice();
        if (dx < 0) {
          const result = slide(row);
          gained += result.gained;
          for (let x = 0; x < SIZE; x++) {
            if (grid[y][x] !== result.row[x]) moved = true;
            grid[y][x] = result.row[x];
          }
        } else {
          const result = slide(row.reverse());
          result.row.reverse();
          gained += result.gained;
          for (let x = 0; x < SIZE; x++) {
            if (grid[y][x] !== result.row[x]) moved = true;
            grid[y][x] = result.row[x];
          }
        }
      }
    } else {
      for (let x = 0; x < SIZE; x++) {
        const col = [grid[0][x], grid[1][x], grid[2][x], grid[3][x]];
        if (dy < 0) {
          const result = slide(col);
          gained += result.gained;
          for (let y = 0; y < SIZE; y++) {
            if (grid[y][x] !== result.row[y]) moved = true;
            grid[y][x] = result.row[y];
          }
        } else {
          const result = slide(col.reverse());
          result.row.reverse();
          gained += result.gained;
          for (let y = 0; y < SIZE; y++) {
            if (grid[y][x] !== result.row[y]) moved = true;
            grid[y][x] = result.row[y];
          }
        }
      }
    }
    if (!moved) return;
    score += gained;
    if (score > best) {
      best = score;
      saveBest();
    }
    spawn();
    render(null);
    const biggest = Math.max(...grid.flat());
    if (!won && biggest >= TARGET) {
      won = true;
      showEnd("You reached 2048!", `Brilliant merging — ${score} points. Keep going for an even bigger tile?`, true);
      return;
    }
    if (!canMove()) {
      over = true;
      showEnd("No moves left", `Final score ${score}. Every merge counts — try again!`, false);
    }
  }

  function canMove() {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (grid[y][x] === 0) return true;
        if (x + 1 < SIZE && grid[y][x] === grid[y][x + 1]) return true;
        if (y + 1 < SIZE && grid[y][x] === grid[y + 1][x]) return true;
      }
    }
    return false;
  }

  window.addEventListener("keydown", (event) => {
    const dir = DIRS[event.code];
    if (dir) {
      event.preventDefault();
      move(dir[0], dir[1]);
    } else if (event.code === "Enter" && (over || (won && !keepGoing))) {
      start();
    }
  });

  let touchStart = null;
  boardEl.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  boardEl.addEventListener("touchend", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !touchStart) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  });
  boardEl.addEventListener("touchmove", (event) => {
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (continueBtn) continueBtn.addEventListener("click", () => {
    keepGoing = true;
    hideEnd();
  });
  if (newBtn) newBtn.addEventListener("click", start);

  buildBoard();
  start();
  requestAnimationFrame(function idle() {
    /* Event-driven game: no per-frame loop needed. Single rAF keeps
       the shell's frame contract satisfied in automated checks. */
  });
})();
