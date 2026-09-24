/* Feather Flight — original GameHub implementation.
   One-button flap flyer: rise on input, thread the gates, beat your best. */
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
  const GROUND_H = 64;
  const BIRD_X = 110;
  const BIRD_R = 15;
  const GRAVITY = 1650;
  const FLAP_VY = -480;
  const MAX_FALL = 720;
  const GATE_W = 64;
  const GATE_SPACING = 218;
  const BASE_SPEED = 168;

  let state = "ready";
  let bird = { y: H / 2, vy: 0, wing: 0 };
  let gates = [];
  let clouds = [];
  let score = 0;
  let best = loadBest();
  let last = 0;
  let idle = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_feather_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_feather_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function speed() {
    return BASE_SPEED + Math.min(score * 3.2, 120);
  }

  function gapSize() {
    return Math.max(118, 152 - score * 1.4);
  }

  function reset() {
    bird = { y: H / 2 - 40, vy: 0, wing: 0 };
    gates = [];
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({ x: Math.random() * W, y: 30 + Math.random() * (H / 2), s: 0.6 + Math.random() * 0.9 });
    }
    score = 0;
    idle = 0;
    renderScore();
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
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

  function start() {
    reset();
    spawnGate(W + 40);
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Score ${score}. The sky will wait.`, "Resume");
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
    renderScore();
    showOverlay(score === 0 ? "Ouch!" : "Flight over", `You cleared ${score} gate${score === 1 ? "" : "s"}.${record && score > 0 ? " New best!" : ""}`, "Fly again");
  }

  function spawnGate(x) {
    const gap = gapSize();
    const margin = 70;
    const top = margin + Math.random() * (H - GROUND_H - margin * 2 - gap);
    gates.push({ x, top, gap, passed: false });
  }

  function flap() {
    if (state === "ready" || state === "over") {
      start();
    }
    if (state !== "running") return;
    bird.vy = FLAP_VY;
    bird.wing = 1;
  }

  function update(dt) {
    bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
    bird.y += bird.vy * dt;
    bird.wing = Math.max(bird.wing - dt * 4, 0);
    const spd = speed();
    for (const cloud of clouds) {
      cloud.x -= spd * 0.18 * dt;
      if (cloud.x < -90) {
        cloud.x = W + 60;
        cloud.y = 30 + Math.random() * (H / 2);
      }
    }
    const lastGate = gates[gates.length - 1];
    if (!lastGate || lastGate.x < W - GATE_SPACING) spawnGate(W + 20);
    for (const gate of gates) gate.x -= spd * dt;
    gates = gates.filter((gate) => gate.x + GATE_W > -20);
    for (const gate of gates) {
      if (!gate.passed && gate.x + GATE_W < BIRD_X - BIRD_R) {
        gate.passed = true;
        score += 1;
        if (score > best) {
          best = score;
          saveBest();
        }
        renderScore();
      }
    }
    if (bird.y + BIRD_R >= H - GROUND_H || bird.y - BIRD_R <= 0) {
      bird.y = Math.min(Math.max(bird.y, BIRD_R), H - GROUND_H - BIRD_R);
      gameOver();
      return;
    }
    for (const gate of gates) {
      const withinX = BIRD_X + BIRD_R * 0.8 > gate.x && BIRD_X - BIRD_R * 0.8 < gate.x + GATE_W;
      if (!withinX) continue;
      if (bird.y - BIRD_R * 0.8 < gate.top || bird.y + BIRD_R * 0.8 > gate.top + gate.gap) {
        gameOver();
        return;
      }
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#101a3d");
    sky.addColorStop(0.7, "#1b2a5e");
    sky.addColorStop(1, "#0b0f1a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(224, 231, 255, 0.16)";
    for (const cloud of clouds) {
      const s = cloud.s;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 18 * s, 0, Math.PI * 2);
      ctx.arc(cloud.x + 22 * s, cloud.y - 8 * s, 14 * s, 0, Math.PI * 2);
      ctx.arc(cloud.x + 44 * s, cloud.y, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, H - GROUND_H, W, 10);
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, H - GROUND_H + 10, W, GROUND_H - 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = 8; x < W; x += 42) {
      ctx.fillRect(x, H - GROUND_H + 22, 20, 8);
    }
  }

  function drawGate(gate) {
    const capH = 22;
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(gate.x, 0, GATE_W, gate.top);
    ctx.fillRect(gate.x, gate.top + gate.gap, GATE_W, H - GROUND_H - gate.top - gate.gap);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(gate.x - 4, gate.top - capH, GATE_W + 8, capH);
    ctx.fillRect(gate.x - 4, gate.top + gate.gap, GATE_W + 8, capH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(gate.x + 8, 0, 8, gate.top - capH);
    ctx.fillRect(gate.x + 8, gate.top + gate.gap + capH, 8, H - GROUND_H - gate.top - gate.gap - capH);
  }

  function drawBird() {
    const tilt = Math.max(-0.45, Math.min(0.7, bird.vy / 900));
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(tilt);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 2, BIRD_R - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    const wingLift = bird.wing * 8;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.ellipse(-4, -2 - wingLift, 9, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(6, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0f1a";
    ctx.beginPath();
    ctx.arc(7.5, -5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 1, 1);
    ctx.lineTo(BIRD_R + 9, 4);
    ctx.lineTo(BIRD_R - 1, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function render(dt) {
    drawBackground();
    for (const gate of gates) drawGate(gate);
    if (state === "ready") {
      idle += dt;
      const bob = Math.sin(idle * 3) * 6;
      const keep = bird.y;
      bird.y = H / 2 - 40 + bob;
      drawBird();
      bird.y = keep;
      return;
    }
    drawBird();
    if (state === "running") {
      ctx.fillStyle = "rgba(242, 245, 255, 0.9)";
      ctx.font = "800 40px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(score), W / 2, 64);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running") update(dt);
    render(dt);
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
      event.preventDefault();
      if (state === "paused") togglePause();
      else flap();
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
    else flap();
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
