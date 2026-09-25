/* Stellar Siege — original GameHub implementation.
   Fixed shooter: hold the line against descending alien waves. */
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
  const waveEl = document.getElementById("wave");
  const livesEl = document.getElementById("lives");
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
  const COLS = 8;
  const ROWS = 4;
  const CELL_W = 46;
  const CELL_H = 40;
  const SHIP_W = 40;
  const SHIP_H = 20;
  const BULLET_SPEED = 9;
  const MAX_BULLETS = 3;

  let ship = null;
  let aliens = [];
  let bullets = [];
  let bombs = [];
  let particles = [];
  let score = 0;
  let wave = 1;
  let lives = 3;
  let best = loadBest();
  let state = "ready";
  let keys = { left: false, right: false, fire: false };
  let cooldown = 0;
  let alienDir = 1;
  let alienSpeed = 0.35;
  let last = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_stellar-siege"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_stellar-siege", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function spawnWave() {
    aliens = [];
    const gridW = COLS * CELL_W;
    const startX = (W - gridW) / 2 + CELL_W / 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        aliens.push({
          x: startX + c * CELL_W,
          y: 70 + r * CELL_H,
          w: 28,
          h: 20,
          row: r,
          alive: true,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    alienDir = 1;
    alienSpeed = 0.35 + (wave - 1) * 0.14;
  }

  function reset() {
    ship = { x: W / 2, y: H - 46, cooldown: 0 };
    bullets = [];
    bombs = [];
    particles = [];
    score = 0;
    wave = 1;
    lives = 3;
    spawnWave();
    renderHud();
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (waveEl) waveEl.textContent = String(wave);
    if (livesEl) livesEl.textContent = "♥".repeat(Math.max(0, lives));
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
  }

  function endGame() {
    state = "over";
    if (score > best) {
      best = score;
      saveBest();
    }
    renderHud();
    showOverlay("Ship destroyed", `Final score ${score} on wave ${wave}. Best: ${best}.`, "Play again");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Score ${score} · Wave ${wave} · ${lives} ship${lives === 1 ? "" : "s"} left.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 22, color });
    }
  }

  function fire() {
    if (cooldown > 0 || bullets.length >= MAX_BULLETS) return;
    bullets.push({ x: ship.x, y: ship.y - SHIP_H });
    cooldown = 12;
  }

  function update(dt) {
    if (state !== "running") return;
    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    ship.x += steer * 5.2 * dt;
    ship.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, ship.x));
    if (keys.fire) fire();
    if (cooldown > 0) cooldown -= dt;

    for (const b of bullets) b.y -= BULLET_SPEED * dt;
    bullets = bullets.filter((b) => b.y > -10);

    let edge = false;
    for (const a of aliens) {
      if (!a.alive) continue;
      a.x += alienDir * alienSpeed * dt;
      a.phase += 0.08 * dt;
      if (a.x < a.w / 2 || a.x > W - a.w / 2) edge = true;
    }
    if (edge) {
      alienDir *= -1;
      for (const a of aliens) {
        if (a.alive) a.y += 16;
      }
    }

    /* Alien bombs */
    const shooters = aliens.filter((a) => a.alive);
    if (shooters.length && Math.random() < 0.012 + wave * 0.004) {
      const shooter = shooters[Math.floor(Math.random() * shooters.length)];
      bombs.push({ x: shooter.x, y: shooter.y + 14, vy: 2.2 + wave * 0.25 });
    }
    for (const b of bombs) b.y += b.vy * dt;
    bombs = bombs.filter((b) => b.y < H + 10);

    /* Bullet hits */
    for (const b of bullets) {
      for (const a of aliens) {
        if (!a.alive) continue;
        if (Math.abs(b.x - a.x) < a.w / 2 + 3 && Math.abs(b.y - a.y) < a.h / 2 + 6) {
          a.alive = false;
          b.y = -99;
          score += a.row === 0 ? 30 : a.row === 1 ? 20 : 10;
          burst(a.x, a.y, a.row === 0 ? "#fb7185" : "#22d3ee", 14);
          break;
        }
      }
    }
    bullets = bullets.filter((b) => b.y > -10);

    /* Bombs hit ship */
    for (const b of bombs) {
      if (Math.abs(b.x - ship.x) < SHIP_W / 2 && Math.abs(b.y - ship.y) < SHIP_H / 2 + 4) {
        b.y = H + 99;
        lives -= 1;
        burst(ship.x, ship.y, "#fbbf24", 22);
        renderHud();
        if (lives <= 0) {
          endGame();
          return;
        }
      }
    }
    bombs = bombs.filter((b) => b.y < H + 10);

    /* Aliens reach the line */
    for (const a of aliens) {
      if (a.alive && a.y > ship.y - 26) {
        endGame();
        return;
      }
    }

    /* Wave cleared */
    if (!aliens.some((a) => a.alive)) {
      wave += 1;
      score += 50;
      spawnWave();
      renderHud();
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.fillStyle = "#e6edff";
    ctx.beginPath();
    ctx.moveTo(0, -SHIP_H / 2 - 6);
    ctx.lineTo(SHIP_W / 2, SHIP_H / 2);
    ctx.lineTo(-SHIP_W / 2, SHIP_H / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(-6, 2, 12, 6);
    const flame = ctx.createLinearGradient(0, SHIP_H / 2, 0, SHIP_H / 2 + 12);
    flame.addColorStop(0, "rgba(34,211,238,.9)");
    flame.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = flame;
    ctx.fillRect(-5, SHIP_H / 2, 10, 12);
    ctx.restore();
  }

  function drawAlien(a) {
    if (!a.alive) return;
    const bob = Math.sin(a.phase) * 2;
    ctx.save();
    ctx.translate(a.x, a.y + bob);
    const color = a.row === 0 ? "#fb7185" : a.row === 1 ? "#c084fc" : "#22d3ee";
    ctx.fillStyle = color;
    ctx.fillRect(-a.w / 2, -a.h / 2, a.w, a.h * 0.7);
    ctx.fillRect(-a.w / 2 + 4, a.h / 5, 6, a.h / 3);
    ctx.fillRect(a.w / 2 - 10, a.h / 5, 6, a.h / 3);
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(-7, -4, 5, 5);
    ctx.fillRect(2, -4, 5, 5);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      const x = (i * 137) % W;
      const y = (i * 219) % H;
      ctx.fillStyle = "rgba(226,232,255,.35)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    if (state === "ready" || state === "over" || state === "paused") {
      ctx.fillStyle = "rgba(5,7,15,.4)";
      ctx.fillRect(0, 0, W, H);
    }
    for (const a of aliens) drawAlien(a);
    if (ship && state !== "over") drawShip();
    ctx.fillStyle = "#fbbf24";
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 10);
    ctx.fillStyle = "#fb7185";
    for (const b of bombs) ctx.fillRect(b.x - 2, b.y - 6, 4, 9);
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 22);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    /* Defense line */
    ctx.strokeStyle = "rgba(34,211,238,.3)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(0, H - 28);
    ctx.lineTo(W, H - 28);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 16.666, 3) || 1;
    last = now;
    update(dt);
    draw();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = true;
    if (event.key === " ") {
      event.preventDefault();
      keys.fire = true;
      if (state === "ready" || state === "over") start();
    }
    if (event.key === "Enter" && (state === "ready" || state === "over")) start();
    if (event.key === "p" || event.key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = false;
    if (event.key === " ") keys.fire = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? W / rect.width : 1;
    const target = (event.clientX - rect.left) * scale;
    if (state === "running") ship.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, target));
    keys.fire = true;
  });
  canvas.addEventListener("pointerup", () => { keys.fire = false; });
  canvas.addEventListener("pointermove", (event) => {
    if (state !== "running" || !keys.fire) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? W / rect.width : 1;
    ship.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, (event.clientX - rect.left) * scale));
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  reset();
  state = "ready";
  showOverlay("Stellar Siege", "Stop the alien grid before it reaches your defense line. Three ships, endless waves.", "Start game");
  requestAnimationFrame(frame);
})();
