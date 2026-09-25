/* Target Shooter — original GameHub implementation.
   Aim-training range: hit every target before it leaves the range.
   Ten shots per round, accuracy bonuses, endless rounds. */
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
  const scoreEl = document.getElementById("score");
  const roundEl = document.getElementById("round");
  const ammoEl = document.getElementById("ammo");
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
  const BEST_KEY = "gh_best_target-shooter";
  const SHOTS_PER_ROUND = 10;

  let targets = [];
  let shots = [];
  let score = 0;
  let best = readNumber(BEST_KEY);
  let round = 1;
  let ammo = SHOTS_PER_ROUND;
  let hits = 0;
  let fired = 0;
  let state = "idle";
  let paused = false;
  let pointer = { x: W / 2, y: H / 2 };
  let message = "Ready";
  let spawnTimer = 0;

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

  function refreshHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (roundEl) roundEl.textContent = String(round);
    if (ammoEl) ammoEl.textContent = String(ammo);
    if (bestEl) bestEl.textContent = String(best);
  }

  const speedForRound = () => 0.9 + round * 0.28;
  const radiusForRound = () => Math.max(16, 40 - round * 2.2);

  function spawnTarget() {
    const radius = radiusForRound();
    const angle = Math.random() * Math.PI * 2;
    const speed = speedForRound() * (0.7 + Math.random() * 0.6);
    targets.push({
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      r: radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 420 + round * 40,
      maxLife: 420 + round * 40,
      born: performance.now ? performance.now() : 0
    });
  }

  function startRound(keepScore) {
    targets = [];
    shots = [];
    ammo = SHOTS_PER_ROUND;
    if (!keepScore) {
      score = 0;
      round = 1;
      hits = 0;
      fired = 0;
    }
    state = "playing";
    paused = false;
    message = "Round " + round;
    for (let i = 0; i < Math.min(3, 1 + Math.floor(round / 2)); i++) spawnTarget();
    hideOverlay();
    refreshHud();
  }

  function endGame(reason) {
    state = "over";
    if (score > best) {
      best = score;
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
    const accuracy = fired ? Math.round((hits / fired) * 100) : 0;
    showOverlay("Range closed", reason + " Final score " + score + " over " + round + " rounds at " + accuracy + "% accuracy.", "Try again", true);
  }

  function shootAt(x, y) {
    if (state !== "playing" || paused) return;
    if (ammo <= 0) {
      message = "Out of ammo — press R to reload";
      return;
    }
    ammo--;
    fired++;
    shots.push({ x: x, y: y, at: 1 });
    let hitSomething = false;
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      if (Math.hypot(target.x - x, target.y - y) <= target.r) {
        const bonus = Math.round(target.r);
        score += 10 + bonus;
        hits++;
        hitSomething = true;
        targets.splice(i, 1);
        break;
      }
    }
    if (!hitSomething) score = Math.max(0, score - 3);
    const needed = Math.min(3, 1 + Math.floor(round / 2));
    while (targets.length < needed) spawnTarget();
    refreshHud();
    if (ammo === 0 && targets.length === 0) {
      endGame("You cleared every target in round " + round + ".");
    }
  }

  function reload() {
    if (state !== "playing") return;
    if (ammo > 0) {
      message = "Magazine still has " + ammo + " shots";
      return;
    }
    ammo = SHOTS_PER_ROUND;
    refreshHud();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    spawnTimer += dt;
    if (spawnTimer > 90 && targets.length < 4) {
      spawnTimer = 0;
      spawnTarget();
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      target.x += target.vx;
      target.y += target.vy;
      if (target.x - target.r < 0 || target.x + target.r > W) target.vx *= -1;
      if (target.y - target.r < 0 || target.y + target.r > H) target.vy *= -1;
      target.x = Math.max(target.r, Math.min(W - target.r, target.x));
      target.y = Math.max(target.r, Math.min(H - target.r, target.y));
      target.life--;
      if (target.life <= 0) {
        targets.splice(i, 1);
        score = Math.max(0, score - 5);
        message = "A target escaped";
        refreshHud();
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i].at -= dt / 260;
      if (shots[i].at <= 0) shots.splice(i, 1);
    }
    if (targets.length === 0 && ammo > 0 && state === "playing") {
      /* Round cleared: advance and reward accuracy. */
      const accuracy = fired ? hits / fired : 0;
      score += 25 + Math.round(accuracy * 30);
      round++;
      startRound(true);
    }
  }

  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.12)";
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = grid; x < W; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = grid; y < H; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const target of targets) {
      const ratio = Math.max(0.15, target.life / target.maxLife);
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
      ctx.fillStyle = ratio > 0.4 ? "#fb7185" : "#f59e0b";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "#0d1326";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = ratio > 0.4 ? "#fb7185" : "#f59e0b";
      ctx.fill();
    }
    for (const shot of shots) {
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 14 * (1.2 - shot.at), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34, 211, 238, " + Math.max(0, shot.at) + ")";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    /* Crosshair */
    ctx.strokeStyle = "rgba(242, 245, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI * 2);
    ctx.moveTo(pointer.x - 20, pointer.y);
    ctx.lineTo(pointer.x - 6, pointer.y);
    ctx.moveTo(pointer.x + 6, pointer.y);
    ctx.lineTo(pointer.x + 20, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 20);
    ctx.lineTo(pointer.x, pointer.y - 6);
    ctx.moveTo(pointer.x, pointer.y + 6);
    ctx.lineTo(pointer.x, pointer.y + 20);
    ctx.stroke();
  }

  /* Fixed-step animation frames keep the range identical on every
     refresh rate. */
  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    return {
      x: ((event.clientX || 0) - rect.left) * (W / (rect.width || W)),
      y: ((event.clientY || 0) - rect.top) * (H / (rect.height || H))
    };
  }

  canvas.addEventListener("pointermove", (event) => {
    pointer = pointFromEvent(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    const point = pointFromEvent(event);
    pointer = point;
    shootAt(point.x, point.y);
  });
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const point = pointFromEvent(touch);
    pointer = point;
    shootAt(point.x, point.y);
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toUpperCase();
    if (key === "R") reload();
    else if (key === "P") togglePause();
    else if (key === " " && state === "playing") shootAt(pointer.x, pointer.y);
  });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "Targets are frozen mid-flight.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startRound(false);
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void message;
})();
