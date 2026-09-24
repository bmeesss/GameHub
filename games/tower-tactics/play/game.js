/* Tower Tactics — original GameHub implementation.
   Lite tower defense: 3 tower types, upgrades, endless scaling sieges. */
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
  const goldEl = document.getElementById("gold");
  const livesEl = document.getElementById("lives");
  const waveEl = document.getElementById("wave");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const buildBar = document.getElementById("buildBar");
  const waveBtn = document.getElementById("waveBtn");
  const manageBar = document.getElementById("manageBar");
  const towerInfo = document.getElementById("towerInfo");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const sellBtn = document.getElementById("sellBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const PATH = [
    { x: -30, y: 80 }, { x: 520, y: 80 }, { x: 520, y: 200 },
    { x: 120, y: 200 }, { x: 120, y: 320 }, { x: 520, y: 320 },
    { x: 520, y: 430 }, { x: W + 30, y: 430 }
  ];
  const ROAD_HALF = 22;
  const TOWERS = {
    arrow: { cost: 50, range: 110, damage: 7, rate: 0.45, color: "#4ade80", name: "Arrow" },
    cannon: { cost: 100, range: 95, damage: 22, rate: 1.1, color: "#fb923c", name: "Cannon", splash: 46 },
    frost: { cost: 75, range: 90, damage: 3, rate: 0.6, color: "#22d3ee", name: "Frost", slow: 0.5 }
  };
  const FOES = {
    grunt: { hp: 30, speed: 62, reward: 8, leak: 1, r: 11, color: "#fb7185" },
    runner: { hp: 18, speed: 108, reward: 9, leak: 1, r: 9, color: "#fbbf24" },
    tank: { hp: 130, speed: 42, reward: 20, leak: 3, r: 15, color: "#a78bfa" }
  };

  let state = "ready";
  let gold = 120;
  let lives = 20;
  let wave = 0;
  let best = loadBest();
  let towers = [];
  let foes = [];
  let shots = [];
  let parts = [];
  let spawnQueue = [];
  let spawnTimer = 0;
  let buildKind = null;
  let selected = null;
  let hover = null;
  let last = 0;
  let lastBuildGold = -1;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_td_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_td_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function renderHud() {
    if (goldEl) goldEl.textContent = String(gold);
    if (livesEl) livesEl.textContent = String(lives);
    if (waveEl) waveEl.textContent = String(wave);
    if (waveBtn) {
      const busy = spawnQueue.length > 0 || foes.length > 0;
      waveBtn.disabled = busy || state !== "running";
      waveBtn.textContent = busy ? `Wave ${wave}…` : `Send wave ${wave + 1}`;
    }
    syncManage();
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

  function start() {
    gold = 120;
    lives = 20;
    wave = 0;
    towers = [];
    foes = [];
    shots = [];
    parts = [];
    spawnQueue = [];
    buildKind = null;
    selected = null;
    state = "running";
    hideOverlay();
    syncBuildButtons();
    renderHud();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Wave ${wave} · ${gold} gold · ${lives} lives.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = wave > best;
    if (record) {
      best = wave;
      saveBest();
    }
    showOverlay("The line has fallen!", `You held ${wave} siege${wave === 1 ? "" : "s"}.${record ? " New best!" : ` Best: ${best}.`}`, "Defend again");
  }

  function pathLength() {
    let total = 0;
    for (let i = 1; i < PATH.length; i++) {
      total += Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
    }
    return total;
  }

  function pointAt(distance) {
    let remaining = distance;
    for (let i = 1; i < PATH.length; i++) {
      const seg = Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
      if (remaining <= seg) {
        const t = seg === 0 ? 0 : remaining / seg;
        return {
          x: PATH[i - 1].x + (PATH[i].x - PATH[i - 1].x) * t,
          y: PATH[i - 1].y + (PATH[i].y - PATH[i - 1].y) * t
        };
      }
      remaining -= seg;
    }
    return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
  }

  function nearRoad(x, y) {
    for (let i = 1; i < PATH.length; i++) {
      const ax = PATH[i - 1].x;
      const ay = PATH[i - 1].y;
      const bx = PATH[i].x;
      const by = PATH[i].y;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
      const dist = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (dist < ROAD_HALF + 16) return true;
    }
    return false;
  }

  function sendWave() {
    if (state !== "running" || spawnQueue.length || foes.length) return;
    wave += 1;
    const count = 6 + wave * 2;
    for (let i = 0; i < count; i++) {
      let kind = "grunt";
      const roll = Math.random();
      if (wave >= 3 && roll < 0.2 + wave * 0.015) kind = "runner";
      if (wave >= 4 && roll > 0.9 - wave * 0.008) kind = "tank";
      const hpScale = 1 + (wave - 1) * 0.16;
      spawnQueue.push({ kind, hpScale, gap: i === 0 ? 0.4 : 0.55 });
    }
    if (wave % 5 === 0) {
      spawnQueue.push({ kind: "tank", hpScale: 1.6 + wave * 0.1, gap: 0.8 });
    }
    renderHud();
  }

  function upgradeCost(tower) {
    return Math.round(TOWERS[tower.kind].cost * 0.8 * tower.level);
  }

  function syncBuildButtons() {
    if (!buildBar) return;
    const buttons = buildBar.querySelectorAll("[data-build]");
    for (const button of buttons) {
      const kind = button.getAttribute("data-build");
      button.setAttribute("aria-pressed", String(buildKind === kind));
      button.disabled = state !== "running" || gold < (TOWERS[kind] ? TOWERS[kind].cost : 0);
    }
  }

  function syncManage() {
    if (!manageBar) return;
    if (!selected || !towers.includes(selected)) {
      selected = null;
      manageBar.hidden = true;
      return;
    }
    manageBar.hidden = false;
    const spec = TOWERS[selected.kind];
    if (towerInfo) towerInfo.textContent = `${spec.name} tower · level ${selected.level} · damage ${selected.damage}`;
    if (upgradeBtn) {
      if (selected.level >= 3) {
        upgradeBtn.textContent = "Max level";
        upgradeBtn.disabled = true;
      } else {
        upgradeBtn.textContent = `Upgrade ${upgradeCost(selected)}g`;
        upgradeBtn.disabled = gold < upgradeCost(selected);
      }
    }
    if (sellBtn) sellBtn.textContent = `Sell +${Math.round(selected.spent * 0.7)}g`;
  }

  function tryBuild(x, y) {
    if (!buildKind || state !== "running") return;
    const spec = TOWERS[buildKind];
    if (gold < spec.cost) return;
    if (x < 20 || y < 20 || x > W - 20 || y > H - 20 || nearRoad(x, y)) return;
    for (const tower of towers) {
      if (Math.hypot(tower.x - x, tower.y - y) < 34) return;
    }
    gold -= spec.cost;
    towers.push({ kind: buildKind, x, y, level: 1, damage: spec.damage, cooldown: 0, spent: spec.cost });
    buildKind = null;
    syncBuildButtons();
    renderHud();
  }

  function update(dt) {
    if (spawnQueue.length) {
      spawnQueue[0].gap -= dt;
      if (spawnQueue[0].gap <= 0) {
        const next = spawnQueue.shift();
        const spec = FOES[next.kind];
        foes.push({
          kind: next.kind,
          dist: 0,
          hp: spec.hp * next.hpScale,
          maxHp: spec.hp * next.hpScale,
          speed: spec.speed * (1 + wave * 0.012),
          slow: 0
        });
        renderHud();
      }
    }

    const total = pathLength();
    for (const foe of foes) {
      const spec = FOES[foe.kind];
      foe.slow = Math.max(foe.slow - dt, 0);
      const speed = spec.speed * (foe.slow > 0 ? 0.55 : 1);
      foe.dist += speed * dt;
      const pos = pointAt(foe.dist);
      foe.x = pos.x;
      foe.y = pos.y;
      if (foe.dist >= total) {
        foe.leaked = true;
        lives -= spec.leak;
        renderHud();
        if (lives <= 0) {
          lives = 0;
          gameOver();
          return;
        }
      }
    }
    foes = foes.filter((foe) => !foe.leaked && foe.hp > 0);

    for (const tower of towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const spec = TOWERS[tower.kind];
      let target = null;
      let bestDist = -1;
      for (const foe of foes) {
        if (Math.hypot(foe.x - tower.x, foe.y - tower.y) > spec.range) continue;
        if (foe.dist > bestDist) {
          bestDist = foe.dist;
          target = foe;
        }
      }
      if (target) {
        tower.cooldown = spec.rate;
        shots.push({ x: tower.x, y: tower.y - 12, target, kind: tower.kind, damage: tower.damage, speed: 420 });
      }
    }

    for (const shot of shots) {
      if (!foes.includes(shot.target) || shot.target.hp <= 0) {
        shot.dead = true;
        continue;
      }
      const dx = shot.target.x - shot.x;
      const dy = shot.target.y - shot.y;
      const dist = Math.hypot(dx, dy);
      const step = shot.speed * dt;
      if (dist <= step + 4) {
        shot.dead = true;
        hitFoe(shot.target, shot.damage, shot.kind);
      } else {
        shot.x += (dx / dist) * step;
        shot.y += (dy / dist) * step;
      }
    }
    shots = shots.filter((shot) => !shot.dead);

    for (const foe of foes.filter((f) => f.hp <= 0 && !f.counted)) {
      foe.counted = true;
      gold += FOES[foe.kind].reward;
      burst(foe.x, foe.y, FOES[foe.kind].color);
    }
    foes = foes.filter((foe) => foe.hp > 0);
    renderHud();
    if (gold !== lastBuildGold) {
      lastBuildGold = gold;
      syncBuildButtons();
    }
  }

  function hitFoe(foe, damage, kind) {
    const spec = TOWERS[kind];
    if (spec.splash) {
      for (const other of foes) {
        if (Math.hypot(other.x - foe.x, other.y - foe.y) <= spec.splash) {
          other.hp -= damage;
        }
      }
      burst(foe.x, foe.y, "#fb923c");
    } else {
      foe.hp -= damage;
      if (spec.slow) foe.slow = 1.6;
      burst(foe.x, foe.y, spec.color);
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 6; i++) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
        life: 0.35,
        color
      });
    }
  }

  function drawRoad() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2a3560";
    ctx.lineWidth = ROAD_HALF * 2 + 8;
    ctx.beginPath();
    PATH.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.strokeStyle = "#3d4a7d";
    ctx.lineWidth = ROAD_HALF * 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.arc(PATH[0].x + 30, PATH[0].y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.fillRect(W - 34, PATH[PATH.length - 1].y - 14, 22, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "800 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HQ", W - 23, PATH[PATH.length - 1].y + 4);
  }

  function render() {
    ctx.fillStyle = "#0d1f16";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(74, 222, 128, 0.05)";
    for (let y = 0; y < H; y += 40) {
      for (let x = ((y / 40) % 2) * 20; x < W; x += 40) {
        ctx.fillRect(x, y, 20, 20);
      }
    }
    drawRoad();

    for (const tower of towers) {
      const spec = TOWERS[tower.kind];
      if (tower === selected || tower === hover) {
        ctx.fillStyle = "rgba(242, 245, 255, 0.08)";
        ctx.strokeStyle = "rgba(242, 245, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, spec.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#1a2340";
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spec.color;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0f1a";
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "800 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("●".repeat(tower.level), tower.x, tower.y + 16);
      if (tower === selected) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 21, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (buildKind && hover && state === "running") {
      const spec = TOWERS[buildKind];
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = spec.color;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(242, 245, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, spec.range, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const foe of foes) {
      const spec = FOES[foe.kind];
      ctx.fillStyle = foe.slow > 0 ? "#a5f3fc" : spec.color;
      ctx.beginPath();
      ctx.arc(foe.x, foe.y, spec.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0f1a";
      ctx.beginPath();
      ctx.arc(foe.x - spec.r * 0.3, foe.y - 2, 2.4, 0, Math.PI * 2);
      ctx.arc(foe.x + spec.r * 0.3, foe.y - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      const width = spec.r * 2;
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(foe.x - width / 2, foe.y - spec.r - 9, width, 5);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(foe.x - width / 2, foe.y - spec.r - 9, (width * Math.max(foe.hp, 0)) / foe.maxHp, 5);
    }

    for (const shot of shots) {
      ctx.fillStyle = TOWERS[shot.kind].color;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.kind === "cannon" ? 5 : 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of parts) {
      ctx.globalAlpha = Math.max(p.life * 2.6, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    parts = parts.filter((p) => p.life > 0);
    if (state === "running") update(dt);
    render();
  }

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * W,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * H
    };
  }

  function towerAt(x, y) {
    return towers.find((tower) => Math.hypot(tower.x - x, tower.y - y) < 20) || null;
  }

  function tap(x, y) {
    if (state !== "running") return;
    if (buildKind) {
      tryBuild(x, y);
      return;
    }
    selected = towerAt(x, y);
    syncManage();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(event.clientX, event.clientY);
    hover = point;
    tap(point.x, point.y);
  });
  canvas.addEventListener("pointermove", (event) => {
    hover = canvasPoint(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointerleave", () => {
    hover = null;
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else if (state === "paused") togglePause();
      else sendWave();
    } else if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      if (state === "running" || state === "paused") togglePause();
    } else if (event.code === "Digit1") setBuild("arrow");
    else if (event.code === "Digit2") setBuild("cannon");
    else if (event.code === "Digit3") setBuild("frost");
  });

  function setBuild(kind) {
    if (state !== "running") return;
    buildKind = buildKind === kind ? null : kind;
    selected = null;
    syncBuildButtons();
    syncManage();
  }

  if (buildBar) {
    buildBar.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-build]") : null;
      if (button) setBuild(button.getAttribute("data-build"));
    });
  }
  if (waveBtn) waveBtn.addEventListener("click", sendWave);
  if (upgradeBtn) upgradeBtn.addEventListener("click", () => {
    if (!selected || selected.level >= 3) return;
    const cost = upgradeCost(selected);
    if (gold < cost) return;
    gold -= cost;
    selected.spent += cost;
    selected.level += 1;
    selected.damage = Math.round(selected.damage * 1.7);
    renderHud();
    syncBuildButtons();
  });
  if (sellBtn) sellBtn.addEventListener("click", () => {
    if (!selected) return;
    gold += Math.round(selected.spent * 0.7);
    towers = towers.filter((tower) => tower !== selected);
    selected = null;
    renderHud();
    syncBuildButtons();
  });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  renderHud();
  requestAnimationFrame(frame);
})();
