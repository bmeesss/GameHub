/* Highway Escape — original GameHub implementation.
   Lane-weaving racer: dodge traffic, grab fuel, escape. */
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

  const BEST_KEY = "gh_best_highway-escape";
  const LANES = 3;
  const TRAFFIC_COLORS = ["#fb7185", "#fbbf24", "#a78bfa", "#94a3b8"];

  let lane = 1;
  let carX = 1;
  let distance = 0;
  let fuel = 100;
  let traffic = [];
  let pickups = [];
  let spawnAcc = 0;
  let fuelAcc = 0;
  let roadOffset = 0;
  let state = "ready";
  let last = 0;

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

  function roadGeom() {
    const W = canvas.width;
    const margin = W * 0.08;
    const roadW = W - margin * 2;
    return { margin, roadW, laneW: roadW / LANES };
  }

  function laneCenter(i) {
    const { margin, laneW } = roadGeom();
    return margin + laneW * (i + 0.5);
  }

  function speed() {
    const H = canvas.height;
    return H * (0.55 + Math.min(distance * 0.00012, 0.65));
  }

  function reset() {
    lane = 1;
    carX = laneCenter(1);
    distance = 0;
    fuel = 100;
    traffic = [];
    pickups = [];
    spawnAcc = 0;
    fuelAcc = 0;
    roadOffset = 0;
    renderScore();
  }

  function renderScore() {
    const meters = Math.floor(distance);
    if (scoreEl) scoreEl.textContent = `${meters} m`;
    if (bestEl) bestEl.textContent = `${Math.max(best, meters)} m`;
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
      showOverlay("Paused", `${Math.floor(distance)} meters down the highway.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver(reason) {
    state = "over";
    const meters = Math.floor(distance);
    const record = meters > best;
    if (record) {
      best = meters;
      saveBest(best);
    }
    renderScore();
    showOverlay("Busted!", `${reason} You escaped ${meters} meters.${record && meters > 0 ? " New best!" : ""}`, "Play again");
  }

  function moveLane(dir) {
    lane = Math.min(LANES - 1, Math.max(0, lane + dir));
  }

  function spawnTraffic() {
    const H = canvas.height;
    const { laneW } = roadGeom();
    const carLane = Math.floor(Math.random() * LANES);
    /* Never block every lane at once: skip if siblings are crowded. */
    const nearTop = traffic.filter((t) => t.y < H * 0.25).map((t) => t.lane);
    if (nearTop.includes(carLane)) return;
    traffic.push({
      lane: carLane,
      y: -H * 0.12,
      w: laneW * 0.62,
      h: H * 0.1,
      color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
      wobble: Math.random() * Math.PI * 2
    });
  }

  function spawnFuel() {
    const H = canvas.height;
    pickups.push({
      lane: Math.floor(Math.random() * LANES),
      y: -H * 0.08,
      taken: false
    });
  }

  function update(dt) {
    const W = canvas.width;
    const H = canvas.height;
    const v = speed();
    roadOffset = (roadOffset + v * dt) % (H * 0.12);
    distance += v * dt * 0.06;
    fuel -= dt * (2.6 + Math.min(distance * 0.0006, 2.2));
    if (fuel <= 0) {
      fuel = 0;
      gameOver("You ran out of fuel.");
      return;
    }

    carX += (laneCenter(lane) - carX) * Math.min(1, dt * 10);
    const playerY = H * 0.82;
    const playerW = roadGeom().laneW * 0.62;
    const playerH = H * 0.1;

    spawnAcc += dt;
    const interval = Math.max(0.42, 0.95 - distance * 0.00012);
    while (spawnAcc >= interval) {
      spawnAcc -= interval;
      spawnTraffic();
    }
    fuelAcc += dt;
    if (fuelAcc > 4.5) {
      fuelAcc = 0;
      spawnFuel();
    }

    for (const t of traffic) {
      t.y += v * dt * 0.62;
      t.wobble += dt * 2;
    }
    traffic = traffic.filter((t) => t.y < H + H * 0.14);
    for (const p of pickups) p.y += v * dt * 0.62;
    pickups = pickups.filter((p) => p.y < H + 40 && !p.taken);

    for (const t of traffic) {
      const tx = laneCenter(t.lane) + Math.sin(t.wobble) * 3;
      const overlapX = Math.abs(tx - carX) < (t.w + playerW) / 2 - 8;
      const overlapY = Math.abs(t.y - playerY) < (t.h + playerH) / 2 - 8;
      if (overlapX && overlapY) {
        gameOver("You slammed into traffic.");
        return;
      }
    }
    for (const p of pickups) {
      const px = laneCenter(p.lane);
      if (Math.abs(px - carX) < roadGeom().laneW * 0.5 && Math.abs(p.y - playerY) < playerH) {
        p.taken = true;
        fuel = Math.min(100, fuel + 30);
      }
    }
    const meters = Math.floor(distance);
    if (meters > best) {
      best = meters;
      saveBest(best);
    }
    renderScore();
  }

  function drawCar(x, y, w, h, color, windshield) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = windshield;
    ctx.fillRect(x - w / 2 + 5, y - h * 0.28, w - 10, h * 0.22);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x - w / 2 + 4, y + h / 2 - 5, 8, 4);
    ctx.fillRect(x + w / 2 - 12, y + h / 2 - 5, 8, 4);
  }

  function render() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#07130c";
    ctx.fillRect(0, 0, W, H);
    const { margin, roadW, laneW } = roadGeom();
    ctx.fillStyle = "#1c2333";
    ctx.fillRect(margin, 0, roadW, H);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(margin - 4, 0, 4, H);
    ctx.fillRect(margin + roadW, 0, 4, H);
    ctx.fillStyle = "rgba(242, 245, 255, 0.55)";
    const dashH = H * 0.05;
    const gap = H * 0.12;
    for (let i = 1; i < LANES; i++) {
      const x = margin + laneW * i;
      for (let y = -gap + roadOffset; y < H + gap; y += gap) {
        ctx.fillRect(x - 2, y, 4, dashH);
      }
    }
    for (const p of pickups) {
      const px = laneCenter(p.lane);
      ctx.fillStyle = "#052e16";
      ctx.fillRect(px - 13, p.y - 15, 26, 30);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(px - 10, p.y - 12, 20, 24);
      ctx.fillStyle = "#052e16";
      ctx.font = "800 16px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("F", px, p.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    for (const t of traffic) {
      const tx = laneCenter(t.lane) + Math.sin(t.wobble) * 3;
      drawCar(tx, t.y, t.w, t.h, t.color, "#0b0f1a");
    }
    drawCar(carX, H * 0.82, laneW * 0.62, H * 0.1, "#22d3ee", "#083344");
    ctx.fillStyle = "rgba(5, 7, 15, 0.7)";
    ctx.fillRect(margin + 8, 10, 120, 16);
    ctx.fillStyle = fuel > 30 ? "#4ade80" : "#fb7185";
    ctx.fillRect(margin + 10, 12, 116 * (fuel / 100), 12);
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 11px Inter, Arial, sans-serif";
    ctx.fillText("FUEL", margin + 10, 40);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === "running") update(dt);
    render();
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function ensureRunning() {
    if (state === "ready" || state === "over") start();
    else if (state === "paused") togglePause();
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a" || key === "KeyA") {
      event.preventDefault();
      ensureRunning();
      if (state === "running" && !event.repeat) moveLane(-1);
    } else if (key === "ArrowRight" || key === "d" || key === "KeyD") {
      event.preventDefault();
      ensureRunning();
      if (state === "running" && !event.repeat) moveLane(1);
    } else if (key === "ArrowUp" || key === "ArrowDown" || key === "w" || key === "s") {
      event.preventDefault();
      ensureRunning();
    } else if (key === "p" || key === "P" || key === "Escape") {
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

  function tapSide(clientX) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width) {
        ensureRunning();
        if (state === "running") moveLane(clientX - rect.left < rect.width / 2 ? -1 : 1);
      }
    } catch (err) { /* geometry unavailable */ }
  }

  canvas.addEventListener("pointerdown", (event) => tapSide(event.clientX));
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) tapSide(touch.clientX);
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
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
  showOverlay("Highway Escape", "Dodge traffic, grab fuel and see how far down the highway you get.", "Start game");
  requestAnimationFrame(frame);
})();
