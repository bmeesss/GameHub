/* Asteroid Dodge — original GameHub implementation.
   Survival dodger: steer through a thickening rock storm, repair with cells. */
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
  const livesEl = document.getElementById("lives");
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
  const SHIP_R = 13;
  const SHIP_SPEED = 360;

  let state = "ready";
  let ship = { x: W / 2, y: H - 110 };
  let lives = 3;
  let score = 0;
  let best = loadBest();
  let elapsed = 0;
  let spawnTimer = 0;
  let cellTimer = 6;
  let invuln = 0;
  let rocks = [];
  let cells = [];
  let parts = [];
  let stars = [];
  let keys = {};
  let pointer = null;
  let last = 0;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_dodge_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_dodge_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (livesEl) livesEl.textContent = String(lives);
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

  function reset() {
    ship = { x: W / 2, y: H - 110 };
    lives = 3;
    score = 0;
    elapsed = 0;
    spawnTimer = 0.5;
    cellTimer = 6;
    invuln = 1;
    rocks = [];
    cells = [];
    parts = [];
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 1.4, v: 30 + Math.random() * 90 });
    }
    renderHud();
  }

  function start() {
    reset();
    state = "running";
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      showOverlay("Paused", `Score ${score} · ${elapsed.toFixed(1)}s survived.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const record = score > best;
    if (record) {
      best = score;
      saveBest();
    }
    renderHud();
    showOverlay("Ship destroyed", `Survived ${elapsed.toFixed(1)}s for ${score} points.${record ? " New best!" : ""}`, "Fly again");
  }

  function makeRock() {
    const big = elapsed > 25 && Math.random() < 0.25;
    const r = big ? 26 + Math.random() * 16 : 12 + Math.random() * 13;
    const verts = [];
    const count = 8 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      verts.push(0.72 + Math.random() * 0.4);
    }
    return {
      x: r + Math.random() * (W - r * 2),
      y: -r - 10,
      r,
      verts,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      vx: (Math.random() - 0.5) * 70,
      vy: 130 + Math.random() * 90 + elapsed * 3.2
    };
  }

  function explode(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.5) * 320,
        life: 0.5 + Math.random() * 0.25,
        color
      });
    }
  }

  function update(dt) {
    elapsed += dt;
    score = Math.floor(elapsed * 10);
    renderHud();
    invuln = Math.max(invuln - dt, 0);

    for (const star of stars) {
      star.y += star.v * dt;
      if (star.y > H) {
        star.y = -4;
        star.x = Math.random() * W;
      }
    }

    const step = SHIP_SPEED * dt;
    if (keys.ArrowLeft || keys.KeyA) ship.x -= step;
    if (keys.ArrowRight || keys.KeyD) ship.x += step;
    if (keys.ArrowUp || keys.KeyW) ship.y -= step;
    if (keys.ArrowDown || keys.KeyS) ship.y += step;
    if (pointer) {
      const dx = pointer.x - ship.x;
      const dy = pointer.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const move = Math.min(dist, SHIP_SPEED * 1.35 * dt);
        ship.x += (dx / dist) * move;
        ship.y += (dy / dist) * move;
      }
    }
    ship.x = Math.max(SHIP_R, Math.min(W - SHIP_R, ship.x));
    ship.y = Math.max(H * 0.3, Math.min(H - 26, ship.y));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.16, 0.62 - elapsed * 0.008);
      rocks.push(makeRock());
      if (elapsed > 20 && Math.random() < 0.4) rocks.push(makeRock());
    }
    cellTimer -= dt;
    if (cellTimer <= 0) {
      cellTimer = 7 + Math.random() * 5;
      cells.push({ x: 30 + Math.random() * (W - 60), y: -20, vy: 110 });
    }

    for (const rock of rocks) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.rot += rock.spin * dt;
      if (rock.x < -rock.r - 20) rock.x = W + rock.r + 10;
      if (rock.x > W + rock.r + 20) rock.x = -rock.r - 10;
      if (invuln <= 0 && Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r * 0.82 + SHIP_R * 0.8) {
        rock.dead = true;
        lives -= 1;
        invuln = 1.5;
        explode(ship.x, ship.y, "#fb7185", 20);
        renderHud();
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }
    rocks = rocks.filter((rock) => !rock.dead && rock.y < H + 60);

    for (const cell of cells) {
      cell.y += cell.vy * dt;
      if (Math.hypot(cell.x - ship.x, cell.y - ship.y) < SHIP_R + 12) {
        cell.taken = true;
        if (lives < 3) {
          lives += 1;
          renderHud();
        } else {
          score += 50;
        }
        explode(cell.x, cell.y, "#4ade80", 12);
      }
    }
    cells = cells.filter((cell) => !cell.taken && cell.y < H + 20);
  }

  function drawRock(rock) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.rot);
    ctx.fillStyle = "#3f3f5e";
    ctx.strokeStyle = "#8b8bb0";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    rock.verts.forEach((scale, i) => {
      const angle = (i / rock.verts.length) * Math.PI * 2;
      const px = Math.cos(angle) * rock.r * scale;
      const py = Math.sin(angle) * rock.r * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.arc(-rock.r * 0.25, -rock.r * 0.25, rock.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = "#05070f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(224, 231, 255, 0.8)";
    for (const star of stars) {
      ctx.globalAlpha = 0.3 + star.s * 0.3;
      ctx.fillRect(star.x, star.y, star.s, star.s * 2);
    }
    ctx.globalAlpha = 1;

    for (const cell of cells) {
      ctx.save();
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#052e16";
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#bbf7d0";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cell.x - 5, cell.y);
      ctx.lineTo(cell.x + 5, cell.y);
      ctx.moveTo(cell.x, cell.y - 5);
      ctx.lineTo(cell.x, cell.y + 5);
      ctx.stroke();
      ctx.restore();
    }

    for (const rock of rocks) drawRock(rock);

    if (invuln <= 0 || Math.floor(invuln * 12) % 2 === 0) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      const flame = 9 + Math.random() * 7;
      const flameGrad = ctx.createLinearGradient(0, 10, 0, 10 + flame + 12);
      flameGrad.addColorStop(0, "#fde047");
      flameGrad.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.lineTo(5, 10);
      ctx.lineTo(0, 10 + flame + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(11, 10);
      ctx.lineTo(0, 5);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.arc(0, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of parts) {
      ctx.globalAlpha = Math.max(p.life * 1.8, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
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
    else if (state === "ready") {
      for (const star of stars) {
        star.y += star.v * 0.4 * dt;
        if (star.y > H) star.y = -4;
      }
    }
    render();
  }

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * W,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * H
    };
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    keys[event.code] = true;
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if ((event.code === "Space" || event.code === "Enter") && state !== "running") {
      if (state === "paused") togglePause();
      else start();
    }
  });
  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });
  canvas.addEventListener("pointerdown", (event) => {
    pointer = canvasPoint(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons) pointer = canvasPoint(event.clientX, event.clientY);
  });
  window.addEventListener("pointerup", () => {
    pointer = null;
  });
  canvas.addEventListener("touchmove", (event) => {
    if (event.cancelable) event.preventDefault();
    const touch = event.changedTouches && event.changedTouches[0];
    if (touch) pointer = canvasPoint(touch.clientX, touch.clientY);
  }, { passive: false });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  reset();
  requestAnimationFrame(frame);
})();
