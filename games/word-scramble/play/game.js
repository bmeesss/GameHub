/* Word Scramble — original GameHub implementation.
   Word sprint: unscramble as many words as you can in 60 seconds. */
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

  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const streakEl = document.getElementById("streak");
  const skipsEl = document.getElementById("skips");
  const scrambledEl = document.getElementById("scrambled");
  const guessEl = document.getElementById("guess");
  const msgEl = document.getElementById("wordMsg");
  const submitBtn = document.getElementById("submitBtn");
  const skipBtn = document.getElementById("skipBtn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!scrambledEl || !guessEl) return;

  const BEST_KEY = "gh_best_word-scramble";
  const ROUND_MS = 60000;
  const WORDS = [
    "rocket", "planet", "pixel", "arcade", "quest", "dragon", "laser", "comet",
    "ninja", "robot", "galaxy", "puzzle", "turbo", "magic", "storm", "jungle",
    "ocean", "mountain", "forest", "desert", "castle", "knight", "wizard", "pirate",
    "guitar", "piano", "dance", "paint", "rocket2", "bridge", "cloud", "flame"
  ].map((w) => w.replace(/[0-9]/g, ""));

  let word = "";
  let scrambled = "";
  let solved = 0;
  let streak = 0;
  let skips = 3;
  let remaining = ROUND_MS;
  let endAt = 0;
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

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function shuffleWord(source) {
    const letters = source.split("");
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const mixed = letters.join("");
    return mixed === source && source.length > 1 ? shuffleWord(source) : mixed;
  }

  function pickWord() {
    let next = word;
    let guard = 0;
    while ((next === word || !next) && guard < 20) {
      next = WORDS[Math.floor(Math.random() * WORDS.length)];
      guard += 1;
    }
    word = next;
    scrambled = shuffleWord(word);
    if (scrambledEl) scrambledEl.textContent = scrambled.split("").join(" ");
    if (guessEl) {
      guessEl.value = "";
      guessEl.disabled = false;
    }
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(solved);
    if (bestEl) bestEl.textContent = String(Math.max(best, solved));
    if (streakEl) streakEl.textContent = String(streak);
    if (skipsEl) skipsEl.textContent = String(skips);
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
  }

  function say(text) {
    if (msgEl) msgEl.textContent = text;
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
    solved = 0;
    streak = 0;
    skips = 3;
    remaining = ROUND_MS;
    endAt = now() + remaining;
    state = "running";
    pickWord();
    say("");
    renderHud();
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
    if (guessEl && typeof guessEl.focus === "function") {
      try { guessEl.focus(); } catch (err) { /* focus unavailable */ }
    }
  }

  function togglePause() {
    if (state === "running") {
      remaining = Math.max(0, endAt - now());
      state = "paused";
      showOverlay("Paused", `${solved} word${solved === 1 ? "" : "s"} solved so far.`, "Resume");
      if (pauseBtn) pauseBtn.textContent = "Resume";
    } else if (state === "paused") {
      endAt = now() + remaining;
      state = "running";
      hideOverlay();
      if (pauseBtn) pauseBtn.textContent = "Pause";
    }
  }

  function gameOver() {
    state = "over";
    remaining = 0;
    const record = solved > best;
    if (record) {
      best = solved;
      saveBest(best);
    }
    renderHud();
    if (guessEl) guessEl.disabled = true;
    showOverlay("Time!", `You solved ${solved} word${solved === 1 ? "" : "s"}.${record && solved > 0 ? " New best!" : ""}`, "Play again");
  }

  function submitGuess() {
    if (state !== "running") return;
    const guess = String(guessEl.value || "").trim().toLowerCase();
    if (!guess) return;
    if (guess === word) {
      solved += 1;
      streak += 1;
      if (solved > best) {
        best = solved;
        saveBest(best);
      }
      say(streak >= 3 ? `On fire! Streak of ${streak}.` : "Correct! +1");
      pickWord();
    } else {
      streak = 0;
      say(`"${guess}" is not it — try again.`);
    }
    if (guessEl) guessEl.value = "";
    renderHud();
  }

  function skipWord() {
    if (state !== "running" || skips <= 0) return;
    skips -= 1;
    streak = 0;
    say(`Skipped — the word was "${word}".`);
    pickWord();
    renderHud();
  }

  function reshuffle() {
    if (state !== "running") return;
    scrambled = shuffleWord(word);
    if (scrambledEl) scrambledEl.textContent = scrambled.split("").join(" ");
  }

  function frame() {
    requestAnimationFrame(frame);
    if (state !== "running") return;
    remaining = endAt - now();
    if (remaining <= 0) {
      gameOver();
      return;
    }
    if (timeEl) timeEl.textContent = String(Math.ceil(remaining / 1000));
  }

  function inField(event) {
    const tag = event.target && event.target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  }

  window.addEventListener("keydown", (event) => {
    const k = event.key || event.code || "";
    if (inField(event)) {
      if (k === "Escape" && guessEl && typeof guessEl.blur === "function") {
        try { guessEl.blur(); } catch (err) { /* noop */ }
      }
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
      if (!event.repeat) {
        if (state === "ready" || state === "over") start();
        else reshuffle();
      }
    }
  });
  if (guessEl) guessEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitGuess();
    }
  });
  if (submitBtn) submitBtn.addEventListener("click", submitGuess);
  if (skipBtn) skipBtn.addEventListener("click", skipWord);
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
  showOverlay("Word Scramble", "Unscramble the letters before the 60-second clock runs out.", "Start game");
  requestAnimationFrame(frame);
})();
