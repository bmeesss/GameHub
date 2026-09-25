/* Air Hockey — original GameHub implementation.
   Fast table duel: beat the AI or a friend on one keyboard. */
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
  const scoreAEl = document.getElementById("score-a");
  const scoreBEl = document.getElementById("score-b");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const modeBtn = document.getElementById("modeBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const PUCK_R = 11;
  const PAD_R = 26;
  const GOAL_W = 170;
  const WIN_SCORE = 7;
  const MAX_SPEED = 11;

  let puck = null;
  let padA = null; /* top */
  let padB = null; /* bottom — always the human player */
  let scoreA = 0;
  let scoreB = 0;
  let twoPlayer = false;
  let streak = 0;
  let best = loadBest();
  let state = "ready";
  let keys = { left: false, right: false, a: false, d: false };
  let serveTimer = 0;
  let last = 0;
  let trail = [];

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_air-hockey"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_air-hockey", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function resetPositions(dir) {
    puck = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    serveTimer = 40;
    if (dir) puck.serve = dir;
    padA = { x: W / 2, y: 70, px: W / 2 };
    padB = { x: W / 2, y: H - 70, px: W / 2 };
    trail = [];
  }

  function reset() {
    scoreA = 0;
    scoreB = 0;
    resetPositions(0);
    renderHud();
  }

  function renderHud() {
    if (scoreAEl) scoreAEl.textContent = String(scoreA);
    if (scoreBEl) scoreBEl.textContent = String(scoreB);
    if (bestEl) bestEl.textContent = best > 0 ? `Streak ${best}` : "—";
    if (modeBtn) modeBtn.textContent = twoPlayer ? "Mode: 2 players" : "Mode: vs AI";
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
  }

  function endRound() {
    state = "over";
    const youWon = scoreB > scoreA;
    if (twoPlayer) {
      showOverlay(scoreA > scoreB ? "Top player wins!" : "Bottom player wins!", `Final score ${scoreA}–${scoreB}.`, "Rematch");
    } else if (youWon) {
      streak += 1;
      if (streak > best) {
        best = streak;
        saveBest();
      }
      showOverlay("You win!", `${scoreB}–${scoreA}. Win streak: ${streak}.`, "Play again");
    } else {
      streak = 0;
      showOverlay("AI wins", `${scoreA}–${scoreB}. Best streak: ${best}.`, "Try again");
    }
    renderHud();
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `${scoreA}–${scoreB}. First to ${WIN_SCORE} wins.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function clampPad(pad, top) {
    pad.x = Math.max(PAD_R + 8, Math.min(W - PAD_R - 8, pad.x));
    if (top) pad.y = Math.min(H / 2 - PAD_R - 4, Math.max(PAD_R + 8, pad.y));
    else pad.y = Math.max(H / 2 + PAD_R + 4, Math.min(H - PAD_R - 8, pad.y));
  }

  function aiMove(dt) {
    const target = serveTimer > 0 ? W / 2 : puck.x + puck.vx * 6;
    const dy = puck.y < H / 2 ? puck.y : H / 4;
    padA.x += (target - padA.x) * Math.min(0.09 * dt, 0.3);
    padA.y += (dy - padA.y) * Math.min(0.05 * dt, 0.2);
    clampPad(padA, true);
  }

  function paddleHit(pad) {
    const dx = puck.x - pad.x;
    const dy = puck.y - pad.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PAD_R + PUCK_R) return;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    puck.x = pad.x + nx * (PAD_R + PUCK_R + 1);
    puck.y = pad.y + ny * (PAD_R + PUCK_R + 1);
    const speed = Math.min(MAX_SPEED, Math.hypot(puck.vx, puck.vy) + 3.4);
    const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 0.35;
    puck.vx = Math.cos(angle) * speed;
    puck.vy = Math.sin(angle) * speed;
  }

  function update(dt) {
    if (state !== "running") return;

    /* Bottom player: arrows. */
    const steerB = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    padB.x += steerB * 7 * dt;
    clampPad(padB, false);

    /* Top player: AI or A/D. */
    if (twoPlayer) {
      const steerA = (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
      padA.x += steerA * 7 * dt;
      clampPad(padA, true);
    } else {
      aiMove(dt);
    }

    if (serveTimer > 0) {
      serveTimer -= dt;
      if (serveTimer <= 0) {
        const dir = puck.serve || (Math.random() < 0.5 ? -1 : 1);
        puck.vy = 4.4 * (dir === -1 ? -1 : 1);
        puck.vx = (Math.random() - 0.5) * 3;
      }
      return;
    }

    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    puck.vx *= 0.997;
    puck.vy *= 0.997;
    trail.push({ x: puck.x, y: puck.y, life: 12 });
    for (const t of trail) t.life -= 1;
    trail = trail.filter((t) => t.life > 0);

    paddleHit(padA);
    paddleHit(padB);

    /* Side walls. */
    if (puck.x < PUCK_R) { puck.x = PUCK_R; puck.vx = Math.abs(puck.vx); }
    if (puck.x > W - PUCK_R) { puck.x = W - PUCK_R; puck.vx = -Math.abs(puck.vx); }

    /* Goals: gaps at top and bottom. */
    const inGoalX = puck.x > W / 2 - GOAL_W / 2 && puck.x < W / 2 + GOAL_W / 2;
    if (puck.y < PUCK_R) {
      if (inGoalX) {
        scoreB += 1;
        renderHud();
        if (scoreB >= WIN_SCORE) { endRound(); return; }
        resetPositions(1);
      } else {
        puck.y = PUCK_R;
        puck.vy = Math.abs(puck.vy);
      }
    }
    if (puck.y > H - PUCK_R) {
      if (inGoalX) {
        scoreA += 1;
        renderHud();
        if (scoreA >= WIN_SCORE) { endRound(); return; }
        resetPositions(-1);
      } else {
        puck.y = H - PUCK_R;
        puck.vy = -Math.abs(puck.vy);
      }
    }

    /* Keep the puck from stalling. */
    if (Math.abs(puck.vy) < 0.8 && serveTimer <= 0) {
      puck.vy = (puck.vy >= 0 ? 1 : -1) * 1.2;
    }
  }

  function drawTable() {
    ctx.fillStyle = "#0a1226";
    ctx.fillRect(0, 0, W, H);
    /* Ice sheen */
    const sheen = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W);
    sheen.addColorStop(0, "rgba(34,211,238,.08)");
    sheen.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    /* Lines */
    ctx.strokeStyle = "rgba(148,163,216,.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, H / 2);
    ctx.lineTo(W - 14, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
    ctx.stroke();
    /* Goal gaps */
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(W / 2 - GOAL_W / 2, 0, GOAL_W, 6);
    ctx.fillRect(W / 2 - GOAL_W / 2, H - 6, GOAL_W, 6);
    /* Corners */
    ctx.strokeStyle = "rgba(148,163,216,.5)";
    ctx.strokeRect(8, 8, W - 16, H - 16);
  }

  function drawPaddle(pad, color) {
    const glow = ctx.createRadialGradient(pad.x, pad.y, 4, pad.x, pad.y, PAD_R + 16);
    glow.addColorStop(0, color + "cc");
    glow.addColorStop(1, color + "00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, PAD_R + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, PAD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.arc(pad.x - 7, pad.y - 7, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    drawTable();
    for (const t of trail) {
      ctx.fillStyle = `rgba(226,232,255,${t.life / 40})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PUCK_R * (t.life / 14) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (puck) {
      ctx.fillStyle = "#e6edff";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, PUCK_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, PUCK_R - 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (padA) drawPaddle(padA, twoPlayer ? "#c084fc" : "#fb7185");
    if (padB) drawPaddle(padB, "#22d3ee");
    if (serveTimer > 0 && state === "running") {
      ctx.fillStyle = "rgba(226,232,255,.75)";
      ctx.font = "700 15px ui-sans-serif, system-ui, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Get ready…", W / 2, H / 2 - 80);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 16.666, 3) || 1;
    last = now;
    update(dt);
    draw();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") keys.left = true;
    if (event.key === "ArrowRight") keys.right = true;
    if (event.key === "a" || event.key === "A") keys.a = true;
    if (event.key === "d" || event.key === "D") keys.d = true;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
    }
    if (event.key === "p" || event.key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft") keys.left = false;
    if (event.key === "ArrowRight") keys.right = false;
    if (event.key === "a" || event.key === "A") keys.a = false;
    if (event.key === "d" || event.key === "D") keys.d = false;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (state !== "running") return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? W / rect.width : 1;
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;
    if (y > H / 2) {
      padB.x = x;
      clampPad(padB, false);
    } else if (twoPlayer) {
      padA.x = x;
      clampPad(padA, true);
    }
  });
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "ready" || state === "over") start();
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (modeBtn) {
    modeBtn.addEventListener("click", () => {
      twoPlayer = !twoPlayer;
      streak = 0;
      renderHud();
    });
  }

  reset();
  state = "ready";
  showOverlay("Air Hockey", "First to 7 goals. Move with the mouse or arrow keys — flip to 2-player mode for a local duel.", "Start game");
  requestAnimationFrame(frame);
})();
