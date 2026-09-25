/* Survival Arena — original GameHub implementation.
   Top-down wave survival: kite the drones, keep firing, grab repair
   cores. Score is kills, the record is the highest wave reached. */
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
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const healthEl = document.getElementById("health");
  const bestEl = document.getElementById("best");
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
  const BEST_KEY = "gh_best_survival-arena";
  const PLAYER_R = 13;
  const FIRE_COOLDOWN = 190;

  let player = { x: W / 2, y: H / 2, hp: 5 };
  let bullets = [];
  let enemies = [];
  let cores = [];
  let particles = [];
  let keys = {};
  let pointer = { x: W / 2, y: H / 2 - 60, down: false };
  let score = 0;
  let wave = 1;
  let spawnLeft = 0;
  let spawnTimer = 0;
  let fireTimer = 0;
  let best = readNumber(BEST_KEY);
  let state = "idle";
  let paused = false;

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
    if (scoreEl) scoreEl.textContent = String(score);
    if (waveEl) waveEl.textContent = String(wave);
    if (healthEl) healthEl.textContent = String(Math.max(0, player.hp));
    if (bestEl) bestEl.textContent = String(best);
  }

  function startWave() {
    spawnLeft = 3 + wave * 2;
    spawnTimer = 0;
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    const speed = 0.7 + wave * 0.09 + Math.random() * 0.3;
    const enemy = {
      x: edge === 0 ? 20 : edge === 1 ? W - 20 : 40 + Math.random() * (W - 80),
      y: edge === 2 ? 20 : edge === 3 ? H - 20 : 40 + Math.random() * (H - 80),
      r: 11 + Math.random() * 6,
      speed: speed,
      hp: 1 + Math.floor(wave / 3)
    };
    enemies.push(enemy);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.4;
      particles.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 26, color: color });
    }
  }

  function damage(amount) {
    player.hp -= amount;
    refreshHud();
    if (player.hp <= 0) {
      state = "over";
      if (wave > best) {
        best = wave;
        writeNumber(BEST_KEY, best);
      }
      refreshHud();
      showOverlay("Arena lost", "You survived " + wave + (wave === 1 ? " wave" : " waves") + " with " + score + " drones downed.", "Fight again", true);
    }
  }

  function fire() {
    if (state !== "playing" || paused) return;
    if (fireTimer > 0) return;
    fireTimer = FIRE_COOLDOWN;
    const angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    bullets.push({ x: player.x, y: player.y, vx: Math.cos(angle) * 7.4, vy: Math.sin(angle) * 7.4, life: 90 });
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    const step = dt / 16.7;
    const speed = 2.5 * step;
    let dx = 0;
    let dy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      player.x += (dx / length) * speed;
      player.y += (dy / length) * speed;
    }
    player.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, player.x));
    player.y = Math.max(PLAYER_R, Math.min(H - PLAYER_R, player.y));

    fireTimer = Math.max(0, fireTimer - dt);
    if (pointer.down) fire();

    spawnTimer += dt;
    if (spawnLeft > 0 && spawnTimer > Math.max(260, 900 - wave * 60)) {
      spawnTimer = 0;
      spawnLeft--;
      spawnEnemy();
    }
    if (!spawnLeft && !enemies.length && state === "playing") {
      wave++;
      player.hp = Math.min(8, player.hp + (wave % 3 === 0 ? 1 : 0));
      cores.push({ x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120), life: 800 });
      startWave();
      refreshHud();
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * step;
      bullet.y += bullet.vy * step;
      bullet.life -= step;
      if (bullet.x < 0 || bullet.y < 0 || bullet.x > W || bullet.y > H || bullet.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.r + 3) {
          enemy.hp--;
          bullets.splice(i, 1);
          if (enemy.hp <= 0) {
            enemies.splice(j, 1);
            score += 10;
            burst(enemy.x, enemy.y, "#fb7185", 10);
            refreshHud();
          }
          break;
        }
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * step;
      enemy.y += Math.sin(angle) * enemy.speed * step;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.r + PLAYER_R) {
        enemies.splice(i, 1);
        burst(enemy.x, enemy.y, "#f97316", 12);
        damage(1);
        if (state !== "playing") return;
      }
    }

    for (let i = cores.length - 1; i >= 0; i--) {
      const core = cores[i];
      core.life -= step;
      if (core.life <= 0) {
        cores.splice(i, 1);
        continue;
      }
      if (Math.hypot(core.x - player.x, core.y - player.y) < PLAYER_R + 12) {
        cores.splice(i, 1);
        player.hp = Math.min(8, player.hp + 1);
        refreshHud();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.life -= step;
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const core of cores) {
      ctx.beginPath();
      ctx.arc(core.x, core.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(core.x, core.y, 17, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / 26);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    for (const enemy of enemies) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
      ctx.fillStyle = "#f472b6";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "#2a0b2f";
      ctx.fill();
    }
    for (const bullet of bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = "#22d3ee";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
    const aim = Math.atan2(pointer.y - player.y, pointer.x - player.x);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(aim) * 22, player.y + Math.sin(aim) * 22);
    ctx.stroke();
    /* health pips */
    for (let i = 0; i < Math.max(0, player.hp); i++) {
      ctx.fillStyle = "#34d399";
      ctx.fillRect(14 + i * 14, H - 22, 10, 10);
    }
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    player = { x: W / 2, y: H / 2, hp: 5 };
    bullets = [];
    enemies = [];
    cores = [];
    particles = [];
    score = 0;
    wave = 1;
    spawnLeft = 0;
    spawnTimer = 0;
    fireTimer = 0;
    state = "playing";
    paused = false;
    startWave();
    hideOverlay();
    refreshHud();
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    return {
      x: ((event.clientX || 0) - rect.left) * (W / (rect.width || W)),
      y: ((event.clientY || 0) - rect.top) * (H / (rect.height || H))
    };
  }

  canvas.addEventListener("pointermove", (event) => {
    pointer = pointFromEvent(event);
    pointer.down = pointer.down;
  });
  canvas.addEventListener("pointerdown", (event) => {
    const point = pointFromEvent(event);
    pointer = { x: point.x, y: point.y, down: true };
    fire();
  });
  canvas.addEventListener("pointerup", () => { pointer.down = false; });
  canvas.addEventListener("pointerleave", () => { pointer.down = false; });
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const point = pointFromEvent(touch);
    pointer = { x: point.x, y: point.y, down: true };
    fire();
  }, { passive: true });
  canvas.addEventListener("touchend", () => { pointer.down = false; });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(key) !== -1) event.preventDefault();
    if (key === " ") {
      pointer.down = true;
      fire();
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
    keys[key] = true;
  });
  window.addEventListener("keyup", (event) => {
    const key = String(event.key || "");
    if (key === " ") pointer.down = false;
    keys[key] = false;
  });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The drones hover in place.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startGame();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
