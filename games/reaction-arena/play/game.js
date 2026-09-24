/* Reaction Arena — original GameHub implementation.
   Five-round reaction test with early-strike detection and best average. */
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

  const arena = document.getElementById("arena");
  const arenaTitle = document.getElementById("arenaTitle");
  const arenaText = document.getElementById("arenaText");
  const roundEl = document.getElementById("round");
  const lastEl = document.getElementById("last");
  const bestEl = document.getElementById("best");
  const newBtn = document.getElementById("newBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!arena) return;

  const ROUNDS = 5;
  let phase = "idle";
  let round = 0;
  let times = [];
  let timerId = null;
  let greenAt = 0;
  let bestAvg = loadBest();

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_reaction_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_reaction_best", String(bestAvg));
    } catch (err) { /* storage unavailable */ }
  }

  function fmt(ms) {
    return `${ms} ms`;
  }

  function renderHud() {
    if (roundEl) roundEl.textContent = round === 0 ? `–/${ROUNDS}` : `${Math.min(round, ROUNDS)}/${ROUNDS}`;
    if (lastEl) lastEl.textContent = times.length ? fmt(times[times.length - 1]) : "–";
    if (bestEl) bestEl.textContent = bestAvg ? fmt(bestAvg) : "–";
  }

  function setArena(mode, title, text) {
    arena.classList.remove("waiting", "ready");
    if (mode) arena.classList.add(mode);
    if (arenaTitle) arenaTitle.textContent = title;
    if (arenaText) arenaText.textContent = text;
  }

  function clearTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function startRound() {
    round += 1;
    phase = "waiting";
    renderHud();
    setArena("waiting", "Wait for green…", `Round ${Math.min(round, ROUNDS)} of ${ROUNDS}. Don't strike early!`);
    clearTimer();
    timerId = setTimeout(() => {
      phase = "go";
      greenAt = performance.now();
      setArena("ready", "STRIKE!", "Tap the arena now!");
    }, 1200 + Math.random() * 2800);
  }

  function finish() {
    phase = "done";
    const avg = Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
    const record = !bestAvg || avg < bestAvg;
    if (record) {
      bestAvg = avg;
      saveBest();
    }
    renderHud();
    const rank = avg < 220 ? "Superhuman reflexes!" : avg < 300 ? "Excellent reactions!" : avg < 420 ? "Solid reactions!" : "Keep training!";
    if (overlayTitle) overlayTitle.textContent = rank;
    if (overlayText) overlayText.textContent = `Average ${fmt(avg)} across ${ROUNDS} rounds.${record ? " New best average!" : ""}`;
    if (primaryBtn) primaryBtn.textContent = "Test again";
    if (overlay) overlay.hidden = false;
    setArena("", "Test complete", `Average reaction: ${fmt(avg)}.`);
  }

  function start() {
    clearTimer();
    round = 0;
    times = [];
    if (overlay) overlay.hidden = true;
    startRound();
  }

  arena.addEventListener("click", () => {
    if (phase === "waiting") {
      clearTimer();
      round = Math.max(round - 1, 0);
      phase = "idle";
      renderHud();
      setArena("", "Too early!", "You struck before green. Press the arena to retry the round.");
      phase = "retry";
      return;
    }
    if (phase === "retry") {
      startRound();
      return;
    }
    if (phase === "go") {
      const reaction = Math.round(performance.now() - greenAt);
      times.push(reaction);
      clearTimer();
      renderHud();
      if (times.length >= ROUNDS) {
        finish();
      } else {
        phase = "idle";
        setArena("", fmt(reaction), "Nice! Press the arena for the next round.");
        phase = "next";
      }
      return;
    }
    if (phase === "next") {
      startRound();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      arena.click();
    }
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (newBtn) newBtn.addEventListener("click", start);

  renderHud();
})();
