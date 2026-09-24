/* Mole Patrol — original GameHub implementation.
   30-second whack-a-mole reflex game with golden bonus moles. */
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

  const lawn = document.getElementById("lawn");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("timeLeft");
  const bestEl = document.getElementById("best");
  const newBtn = document.getElementById("newBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!lawn) return;

  const HOLES = 9;
  const DURATION = 30;
  let holes = [];
  let running = false;
  let score = 0;
  let best = loadBest();
  let timeLeft = DURATION;
  let clockId = null;
  let spawnId = null;
  let hideTimers = [];

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_mole_best"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_mole_best", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function render() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (timeEl) timeEl.textContent = String(Math.ceil(timeLeft));
    if (bestEl) bestEl.textContent = String(best);
  }

  function build() {
    while (lawn.firstChild) lawn.firstChild.remove();
    holes = [];
    for (let i = 0; i < HOLES; i++) {
      const hole = document.createElement("button");
      hole.type = "button";
      hole.className = "hole";
      hole.setAttribute("role", "gridcell");
      hole.setAttribute("aria-label", `Hole ${i + 1}`);
      const mole = document.createElement("span");
      mole.className = "mole";
      mole.setAttribute("aria-hidden", "true");
      const snout = document.createElement("span");
      snout.className = "snout";
      snout.setAttribute("aria-hidden", "true");
      mole.appendChild(snout);
      hole.appendChild(mole);
      hole.dataset.index = String(i);
      lawn.appendChild(hole);
      holes.push(hole);
    }
  }

  function clearTimers() {
    if (clockId !== null) {
      clearInterval(clockId);
      clockId = null;
    }
    if (spawnId !== null) {
      clearTimeout(spawnId);
      spawnId = null;
    }
    for (const id of hideTimers) clearTimeout(id);
    hideTimers = [];
  }

  function popMole() {
    if (!running) return;
    const free = holes.filter((hole) => !hole.classList.contains("up"));
    if (free.length) {
      const hole = free[Math.floor(Math.random() * free.length)];
      const golden = Math.random() < 0.12;
      hole.classList.toggle("golden", golden);
      hole.classList.add("up");
      hole.setAttribute("aria-label", golden ? "Golden mole! Bonk it!" : "Mole up! Bonk it!");
      const upTime = Math.max(420, 1050 - (DURATION - timeLeft) * 22);
      hideTimers.push(setTimeout(() => {
        hole.classList.remove("up", "golden");
      }, upTime));
    }
    const gap = Math.max(240, 750 - (DURATION - timeLeft) * 18);
    spawnId = setTimeout(popMole, gap * (0.7 + Math.random() * 0.6));
  }

  function start() {
    clearTimers();
    build();
    running = true;
    score = 0;
    timeLeft = DURATION;
    if (overlay) overlay.hidden = true;
    render();
    const startedAt = Date.now();
    clockId = setInterval(() => {
      timeLeft = Math.max(DURATION - (Date.now() - startedAt) / 1000, 0);
      render();
      if (timeLeft <= 0) finish();
    }, 100);
    spawnId = setTimeout(popMole, 400);
  }

  function finish() {
    clearTimers();
    running = false;
    for (const hole of holes) hole.classList.remove("up", "golden");
    const record = score > best;
    if (record) {
      best = score;
      saveBest();
    }
    render();
    const rank = score >= 60 ? "Legendary patrol!" : score >= 40 ? "Sharp reflexes!" : score >= 22 ? "Good patrol!" : "The moles thank you!";
    if (overlayTitle) overlayTitle.textContent = rank;
    if (overlayText) overlayText.textContent = `You bonked ${score} points worth of moles.${record ? " New best!" : ""}`;
    if (primaryBtn) primaryBtn.textContent = "Patrol again";
    if (overlay) overlay.hidden = false;
  }

  lawn.addEventListener("click", (event) => {
    const hole = event.target && event.target.closest ? event.target.closest(".hole") : null;
    if (!hole || !running || !hole.classList.contains("up")) return;
    score += hole.classList.contains("golden") ? 3 : 1;
    hole.classList.remove("up", "golden");
    hole.classList.add("bonked");
    setTimeout(() => hole.classList.remove("bonked"), 150);
    render();
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (newBtn) newBtn.addEventListener("click", start);

  build();
  render();
})();
