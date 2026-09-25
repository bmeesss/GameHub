/* Typing Sprint — original GameHub implementation.
   Sixty seconds of typed words: live WPM, accuracy tracking and a
   local best kept in this browser only. */
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
  const wpmEl = document.getElementById("wpm");
  const accuracyEl = document.getElementById("accuracy");
  const wordsEl = document.getElementById("words");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const bufferEl = document.getElementById("buffer");
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
  const BEST_KEY = "gh_best_typing-sprint";
  const ROUND_TIME = 60;

  const WORDS = ("time game play level score speed quick light water house world music river cloud stone heart green night dream train bread happy mouse table chair sound brain peace plant space storm dance tiger lemon maple onion pixel laser robot magic ocean piano queen radio snake torch unity vocal wagon zebra amber blaze crane drift ember flame globe honey index joker kneel lucky mango noble olive pilot quirk roost solar tiger ultra vivid whale yacht zebra apple bacon canyon desert engine forest garden hunter island jungle kettle ladder meadow napkin orchard puzzle quiver ribbon saddle tunnel velvet wallet yellow zephyr bright candle danger effort flight gentle hammer invite jacket kitten legend marble needle orange pillow quartz rhythm silver target urgent village winter yoghurt basket circle donkey falcon groove helmet insect jigsaw magnet".split(" "));

  let target = "sprint";
  let typed = "";
  let index = 0;
  let wordsDone = 0;
  let correctChars = 0;
  let totalChars = 0;
  let remaining = ROUND_TIME;
  let elapsed = 0;
  let best = readNumber(BEST_KEY);
  let state = "idle";
  let paused = false;
  let message = "Type the word and press Space";
  let mistakes = 0;

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
      localStorage.setItem(key, String(Math.round(value * 10) / 10));
    } catch (err) { /* storage unavailable */ }
  }

  function showOverlay(title, text, label, visible) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = label;
    if (overlay) overlay.hidden = !visible;
  }

  const hideOverlay = () => { if (overlay) overlay.hidden = true; };

  function wpm() {
    const minutes = elapsed / 60;
    if (minutes <= 0.05) return 0;
    return Math.round((correctChars / 5) / minutes);
  }

  function accuracy() {
    if (!totalChars) return 100;
    return Math.max(0, Math.round((correctChars / totalChars) * 100));
  }

  function refreshHud() {
    if (wpmEl) wpmEl.textContent = String(wpm());
    if (accuracyEl) accuracyEl.textContent = accuracy() + "%";
    if (wordsEl) wordsEl.textContent = String(wordsDone);
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining)));
    if (bestEl) bestEl.textContent = String(best);
    if (bufferEl) {
      bufferEl.textContent = "Typing: " + (typed ? typed.toUpperCase() : "—") + " · space sends, backspace fixes, P pauses";
    }
  }

  function nextWord() {
    let pick = target;
    while (pick === target && WORDS.length > 1) {
      pick = WORDS[Math.floor(Math.random() * WORDS.length)];
    }
    target = pick;
    typed = "";
    index = 0;
    message = "Type the word and press Space";
    refreshHud();
  }

  function submit(delimiter) {
    if (state !== "playing" || paused) return;
    const guess = typed.trim().toLowerCase();
    totalChars += Math.max(1, guess.length);
    if (guess && guess === target) {
      correctChars += guess.length;
      wordsDone++;
      message = "Nice — " + wpm() + " WPM";
    } else {
      mistakes++;
      message = "Try again: " + target;
      totalChars += target.length;
    }
    nextWord();
    refreshHud();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    elapsed += dt / 1000;
    remaining -= dt / 1000;
    if (remaining <= 0) {
      remaining = 0;
      state = "over";
      const score = wpm();
      if (score > best) {
        best = score;
        writeNumber(BEST_KEY, best);
      }
      refreshHud();
      showOverlay("Sprint finished", score + " WPM at " + accuracy() + "% accuracy — " + wordsDone + " words, " + mistakes + " slip-ups. Local best: " + best + " WPM.", "Go again", true);
      return;
    }
    refreshHud();
  }

  function draw() {
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 58px monospace";
    for (let i = 0; i < target.length; i++) {
      const offset = (i - target.length / 2) * 40 + W / 2;
      const isTyped = i < typed.length;
      const ok = isTyped && typed[i] === target[i];
      ctx.fillStyle = isTyped ? (ok ? "#34d399" : "#fb7185") : "rgba(242, 245, 255, 0.85)";
      if (i === index && state === "playing") {
        ctx.fillStyle = "#22d3ee";
      }
      ctx.fillText(target[i], offset, 150);
      ctx.fillStyle = "rgba(148, 163, 216, 0.3)";
      ctx.fillRect(offset - 16, 196, 32, 3);
    }
    /* progress bar */
    const ratio = Math.max(0, remaining / ROUND_TIME);
    ctx.fillStyle = "rgba(148, 163, 216, 0.2)";
    ctx.fillRect(60, H - 70, W - 120, 14);
    ctx.fillStyle = ratio > 0.3 ? "#34d399" : "#fb7185";
    ctx.fillRect(60, H - 70, (W - 120) * ratio, 14);
    ctx.fillStyle = "rgba(242, 245, 255, 0.85)";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(wpm() + " WPM · " + accuracy() + "% · " + wordsDone + " words", W / 2, H - 30);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(148, 163, 216, 0.9)";
    ctx.fillText(message, W / 2, 250);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => {
    if (state !== "playing" || paused) {
      if (String(event.key || "").toLowerCase() === "p") togglePause();
      return;
    }
    const key = event.key;
    if (key === "Backspace") {
      event.preventDefault();
      typed = typed.slice(0, -1);
      index = typed.length;
      totalChars++;
      refreshHud();
      return;
    }
    if (key === " " || key === "Enter") {
      event.preventDefault();
      submit(key);
      return;
    }
    if (/^[a-zA-Z]$/.test(key) || key === "'" || key === "-") {
      if (typed.length < target.length + 2) {
        typed += key.toLowerCase();
        index = typed.length;
        if (typed.length > target.length) totalChars++;
        refreshHud();
      }
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });

  function start() {
    wordsDone = 0;
    correctChars = 0;
    totalChars = 0;
    mistakes = 0;
    remaining = ROUND_TIME;
    elapsed = 0;
    state = "playing";
    paused = false;
    nextWord();
    hideOverlay();
    refreshHud();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The clock is on hold. Your word stays right here.", "Resume", true);
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

  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void index;
})();
