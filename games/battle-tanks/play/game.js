/* Battle Tanks — original GameHub implementation.
   Two tanks on one keyboard (or versus the built-in AI), crates that
   break, shells that bounce off the walls, rounds decided by the last
   tank standing. */
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
  const roundsEl = document.getElementById("rounds");
  const healthAEl = document.getElementById("health-a");
  const healthBEl = document.getElementById("health-b");
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
  const BEST_KEY = "gh_best_battle-tanks";
  const TANK_R = 17;
  const CRATE = 34;

  const CONTROLS = [
    { up: "w", down: "s", left: "a", right: "d", fire: "f" },
    { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", fire: "Enter" }
  ];

  let tanks = [];
  let crates = [];
  let shells = [];
  let sparks = [];
  let keys = {};
  let mode = "local";
  let roundWins = [0, 0];
  let best = readNumber(BEST_KEY);
  let state = "idle";
  let paused = false;
  let message = "Round 1";
  let aiTimer = null;
  let aiShootCooldown = 0;

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
    if (roundsEl) roundsEl.textContent = roundWins[0] + " - " + roundWins[1];
    if (healthAEl) healthAEl.textContent = String(tanks[0] ? tanks[0].hp : 3);
    if (healthBEl) healthBEl.textContent = String(tanks[1] ? tanks[1].hp : 3);
    if (bestEl) bestEl.textContent = String(best);
  }

  function buildCrates() {
    crates = [];
    for (let i = 0; i < 7; i++) {
      const x = CRATE * 2 + Math.random() * (W - CRATE * 4);
      const y = CRATE * 2 + Math.random() * (H - CRATE * 4);
      if (Math.abs(x - 70) < 90 && Math.abs(y - H / 2) < 70) continue;
      if (Math.abs(x - (W - 70)) < 90 && Math.abs(y - H / 2) < 70) continue;
      crates.push({ x: x, y: y, hp: 2 });
    }
  }

  function newRound(resetScore) {
    tanks = [
      { x: 70, y: H / 2, angle: 0, hp: 3, cooldown: 0, color: "#e879f9", id: 0 },
      { x: W - 70, y: H / 2, angle: Math.PI, hp: 3, cooldown: 0, color: "#22d3ee", id: 1 }
    ];
    shells = [];
    sparks = [];
    buildCrates();
    if (resetScore) roundWins = [0, 0];
    state = "playing";
    paused = false;
    aiShootCooldown = 900;
    message = "Round " + (roundWins[0] + roundWins[1] + 1);
    hideOverlay();
    refreshHud();
  }

  function blocked(x, y, radius) {
    if (x < radius || y < radius || x > W - radius || y > H - radius) return true;
    for (const crate of crates) {
      if (Math.abs(x - crate.x) < CRATE / 2 + radius - 4 && Math.abs(y - crate.y) < CRATE / 2 + radius - 4) return true;
    }
    return false;
  }

  function fire(tank) {
    if (state !== "playing" || paused || tank.cooldown > 0) return;
    tank.cooldown = 520;
    shells.push({
      x: tank.x + Math.cos(tank.angle) * (TANK_R + 6),
      y: tank.y + Math.sin(tank.angle) * (TANK_R + 6),
      vx: Math.cos(tank.angle) * 5.4,
      vy: Math.sin(tank.angle) * 5.4,
      owner: tank.id,
      life: 240
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.6;
      sparks.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 24, color: color });
    }
  }

  function endRound(winner) {
    roundWins[winner]++;
    if (roundWins[winner] > best) {
      best = roundWins[winner];
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
    state = "roundOver";
    showOverlay("Tank " + (winner + 1) + " wins the round", "Score: " + roundWins[0] + " - " + roundWins[1] + ". Crate layouts are random every round.", "Next round", true);
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    const step = dt / 16.7;
    aiShootCooldown = Math.max(0, aiShootCooldown - dt);

    for (const tank of tanks) {
      tank.cooldown = Math.max(0, tank.cooldown - dt);
      const keys2 = CONTROLS[tank.id];
      let move = 0;
      let turn = 0;
      const isAi = mode === "ai" && tank.id === 1;
      if (isAi) {
        const target = tanks[0];
        const desired = Math.atan2(target.y - tank.y, target.x - tank.x);
        let delta = desired - tank.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        turn = Math.abs(delta) > 0.08 ? Math.sign(delta) : 0;
        if (aiShootCooldown <= 0 && Math.abs(delta) < 0.18) {
          fire(tank);
          aiShootCooldown = Math.max(420, 1400 - roundWins[0] * 90);
        }
        if (Math.abs(delta) < 0.9 && Math.random() < 0.02) move = -1;
        if (Math.random() < 0.01) move = 1;
      } else {
        if (keys[keys2.up] || keys[keys2.up.toUpperCase()]) move = 1;
        if (keys[keys2.down] || keys[keys2.down.toUpperCase()]) move = -1;
        if (keys[keys2.left] || keys[keys2.left.toUpperCase()]) turn = -1;
        if (keys[keys2.right] || keys[keys2.right.toUpperCase()]) turn = 1;
        if (keys[keys2.fire] || keys[keys2.fire.toUpperCase()]) fire(tank);
      }
      tank.angle += turn * 0.05 * step;
      const nx = tank.x + Math.cos(tank.angle) * move * 2.1 * step;
      const ny = tank.y + Math.sin(tank.angle) * move * 2.1 * step;
      if (!blocked(nx, tank.y, TANK_R)) tank.x = nx;
      if (!blocked(tank.x, ny, TANK_R)) tank.y = ny;
    }

    for (let i = shells.length - 1; i >= 0; i--) {
      const shell = shells[i];
      shell.x += shell.vx * step;
      shell.y += shell.vy * step;
      shell.life -= step;
      if (shell.x < 4 || shell.x > W - 4) { shell.vx *= -1; shell.x = Math.max(4, Math.min(W - 4, shell.x)); }
      if (shell.y < 4 || shell.y > H - 4) { shell.vy *= -1; shell.y = Math.max(4, Math.min(H - 4, shell.y)); }
      if (shell.life <= 0) {
        shells.splice(i, 1);
        continue;
      }
      let removed = false;
      for (let c = crates.length - 1; c >= 0; c--) {
        const crate = crates[c];
        if (Math.abs(shell.x - crate.x) < CRATE / 2 + 3 && Math.abs(shell.y - crate.y) < CRATE / 2 + 3) {
          crate.hp--;
          if (crate.hp <= 0) {
            crates.splice(c, 1);
            burst(crate.x, crate.y, "#f59e0b");
          }
          shells.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (removed) continue;
      for (const tank of tanks) {
        if (tank.id === shell.owner) continue;
        if (Math.hypot(tank.x - shell.x, tank.y - shell.y) < TANK_R) {
          tank.hp--;
          shells.splice(i, 1);
          burst(tank.x, tank.y, tank.color);
          refreshHud();
          if (tank.hp <= 0) {
            endRound(1 - tank.id);
            return;
          }
          break;
        }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      spark.vx *= 0.96;
      spark.vy *= 0.96;
      spark.life -= step;
      if (spark.life <= 0) sparks.splice(i, 1);
    }
  }

  function drawTank(tank) {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);
    ctx.fillStyle = tank.color;
    ctx.fillRect(-TANK_R, -TANK_R * 0.8, TANK_R * 2, TANK_R * 1.6);
    ctx.fillStyle = "rgba(8, 11, 22, 0.75)";
    ctx.fillRect(-TANK_R * 0.55, -TANK_R * 0.55, TANK_R * 1.1, TANK_R * 1.1);
    ctx.fillRect(TANK_R * 0.6, -4, TANK_R * 1.2, 8);
    ctx.restore();
    ctx.fillStyle = "rgba(8, 11, 22, 0.6)";
    ctx.fillRect(tank.x - 20, tank.y - 30, 40, 5);
    ctx.fillStyle = "#34d399";
    ctx.fillRect(tank.x - 20, tank.y - 30, 40 * (Math.max(0, tank.hp) / 3), 5);
  }

  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148, 163, 216, 0.14)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (const crate of crates) {
      ctx.fillStyle = crate.hp > 1 ? "#b45309" : "#7c2d12";
      ctx.fillRect(crate.x - CRATE / 2, crate.y - CRATE / 2, CRATE, CRATE);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(crate.x - CRATE / 2, crate.y - CRATE / 2, CRATE, CRATE);
    }
    for (const shell of shells) {
      ctx.beginPath();
      ctx.arc(shell.x, shell.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    }
    for (const spark of sparks) {
      ctx.globalAlpha = Math.max(0, spark.life / 24);
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    if (state === "playing" || state === "roundOver") {
      for (const tank of tanks) drawTank(tank);
    }
    ctx.fillStyle = "rgba(242, 245, 255, 0.8)";
    ctx.font = "13px sans-serif";
    ctx.fillText(message + (mode === "ai" ? " · tank 2 is the AI" : " · local duel"), 14, 22);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(key) !== -1) event.preventDefault();
    keys[key] = true;
    if (key.toLowerCase() === "p") togglePause();
    else if (key.toLowerCase() === "m") toggleMode();
  });
  window.addEventListener("keyup", (event) => {
    keys[String(event.key || "")] = false;
  });

  function toggleMode() {
    mode = mode === "local" ? "ai" : "local";
    if (modeBtn) modeBtn.textContent = mode === "local" ? "Mode: 2 players" : "Mode: vs AI";
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "Both tanks hold their fire.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    if (state === "roundOver") {
      newRound(false);
      return;
    }
    newRound(true);
  });
  pauseBtn?.addEventListener("click", togglePause);
  modeBtn?.addEventListener("click", toggleMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  newRound(true);
  state = "idle";
  showOverlay("Battle Tanks", "Two tanks, destructible crates and bouncing shells. Player 1 steers with WASD and fires with F, player 2 uses the arrow keys and Enter — or let the AI take tank two.", "Start round", true);
  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void aiTimer;
})();
