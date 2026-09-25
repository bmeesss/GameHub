/* Mini Golf — original GameHub implementation.
   Physics putting: 6 holes with walls, sand and movers. */
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
  const holeEl = document.getElementById("hole");
  const strokesEl = document.getElementById("strokes");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const BEST_KEY = "gh_best_mini-golf";
  const MAX_STROKES = 10;
  const HOLES = [
    { start: [0.15, 0.8], cup: [0.82, 0.2], walls: [], sand: [], mover: null },
    { start: [0.15, 0.8], cup: [0.82, 0.2], walls: [[0.42, 0.05, 0.06, 0.6]], sand: [], mover: null },
    { start: [0.12, 0.5], cup: [0.85, 0.5], walls: [], sand: [[0.38, 0.3, 0.24, 0.4]], mover: null },
    { start: [0.12, 0.85], cup: [0.85, 0.12], walls: [[0.3, 0.35, 0.55, 0.07], [0.3, 0.35, 0.07, 0.5]], sand: [], mover: null },
    { start: [0.12, 0.5], cup: [0.85, 0.5], walls: [], sand: [], mover: { x: 0.42, y: 0.2, w: 0.06, h: 0.3, dx: 0, dy: 0.28, period: 2.6 } },
    { start: [0.12, 0.85], cup: [0.88, 0.12], walls: [[0.45, 0.0, 0.06, 0.55]], sand: [[0.6, 0.6, 0.28, 0.28]], mover: { x: 0.15, y: 0.42, w: 0.2, h: 0.06, dx: 0.35, dy: 0, period: 3.2 } }
  ];

  let hole = 0;
  let strokes = 0;
  let total = 0;
  let ball = { x: 0.15, y: 0.8, vx: 0, vy: 0 };
  let shotStart = { x: 0.15, y: 0.8 };
  let aiming = null;
  let keyAim = 0;
  let keyPower = 0;
  let charging = false;
  let moverT = 0;
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

  function holeDef() {
    return HOLES[hole];
  }

  function moverRect(def, t) {
    if (!def.mover) return null;
    const m = def.mover;
    const phase = (Math.sin((t / m.period) * Math.PI * 2) + 1) / 2;
    return [m.x + m.dx * phase, m.y + m.dy * phase, m.w, m.h];
  }

  function allWalls(def, t) {
    const walls = def.walls.slice();
    const mover = moverRect(def, t);
    if (mover) walls.push(mover);
    return walls;
  }

  function loadHole(index) {
    hole = index;
    const def = holeDef();
    ball = { x: def.start[0], y: def.start[1], vx: 0, vy: 0 };
    shotStart = { x: ball.x, y: ball.y };
    strokes = 0;
    aiming = null;
    moverT = 0;
    renderHud();
  }

  function renderHud() {
    if (holeEl) holeEl.textContent = `${hole + 1}/${HOLES.length}`;
    if (strokesEl) strokesEl.textContent = String(strokes);
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
    hole = 0;
    total = 0;
    loadHole(0);
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Hole ${hole + 1} · ${strokes} stroke${strokes === 1 ? "" : "s"}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function ballMoving() {
    return Math.hypot(ball.vx, ball.vy) > 0.02;
  }

  function shoot(vx, vy) {
    if (state !== "running" || ballMoving()) return;
    shotStart = { x: ball.x, y: ball.y };
    ball.vx = vx;
    ball.vy = vy;
    strokes += 1;
    renderHud();
  }

  function holeComplete() {
    total += Math.min(strokes, MAX_STROKES);
    if (hole + 1 >= HOLES.length) {
      state = "over";
      const record = best <= 0 || total < best;
      if (record) {
        best = total;
        saveBest(best);
      }
      showOverlay("Round complete!", `You finished 6 holes in ${total} strokes.${record ? " New best total!" : ` Best: ${best}.`}`, "Play again");
    } else {
      state = "clear";
      showOverlay(`Hole ${hole + 1} done!`, `${strokes} stroke${strokes === 1 ? "" : "s"} · total ${total}.`, "Next hole");
    }
  }

  function nextHole() {
    loadHole(hole + 1);
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function collideWalls() {
    const def = holeDef();
    const r = 0.022;
    for (const [wx, wy, ww, wh] of allWalls(def, moverT)) {
      const cx = Math.min(Math.max(ball.x, wx), wx + ww);
      const cy = Math.min(Math.max(ball.y, wy), wy + wh);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < r) {
        let nx = dx;
        let ny = dy;
        if (dist < 0.0001) {
          const left = Math.abs(ball.x - wx);
          const right = Math.abs(wx + ww - ball.x);
          const top = Math.abs(ball.y - wy);
          const bottom = Math.abs(wy + wh - ball.y);
          const min = Math.min(left, right, top, bottom);
          nx = min === left ? -1 : min === right ? 1 : 0;
          ny = min === top ? -1 : min === bottom ? 1 : 0;
        } else {
          nx /= dist;
          ny /= dist;
        }
        ball.x = cx + nx * r;
        ball.y = cy + ny * r;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 1.75 * dot * nx;
          ball.vy -= 1.75 * dot * ny;
          ball.vx *= 0.82;
          ball.vy *= 0.82;
        }
      }
    }
  }

  function inSand() {
    for (const [sx, sy, sw, sh] of holeDef().sand) {
      if (ball.x > sx && ball.x < sx + sw && ball.y > sy && ball.y < sy + sh) return true;
    }
    return false;
  }

  function update(dt) {
    moverT += dt;
    if (!ballMoving()) return;
    const friction = inSand() ? 2.6 : 0.55;
    const damp = Math.max(0, 1 - friction * dt);
    ball.vx *= damp;
    ball.vy *= damp;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < 0.015 || ball.x > 0.985 || ball.y < 0.015 || ball.y > 0.985) {
      ball.x = shotStart.x;
      ball.y = shotStart.y;
      ball.vx = 0;
      ball.vy = 0;
      strokes += 1;
      renderHud();
      return;
    }
    collideWalls();
    const def = holeDef();
    const cupDx = ball.x - def.cup[0];
    const cupDy = ball.y - def.cup[1];
    const speed = Math.hypot(ball.vx, ball.vy);
    if (Math.hypot(cupDx, cupDy) < 0.032 && speed < 0.55) {
      ball.vx = 0;
      ball.vy = 0;
      if (strokes >= MAX_STROKES) {
        strokes = MAX_STROKES;
        renderHud();
      }
      holeComplete();
      return;
    }
    if (Math.hypot(ball.vx, ball.vy) <= 0.02) {
      ball.vx = 0;
      ball.vy = 0;
      if (strokes >= MAX_STROKES) holeComplete();
    }
  }

  function render() {
    const W = canvas.width;
    const H = canvas.height;
    const def = holeDef();
    ctx.fillStyle = "#0d2818";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#14532d";
    ctx.fillRect(W * 0.03, H * 0.03, W * 0.94, H * 0.94);
    for (const [sx, sy, sw, sh] of def.sand) {
      ctx.fillStyle = "#a16207";
      ctx.fillRect(sx * W, sy * H, sw * W, sh * H);
    }
    for (const [wx, wy, ww, wh] of allWalls(def, moverT)) {
      ctx.fillStyle = "#2a3560";
      ctx.fillRect(wx * W, wy * H, ww * W, wh * H);
      ctx.fillStyle = "rgba(124, 92, 255, 0.4)";
      ctx.fillRect(wx * W, wy * H, ww * W, 3);
    }
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.arc(def.cup[0] * W, def.cup[1] * H, W * 0.028, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(def.cup[0] * W, def.cup[1] * H);
    ctx.lineTo(def.cup[0] * W, def.cup[1] * H - 34);
    ctx.stroke();
    ctx.fillStyle = "#fb7185";
    ctx.fillRect(def.cup[0] * W, def.cup[1] * H - 34, 18, 11);
    if (aiming && state === "running" && !ballMoving()) {
      const dx = aiming.x - ball.x;
      const dy = aiming.y - ball.y;
      const power = Math.min(Math.hypot(dx, dy), 0.5);
      if (power > 0.02) {
        const len = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(ball.x * W, ball.y * H);
        ctx.lineTo((ball.x - (dx / len) * power * 0.8) * W, (ball.y - (dy / len) * power * 0.8) * H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(5, 7, 15, 0.7)";
        ctx.fillRect(W * 0.06, H * 0.94, W * 0.4, 10);
        ctx.fillStyle = power > 0.35 ? "#fb7185" : "#4ade80";
        ctx.fillRect(W * 0.06, H * 0.94, W * 0.4 * (power / 0.5), 10);
      }
    }
    ctx.save();
    ctx.shadowColor = "#f8fafc";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ball.x * W, ball.y * H, W * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 12px Inter, Arial, sans-serif";
    ctx.fillText(`Total: ${total}`, W * 0.06, 22);
    if (best > 0) ctx.fillText(`Best: ${best}`, W * 0.06, 38);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state === "running") {
      if (charging) keyPower = Math.min(0.5, keyPower + dt * 0.5);
      update(dt);
    }
    render();
  }

  function keyOf(event) {
    if (event.key) return event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return String(event.code || "");
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a") {
      event.preventDefault();
      ensureRunning();
      keyAim -= 0.08;
    } else if (key === "ArrowRight" || key === "d") {
      event.preventDefault();
      ensureRunning();
      keyAim += 0.08;
    } else if (key === " " || key === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "clear") nextHole();
      else if (state === "paused") togglePause();
      else if (!event.repeat) charging = true;
    } else if (key === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "clear") nextHole();
      else togglePause();
    } else if (key === "p" || key === "P" || key === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (key === "r" || key === "R") {
      if (!event.repeat && (state === "running" || state === "paused" || state === "clear")) {
        event.preventDefault();
        loadHole(hole);
        if (state === "clear" || state === "paused") {
          state = "running";
          hideOverlay();
          if (pauseBtn) pauseBtn.textContent = "Pause";
        }
      }
    }
  }

  function onKeyUp(event) {
    const key = keyOf(event);
    if ((key === " " || key === "Spacebar") && charging) {
      charging = false;
      const power = Math.max(keyPower, 0.08) * 3.4;
      shoot(Math.cos(keyAim - Math.PI / 2) * power, Math.sin(keyAim - Math.PI / 2) * power);
      keyPower = 0;
    }
  }

  function ensureRunning() {
    if (state === "ready" || state === "over") start();
    else if (state === "clear") nextHole();
    else if (state === "paused") togglePause();
  }

  function canvasPos(clientX, clientY) {
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width && rect.height) {
        return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
      }
    } catch (err) { /* geometry unavailable */ }
    return null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    ensureRunning();
    if (state !== "running" || ballMoving()) return;
    aiming = canvasPos(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!aiming || state !== "running") return;
    const pos = canvasPos(event.clientX, event.clientY);
    if (pos) aiming = pos;
  });
  window.addEventListener("pointerup", () => {
    if (!aiming || state !== "running") {
      aiming = null;
      return;
    }
    const dx = aiming.x - ball.x;
    const dy = aiming.y - ball.y;
    const len = Math.hypot(dx, dy);
    aiming = null;
    if (len > 0.03 && !ballMoving()) {
      const power = Math.min(len, 0.5) * 3.4;
      shoot(-(dx / len) * power, -(dy / len) * power);
    }
  });
  canvas.addEventListener("touchstart", (event) => {
    ensureRunning();
    if (state !== "running" || ballMoving()) return;
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) aiming = canvasPos(touch.clientX, touch.clientY);
  }, { passive: true });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && aiming) {
      const pos = canvasPos(touch.clientX, touch.clientY);
      if (pos) aiming = pos;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => {
    if (!aiming || state !== "running") {
      aiming = null;
      return;
    }
    const dx = aiming.x - ball.x;
    const dy = aiming.y - ball.y;
    const len = Math.hypot(dx, dy);
    aiming = null;
    if (len > 0.03 && !ballMoving()) {
      const power = Math.min(len, 0.5) * 3.4;
      shoot(-(dx / len) * power, -(dy / len) * power);
    }
  }, { passive: true });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else if (state === "clear") nextHole();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  loadHole(0);
  state = "ready";
  showOverlay("Mini Golf", "Putt through 6 holes. Fewest total strokes wins — mind the sand and movers.", "Start game");
  requestAnimationFrame(frame);
})();
