/* Quick Math — original GameHub implementation.
   Math sprint: rapid-fire arithmetic, streaks boost your score. */
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
  const questionEl = document.getElementById("question");
  const answersEl = document.getElementById("answers");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!questionEl || !answersEl) return;

  const BEST_KEY = "gh_best_quick-math";
  const ROUND_MS = 60000;

  let answer = 0;
  let score = 0;
  let streak = 0;
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

  function makeQuestion() {
    const kind = Math.floor(Math.random() * 3);
    let a = 0;
    let b = 0;
    let text = "";
    if (kind === 0) {
      a = 2 + Math.floor(Math.random() * 48);
      b = 2 + Math.floor(Math.random() * 48);
      answer = a + b;
      text = `${a} + ${b}`;
    } else if (kind === 1) {
      a = 5 + Math.floor(Math.random() * 60);
      b = 2 + Math.floor(Math.random() * a);
      answer = a - b;
      text = `${a} − ${b}`;
    } else {
      a = 2 + Math.floor(Math.random() * 11);
      b = 2 + Math.floor(Math.random() * 11);
      answer = a * b;
      text = `${a} × ${b}`;
    }
    if (questionEl) questionEl.textContent = `${text} = ?`;
    renderAnswers();
  }

  function renderAnswers() {
    while (answersEl.firstChild) answersEl.firstChild.remove();
    const options = new Set([answer]);
    let guard = 0;
    while (options.size < 4 && guard < 60) {
      guard += 1;
      const delta = 1 + Math.floor(Math.random() * Math.max(3, Math.floor(answer * 0.25)));
      const candidate = answer + (Math.random() < 0.5 ? -delta : delta);
      if (candidate >= 0 && candidate !== answer) options.add(candidate);
    }
    let filler = answer + 10;
    while (options.size < 4) {
      options.add(filler);
      filler += 1;
    }
    const list = [...options];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(value);
      button.setAttribute("aria-label", `Answer ${index + 1}: ${value}`);
      button.addEventListener("click", () => answerQuestion(value));
      answersEl.appendChild(button);
    });
  }

  function renderHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (streakEl) streakEl.textContent = String(streak);
    if (bestEl) bestEl.textContent = String(Math.max(best, streak));
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
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
    score = 0;
    streak = 0;
    remaining = ROUND_MS;
    endAt = now() + remaining;
    state = "running";
    makeQuestion();
    renderHud();
    hideOverlay();
    if (pauseBtn) pauseBtn.textContent = "Pause";
  }

  function togglePause() {
    if (state === "running") {
      remaining = Math.max(0, endAt - now());
      state = "paused";
      showOverlay("Paused", `Score ${score} · streak of ${streak}.`, "Resume");
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
    const record = streak > best || score > 0 && streak >= best && best === 0;
    if (streak > best) {
      best = streak;
      saveBest(best);
    }
    renderHud();
    showOverlay("Time!", `You scored ${score} points with a best streak of ${Math.max(best, streak)}.${record && streak > 0 ? " New best streak!" : ""}`, "Play again");
  }

  function answerQuestion(value) {
    if (state !== "running") return;
    if (value === answer) {
      streak += 1;
      score += 1 + Math.floor(streak / 5);
      if (streak > best) {
        best = streak;
        saveBest(best);
      }
    } else {
      streak = 0;
    }
    makeQuestion();
    renderHud();
  }

  function answerByIndex(index) {
    if (state !== "running") return;
    const buttons = answersEl.querySelectorAll("button");
    if (index >= 0 && index < buttons.length) {
      const value = parseInt(buttons[index].textContent, 10);
      if (Number.isFinite(value)) answerQuestion(value);
    }
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

  window.addEventListener("keydown", (event) => {
    const k = event.key || event.code || "";
    if (k >= "1" && k <= "4" && k.length === 1) {
      answerByIndex(parseInt(k, 10) - 1);
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

  renderHud();
  state = "ready";
  showOverlay("Quick Math", "Answer as many sums as you can in 60 seconds. Streaks are worth more.", "Start game");
  requestAnimationFrame(frame);
})();
