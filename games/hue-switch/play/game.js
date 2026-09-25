/* Hue Switch — original GameHub implementation.
   Arcade reflex: steer the orb, match its color to each gate. */
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

  const BEST_KEY = "gh_best_hue-switch";
  const COLORS = ["#22d3ee", "#e879f9", "#fbbf24"];
  const NAMES = ["cyan", "pink", "amber"];

  let orbX = 0.5;
  let colorIndex = 0;
  let gates = [];
  let particles = [];
  let gatesPassed = 0;
  let state = "ready";
  let last = 0;
  let pulse = 0;
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

  function speed() {
    const H = canvas.height;
    return H * (0.42 + Math.min(gatesPassed * 0.012, 0.5));
  }

  function spawnGate(y) {
    const W = canvas.width;
    const gapW = Math.max(70, W * (0.3 - Math.min(gatesPassed * 0.004, 0.1)));
    gates.push({
      y,
      gapX: gapW / 2 + Math.random() * (W - gapW),
      gapW,
      color: Math.floor(Math.random() * COLORS.length),
      scored: false
    });
  }

  function reset() {
    orbX = 0.5;
    colorIndex = 0;
    gates = [];
    particles = [];
    gatesPassed = 0;
    held.left = false;
    held.right = false;
    const H = canvas.height;
    const gap = H * 0.34;
    for (let i = 0; i < 4; i++) spawnGate(-i * gap - H * 0.25);
    renderScore();
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(gatesPassed);
    if (bestEl) bestEl.textContent = String(Math.max(best, gatesPassed));
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
      showOverlay("Paused", `You cleared ${gatesPassed} gate${gatesPassed === 1 ? "" : "s"} so far.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function cycleColor() {
    colorIndex = (colorIndex + 1) % COLORS.length;
    const W = canvas.width;
    const H = canvas.height;
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: orbX * W, y: H * 0.78,
        vx: (Math.random() - 0.5) * 200,
        vy: -60 - Math.random() * 120,
        life: 0.4,
        color: COLORS[colorIndex]
      });
    }
  }

  function gameOver(reason) {
    state = "over";
    const record = gatesPassed > best;
    if (record) {
      best = gatesPassed;
      saveBest(best);
    }
    renderScore();
    showOverlay("Wrong hue!", `${reason} You cleared ${gatesPassed} gate${gatesPassed === 1 ? "" : "s"}.${record && gatesPassed > 0 ? " New best!" : ""}`, "Play again");
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    const orbY = H * 0.78;
    const orbR = Math.max(11, W * 0.032);
    if (held.left) orbX -= 0.85 * dt;
    if (held.right) orbX += 0.85 * dt;
    orbX = Math.min(Math.max(orbX, orbR / W), 1 - orbR / W);

    const v = speed();
    for (const gate of gates) gate.y += v * dt;
    gates = gates.filter((gate) => gate.y < H + 60);
    while (gates.length < 4) {
      const top = gates.reduce((min, gate) => Math.min(min, gate.y), H);
      spawnGate(top - H * 0.34);
    }

    const barH = 16;
    for (const gate of gates) {
      if (!gate.scored && gate.y - barH / 2 > orbY + orbR) {
        gate.scored = true;
        gatesPassed += 1;
        if (gatesPassed > best) {
          best = gatesPassed;
          saveBest(best);
        }
        renderScore();
      }
      if (Math.abs(gate.y - orbY) < barH / 2 + orbR - 3) {
        const inGap = Math.abs(orbX * W - gate.gapX) < gate.gapW / 2 - orbR * 0.4;
        if (!inGap) {
          gameOver("You missed the gap.");
          return;
        }
        if (gate.color !== colorIndex) {
          gameOver(`That gate needed ${NAMES[gate.color]}.`);
          return;
        }
      }
    }
  }

  function render(dt) {
    pulse += dt;
    const W = canvas.width;
    const H = canvas.height;
    const orbY = H * 0.78;
    const orbR = Math.max(11, W * 0.032);
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo((W / 5) * i + 0.5, 0);
      ctx.lineTo((W / 5) * i + 0.5, H);
      ctx.stroke();
    }
    const barH = 16;
    for (const gate of gates) {
      ctx.fillStyle = COLORS[gate.color];
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, gate.y - barH / 2, gate.gapX - gate.gapW / 2, barH);
      ctx.fillRect(gate.gapX + gate.gapW / 2, gate.y - barH / 2, W - gate.gapX - gate.gapW / 2, barH);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(gate.gapX - gate.gapW / 2, gate.y - barH / 2, gate.gapW, barH);
      ctx.globalAlpha = 1;
    }
    const glow = 12 + Math.sin(pulse / 160) * 4;
    ctx.save();
    ctx.shadowColor = COLORS[colorIndex];
    ctx.shadowBlur = glow;
    ctx.fillStyle = COLORS[colorIndex];
    ctx.beginPath();
    ctx.arc(orbX * W, orbY, orbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(orbX * W - orbR * 0.3, orbY - orbR * 0.3, orbR * 0.28, 0, Math.PI * 2);
    ctx.fill();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life * 2, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  function pressAction() {
    if (state === "ready" || state === "over") start();
    else if (state === "paused") togglePause();
    else cycleColor();
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "A" || key === "KeyA") {
      event.preventDefault();
      held.left = true;
      if (state !== "running" && state !== "paused") start();
      else if (state === "paused") togglePause();
    } else if (key === "ArrowRight" || key === "d" || key === "D" || key === "KeyD") {
      event.preventDefault();
      held.right = true;
      if (state !== "running" && state !== "paused") start();
      else if (state === "paused") togglePause();
    } else if (key === "p" || key === "P" || key === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (key === " " || key === "Enter" || key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat) pressAction();
    } else if (key === "r" || key === "R") {
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        start();
      }
    }
  }

  function onKeyUp(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "A" || key === "KeyA") held.left = false;
    else if (key === "ArrowRight" || key === "d" || key === "D" || key === "KeyD") held.right = false;
  }

  function pointToOrb(clientX) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width) {
        orbX = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      }
    } catch (err) { /* geometry unavailable */ }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (state === "running") {
      pointToOrb(event.clientX);
      cycleColor();
    } else {
      pressAction();
    }
  });
  canvas.addEventListener("touchstart", (event) => {
    if (state === "running") {
      const touch = event.changedTouches && event.changedTouches[0];
      if (touch) pointToOrb(touch.clientX);
      cycleColor();
    } else {
      pressAction();
    }
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
  showOverlay("Hue Switch", "Cycle your color and fly through gates that match your glow.", "Start game");
  requestAnimationFrame(frame);
})();
