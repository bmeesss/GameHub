/* Farm Defender — original GameHub implementation.
   Compact lane defence: critters follow a fixed path from the hedge
   to the barn, turrets are bought with coins and shoot the nearest
   target. Waves scale, the barn has ten lives. */
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
  const livesEl = document.getElementById("lives");
  const coinsEl = document.getElementById("coins");
  const waveEl = document.getElementById("wave");
  const bestEl = document.getElementById("best");
  const selectedEl = document.getElementById("selected");
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
  const BEST_KEY = "gh_best_farm-defender";
  const TILE = 46;
  const TURRETS = [
    { id: "scarecrow", name: "Scarecrow", cost: 30, range: 96, damage: 1, rate: 620, color: "#facc15" },
    { id: "sprinkler", name: "Sprinkler", cost: 55, range: 130, damage: 2, rate: 900, color: "#22d3ee" },
    { id: "bees", name: "Beehive", cost: 85, range: 74, damage: 1, rate: 260, color: "#fb923c" }
  ];

  /* Path from the hedge (left) to the barn (right). */
  const PATH = [
    { x: 0, y: 230 }, { x: 140, y: 230 }, { x: 140, y: 120 }, { x: 330, y: 120 },
    { x: 330, y: 330 }, { x: 540, y: 330 }, { x: 540, y: 200 }, { x: W - 40, y: 200 }
  ];

  let critters = [];
  let towers = [];
  let shots = [];
  let coins = 60;
  let lives = 10;
  let wave = 1;
  let spawnLeft = 0;
  let spawnTimer = 0;
  let selected = 0;
  let best = readNumber(BEST_KEY);
  let state = "idle";
  let paused = false;
  let placed = 0;

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

  const costOf = (index) => TURRETS[index].cost + placed * 4;

  function refreshHud() {
    if (livesEl) livesEl.textContent = String(Math.max(0, lives));
    if (coinsEl) coinsEl.textContent = String(coins);
    if (waveEl) waveEl.textContent = String(wave);
    if (bestEl) bestEl.textContent = String(best);
    if (selectedEl) selectedEl.textContent = TURRETS[selected].name + " (" + costOf(selected) + ")";
  }

  function pathLength() {
    let total = 0;
    for (let i = 1; i < PATH.length; i++) total += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
    return total;
  }

  const TOTAL_PATH = pathLength();

  function positionAt(distance) {
    let left = Math.max(0, distance);
    for (let i = 1; i < PATH.length; i++) {
      const segment = Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
      if (left <= segment) {
        const ratio = segment ? left / segment : 0;
        return {
          x: PATH[i - 1].x + (PATH[i].x - PATH[i - 1].x) * ratio,
          y: PATH[i - 1].y + (PATH[i].y - PATH[i - 1].y) * ratio
        };
      }
      left -= segment;
    }
    const last = PATH[PATH.length - 1];
    return { x: last.x, y: last.y };
  }

  function spawnCritter() {
    const tough = Math.random() < Math.min(0.4, wave * 0.05);
    critters.push({
      t: 0,
      speed: (0.9 + wave * 0.06 + Math.random() * 0.25) * (tough ? 0.7 : 1),
      hp: tough ? 3 + Math.floor(wave / 2) : 1 + Math.floor(wave / 3),
      maxHp: tough ? 3 + Math.floor(wave / 2) : 1 + Math.floor(wave / 3),
      tough: tough,
      x: PATH[0].x,
      y: PATH[0].y
    });
  }

  function startWave() {
    spawnLeft = 5 + wave * 2;
    spawnTimer = 0;
  }

  function placeTower(tx, ty) {
    const cost = costOf(selected);
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    if (coins < cost) return;
    if (onPath(x, y)) return;
    if (towers.some((tower) => Math.hypot(tower.x - x, tower.y - y) < TILE * 0.8)) return;
    towers.push({ x: x, y: y, spec: TURRETS[selected], cooldown: 0 });
    coins -= cost;
    placed++;
    refreshHud();
  }

  function onPath(x, y) {
    for (let i = 1; i < PATH.length; i++) {
      const ax = PATH[i - 1].x;
      const ay = PATH[i - 1].y;
      const bx = PATH[i].x;
      const by = PATH[i].y;
      const vx = bx - ax;
      const vy = by - ay;
      const length = vx * vx + vy * vy;
      const t = length ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / length)) : 0;
      if (Math.hypot(x - (ax + vx * t), y - (ay + vy * t)) < TILE * 0.75) return true;
    }
    return false;
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    const step = dt / 16.7;
    spawnTimer += dt;
    if (spawnLeft > 0 && spawnTimer > 720) {
      spawnTimer = 0;
      spawnLeft--;
      spawnCritter();
    }
    if (!spawnLeft && !critters.length && state === "playing") {
      wave++;
      coins += 25 + wave * 3;
      if (wave - 1 > best) {
        best = wave - 1;
        writeNumber(BEST_KEY, best);
      }
      startWave();
      refreshHud();
    }

    for (let i = critters.length - 1; i >= 0; i--) {
      const critter = critters[i];
      critter.t += critter.speed * step * 1.5;
      const point = positionAt(critter.t);
      critter.x = point.x;
      critter.y = point.y;
      if (critter.t >= TOTAL_PATH) {
        critters.splice(i, 1);
        lives--;
        refreshHud();
        if (lives <= 0) {
          state = "over";
          if (wave > best) {
            best = wave;
            writeNumber(BEST_KEY, best);
          }
          refreshHud();
          showOverlay("Barn raided", "The critters got through on wave " + wave + ". Local best: wave " + best + ".", "Try again", true);
          return;
        }
      }
    }

    for (const tower of towers) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) continue;
      let target = null;
      let bestDistance = Infinity;
      for (const critter of critters) {
        const distance = Math.hypot(critter.x - tower.x, critter.y - tower.y);
        if (distance < tower.spec.range && distance < bestDistance && critter.t > 0) {
          bestDistance = distance;
          target = critter;
        }
      }
      if (!target) continue;
      tower.cooldown = tower.spec.rate;
      shots.push({ x: tower.x, y: tower.y, tx: target.x, ty: target.y, life: 8, color: tower.spec.color });
      target.hp -= tower.spec.damage;
      if (target.hp <= 0) {
        const index = critters.indexOf(target);
        if (index !== -1) critters.splice(index, 1);
        coins += target.tough ? 12 : 6;
        refreshHud();
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i].life -= step;
      if (shots[i].life <= 0) shots.splice(i, 1);
    }
  }

  function draw() {
    ctx.fillStyle = "#1b3a1f";
    ctx.fillRect(0, 0, W, H);
    for (let gy = 0; gy < H; gy += TILE) {
      for (let gx = 0; gx < W; gx += TILE) {
        ctx.fillStyle = (gx / TILE + gy / TILE) % 2 === 0 ? "#24512b" : "#1f4626";
        ctx.fillRect(gx, gy, TILE - 2, TILE - 2);
      }
    }
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 26;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    /* barn */
    ctx.fillStyle = "#b45309";
    ctx.fillRect(W - 74, 150, 62, 100);
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.moveTo(W - 78, 152);
    ctx.lineTo(W - 43, 118);
    ctx.lineTo(W - 8, 152);
    ctx.closePath();
    ctx.fill();
    for (const tower of towers) {
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = tower.spec.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(8, 11, 22, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    for (const shot of shots) {
      ctx.strokeStyle = shot.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.tx, shot.ty);
      ctx.stroke();
    }
    for (const critter of critters) {
      const ratio = Math.max(0.2, critter.hp / critter.maxHp);
      ctx.beginPath();
      ctx.arc(critter.x, critter.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = critter.tough ? "#a855f7" : "#f472b6";
      ctx.fill();
      ctx.fillStyle = "rgba(8, 11, 22, 0.8)";
      ctx.fillRect(critter.x - 12, critter.y - 18, 24 * ratio, 4);
      ctx.beginPath();
      ctx.arc(critter.x - 4, critter.y - 3, 1.8, 0, Math.PI * 2);
      ctx.arc(critter.x + 4, critter.y - 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    /* ghost of the selected turret follows the pointer */
    if (state === "playing" && hover.x >= 0) {
      const gx = hover.x * TILE + TILE / 2;
      const gy = hover.y * TILE + TILE / 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(gx, gy, 15, 0, Math.PI * 2);
      ctx.fillStyle = TURRETS[selected].color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(gx, gy, TURRETS[selected].range, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const hover = { x: -1, y: -1 };

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  function tileFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
    const x = ((event.clientX || 0) - rect.left) * (W / (rect.width || W));
    const y = ((event.clientY || 0) - rect.top) * (H / (rect.height || H));
    return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE), x: x, y: y };
  }

  canvas.addEventListener("pointermove", (event) => {
    const point = tileFromEvent(event);
    hover.x = Math.max(0, Math.min(Math.floor(W / TILE) - 1, point.tx));
    hover.y = Math.max(0, Math.min(Math.floor(H / TILE) - 1, point.ty));
  });
  canvas.addEventListener("pointerdown", (event) => {
    const point = tileFromEvent(event);
    if (state === "playing" && !paused) placeTower(point.tx, point.ty);
  });
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const point = tileFromEvent(touch);
    if (state === "playing" && !paused) placeTower(point.tx, point.ty);
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === "1") { selected = 0; refreshHud(); }
    else if (key === "2") { selected = 1; refreshHud(); }
    else if (key === "3") { selected = 2; refreshHud(); }
    else if (key.toLowerCase() === "p") togglePause();
  });

  function startGame() {
    critters = [];
    towers = [];
    shots = [];
    coins = 60;
    lives = 10;
    wave = 1;
    placed = 0;
    state = "playing";
    paused = false;
    startWave();
    hideOverlay();
    refreshHud();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The critters are mid-march.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startGame();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
