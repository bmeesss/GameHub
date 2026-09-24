/* Snake — original GameHub implementation.
   Canvas arcade game: eat orbs, grow, avoid walls and tail. */
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

  const COLS = 20;
  const ROWS = 20;
  const CELL = canvas.width / COLS;
  const START_STEP_MS = 150;
  const MIN_STEP_MS = 70;
  const SPEEDUP_EVERY = 4;

  const DIRS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };

  let snake = [];
  let dir = [1, 0];
  let queue = [];
  let food = { x: 5, y: 5 };
  let particles = [];
  let score = 0;
  let best = loadBest();
  let state = "ready";
  let acc = 0;
  let last = 0;
  let pulse = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_snake_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_snake_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function stepMs() {
    const eaten = Math.floor(score / 10);
    return Math.max(MIN_STEP_MS, START_STEP_MS - Math.floor(eaten / SPEEDUP_EVERY) * 8);
  }

  function reset() {
    const mid = Math.floor(COLS / 2);
    snake = [{ x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid }];
    dir = [1, 0];
    queue = [];
    score = 0;
    particles = [];
    acc = 0;
    placeFood();
    renderScore();
  }

  function placeFood() {
    const taken = new Set(snake.map((s) => s.x + "," + s.y));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!taken.has(x + "," + y)) free.push({ x, y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 };
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
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
      showOverlay("Paused", `Score ${score}. Take a breath — the snake waits for you.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    if (score > best) {
      best = score;
      saveBest();
    }
    renderScore();
    const record = score >= best && score > 0 ? " New best!" : "";
    showOverlay("Game over", `You scored ${score} points.${record}`, "Play again");
  }

  function steer(next) {
    const lastDir = queue.length ? queue[queue.length - 1] : dir;
    if (next[0] === -lastDir[0] && next[1] === -lastDir[1]) return;
    if (next[0] === lastDir[0] && next[1] === lastDir[1]) return;
    if (queue.length < 3) queue.push(next);
  }

  function update() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir[0], y: snake[0].y + dir[1] };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      gameOver();
      return;
    }
    for (const segment of snake) {
      if (segment.x === head.x && segment.y === head.y) {
        gameOver();
        return;
      }
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (score > best) {
        best = score;
        saveBest();
      }
      renderScore();
      burst(food.x, food.y);
      if (snake.length >= COLS * ROWS) {
        gameOver();
        return;
      }
      placeFood();
    } else {
      snake.pop();
    }
  }

  function burst(gx, gy) {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: (gx + 0.5) * CELL,
        y: (gy + 0.5) * CELL,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        life: 0.5
      });
    }
  }

  function drawCell(x, y, radius, fill) {
    const px = x * CELL;
    const py = y * CELL;
    const pad = 1.5;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, radius);
    ctx.fill();
  }

  function render(dt) {
    pulse += dt;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.07)";
    ctx.lineWidth = 1;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(canvas.width, i * CELL + 0.5);
      ctx.stroke();
    }
    const glow = 6 + Math.sin(pulse / 180) * 2;
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = glow + 10;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc((food.x + 0.5) * CELL, (food.y + 0.5) * CELL, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = snake.length - 1; i >= 0; i--) {
      const segment = snake[i];
      const shade = 1 - (i / Math.max(snake.length, 1)) * 0.55;
      const green = Math.round(120 + 110 * shade);
      drawCell(segment.x, segment.y, i === 0 ? 6 : 4, `rgb(46, ${green}, 110)`);
    }
    const head = snake[0];
    if (head) {
      const cx = (head.x + 0.5) * CELL;
      const cy = (head.y + 0.5) * CELL;
      ctx.fillStyle = "#04140a";
      const ex = dir[0] !== 0 ? 0 : 4;
      const ey = dir[0] !== 0 ? 4 : 0;
      ctx.beginPath();
      ctx.arc(cx - ex + dir[0] * 4, cy - ey + dir[1] * 4, 2.4, 0, Math.PI * 2);
      ctx.arc(cx + ex + dir[0] * 4, cy + ey + dir[1] * 4, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life * 2, 0);
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    if (state === "running") {
      acc += dt * 1000;
      const step = stepMs();
      while (acc >= step && state === "running") {
        acc -= step;
        update();
      }
    }
    render(dt);
  }

  function onKey(event) {
    const move = DIRS[event.code];
    if (move) {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      steer(move);
      return;
    }
    if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      togglePause();
    } else if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else togglePause();
    }
  }

  let touchStart = null;
  function onTouchStart(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
  }
  function onTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !touchStart) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (state === "ready" || state === "over") start();
      else togglePause();
      return;
    }
    if (state === "ready" || state === "over") start();
    else if (state === "paused") togglePause();
    if (Math.abs(dx) > Math.abs(dy)) steer([dx > 0 ? 1 : -1, 0]);
    else steer([0, dy > 0 ? 1 : -1]);
  }

  window.addEventListener("keydown", onKey);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
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
  showOverlay("Snake", "Eat the glowing orbs to grow. Avoid the walls and your own tail.", "Start game");
  requestAnimationFrame(frame);
})();
