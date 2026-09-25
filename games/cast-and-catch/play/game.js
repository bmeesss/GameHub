/* Cast and Catch — original GameHub implementation.
   Catching game: net the falling fish, dodge the old boots. */
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
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_cast-and-catch";

  let netX = 0.5;
  let items = [];
  let splashes = [];
  let fish = 0;
  let lives = 3;
  let level = 1;
  let spawnAcc = 0;
  let flash = 0;
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

  function netGeom() {
    const W = canvas.width;
    const H = canvas.height;
    const w = Math.max(64, W * 0.2);
    return { x: netX * W, y: H * 0.86, w, h: 26 };
  }

  function reset() {
    netX = 0.5;
    items = [];
    splashes = [];
    fish = 0;
    lives = 3;
    level = 1;
    spawnAcc = 0;
    flash = 0;
    held.left = false;
    held.right = false;
    renderScore();
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(fish);
    if (livesEl) livesEl.textContent = String(lives);
    if (bestEl) bestEl.textContent = String(Math.max(best, fish));
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
      showOverlay("Paused", `${fish} fish in the bucket.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = fish > best;
    if (record) {
      best = fish;
      saveBest(best);
    }
    renderScore();
    showOverlay("The pier empties…", `You caught ${fish} fish${record && fish > 0 ? " — a new best catch!" : "."}`, "Play again");
  }

  function loseLife() {
    lives -= 1;
    flash = 0.5;
    renderScore();
    if (lives <= 0) gameOver();
  }

  function spawnItem() {
    const W = canvas.width;
    const roll = Math.random();
    const kind = roll < 0.62 ? "fish" : roll < 0.82 ? "boot" : roll < 0.93 ? "gold" : "fish";
    items.push({
      x: 20 + Math.random() * (W - 40),
      y: -24,
      vy: (0.32 + Math.random() * 0.2 + level * 0.03) * canvas.height,
      sway: Math.random() * Math.PI * 2,
      kind,
      caught: false
    });
  }

  function splash(x, y, color) {
    for (let i = 0; i < 8; i++) {
      splashes.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: -40 - Math.random() * 160,
        life: 0.5,
        color
      });
    }
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    if (held.left) netX -= 0.9 * dt;
    if (held.right) netX += 0.9 * dt;
    const net = netGeom();
    netX = Math.min(Math.max(netX, net.w / 2 / W), 1 - net.w / 2 / W);

    level = 1 + Math.floor(fish / 10);
    spawnAcc += dt;
    const interval = Math.max(0.3, 0.85 - level * 0.05);
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      spawnItem();
    }

    for (const item of items) {
      item.y += item.vy * dt;
      item.sway += dt * 3;
      item.x += Math.sin(item.sway) * 12 * dt;
    }

    for (const item of items) {
      if (item.caught || item.y < net.y - 30 || item.y > net.y + 10) continue;
      if (Math.abs(item.x - net.x) < net.w / 2) {
        item.caught = true;
        if (item.kind === "fish") {
          fish += 1;
          splash(item.x, item.y, "#22d3ee");
          if (fish > best) {
            best = fish;
            saveBest(best);
          }
        } else if (item.kind === "gold") {
          fish += 5;
          splash(item.x, item.y, "#fbbf24");
          if (fish > best) {
            best = fish;
            saveBest(best);
          }
        } else {
          splash(item.x, item.y, "#92400e");
          loseLife();
          if (state !== "running") return;
        }
        renderScore();
      }
    }
    items = items.filter((item) => !item.caught && item.y < H + 40);
  }

  function render(dt) {
    flash = Math.max(0, flash - dt);
    const W = canvas.width;
    const H = canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1226");
    sky.addColorStop(0.7, "#0e1a33");
    sky.addColorStop(1, "#12325e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.12, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(0, H * 0.94, W, H * 0.06);
    ctx.fillStyle = "#52525b";
    for (let x = 8; x < W; x += 34) ctx.fillRect(x, H * 0.94, 4, H * 0.06);

    for (const item of items) {
      if (item.kind === "boot") {
        ctx.fillStyle = "#78350f";
        ctx.fillRect(item.x - 8, item.y - 12, 14, 22);
        ctx.fillRect(item.x - 8, item.y + 2, 22, 8);
      } else {
        const color = item.kind === "gold" ? "#fbbf24" : "#22d3ee";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(item.x - 11, item.y);
        ctx.lineTo(item.x - 18, item.y - 6);
        ctx.lineTo(item.x - 18, item.y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#05070f";
        ctx.beginPath();
        ctx.arc(item.x + 5, item.y - 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const net = netGeom();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(net.x - net.w / 2, net.y - 34);
    ctx.lineTo(net.x - net.w / 2, net.y);
    ctx.lineTo(net.x + net.w / 2, net.y);
    ctx.lineTo(net.x + net.w / 2, net.y - 34);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226, 232, 240, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = net.x - net.w / 2 + (net.w / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, net.y - 30);
      ctx.lineTo(x, net.y);
      ctx.stroke();
    }
    for (const s of splashes) {
      ctx.globalAlpha = Math.max(s.life * 2, 0);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (flash > 0) {
      ctx.fillStyle = `rgba(251, 113, 133, ${flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 12px Inter, Arial, sans-serif";
    ctx.fillText(`Level ${level}`, 12, 22);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const s of splashes) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 500 * dt;
      s.life -= dt;
    }
    splashes = splashes.filter((s) => s.life > 0);
    if (state === "running") update(dt);
    render(dt);
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "KeyA") {
      event.preventDefault();
      held.left = true;
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
    } else if (key === "ArrowRight" || key === "d" || key === "KeyD") {
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
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        start();
      }
    }
  }

  function onKeyUp(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "KeyA") held.left = false;
    else if (key === "ArrowRight" || key === "d" || key === "KeyD") held.right = false;
  }

  function pointToNet(clientX) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width) {
        netX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      }
    } catch (err) { /* geometry unavailable */ }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (state === "ready" || state === "over") start();
    pointToNet(event.clientX);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (state === "running") pointToNet(event.clientX);
  });
  canvas.addEventListener("touchstart", (event) => {
    if (state === "ready" || state === "over") start();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) pointToNet(touch.clientX);
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && state === "running") pointToNet(touch.clientX);
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
  showOverlay("Cast and Catch", "Slide the net and catch dinner. Boots cost you a life — you have 3.", "Start game");
  requestAnimationFrame(frame);
})();
