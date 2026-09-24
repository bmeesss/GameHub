/* Cloud Hopper — original GameHub implementation.
   Tile platformer: 3 hand-built sky islands, coins, spikes, grumblers. */
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
  const coinsEl = document.getElementById("coins");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const touchControls = document.getElementById("touchControls");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const TILE = 32;
  const COLS = 20;
  const ROWS = 12;
  const GRAV = 1400;
  const MOVE = 215;
  const JUMP = 470;
  const LEVELS = [
    [
      "....................",
      "....................",
      "....................",
      "........ooo.........",
      "....................",
      "..o.................",
      ".........#####......",
      "....o...........o...",
      "..#####......#####..",
      "P.....G...^.......F.",
      "####################",
      "####################"
    ],
    [
      "....................",
      "....................",
      "....................",
      "........ooo.........",
      "......#######.......",
      "..o.............o...",
      ".#####........####..",
      "....G...............",
      "..####...ooo........",
      "P......G..^.......F.",
      "########..######..##",
      "########..######..##"
    ],
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      ".####..........###..",
      "....G......G.oo.....",
      "...#####..######....",
      "..##....ooo.........",
      "P.....^.G.....^F....",
      "###..######..####..##",
      "###..######..####..##"
    ]
  ];

  let state = "ready";
  let levelIndex = 0;
  let coins = 0;
  let lives = 3;
  let solids = [];
  let coinTiles = [];
  let spikes = [];
  let foes = [];
  let flag = null;
  let spawn = { x: 32, y: 256 };
  let player = null;
  let coyote = 0;
  let jumpBuffer = 0;
  let banner = 0;
  let time = 0;
  let clouds = [];
  let keys = {};
  let touch = { left: false, right: false, jump: false };
  let last = 0;

  function renderHud() {
    if (coinsEl) coinsEl.textContent = String(coins);
    if (livesEl) livesEl.textContent = String(lives);
    if (levelEl) levelEl.textContent = `${Math.min(levelIndex + 1, LEVELS.length)}/${LEVELS.length}`;
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

  function isSolid(col, row) {
    if (col < 0 || col >= COLS) return true;
    if (row < 0 || row >= ROWS) return false;
    return solids[row][col];
  }

  function loadLevel(index) {
    const rows = LEVELS[index];
    solids = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    coinTiles = [];
    spikes = [];
    foes = [];
    flag = null;
    for (let row = 0; row < ROWS; row++) {
      const line = (rows[row] || "").padEnd(COLS, ".");
      for (let col = 0; col < COLS; col++) {
        const ch = line[col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === "#") solids[row][col] = true;
        else if (ch === "o") coinTiles.push({ x: x + TILE / 2, y: y + TILE / 2, taken: false });
        else if (ch === "^") spikes.push({ x: x + 4, y: y + 12, w: TILE - 8, h: TILE - 12 });
        else if (ch === "G") foes.push({ x, y: y + 6, w: 26, h: 26, dir: 1, speed: 60 + index * 14 });
        else if (ch === "P") spawn = { x, y: y + TILE - 28 };
        else if (ch === "F") flag = { x: x + 4, y, w: TILE - 8, h: TILE };
      }
    }
    respawn();
    banner = 1.6;
    renderHud();
  }

  function respawn() {
    player = {
      x: spawn.x, y: spawn.y, w: 22, h: 26,
      vx: 0, vy: 0, onGround: false, invuln: 1,
      face: 1
    };
    coyote = 0;
    jumpBuffer = 0;
  }

  function start() {
    levelIndex = 0;
    coins = 0;
    lives = 3;
    state = "running";
    clouds = [];
    for (let i = 0; i < 7; i++) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: 20 + Math.random() * 220,
        s: 0.5 + Math.random() * 0.9,
        v: 8 + Math.random() * 14
      });
    }
    loadLevel(0);
    hideOverlay();
    renderHud();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Level ${levelIndex + 1} · ${coins} coins · ${lives} lives.`, "Resume");
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
      showOverlay("Islands cleared!", `You hopped all ${LEVELS.length} islands with ${coins} coins and ${lives} ${lives === 1 ? "life" : "lives"} to spare!`, "Hop again");
    } else {
      showOverlay("Out of lives!", `You reached level ${levelIndex + 1} with ${coins} coins. The clouds await your return!`, "Try again");
    }
  }

  function hurt() {
    if (!player || player.invuln > 0) return;
    lives -= 1;
    renderHud();
    if (lives <= 0) {
      gameOver(false);
      return;
    }
    player.invuln = 1.6;
    player.vy = -360;
  }

  function fell() {
    lives -= 1;
    renderHud();
    if (lives <= 0) {
      gameOver(false);
      return;
    }
    respawn();
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveAndCollide(body, dt) {
    body.x += body.vx * dt;
    const top = Math.floor(body.y / TILE);
    const bottom = Math.floor((body.y + body.h - 1) / TILE);
    if (body.vx > 0) {
      const col = Math.floor((body.x + body.w) / TILE);
      for (let row = top; row <= bottom; row++) {
        if (isSolid(col, row)) {
          body.x = col * TILE - body.w - 0.01;
          body.vx = 0;
          body.hitWall = true;
          break;
        }
      }
    } else if (body.vx < 0) {
      const col = Math.floor(body.x / TILE);
      for (let row = top; row <= bottom; row++) {
        if (isSolid(col, row)) {
          body.x = (col + 1) * TILE + 0.01;
          body.vx = 0;
          body.hitWall = true;
          break;
        }
      }
    }
    body.y += body.vy * dt;
    body.onGround = false;
    const left = Math.floor((body.x + 1) / TILE);
    const right = Math.floor((body.x + body.w - 1) / TILE);
    if (body.vy >= 0) {
      const row = Math.floor((body.y + body.h) / TILE);
      for (let col = left; col <= right; col++) {
        if (isSolid(col, row)) {
          body.y = row * TILE - body.h;
          body.vy = 0;
          body.onGround = true;
          break;
        }
      }
    } else {
      const row = Math.floor(body.y / TILE);
      for (let col = left; col <= right; col++) {
        if (isSolid(col, row)) {
          body.y = (row + 1) * TILE + 0.01;
          body.vy = 0;
          break;
        }
      }
    }
  }

  function update(dt) {
    time += dt;
    if (banner > 0) banner -= dt;
    for (const cloud of clouds) {
      cloud.x += cloud.v * dt;
      if (cloud.x > canvas.width + 90) cloud.x = -90;
    }

    const left = keys.ArrowLeft || keys.KeyA || touch.left;
    const right = keys.ArrowRight || keys.KeyD || touch.right;
    player.vx = (right ? MOVE : 0) - (left ? MOVE : 0);
    if (player.vx !== 0) player.face = player.vx > 0 ? 1 : -1;
    player.vy = Math.min(player.vy + GRAV * dt, 760);
    if (player.onGround) coyote = 0.1;
    else coyote = Math.max(coyote - dt, 0);
    jumpBuffer = Math.max(jumpBuffer - dt, 0);
    if (jumpBuffer > 0 && coyote > 0) {
      player.vy = -JUMP;
      player.onGround = false;
      coyote = 0;
      jumpBuffer = 0;
    }
    player.invuln = Math.max(player.invuln - dt, 0);
    moveAndCollide(player, dt);
    if (player.y > ROWS * TILE + 30) {
      fell();
      return;
    }

    for (const coin of coinTiles) {
      if (coin.taken) continue;
      if (Math.abs(coin.x - (player.x + player.w / 2)) < 24 && Math.abs(coin.y - (player.y + player.h / 2)) < 28) {
        coin.taken = true;
        coins += 1;
        renderHud();
      }
    }

    for (const spike of spikes) {
      if (overlaps(player, spike)) {
        hurt();
        if (state !== "running") return;
        break;
      }
    }

    for (let i = foes.length - 1; i >= 0; i--) {
      const foe = foes[i];
      foe.hitWall = false;
      foe.vx = foe.dir * foe.speed;
      foe.vy = Math.min((foe.vy || 0) + GRAV * dt, 760);
      moveAndCollide(foe, dt);
      if (foe.hitWall) foe.dir *= -1;
      if (foe.onGround) {
        const aheadX = foe.dir > 0 ? foe.x + foe.w + 2 : foe.x - 2;
        const col = Math.floor(aheadX / TILE);
        const row = Math.floor((foe.y + foe.h + 4) / TILE);
        if (!isSolid(col, row)) foe.dir *= -1;
      }
      if (overlaps(player, foe)) {
        const stomping = player.vy > 0 && (player.y + player.h - foe.y) < 16;
        if (stomping) {
          foes.splice(i, 1);
          coins += 2;
          player.vy = -330;
          renderHud();
        } else {
          hurt();
          if (state !== "running") return;
        }
      }
    }

    if (flag && overlaps(player, flag)) {
      if (levelIndex + 1 >= LEVELS.length) {
        gameOver(true);
      } else {
        levelIndex += 1;
        loadLevel(levelIndex);
      }
    }
  }

  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#1b2a5e");
    sky.addColorStop(0.55, "#3b5fbf");
    sky.addColorStop(1, "#7cc7ee");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (const cloud of clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, 44 * cloud.s, 15 * cloud.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - 28 * cloud.s, cloud.y + 6 * cloud.s, 26 * cloud.s, 11 * cloud.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + 30 * cloud.s, cloud.y + 5 * cloud.s, 28 * cloud.s, 12 * cloud.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!solids[row][col]) continue;
        const x = col * TILE;
        const y = row * TILE;
        ctx.fillStyle = "#5b4a8a";
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#6f5db0";
        ctx.fillRect(x, y, TILE, 5);
        if (!isSolid(col, row - 1)) {
          ctx.fillStyle = "#4ade80";
          ctx.fillRect(x, y, TILE, 9);
          ctx.fillStyle = "#86efac";
          ctx.fillRect(x, y, TILE, 4);
        }
      }
    }

    for (const coin of coinTiles) {
      if (coin.taken) continue;
      const squash = Math.abs(Math.cos(time * 5 + coin.x)) * 0.6 + 0.4;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(coin.x, coin.y, 9 * squash, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.ellipse(coin.x, coin.y, 4.5 * squash, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#e2e8f0";
    for (const spike of spikes) {
      const n = 3;
      const w = spike.w / n;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(spike.x + i * w, spike.y + spike.h);
        ctx.lineTo(spike.x + i * w + w / 2, spike.y);
        ctx.lineTo(spike.x + (i + 1) * w, spike.y + spike.h);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (flag) {
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(flag.x + flag.w / 2 - 2, flag.y - 26, 4, TILE + 26);
      const wave = Math.sin(time * 6) * 3;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.moveTo(flag.x + flag.w / 2 + 2, flag.y - 26);
      ctx.lineTo(flag.x + flag.w / 2 + 30, flag.y - 18 + wave);
      ctx.lineTo(flag.x + flag.w / 2 + 2, flag.y - 8);
      ctx.closePath();
      ctx.fill();
    }

    for (const foe of foes) {
      const cx = foe.x + foe.w / 2;
      const cy = foe.y + foe.h / 2;
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.ellipse(cx, cy, foe.w / 2, foe.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0b0f1a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 6);
      ctx.lineTo(cx - 2, cy - 2);
      ctx.moveTo(cx + 9, cy - 6);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx - 5, cy + 2, 3.4, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy + 2, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0f1a";
      ctx.beginPath();
      ctx.arc(cx - 5 + foe.dir * 1.4, cy + 2, 1.6, 0, Math.PI * 2);
      ctx.arc(cx + 5 + foe.dir * 1.4, cy + 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (player && (player.invuln <= 0 || Math.floor(time * 14) % 2 === 0)) {
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.ellipse(cx, cy, player.w / 2 + 1, player.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 3, 4, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0f1a";
      ctx.beginPath();
      ctx.arc(cx - 4 + player.face * 1.6, cy - 3, 1.9, 0, Math.PI * 2);
      ctx.arc(cx + 6 + player.face * 1.6, cy - 3, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }

    if (banner > 0 && state === "running") {
      ctx.fillStyle = "rgba(11, 15, 26, 0.55)";
      ctx.fillRect(0, canvas.height / 2 - 34, canvas.width, 68);
      ctx.fillStyle = "#f2f5ff";
      ctx.font = "800 30px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Island ${levelIndex + 1}`, canvas.width / 2, canvas.height / 2 + 10);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === "running" && player) update(dt);
    render();
  }

  function pressJump() {
    jumpBuffer = 0.12;
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    if (!event.repeat && (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW")) {
      if (state === "ready" || state === "over") {
        start();
        return;
      }
      if (state === "running") pressJump();
    }
    keys[event.code] = true;
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if (event.code === "Enter" && state !== "running") {
      if (state === "paused") togglePause();
      else start();
    }
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
    if ((event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") && player && player.vy < -180) {
      player.vy = -180;
    }
  });
  if (touchControls) {
    const setAct = (act, on) => {
      if (act === "left") touch.left = on;
      if (act === "right") touch.right = on;
      if (act === "jump" && on) {
        if (state === "ready" || state === "over") start();
        else if (state === "running") pressJump();
      }
    };
    touchControls.addEventListener("pointerdown", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (!button) return;
      event.preventDefault();
      setAct(button.getAttribute("data-act"), true);
    });
    const release = (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-act]") : null;
      if (!button) {
        touch.left = false;
        touch.right = false;
        return;
      }
      const act = button.getAttribute("data-act");
      if (act !== "jump") setAct(act, false);
      if (act === "jump" && player && player.vy < -180) player.vy = -180;
    };
    touchControls.addEventListener("pointerup", release);
    touchControls.addEventListener("pointerleave", release);
    touchControls.addEventListener("pointercancel", release);
  }
  canvas.addEventListener("pointerdown", () => {
    if (state === "ready" || state === "over") start();
    else if (state === "running") pressJump();
  });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  for (let i = 0; i < 7; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 20 + Math.random() * 220,
      s: 0.5 + Math.random() * 0.9,
      v: 8 + Math.random() * 14
    });
  }
  loadLevel(0);
  levelIndex = 0;
  coins = 0;
  lives = 3;
  renderHud();
  requestAnimationFrame(frame);
})();
