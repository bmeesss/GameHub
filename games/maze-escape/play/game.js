/* Maze Escape — original GameHub implementation.
   Freshly generated mazes (recursive backtracker), collectible
   time shards and a countdown. Levels grow, the clock shrinks. */
"use strict";
(function () {
  const shell = document.getElementById("shell");
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (shell && shell.requestFullscreen) shell.requestFullscreen();
      } catch (err) { /* fullscreen unsupported */ }
    });
  }

  const canvas = document.getElementById("game");
  const levelEl = document.getElementById("level");
  const shardsEl = document.getElementById("shards");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_maze-escape";
  const W = canvas.width;
  const H = canvas.height;

  let level = 1;
  let best = readNumber(BEST_KEY);
  let cols = 8;
  let rows = 8;
  let cell = W / cols;
  let grid = [];
  let player = { r: 0, c: 0, x: 0, y: 0 };
  let exitCell = { r: 0, c: 0 };
  let shards = [];
  let collected = 0;
  let remaining = 0;
  let state = "idle";
  let paused = false;
  let message = "Enter the maze";
  let moveCooldown = 0;
  let trail = [];

  function readNumber(key) {
    try {
      const raw = localStorage.getItem(key);
      const value = parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (err) { /* storage unavailable */ }
  }

  function showOverlay(title, text, label, visible) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = label;
    if (overlay) overlay.hidden = !visible;
  }

  const hideOverlay = () => { if (overlay) overlay.hidden = true; };

  function refreshHud() {
    if (levelEl) levelEl.textContent = String(level);
    if (shardsEl) shardsEl.textContent = collected + "/" + (collected + shards.length);
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining)));
    if (bestEl) bestEl.textContent = String(best);
  }

  /* ---------------- Maze generation ----------------
     Walls are bit flags: 1 up, 2 right, 4 down, 8 left. */
  function generate(nextCols, nextRows) {
    cols = nextCols;
    rows = nextRows;
    cell = Math.min(W / cols, H / rows);
    grid = [];
    for (let i = 0; i < cols * rows; i++) grid.push({ walls: 15, visited: false });
    const stack = [0];
    grid[0].visited = true;
    while (stack.length) {
      const index = stack[stack.length - 1];
      const r = Math.floor(index / cols);
      const c = index % cols;
      const options = [];
      if (r > 0 && !grid[index - cols].visited) options.push({ index: index - cols, dir: 1, back: 4 });
      if (c < cols - 1 && !grid[index + 1].visited) options.push({ index: index + 1, dir: 2, back: 8 });
      if (r < rows - 1 && !grid[index + cols].visited) options.push({ index: index + cols, dir: 4, back: 1 });
      if (c > 0 && !grid[index - 1].visited) options.push({ index: index - 1, dir: 8, back: 2 });
      if (!options.length) {
        stack.pop();
        continue;
      }
      const pick = options[Math.floor(Math.random() * options.length)];
      grid[index].walls &= ~pick.dir;
      grid[pick.index].walls &= ~pick.back;
      grid[pick.index].visited = true;
      stack.push(pick.index);
    }
    player = { r: 0, c: 0, x: cell / 2, y: cell / 2 };
    exitCell = { r: rows - 1, c: cols - 1 };
    const shardCount = Math.min(4, 1 + Math.floor(level / 2));
    shards = [];
    while (shards.length < shardCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if ((r === 0 && c === 0) || (r === exitCell.r && c === exitCell.c)) continue;
      if (shards.some((shard) => shard.r === r && shard.c === c)) continue;
      shards.push({ r: r, c: c, taken: false });
    }
    collected = 0;
    remaining = Math.max(18, 34 - level * 1.4);
    trail = [];
  }

  function startLevel() {
    generate(Math.min(15, 7 + level), Math.min(15, 7 + level));
    state = "playing";
    paused = false;
    message = "Find the exit";
    hideOverlay();
    refreshHud();
  }

  function loseLevel(reason) {
    state = "over";
    if (level - 1 > best) {
      best = level - 1;
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
    showOverlay("Maze lost", reason + " You reached level " + level + " — your best is " + best + ".", "Try again", true);
  }

  function nextLevel() {
    level++;
    if (level - 1 > best) {
      best = level - 1;
      writeNumber(BEST_KEY, best);
    }
    showOverlay("Level clear", "", "", false);
    startLevel();
  }

  function tryMove(dr, dc) {
    if (state !== "playing" || paused) return;
    const index = player.r * cols + player.c;
    const walls = grid[index].walls;
    if (dr === -1 && (walls & 1)) return;
    if (dc === 1 && (walls & 2)) return;
    if (dr === 1 && (walls & 4)) return;
    if (dc === -1 && (walls & 8)) return;
    const nr = player.r + dr;
    const nc = player.c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;
    trail.push({ r: player.r, c: player.c });
    if (trail.length > 90) trail.shift();
    player.r = nr;
    player.c = nc;
    for (const shard of shards) {
      if (!shard.taken && shard.r === nr && shard.c === nc) {
        shard.taken = true;
        collected++;
        remaining += 4;
        message = "Shard collected — +4 seconds";
        refreshHud();
      }
    }
    if (nr === exitCell.r && nc === exitCell.c) {
      if (shards.every((shard) => shard.taken)) {
        nextLevel();
      } else {
        message = "Collect every shard first";
        refreshHud();
      }
    }
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    moveCooldown = Math.max(0, moveCooldown - dt);
    const targetX = player.c * cell + cell / 2;
    const targetY = player.r * cell + cell / 2;
    player.x += (targetX - player.x) * 0.35;
    player.y += (targetY - player.y) * 0.35;
    remaining -= dt / 1000;
    if (remaining <= 0) {
      remaining = 0;
      loseLevel("The clock beat you to the exit.");
      return;
    }
    refreshHud();
  }

  /* ---------------- Rendering ---------------- */
  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(148, 163, 216, 0.35)";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const walls = grid[r * cols + c] ? grid[r * cols + c].walls : 15;
        const x = c * cell;
        const y = r * cell;
        ctx.beginPath();
        if (walls & 1) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (walls & 2) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
        if (walls & 4) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (walls & 8) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        ctx.stroke();
      }
    }
    /* exit */
    ctx.fillStyle = "rgba(52, 211, 153, 0.35)";
    ctx.fillRect(exitCell.c * cell + 4, exitCell.r * cell + 4, cell - 8, cell - 8);
    /* trail */
    ctx.fillStyle = "rgba(34, 211, 238, 0.12)";
    for (const node of trail) ctx.fillRect(node.c * cell + cell * 0.3, node.r * cell + cell * 0.3, cell * 0.4, cell * 0.4);
    /* shards */
    for (const shard of shards) {
      if (shard.taken) continue;
      ctx.beginPath();
      ctx.arc(shard.c * cell + cell / 2, shard.r * cell + cell / 2, cell * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    }
    /* player */
    ctx.beginPath();
    ctx.arc(player.x || cell / 2, player.y || cell / 2, cell * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#22d3ee";
    ctx.fill();
    ctx.fillStyle = "rgba(242, 245, 255, 0.85)";
    ctx.font = "13px sans-serif";
    ctx.fillText(message, 12, H - 12);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  const KEY_DIRS = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1]
  };

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    const dir = KEY_DIRS[key] || KEY_DIRS[key.toLowerCase()];
    if (dir) {
      event.preventDefault();
      if (moveCooldown <= 0) {
        moveCooldown = 70;
        tryMove(dir[0], dir[1]);
      }
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    if (!touchStart) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(0, dx > 0 ? 1 : -1);
    else tryMove(dy > 0 ? 1 : -1, 0);
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", () => {
    touchStart = null;
  });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "Shards, walls and clock are frozen.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    if (state === "over" || state === "idle") level = 1;
    startLevel();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  generate(8, 8);
  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
