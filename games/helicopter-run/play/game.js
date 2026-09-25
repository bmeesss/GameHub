/* Helicopter Run — original GameHub implementation.
   One-button cave flight: hold to climb, release to dive. The
   tunnel narrows and speeds up with distance. */
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
  const speedEl = document.getElementById("speed");
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
  const BEST_KEY = "gh_best_helicopter-run";
  const GRAVITY = 0.42;
  const LIFT = -0.62;
  const MAX_VY = 6.4;

  let heli = { x: 150, y: H / 2, vy: 0, rotor: 0 };
  let distance = 0;
  let best = readNumber(BEST_KEY);
  let gapHalf = 92;
  let travel = 0;
  let ceiling = [];
  let state = "idle";
  let paused = false;
  let holding = false;
  let crashed = false;
  let crashTimer = 0;

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
    if (scoreEl) scoreEl.textContent = String(Math.floor(distance));
    if (speedEl) speedEl.textContent = (1 + distance / 900).toFixed(1) + "x";
    if (bestEl) bestEl.textContent = String(best);
  }

  function terrainAt(x) {
    const index = Math.max(0, Math.min(ceiling.length - 1, Math.round(x / 14)));
    return ceiling[index] !== undefined ? ceiling[index] : H / 2;
  }

  function buildTerrain() {
    ceiling = [];
    const points = Math.ceil(W / 14) + 40;
    let value = H * 0.4;
    for (let i = 0; i < points; i++) {
      value += (Math.random() - 0.5) * 16;
      value = Math.max(70, Math.min(H - 160, value));
      ceiling.push(value);
    }
  }

  function tunnelGap() {
    return Math.max(52, gapHalf - distance * 0.02);
  }

  function reset() {
    heli = { x: 150, y: H / 2, vy: 0, rotor: 0 };
    distance = 0;
    gapHalf = 92;
    travel = 0;
    crashed = false;
    crashTimer = 0;
    buildTerrain();
    state = "playing";
    paused = false;
    hideOverlay();
    refreshHud();
  }

  function crash() {
    if (crashed) return;
    crashed = true;
    crashTimer = 0;
    if (distance > best) {
      best = Math.floor(distance);
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    heli.rotor += 0.6;
    if (crashed) {
      crashTimer += dt;
      heli.vy = Math.min(MAX_VY, heli.vy + GRAVITY);
      heli.y += heli.vy;
      if (heli.y > H - 20) heli.y = H - 20;
      if (crashTimer > 700) {
        state = "over";
        showOverlay("Crashed", "You flew " + Math.floor(distance) + " metres. Local best: " + best + " m.", "Fly again", true);
      }
      return;
    }
    heli.vy += holding ? LIFT : GRAVITY;
    heli.vy = Math.max(-6, Math.min(MAX_VY, heli.vy));
    heli.y += heli.vy;
    travel += 5.6 + distance / 90;
    distance += 0.6 + distance / 260;
    /* Scroll the tunnel: shift terrain left as we travel. */
    const shift = Math.floor(travel / 14);
    travel -= shift * 14;
    for (let i = 0; i < shift; i++) {
      ceiling.shift();
      let last = ceiling[ceiling.length - 1] || H * 0.4;
      last += (Math.random() - 0.5) * 18;
      last = Math.max(70, Math.min(H - 160, last));
      ceiling.push(last);
    }
    const roof = terrainAt(heli.x);
    const floor = roof + tunnelGap() * 2;
    if (heli.y < roof + 12 || heli.y > floor - 12) crash();
    if (Math.random() < 0.02) refreshHud();
  }

  /* ---------------- Rendering ---------------- */
  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 14) ctx.lineTo(x, terrainAt(x));
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fillStyle = "#1d2749";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 14) ctx.lineTo(x, terrainAt(x) + tunnelGap() * 2);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = "#1d2749";
    ctx.fill();
    ctx.fillStyle = "rgba(34, 211, 238, 0.16)";
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    /* Helicopter body */
    ctx.fillStyle = crashed ? "#fb7185" : "#e2e8f0";
    ctx.fillRect(heli.x - 18, heli.y - 9, 32, 15);
    ctx.fillRect(heli.x + 12, heli.y - 4, 22, 7);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(heli.x - 26, heli.y - 18);
    ctx.lineTo(heli.x + 8, heli.y - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(heli.x, heli.y - 18);
    ctx.lineTo(heli.x + Math.cos(heli.rotor) * 34, heli.y - 18 + Math.sin(heli.rotor) * 5);
    ctx.moveTo(heli.x, heli.y - 18);
    ctx.lineTo(heli.x - Math.cos(heli.rotor) * 34, heli.y - 18 - Math.sin(heli.rotor) * 5);
    ctx.stroke();
    ctx.fillStyle = "rgba(242, 245, 255, 0.75)";
    ctx.font = "13px sans-serif";
    ctx.fillText(Math.floor(distance) + " m", 14, 22);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function press() {
    if (state === "idle" || state === "over") return;
    holding = true;
  }

  function release() {
    holding = false;
  }

  canvas.addEventListener("pointerdown", press);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointerleave", release);
  canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    press();
  }, { passive: false });
  canvas.addEventListener("touchend", release);

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === " " || key === "ArrowUp" || key.toLowerCase() === "w") {
      event.preventDefault();
      press();
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    const key = String(event.key || "");
    if (key === " " || key === "ArrowUp" || key.toLowerCase() === "w") release();
  });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    holding = false;
    if (paused) showOverlay("Paused", "The rotor is idling — the cave waits.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    reset();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  buildTerrain();
  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
