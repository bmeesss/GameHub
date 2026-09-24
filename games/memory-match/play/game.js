/* Memory Match — original GameHub implementation.
   Concentration card game with CSS-shape faces, two board sizes. */
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

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const pairsEl = document.getElementById("pairs");
  const timerEl = document.getElementById("timer");
  const newBtn = document.getElementById("newBtn");
  const modeRow = document.getElementById("modeRow");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!boardEl) return;

  /* 18 distinct shape/color identities for the 6x6 board. */
  const FACES = [
    "circle", "square", "diamond", "triangle", "bar", "ring", "dot", "cross", "half",
    "circle alt0", "square alt1", "diamond alt2", "triangle alt3", "bar alt4",
    "ring alt5", "dot alt6", "cross alt7", "half alt8"
  ];
  const ALT_COLORS = ["#fbbf24", "#22d3ee", "#4ade80", "#fb7185", "#a78bfa", "#60a5fa", "#fb923c", "#f472b6", "#e2e8f0"];

  let size = 4;
  let deck = [];
  let first = null;
  let lock = false;
  let moves = 0;
  let matched = 0;
  let seconds = 0;
  let timerId = null;
  let started = false;

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      seconds += 1;
      if (timerEl) timerEl.textContent = String(seconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function renderHud() {
    if (movesEl) movesEl.textContent = String(moves);
    if (pairsEl) pairsEl.textContent = `${matched}/${deck.length / 2}`;
    if (timerEl) timerEl.textContent = String(seconds);
  }

  function build() {
    const pairCount = (size * size) / 2;
    const faces = FACES.slice(0, pairCount);
    deck = faces.concat(faces);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    first = null;
    lock = false;
    moves = 0;
    matched = 0;
    seconds = 0;
    started = false;
    stopTimer();
    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    while (boardEl.firstChild) boardEl.firstChild.remove();
    deck.forEach((face, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.setAttribute("role", "gridcell");
      card.dataset.index = String(index);
      card.setAttribute("aria-label", `Card ${index + 1}, face down`);
      const inner = document.createElement("span");
      inner.className = `face ${face}`;
      const alt = face.split(" ")[1];
      if (alt && alt.startsWith("alt")) {
        const colorIndex = parseInt(alt.slice(3), 10);
        if (Number.isFinite(colorIndex) && ALT_COLORS[colorIndex]) {
          inner.style.background = ALT_COLORS[colorIndex];
          if (face.startsWith("ring")) {
            inner.style.background = "transparent";
            inner.style.borderColor = ALT_COLORS[colorIndex];
          }
        }
      }
      inner.setAttribute("aria-hidden", "true");
      card.appendChild(inner);
      boardEl.appendChild(card);
    });
    if (overlay) overlay.hidden = true;
    renderHud();
  }

  function flip(card, index) {
    if (lock || card.classList.contains("open") || card.classList.contains("matched")) return;
    if (!started) {
      started = true;
      startTimer();
    }
    card.classList.add("open");
    card.setAttribute("aria-label", `Card ${index + 1}, revealed`);
    if (!first) {
      first = { card, index };
      return;
    }
    moves += 1;
    const second = { card, index };
    if (deck[first.index] === deck[second.index] && first.index !== second.index) {
      first.card.classList.add("matched");
      second.card.classList.add("matched");
      first.card.disabled = true;
      second.card.disabled = true;
      matched += 1;
      first = null;
      renderHud();
      if (matched === deck.length / 2) {
        stopTimer();
        const perfect = deck.length / 2;
        const rating = moves <= perfect + 4 ? "Flawless memory!" : moves <= perfect * 2 ? "Great recall!" : "Well done!";
        if (overlayTitle) overlayTitle.textContent = rating;
        if (overlayText) overlayText.textContent = `Cleared in ${moves} moves and ${seconds} seconds.`;
        if (overlay) overlay.hidden = false;
      }
      return;
    }
    lock = true;
    renderHud();
    const a = first.card;
    const b = second.card;
    first = null;
    setTimeout(() => {
      a.classList.remove("open");
      b.classList.remove("open");
      lock = false;
    }, 650);
  }

  boardEl.addEventListener("click", (event) => {
    const card = event.target && event.target.closest ? event.target.closest(".card") : null;
    if (!card) return;
    const index = parseInt(card.dataset.index, 10);
    if (Number.isFinite(index)) flip(card, index);
  });

  if (newBtn) newBtn.addEventListener("click", build);
  if (primaryBtn) primaryBtn.addEventListener("click", build);
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-size]") : null;
      if (!button) return;
      size = parseInt(button.getAttribute("data-size"), 10) === 6 ? 6 : 4;
      const buttons = modeRow.querySelectorAll("button");
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn === button));
      }
      build();
    });
  }

  build();
})();
