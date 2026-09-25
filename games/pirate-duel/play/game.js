/* Pirate Duel — original GameHub implementation.
   Turn-based artillery duel between two ships: angle, powder and a
   shifting wind. The AI plays the same rules as the player. */
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
  const angleEl = document.getElementById("angle");
  const powerEl = document.getElementById("power");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const modeBtn = document.getElementById("modeBtn");
  const fireBtn = document.getElementById("fireBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const SEA = H - 90;
  const BEST_KEY = "gh_best_pirate-duel";
  const GRAVITY = 0.16;

  const ships = [
    { x: 110, y: SEA - 8, hp: 100, name: "Player 1", color: "#38bdf8" },
    { x: W - 110, y: SEA - 8, hp: 100, name: "Player 2", color: "#fb7185" }
  ];
  let turn = 0;
  let angle = 45;
  let power = 60;
  let wind = 0.04;
  let mode = "ai";
  let shot = null;
  let splash = [];
  let state = "idle";
  let paused = false;
  let wins = readNumber(BEST_KEY);
  let message = "Set sail";
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

  function refreshHud() {
    if (turnEl) turnEl.textContent = mode === "ai" && turn === 1 ? "Computer" : "Player " + (turn + 1);
    if (angleEl) angleEl.textContent = String(Math.round(angle));
    if (powerEl) powerEl.textContent = String(Math.round(power));
    if (bestEl) bestEl.textContent = String(wins);
  }

  function resetDuel() {
    ships[0].hp = 100;
    ships[1].hp = 100;
    ships[0].x = 110;
    ships[1].x = W - 110;
    turn = 0;
    shot = null;
    splash = [];
    wind = (Math.random() - 0.5) * 0.09;
    angle = 45;
    power = 60;
    message = "Player 1 to fire";
    refreshHud();
  }

  function fire() {
    if (state !== "playing" || paused || shot) return;
    const ship = ships[turn];
    const radians = (angle * Math.PI) / 180;
    const speed = power / 10;
    const direction = turn === 0 ? 1 : -1;
    shot = {
      x: ship.x + direction * 26,
      y: ship.y - 18,
      vx: Math.cos(radians) * speed * direction,
      vy: -Math.sin(radians) * speed,
      owner: turn
    };
    message = "Shot away";
    refreshHud();
  }

  function settleShot() {
    const owner = shot ? shot.owner : turn;
    const opponent = 1 - owner;
    const damage = 12 + Math.round(Math.random() * 10);
    if (shot && Math.abs(shot.x - ships[opponent].x) < 46 && Math.abs(shot.y - ships[opponent].y) < 40) {
      ships[opponent].hp = Math.max(0, ships[opponent].hp - damage);
      message = "Direct hit — " + damage + " damage";
      for (let i = 0; i < 18; i++) {
        splash.push({ x: shot.x, y: shot.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, life: 30, color: "#f97316" });
      }
    } else {
      message = "Splash — the shot missed";
      for (let i = 0; i < 14; i++) {
        splash.push({ x: shot.x, y: Math.min(H - 6, shot.y), vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3.4, life: 26, color: "#93c5fd" });
      }
    }
    shot = null;
    if (ships[opponent].hp <= 0) {
      state = "over";
      if (owner === 0 || mode === "local") {
        wins++;
        writeNumber(BEST_KEY, wins);
      }
      refreshHud();
      showOverlay(ships[owner].name + " wins", "The enemy hull is at the bottom of the bay. Wins this browser: " + wins + ".", "Rematch", true);
      return;
    }
    turn = opponent;
    wind = Math.max(-0.09, Math.min(0.09, wind + (Math.random() - 0.5) * 0.03));
    refreshHud();
    if (mode === "ai" && turn === 1) scheduleAi();
  }

  function scheduleAi() {
    if (state !== "playing" || paused || mode !== "ai") return;
    const run = () => {
      if (state !== "playing" || paused || mode !== "ai" || turn !== 1 || shot) return;
      /* The AI solves a rough ballistic shot, then adds human error. */
      const shooter = ships[1];
      const target = ships[0];
      const dx = Math.abs(shooter.x - target.x);
      const spread = 2 + Math.random() * 5;
      for (let candidate = 20; candidate <= 80; candidate += 2) {
        const radians = (candidate * Math.PI) / 180;
        const speed = 6;
        const range = (speed * speed * Math.sin(2 * radians)) / GRAVITY;
        if (range >= dx) {
          angle = candidate;
          break;
        }
      }
      power = 60 + spread;
      fire();
    };
    if (typeof setTimeout === "function") aiTimer = setTimeout(run, 620);
    else run();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    const step = dt / 16.7;
    if (shot) {
      shot.x += shot.vx * step;
      shot.y += shot.vy * step;
      shot.vy += GRAVITY * step;
      shot.vx += wind * step * 0.6;
      const shipHit = ships.some((ship, index) => index !== shot.owner && Math.abs(shot.x - ship.x) < 46 && Math.abs(shot.y - ship.y) < 40);
      if (shipHit || shot.y >= H - 8 || shot.x < -10 || shot.x > W + 10) settleShot();
    }
    for (let i = splash.length - 1; i >= 0; i--) {
      const drop = splash[i];
      drop.x += drop.vx * step;
      drop.y += drop.vy * step;
      drop.vy += GRAVITY * 0.7 * step;
      drop.life -= step;
      if (drop.life <= 0) splash.splice(i, 1);
    }
  }

  function drawShip(ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.fillStyle = "#6b4a2b";
    ctx.beginPath();
    ctx.moveTo(-42, 0);
    ctx.lineTo(42, 0);
    ctx.lineTo(30, 20);
    ctx.lineTo(-30, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(-4, -34);
    ctx.lineTo(4, -34);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ship.color;
    ctx.beginPath();
    ctx.moveTo(6, -32);
    ctx.lineTo(30, -14);
    ctx.lineTo(6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(8, 11, 22, 0.6)";
    ctx.fillRect(-42, 0, 84, 5);
    ctx.restore();
    /* hull bar */
    ctx.fillStyle = "rgba(8, 11, 22, 0.6)";
    ctx.fillRect(ship.x - 40, ship.y - 60, 80, 8);
    ctx.fillStyle = ship.hp > 45 ? "#34d399" : ship.hp > 20 ? "#fbbf24" : "#fb7185";
    ctx.fillRect(ship.x - 40, ship.y - 60, 80 * (ship.hp / 100), 8);
  }

  function draw() {
    ctx.fillStyle = "#061529";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0c4a6e";
    ctx.fillRect(0, SEA, W, H - SEA);
    ctx.strokeStyle = "rgba(226, 232, 240, 0.12)";
    ctx.lineWidth = 2;
    for (let y = SEA + 14; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    drawShip(ships[0]);
    drawShip(ships[1]);
    if (shot) {
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    }
    for (const drop of splash) {
      ctx.globalAlpha = Math.max(0, drop.life / 30);
      ctx.fillStyle = drop.color;
      ctx.fillRect(drop.x - 2, drop.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    /* aiming guide for the active player */
    if (state === "playing" && !shot) {
      const ship = ships[turn];
      const radians = (angle * Math.PI) / 180;
      const direction = turn === 0 ? 1 : -1;
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y - 18);
      ctx.lineTo(ship.x + Math.cos(radians) * 60 * direction, ship.y - 18 - Math.sin(radians) * 60);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(242, 245, 255, 0.8)";
    ctx.font = "13px sans-serif";
    ctx.fillText(message + " · wind " + (wind >= 0 ? "→ " : "← ") + Math.abs(wind * 100).toFixed(0), 14, 22);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    resetDuel();
    state = "playing";
    paused = false;
    hideOverlay();
    if (mode === "ai" && turn === 1) scheduleAi();
  }

  function toggleMode() {
    mode = mode === "ai" ? "local" : "ai";
    if (modeBtn) modeBtn.textContent = mode === "ai" ? "Mode: vs AI" : "Mode: 2 players";
    refreshHud();
    if (state === "playing" && mode === "ai" && turn === 1) scheduleAi();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The sea holds its breath.", "Resume", true);
    else hideOverlay();
  }

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === "ArrowUp") { angle = Math.min(85, angle + 2); refreshHud(); }
    else if (key === "ArrowDown") { angle = Math.max(10, angle - 2); refreshHud(); }
    else if (key === "ArrowRight") { power = Math.min(100, power + 4); refreshHud(); }
    else if (key === "ArrowLeft") { power = Math.max(20, power - 4); refreshHud(); }
    else if (key === " ") { event.preventDefault(); fire(); }
    else if (key.toLowerCase() === "m") toggleMode();
    else if (key.toLowerCase() === "p") togglePause();
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state !== "playing" || paused || shot) return;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    const x = ((event.clientX || 0) - rect.left) * (W / (rect.width || W));
    const y = ((event.clientY || 0) - rect.top) * (H / (rect.height || H));
    const ship = ships[turn];
    const dx = Math.abs(x - ship.x);
    const dy = Math.max(6, ship.y - 18 - y);
    angle = Math.max(10, Math.min(85, Math.round((Math.atan2(dy, Math.max(6, dx)) * 180) / Math.PI)));
    power = Math.max(20, Math.min(100, Math.round(Math.hypot(dx, dy) * 0.7)));
    refreshHud();
  });

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    start();
  });
  pauseBtn?.addEventListener("click", togglePause);
  modeBtn?.addEventListener("click", toggleMode);
  fireBtn?.addEventListener("click", fire);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  resetDuel();
  draw();
  requestAnimationFrame(loop);
  void aiTimer;
})();
