/* Turbo Drift — original GameHub implementation.
   Pseudo-3D arcade racer: 3 laps, curves, hills, traffic, best lap. */
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
  const lapEl = document.getElementById("lap");
  const speedEl = document.getElementById("speed");
  const timeEl = document.getElementById("time");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const touchControls = document.getElementById("touchControls");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const SEGMENTS = 240;
  const SEG_LEN = 200;
  const ROAD_W = 2100;
  const DRAW = 110;
  const CAMERA_H = 1050;
  const CAMERA_DEPTH = 0.84;
  const MAX_SPEED = SEG_LEN * 62;
  const LAPS = 3;
  const TRACK_LEN = SEGMENTS * SEG_LEN;

  let state = "ready";
  let segments = [];
  let cars = [];
  let position = 0;
  let playerX = 0;
  let speed = 0;
  let lap = 1;
  let raceTime = 0;
  let lapStart = 0;
  let lapTimes = [];
  let bestLap = loadBest();
  let keys = {};
  let touch = { left: false, right: false };
  let countdown = 0;
  let last = 0;

  function loadBest() {
    try {
      const value = parseFloat(localStorage.getItem("gh_turbo_bestlap"));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_turbo_bestlap", String(bestLap));
    } catch (err) { /* storage unavailable */ }
  }

  function fmtTime(total) {
    const minutes = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    const tenths = Math.floor((total % 1) * 10);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}.${tenths}`;
  }

  function buildTrack() {
    segments = [];
    const plan = [];
    const add = (count, curve, hill) => {
      for (let i = 0; i < count; i++) plan.push({ curve, hill });
    };
    add(30, 0, 0);
    add(24, 2.2, 0);
    add(20, 0, 30);
    add(26, -3.2, -20);
    add(22, 0, 40);
    add(28, 3.6, 0);
    add(20, 0, -30);
    add(24, -2.4, 10);
    add(26, 1.6, 0);
    while (plan.length < SEGMENTS) plan.push({ curve: 0, hill: 0 });
    let y = 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const def = plan[i % plan.length];
      const nextY = y + (def.hill || 0);
      segments.push({
        index: i,
        curve: def.curve || 0,
        y1: y,
        y2: nextY,
        side: i % 24 < 12 ? 0 : 1,
        prop: (i * 7919) % 31 === 0 ? "tree" : (i * 104729) % 47 === 0 ? "sign" : null,
        propSide: i % 2 === 0 ? -1 : 1
      });
      y = nextY;
    }
    cars = [];
    for (let i = 0; i < 14; i++) {
      cars.push({
        offset: (Math.random() - 0.5) * 1.4,
        z: Math.floor(((i + 1) / 15) * SEGMENTS) * SEG_LEN,
        speed: MAX_SPEED * (0.32 + Math.random() * 0.14),
        color: ["#fb7185", "#fbbf24", "#a78bfa", "#e2e8f0"][i % 4]
      });
    }
  }

  function renderHud() {
    if (lapEl) lapEl.textContent = `${Math.min(lap, LAPS)}/${LAPS}`;
    if (speedEl) speedEl.textContent = String(Math.round((speed / MAX_SPEED) * 248));
    if (timeEl) timeEl.textContent = fmtTime(raceTime);
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
    buildTrack();
    position = 0;
    playerX = 0;
    speed = 0;
    lap = 1;
    raceTime = 0;
    lapStart = 0;
    lapTimes = [];
    countdown = 3.2;
    state = "running";
    hideOverlay();
    renderHud();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Lap ${Math.min(lap, LAPS)} of ${LAPS} · ${fmtTime(raceTime)}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function finish() {
    state = "over";
    const best = Math.min(...lapTimes);
    const record = !bestLap || best < bestLap;
    if (record) {
      bestLap = best;
      saveBest();
    }
    showOverlay("Race complete!", `Total ${fmtTime(raceTime)} · best lap ${fmtTime(best)}.${record ? " New record!" : ""}`, "Race again");
  }

  function update(dt) {
    if (countdown > 0) {
      countdown -= dt;
      return;
    }
    raceTime += dt;
    const playerSegment = Math.floor(position / SEG_LEN) % SEGMENTS;
    const playerCurve = segments[playerSegment].curve;

    const accel = MAX_SPEED / 3.2;
    const braking = -MAX_SPEED * 1.2;
    const decel = -MAX_SPEED / 6;
    const offRoadDecel = -MAX_SPEED / 1.6;
    const offRoad = Math.abs(playerX) > 1;

    speed += accel * dt;
    if (keys.ArrowDown || keys.KeyS) speed += braking * dt;
    if (offRoad && speed > MAX_SPEED * 0.32) speed += offRoadDecel * dt;
    speed = Math.max(0, Math.min(MAX_SPEED, speed + (speed > 0 ? decel * dt * 0.15 : 0)));

    const steer = (keys.ArrowLeft || keys.KeyA || touch.left ? -1 : 0) +
      (keys.ArrowRight || keys.KeyD || touch.right ? 1 : 0);
    const dx = dt * 2.4 * (speed / MAX_SPEED);
    playerX += steer * dx;
    playerX -= dx * playerCurve * 0.42 * (speed / MAX_SPEED);
    playerX = Math.max(-2.4, Math.min(2.4, playerX));

    position += speed * dt;
    const totalLaps = Math.floor(position / TRACK_LEN) + 1;
    if (totalLaps > lap) {
      lapTimes.push(raceTime - lapStart);
      lapStart = raceTime;
      lap = totalLaps;
      if (lap > LAPS) {
        finish();
        return;
      }
    }

    for (const car of cars) {
      car.z += car.speed * dt;
      if (car.z >= TRACK_LEN) car.z -= TRACK_LEN;
      const rel = (car.z - position + TRACK_LEN) % TRACK_LEN;
      if (rel < SEG_LEN * 1.2 && rel > 0 && Math.abs(car.offset - playerX) < 0.32 && speed > car.speed) {
        speed = car.speed * 0.55;
        position = car.z - SEG_LEN * 1.4;
        if (position < 0) position += TRACK_LEN;
      }
    }
    renderHud();
  }

  function project(p, cameraX, cameraY, cameraZ) {
    let z = p.worldZ - cameraZ;
    if (z < 0) z += TRACK_LEN;
    const scale = CAMERA_DEPTH / Math.max(z, 1);
    return {
      x: W / 2 + scale * (p.worldX - cameraX) * W / 2,
      y: H / 2 - scale * (p.worldY - cameraY) * H / 2,
      w: scale * ROAD_W * W / 2,
      scale
    };
  }

  function polygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b0f1a");
    sky.addColorStop(0.55, "#241b4d");
    sky.addColorStop(0.62, "#3b2a6e");
    sky.addColorStop(0.63, "#0e1430");
    sky.addColorStop(1, "#0e1430");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.3, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244, 114, 182, 0.25)";
    ctx.beginPath();
    ctx.arc(W * 0.72, H * 0.3, 48, 0, Math.PI * 2);
    ctx.fill();

    const baseSegment = Math.floor(position / SEG_LEN) % SEGMENTS;
    const basePercent = (position % SEG_LEN) / SEG_LEN;
    const playerY = segments[baseSegment].y1 + (segments[baseSegment].y2 - segments[baseSegment].y1) * basePercent;
    let maxY = H;
    let xOffset = 0;

    const sprites = [];
    for (let n = 0; n < DRAW; n++) {
      const index = (baseSegment + n) % SEGMENTS;
      const seg = segments[index];
      const looped = index < baseSegment;
      const cameraZ = position - (looped ? TRACK_LEN : 0);
      const p1 = project({ worldX: xOffset, worldY: seg.y1, worldZ: index * SEG_LEN }, playerX * ROAD_W, CAMERA_H + playerY, cameraZ);
      const p2 = project({ worldX: xOffset + seg.curve, worldY: seg.y2, worldZ: (index + 1) * SEG_LEN }, playerX * ROAD_W, CAMERA_H + playerY, cameraZ);
      xOffset += seg.curve;

      if (p1.y >= maxY || p2.y >= maxY || p2.y <= p1.y) continue;
      const shade = seg.side === 0;
      polygon(0, p1.y, W, p1.y, W, p2.y, 0, p2.y, shade ? "#14213d" : "#101a33");
      const r1 = p1.w * 1.14;
      const r2 = p2.w * 1.14;
      polygon(p1.x - r1, p1.y, p1.x + r1, p1.y, p2.x + r2, p2.y, p2.x - r2, p2.y, shade ? "#e11d48" : "#f8fafc");
      polygon(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, shade ? "#3b4266" : "#333b5e");
      if (seg.side === 0) {
        const l1 = p1.w * 0.02;
        const l2 = p2.w * 0.02;
        polygon(p1.x - l1, p1.y, p1.x + l1, p1.y, p2.x + l2, p2.y, p2.x - l2, p2.y, "#cbd5e1");
      }
      if (seg.prop && p1.scale > 0.0004) {
        sprites.push({ seg: index, kind: seg.prop, side: seg.propSide, scale: p1.scale, y: p1.y, x: p1.x + p1.w * 1.5 * seg.propSide });
      }
      maxY = p1.y;
    }

    for (const car of cars) {
      let rel = car.z - position;
      if (rel < 0) rel += TRACK_LEN;
      if (rel > SEG_LEN * DRAW) continue;
      const scale = CAMERA_DEPTH / Math.max(rel, 1);
      const roadY = H * 0.62;
      const size = Math.max(4, scale * 9000);
      const sx = W / 2 + (car.offset - playerX) * size * 3.2;
      const sy = roadY - (rel / (SEG_LEN * DRAW)) * H * 0.28;
      if (size > 3 && sy > H * 0.3) {
        drawCar(sx, sy, size, car.color);
      }
    }

    sprites.sort((a, b) => a.scale - b.scale);
    for (const sprite of sprites) {
      const size = sprite.scale * 26000;
      if (size < 3 || size > 400) continue;
      if (sprite.kind === "tree") {
        ctx.fillStyle = "#14532d";
        ctx.beginPath();
        ctx.arc(sprite.x, sprite.y - size * 0.5, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f2a18";
        ctx.fillRect(sprite.x - size * 0.05, sprite.y - size * 0.25, size * 0.1, size * 0.25);
      } else {
        ctx.fillStyle = "#22d3ee";
        ctx.fillRect(sprite.x - size * 0.3, sprite.y - size * 0.7, size * 0.6, size * 0.35);
        ctx.fillStyle = "#0b0f1a";
        ctx.fillRect(sprite.x - size * 0.03, sprite.y - size * 0.35, size * 0.06, size * 0.35);
      }
    }

    drawCar(W / 2, H - 66, 64, "#22d3ee", true);

    if (countdown > 0 && state === "running") {
      ctx.fillStyle = "rgba(242, 245, 255, 0.95)";
      ctx.font = "800 72px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(countdown > 0.2 ? String(Math.ceil(countdown - 0.2)) : "GO!", W / 2, H / 2);
    }
    if (state === "running" && Math.abs(playerX) > 1) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      ctx.font = "700 16px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OFF ROAD", W / 2, 40);
    }
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  function drawCar(x, y, size, color, isPlayer) {
    const w = size * (isPlayer ? 1.5 : 1.1);
    const h = size * (isPlayer ? 0.75 : 0.55);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.55, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    roundRectPath(x - w / 2, y - h, w, h, Math.min(8, h * 0.25));
    ctx.fill();
    ctx.fillStyle = "rgba(11, 15, 26, 0.75)";
    roundRectPath(x - w * 0.32, y - h * 0.92, w * 0.64, h * 0.4, 4);
    ctx.fill();
    ctx.fillStyle = isPlayer ? "#fde047" : "#fecaca";
    ctx.fillRect(x - w / 2 + 3, y - h * 0.32, w * 0.2, h * 0.14);
    ctx.fillRect(x + w / 2 - 3 - w * 0.2, y - h * 0.32, w * 0.2, h * 0.14);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running") update(dt);
    render();
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
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
  if (touchControls) {
    const setAct = (act, on) => {
      if (act === "left") touch.left = on;
      if (act === "right") touch.right = on;
    };
    touchControls.addEventListener("pointerdown", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (!button) return;
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      setAct(button.getAttribute("data-act"), true);
    });
    const release = (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (button) setAct(button.getAttribute("data-act"), false);
      else {
        touch.left = false;
        touch.right = false;
      }
    };
    touchControls.addEventListener("pointerup", release);
    touchControls.addEventListener("pointerleave", release);
    touchControls.addEventListener("pointercancel", release);
  }
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  buildTrack();
  renderHud();
  requestAnimationFrame(frame);
})();
