/* Road Rush — original GameHub implementation.
   Pseudo-3D racer: chase the sunset highway and dodge the traffic. */
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
  const speedEl = document.getElementById("speed");
  const distEl = document.getElementById("dist");
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
  const SEG_LEN = 200;
  const SEG_COUNT = 1600;
  const ROAD_W = 2200;
  const CAM_HEIGHT = 1000;
  const CAM_DEPTH = 0.84;
  const DRAW_DIST = 120;
  const LANES = 3;
  const MAX_SPEED = 12000;
  const ACCEL = 2600;
  const BRAKE = -8000;
  const DECEL = -1600;
  const OFFROAD_DECEL = -9000;
  const CENTRIFUGAL = 0.32;
  const TRACK_LEN = SEG_LEN * SEG_COUNT;

  let segments = [];
  let cars = [];
  let position = 0;
  let speed = 0;
  let playerX = 0;
  let distance = 0;
  let best = loadBest();
  let state = "ready";
  let keys = { left: false, right: false, up: false, down: false };
  let last = 0;
  let shake = 0;
  let skyShift = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_road-rush"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_road-rush", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function buildTrack() {
    /* Random raw curve sections, then smoothed for flowing bends. */
    const raw = [];
    let i = 0;
    while (i < SEG_COUNT) {
      const len = 40 + Math.floor(Math.random() * 80);
      const curve = Math.random() < 0.3 ? 0 : (Math.random() * 2 - 1) * 5;
      for (let k = 0; k < len && i < SEG_COUNT; k++, i++) raw.push(curve);
    }
    segments = [];
    const SMOOTH = 24;
    for (let s = 0; s < SEG_COUNT; s++) {
      let sum = 0;
      let n = 0;
      for (let k = -SMOOTH; k <= SMOOTH; k++) {
        const idx = (s + k + SEG_COUNT) % SEG_COUNT;
        sum += raw[idx];
        n += 1;
      }
      segments.push({
        index: s,
        curve: sum / n,
        p1: { z: s * SEG_LEN, x: 0, y: 0, sx: 0, sy: 0, sw: 0, scale: 0 },
        p2: { z: (s + 1) * SEG_LEN, x: 0, y: 0, sx: 0, sy: 0, sw: 0, scale: 0 }
      });
    }
  }

  function spawnTraffic() {
    cars = [];
    for (let i = 0; i < 26; i++) {
      cars.push({
        z: Math.floor(Math.random() * TRACK_LEN),
        offset: (Math.floor(Math.random() * LANES) - 1) * 0.66,
        speed: MAX_SPEED * (0.28 + Math.random() * 0.22),
        hue: [8, 45, 160, 200, 275][Math.floor(Math.random() * 5)]
      });
    }
  }

  function findSegment(z) {
    return segments[Math.floor(((z % TRACK_LEN) + TRACK_LEN) % TRACK_LEN / SEG_LEN) % SEG_COUNT];
  }

  function project(p, camX, camZ) {
    const dz = Math.max(CAM_DEPTH, p.z - camZ);
    const scale = CAM_DEPTH / dz;
    p.scale = scale;
    p.sx = W / 2 + scale * (p.x - camX) * W / 2;
    p.sy = H * 0.42 + scale * CAM_HEIGHT * H / 2;
    p.sw = scale * ROAD_W * W / 2;
  }

  function renderHud() {
    if (speedEl) speedEl.textContent = `${Math.round((speed / MAX_SPEED) * 220)}`;
    if (distEl) distEl.textContent = `${Math.floor(distance)}m`;
    if (bestEl) bestEl.textContent = `${best}m`;
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
    buildTrack();
    spawnTraffic();
    position = 0;
    speed = MAX_SPEED * 0.4;
    playerX = 0;
    distance = 0;
    shake = 0;
    state = "running";
    hideOverlay();
    renderHud();
  }

  function endGame() {
    state = "over";
    if (Math.floor(distance) > best) {
      best = Math.floor(distance);
      saveBest();
    }
    renderHud();
    showOverlay("Crashed!", `You covered ${Math.floor(distance)}m of highway. Best: ${best}m.`, "Drive again");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `${Math.floor(distance)}m driven · best ${best}m.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function update(dt) {
    if (state !== "running") return;
    const speedPct = speed / MAX_SPEED;
    const seg = findSegment(position + CAM_DEPTH * CAM_HEIGHT);

    if (keys.left) playerX -= dt * 2.1 * speedPct;
    if (keys.right) playerX += dt * 2.1 * speedPct;
    playerX -= dt * speedPct * seg.curve * CENTRIFUGAL * 0.06;

    if (keys.up) speed += ACCEL * dt;
    else if (keys.down) speed += BRAKE * dt;
    else speed += DECEL * dt;

    const offroad = Math.abs(playerX) > 1.02;
    if (offroad) {
      speed += OFFROAD_DECEL * dt;
      shake = Math.min(shake + 0.4 * dt, 3);
      if (Math.abs(playerX) > 2.4) playerX = Math.max(-2.4, Math.min(2.4, playerX));
    }
    speed = Math.max(0, Math.min(MAX_SPEED, speed));
    playerX = Math.max(-2.4, Math.min(2.4, playerX));
    shake = Math.max(0, shake - 0.05 * dt);

    position = (position + speed * dt) % TRACK_LEN;
    distance += (speed * dt) / 90;
    if (Math.floor(distance) > best) {
      best = Math.floor(distance);
      saveBest();
    }

    const playerZ = position + CAM_DEPTH * CAM_HEIGHT;
    for (const car of cars) {
      car.z = (car.z + car.speed * dt) % TRACK_LEN;
      let dz = car.z - playerZ;
      if (dz < -TRACK_LEN / 2) dz += TRACK_LEN;
      if (dz > TRACK_LEN / 2) dz -= TRACK_LEN;
      if (Math.abs(dz) < SEG_LEN * 1.1 && Math.abs(car.offset - playerX) < 0.58) {
        endGame();
        return;
      }
    }
    skyShift = (skyShift + dt * 0.02) % 1;
    renderHud();
  }

  function drawSegment(seg, color) {
    const p1 = seg.p1;
    const p2 = seg.p2;
    const r1 = p1.sw / Math.max(6, 6 + LANES * 2);
    const r2 = p2.sw / Math.max(6, 6 + LANES * 2);
    /* Grass */
    ctx.fillStyle = color.grass;
    ctx.fillRect(0, p2.sy, W, p1.sy - p2.sy + 1);
    /* Rumble strips */
    ctx.fillStyle = color.rumble;
    ctx.beginPath();
    ctx.moveTo(p1.sx - p1.sw - r1, p1.sy);
    ctx.lineTo(p1.sx - p1.sw, p1.sy);
    ctx.lineTo(p2.sx - p2.sw, p2.sy);
    ctx.lineTo(p2.sx - p2.sw - r2, p2.sy);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p1.sx + p1.sw + r1, p1.sy);
    ctx.lineTo(p1.sx + p1.sw, p1.sy);
    ctx.lineTo(p2.sx + p2.sw, p2.sy);
    ctx.lineTo(p2.sx + p2.sw + r2, p2.sy);
    ctx.closePath();
    ctx.fill();
    /* Road */
    ctx.fillStyle = color.road;
    ctx.beginPath();
    ctx.moveTo(p1.sx - p1.sw, p1.sy);
    ctx.lineTo(p1.sx + p1.sw, p1.sy);
    ctx.lineTo(p2.sx + p2.sw, p2.sy);
    ctx.lineTo(p2.sx - p2.sw, p2.sy);
    ctx.closePath();
    ctx.fill();
    /* Lane markers */
    if (color.lane) {
      ctx.fillStyle = "#e2e8ff";
      const lw1 = p1.sw * 0.015 + 1;
      const lw2 = p2.sw * 0.015 + 0.5;
      for (let lane = 1; lane < LANES; lane++) {
        const lx1 = p1.sx - p1.sw + (2 * p1.sw * lane) / LANES;
        const lx2 = p2.sx - p2.sw + (2 * p2.sw * lane) / LANES;
        ctx.beginPath();
        ctx.moveTo(lx1 - lw1, p1.sy);
        ctx.lineTo(lx1 + lw1, p1.sy);
        ctx.lineTo(lx2 + lw2, p2.sy);
        ctx.lineTo(lx2 - lw2, p2.sy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawCarSprite(x, y, scale, hue) {
    const w = 60 * scale * 6;
    const h = 34 * scale * 6;
    if (w < 2) return;
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(x - w / 2, y - h * 0.28, w, h * 0.12);
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
    ctx.fillRect(x - w / 2, y - h, w, h * 0.82);
    ctx.fillStyle = `hsl(${hue}, 70%, 38%)`;
    ctx.fillRect(x - w / 2 + w * 0.08, y - h * 0.62, w * 0.84, h * 0.3);
    ctx.fillStyle = "rgba(251,191,36,.9)";
    ctx.fillRect(x - w / 2 + w * 0.06, y - h * 0.34, w * 0.16, h * 0.1);
    ctx.fillRect(x + w / 2 - w * 0.22, y - h * 0.34, w * 0.16, h * 0.1);
  }

  function draw() {
    /* Sky */
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    sky.addColorStop(0, "#1b1140");
    sky.addColorStop(0.55, "#7c2d6e");
    sky.addColorStop(1, "#f97316");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.45);
    /* Sun */
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(W / 2 + Math.sin(skyShift * 6) * 30, H * 0.36, 46, 0, Math.PI * 2);
    ctx.fill();
    /* Ground base */
    ctx.fillStyle = "#251a35";
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    ctx.save();
    if (shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * shake * 3, (Math.random() - 0.5) * shake * 3);
    }

    const baseSeg = findSegment(position);
    const basePercent = (position % SEG_LEN) / SEG_LEN;
    const playerSeg = findSegment(position + CAM_DEPTH * CAM_HEIGHT);
    const playerPercent = ((position + CAM_DEPTH * CAM_HEIGHT) % SEG_LEN) / SEG_LEN;
    let maxY = H;
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);

    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segments[(baseSeg.index + n) % SEG_COUNT];
      const looped = seg.index < baseSeg.index;
      const camZ = position - (looped ? TRACK_LEN : 0);
      project(seg.p1, playerX * ROAD_W - x, camZ);
      project(seg.p2, playerX * ROAD_W - x - dx, camZ);
      x += dx;
      dx += seg.curve;
      seg.clip = maxY;
      if (seg.p1.scale <= 0 || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxY) continue;
      const alt = Math.floor(seg.index / 4) % 2 === 0;
      drawSegment(seg, alt
        ? { grass: "#2b1f3d", road: "#3b3550", rumble: "#e2e8ff", lane: true }
        : { grass: "#271b38", road: "#37314b", rumble: "#fb7185", lane: false });
      maxY = seg.p2.sy;
    }

    /* Traffic, far to near. */
    for (let n = DRAW_DIST - 1; n >= 0; n--) {
      const seg = segments[(baseSeg.index + n) % SEG_COUNT];
      if (seg.p1.scale <= 0) continue;
      const looped = seg.index < baseSeg.index;
      const segDz = seg.p1.z - position + (looped ? TRACK_LEN : 0);
      for (const car of cars) {
        let dz = car.z - position;
        if (dz < -TRACK_LEN / 2) dz += TRACK_LEN;
        if (dz > TRACK_LEN / 2) dz -= TRACK_LEN;
        if (dz < segDz - SEG_LEN * 0.5 || dz >= segDz + SEG_LEN * 1.5) continue;
        if (seg.p1.sy <= seg.clip) continue;
        const percent = Math.max(0, Math.min(0.999, (dz - segDz) / SEG_LEN + 0.5));
        const scale = seg.p1.scale + (seg.p2.scale - seg.p1.scale) * percent;
        const sx = seg.p1.sx + (seg.p2.sx - seg.p1.sx) * percent;
        const sy = seg.p1.sy + (seg.p2.sy - seg.p1.sy) * percent;
        drawCarSprite(sx + scale * car.offset * ROAD_W * W / 2, sy, scale, car.hue);
      }
    }

    /* Player car */
    const bounce = 1 + Math.sin((position % SEG_LEN) / SEG_LEN * Math.PI) * 0.02;
    if (state !== "over") {
      const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      ctx.save();
      ctx.translate(W / 2 + steer * 5, H - 74);
      ctx.scale(1, bounce);
      ctx.fillStyle = "rgba(11,15,26,.55)";
      ctx.beginPath();
      ctx.ellipse(0, 34, 58, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(-44, 20);
      ctx.lineTo(44, 20);
      ctx.lineTo(34, -18);
      ctx.lineTo(-34, -18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0e7490";
      ctx.beginPath();
      ctx.moveTo(-26, -18);
      ctx.lineTo(26, -18);
      ctx.lineTo(18, -34);
      ctx.lineTo(-18, -34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fde047";
      ctx.fillRect(-40, 8, 14, 7);
      ctx.fillRect(26, 8, 14, 7);
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(-46, 18, 14, 9);
      ctx.fillRect(32, 18, 14, 9);
      ctx.restore();
    }
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05) || 0.016;
    last = now;
    update(dt);
    draw();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = true;
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.up = true;
    if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.down = true;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
    }
    if (event.key === "p" || event.key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = false;
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.up = false;
    if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.down = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const rel = (event.clientX - rect.left) / rect.width;
    keys.left = rel < 0.4;
    keys.right = rel > 0.6;
    keys.up = true;
  });
  canvas.addEventListener("pointerup", () => {
    keys.left = false;
    keys.right = false;
    keys.up = false;
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  buildTrack();
  spawnTraffic();
  renderHud();
  state = "ready";
  showOverlay("Road Rush", "Steer with the arrow keys, hold Up for speed and weave through traffic. Going off-road scrubs your speed fast.", "Start engine");
  requestAnimationFrame(frame);
})();
