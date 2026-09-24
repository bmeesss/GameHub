/* Neon Runner — original GameHub implementation.
   Endless runner: double-jump, coins, parallax skyline, rising speed. */
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
  const bestEl = document.getElementById("best");
  const coinsEl = document.getElementById("coins");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 56;
  const PLAYER_X = 110;
  const PLAYER_W = 30;
  const PLAYER_H = 42;
  const GRAVITY = 2600;
  const JUMP_VY = -880;
  const BASE_SPEED = 300;

  let state = "ready";
  let player = { y: GROUND_Y - PLAYER_H, vy: 0, jumps: 0, run: 0 };
  let obstacles = [];
  let pickups = [];
  let skyline = [];
  let distance = 0;
  let coins = 0;
  let score = 0;
  let best = loadBest();
  let spawnTimer = 0;
  let last = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_runner_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_runner_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function speed() {
    return Math.min(BASE_SPEED + distance * 0.09, 640);
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (coinsEl) coinsEl.textContent = String(coins);
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

  function reset() {
    player = { y: GROUND_Y - PLAYER_H, vy: 0, jumps: 0, run: 0 };
    obstacles = [];
    pickups = [];
    skyline = [];
    for (let i = 0; i < 14; i++) {
      skyline.push({ x: (i / 14) * W, w: 30 + Math.random() * 60, h: 60 + Math.random() * 130, shade: Math.random() });
    }
    distance = 0;
    coins = 0;
    score = 0;
    spawnTimer = 1.1;
    renderHud();
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
      showOverlay("Paused", `Score ${score} · ${Math.floor(distance)}m.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = score > best;
    if (record) {
      best = score;
      saveBest();
    }
    renderHud();
    showOverlay("Wipeout!", `Ran ${Math.floor(distance)}m and grabbed ${coins} coins for ${score} points.${record ? " New best!" : ""}`, "Run again");
  }

  function jump() {
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    if (state !== "running") return;
    if (player.jumps < 2) {
      player.vy = JUMP_VY * (player.jumps === 0 ? 1 : 0.88);
      player.jumps += 1;
    }
  }

  function spawnObstacle() {
    const roll = Math.random();
    if (roll < 0.45) {
      obstacles.push({ x: W + 20, w: 26, h: 52, kind: "spike" });
    } else if (roll < 0.75) {
      obstacles.push({ x: W + 20, w: 34, h: 34, kind: "block", y: GROUND_Y - 34 });
    } else {
      obstacles.push({ x: W + 20, w: 30, h: 30, kind: "drone", y: GROUND_Y - 110 - Math.random() * 40, t: 0 });
    }
    if (Math.random() < 0.7) {
      const count = 3 + Math.floor(Math.random() * 3);
      const high = Math.random() < 0.4;
      for (let i = 0; i < count; i++) {
        pickups.push({ x: W + 60 + i * 34, y: high ? GROUND_Y - 150 : GROUND_Y - 60, taken: false });
      }
    }
  }

  function update(dt) {
    const spd = speed();
    distance += spd * dt;
    score = Math.floor(distance / 10) + coins * 25;
    renderHud();

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    player.run += dt * (spd / 40);
    if (player.y >= GROUND_Y - PLAYER_H) {
      player.y = GROUND_Y - PLAYER_H;
      player.vy = 0;
      player.jumps = 0;
    }

    for (const layer of skyline) {
      layer.x -= spd * 0.12 * dt;
      if (layer.x + layer.w < 0) {
        layer.x = W + Math.random() * 40;
        layer.w = 30 + Math.random() * 60;
        layer.h = 60 + Math.random() * 130;
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.62, 1.35 - distance / 9000);
    }

    const px = { x: PLAYER_X + 5, y: player.y + 4, w: PLAYER_W - 10, h: PLAYER_H - 6 };
    for (const ob of obstacles) {
      ob.x -= spd * dt;
      const oy = ob.kind === "drone" ? ob.y + Math.sin((ob.t += dt * 3)) * 8 : GROUND_Y - ob.h;
      ob.drawY = oy;
      if (px.x < ob.x + ob.w - 4 && px.x + px.w > ob.x + 4 && px.y < oy + ob.h - 4 && px.y + px.h > oy + 4) {
        gameOver();
        return;
      }
    }
    obstacles = obstacles.filter((ob) => ob.x + ob.w > -30);

    for (const coin of pickups) {
      coin.x -= spd * dt;
      if (!coin.taken && Math.hypot(coin.x - (PLAYER_X + PLAYER_W / 2), coin.y - (player.y + PLAYER_H / 2)) < 30) {
        coin.taken = true;
        coins += 1;
      }
    }
    pickups = pickups.filter((coin) => !coin.taken && coin.x > -30);
  }

  function render(now) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b0f1a");
    sky.addColorStop(0.75, "#1b1440");
    sky.addColorStop(1, "#2b1a4d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#f472b6";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(W - 110, 84, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(W - 110, 84, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const layer of skyline) {
      ctx.fillStyle = layer.shade > 0.5 ? "rgba(42, 53, 96, 0.9)" : "rgba(27, 36, 64, 0.9)";
      ctx.fillRect(layer.x, GROUND_Y - layer.h, layer.w, layer.h);
      ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
      ctx.fillRect(layer.x, GROUND_Y - layer.h, layer.w, 3);
    }

    ctx.fillStyle = "#0e1430";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(0, GROUND_Y, W, 3);
    ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
    const dashOffset = state === "running" ? (distance % 48) : 0;
    for (let x = -dashOffset; x < W; x += 48) {
      ctx.fillRect(x, GROUND_Y + 18, 24, 4);
    }

    for (const coin of pickups) {
      ctx.save();
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(coin.x, coin.y, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#92400e";
      ctx.fillRect(coin.x - 2, coin.y - 6, 4, 12);
      ctx.restore();
    }

    for (const ob of obstacles) {
      const oy = ob.drawY !== undefined ? ob.drawY : GROUND_Y - ob.h;
      if (ob.kind === "spike") {
        ctx.save();
        ctx.shadowColor = "#fb7185";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.moveTo(ob.x, GROUND_Y);
        ctx.lineTo(ob.x + ob.w / 2, GROUND_Y - ob.h);
        ctx.lineTo(ob.x + ob.w, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (ob.kind === "block") {
        ctx.save();
        ctx.shadowColor = "#a78bfa";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#6d4fc2";
        ctx.fillRect(ob.x, oy, ob.w, ob.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(ob.x + 4, oy + 4, ob.w - 8, 6);
        ctx.restore();
      } else {
        const bobY = oy;
        ctx.save();
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#0e7490";
        ctx.beginPath();
        ctx.roundRect(ob.x, bobY, ob.w, ob.h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fb7185";
        ctx.beginPath();
        ctx.arc(ob.x + ob.w / 2, bobY + ob.h / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const running = state === "running" && player.jumps === 0;
    const legSwing = running ? Math.sin(player.run) * 7 : 0;
    ctx.save();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.roundRect(PLAYER_X, player.y, PLAYER_W, PLAYER_H, 9);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#062a33";
    ctx.fillRect(PLAYER_X + 6, player.y + PLAYER_H - 14 + legSwing * 0.4, 7, 12);
    ctx.fillRect(PLAYER_X + 17, player.y + PLAYER_H - 14 - legSwing * 0.4, 7, 12);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(PLAYER_X + PLAYER_W - 9, player.y + 13, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0f1a";
    ctx.beginPath();
    ctx.arc(PLAYER_X + PLAYER_W - 7.5, player.y + 13, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(242, 245, 255, 0.85)";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.floor(distance)}m`, 14, 30);
    void now;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running") update(dt);
    render(now);
  }

  window.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      event.preventDefault();
      if (state === "paused") togglePause();
      else jump();
    } else if (event.code === "Enter") {
      if (state === "ready" || state === "over") start();
      else togglePause();
    } else if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      togglePause();
    }
  });
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "paused") togglePause();
    else jump();
  });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  reset();
  requestAnimationFrame(frame);
})();
