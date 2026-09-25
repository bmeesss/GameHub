/* Knife Dodge — original GameHub implementation.
   Survival dodger: dash through falling knives for 60 seconds. */
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

  const BEST_KEY = "gh_best_knife-dodge";
  const GOAL_S = 60;

  let playerX = 0.5;
  let dashV = 0;
  let dashCd = 0;
  let knives = [];
  let stuck = [];
  let warnings = [];
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

  function playerGeom() {
    const W = canvas.width;
    const H = canvas.height;
    return { x: playerX * W, y: H * 0.88, w: Math.max(24, W * 0.08), h: 30 };
  }

  function reset() {
    playerX = 0.5;
    dashV = 0;
    dashCd = 0;
    knives = [];
    stuck = [];
    warnings = [];
    particles = [];
    survived = 0;
    spawnAcc = 0;
    held.left = false;
    held.right = false;
    renderScore();
  }

  function renderScore() {
    const secs = Math.floor(survived);
    if (scoreEl) scoreEl.textContent = `${secs}s`;
    if (bestEl) bestEl.textContent = `${Math.max(best, secs)}s`;
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
      showOverlay("Paused", `${Math.floor(survived)} of ${GOAL_S} seconds survived.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function finish(won) {
    state = "over";
    const secs = Math.floor(survived);
    const record = secs > best;
    if (record) {
      best = secs;
      saveBest(best);
    }
    renderScore();
    if (won) {
      showOverlay("You survived!", `60 seconds of flying steel — the crowd goes wild!${record ? " New best!" : ""}`, "Play again");
    } else {
      const p = playerGeom();
      burst(p.x, p.y, "#fb7185", 16);
      showOverlay("Nicked!", `A knife caught you after ${secs} second${secs === 1 ? "" : "s"}.${record && secs > 0 ? " New best!" : ""}`, "Try again");
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 0.6,
        color
      });
    }
  }

  function dash() {
    if (state !== "running" || dashCd > 0) return;
    const dir = held.left && !held.right ? -1 : held.right && !held.left ? 1 : playerX < 0.5 ? 1 : -1;
    dashV = dir * 2.2;
    dashCd = 1.5;
    burst(playerGeom().x, playerGeom().y, "#22d3ee", 6);
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    survived += dt;
    if (survived >= GOAL_S) {
      survived = GOAL_S;
      finish(true);
      return;
    }
    dashCd = Math.max(0, dashCd - dt);
    if (held.left) playerX -= 0.85 * dt;
    if (held.right) playerX += 0.85 * dt;
    playerX += dashV * dt;
    dashV *= Math.max(0, 1 - 6 * dt);
    if (Math.abs(dashV) < 0.05) dashV = 0;
    const p = playerGeom();
    playerX = Math.min(Math.max(playerX, p.w / W), 1 - p.w / W);

    spawnAcc += dt;
    const interval = Math.max(0.14, 0.5 - survived * 0.006);
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      const kx = 16 + Math.random() * (W - 32);
      warnings.push({ x: kx, t: 0.55 });
      if (survived > 30 && Math.random() < 0.4) {
        warnings.push({ x: 16 + Math.random() * (W - 32), t: 0.55 });
      }
    }
    for (const w of warnings) {
      w.t -= dt;
      if (w.t <= 0) {
        knives.push({
          x: w.x,
          y: -30,
          vy: H * (0.9 + Math.random() * 0.4 + survived * 0.008),
          spin: (Math.random() - 0.5) * 4
        });
      }
    }
    warnings = warnings.filter((w) => w.t > 0);

    const groundY = H * 0.94;
    for (const k of knives) {
      k.y += k.vy * dt;
      if (k.y >= groundY) {
        k.y = groundY;
        k.stuckT = 1.6;
        stuck.push(k);
        k.dead = true;
        burst(k.x, groundY, "#94a3b8", 3);
      }
    }
    knives = knives.filter((k) => !k.dead);
    for (const s of stuck) s.stuckT -= dt;
    stuck = stuck.filter((s) => s.stuckT > 0);

    const pp = playerGeom();
    for (const k of knives) {
      if (k.y > pp.y - 44 && k.y < pp.y + 10 && Math.abs(k.x - pp.x) < pp.w / 2 + 5) {
        finish(false);
        return;
      }
    }
    renderScore();
  }

  function drawKnife(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(5, -8);
    ctx.lineTo(5, 8);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#78350f";
    ctx.fillRect(-6, 8, 12, 9);
    ctx.restore();
  }

  function render() {
    const W = canvas.width;
    const H = canvas.height;
    const tent = ctx.createLinearGradient(0, 0, 0, H);
    tent.addColorStop(0, "#1c0f14");
    tent.addColorStop(1, "#05070f");
    ctx.fillStyle = tent;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(251, 113, 133, 0.08)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo((W / 6) * i, H);
      ctx.lineTo((W / 6) * (i + 0.5), H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#292524";
    ctx.fillRect(0, H * 0.94, W, H * 0.06);
    for (const w of warnings) {
      ctx.fillStyle = `rgba(251, 113, 133, ${0.3 + (0.55 - w.t) * 0.8})`;
      ctx.beginPath();
      ctx.arc(w.x, 18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 12px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", w.x, 19);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    for (const s of stuck) {
      ctx.globalAlpha = Math.min(1, s.stuckT);
      drawKnife(s.x, s.y - 14);
      ctx.globalAlpha = 1;
    }
    for (const k of knives) drawKnife(k.x, k.y);
    const p = playerGeom();
    const dashing = Math.abs(dashV) > 0.3;
    ctx.save();
    ctx.shadowColor = dashing ? "#22d3ee" : "#4ade80";
    ctx.shadowBlur = 14;
    ctx.fillStyle = dashing ? "#22d3ee" : "#4ade80";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 7, p.y - 2, 14, 14);
    ctx.restore();
    ctx.fillStyle = "#052e16";
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 13, 1.8, 0, Math.PI * 2);
    ctx.arc(p.x + 4, p.y - 13, 1.8, 0, Math.PI * 2);
    ctx.fill();
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(pt.life * 1.6, 0);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* Progress + dash meter. */
    ctx.fillStyle = "rgba(5, 7, 15, 0.7)";
    ctx.fillRect(12, 10, W - 24, 12);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(12, 10, (W - 24) * (survived / GOAL_S), 12);
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 11px Inter, Arial, sans-serif";
    ctx.fillText(`${Math.floor(GOAL_S - survived)}s left`, 12, 36);
    ctx.fillStyle = dashCd > 0 ? "rgba(148, 163, 216, 0.4)" : "#22d3ee";
    ctx.fillText(dashCd > 0 ? "Dash…" : "Dash ready (Space)", W - 130, 36);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    particles = particles.filter((pt) => pt.life > 0);
    if (state === "running") update(dt);
    render();
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
    } else if (key === " " || key === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (!event.repeat) dash();
    } else if (key === "Enter") {
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

  function pointToPlayer(clientX) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width) {
        playerX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      }
    } catch (err) { /* geometry unavailable */ }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (state === "ready" || state === "over") start();
    else if (state === "running") pointToPlayer(event.clientX);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (state === "running") pointToPlayer(event.clientX);
  });
  canvas.addEventListener("touchstart", (event) => {
    if (state === "ready" || state === "over") start();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && state === "running") pointToPlayer(touch.clientX);
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && state === "running") pointToPlayer(touch.clientX);
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
  showOverlay("Knife Dodge", "The knives are falling! Dash left and right and survive the full 60 seconds.", "Start game");
  requestAnimationFrame(frame);
})();
