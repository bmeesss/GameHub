/* Number Rush — original GameHub implementation.
   Speed puzzler: tap tiles 1 to 25 in order against the clock. */
"use strict";
(function () {
  /* Play shell: fullscreen toggle. */
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

  const nextEl = document.getElementById("next");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const grid = document.getElementById("numGrid");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!grid) return;

  const BEST_KEY = "gh_best_number-rush";
  const TOTAL = 25;
  const PENALTY_MS = 2000;
  const BUFFER_MS = 1200;

  let next = 1;
  let mistakes = 0;
  let penaltyMs = 0;
  let bankedMs = 0;
  let stamp = 0;
  let buffer = "";
  let bufferAt = 0;
  let state = "ready";

  function loadBest() {
    try {
      const value = parseFloat(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (err) { /* storage unavailable */ }
  }

  let best = loadBest();

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function elapsed() {
    if (state === "running") return bankedMs + (now() - stamp) + penaltyMs;
    return bankedMs + penaltyMs;
  }

  function fmt(ms) {
    return (ms / 1000).toFixed(1);
  }

  function shuffled() {
    const tiles = [];
    for (let n = 1; n <= TOTAL; n++) tiles.push(n);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  function buildGrid() {
    while (grid.firstChild) grid.firstChild.remove();
    for (const n of shuffled()) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(n);
      button.setAttribute("data-n", String(n));
      button.setAttribute("aria-label", `Tile ${n}`);
      button.addEventListener("click", () => pressTile(n, button));
      grid.appendChild(button);
    }
  }

  function renderHud() {
    if (nextEl) nextEl.textContent = next > TOTAL ? "✓" : String(next);
    if (timeEl) timeEl.textContent = fmt(elapsed());
    if (bestEl) bestEl.textContent = best > 0 ? fmt(best * 1000) : "–";
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
    next = 1;
    mistakes = 0;
    penaltyMs = 0;
    bankedMs = 0;
    buffer = "";
    stamp = now();
    state = "running";
    buildGrid();
    renderHud();
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      bankedMs += now() - stamp;
      state = "paused";
      showOverlay("Paused", `Tile ${Math.min(next, TOTAL)} of ${TOTAL} · ${mistakes} mistake${mistakes === 1 ? "" : "s"}.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      stamp = now();
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    const total = elapsed() / 1000;
    const record = best <= 0 || total < best;
    if (record) {
      best = total;
      saveBest(best);
    }
    renderHud();
    showOverlay("Finished!", `All 25 tiles in ${fmt(total * 1000)}s with ${mistakes} mistake${mistakes === 1 ? "" : "s"}.${record ? " New best!" : ""}`, "Play again");
  }

  function pressTile(n, button) {
    if (state !== "running") return;
    if (n === next) {
      next += 1;
      if (button) {
        button.disabled = true;
        if (button.classList) button.classList.add("done");
      }
      if (next > TOTAL) {
        gameOver();
        return;
      }
    } else {
      mistakes += 1;
      penaltyMs += PENALTY_MS;
    }
    renderHud();
  }

  function typeDigit(digit) {
    if (state !== "running") return;
    if (now() - bufferAt > BUFFER_MS) buffer = "";
    buffer += digit;
    bufferAt = now();
    const want = String(next);
    if (buffer === want) {
      buffer = "";
      const buttons = grid.querySelectorAll("button");
      for (const button of buttons) {
        if (button.getAttribute("data-n") === want) {
          pressTile(next, button);
          break;
        }
      }
    } else if (!want.startsWith(buffer) || buffer.length >= want.length + 1) {
      buffer = "";
      mistakes += 1;
      penaltyMs += PENALTY_MS;
      renderHud();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    if (state !== "running") return;
    if (timeEl) timeEl.textContent = fmt(elapsed());
  }

  window.addEventListener("keydown", (event) => {
    const k = event.key || event.code || "";
    if (k >= "0" && k <= "9" && k.length === 1) {
      if (state === "running") typeDigit(k);
      return;
    }
    if (k === "p" || k === "P" || k === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
    } else if (k === " " || k === "Enter" || k === "Spacebar") {
      event.preventDefault();
      if (state === "ready" || state === "over") start();
      else togglePause();
    } else if (k === "r" || k === "R") {
      if (!event.repeat && state !== "ready") {
        event.preventDefault();
        start();
      }
    }
  });
  if (primaryBtn) primaryBtn.addEventListener("click", () => {
    if (state === "paused") togglePause();
    else start();
  });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  buildGrid();
  renderHud();
  state = "ready";
  showOverlay("Number Rush", "Tap every tile from 1 to 25 in order. Mistakes cost you 2 seconds each.", "Start game");
  requestAnimationFrame(frame);
})();
