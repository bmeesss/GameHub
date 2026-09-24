/* Paddle Clash — original GameHub implementation.
   Pong-style duel: three AI difficulties or local 2-player, first to 7. */
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
  const scoreLeftEl = document.getElementById("scoreLeft");
  const scoreRightEl = document.getElementById("scoreRight");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const modeRow = document.getElementById("modeRow");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const PADDLE_W = 12;
  const PADDLE_H = 76;
  const PADDLE_SPEED = 420;
  const WIN_SCORE = 7;
  const AI = {
    easy: { speed: 250, error: 46 },
    normal: { speed: 340, error: 22 },
    hard: { speed: 430, error: 8 }
  };

  let mode = "normal";
  let versus = false;
  let state = "ready";
  let left = { y: H / 2 - PADDLE_H / 2, score: 0 };
  let right = { y: H / 2 - PADDLE_H / 2, score: 0 };
  let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 380 };
  let serveTimer = 0;
  let serveDir = 1;
  let aiTarget = H / 2;
  let keys = {};
  let pointerY = null;
  let last = 0;

  function renderScore() {
    if (scoreLeftEl) scoreLeftEl.textContent = String(left.score);
    if (scoreRightEl) scoreRightEl.textContent = String(right.score);
  }

  function showOverlay(title, text, showModes, showPrimary, primaryLabel) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (modeRow) modeRow.hidden = !showModes;
    if (primaryBtn) {
      primaryBtn.hidden = !showPrimary;
      if (primaryLabel) primaryBtn.textContent = primaryLabel;
    }
    if (overlay) overlay.hidden = false;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  function resetPositions() {
    left.y = H / 2 - PADDLE_H / 2;
    right.y = H / 2 - PADDLE_H / 2;
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.speed = 380;
  }

  function serve(direction) {
    serveDir = direction || (Math.random() < 0.5 ? -1 : 1);
    serveTimer = 0.8;
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launch() {
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    ball.vx = Math.cos(angle) * ball.speed * serveDir;
    ball.vy = Math.sin(angle) * ball.speed;
  }

  function start(selected) {
    mode = selected;
    versus = selected === "versus";
    left.score = 0;
    right.score = 0;
    resetPositions();
    serve();
    state = "running";
    hideOverlay();
    renderScore();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", versus ? "Player 1: W/S · Player 2: arrows." : "Move with mouse, touch, W/S or arrows.", false, true, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function endMatch(winnerLeft) {
    state = "over";
    const winner = versus ? (winnerLeft ? "Player 1" : "Player 2") : (winnerLeft ? "You" : "CPU");
    showOverlay(`${winner} win${versus || !winnerLeft ? "" : ""}!`, `Final score ${left.score} – ${right.score}. Pick a mode to play again.`, true, false, "");
  }

  function clampPaddle(paddle) {
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y > H - PADDLE_H) paddle.y = H - PADDLE_H;
  }

  function update(dt) {
    if (serveTimer > 0) {
      serveTimer -= dt;
      if (serveTimer <= 0) launch();
    }
    const step = PADDLE_SPEED * dt;
    if (versus) {
      if (keys.KeyW) left.y -= step;
      if (keys.KeyS) left.y += step;
      if (keys.ArrowUp) right.y -= step;
      if (keys.ArrowDown) right.y += step;
    } else {
      let moved = false;
      if (keys.KeyW || keys.ArrowUp) { left.y -= step; moved = true; }
      if (keys.KeyS || keys.ArrowDown) { left.y += step; moved = true; }
      if (!moved && pointerY !== null) {
        const target = pointerY - PADDLE_H / 2;
        const diff = target - left.y;
        left.y += Math.max(-step * 1.4, Math.min(step * 1.4, diff));
      }
      const brain = AI[mode] || AI.normal;
      if (ball.vx > 0) {
        aiTarget = ball.y + (Math.random() - 0.5) * brain.error;
      }
      const center = right.y + PADDLE_H / 2;
      const diff = aiTarget - center;
      const maxMove = brain.speed * dt;
      right.y += Math.max(-maxMove, Math.min(maxMove, diff));
    }
    clampPaddle(left);
    clampPaddle(right);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.y < 8) { ball.y = 8; ball.vy = Math.abs(ball.vy); }
    if (ball.y > H - 8) { ball.y = H - 8; ball.vy = -Math.abs(ball.vy); }

    const hitLeft = ball.vx < 0 && ball.x - 8 <= 24 + PADDLE_W && ball.x > 24 &&
      ball.y >= left.y && ball.y <= left.y + PADDLE_H;
    const hitRight = ball.vx > 0 && ball.x + 8 >= W - 24 - PADDLE_W && ball.x < W - 24 &&
      ball.y >= right.y && ball.y <= right.y + PADDLE_H;
    if (hitLeft || hitRight) {
      const paddle = hitLeft ? left : right;
      const rel = (ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
      ball.speed = Math.min(ball.speed + 18, 720);
      const angle = rel * (Math.PI / 4.2);
      ball.vx = (hitLeft ? 1 : -1) * Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      ball.x = hitLeft ? 24 + PADDLE_W + 9 : W - 24 - PADDLE_W - 9;
    }
    if (ball.x < -20) {
      right.score += 1;
      renderScore();
      if (right.score >= WIN_SCORE) { endMatch(false); return; }
      ball.speed = 380;
      serve(1);
    } else if (ball.x > W + 20) {
      left.score += 1;
      renderScore();
      if (left.score >= WIN_SCORE) { endMatch(true); return; }
      ball.speed = 380;
      serve(-1);
    }
  }

  function render() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, "rgba(124, 92, 255, 0.14)");
    gradient.addColorStop(0.5, "rgba(34, 211, 238, 0.05)");
    gradient.addColorStop(1, "rgba(251, 113, 133, 0.14)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 8);
    ctx.lineTo(W / 2, H - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#7c5cff";
    ctx.shadowColor = "#7c5cff";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(24, left.y, PADDLE_W, PADDLE_H, 6);
    ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.shadowColor = "#fb7185";
    ctx.beginPath();
    ctx.roundRect(W - 24 - PADDLE_W, right.y, PADDLE_W, PADDLE_H, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (serveTimer <= 0) {
      ctx.save();
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#e8fbff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(242, 245, 255, 0.7)";
      ctx.font = "700 20px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get ready…", W / 2, H / 2 - 24);
    }
    ctx.fillStyle = "rgba(242, 245, 255, 0.85)";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(left.score), W / 2 - 52, 58);
    ctx.fillText(String(right.score), W / 2 + 52, 58);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running") update(dt);
    render();
  }

  function canvasY(clientY) {
    const rect = canvas.getBoundingClientRect();
    return ((clientY - rect.top) / Math.max(rect.height, 1)) * H;
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    keys[event.code] = true;
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if ((event.code === "Space" || event.code === "Enter") && state !== "running") {
      if (state === "paused") togglePause();
      else start(mode);
    }
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });
  canvas.addEventListener("mousemove", (event) => {
    if (!versus) pointerY = canvasY(event.clientY);
  });
  canvas.addEventListener("touchstart", (event) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && !versus) pointerY = canvasY(touch.clientY);
  }, { passive: false });
  canvas.addEventListener("touchmove", (event) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && !versus) pointerY = canvasY(touch.clientY);
  }, { passive: false });
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-mode]") : null;
      if (button) start(button.getAttribute("data-mode") || "normal");
    });
  }
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start(mode);
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  renderScore();
  requestAnimationFrame(frame);
})();
