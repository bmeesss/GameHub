/* Sky Jump — original GameHub implementation.
   Vertical platformer: auto-bounce upward, steer, never fall. */
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
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const PLAYER_R = 13;
  const BOUNCE_V = -11.5;
  const GRAVITY = 0.42;
  const MOVE_ACC = 0.9;
  const MAX_VX = 6.4;
  const GAP_MIN = 68;
  const GAP_RANGE = 44;
  const PLAT_W = 74;
  const PLAT_H = 12;

  let player = null;
  let platforms = [];
  let cameraY = 0;
  let height = 0;
  let best = loadBest();
  let state = "ready";
  let keys = { left: false, right: false };
  let touch = { left: 0, right: 0 };
  let last = 0;
  let stars = [];

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_sky-jump"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_sky-jump", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function makePlatform(y, moving) {
    const w = Math.max(46, PLAT_W - Math.floor(height / 400) * 4);
    return {
      x: Math.random() * (W - w),
      y,
      w,
      moving,
      vx: moving ? (Math.random() < 0.5 ? -1.4 : 1.4) : 0,
      spring: !moving && Math.random() < 0.08
    };
  }

  function reset() {
    player = { x: W / 2, y: H - 90, vx: 0, vy: BOUNCE_V };
    cameraY = 0;
    height = 0;
    platforms = [];
    platforms.push({ x: W / 2 - PLAT_W / 2, y: H - 60, w: PLAT_W, moving: false, vx: 0, spring: false });
    let y = H - 60;
    while (y > -H) {
      y -= GAP_MIN + Math.random() * GAP_RANGE;
      platforms.push(makePlatform(y, Math.random() < 0.22));
    }
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H * 2, r: Math.random() * 1.6 + 0.4 });
    }
    renderHud();
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = `${height}m`;
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
    reset();
    state = "running";
    hideOverlay();
  }

  function endGame() {
    state = "over";
    if (height > best) {
      best = height;
      saveBest();
    }
    renderHud();
    showOverlay("You fell!", `You climbed ${height}m. Best: ${best}m.`, "Try again");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Height ${height}m — best ${best}m.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function update(dt) {
    if (state !== "running") return;
    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0) + touch.left + touch.right;
    player.vx += steer * MOVE_ACC * dt;
    player.vx *= 0.92;
    player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, player.vx));
    player.x += player.vx * dt;
    if (player.x < -PLAYER_R) player.x = W + PLAYER_R;
    if (player.x > W + PLAYER_R) player.x = -PLAYER_R;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    for (const p of platforms) {
      if (p.moving) {
        p.x += p.vx * dt;
        if (p.x < 0 || p.x + p.w > W) p.vx *= -1;
      }
      if (
        player.vy > 0 &&
        player.y + PLAYER_R >= p.y && player.y + PLAYER_R <= p.y + PLAT_H + 8 &&
        player.x > p.x - PLAYER_R && player.x < p.x + p.w + PLAYER_R
      ) {
        player.y = p.y - PLAYER_R;
        player.vy = p.spring ? BOUNCE_V * 1.65 : BOUNCE_V;
        if (p.spring) p.flash = 8;
      }
    }

    /* Camera + score follow the highest climb. */
    const screenY = player.y - cameraY;
    if (screenY < H * 0.42) cameraY += screenY - H * 0.42;
    const climbed = Math.floor((cameraY * -1 + (H - 90) - player.y) / 10 + 0.5);
    if (climbed > height) {
      height = climbed;
      if (height > best) {
        best = height;
        saveBest();
      }
      renderHud();
    }

    /* Recycle platforms that fall out of view. */
    let highest = platforms[0];
    for (const p of platforms) if (p.y < highest.y) highest = p;
    for (const p of platforms) {
      if (p.y - cameraY > H + 40) {
        const y = highest.y - (GAP_MIN + Math.random() * GAP_RANGE);
        Object.assign(p, makePlatform(y, Math.random() < 0.25));
        highest = p;
      }
      if (p.flash > 0) p.flash -= 1;
    }

    if (player.y - cameraY > H + PLAYER_R * 2) endGame();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0d1b3e");
    sky.addColorStop(1, "#0b0f1a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const y = ((s.y - cameraY * 0.4) % (H * 2) + H * 2) % (H * 2);
      ctx.fillStyle = "rgba(226,232,255,.7)";
      ctx.fillRect(s.x, y, s.r, s.r);
    }

    for (const p of platforms) {
      const y = p.y - cameraY;
      if (y < -20 || y > H + 20) continue;
      if (p.spring) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(p.x + p.w / 2 - 9, y - 8, 18, 8);
      }
      ctx.fillStyle = p.moving ? "#f472b6" : "#22d3ee";
      ctx.fillRect(p.x, y, p.w, 5);
      ctx.fillStyle = p.moving ? "rgba(244,114,182,.35)" : "rgba(34,211,238,.35)";
      ctx.fillRect(p.x, y + 5, p.w, PLAT_H - 5);
      if (p.flash > 0) {
        ctx.fillStyle = `rgba(251,191,36,${p.flash / 10})`;
        ctx.fillRect(p.x - 4, y - 14, p.w + 8, 26);
      }
    }

    if (player) {
      const y = player.y - cameraY;
      const glow = ctx.createRadialGradient(player.x, y, 2, player.x, y, 34);
      glow.addColorStop(0, "rgba(124,92,255,.5)");
      glow.addColorStop(1, "rgba(124,92,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(player.x - 40, y - 40, 80, 80);
      ctx.fillStyle = "#e6edff";
      ctx.beginPath();
      ctx.arc(player.x, y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7c5cff";
      ctx.beginPath();
      ctx.arc(player.x, y, PLAYER_R - 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(player.x - 6, y - 4, 4, 4);
      ctx.fillRect(player.x + 2, y - 4, 4, 4);
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
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = true;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
    }
    if (event.key === "p" || event.key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = false;
  });

  const hold = (btn, dir) => {
    if (!btn) return;
    const press = (on) => (event) => {
      event.preventDefault();
      touch[dir] = on ? (dir === "left" ? -1 : 1) : 0;
    };
    btn.addEventListener("pointerdown", press(true));
    btn.addEventListener("pointerup", press(false));
    btn.addEventListener("pointerleave", press(false));
    btn.addEventListener("click", () => { touch[dir] = 0; });
  };
  hold(leftBtn, "left");
  hold(rightBtn, "right");

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);

  reset();
  state = "ready";
  showOverlay("Sky Jump", "Bounce from platform to platform and climb as high as you can. Springs launch you higher.", "Start game");
  requestAnimationFrame(frame);
})();
