/* Box Push — original GameHub implementation.
   Sokoban puzzler: push every crate onto its target, 5 levels. */
"use strict";
(function () {
  /* Play shell: fullscreen toggle. */
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
  const levelEl = document.getElementById("level");
  const movesEl = document.getElementById("moves");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const restartBtn = document.getElementById("restartBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_box-push";
  const LEVELS = [
    [
      "######",
      "#....#",
      "#.P..#",
      "#.B..#",
      "#.G..#",
      "######"
    ],
    [
      "#######",
      "#.....#",
      "#.P.B.#",
      "#..B..#",
      "#.G.G.#",
      "#.....#",
      "#######"
    ],
    [
      "########",
      "#......#",
      "#.P.B.G#",
      "#......#",
      "########"
    ],
    [
      "#######",
      "#.....#",
      "#.....#",
      "#.B.P.#",
      "#.....#",
      "#.G...#",
      "#######"
    ],
    [
      "########",
      "#......#",
      "#.P....#",
      "#.B.B..#",
      "#..B...#",
      "#.G.G..#",
      "#..G...#",
      "########"
    ]
  ];
  const DIRS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };

  let walls = new Set();
  let goals = new Set();
  let boxes = [];
  let player = { x: 1, y: 1 };
  let cols = 6;
  let rows = 6;
  let level = 0;
  let moves = 0;
  let state = "ready";
  let bump = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(value) && value > 0 ? Math.min(value, LEVELS.length) : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (err) { /* storage unavailable */ }
  }

  let best = loadBest();

  function key(x, y) {
    return x + "," + y;
  }

  function loadLevel(index) {
    const map = LEVELS[index];
    walls = new Set();
    goals = new Set();
    boxes = [];
    rows = map.length;
    cols = 0;
    for (let y = 0; y < map.length; y++) {
      cols = Math.max(cols, map[y].length);
      for (let x = 0; x < map[y].length; x++) {
        const cell = map[y][x];
        if (cell === "#") walls.add(key(x, y));
        else if (cell === "G") goals.add(key(x, y));
        else if (cell === "B") boxes.push({ x, y });
        else if (cell === "P") player = { x, y };
      }
    }
    moves = 0;
    renderHud();
  }

  function renderHud() {
    if (levelEl) levelEl.textContent = `${level + 1}/${LEVELS.length}`;
    if (movesEl) movesEl.textContent = String(moves);
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

  function startRun() {
    level = 0;
    loadLevel(level);
    state = "running";
    hideOverlay();
  }

  function nextLevel() {
    level += 1;
    if (level >= LEVELS.length) {
      state = "won";
      showOverlay("Warehouses cleared!", `You solved all ${LEVELS.length} warehouses. Superb pushing!`, "Play again");
      return;
    }
    loadLevel(level);
    if (level + 1 > best) {
      best = level + 1;
      saveBest(best);
    }
    state = "running";
    hideOverlay();
  }

  function isSolved() {
    if (!goals.size) return false;
    for (const box of boxes) {
      if (!goals.has(key(box.x, box.y))) return false;
    }
    return boxes.length >= goals.size;
  }

  function tryMove(dx, dy) {
    if (state !== "running") return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (walls.has(key(nx, ny))) {
      bump = 0.12;
      return;
    }
    const boxIndex = boxes.findIndex((b) => b.x === nx && b.y === ny);
    if (boxIndex === -1) {
      player = { x: nx, y: ny };
      moves += 1;
      renderHud();
      return;
    }
    const bx = nx + dx;
    const by = ny + dy;
    if (walls.has(key(bx, by)) || boxes.some((b) => b.x === bx && b.y === by)) {
      bump = 0.12;
      return;
    }
    boxes[boxIndex] = { x: bx, y: by };
    player = { x: nx, y: ny };
    moves += 1;
    renderHud();
    if (isSolved()) {
      state = "clear";
      if (level + 1 >= LEVELS.length) {
        nextLevel();
      } else {
        showOverlay(`Level ${level + 1} clear!`, `Solved in ${moves} moves. Ready for the next warehouse?`, "Next level");
      }
    }
  }

  function cellGeom() {
    const W = canvas.width;
    const H = canvas.height;
    const cell = Math.min(W / cols, H / rows);
    const ox = (W - cell * cols) / 2;
    const oy = (H - cell * rows) / 2;
    return { cell, ox, oy };
  }

  function render(dt) {
    bump = Math.max(0, bump - dt);
    const W = canvas.width;
    const H = canvas.height;
    const { cell, ox, oy } = cellGeom();
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    const shake = bump > 0 ? Math.sin(bump * 60) * 2 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = ox + x * cell;
        const py = oy + y * cell;
        if (walls.has(key(x, y))) {
          ctx.fillStyle = "#2a3560";
          ctx.fillRect(px, py, cell, cell);
          ctx.fillStyle = "rgba(124, 92, 255, 0.35)";
          ctx.fillRect(px + 2, py + 2, cell - 4, 4);
        } else {
          ctx.fillStyle = (x + y) % 2 ? "#0a0f22" : "#0c1230";
          ctx.fillRect(px, py, cell, cell);
        }
      }
    }
    for (const g of goals) {
      const [gx, gy] = g.split(",").map(Number);
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(ox + (gx + 0.5) * cell, oy + (gy + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const box of boxes) {
      const onGoal = goals.has(key(box.x, box.y));
      const px = ox + box.x * cell;
      const py = oy + box.y * cell;
      const pad = cell * 0.12;
      ctx.fillStyle = onGoal ? "#4ade80" : "#f59e0b";
      ctx.fillRect(px + pad, py + pad, cell - pad * 2, cell - pad * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + pad, py + pad, cell - pad * 2, cell - pad * 2);
      ctx.beginPath();
      ctx.moveTo(px + pad, py + pad);
      ctx.lineTo(px + cell - pad, py + cell - pad);
      ctx.moveTo(px + cell - pad, py + pad);
      ctx.lineTo(px + pad, py + cell - pad);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(ox + (player.x + 0.5) * cell, oy + (player.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    render(dt);
  }

  function keyOf(event) {
    if (event.key) return event.key;
    return String(event.code || "");
  }

  function onKeyDown(event) {
    const move = DIRS[keyOf(event)];
    if (move) {
      event.preventDefault();
      if (state === "ready") startRun();
      else if (state === "won") startRun();
      else if (state === "clear") nextLevel();
      tryMove(move[0], move[1]);
      return;
    }
    const k = keyOf(event);
    if (k === " " || k === "Enter" || k === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "won") startRun();
      else if (state === "clear") nextLevel();
    } else if (k === "r" || k === "R") {
      if (!event.repeat && (state === "running" || state === "clear")) {
        event.preventDefault();
        loadLevel(level);
      }
    } else if (k === "Escape" || k === "p" || k === "P") {
      event.preventDefault();
    }
  }

  let touchStart = null;
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !touchStart) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (state === "ready" || state === "won") startRun();
      else if (state === "clear") nextLevel();
      return;
    }
    if (state === "ready" || state === "won") startRun();
    else if (state === "clear") nextLevel();
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "clear") nextLevel();
    else startRun();
  });
  if (restartBtn) restartBtn.addEventListener("click", () => {
    if (state === "running" || state === "clear") loadLevel(level);
    else if (state === "ready" || state === "won") startRun();
  });

  loadLevel(0);
  state = "ready";
  showOverlay("Box Push", "Push every crate onto a glowing target. Plan ahead — crates only move forward.", "Start game");
  requestAnimationFrame(frame);
})();
