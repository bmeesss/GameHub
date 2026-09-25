/* Dungeon Escape — original GameHub implementation.
   Stealth maze: grab the key, dodge the guards, escape 3 floors. */
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
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_dungeon-escape";
  const LEVELS = [
    {
      map: [
        "##########",
        "#P.......#",
        "#.####.#.#",
        "#.#..#.#.#",
        "#.#.K#.#.#",
        "#.#.##.#.#",
        "#.#....#.#",
        "#.######.#",
        "#........E",
        "##########"
      ],
      guards: [{ path: [[7, 1], [7, 5]], speed: 2.2 }]
    },
    {
      map: [
        "##########",
        "#P...#...#",
        "#.##.#.#.#",
        "#.#..#.#.#",
        "#.#.##.#.#",
        "#.#....#K#",
        "#.####.#.#",
        "#......#.#",
        "#.######.#",
        "#E.......#",
        "##########"
      ],
      guards: [
        { path: [[4, 2], [4, 7]], speed: 2.6 },
        { path: [[1, 7], [7, 7]], speed: 2.0 }
      ]
    },
    {
      map: [
        "###########",
        "#P....#...#",
        "#.###.#.#.#",
        "#.#...#.#K#",
        "#.#.###.#.#",
        "#.#.....#.#",
        "#.#####.#.#",
        "#.....#.#.#",
        "#####.#.#.#",
        "#.....#...#",
        "#.#######.#",
        "#E........#",
        "###########"
      ],
      guards: [
        { path: [[5, 1], [5, 4]], speed: 3.0 },
        { path: [[1, 7], [5, 7]], speed: 2.6 },
        { path: [[8, 9], [2, 11]], speed: 2.2 }
      ]
    }
  ];

  let walls;
  let cols;
  let rows;
  let startPos;
  let keyPos;
  let exitPos;
  let guards;
  let player;
  let hasKey;
  let level;
  let deaths;
  let torch;
  let state = "ready";
  let last = 0;
  const held = { up: false, down: false, left: false, right: false };

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

  function tileKey(x, y) {
    return x + "," + y;
  }

  function isWall(x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return true;
    return walls.has(tileKey(gx, gy));
  }

  function loadLevel(index) {
    level = index;
    const def = LEVELS[index];
    walls = new Set();
    rows = def.map.length;
    cols = 0;
    for (let y = 0; y < def.map.length; y++) {
      cols = Math.max(cols, def.map[y].length);
      for (let x = 0; x < def.map[y].length; x++) {
        const cell = def.map[y][x];
        if (cell === "#") walls.add(tileKey(x, y));
        else if (cell === "P") startPos = { x: x + 0.5, y: y + 0.5 };
        else if (cell === "K") keyPos = { x: x + 0.5, y: y + 0.5, taken: false };
        else if (cell === "E") exitPos = { x: x + 0.5, y: y + 0.5 };
      }
    }
    if (!startPos) startPos = { x: 1.5, y: 1.5 };
    if (!keyPos) keyPos = { x: 2.5, y: 2.5, taken: false };
    if (!exitPos) exitPos = { x: cols - 1.5, y: rows - 1.5 };
    guards = def.guards.map((g) => ({
      path: g.path.map(([gx, gy]) => ({ x: gx + 0.5, y: gy + 0.5 })),
      at: 0,
      dir: 1,
      speed: g.speed,
      x: g.path[0][0] + 0.5,
      y: g.path[0][1] + 0.5
    }));
    player = { x: startPos.x, y: startPos.y };
    hasKey = false;
    held.up = held.down = held.left = held.right = false;
    renderHud();
  }

  function renderHud() {
    if (levelEl) levelEl.textContent = `${level + 1}/${LEVELS.length}`;
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
    deaths = 0;
    loadLevel(0);
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Dungeon ${level + 1} of ${LEVELS.length}. The guards wait…`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function caught() {
    deaths += 1;
    player = { x: startPos.x, y: startPos.y };
    hasKey = false;
    keyPos.taken = false;
    showOverlay("Caught!", `A guard dragged you back to the cellar door. That is capture ${deaths}.`, "Sneak again");
    state = "caught";
  }

  function levelClear() {
    if (level + 1 >= LEVELS.length) {
      state = "won";
      if (LEVELS.length > best) {
        best = LEVELS.length;
        saveBest(best);
      }
      showOverlay("Escaped!", `You slipped out of all ${LEVELS.length} dungeons with ${deaths} capture${deaths === 1 ? "" : "s"}.`, "Play again");
    } else {
      loadLevel(level + 1);
      if (level + 1 > best) {
        best = level + 1;
        saveBest(best);
      }
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function movePlayer(dt) {
    const speed = 4.2 * dt;
    let dx = 0;
    let dy = 0;
    if (held.left) dx -= 1;
    if (held.right) dx += 1;
    if (held.up) dy -= 1;
    if (held.down) dy += 1;
    if (touchDir) {
      dx = touchDir.x;
      dy = touchDir.y;
    }
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy) || 1;
    const r = 0.22;
    const nx = player.x + (dx / len) * speed;
    if (!isWall(nx + Math.sign(dx) * r, player.y - r * 0.7) && !isWall(nx + Math.sign(dx) * r, player.y + r * 0.7)) {
      player.x = nx;
    }
    const ny = player.y + (dy / len) * speed;
    if (!isWall(player.x - r * 0.7, ny + Math.sign(dy) * r) && !isWall(player.x + r * 0.7, ny + Math.sign(dy) * r)) {
      player.y = ny;
    }
  }

  function update(dt) {
    movePlayer(dt);
    for (const guard of guards) {
      const target = guard.path[guard.at + guard.dir] || guard.path[guard.at];
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      const step = guard.speed * dt;
      if (dist <= step) {
        guard.x = target.x;
        guard.y = target.y;
        guard.at += guard.dir;
        if (guard.at >= guard.path.length - 1 || guard.at <= 0) guard.dir *= -1;
      } else if (dist > 0.0001) {
        guard.x += (dx / dist) * step;
        guard.y += (dy / dist) * step;
      }
    }
    if (!keyPos.taken && Math.hypot(player.x - keyPos.x, player.y - keyPos.y) < 0.5) {
      keyPos.taken = true;
      hasKey = true;
    }
    for (const guard of guards) {
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < 0.55) {
        caught();
        return;
      }
    }
    if (hasKey && Math.hypot(player.x - exitPos.x, player.y - exitPos.y) < 0.55) {
      levelClear();
    }
  }

  function render(dt) {
    torch += dt;
    const W = canvas.width;
    const H = canvas.height;
    const cell = Math.min(W / cols, H / rows);
    const ox = (W - cell * cols) / 2;
    const oy = (H - cell * rows) / 2;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = ox + x * cell;
        const py = oy + y * cell;
        if (walls.has(tileKey(x, y))) {
          ctx.fillStyle = "#272136";
          ctx.fillRect(px, py, cell, cell);
          ctx.fillStyle = "rgba(167, 139, 250, 0.18)";
          ctx.fillRect(px, py, cell, 2);
        } else {
          ctx.fillStyle = (x + y) % 2 ? "#0d1120" : "#0f1428";
          ctx.fillRect(px, py, cell, cell);
        }
      }
    }
    const flicker = 0.75 + Math.sin(torch * 7) * 0.1 + Math.sin(torch * 13) * 0.06;
    const glow = ctx.createRadialGradient(player.x, 0, 0, player.x, 0, 0);
    void glow;
    /* Key. */
    if (!keyPos.taken) {
      const kx = ox + keyPos.x * cell;
      const ky = oy + keyPos.y * cell;
      ctx.save();
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(kx - 3, ky, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(kx + 2, ky);
      ctx.lineTo(kx + 11, ky);
      ctx.moveTo(kx + 8, ky);
      ctx.lineTo(kx + 8, ky + 5);
      ctx.stroke();
      ctx.restore();
    }
    /* Exit stairs. */
    const ex = ox + exitPos.x * cell;
    const ey = oy + exitPos.y * cell;
    ctx.fillStyle = hasKey ? "#4ade80" : "#475569";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(ex - 10 + i * 3, ey - 6 + i * 6, 20 - i * 6, 4);
    }
    /* Guards with sight glow. */
    for (const guard of guards) {
      const gx = ox + guard.x * cell;
      const gy = oy + guard.y * cell;
      ctx.fillStyle = "rgba(251, 113, 133, 0.14)";
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#450a0a";
      ctx.beginPath();
      ctx.arc(gx - 3, gy - 2, 2, 0, Math.PI * 2);
      ctx.arc(gx + 3, gy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    /* Player with torchlight. */
    const ppx = ox + player.x * cell;
    const ppy = oy + player.y * cell;
    ctx.fillStyle = `rgba(251, 191, 36, ${0.1 * flicker})`;
    ctx.beginPath();
    ctx.arc(ppx, ppy, cell * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(ppx, ppy, cell * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 12px Inter, Arial, sans-serif";
    ctx.fillText(hasKey ? "Key ✓ — find the stairs!" : "Find the key!", 10, 18);
    if (best > 0) ctx.fillText(`Best: level ${best}`, 10, 34);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === "running") update(dt);
    render(dt);
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function setHeld(key, on) {
    if (key === "ArrowUp" || key === "w") held.up = on;
    else if (key === "ArrowDown" || key === "s") held.down = on;
    else if (key === "ArrowLeft" || key === "a") held.left = on;
    else if (key === "ArrowRight" || key === "d") held.right = on;
    else return false;
    return true;
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (setHeld(key, true)) {
      event.preventDefault();
      if (state === "ready" || state === "won") start();
      else if (state === "paused") togglePause();
      else if (state === "caught") {
        state = "running";
        hideOverlay();
      }
      return;
    }
    if (key === "p" || key === "P" || key === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (key === " " || key === "Enter" || key === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "won") start();
      else if (state === "caught") {
        state = "running";
        hideOverlay();
      } else togglePause();
    } else if (key === "r" || key === "R") {
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        loadLevel(level);
        if (state !== "running") {
          state = "running";
          hideOverlay();
          if (pauseBtn) pauseBtn.textContent = "Pause";
        }
      }
    }
  }

  function onKeyUp(event) {
    setHeld(keyOf(event), false);
  }

  let touchDir = null;
  let touchOrigin = null;
  function canvasTile(clientX, clientY) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width && rect.height) {
        const cell = Math.min(rect.width / cols, rect.height / rows);
        const ox = (rect.width - cell * cols) / 2;
        const oy = (rect.height - cell * rows) / 2;
        return { x: (clientX - rect.left - ox) / cell, y: (clientY - rect.top - oy) / cell };
      }
    } catch (err) { /* geometry unavailable */ }
    return null;
  }
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    if (state === "ready" || state === "won") start();
    else if (state === "paused" || state === "caught") {
      if (state === "paused") togglePause();
      else {
        state = "running";
        hideOverlay();
      }
      return;
    }
    touchOrigin = canvasTile(touch.clientX, touch.clientY);
    touchDir = null;
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !touchOrigin) return;
    const pos = canvasTile(touch.clientX, touch.clientY);
    if (!pos) return;
    const dx = pos.x - touchOrigin.x;
    const dy = pos.y - touchOrigin.y;
    touchDir = Math.hypot(dx, dy) > 0.2 ? { x: dx, y: dy } : null;
  }, { passive: true });
  canvas.addEventListener("touchend", () => {
    touchDir = null;
    touchOrigin = null;
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused" || state === "caught") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    } else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  torch = 0;
  loadLevel(0);
  state = "ready";
  showOverlay("Dungeon Escape", "Grab the key, then reach the stairs. Touching a guard sends you back.", "Start game");
  requestAnimationFrame(frame);
})();
