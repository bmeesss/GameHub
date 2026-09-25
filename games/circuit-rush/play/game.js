/* Circuit Rush — original GameHub implementation.
   Light-cycle versus: trap the rival AI before it traps you. */
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
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_circuit-rush";
  const COLS = 26;
  const ROWS = 26;
  const DIRS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };

  let taken;
  let cycles;
  let queue;
  let round;
  let wins;
  let steps;
  let banner;
  let bannerTimer;
  let state = "ready";
  let acc = 0;
  let last = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
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

  function stepMs() {
    return Math.max(62, 118 - round * 5);
  }

  function key(x, y) {
    return x + "," + y;
  }

  function resetPositions() {
    taken = new Set();
    const mid = Math.floor(ROWS / 2);
    cycles = [
      { x: 4, y: mid, dx: 1, dy: 0, color: "#22d3ee", ai: false },
      { x: COLS - 5, y: mid, dx: -1, dy: 0, color: "#fb7185", ai: true }
    ];
    for (const c of cycles) taken.add(key(c.x, c.y));
    queue = [];
    steps = 0;
    acc = 0;
  }

  function reset() {
    round = 1;
    wins = 0;
    banner = "";
    bannerTimer = 0;
    resetPositions();
    renderScore();
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(wins);
    if (bestEl) bestEl.textContent = String(Math.max(best, wins));
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
    reset();
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Round ${round} · ${wins} win${wins === 1 ? "" : "s"} so far.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function steer(dx, dy) {
    const lastDir = queue.length ? queue[queue.length - 1] : [cycles[0].dx, cycles[0].dy];
    if (dx === -lastDir[0] && dy === -lastDir[1]) return;
    if (dx === lastDir[0] && dy === lastDir[1]) return;
    if (queue.length < 3) queue.push([dx, dy]);
  }

  function crashAt(x, y) {
    return x < 0 || y < 0 || x >= COLS || y >= ROWS || taken.has(key(x, y));
  }

  function lookAhead(x, y, dx, dy, depth) {
    let free = 0;
    for (let i = 1; i <= depth; i++) {
      if (crashAt(x + dx * i, y + dy * i)) break;
      free += 1;
    }
    return free;
  }

  function aiSteer(ai) {
    const ahead = [
      [ai.dx, ai.dy],
      [ai.dy, -ai.dx],
      [-ai.dy, ai.dx]
    ];
    const depth = 3 + Math.min(round, 6);
    let bestDir = ahead[0];
    let bestScore = -1;
    for (const [dx, dy] of ahead) {
      let score = lookAhead(ai.x, ai.y, dx, dy, depth);
      if (crashAt(ai.x + dx, ai.y + dy)) score = -1;
      else score += Math.random() * (round < 3 ? 3 : 0.6);
      if (score > bestScore) {
        bestScore = score;
        bestDir = [dx, dy];
      }
    }
    ai.dx = bestDir[0];
    ai.dy = bestDir[1];
  }

  function roundWin() {
    wins += 1;
    if (wins > best) {
      best = wins;
      saveBest(best);
    }
    renderScore();
    round += 1;
    banner = `Round ${round}`;
    bannerTimer = 1.4;
    resetPositions();
  }

  function roundDraw() {
    banner = "Draw — replay!";
    bannerTimer = 1.4;
    resetPositions();
  }

  function gameOver() {
    state = "over";
    renderScore();
    const record = wins >= best && wins > 0;
    showOverlay("You crashed!", `The rival takes the arena. ${wins} win${wins === 1 ? "" : "s"} this run.${record ? " New best!" : ""}`, "Play again");
  }

  function update() {
    if (queue.length) {
      const [dx, dy] = queue.shift();
      cycles[0].dx = dx;
      cycles[0].dy = dy;
    }
    aiSteer(cycles[1]);
    steps += 1;
    const next = cycles.map((c) => ({ x: c.x + c.dx, y: c.y + c.dy }));
    const playerCrash = crashAt(next[0].x, next[0].y);
    const aiCrash = crashAt(next[1].x, next[1].y);
    const headOn = next[0].x === next[1].x && next[0].y === next[1].y;
    if ((playerCrash && aiCrash) || headOn) {
      if (steps < 6) roundDraw();
      else roundDraw();
      return;
    }
    if (aiCrash) {
      roundWin();
      return;
    }
    if (playerCrash) {
      gameOver();
      return;
    }
    if (steps > COLS * ROWS) {
      roundDraw();
      return;
    }
    cycles[0].x = next[0].x;
    cycles[0].y = next[0].y;
    cycles[1].x = next[1].x;
    cycles[1].y = next[1].y;
    taken.add(key(next[0].x, next[0].y));
    taken.add(key(next[1].x, next[1].y));
  }

  function render(dt) {
    bannerTimer = Math.max(0, bannerTimer - dt);
    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / COLS;
    const cellH = H / ROWS;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x += 2) {
      ctx.beginPath();
      ctx.moveTo(x * cellW + 0.5, 0);
      ctx.lineTo(x * cellW + 0.5, H);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellH + 0.5);
      ctx.lineTo(W, y * cellH + 0.5);
      ctx.stroke();
    }
    for (const spot of taken) {
      const [gx, gy] = spot.split(",").map(Number);
      ctx.fillStyle = "rgba(148, 163, 216, 0.16)";
      ctx.fillRect(gx * cellW + 1, gy * cellH + 1, cellW - 2, cellH - 2);
    }
    for (const c of cycles) {
      ctx.save();
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x * cellW - 1, c.y * cellH - 1, cellW + 2, cellH + 2);
      ctx.restore();
    }
    if (bannerTimer > 0 && banner) {
      ctx.fillStyle = "rgba(5, 7, 15, 0.65)";
      ctx.fillRect(0, H / 2 - 30, W, 60);
      ctx.fillStyle = "#f2f5ff";
      ctx.font = "800 26px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(banner, W / 2, H / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === "running") {
      acc += dt * 1000;
      const step = stepMs();
      let guard = 0;
      while (acc >= step && state === "running" && guard < 8) {
        acc -= step;
        guard += 1;
        update();
      }
    }
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
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      steer(move[0], move[1]);
      return;
    }
    const k = keyOf(event);
    if (k === "p" || k === "P" || k === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (k === " " || k === "Enter" || k === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else togglePause();
    } else if (k === "r" || k === "R") {
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        start();
      }
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
    if (state === "ready" || state === "over") start();
    else if (state === "paused") {
      togglePause();
      return;
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
    else steer(0, dy > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  reset();
  state = "ready";
  showOverlay("Circuit Rush", "Trap the rival light-cycle before it traps you. First crash loses the round.", "Start game");
  requestAnimationFrame(frame);
})();
