/* Snowboard Rush — original GameHub implementation.
   Endless downhill run: carve left and right, thread the gates for
   a boost and avoid the pines. Distance is the score. */
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
  const gatesEl = document.getElementById("gates");
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
  const BEST_KEY = "gh_best_snowboard-rush";

  let rider = { x: W / 2, tilt: 0 };
  let objects = [];
  let distance = 0;
  let gates = 0;
  let speed = 3.2;
  let best = readNumber(BEST_KEY);
  let steer = 0;
  let keys = {};
  let state = "idle";
  let paused = false;
  let crashed = false;
  let crashTimer = 0;
  let spawnTimer = 0;

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
    if (speedEl) speedEl.textContent = (speed / 3.2).toFixed(1) + "x";
    if (gatesEl) gatesEl.textContent = String(gates);
    if (bestEl) bestEl.textContent = String(best);
  }

  function spawn() {
    const roll = Math.random();
    const x = 40 + Math.random() * (W - 80);
    if (roll < 0.34) {
      const width = 90 + Math.random() * 60;
      objects.push({ type: "gate", x: x, y: -40, width: width, passed: false });
    } else {
      const cluster = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cluster; i++) {
        objects.push({ type: "tree", x: Math.max(20, Math.min(W - 20, x + i * 34 - 34)), y: -40 - i * 66, r: 15 });
      }
    }
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
    const step = dt / 16.7;
    if (crashed) {
      crashTimer += dt;
      if (crashTimer > 700) {
        state = "over";
        showOverlay("Run over", "You carved " + Math.floor(distance) + " m through " + gates + " gates. Local best: " + best + " m.", "Ride again", true);
      }
      return;
    }
    speed = Math.min(11, speed + 0.0016 * step);
    if (keys.ArrowLeft || keys.a || keys.A) steer = -1;
    else if (keys.ArrowRight || keys.d || keys.D) steer = 1;
    else steer *= 0.86;
    rider.tilt += (steer - rider.tilt) * 0.18;
    rider.x += rider.tilt * 6 * step;
    rider.x = Math.max(24, Math.min(W - 24, rider.x));

    distance += (speed / 3.2) * step;
    spawnTimer += dt;
    if (spawnTimer > Math.max(320, 760 - distance * 0.35)) {
      spawnTimer = 0;
      spawn();
    }
    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];
      object.y += speed * 1.6 * step;
      if (object.y > H + 60) {
        objects.splice(i, 1);
        continue;
      }
      if (object.type === "gate") {
        const near = Math.abs(object.y + 20 - H * 0.72);
        if (!object.passed && near < 40 && Math.abs(object.x - rider.x) < object.width / 2) {
          object.passed = true;
          gates++;
          speed = Math.min(11, speed + 0.22);
          refreshHud();
        }
        if (object.y > H * 0.72 && object.y < H * 0.72 + 60 && Math.abs(object.x - rider.x) > object.width / 2) {
          speed = Math.max(2.2, speed - 0.25);
        }
      } else if (Math.hypot(object.x - rider.x, object.y - (H * 0.72)) < object.r + 12) {
        crash();
      }
    }
    refreshHud();
  }

  function draw() {
    ctx.fillStyle = "#0e1a2f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8f1ff";
    ctx.fillRect(0, 0, W, H);
    /* piste stripes */
    for (let y = -60; y < H; y += 90) {
      const offset = (distance * 12) % 90;
      ctx.fillStyle = "rgba(147, 197, 253, 0.25)";
      ctx.fillRect(W * 0.18, y + offset, 6, 46);
      ctx.fillRect(W * 0.82, y + offset, 6, 46);
    }
    for (const object of objects) {
      if (object.type === "gate") {
        ctx.fillStyle = object.passed ? "#22c55e" : "#f97316";
        ctx.fillRect(object.x - object.width / 2, object.y, 8, 26);
        ctx.fillRect(object.x + object.width / 2 - 8, object.y, 8, 26);
        ctx.fillStyle = object.passed ? "rgba(34, 197, 94, 0.5)" : "rgba(249, 115, 22, 0.55)";
        ctx.fillRect(object.x - object.width / 2, object.y + 8, object.width, 10);
      } else {
        ctx.fillStyle = "#166534";
        ctx.beginPath();
        ctx.moveTo(object.x, object.y - 22);
        ctx.lineTo(object.x + 16, object.y + 14);
        ctx.lineTo(object.x - 16, object.y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#78350f";
        ctx.fillRect(object.x - 4, object.y + 10, 8, 14);
      }
    }
    /* rider */
    ctx.save();
    ctx.translate(rider.x, H * 0.72);
    ctx.rotate(rider.tilt * 0.4);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-18, 12, 36, 7);
    ctx.fillStyle = crashed ? "#fb7185" : "#7c5cff";
    ctx.fillRect(-9, -18, 18, 30);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(0, -22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(Math.floor(distance) + " m", 16, 30);
    ctx.fillText(gates + " gates", 16, 52);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    rider = { x: W / 2, tilt: 0 };
    objects = [];
    distance = 0;
    gates = 0;
    speed = 3.2;
    steer = 0;
    crashed = false;
    crashTimer = 0;
    spawnTimer = 0;
    state = "playing";
    paused = false;
    hideOverlay();
    refreshHud();
  }

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (["ArrowLeft", "ArrowRight"].indexOf(key) !== -1) event.preventDefault();
    keys[key] = true;
    if (key.toLowerCase() === "p") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    keys[String(event.key || "")] = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing" || paused) return;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    const x = ((event.clientX || 0) - rect.left) * (W / (rect.width || W));
    steer = x < rider.x ? -1 : 1;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (state !== "playing" || paused) return;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    const x = ((event.clientX || 0) - rect.left) * (W / (rect.width || W));
    steer = Math.max(-1, Math.min(1, (x - rider.x) / 60));
  });
  canvas.addEventListener("pointerup", () => { steer = 0; });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "Powder settles. Your run is on hold.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    start();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
