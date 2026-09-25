/* Basketball Shot — original GameHub implementation.
   Flick physics: sink baskets as the hoop starts moving. */
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

  const BEST_KEY = "gh_best_basketball-shot";
  const BALLS_PER_GAME = 10;
  const GRAVITY = 1.9;
  const START = { x: 0.2, y: 0.86 };

  let ball = { x: START.x, y: START.y, vx: 0, vy: 0, flying: false };
  let hoopX = 0.78;
  let hoopT = 0;
  let moving = false;
  let baskets = 0;
  let streak = 0;
  let ballsLeft = BALLS_PER_GAME;
  let flightTime = 0;
  let aiming = null;
  let keyAngle = -0.9;
  let keyPower = 0.55;
  let scored = false;
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

  function resetBall() {
    ball = { x: START.x, y: START.y, vx: 0, vy: 0, flying: false };
    aiming = null;
    scored = false;
    flightTime = 0;
  }

  function reset() {
    baskets = 0;
    streak = 0;
    ballsLeft = BALLS_PER_GAME;
    hoopT = 0;
    moving = false;
    hoopX = 0.78;
    keyAngle = -0.9;
    keyPower = 0.55;
    resetBall();
    renderScore();
  }

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(baskets);
    if (bestEl) bestEl.textContent = String(Math.max(best, streak));
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
      showOverlay("Paused", `${baskets} basket${baskets === 1 ? "" : "s"} · ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} left.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = streak > best || baskets > 0 && best === 0 && streak >= best;
    if (streak > best) {
      best = streak;
      saveBest(best);
    }
    renderScore();
    showOverlay("Full time!", `You sank ${baskets} of ${BALLS_PER_GAME} shots with a best streak of ${Math.max(best, streak)}.${record && streak > 0 ? " New best streak!" : ""}`, "Play again");
  }

  function shoot(vx, vy) {
    if (state !== "running" || ball.flying || ballsLeft <= 0) return;
    ballsLeft -= 1;
    ball.vx = vx;
    ball.vy = vy;
    ball.flying = true;
    scored = false;
    flightTime = 0;
  }

  function rimGeom() {
    return { y: 0.3, half: 0.062, boardX: hoopX + 0.075 };
  }

  function resolveShot() {
    if (scored) {
      baskets += 1;
      streak += 1;
      if (streak > best) {
        best = streak;
        saveBest(best);
      }
      if (baskets >= 3) moving = true;
    } else {
      streak = 0;
    }
    renderScore();
    if (ballsLeft <= 0) {
      gameOver();
    } else {
      resetBall();
    }
  }

  function update(dt) {
    hoopT += dt;
    if (moving) {
      hoopX = 0.78 + Math.sin(hoopT * (0.9 + baskets * 0.06)) * Math.min(0.16, 0.06 + baskets * 0.012);
    }
    if (!ball.flying) return;
    flightTime += dt;
    const rim = rimGeom();
    ball.vy += GRAVITY * dt;
    const prevY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const r = 0.032;

    if (ball.x < r) {
      ball.x = r;
      ball.vx = Math.abs(ball.vx) * 0.6;
    }
    if (ball.x > 1 - r) {
      ball.x = 1 - r;
      ball.vx = -Math.abs(ball.vx) * 0.6;
    }
    /* Backboard bounce. */
    if (ball.x + r > rim.boardX && ball.x < rim.boardX + 0.03 && ball.y > rim.y - 0.09 && ball.y < rim.y + 0.02 && ball.vx > 0) {
      ball.x = rim.boardX - r;
      ball.vx = -Math.abs(ball.vx) * 0.7;
    }
    /* Rim ends bounce. */
    for (const ex of [hoopX - rim.half, hoopX + rim.half]) {
      const dx = ball.x - ex;
      const dy = ball.y - rim.y;
      const dist = Math.hypot(dx, dy);
      if (dist < r + 0.008 && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x = ex + nx * (r + 0.008);
        ball.y = rim.y + ny * (r + 0.008);
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 1.6 * dot * nx;
          ball.vy -= 1.6 * dot * ny;
        }
      }
    }
    /* Basket: falling through the rim plane inside the rim. */
    if (!scored && ball.vy > 0 && prevY < rim.y && ball.y >= rim.y && Math.abs(ball.x - hoopX) < rim.half - 0.01) {
      scored = true;
    }
    if (ball.y > 1.02 || flightTime > 5) {
      resolveShot();
    }
  }

  function render() {
    const W = canvas.width;
    const H = canvas.height;
    const rim = rimGeom();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b1226");
    grad.addColorStop(1, "#05070f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#132039";
    ctx.fillRect(W * 0.55, 0, W * 0.45, H * 0.42);
    /* Backboard + rim. */
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.fillRect(rim.boardX * W, (rim.y - 0.09) * H, 6, H * 0.11);
    ctx.strokeStyle = "#fb7185";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo((hoopX - rim.half) * W, rim.y * H);
    ctx.lineTo((hoopX + rim.half) * W, rim.y * H);
    ctx.stroke();
    ctx.strokeStyle = "rgba(251, 113, 133, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((hoopX - rim.half) * W, rim.y * H);
    ctx.lineTo((hoopX - rim.half * 0.6) * W, (rim.y + 0.07) * H);
    ctx.moveTo((hoopX + rim.half) * W, rim.y * H);
    ctx.lineTo((hoopX + rim.half * 0.6) * W, (rim.y + 0.07) * H);
    ctx.stroke();
    /* Ground. */
    ctx.fillStyle = "#1c2333";
    ctx.fillRect(0, H * 0.96, W, H * 0.04);
    /* Aim guide. */
    if (aiming && !ball.flying && state === "running") {
      const dx = aiming.x - ball.x;
      const dy = aiming.y - ball.y;
      if (Math.hypot(dx, dy) > 0.02) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(ball.x * W, ball.y * H);
        ctx.lineTo((ball.x - dx * 1.6) * W, (ball.y - dy * 1.6) * H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    /* Ball. */
    ctx.save();
    ctx.shadowColor = "#fb923c";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(ball.x * W, ball.y * H, W * 0.032, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((ball.x - 0.032) * W, ball.y * H);
    ctx.lineTo((ball.x + 0.032) * W, ball.y * H);
    ctx.moveTo(ball.x * W, (ball.y - 0.032) * H);
    ctx.lineTo(ball.x * W, (ball.y + 0.032) * H);
    ctx.stroke();
    /* Status. */
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 13px Inter, Arial, sans-serif";
    ctx.fillText(`Balls: ${ballsLeft}`, 12, 22);
    ctx.fillText(`Streak: ${streak}`, 12, 40);
    if (moving) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Moving hoop!", 12, 58);
    }
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

  function onKeyDown(event) {
    const key = keyOf(event);
    if (key === "ArrowLeft" || key === "a") {
      event.preventDefault();
      ensureRunning();
      keyAngle -= 0.05;
    } else if (key === "ArrowRight" || key === "d") {
      event.preventDefault();
      ensureRunning();
      keyAngle += 0.05;
    } else if (key === "ArrowUp" || key === "w") {
      event.preventDefault();
      ensureRunning();
      keyPower = Math.min(1, keyPower + 0.05);
    } else if (key === "ArrowDown" || key === "s") {
      event.preventDefault();
      ensureRunning();
      keyPower = Math.max(0.25, keyPower - 0.05);
    } else if (key === " " || key === "Enter" || key === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      else if (!event.repeat) shoot(Math.cos(keyAngle) * keyPower * 2.2, Math.sin(keyAngle) * keyPower * 2.2);
    } else if (key === "p" || key === "P" || key === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (key === "r" || key === "R") {
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        start();
      }
    }
  }

  function ensureRunning() {
    if (state === "ready" || state === "over") start();
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

  function releaseAim() {
    if (!aiming || state !== "running") {
      aiming = null;
      return;
    }
    const dx = aiming.x - ball.x;
    const dy = aiming.y - ball.y;
    const len = Math.hypot(dx, dy);
    aiming = null;
    if (len > 0.03 && !ball.flying) {
      const power = Math.min(len, 0.45) * 4.6;
      shoot(-(dx / len) * power, -(dy / len) * power);
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    ensureRunning();
    if (state !== "running" || ball.flying) return;
    aiming = canvasPos(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!aiming || state !== "running") return;
    const pos = canvasPos(event.clientX, event.clientY);
    if (pos) aiming = pos;
  });
  window.addEventListener("pointerup", releaseAim);
  canvas.addEventListener("touchstart", (event) => {
    ensureRunning();
    if (state !== "running" || ball.flying) return;
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
  canvas.addEventListener("touchend", releaseAim, { passive: true });

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
  showOverlay("Basketball Shot", "Flick the ball into the hoop. It starts moving — streaks earn glory.", "Start game");
  requestAnimationFrame(frame);
})();
