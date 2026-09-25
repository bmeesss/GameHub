/* Ember Keep — original GameHub implementation.
   Night survival: keep the campfire alive, gather wood, outlast the wolves. */
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
  const nightEl = document.getElementById("night");
  const fuelEl = document.getElementById("fuel");
  const fuelBarEl = document.getElementById("fuel-bar");
  const woodEl = document.getElementById("wood");
  const heartsEl = document.getElementById("hearts");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const feedBtn = document.getElementById("feedBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const FIRE = { x: W / 2, y: H / 2 };
  const FIRE_R = 26;
  const PLAYER_SPEED = 2.5;
  const CARRY_MAX = 3;
  const NIGHT_LEN = 55; /* seconds */
  const WOOD_TARGET = 5;

  let player = null;
  let wolves = [];
  let woodPiles = [];
  let embers = [];
  let fuel = 100;
  let wood = 0;
  let hearts = 3;
  let night = 1;
  let nightTime = 0;
  let best = loadBest();
  let state = "ready";
  let keys = { up: false, down: false, left: false, right: false };
  let target = null;
  let wolfTimer = 0;
  let dawnTimer = 0;
  let hurtFlash = 0;
  let last = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_ember-keep"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_ember-keep", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function fuelDrain() {
    return 1.05 + night * 0.11;
  }

  function wolfInterval() {
    return Math.max(2.4, 5.8 - night * 0.45);
  }

  function wolfSpeed() {
    return 1.45 + night * 0.13;
  }

  function lightRadius() {
    return 70 + fuel * 1.7;
  }

  function spawnWood() {
    for (let i = woodPiles.length; i < WOOD_TARGET; i++) {
      let x;
      let y;
      let tries = 0;
      do {
        x = 40 + Math.random() * (W - 80);
        y = 40 + Math.random() * (H - 80);
        tries += 1;
      } while (Math.hypot(x - FIRE.x, y - FIRE.y) < 130 && tries < 30);
      woodPiles.push({ x, y, taken: false });
    }
  }

  function spawnWolf() {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? -20 : edge === 1 ? W + 20 : Math.random() * W;
    const y = edge === 2 ? -20 : edge === 3 ? H + 20 : Math.random() * H;
    wolves.push({ x, y, vx: 0, vy: 0, hurt: 0, phase: Math.random() * 6 });
  }

  function reset() {
    player = { x: FIRE.x, y: FIRE.y + 70, hurt: 0 };
    wolves = [];
    embers = [];
    fuel = 100;
    wood = 0;
    hearts = 3;
    night = 1;
    nightTime = 0;
    wolfTimer = 4;
    hurtFlash = 0;
    target = null;
    spawnWood();
    renderHud();
  }

  function renderHud() {
    if (nightEl) nightEl.textContent = String(night);
    if (fuelEl) fuelEl.textContent = `${Math.max(0, Math.round(fuel))}%`;
    if (fuelBarEl) fuelBarEl.style.width = `${Math.max(0, Math.min(100, fuel))}%`;
    if (woodEl) woodEl.textContent = `${wood}/${CARRY_MAX}`;
    if (heartsEl) heartsEl.textContent = "♥".repeat(Math.max(0, hearts)) || "—";
    if (bestEl) bestEl.textContent = best > 0 ? `${best} night${best === 1 ? "" : "s"}` : "—";
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

  function endGame(reason) {
    state = "over";
    if (night > best) {
      best = night;
      saveBest();
    }
    renderHud();
    showOverlay(reason, `You survived until night ${night}. Best: ${best} night${best === 1 ? "" : "s"}.`, "Try again");
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Night ${night} · fuel ${Math.round(fuel)}% · ${wood} wood carried.`, "Resume");
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
    }
  }

  function feedFire() {
    if (state !== "running" || wood <= 0) return;
    const near = Math.hypot(player.x - FIRE.x, player.y - FIRE.y) < FIRE_R + 46;
    if (!near) return;
    wood -= 1;
    fuel = Math.min(100, fuel + 26);
    for (let i = 0; i < 14; i++) {
      embers.push({ x: FIRE.x, y: FIRE.y, vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 2.4, life: 40 });
    }
    renderHud();
  }

  function hurtPlayer() {
    if (player.hurt > 0) return;
    hearts -= 1;
    player.hurt = 70;
    hurtFlash = 1;
    renderHud();
    if (hearts <= 0) endGame("Overwhelmed!");
  }

  function update(dt) {
    if (state === "dawn") {
      /* Interstitial between nights; dt is in frames (60 per second). */
      dawnTimer -= dt / 60;
      if (dawnTimer <= 0) {
        night += 1;
        fuel = Math.min(100, fuel + 30);
        nightTime = 0;
        wolfTimer = 4;
        spawnWood();
        state = "running";
        hideOverlay();
        renderHud();
      }
      return;
    }
    if (state !== "running") return;

    /* Player movement. */
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (target) {
      const tdx = target.x - player.x;
      const tdy = target.y - player.y;
      if (Math.hypot(tdx, tdy) > 8) {
        dx = tdx;
        dy = tdy;
      } else {
        target = null;
      }
    }
    const len = Math.hypot(dx, dy) || 1;
    player.x += (dx / len) * PLAYER_SPEED * dt;
    player.y += (dy / len) * PLAYER_SPEED * dt;
    player.x = Math.max(14, Math.min(W - 14, player.x));
    player.y = Math.max(14, Math.min(H - 14, player.y));
    if (player.hurt > 0) player.hurt -= dt;

    /* Auto-feed when standing by the fire. */
    if (wood > 0 && Math.hypot(player.x - FIRE.x, player.y - FIRE.y) < FIRE_R + 18) feedFire();

    /* Fuel + night timer. */
    fuel -= fuelDrain() * dt / 60;
    nightTime += dt / 60;
    if (fuel <= 0) {
      fuel = 0;
      endGame("The fire went out…");
      return;
    }
    if (nightTime >= NIGHT_LEN) {
      state = "dawn";
      dawnTimer = 2.6;
      wolves = [];
      target = null;
      showOverlay(`Night ${night} survived`, "Dawn breaks. The wolves retreat — stock up before dark.", "Continue");
      return;
    }

    /* Wood pickup. */
    for (const pile of woodPiles) {
      if (!pile.taken && wood < CARRY_MAX && Math.hypot(player.x - pile.x, player.y - pile.y) < 22) {
        pile.taken = true;
        wood += 1;
        renderHud();
      }
    }
    woodPiles = woodPiles.filter((p) => !p.taken);
    if (woodPiles.length < WOOD_TARGET) spawnWood();

    /* Wolves. */
    wolfTimer -= dt / 60;
    if (wolfTimer <= 0) {
      spawnWolf();
      wolfTimer = wolfInterval();
    }
    const light = lightRadius();
    for (const wolf of wolves) {
      wolf.phase += 0.15 * dt;
      const distFire = Math.hypot(wolf.x - FIRE.x, wolf.y - FIRE.y);
      const distPlayer = Math.hypot(wolf.x - player.x, wolf.y - player.y);
      let tx;
      let ty;
      if (distFire < light) {
        /* Fear the light: circle the edge of the glow. */
        const nx = (wolf.x - FIRE.x) / (distFire || 1);
        const ny = (wolf.y - FIRE.y) / (distFire || 1);
        tx = wolf.x + nx * 2 - ny * 0.8;
        ty = wolf.y + ny * 2 + nx * 0.8;
      } else if (distPlayer < 240) {
        tx = player.x;
        ty = player.y;
      } else {
        tx = FIRE.x;
        ty = FIRE.y;
      }
      const wdx = tx - wolf.x;
      const wdy = ty - wolf.y;
      const wlen = Math.hypot(wdx, wdy) || 1;
      wolf.x += (wdx / wlen) * wolfSpeed() * dt;
      wolf.y += (wdy / wlen) * wolfSpeed() * dt;
      if (wolf.hurt > 0) wolf.hurt -= dt;
      if (distPlayer < 20 && player.hurt <= 0) {
        hurtPlayer();
        /* Knock the wolf back after a hit. */
        const kx = (wolf.x - player.x) / (distPlayer || 1);
        const ky = (wolf.y - player.y) / (distPlayer || 1);
        wolf.x += kx * 60;
        wolf.y += ky * 60;
        wolf.hurt = 60;
      }
    }

    /* Embers. */
    for (const e of embers) {
      e.x += e.vx;
      e.y += e.vy;
      e.vy -= 0.03;
      e.life -= 1;
    }
    embers = embers.filter((e) => e.life > 0);
    if (Math.random() < 0.25) {
      embers.push({ x: FIRE.x + (Math.random() - 0.5) * 10, y: FIRE.y - 8, vx: (Math.random() - 0.5) * 0.7, vy: -0.9 - Math.random(), life: 50 });
    }
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - 0.04 * dt);
    renderHud();
  }

  function drawGround() {
    ctx.fillStyle = "#141c2b";
    ctx.fillRect(0, 0, W, H);
    /* Grass tufts */
    ctx.fillStyle = "rgba(74,222,128,.08)";
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % W;
      const y = (i * 213) % H;
      ctx.fillRect(x, y, 4, 2);
    }
    /* Camp ring */
    ctx.strokeStyle = "rgba(148,163,216,.25)";
    ctx.beginPath();
    ctx.arc(FIRE.x, FIRE.y, FIRE_R + 22, 0, Math.PI * 2);
    ctx.stroke();
    /* Wood piles */
    for (const pile of woodPiles) {
      ctx.fillStyle = "#6b4a2c";
      ctx.fillRect(pile.x - 9, pile.y - 5, 18, 10);
      ctx.fillRect(pile.x - 6, pile.y - 9, 12, 6);
      ctx.fillStyle = "#8a6238";
      ctx.fillRect(pile.x - 9, pile.y - 5, 18, 3);
    }
    /* Wolves */
    for (const wolf of wolves) {
      ctx.save();
      ctx.translate(wolf.x, wolf.y);
      ctx.fillStyle = wolf.hurt > 0 ? "#7c2d12" : "#334155";
      ctx.fillRect(-13, -7, 26, 12);
      ctx.fillRect(9, -12, 10, 8);
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(-10, 4, 4, 5);
      ctx.fillRect(6, 4, 4, 5);
      ctx.restore();
    }
    /* Fire */
    const flick = 1 + Math.sin(nightTime * 9) * 0.12;
    const fg = ctx.createRadialGradient(FIRE.x, FIRE.y, 2, FIRE.x, FIRE.y, FIRE_R * 1.5 * flick);
    fg.addColorStop(0, "#fef08a");
    fg.addColorStop(0.5, "#fb923c");
    fg.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(FIRE.x, FIRE.y, FIRE_R * 1.5 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#431407";
    ctx.fillRect(FIRE.x - 16, FIRE.y + 2, 32, 6);
    ctx.save();
    ctx.translate(FIRE.x, FIRE.y + 4);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, -20 * flick);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, -11 * flick);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (const e of embers) {
      ctx.fillStyle = `rgba(253,224,71,${e.life / 50})`;
      ctx.fillRect(e.x, e.y, 2.5, 2.5);
    }
    /* Player */
    if (player) {
      ctx.fillStyle = player.hurt > 0 ? "#fb7185" : "#e6edff";
      ctx.beginPath();
      ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(player.x, player.y - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDarkness() {
    const r = lightRadius();
    const dark = ctx.createRadialGradient(FIRE.x, FIRE.y, r * 0.45, FIRE.x, FIRE.y, r);
    dark.addColorStop(0, "rgba(2,4,12,0)");
    dark.addColorStop(1, "rgba(2,4,12,.93)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);
    /* Wolf eyes always glint in the dark. */
    for (const wolf of wolves) {
      const distFire = Math.hypot(wolf.x - FIRE.x, wolf.y - FIRE.y);
      if (distFire < r) continue;
      ctx.fillStyle = "rgba(251,191,36,.9)";
      ctx.fillRect(wolf.x + 11, wolf.y - 11, 2.6, 2.6);
      ctx.fillRect(wolf.x + 15, wolf.y - 11, 2.6, 2.6);
    }
    /* Wood piles glimmer faintly. */
    for (const pile of woodPiles) {
      ctx.fillStyle = "rgba(251,191,36,.35)";
      ctx.fillRect(pile.x - 1, pile.y - 14, 2, 2);
    }
    /* Player lantern glow. */
    if (player) {
      const pg = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
      pg.addColorStop(0, "rgba(226,232,255,.28)");
      pg.addColorStop(1, "rgba(226,232,255,0)");
      ctx.fillStyle = pg;
      ctx.fillRect(player.x - 36, player.y - 36, 72, 72);
    }
    if (hurtFlash > 0) {
      ctx.fillStyle = `rgba(251,113,133,${hurtFlash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    drawGround();
    drawDarkness();
    /* Fuel ring around the fire, drawn above the darkness. */
    ctx.strokeStyle = fuel > 30 ? "#4ade80" : "#fb7185";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(FIRE.x, FIRE.y, FIRE_R + 10, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, fuel) / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 16.666, 3) || 1;
    last = now;
    update(dt);
    draw();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.up = true;
    if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.down = true;
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = true;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = true;
    if (event.key === " ") {
      event.preventDefault();
      if (state === "running") feedFire();
      else if (state === "ready" || state === "over") start();
    }
    if (event.key === "Enter" && (state === "ready" || state === "over" || state === "dawn")) {
      if (state === "dawn") {
        dawnTimer = 0.01;
      } else {
        start();
      }
    }
    if (event.key === "p" || event.key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") keys.up = false;
    if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") keys.down = false;
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") keys.left = false;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") keys.right = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (state === "ready" || state === "over") {
      start();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? W / rect.width : 1;
    target = { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!target || state !== "running") return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width ? W / rect.width : 1;
    target = { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  });

  if (primaryBtn) {
    primaryBtn.addEventListener("click", () => {
      if (state === "dawn") {
        dawnTimer = 0.01;
      } else {
        start();
      }
    });
  }
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (feedBtn) feedBtn.addEventListener("click", feedFire);

  reset();
  state = "ready";
  showOverlay("Ember Keep", "Gather wood, keep the campfire fed and survive the night. Wolves fear the light — you should too.", "Light the fire");
  requestAnimationFrame(frame);
})();
