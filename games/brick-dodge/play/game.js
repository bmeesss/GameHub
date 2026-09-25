/* Brick Dodge — original GameHub implementation.
   Arcade dodger: slide your ship, dodge falling bricks, survive. */
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

  const BEST_KEY = "gh_best_brick-dodge";

  let shipX = 0.5;
  let bricks = [];
  let particles = [];
  let survived = 0;
  let spawnAcc = 0;
  let state = "ready";
  let last = 0;
  const held = { left: false, right: false };

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

  function shipGeom() {
    const W = canvas.width;
    const H = canvas.height;
    const w = Math.max(26, W * 0.11);
    return { x: shipX * W, y: H - H * 0.09, w, h: w * 0.42 };
  }

  function difficulty() {
    return 1 + survived * 0.045;
  }

  function spawnBrick() {
    const W = canvas.width;
    const H = canvas.height;
    const d = difficulty();
    const w = W * (0.07 + Math.random() * 0.09);
    bricks.push({
      x: w / 2 + Math.random() * (W - w),
      y: -30,
      w,
      h: 18 + Math.random() * 14,
      vy: H * (0.28 + Math.random() * 0.22) * Math.min(d, 3.2),
      vx: (Math.random() - 0.5) * W * 0.12,
      hue: 258 + Math.random() * 60 - 30
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.5) * 320,
        life: 0.6,
        color
      });
    }
  }

  function reset() {
    shipX = 0.5;
    bricks = [];
    particles = [];
    survived = 0;
    spawnAcc = 0;
    held.left = false;
    held.right = false;
    renderScore();
  }

  function renderScore() {
    const score = Math.floor(survived);
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(Math.max(best, score));
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
      showOverlay("Paused", `You survived ${Math.floor(survived)} seconds so far.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const score = Math.floor(survived);
    const record = score > best;
    if (record) {
      best = score;
      saveBest(best);
    }
    renderScore();
    const ship = shipGeom();
    burst(ship.x, ship.y, "#fb7185");
    showOverlay("Shipwrecked!", `You survived ${score} second${score === 1 ? "" : "s"}.${record && score > 0 ? " New best!" : ""}`, "Play again");
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    const speed = 0.9;
    if (held.left) shipX -= speed * dt;
    if (held.right) shipX += speed * dt;
    const ship = shipGeom();
    shipX = Math.min(Math.max(shipX, ship.w / 2 / W), 1 - ship.w / 2 / W);

    survived += dt;
    spawnAcc += dt;
    const interval = Math.max(0.16, 0.55 - survived * 0.008);
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      spawnBrick();
      if (survived > 20 && Math.random() < 0.35) spawnBrick();
    }

    for (const b of bricks) {
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      if (b.x < b.w / 2 || b.x > W - b.w / 2) b.vx *= -1;
    }
    bricks = bricks.filter((b) => b.y - b.h < H + 40);

    for (const b of bricks) {
      const overlapX = Math.abs(b.x - ship.x) < (b.w + ship.w) / 2 - 6;
      const overlapY = Math.abs(b.y - ship.y) < (b.h + ship.h) / 2 - 2;
      if (overlapX && overlapY) {
        gameOver();
        return;
      }
    }
    renderScore();
  }

  function render() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.08)";
    ctx.lineWidth = 1;
    const laneW = W / 6;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneW + 0.5, 0);
      ctx.lineTo(i * laneW + 0.5, H);
      ctx.stroke();
    }
    for (const b of bricks) {
      ctx.fillStyle = `hsl(${b.hue}, 70%, 58%)`;
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, 3);
    }
    const ship = shipGeom();
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y - ship.h);
    ctx.lineTo(ship.x - ship.w / 2, ship.y + ship.h / 2);
    ctx.lineTo(ship.x + ship.w / 2, ship.y + ship.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life * 1.6, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
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
    if (state === "running") update(dt);
    render();
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "A" || key === "KeyA") {
      event.preventDefault();
      held.left = true;
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
    } else if (key === "ArrowRight" || key === "d" || key === "D" || key === "KeyD") {
      event.preventDefault();
      held.right = true;
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
    } else if (key === "p" || key === "P" || key === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (key === " " || key === "Enter" || key === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else togglePause();
    } else if (key === "r" || key === "R") {
      if (!event.repeat && (state === "running" || state === "paused" || state === "over")) {
        event.preventDefault();
        start();
      }
    }
  }

  function onKeyUp(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "A" || key === "KeyA") held.left = false;
    else if (key === "ArrowRight" || key === "d" || key === "D" || key === "KeyD") held.right = false;
  }

  function pointToShip(clientX) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width) {
        shipX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      }
    } catch (err) { /* geometry unavailable */ }
  }

  let dragging = false;
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    if (state === "ready" || state === "over") start();
    pointToShip(event.clientX);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (dragging) pointToShip(event.clientX);
  });
  window.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("touchstart", (event) => {
    if (state === "ready" || state === "over") start();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) pointToShip(touch.clientX);
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) pointToShip(touch.clientX);
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
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
  showOverlay("Brick Dodge", "Slide your ship and dodge the falling bricks. How long can you survive?", "Start game");
  requestAnimationFrame(frame);
})();
