/* Color Match — original GameHub implementation.
   Stroop-style reaction test: the word names a colour, the ink is
   another. Pick the ink. Correct answers extend the clock. */
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
  const streakEl = document.getElementById("streak");
  const timeEl = document.getElementById("time");
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
  const BEST_KEY = "gh_best_color-match";
  const ROUND_TIME = 30;

  const COLORS = [
    { name: "Red", hex: "#ef4444" },
    { name: "Blue", hex: "#3b82f6" },
    { name: "Green", hex: "#22c55e" },
    { name: "Yellow", hex: "#facc15" },
    { name: "Purple", hex: "#a855f7" },
    { name: "Orange", hex: "#f97316" }
  ];

  let options = [null, null, null, null];
  let word = "Red";
  let ink = COLORS[0];
  let score = 0;
  let streak = 0;
  let bestStreak = readNumber(BEST_KEY);
  let remaining = ROUND_TIME;
  let state = "idle";
  let paused = false;
  let flash = 0;
  let flashOk = true;
  let message = "Pick the ink colour";

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
    if (streakEl) streakEl.textContent = String(streak);
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining)));
    if (bestEl) bestEl.textContent = String(bestStreak);
  }

  const optionRects = () => {
    const rects = [];
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      rects.push({
        x: 40 + col * (W / 2 - 20),
        y: 250 + row * 82,
        w: W / 2 - 80,
        h: 66
      });
    }
    return rects;
  };

  function nextRound() {
    const inkIndex = Math.floor(Math.random() * COLORS.length);
    ink = COLORS[inkIndex];
    const others = COLORS.filter((color, index) => index !== inkIndex);
    const decoy = others[Math.floor(Math.random() * others.length)];
    word = Math.random() < 0.55 ? decoy.name : ink.name;
    const pool = COLORS.slice();
    options = [];
    while (options.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      options.push(pick);
    }
    if (!options.some((color) => color.name === ink.name)) options[0] = ink;
  }

  function answer(index) {
    if (state !== "playing" || paused) return;
    const chosen = options[index];
    if (!chosen) return;
    if (chosen.name === ink.name) {
      streak++;
      score += 10 + Math.min(20, streak * 2);
      remaining = Math.min(ROUND_TIME + 5, remaining + 1.4);
      message = "Correct";
      flash = 14;
      flashOk = true;
      if (streak > bestStreak) {
        bestStreak = streak;
        writeNumber(BEST_KEY, bestStreak);
      }
    } else {
      streak = 0;
      score = Math.max(0, score - 6);
      remaining = Math.max(0, remaining - 1.6);
      message = "That was the word, not the ink";
      flash = 14;
      flashOk = false;
    }
    refreshHud();
    nextRound();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    remaining -= dt / 1000;
    if (flash > 0) flash -= dt / 16.7;
    if (remaining <= 0) {
      remaining = 0;
      state = "over";
      if (streak > bestStreak) {
        bestStreak = streak;
        writeNumber(BEST_KEY, bestStreak);
      }
      refreshHud();
      showOverlay("Time up", "Score " + score + " with a best streak of " + bestStreak + " in a row.", "Run again", true);
    }
    refreshHud();
  }

  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(148, 163, 216, 0.08)";
    ctx.fillRect(0, 150, W, 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 74px sans-serif";
    ctx.fillStyle = ink.hex;
    ctx.fillText(word.toUpperCase(), W / 2, 96);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "rgba(242, 245, 255, 0.7)";
    ctx.fillText(message, W / 2, 160);
    const rects = optionRects();
    for (let i = 0; i < 4; i++) {
      const rect = rects[i];
      if (!rect) continue;
      const color = options[i] || COLORS[0];
      ctx.fillStyle = color.hex;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(242, 245, 255, 0.35)";
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    /* streak meter */
    ctx.fillStyle = "rgba(148, 163, 216, 0.2)";
    ctx.fillRect(40, H - 40, W - 80, 12);
    ctx.fillStyle = streak > 6 ? "#34d399" : "#22d3ee";
    ctx.fillRect(40, H - 40, (W - 80) * Math.min(1, streak / 12), 12);
    ctx.fillStyle = "rgba(242, 245, 255, 0.75)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("streak " + streak, 40, H - 18);
    if (flash > 0) {
      ctx.fillStyle = flashOk ? "rgba(52, 211, 153, " + (flash / 30) + ")" : "rgba(251, 113, 133, " + (flash / 30) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

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

  function handlePoint(point) {
    const rects = optionRects();
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h) {
        answer(i);
        return;
      }
    }
  }

  canvas.addEventListener("pointerdown", (event) => handlePoint(pointFromEvent(event)));
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) handlePoint(pointFromEvent(touch));
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (["1", "2", "3", "4"].indexOf(key) !== -1) {
      answer(parseInt(key, 10) - 1);
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });

  function start() {
    score = 0;
    streak = 0;
    remaining = ROUND_TIME;
    state = "playing";
    paused = false;
    flash = 0;
    message = "Pick the ink colour";
    nextRound();
    hideOverlay();
    refreshHud();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The clock is frozen — the colours are not.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    start();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  nextRound();
  refreshHud();
  draw();
  requestAnimationFrame(loop);
})();
