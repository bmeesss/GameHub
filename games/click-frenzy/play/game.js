/* Click Frenzy — original GameHub implementation.
   Ten-second click speed test with live CPS and personal best. */
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

  const pad = document.getElementById("pad");
  const padBig = document.getElementById("padBig");
  const padSub = document.getElementById("padSub");
  const clicksEl = document.getElementById("clicks");
  const timeEl = document.getElementById("timeLeft");
  const bestEl = document.getElementById("best");
  const newBtn = document.getElementById("newBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!pad) return;

  const DURATION = 10;
  let running = false;
  let clicks = 0;
  let timeLeft = DURATION;
  let timerId = null;
  let bestCps = loadBest();

  function loadBest() {
    try {
      const value = parseFloat(localStorage.getItem("gh_click_best"));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_click_best", String(bestCps));
    } catch (err) { /* storage unavailable */ }
  }

  function render() {
    if (clicksEl) clicksEl.textContent = String(clicks);
    if (timeEl) timeEl.textContent = timeLeft.toFixed(1);
    if (bestEl) bestEl.textContent = bestCps ? `${bestCps.toFixed(1)}` : "–";
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function start() {
    stopTimer();
    running = true;
    clicks = 0;
    timeLeft = DURATION;
    pad.classList.add("live");
    if (padBig) padBig.textContent = "GO!";
    if (padSub) padSub.textContent = "Click as fast as you can!";
    if (overlay) overlay.hidden = true;
    render();
    const startedAt = Date.now();
    timerId = setInterval(() => {
      timeLeft = Math.max(DURATION - (Date.now() - startedAt) / 1000, 0);
      render();
      if (timeLeft <= 0) finish();
    }, 50);
  }

  function finish() {
    stopTimer();
    running = false;
    pad.classList.remove("live");
    const cps = clicks / DURATION;
    const record = cps > bestCps;
    if (record) {
      bestCps = cps;
      saveBest();
    }
    render();
    const rank = cps >= 9 ? "Lightning fingers!" : cps >= 7 ? "Blazing fast!" : cps >= 5 ? "Great pace!" : cps >= 3 ? "Warming up!" : "Keep practicing!";
    if (overlayTitle) overlayTitle.textContent = rank;
    if (overlayText) overlayText.textContent = `${clicks} clicks — ${cps.toFixed(1)} per second.${record ? " New best!" : ""}`;
    if (primaryBtn) primaryBtn.textContent = "Go again";
    if (overlay) overlay.hidden = false;
    if (padBig) padBig.textContent = `${cps.toFixed(1)} CPS`;
    if (padSub) padSub.textContent = `${clicks} clicks in ${DURATION} seconds.`;
  }

  pad.addEventListener("click", () => {
    if (!running) return;
    clicks += 1;
    const elapsed = Math.max(DURATION - timeLeft, 0.2);
    if (padBig) padBig.textContent = String(clicks);
    if (padSub) padSub.textContent = `${(clicks / elapsed).toFixed(1)} clicks per second`;
    render();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    if (event.repeat && running) {
      pad.click();
      return;
    }
    if (!event.repeat) {
      if (!running && overlay && !overlay.hidden) start();
      else pad.click();
    }
  });

  if (primaryBtn) primaryBtn.addEventListener("click", start);
  if (newBtn) newBtn.addEventListener("click", start);

  render();
})();
