/* Zombie Survival — original GameHub implementation.
   Arena survival: kite the horde, your blaster auto-fires. */
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
  const waveEl = document.getElementById("wave");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_zombie-survival";

  let px = 0.5;
  let py = 0.5;
  let hp = 3;
  let invuln = 0;
  let wave = 1;
  let kills = 0;
  let zombies = [];
  let bullets = [];
  let particles = [];
  let fireAcc = 0;
  let banner = "";
  let bannerTimer = 0;
  let state = "ready";
  let last = 0;
  const held = { up: false, down: false, left: false, right: false };

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

  function reset() {
    px = 0.5;
    py = 0.5;
    hp = 3;
    invuln = 0;
    wave = 1;
    kills = 0;
    zombies = [];
    bullets = [];
    particles = [];
    fireAcc = 0;
    banner = "Wave 1";
    bannerTimer = 1.6;
    held.up = held.down = held.left = held.right = false;
    spawnWave();
    renderScore();
  }

  function spawnWave() {
    const count = 3 + wave * 2;
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      const t = Math.random();
      let x = t;
      let y = t;
      if (side === 0) y = 0.02;
      else if (side === 1) y = 0.98;
      else if (side === 2) x = 0.02;
      else x = 0.98;
      zombies.push({
        x, y,
        hp: 1 + Math.floor(wave / 3),
        speed: 0.09 + Math.random() * 0.05 + wave * 0.006,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(kills);
    if (waveEl) waveEl.textContent = String(wave);
    if (bestEl) bestEl.textContent = String(Math.max(best, kills));
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
      showOverlay("Paused", `Wave ${wave} · ${kills} zombie${kills === 1 ? "" : "s"} down.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = kills > best;
    if (record) {
      best = kills;
      saveBest(best);
    }
    renderScore();
    showOverlay("Overrun!", `The horde got you on wave ${wave} with ${kills} kill${kills === 1 ? "" : "s"}.${record && kills > 0 ? " New best!" : ""}`, "Play again");
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        life: 0.5,
        color
      });
    }
  }

  function nearestZombie() {
    let target = null;
    let bestDist = Infinity;
    for (const z of zombies) {
      const d = (z.x - px) * (z.x - px) + (z.y - py) * (z.y - py);
      if (d < bestDist) {
        bestDist = d;
        target = z;
      }
    }
    return target;
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    const move = 0.42 * dt;
    if (held.left) px -= move;
    if (held.right) px += move;
    if (held.up) py -= move;
    if (held.down) py += move;
    if (touchMove) {
      px += touchMove.dx * dt * 1.6;
      py += touchMove.dy * dt * 1.6;
    }
    px = Math.min(Math.max(px, 0.04), 0.96);
    py = Math.min(Math.max(py, 0.04), 0.96);
    invuln = Math.max(0, invuln - dt);

    fireAcc += dt;
    if (fireAcc >= 0.24 && zombies.length) {
      fireAcc = 0;
      const target = nearestZombie();
      if (target) {
        const dx = target.x - px;
        const dy = target.y - py;
        const len = Math.hypot(dx, dy) || 1;
        bullets.push({ x: px, y: py, vx: (dx / len) * 1.4, vy: (dy / len) * 1.4, life: 1.2 });
      }
    }

    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    bullets = bullets.filter((b) => b.life > 0 && b.x > -0.05 && b.x < 1.05 && b.y > -0.05 && b.y < 1.05);

    for (const z of zombies) {
      z.wobble += dt * 6;
      const dx = px - z.x;
      const dy = py - z.y;
      const len = Math.hypot(dx, dy) || 1;
      const wob = Math.sin(z.wobble) * 0.3;
      z.x += (dx / len + -dy / len * wob * 0.3) * z.speed * dt;
      z.y += (dy / len + dx / len * wob * 0.3) * z.speed * dt;
    }

    for (const b of bullets) {
      for (const z of zombies) {
        if (z.hp > 0 && Math.hypot(z.x - b.x, z.y - b.y) < 0.035) {
          z.hp -= 1;
          b.life = 0;
          burst(z.x, z.y, "#4ade80", 5);
          if (z.hp <= 0) {
            kills += 1;
            burst(z.x, z.y, "#22d3ee", 10);
            if (kills > best) {
              best = kills;
              saveBest(best);
            }
          }
          break;
        }
      }
    }
    zombies = zombies.filter((z) => z.hp > 0);
    renderScore();

    if (invuln <= 0) {
      for (const z of zombies) {
        if (Math.hypot(z.x - px, z.y - py) < 0.05) {
          hp -= 1;
          invuln = 1.2;
          burst(px, py, "#fb7185", 12);
          if (hp <= 0) {
            gameOver();
            return;
          }
          break;
        }
      }
    }

    if (!zombies.length) {
      wave += 1;
      banner = `Wave ${wave}`;
      bannerTimer = 1.6;
      spawnWave();
      renderScore();
    }
    void W;
    void H;
  }

  function render(dt) {
    bannerTimer = Math.max(0, bannerTimer - dt);
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(74, 222, 128, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((W / 8) * i + 0.5, 0);
      ctx.lineTo((W / 8) * i + 0.5, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (H / 8) * i + 0.5);
      ctx.lineTo(W, (H / 8) * i + 0.5);
      ctx.stroke();
    }
    for (const z of zombies) {
      ctx.fillStyle = z.hp > 1 ? "#15803d" : "#4ade80";
      ctx.beginPath();
      ctx.arc(z.x * W, z.y * H, W * 0.028, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#052e16";
      ctx.beginPath();
      ctx.arc(z.x * W - 4, z.y * H - 2, 2.2, 0, Math.PI * 2);
      ctx.arc(z.x * W + 4, z.y * H - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of bullets) {
      ctx.save();
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(b.x * W, b.y * H, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (invuln <= 0 || Math.floor(invuln * 10) % 2 === 0) {
      ctx.save();
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(px * W, py * H, W * 0.026, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life * 1.8, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < hp ? "#fb7185" : "rgba(251, 113, 133, 0.25)";
      ctx.beginPath();
      ctx.arc(20 + i * 24, 20, 8, 0, Math.PI * 2);
      ctx.fill();
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
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
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
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      return;
    }
    if (key === "p" || key === "P" || key === "Escape") {
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
    setHeld(keyOf(event), false);
  }

  let touchMove = null;
  let touchOrigin = null;
  function canvasPos(clientX, clientY) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width && rect.height) {
        return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
      }
    } catch (err) { /* geometry unavailable */ }
    return null;
  }
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    if (state === "ready" || state === "over") start();
    else if (state === "paused") {
      togglePause();
      return;
    }
    touchOrigin = canvasPos(touch.clientX, touch.clientY);
    touchMove = null;
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch || !touchOrigin) return;
    const pos = canvasPos(touch.clientX, touch.clientY);
    if (!pos) return;
    const dx = pos.x - touchOrigin.x;
    const dy = pos.y - touchOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.03) {
      touchMove = { dx: dx / len * Math.min(len * 4, 1), dy: dy / len * Math.min(len * 4, 1) };
    } else {
      touchMove = null;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => {
    touchMove = null;
    touchOrigin = null;
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
  showOverlay("Zombie Survival", "Kite the horde around the arena. Your blaster fires on its own — you just survive.", "Start game");
  requestAnimationFrame(frame);
})();
