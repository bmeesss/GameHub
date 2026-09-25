/* Rocket Landing — original GameHub implementation.
   Lunar-lander style descent: limited fuel, gravity, rotation and
   a landing pad that must be hit slow, upright and on target. */
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
  const fuelEl = document.getElementById("fuel");
  const padEl = document.getElementById("pad");
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
  const BEST_KEY = "gh_best_rocket-landing";
  const GRAVITY = 0.055;
  const THRUST = 0.16;
  const SAFE_SPEED = 1.9;
  const SAFE_ANGLE = 0.28;

  let lander = { x: W / 2, y: 70, vx: 0, vy: 0, angle: 0 };
  let fuel = 100;
  let pad = { x: W / 2, w: 110 };
  let score = 0;
  let level = 1;
  let best = readNumber(BEST_KEY);
  let state = "idle";
  let paused = false;
  let thrusting = false;
  let rotating = 0;
  let landedTimer = 0;
  let message = "Land on the pad";
  let stars = [];

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
    if (fuelEl) fuelEl.textContent = String(Math.max(0, Math.round(fuel)));
    if (padEl) padEl.textContent = String(level);
    if (bestEl) bestEl.textContent = String(best);
  }

  function makeStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * (H - 90), r: Math.random() * 1.7 + 0.3 });
    }
  }

  function reset(keepScore) {
    lander = { x: W / 2 + (Math.random() - 0.5) * 120, y: 60, vx: (Math.random() - 0.5) * 0.9, vy: 0.2, angle: 0 };
    fuel = Math.max(55, 100 - (level - 1) * 6);
    pad = { x: 70 + Math.random() * (W - 140), w: Math.max(64, 120 - level * 5) };
    if (!keepScore) score = 0;
    lander.y = 60;
    landedTimer = 0;
    state = "playing";
    paused = false;
    message = "Land on the pad";
    hideOverlay();
    refreshHud();
  }

  function land() {
    const speed = Math.hypot(lander.vx, lander.vy);
    const angle = Math.abs(((lander.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const tilt = Math.min(angle, Math.PI * 2 - angle);
    const onPad = Math.abs(lander.x - pad.x) < pad.w / 2;
    if (!onPad) {
      fail("You missed the landing pad.");
      return;
    }
    if (speed > SAFE_SPEED || tilt > SAFE_ANGLE) {
      fail(speed > SAFE_SPEED ? "Touchdown was too fast." : "You came in tilted.");
      return;
    }
    const bonus = Math.round(60 - speed * 12 + fuel * 1.4 + level * 8);
    score += Math.max(10, bonus);
    level++;
    if (score > best) {
      best = score;
      writeNumber(BEST_KEY, best);
    }
    state = "landed";
    refreshHud();
    showOverlay("Touchdown!", "Perfect landing with " + Math.round(fuel) + " fuel left — +" + Math.max(10, bonus) + " points. Pad " + level + " is smaller and the fuel tighter.", "Next pad", true);
  }

  function fail(reason) {
    state = "over";
    if (score > best) {
      best = score;
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
    showOverlay("Crash landing", reason + " Final score: " + score + ".", "Try again", true);
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    const step = dt / 16.7;
    if (thrusting && fuel > 0) {
      lander.vx += Math.sin(lander.angle) * THRUST * step;
      lander.vy -= Math.cos(lander.angle) * THRUST * step;
      fuel = Math.max(0, fuel - 0.32 * step);
    }
    lander.angle += rotating * 0.045 * step;
    lander.vy += GRAVITY * step;
    lander.x += lander.vx * step;
    lander.y += lander.vy * step;
    if (lander.x < 16) { lander.x = 16; lander.vx = Math.abs(lander.vx) * 0.4; }
    if (lander.x > W - 16) { lander.x = W - 16; lander.vx = -Math.abs(lander.vx) * 0.4; }
    if (lander.y < 14) { lander.y = 14; lander.vy = Math.max(0, lander.vy); }
    if (lander.y > H - 40) {
      lander.y = H - 40;
      land();
      return;
    }
    refreshHud();
  }

  function draw() {
    ctx.fillStyle = "#070b18";
    ctx.fillRect(0, 0, W, H);
    for (const star of stars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
      ctx.fill();
    }
    ctx.fillStyle = "#1b2340";
    ctx.fillRect(0, H - 34, W, 34);
    ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
    ctx.fillRect(pad.x - pad.w / 2, H - 38, pad.w, 6);
    ctx.fillStyle = "rgba(52, 211, 153, 0.22)";
    ctx.fillRect(pad.x - pad.w / 2, H - 44, pad.w, 8);
    /* lander */
    ctx.save();
    ctx.translate(lander.x, lander.y);
    ctx.rotate(lander.angle);
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(11, 10);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7c5cff";
    ctx.fillRect(-11, 8, 22, 4);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(-13, 22);
    ctx.moveTo(9, 12);
    ctx.lineTo(13, 22);
    ctx.stroke();
    if (thrusting && fuel > 0) {
      ctx.beginPath();
      ctx.moveTo(-6, 13);
      ctx.lineTo(0, 13 + 18 + Math.random() * 10);
      ctx.lineTo(6, 13);
      ctx.closePath();
      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      ctx.fill();
    }
    ctx.restore();
    /* instruments */
    ctx.fillStyle = "rgba(242, 245, 255, 0.75)";
    ctx.font = "13px sans-serif";
    ctx.fillText("Speed " + Math.hypot(lander.vx, lander.vy).toFixed(1) + " · Fuel " + Math.round(fuel) + " · " + message, 14, 22);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  const KEY_DIRS = {
    ArrowLeft: -1, ArrowRight: 1, a: -1, d: 1, A: -1, D: 1
  };

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === "ArrowUp" || key.toLowerCase() === "w" || key === " ") {
      event.preventDefault();
      thrusting = true;
      return;
    }
    if (KEY_DIRS[key] !== undefined) {
      event.preventDefault();
      rotating = KEY_DIRS[key];
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    const key = String(event.key || "");
    if (key === "ArrowUp" || key.toLowerCase() === "w" || key === " ") thrusting = false;
    if (KEY_DIRS[key] !== undefined) rotating = 0;
  });

  canvas.addEventListener("pointerdown", () => { thrusting = true; });
  canvas.addEventListener("pointerup", () => { thrusting = false; });
  canvas.addEventListener("pointerleave", () => { thrusting = false; });
  canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    thrusting = true;
  }, { passive: false });
  canvas.addEventListener("touchend", () => { thrusting = false; });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    thrusting = false;
    if (paused) showOverlay("Paused", "Mid-descent, holding perfectly still.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    if (state === "landed") {
      reset(true);
      return;
    }
    level = 1;
    reset(false);
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  makeStars();
  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void landedTimer;
})();
