/* Labyrinth Dash — original GameHub implementation.
   Maze sprint: procedurally carved mazes, countdown, time shards. */
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
  const levelEl = document.getElementById("level");
  const timeEl = document.getElementById("timeLeft");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const touchControls = document.getElementById("touchControls");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const DIRS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };

  let state = "ready";
  let level = 1;
  let best = loadBest();
  let size = 9;
  let cell = W / 9;
  let walls = [];
  let player = { x: 0, y: 0, px: 0, py: 0 };
  let exit = { x: 8, y: 8 };
  let shards = [];
  let timeLeft = 30;
  let moveAcc = 0;
  let held = null;
  let last = 0;
  let flash = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_maze_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_maze_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function mazeSize(forLevel) {
    return Math.min(9 + (forLevel - 1) * 2, 21);
  }

  function timeFor(forLevel) {
    return Math.min(30 + (forLevel - 1) * 6, 60);
  }

  function carve() {
    size = mazeSize(level);
    cell = W / size;
    /* walls[y][x] = [top, right, bottom, left] solid flags */
    walls = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [true, true, true, true])
    );
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    const stack = [{ x: 0, y: 0 }];
    visited[0][0] = true;
    while (stack.length) {
      const current = stack[stack.length - 1];
      const options = [];
      if (current.y > 0 && !visited[current.y - 1][current.x]) options.push([0, -1, 0]);
      if (current.x < size - 1 && !visited[current.y][current.x + 1]) options.push([1, 0, 1]);
      if (current.y < size - 1 && !visited[current.y + 1][current.x]) options.push([0, 1, 2]);
      if (current.x > 0 && !visited[current.y][current.x - 1]) options.push([-1, 0, 3]);
      if (!options.length) {
        stack.pop();
        continue;
      }
      const [dx, dy, side] = options[Math.floor(Math.random() * options.length)];
      const nx = current.x + dx;
      const ny = current.y + dy;
      walls[current.y][current.x][side] = false;
      walls[ny][nx][(side + 2) % 4] = false;
      visited[ny][nx] = true;
      stack.push({ x: nx, y: ny });
    }
    /* Knock a few extra loops so routes stay interesting. */
    const loops = Math.floor(size * 0.8);
    for (let i = 0; i < loops; i++) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const side = Math.floor(Math.random() * 4);
      const dx = [0, 1, 0, -1][side];
      const dy = [-1, 0, 1, 0][side];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      walls[y][x][side] = false;
      walls[ny][nx][(side + 2) % 4] = false;
    }
    player = { x: 0, y: 0, px: 0, py: 0 };
    exit = { x: size - 1, y: size - 1 };
    shards = [];
    const shardCount = Math.min(2 + Math.floor(level / 2), 6);
    let guard = 0;
    while (shards.length < shardCount && guard < 500) {
      guard += 1;
      const sx = Math.floor(Math.random() * size);
      const sy = Math.floor(Math.random() * size);
      if ((sx === 0 && sy === 0) || (sx === exit.x && sy === exit.y)) continue;
      if (shards.some((s) => s.x === sx && s.y === sy)) continue;
      shards.push({ x: sx, y: sy });
    }
  }

  function renderHud() {
    if (levelEl) levelEl.textContent = String(level);
    if (timeEl) timeEl.textContent = String(Math.ceil(Math.max(timeLeft, 0)));
    if (bestEl) bestEl.textContent = String(best);
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

  function startLevel(fresh) {
    if (fresh) level = 1;
    carve();
    timeLeft = timeFor(level);
    moveAcc = 0;
    held = null;
    state = "running";
    hideOverlay();
    renderHud();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function start() {
    if (level - 1 > best) {
      best = level - 1;
      saveBest();
    }
    startLevel(true);
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Level ${level} · ${Math.ceil(timeLeft)}s left.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    if (level - 1 > best) {
      best = level - 1;
      saveBest();
    }
    renderHud();
    showOverlay("Time's up!", `You cleared ${level - 1} maze${level - 1 === 1 ? "" : "s"}. Dash again?`, "Retry");
  }

  function clearLevel() {
    const bonus = Math.ceil(timeLeft);
    if (level > best) {
      best = level;
      saveBest();
    }
    level += 1;
    flash = 0.6;
    startLevel(false);
    timeLeft += Math.min(bonus * 0.2, 10);
    renderHud();
  }

  function canStep(dx, dy) {
    if (dx === 1 && !walls[player.y][player.x][1] && player.x + 1 < size) return true;
    if (dx === -1 && !walls[player.y][player.x][3] && player.x - 1 >= 0) return true;
    if (dy === 1 && !walls[player.y][player.x][2] && player.y + 1 < size) return true;
    if (dy === -1 && !walls[player.y][player.x][0] && player.y - 1 >= 0) return true;
    return false;
  }

  function step(dx, dy) {
    if (state !== "running") return;
    if (!canStep(dx, dy)) return;
    player.x += dx;
    player.y += dy;
    const shardIndex = shards.findIndex((s) => s.x === player.x && s.y === player.y);
    if (shardIndex >= 0) {
      shards.splice(shardIndex, 1);
      timeLeft += 3;
      renderHud();
    }
    if (player.x === exit.x && player.y === exit.y) {
      clearLevel();
    }
  }

  function render() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = "rgba(34, 211, 238, 0.04)";
    ctx.fillRect(0, 0, W, W);

    ctx.strokeStyle = "rgba(124, 92, 255, 0.75)";
    ctx.lineWidth = Math.max(2, cell * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x * cell;
        const py = y * cell;
        const w = walls[y][x];
        if (w[0]) { ctx.moveTo(px, py); ctx.lineTo(px + cell, py); }
        if (w[1]) { ctx.moveTo(px + cell, py); ctx.lineTo(px + cell, py + cell); }
        if (w[2]) { ctx.moveTo(px, py + cell); ctx.lineTo(px + cell, py + cell); }
        if (w[3]) { ctx.moveTo(px, py); ctx.lineTo(px, py + cell); }
      }
    }
    ctx.stroke();

    const now = performance.now() / 1000;
    for (const shard of shards) {
      const cx = (shard.x + 0.5) * cell;
      const cy = (shard.y + 0.5) * cell + Math.sin(now * 3 + shard.x) * 1.5;
      const r = cell * 0.22;
      ctx.save();
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const ex = (exit.x + 0.5) * cell;
    const ey = (exit.y + 0.5) * cell;
    ctx.save();
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect(ex - cell * 0.32, ey - cell * 0.32, cell * 0.64, cell * 0.64, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#451a03";
    ctx.font = `800 ${Math.max(10, cell * 0.4)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", ex, ey + 1);

    const targetX = (player.x + 0.5) * cell;
    const targetY = (player.y + 0.5) * cell;
    player.px += (targetX - player.px) * 0.35;
    player.py += (targetY - player.py) * 0.35;
    if (!player.px) {
      player.px = targetX;
      player.py = targetY;
    }
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(player.px, player.py, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(player.px - cell * 0.1, player.py - cell * 0.06, cell * 0.09, 0, Math.PI * 2);
    ctx.arc(player.px + cell * 0.1, player.py - cell * 0.06, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0f1a";
    ctx.beginPath();
    ctx.arc(player.px - cell * 0.1, player.py - cell * 0.06, cell * 0.045, 0, Math.PI * 2);
    ctx.arc(player.px + cell * 0.1, player.py - cell * 0.06, cell * 0.045, 0, Math.PI * 2);
    ctx.fill();

    if (flash > 0) {
      ctx.fillStyle = `rgba(74, 222, 128, ${Math.min(flash, 0.35)})`;
      ctx.fillRect(0, 0, W, W);
    }
    if (timeLeft <= 5 && state === "running") {
      ctx.fillStyle = "rgba(251, 113, 133, 0.08)";
      ctx.fillRect(0, 0, W, W);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    flash = Math.max(flash - dt, 0);
    if (state === "running") {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        renderHud();
        gameOver();
      } else {
        renderHud();
        if (held) {
          moveAcc += dt;
          while (moveAcc >= 0.11 && state === "running") {
            moveAcc -= 0.11;
            step(held[0], held[1]);
          }
        }
      }
    }
    render();
  }

  function press(dx, dy) {
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    if (state !== "running") return;
    held = [dx, dy];
    moveAcc = 0.11;
    step(dx, dy);
  }

  window.addEventListener("keydown", (event) => {
    const dir = DIRS[event.code];
    if (dir) {
      event.preventDefault();
      if (!event.repeat) press(dir[0], dir[1]);
      else held = dir;
      return;
    }
    if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      togglePause();
    } else if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else togglePause();
    }
  });
  window.addEventListener("keyup", (event) => {
    const dir = DIRS[event.code];
    if (dir && held && held[0] === dir[0] && held[1] === dir[1]) held = null;
  });

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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) press(dx > 0 ? 1 : -1, 0);
    else press(0, dy > 0 ? 1 : -1);
    held = null;
  });

  if (touchControls) {
    const acts = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    touchControls.addEventListener("pointerdown", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (!button) return;
      event.preventDefault();
      const act = acts[button.getAttribute("data-act")];
      if (act) press(act[0], act[1]);
    });
    const release = () => { held = null; };
    touchControls.addEventListener("pointerup", release);
    touchControls.addEventListener("pointerleave", release);
  }

  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  carve();
  renderHud();
  requestAnimationFrame(frame);
})();
