/* Pool — original GameHub implementation.
   Simplified eight-ball on a single canvas: aim, charge, shoot.
   Circle physics with cushion bounces and pockets, two local
   players (or a simple AI) alternating turns. */
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
  const turnEl = document.getElementById("turn");
  const pottedEl = document.getElementById("potted");
  const shotsEl = document.getElementById("shots");
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
  const BEST_KEY = "gh_best_pool";
  const BALL_R = 11;
  const RAIL = 26;
  const FRICTION = 0.988;
  const MIN_SPEED = 0.05;
  const POCKETS = [
    { x: RAIL, y: RAIL },
    { x: W / 2, y: RAIL - 6 },
    { x: W - RAIL, y: RAIL },
    { x: RAIL, y: H - RAIL },
    { x: W / 2, y: H - RAIL + 6 },
    { x: W - RAIL, y: H - RAIL }
  ];
  const POCKET_R = 21;
  /* 1–7 solids, 8 black, 9–15 stripes. */
  const BALL_COLORS = {
    1: "#facc15", 2: "#3b82f6", 3: "#ef4444", 4: "#8b5cf6", 5: "#f97316",
    6: "#22c55e", 7: "#9f1239", 8: "#111827", 9: "#facc15", 10: "#3b82f6",
    11: "#ef4444", 12: "#8b5cf6", 13: "#f97316", 14: "#22c55e", 15: "#9f1239"
  };

  let balls = [];
  let cue = null;
  let aiming = 0;
  let charging = false;
  let charge = 0;
  let turn = 0;
  let mode = "local";
  let paused = false;
  let state = "idle";
  let shotsTaken = 0;
  let message = "Break to start";
  let groups = [null, null];
  let best = readNumber(BEST_KEY);
  let settled = true;
  let aiTimer = null;

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

  function resetTable() {
    balls = [];
    cue = { x: RAIL + (W - 2 * RAIL) * 0.26, y: H / 2, vx: 0, vy: 0, n: 0, cue: true };
    balls.push(cue);
    const startX = RAIL + (W - 2 * RAIL) * 0.68;
    let number = 1;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row <= col; row++) {
        const x = startX + col * (BALL_R * 1.85);
        const y = H / 2 + (row - col / 2) * (BALL_R * 2.1);
        balls.push({ x: x, y: y, vx: 0, vy: 0, n: number, cue: false });
        number++;
      }
    }
    const eight = balls.find((ball) => ball.n === 8);
    if (eight && balls.length > 9) {
      const swap = balls[9];
      const tmpX = eight.x, tmpY = eight.y;
      eight.x = swap.x; eight.y = swap.y;
      swap.x = tmpX; swap.y = tmpY;
    }
    shotsTaken = 0;
    groups = [null, null];
    settled = true;
    message = "Break to start";
    refreshHud();
  }

  function refreshHud() {
    if (turnEl) turnEl.textContent = mode === "ai" && turn === 1 ? "Computer" : "Player " + (turn + 1);
    if (pottedEl) pottedEl.textContent = String(balls.filter((ball) => ball.cue === false && ball.n !== 8 && potted(ball)).length);
    if (shotsEl) shotsEl.textContent = String(shotsTaken);
    if (bestEl) bestEl.textContent = best ? best + " shots" : "0";
  }

  function potted(ball) { return Boolean(ball && ball.out); }

  const remainingFor = (player) => balls.filter((ball) => !ball.out && !ball.cue && ball.n !== 8 && groupOf(ball) === groups[player]);

  function groupOf(ball) {
    if (!ball || ball.cue || ball.n === 8) return null;
    return ball.n < 8 ? "solids" : "stripes";
  }

  function step() {
    let moving = false;
    for (const ball of balls) {
      if (ball.out) continue;
      if (Math.abs(ball.vx) < MIN_SPEED && Math.abs(ball.vy) < MIN_SPEED) {
        ball.vx = 0;
        ball.vy = 0;
        continue;
      }
      moving = true;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= FRICTION;
      ball.vy *= FRICTION;
      if (ball.x - BALL_R < RAIL) { ball.x = RAIL + BALL_R; ball.vx = -ball.vx * 0.86; }
      if (ball.x + BALL_R > W - RAIL) { ball.x = W - RAIL - BALL_R; ball.vx = -ball.vx * 0.86; }
      if (ball.y - BALL_R < RAIL) { ball.y = RAIL + BALL_R; ball.vy = -ball.vy * 0.86; }
      if (ball.y + BALL_R > H - RAIL) { ball.y = H - RAIL - BALL_R; ball.vy = -ball.vy * 0.86; }
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        collide(balls[i], balls[j]);
      }
    }
    for (const ball of balls) {
      if (ball.out) continue;
      for (const pocket of POCKETS) {
        if (Math.hypot(ball.x - pocket.x, ball.y - pocket.y) < POCKET_R) {
          ball.out = true;
          ball.vx = 0;
          ball.vy = 0;
          onPotted(ball);
          break;
        }
      }
    }
    if (!moving && !settled) {
      settled = true;
      afterShot();
    }
    return moving;
  }

  function collide(a, b) {
    if (a.out || b.out) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (!dist || dist > BALL_R * 2) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = BALL_R * 2 - dist;
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel > 0) return;
    const impulse = rel * 0.92;
    a.vx += impulse * nx;
    a.vy += impulse * ny;
    b.vx -= impulse * nx;
    b.vy -= impulse * ny;
  }

  let pottedThisShot = [];
  function onPotted(ball) {
    if (ball.cue) {
      ball.out = false;
      ball.x = RAIL + (W - 2 * RAIL) * 0.26;
      ball.y = H / 2;
      ball.vx = 0;
      ball.vy = 0;
      pottedThisShot.push("scratch");
      return;
    }
    pottedThisShot.push(ball.n);
  }

  function afterShot() {
    const mine = pottedThisShot.filter((n) => n !== "scratch" && n !== 8);
    const eight = pottedThisShot.indexOf(8) !== -1;
    const scratch = pottedThisShot.indexOf("scratch") !== -1;
    pottedThisShot = [];
    const player = turn;
    let keepTurn = false;

    if (groups[0] === null && (mine.length || eight)) {
      const first = mine[0] || (eight ? 1 : null);
      if (first) {
        const pick = first < 8 ? "solids" : "stripes";
        groups[player] = pick;
        groups[1 - player] = pick === "solids" ? "stripes" : "solids";
      }
    }

    if (eight) {
      const cleared = remainingFor(player).length === 0 && groups[player] !== null;
      if (cleared && !scratch) {
        state = "over";
        const winShots = shotsTaken;
        if (mode === "local" || player === 0) {
          if (!best || winShots < best) {
            best = winShots;
            writeNumber(BEST_KEY, best);
          }
        }
        refreshHud();
        showOverlay("Player " + (player + 1) + " wins", "Eight ball potted in " + winShots + " shots. Fewest shots becomes your local best.", "Play again", true);
        return;
      }
      state = "over";
      const other = 1 - player;
      showOverlay("Eight ball early", "The eight ball went down before the group was cleared. Player " + (other + 1) + " wins this frame.", "Play again", true);
      return;
    }

    if (mine.length && !scratch) keepTurn = true;
    if (!keepTurn) turn = 1 - turn;
    message = scratch ? "Foul — cue ball potted" : mine.length ? "Nice pot" : "Turn passes";
    refreshHud();
    if (mode === "ai" && turn === 1) scheduleAi();
  }

  /* ---------------- AI: aims at the closest legal ball ---------------- */
  function scheduleAi() {
    if (state !== "playing" || paused || mode !== "ai") return;
    const run = () => {
      if (state !== "playing" || paused || mode !== "ai" || turn !== 1) return;
      const legal = remainingFor(1);
      const target = legal.length ? legal[0] : balls.find((ball) => !ball.out && ball.n === 8);
      if (!target || !cue) return;
      aiming = Math.atan2(target.y - cue.y, target.x - cue.x);
      charge = Math.min(1, 0.35 + Math.random() * 0.4);
      shoot();
    };
    if (typeof setTimeout === "function") aiTimer = setTimeout(run, 700);
    else run();
  }

  /* ---------------- Shooting ---------------- */
  function shoot() {
    if (!cue || state !== "playing" || paused || cue.out) return;
    const power = 4 + charge * 16;
    cue.vx = Math.cos(aiming) * power;
    cue.vy = Math.sin(aiming) * power;
    charge = 0;
    charging = false;
    shotsTaken++;
    settled = false;
    pottedThisShot = [];
    refreshHud();
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    const sx = W / (rect.width || W);
    const sy = H / (rect.height || H);
    return { x: ((event.clientX || 0) - rect.left) * sx, y: ((event.clientY || 0) - rect.top) * sy };
  }

  function updateAim(point) {
    if (!cue) return;
    aiming = Math.atan2(point.y - cue.y, point.x - cue.x);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (state !== "playing" || paused || settled === false) return;
    updateAim(pointFromEvent(event));
    if (charging) charge = Math.min(1, charge + 0.03);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing" || paused) return;
    const point = pointFromEvent(event);
    updateAim(point);
    charging = true;
    charge = 0.08;
  });
  canvas.addEventListener("pointerup", () => {
    if (!charging) return;
    shoot();
  });
  canvas.addEventListener("touchmove", (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) updateAim(pointFromEvent(touch));
  }, { passive: true });
  canvas.addEventListener("click", (event) => {
    if (state !== "playing" || paused) return;
    if (settled) {
      updateAim(pointFromEvent(event));
    }
  });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === " ") {
      event.preventDefault();
      if (state === "playing" && !paused) shoot();
      return;
    }
    if (key === "ArrowLeft") aiming -= 0.03;
    else if (key === "ArrowRight") aiming += 0.03;
    else if (key === "ArrowUp") charge = Math.min(1, charge + 0.06);
    else if (key === "ArrowDown") charge = Math.max(0, charge - 0.06);
    else if (key.toLowerCase() === "p") togglePause();
    else if (key.toLowerCase() === "m") toggleMode();
  });

  /* ---------------- Rendering ---------------- */
  function drawTable() {
    ctx.fillStyle = "#3b2416";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0b6b45";
    ctx.fillRect(RAIL, RAIL, W - RAIL * 2, H - RAIL * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(RAIL, RAIL, W - RAIL * 2, 6);
    for (const pocket of POCKETS) {
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, POCKET_R * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = "#07110b";
      ctx.fill();
    }
  }

  function drawBalls() {
    for (const ball of balls) {
      if (ball.out) continue;
      ctx.beginPath();
      ctx.arc(ball.x + 1.5, ball.y + 2.5, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = ball.cue ? "#f8fafc" : BALL_COLORS[ball.n] || "#e2e8f0";
      ctx.fill();
      if (!ball.cue && ball.n > 8) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(ball.x - BALL_R, ball.y - BALL_R * 0.45, BALL_R * 2, BALL_R * 0.9);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.arc(ball.x, ball.y, BALL_R * 0.62, 0, Math.PI * 2, true);
        ctx.fillStyle = BALL_COLORS[ball.n] || "#e2e8f0";
        ctx.fill();
      }
      if (!ball.cue) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
        ctx.fillStyle = "#111827";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(ball.n), ball.x, ball.y + 0.5);
      } else {
        ctx.beginPath();
        ctx.arc(ball.x - 3, ball.y - 3, BALL_R * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fill();
      }
    }
  }

  function drawAim() {
    if (!cue || state !== "playing") return;
    const length = 40 + charge * 120;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(cue.x + Math.cos(aiming) * length, cue.y + Math.sin(aiming) * length);
    ctx.strokeStyle = "rgba(248, 250, 252, 0.65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
    ctx.fillRect(RAIL, H - RAIL + 6, (W - RAIL * 2) * charge, 7);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawTable();
    drawBalls();
    drawAim();
  }

  function loop() {
    if (state === "playing" && !paused) step();
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- Controls ---------------- */
  function startGame() {
    resetTable();
    state = "playing";
    paused = false;
    turn = 0;
    aiming = 0;
    charge = 0;
    charging = false;
    pottedThisShot = [];
    message = "Aim and shoot";
    hideOverlay();
    refreshHud();
  }

  function toggleMode() {
    mode = mode === "local" ? "ai" : "local";
    if (modeBtn) modeBtn.textContent = mode === "local" ? "Mode: 2 players" : "Mode: vs Computer";
    refreshHud();
    if (state === "playing" && mode === "ai" && turn === 1) scheduleAi();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", message + " — the balls stay still while you pause.", "Resume", true);
    else {
      hideOverlay();
      if (mode === "ai" && turn === 1 && settled) scheduleAi();
    }
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startGame();
  });
  pauseBtn?.addEventListener("click", togglePause);
  modeBtn?.addEventListener("click", toggleMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  resetTable();
  draw();
  requestAnimationFrame(loop);
  void aiTimer;
})();
