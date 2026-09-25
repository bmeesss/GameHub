/* Reversi — original GameHub implementation.
   Classic disc-flipping duel against a positional AI or a friend. */
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
  const darkEl = document.getElementById("dark");
  const lightEl = document.getElementById("light");
  const turnEl = document.getElementById("turn");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const modeBtn = document.getElementById("modeBtn");
  if (!boardEl) return;

  const N = 8;
  const EMPTY = 0;
  const DARK = 1;
  const LIGHT = 2;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  /* Corner-heavy positional weights steer the AI toward strong squares. */
  const WEIGHTS = [
    99, -8, 8, 6, 6, 8, -8, 99,
    -8, -12, -4, -3, -3, -4, -12, -8,
    8, -4, 6, 4, 4, 6, -4, 8,
    6, -3, 4, 2, 2, 4, -3, 6,
    6, -3, 4, 2, 2, 4, -3, 6,
    8, -4, 6, 4, 4, 6, -4, 8,
    -8, -12, -4, -3, -3, -4, -12, -8,
    99, -8, 8, 6, 6, 8, -8, 99
  ];

  let board = [];
  let turn = DARK;
  let twoPlayer = false;
  let over = false;
  let best = loadBest();
  let passStreak = 0;
  let aiTimer = null;

  function loadBest() {
    try {
      const value = parseInt(localStorage.getItem("gh_best_reversi"), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem("gh_best_reversi", String(best));
    } catch (err) { /* storage unavailable */ }
  }

  function inBounds(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  function flipsFor(r, c, player) {
    if (board[r * N + c] !== EMPTY) return [];
    const out = [];
    for (const [dr, dc] of DIRS) {
      const line = [];
      let rr = r + dr;
      let cc = c + dc;
      while (inBounds(rr, cc) && board[rr * N + cc] === (player === DARK ? LIGHT : DARK)) {
        line.push(rr * N + cc);
        rr += dr;
        cc += dc;
      }
      if (line.length && inBounds(rr, cc) && board[rr * N + cc] === player) {
        for (const i of line) out.push(i);
      }
    }
    return out;
  }

  function legalMoves(player) {
    const moves = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const flips = flipsFor(r, c, player);
        if (flips.length) moves.push({ r, c, flips });
      }
    }
    return moves;
  }

  function counts() {
    let dark = 0;
    let light = 0;
    for (const cell of board) {
      if (cell === DARK) dark += 1;
      else if (cell === LIGHT) light += 1;
    }
    return { dark, light };
  }

  function renderHud() {
    const { dark, light } = counts();
    if (darkEl) darkEl.textContent = String(dark);
    if (lightEl) lightEl.textContent = String(light);
    if (turnEl) {
      if (over) turnEl.textContent = "Finished";
      else if (turn === DARK) turnEl.textContent = twoPlayer ? "Dark's turn" : "Your turn";
      else turnEl.textContent = twoPlayer ? "Light's turn" : "AI thinking…";
    }
    if (bestEl) bestEl.textContent = best > 0 ? `+${best}` : "—";
    if (modeBtn) modeBtn.textContent = twoPlayer ? "Mode: 2 players" : "Mode: vs AI";
  }

  function renderBoard() {
    const cells = boardEl.querySelectorAll("button");
    const moves = over ? [] : legalMoves(turn);
    const legalSet = new Set(moves.map((m) => m.r * N + m.c));
    const showHints = twoPlayer || turn === DARK;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const value = board[i];
      cell.className = "sq";
      if (value === DARK) cell.classList.add("dark");
      else if (value === LIGHT) cell.classList.add("light");
      else if (showHints && legalSet.has(i)) cell.classList.add("legal");
      cell.setAttribute("aria-label", `Row ${Math.floor(i / N) + 1} column ${(i % N) + 1}, ${value === DARK ? "dark disc" : value === LIGHT ? "light disc" : legalSet.has(i) ? "playable" : "empty"}`);
    }
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

  function reset() {
    board = new Array(N * N).fill(EMPTY);
    board[3 * N + 3] = LIGHT;
    board[3 * N + 4] = DARK;
    board[4 * N + 3] = DARK;
    board[4 * N + 4] = LIGHT;
    turn = DARK;
    over = false;
    passStreak = 0;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    renderHud();
    renderBoard();
  }

  function finishGame() {
    over = true;
    const { dark, light } = counts();
    let margin = 0;
    let title;
    if (dark > light) {
      margin = dark - light;
      title = twoPlayer ? "Dark wins!" : "You win!";
      if (!twoPlayer && margin > best) {
        best = margin;
        saveBest();
      }
    } else if (light > dark) {
      margin = light - dark;
      title = twoPlayer ? "Light wins!" : "AI wins";
    } else {
      title = "Perfect draw";
    }
    renderHud();
    renderBoard();
    showOverlay(title, `Final discs — dark ${dark}, light ${light}.`, "Play again");
  }

  function nextTurn() {
    const opponent = turn === DARK ? LIGHT : DARK;
    if (legalMoves(opponent).length) {
      turn = opponent;
      passStreak = 0;
    } else if (legalMoves(turn).length) {
      passStreak += 1;
      if (passStreak >= 2) {
        finishGame();
        return;
      }
    } else {
      finishGame();
      return;
    }
    renderHud();
    renderBoard();
    if (!twoPlayer && turn === LIGHT && !over) {
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = setTimeout(aiPlay, 550);
    }
  }

  function aiPlay() {
    if (over || turn !== LIGHT) return;
    const moves = legalMoves(LIGHT);
    if (!moves.length) {
      nextTurn();
      return;
    }
    let bestMove = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = WEIGHTS[move.r * N + move.c] + move.flips.length * 1.5 + Math.random();
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    playMove(bestMove.r, bestMove.c, bestMove.flips, LIGHT);
  }

  function playMove(r, c, flips, player) {
    board[r * N + c] = player;
    for (const i of flips) board[i] = player;
    nextTurn();
  }

  boardEl.addEventListener("click", (event) => {
    const sq = event.target && event.target.closest ? event.target.closest("[data-i]") : null;
    if (!sq || over) return;
    if (!twoPlayer && turn === LIGHT) return;
    const i = parseInt(sq.getAttribute("data-i"), 10);
    if (!Number.isFinite(i)) return;
    const r = Math.floor(i / N);
    const c = i % N;
    const flips = flipsFor(r, c, turn);
    if (!flips.length) return;
    playMove(r, c, flips, turn);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && overlay && overlay.hidden === false) {
      reset();
      hideOverlay();
    }
  });

  if (primaryBtn) {
    primaryBtn.addEventListener("click", () => {
      reset();
      hideOverlay();
    });
  }
  if (modeBtn) {
    modeBtn.addEventListener("click", () => {
      twoPlayer = !twoPlayer;
      reset();
      hideOverlay();
    });
  }

  /* Build the board once. */
  for (let i = 0; i < N * N; i++) {
    const sq = document.createElement("button");
    sq.type = "button";
    sq.setAttribute("data-i", String(i));
    sq.className = "sq";
    boardEl.appendChild(sq);
  }

  reset();
  showOverlay("Reversi", "Trap your opponent's discs between yours to flip them. Most discs when the board fills wins.", "Start game");
})();
