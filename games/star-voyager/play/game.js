/* Star Voyager — original GameHub implementation.
   Vertical space shooter: autofire, three raider types, cores, waves. */
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
  const livesEl = document.getElementById("lives");
  const waveEl = document.getElementById("wave");
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
  const PLAYER_R = 13;
  const PLAYER_SPEED = 330;

  let state = "ready";
  let player = { x: W / 2, y: H - 90 };
  let lives = 3;
  let score = 0;
  let wave = 1;
  let waveTimer = 0;
  let spawnTimer = 0;
  let fireTimer = 0;
  let fireRate = 0.22;
  let spread = 0;
  let shield = 0;
  let invuln = 0;
  let stars = [];
  let shots = [];
  let foes = [];
  let cores = [];
  let parts = [];
  let keys = {};
  let pointer = null;
  let last = 0;

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (livesEl) livesEl.textContent = String(lives);
    if (waveEl) waveEl.textContent = String(wave);
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
    player = { x: W / 2, y: H - 90 };
    lives = 3;
    score = 0;
    wave = 1;
    waveTimer = 0;
    spawnTimer = 0.6;
    fireTimer = 0;
    fireRate = 0.22;
    spread = 0;
    shield = 0;
    invuln = 1;
    shots = [];
    foes = [];
    cores = [];
    parts = [];
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.6, v: 40 + Math.random() * 120 });
    }
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
      showOverlay("Paused", `Score ${score} · Wave ${wave}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    showOverlay("Ship destroyed", `You scored ${score} points and reached wave ${wave}.`, "Fly again");
  }

  function explode(x, y, color, count) {
    for (let i = 0; i < (count || 14); i++) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 340,
        vy: (Math.random() - 0.5) * 340,
        life: 0.5 + Math.random() * 0.3,
        color
      });
    }
  }

  function spawnFoe() {
    const roll = Math.random();
    const kind = roll < 0.5 ? "drifter" : roll < 0.8 ? "weaver" : "gunner";
    const hp = kind === "gunner" ? 3 + Math.floor(wave / 3) : kind === "weaver" ? 2 : 1 + Math.floor(wave / 4);
    foes.push({
      kind,
      x: 30 + Math.random() * (W - 60),
      y: -30,
      hp,
      maxHp: hp,
      t: 0,
      vy: (kind === "drifter" ? 120 : 90) + wave * 9,
      shoot: kind === "gunner" ? 1.2 : 0,
      score: kind === "gunner" ? 50 : kind === "weaver" ? 30 : 20
    });
  }

  function hurtPlayer() {
    if (invuln > 0 || state !== "running") return;
    if (shield > 0) {
      shield = 0;
      invuln = 1.2;
      explode(player.x, player.y, "#22d3ee", 18);
      return;
    }
    lives -= 1;
    invuln = 1.6;
    explode(player.x, player.y, "#fb7185", 22);
    renderHud();
    if (lives <= 0) gameOver();
  }

  function update(dt) {
    waveTimer += dt;
    if (waveTimer > 24) {
      waveTimer = 0;
      wave += 1;
      renderHud();
    }
    invuln = Math.max(invuln - dt, 0);
    spread = Math.max(spread - dt, 0);
    shield = Math.max(shield - dt, 0);

    for (const star of stars) {
      star.y += star.v * dt;
      if (star.y > H) {
        star.y = -4;
        star.x = Math.random() * W;
      }
    }

    const step = PLAYER_SPEED * dt;
    if (keys.ArrowLeft || keys.KeyA) player.x -= step;
    if (keys.ArrowRight || keys.KeyD) player.x += step;
    if (keys.ArrowUp || keys.KeyW) player.y -= step;
    if (keys.ArrowDown || keys.KeyS) player.y += step;
    if (pointer) {
      const dx = pointer.x - player.x;
      const dy = pointer.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const move = Math.min(dist, PLAYER_SPEED * 1.3 * dt);
        player.x += (dx / dist) * move;
        player.y += (dy / dist) * move;
      }
    }
    player.x = Math.max(PLAYER_R, Math.min(W - PLAYER_R, player.x));
    player.y = Math.max(H * 0.35, Math.min(H - 30, player.y));

    fireTimer -= dt;
    if (fireTimer <= 0) {
      fireTimer = fireRate;
      if (spread > 0) {
        shots.push({ x: player.x - 8, y: player.y - 14, vx: -70, vy: -560, foe: false });
        shots.push({ x: player.x, y: player.y - 16, vx: 0, vy: -600, foe: false });
        shots.push({ x: player.x + 8, y: player.y - 14, vx: 70, vy: -560, foe: false });
      } else {
        shots.push({ x: player.x, y: player.y - 16, vx: 0, vy: -600, foe: false });
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.34, 1.15 - wave * 0.09);
      spawnFoe();
      if (wave >= 3 && Math.random() < 0.35) spawnFoe();
    }

    for (const foe of foes) {
      foe.t += dt;
      foe.y += foe.vy * dt;
      if (foe.kind === "weaver") foe.x += Math.sin(foe.t * 3.2) * 130 * dt;
      if (foe.kind === "gunner") {
        foe.shoot -= dt;
        if (foe.shoot <= 0 && foe.y > 0 && foe.y < H * 0.7) {
          foe.shoot = 1.6;
          const dx = player.x - foe.x;
          const dy = player.y - foe.y;
          const dist = Math.max(Math.hypot(dx, dy), 1);
          shots.push({ x: foe.x, y: foe.y + 12, vx: (dx / dist) * 240, vy: (dy / dist) * 240, foe: true });
        }
      }
      if (Math.hypot(foe.x - player.x, foe.y - player.y) < PLAYER_R + 13) {
        foe.hp = 0;
        foe.crashed = true;
        hurtPlayer();
      }
    }

    for (const shot of shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.foe) {
        if (Math.hypot(shot.x - player.x, shot.y - player.y) < PLAYER_R) {
          shot.dead = true;
          hurtPlayer();
        }
        continue;
      }
      for (const foe of foes) {
        if (foe.hp <= 0) continue;
        if (Math.abs(shot.x - foe.x) < 16 && Math.abs(shot.y - foe.y) < 16) {
          shot.dead = true;
          foe.hp -= 1;
          if (foe.hp <= 0) {
            score += foe.score;
            explode(foe.x, foe.y, "#fb7185", 16);
            if (Math.random() < 0.12) {
              const kinds = ["S", "R", "H"];
              cores.push({ x: foe.x, y: foe.y, vy: 90, kind: kinds[Math.floor(Math.random() * kinds.length)] });
            }
            renderHud();
          }
          break;
        }
      }
    }
    shots = shots.filter((s) => !s.dead && s.y > -30 && s.y < H + 30 && s.x > -30 && s.x < W + 30);

    for (const foe of foes) {
      if (foe.hp <= 0 && !foe.counted) foe.counted = true;
    }
    foes = foes.filter((foe) => foe.hp > 0 && foe.y < H + 40);

    for (const core of cores) {
      core.y += core.vy * dt;
      if (Math.hypot(core.x - player.x, core.y - player.y) < PLAYER_R + 12) {
        core.taken = true;
        if (core.kind === "S") spread = 10;
        else if (core.kind === "R") fireRate = 0.12;
        else shield = 12;
        setTimeout(() => { fireRate = 0.22; }, 10000);
        score += 10;
        renderHud();
      }
    }
    cores = cores.filter((core) => !core.taken && core.y < H + 20);
  }

  function drawShip(x, y, color, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(11, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(224, 231, 255, 0.8)";
    for (const star of stars) {
      ctx.globalAlpha = 0.35 + star.s * 0.3;
      ctx.fillRect(star.x, star.y, star.s, star.s * 2.2);
    }
    ctx.globalAlpha = 1;

    for (const core of cores) {
      ctx.save();
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#052e16";
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(core.x, core.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#bbf7d0";
      ctx.font = "800 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(core.kind, core.x, core.y + 1);
      ctx.restore();
    }

    for (const foe of foes) {
      const color = foe.kind === "gunner" ? "#f472b6" : foe.kind === "weaver" ? "#fb923c" : "#fb7185";
      drawShip(foe.x, foe.y, color, true);
      if (foe.maxHp > 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(foe.x - 14, foe.y - 22, 28, 4);
        ctx.fillStyle = color;
        ctx.fillRect(foe.x - 14, foe.y - 22, (28 * foe.hp) / foe.maxHp, 4);
      }
    }

    for (const shot of shots) {
      ctx.save();
      ctx.shadowColor = shot.foe ? "#fb7185" : "#22d3ee";
      ctx.shadowBlur = 10;
      ctx.fillStyle = shot.foe ? "#fb7185" : "#a5f3fc";
      ctx.beginPath();
      ctx.roundRect(shot.x - 2.5, shot.y - 8, 5, 16, 2.5);
      ctx.fill();
      ctx.restore();
    }

    if (invuln <= 0 || Math.floor(invuln * 12) % 2 === 0) {
      const flame = 10 + Math.random() * 8;
      const flameGrad = ctx.createLinearGradient(0, player.y + 10, 0, player.y + 10 + flame + 12);
      flameGrad.addColorStop(0, "#fde047");
      flameGrad.addColorStop(1, "rgba(251, 113, 133, 0)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(player.x - 5, player.y + 10);
      ctx.lineTo(player.x + 5, player.y + 10);
      ctx.lineTo(player.x, player.y + 10 + flame + 10);
      ctx.closePath();
      ctx.fill();
      drawShip(player.x, player.y, "#7c5cff", false);
      if (shield > 0) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_R + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const p of parts) {
      ctx.globalAlpha = Math.max(p.life * 1.8, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (spread > 0 || shield > 0) {
      ctx.fillStyle = "rgba(242, 245, 255, 0.85)";
      ctx.font = "700 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      let line = 24;
      if (spread > 0) { ctx.fillText(`SPREAD ${Math.ceil(spread)}s`, 12, line); line += 18; }
      if (shield > 0) { ctx.fillText(`SHIELD ${Math.ceil(shield)}s`, 12, line); }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    parts = parts.filter((p) => p.life > 0);
    if (state === "running") update(dt);
    else if (state === "ready") {
      for (const star of stars) {
        star.y += star.v * 0.4 * dt;
        if (star.y > H) star.y = -4;
      }
    }
    render();
  }

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * W,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * H
    };
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    keys[event.code] = true;
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if ((event.code === "Space" || event.code === "Enter") && state !== "running") {
      if (state === "paused") togglePause();
      else start();
    }
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });
  canvas.addEventListener("pointerdown", (event) => {
    pointer = canvasPoint(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons) pointer = canvasPoint(event.clientX, event.clientY);
  });
  window.addEventListener("pointerup", () => {
    pointer = null;
  });
  canvas.addEventListener("touchmove", (event) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) pointer = canvasPoint(touch.clientX, touch.clientY);
  }, { passive: false });
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
