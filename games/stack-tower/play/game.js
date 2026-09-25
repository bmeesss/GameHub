/* Stack Tower — original GameHub implementation.
   Canvas timing game: drop sliding blocks, keep the tower wide. */
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
  const bestEl = document.getElementById("best");
  const comboEl = document.getElementById("combo");
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
  const BLOCK_H = 22;
  const START_W = 180;
  const MIN_W = 14;
  const BASE_SPEED = 2.4;
  const PERFECT_TOLERANCE = 5;
  const REGAIN = 12;

  let blocks = [];
  let current = null;
  let score = 0;
  let combo = 0;
  let best = loadBest();
  let state = "ready";
  let last = 0;
  let shake = 0;
  let flash = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_stack-tower"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_stack-tower", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function speed() {
    return BASE_SPEED + Math.min(score * 0.16, 5.2);
  }

  function reset() {
    blocks = [{ x: W / 2 - START_W / 2, y: H - 90, w: START_W, hue: 190 }];
    score = 0;
    combo = 0;
    shake = 0;
    flash = 0;
    spawn();
    renderHud();
  }

  function spawn() {
    const top = blocks[blocks.length - 1];
    const dir = blocks.length % 2 === 1 ? 1 : -1;
    current = {
      x: dir === 1 ? -top.w : W,
      y: top.y - BLOCK_H,
      w: top.w,
      dir,
      hue: (190 + blocks.length * 24) % 360
    };
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (comboEl) comboEl.textContent = combo > 1 ? `x${combo}` : "—";
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

  function drop() {
    if (state !== "running" || !current) return;
    const top = blocks[blocks.length - 1];
    const offset = current.x - top.x;
    if (Math.abs(offset) >= top.w) {
      endGame();
      return;
    }
    if (Math.abs(offset) <= PERFECT_TOLERANCE) {
      combo += 1;
      current.x = top.x;
      current.w = Math.min(top.w + REGAIN, START_W);
      flash = 1;
    } else {
      combo = 0;
      const overlapLeft = Math.max(top.x, current.x);
      const overlapRight = Math.min(top.x + top.w, current.x + current.w);
      current.x = overlapLeft;
      current.w = Math.max(overlapRight - overlapLeft, MIN_W);
      shake = Math.min(Math.abs(offset) / 8, 4);
    }
    blocks.push({ x: current.x, y: current.y, w: current.w, hue: current.hue });
    score += 1;
    if (score > best) {
      best = score;
      saveBest();
    }
    if (blocks.length > 26) blocks.shift();
    spawn();
    renderHud();
  }

  function endGame() {
    state = "over";
    current = null;
    showOverlay("Tower toppled!", `You stacked ${score} block${score === 1 ? "" : "s"}. Best: ${best}.`, "Play again");
  }

  function start() {
    reset();
    state = "running";
    hideOverlay();
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Height ${score} — best ${best}.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function drawBlock(b, alpha) {
    const light = `hsla(${b.hue}, 80%, 60%, ${alpha})`;
    const dark = `hsla(${b.hue}, 70%, 38%, ${alpha})`;
    ctx.fillStyle = dark;
    ctx.fillRect(b.x, b.y, b.w, BLOCK_H);
    ctx.fillStyle = light;
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.fillStyle = `hsla(${b.hue}, 90%, 75%, ${alpha * 0.5})`;
    ctx.fillRect(b.x + 4, b.y + 8, b.w - 8, 3);
  }

  function drawTower() {
    /* Ground line */
    ctx.fillStyle = "#101a30";
    ctx.fillRect(0, H - 68, W, 68);
    ctx.strokeStyle = "rgba(148,163,216,.25)";
    ctx.beginPath();
    ctx.moveTo(0, H - 68);
    ctx.lineTo(W, H - 68);
    ctx.stroke();
    for (const b of blocks) drawBlock(b, 1);
  }

  function drawCurrent() {
    if (!current) return;
    const top = blocks[blocks.length - 1];
    /* Drop guide */
    ctx.strokeStyle = "rgba(34,211,238,.35)";
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(current.x + current.w / 2, current.y);
    ctx.lineTo(current.x + current.w / 2, top.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawBlock(current, 0.92);
  }

  function drawGlow() {
    const top = blocks[blocks.length - 1];
    const g = ctx.createRadialGradient(W / 2, top.y, 10, W / 2, top.y, 240);
    g.addColorStop(0, "rgba(124,92,255,.20)");
    g.addColorStop(1, "rgba(124,92,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawComboFlash() {
    if (flash <= 0) return;
    ctx.fillStyle = `rgba(74,222,128,${flash * 0.18})`;
    ctx.fillRect(0, 0, W, H);
    flash = Math.max(0, flash - 0.08);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 16.666, 3) || 1;
    last = now;
    if (state === "running" && current) {
      current.x += current.dir * speed() * dt;
      if (current.x < -current.w) { current.x = -current.w; current.dir = 1; }
      if (current.x > W) { current.x = W; current.dir = -1; }
    }
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
      shake = Math.max(0, shake - 0.05);
    }
    drawGlow();
    drawTower();
    drawCurrent();
    drawComboFlash();
    ctx.restore();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "running") drop();
    } else if (event.key === "p" || event.key === "P") {
      togglePause();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "ready" || state === "over") start();
    else if (state === "running") drop();
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  reset();
  state = "ready";
  showOverlay("Stack Tower", "Drop sliding blocks to build the tallest tower. Perfect drops keep your width.", "Start game");
  requestAnimationFrame(frame);
})();
