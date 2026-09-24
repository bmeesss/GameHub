/* Neon Breakout — original GameHub implementation.
   Brick breaker with 3 levels, lives, particles and capsule powerups. */
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
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
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
  const PADDLE_Y = H - 52;
  const PADDLE_H = 14;
  const BASE_PADDLE_W = 92;
  const BALL_R = 7;
  const BRICK_COLS = 8;
  const BRICK_GAP = 6;
  const BRICK_TOP = 74;
  const BRICK_H = 24;
  const ROW_COLORS = ["#fb7185", "#fbbf24", "#4ade80", "#22d3ee", "#a78bfa", "#f472b6"];

  const LEVELS = [
    ["11111111", "22222222", "33333333", "44444444", "55555555"],
    ["60000006", "06600660", "00666000", "06600660", "60000006", "11111111"],
    ["12345601", "23456012", "34560123", "45601234", "56012345", "60123456"]
  ];

  let state = "ready";
  let paddle = { x: W / 2 - BASE_PADDLE_W / 2, w: BASE_PADDLE_W, wide: 0 };
  let balls = [];
  let bricks = [];
  let capsules = [];
  let particles = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let stuck = true;
  let keys = {};
  let last = 0;

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (livesEl) livesEl.textContent = String(lives);
    if (levelEl) levelEl.textContent = String(level);
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

  function brickWidth() {
    return (W - 32 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
  }

  function buildLevel(index) {
    bricks = [];
    const layout = LEVELS[(index - 1) % LEVELS.length];
    const bw = brickWidth();
    layout.forEach((row, r) => {
      for (let c = 0; c < Math.min(row.length, BRICK_COLS); c++) {
        const hits = parseInt(row[c], 10);
        if (!hits) continue;
        bricks.push({
          x: 16 + c * (bw + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: bw,
          h: BRICK_H,
          hits,
          maxHits: hits
        });
      }
    });
    capsules = [];
    resetBall();
  }

  function resetBall() {
    paddle.x = W / 2 - paddle.w / 2;
    balls = [{ x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 0, speed: 360 + (level - 1) * 40 }];
    stuck = true;
  }

  function launch() {
    if (!stuck) return;
    stuck = false;
    for (const ball of balls) {
      const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
    }
  }

  function start() {
    score = 0;
    lives = 3;
    level = 1;
    paddle.w = BASE_PADDLE_W;
    paddle.wide = 0;
    particles = [];
    buildLevel(level);
    state = "running";
    hideOverlay();
    renderHud();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Score ${score} · Level ${level}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver(won) {
    state = "over";
    if (won) {
      showOverlay("You cleared every level!", `Final score ${score}. The arcade salutes you.`, "Play again");
    } else {
      showOverlay("Game over", `You reached level ${level} with ${score} points.`, "Try again");
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 0.45,
        color
      });
    }
  }

  function maybeDrop(x, y) {
    if (Math.random() > 0.16) return;
    capsules.push({ x, y, vy: 130, kind: Math.random() < 0.5 ? "W" : "M" });
  }

  function applyCapsule(kind) {
    if (kind === "W") {
      paddle.wide = 12;
      paddle.w = BASE_PADDLE_W * 1.5;
    } else if (balls.length < 4) {
      const source = balls[0] || { x: paddle.x + paddle.w / 2, y: PADDLE_Y - 20, vx: 0, vy: -300, speed: 360 };
      const speed = Math.hypot(source.vx, source.vy) || 360;
      balls.push(
        { x: source.x, y: source.y, vx: speed * 0.5, vy: -speed * 0.85, speed },
        { x: source.x, y: source.y, vx: -speed * 0.5, vy: -speed * 0.85, speed }
      );
    }
  }

  function loseBall() {
    lives -= 1;
    renderHud();
    if (lives <= 0) {
      gameOver(false);
      return;
    }
    paddle.w = BASE_PADDLE_W;
    paddle.wide = 0;
    resetBall();
  }

  function update(dt) {
    const keyStep = 460 * dt;
    if (keys.ArrowLeft || keys.KeyA) paddle.x -= keyStep;
    if (keys.ArrowRight || keys.KeyD) paddle.x += keyStep;
    paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, paddle.x));
    if (paddle.wide > 0) {
      paddle.wide -= dt;
      if (paddle.wide <= 0) paddle.w = BASE_PADDLE_W;
    }

    if (stuck) {
      for (const ball of balls) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = PADDLE_Y - BALL_R - 2;
      }
    }

    for (const cap of capsules) {
      cap.y += cap.vy * dt;
      if (cap.y >= PADDLE_Y && cap.y <= PADDLE_Y + PADDLE_H + 10 &&
          cap.x >= paddle.x && cap.x <= paddle.x + paddle.w) {
        cap.taken = true;
        applyCapsule(cap.kind);
      }
    }
    capsules = capsules.filter((cap) => !cap.taken && cap.y < H + 20);

    const dead = [];
    balls.forEach((ball, index) => {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < BALL_R + 4) { ball.x = BALL_R + 4; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BALL_R - 4) { ball.x = W - BALL_R - 4; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < BALL_R + 4) { ball.y = BALL_R + 4; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 12 &&
          ball.x >= paddle.x - BALL_R && ball.x <= paddle.x + paddle.w + BALL_R) {
        const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        const speed = Math.min(Math.hypot(ball.vx, ball.vy) + 6, 620);
        const angle = -Math.PI / 2 + rel * (Math.PI / 3.2);
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = PADDLE_Y - BALL_R - 1;
      }
      for (const brick of bricks) {
        if (brick.dead) continue;
        const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
        const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
        if (Math.hypot(ball.x - nearX, ball.y - nearY) > BALL_R) continue;
        const overlapLeft = ball.x + BALL_R - brick.x;
        const overlapRight = brick.x + brick.w - (ball.x - BALL_R);
        const overlapTop = ball.y + BALL_R - brick.y;
        const overlapBottom = brick.y + brick.h - (ball.y - BALL_R);
        const smallest = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (smallest === overlapLeft) { ball.vx = -Math.abs(ball.vx); ball.x = brick.x - BALL_R - 1; }
        else if (smallest === overlapRight) { ball.vx = Math.abs(ball.vx); ball.x = brick.x + brick.w + BALL_R + 1; }
        else if (smallest === overlapTop) { ball.vy = -Math.abs(ball.vy); ball.y = brick.y - BALL_R - 1; }
        else { ball.vy = Math.abs(ball.vy); ball.y = brick.y + brick.h + BALL_R + 1; }
        brick.hits -= 1;
        const color = ROW_COLORS[(brick.maxHits - 1) % ROW_COLORS.length];
        burst(nearX, nearY, color);
        if (brick.hits <= 0) {
          brick.dead = true;
          score += 10 * brick.maxHits;
          maybeDrop(brick.x + brick.w / 2, brick.y + brick.h / 2);
        } else {
          score += 5;
        }
        renderHud();
        break;
      }
      if (ball.y > H + 20) dead.push(index);
    });
    for (let i = dead.length - 1; i >= 0; i--) balls.splice(dead[i], 1);
    bricks = bricks.filter((brick) => !brick.dead);

    if (balls.length === 0 && state === "running") loseBall();
    if (bricks.length === 0 && state === "running") {
      score += 100 * level;
      if (level >= LEVELS.length) {
        gameOver(true);
      } else {
        level += 1;
        buildLevel(level);
        renderHud();
      }
    }
  }

  function render(dt) {
    void dt;
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(124, 92, 255, 0.12)");
    bg.addColorStop(1, "rgba(34, 211, 238, 0.05)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const brick of bricks) {
      const color = ROW_COLORS[(brick.maxHits - 1) % ROW_COLORS.length];
      ctx.save();
      ctx.globalAlpha = 0.35 + (0.65 * brick.hits) / brick.maxHits;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 5);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.beginPath();
      ctx.roundRect(brick.x + 4, brick.y + 3, brick.w - 8, 5, 3);
      ctx.fill();
    }

    for (const cap of capsules) {
      ctx.save();
      ctx.shadowColor = cap.kind === "W" ? "#4ade80" : "#fbbf24";
      ctx.shadowBlur = 12;
      ctx.fillStyle = cap.kind === "W" ? "#166534" : "#78350f";
      ctx.beginPath();
      ctx.roundRect(cap.x - 13, cap.y - 11, 26, 22, 11);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "800 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cap.kind, cap.x, cap.y + 1);
      ctx.restore();
    }

    const paddleGrad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
    paddleGrad.addColorStop(0, "#7c5cff");
    paddleGrad.addColorStop(1, "#22d3ee");
    ctx.save();
    ctx.shadowColor = "#7c5cff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = paddleGrad;
    ctx.beginPath();
    ctx.roundRect(paddle.x, PADDLE_Y, paddle.w, PADDLE_H, 7);
    ctx.fill();
    ctx.restore();

    for (const ball of balls) {
      ctx.save();
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#e8fbff";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life * 2.2, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (stuck && state === "running") {
      ctx.fillStyle = "rgba(242, 245, 255, 0.75)";
      ctx.font = "700 17px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press Space or tap to launch", W / 2, H - 110);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
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

  function canvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / Math.max(rect.width, 1)) * W;
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    keys[event.code] = true;
    if (event.code === "Space" || event.code === "Enter") {
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      else launch();
    }
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });
  canvas.addEventListener("mousemove", (event) => {
    if (state !== "running") return;
    paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, canvasX(event.clientX) - paddle.w / 2));
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (state === "running") {
      paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, canvasX(event.clientX) - paddle.w / 2));
      launch();
    }
  });
  canvas.addEventListener("touchmove", (event) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch && state === "running") {
      paddle.x = Math.max(8, Math.min(W - 8 - paddle.w, canvasX(touch.clientX) - paddle.w / 2));
    }
  }, { passive: false });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  buildLevel(1);
  renderHud();
  requestAnimationFrame(frame);
})();
