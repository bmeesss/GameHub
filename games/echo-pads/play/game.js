/* Echo Pads — original GameHub implementation.
   Memory duel: watch the glowing pattern, then echo it back. */
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

  const roundEl = document.getElementById("round");
  const bestEl = document.getElementById("best");
  const padsEl = document.getElementById("pads");
  const statusEl = document.getElementById("padStatus");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!padsEl) return;

  const BEST_KEY = "gh_best_echo-pads";

  let sequence = [];
  let phase = "idle";
  let playIndex = 0;
  let echoIndex = 0;
  let clock = 0;
  let nextAt = 0;
  let litPad = -1;
  let litUntil = 0;
  let state = "ready";

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem(BEST_KEY), 10);
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

  function padButtons() {
    return padsEl.querySelectorAll("button");
  }

  function flashMs() {
    return Math.max(220, 450 - sequence.length * 12);
  }

  function gapMs() {
    return Math.max(120, 260 - sequence.length * 8);
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function light(pad, on) {
    const buttons = padButtons();
    if (pad < 0 || pad >= buttons.length) return;
    if (buttons[pad].classList) buttons[pad].classList.toggle("lit", on);
  }

  function clearLights() {
    const buttons = padButtons();
    for (const button of buttons) {
      if (button.classList) button.classList.remove("lit");
    }
    litPad = -1;
  }

  function renderHud() {
    if (roundEl) roundEl.textContent = String(Math.max(1, sequence.length));
    if (bestEl) bestEl.textContent = String(best);
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
    sequence = [Math.floor(Math.random() * 4)];
    phase = "watch";
    playIndex = 0;
    echoIndex = 0;
    clock = 0;
    nextAt = 0.7;
    clearLights();
    state = "running";
    setStatus("Watch carefully…");
    renderHud();
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      clearLights();
      showOverlay("Paused", `Round ${sequence.length}. The pattern waits for you.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      state = "running";
      if (phase === "watch") {
        playIndex = 0;
        nextAt = clock + 0.5;
        setStatus("Watch carefully…");
      } else {
        setStatus("Your turn — echo it back.");
      }
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    clearLights();
    const completed = sequence.length - 1;
    const record = completed > best;
    if (record) {
      best = completed;
      saveBest(best);
    }
    renderHud();
    setStatus("Press Start to try again.");
    showOverlay("Wrong pad!", `You echoed ${completed} round${completed === 1 ? "" : "s"}.${record && completed > 0 ? " New best!" : ""}`, "Play again");
  }

  function pressPad(pad) {
    if (state !== "running" || phase !== "echo") return;
    if (pad < 0 || pad > 3) return;
    light(pad, true);
    litPad = pad;
    litUntil = clock + 0.18;
    if (pad === sequence[echoIndex]) {
      echoIndex += 1;
      if (echoIndex >= sequence.length) {
        const completed = sequence.length;
        if (completed > best) {
          best = completed;
          saveBest(best);
        }
        sequence.push(Math.floor(Math.random() * 4));
        phase = "watch";
        playIndex = 0;
        nextAt = clock + 0.9;
        setStatus("Correct! Watch the next one…");
        renderHud();
      }
    } else {
      gameOver();
    }
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state !== "running") return;
    clock += dt;
    if (litPad !== -1 && clock >= litUntil && phase === "echo") {
      light(litPad, false);
      litPad = -1;
    }
    if (phase !== "watch" || clock < nextAt) return;
    if (litPad !== -1) {
      light(litPad, false);
      litPad = -1;
      nextAt = clock + gapMs() / 1000;
      return;
    }
    if (playIndex >= sequence.length) {
      phase = "echo";
      echoIndex = 0;
      setStatus("Your turn — echo it back.");
      return;
    }
    const pad = sequence[playIndex];
    playIndex += 1;
    light(pad, true);
    litPad = pad;
    litUntil = clock + flashMs() / 1000;
    nextAt = litUntil;
  }

  window.addEventListener("keydown", (event) => {
    const k = event.key || event.code || "";
    if (k >= "1" && k <= "4" && k.length === 1) {
      pressPad(parseInt(k, 10) - 1);
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
  padsEl.addEventListener("click", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("[data-pad]") : null;
    if (!button) return;
    pressPad(parseInt(button.getAttribute("data-pad"), 10));
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
  state = "ready";
  showOverlay("Echo Pads", "Watch the pattern, then echo it back pad by pad.", "Start game");
  requestAnimationFrame(frame);
})();
