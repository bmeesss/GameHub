/* Tic-Tac-Toe — original GameHub implementation.
   Noughts and crosses: easy AI, unbeatable minimax AI, local 2-player. */
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
  const statusEl = document.getElementById("status");
  const scoreXEl = document.getElementById("scoreX");
  const scoreDEl = document.getElementById("scoreD");
  const scoreOEl = document.getElementById("scoreO");
  const newBtn = document.getElementById("newBtn");
  const modeRow = document.getElementById("modeRow");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!boardEl) return;

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  let mode = "hard";
  let cells = [];
  let board = [];
  let turn = "X";
  let roundOver = false;
  let tally = { X: 0, O: 0, D: 0 };
  let aiTimer = null;

  function renderTally() {
    if (scoreXEl) scoreXEl.textContent = String(tally.X);
    if (scoreDEl) scoreDEl.textContent = String(tally.D);
    if (scoreOEl) scoreOEl.textContent = String(tally.O);
  }

  function renderStatus() {
    if (!statusEl) return;
    if (roundOver) {
      statusEl.textContent = "Round over";
      return;
    }
    if (mode === "versus") {
      statusEl.textContent = `Player ${turn}'s move`;
    } else if (turn === "X") {
      statusEl.textContent = "Your move (X)";
    } else {
      statusEl.textContent = "AI is thinking…";
    }
  }

  function build() {
    while (boardEl.firstChild) boardEl.firstChild.remove();
    cells = [];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = String(i);
      cell.setAttribute("aria-label", `Cell ${i + 1}, empty`);
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function newRound() {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    board = Array(9).fill("");
    turn = "X";
    roundOver = false;
    for (const cell of cells) {
      cell.textContent = "";
      cell.className = "cell";
      cell.disabled = false;
    }
    if (overlay) overlay.hidden = true;
    renderStatus();
  }

  function winnerOf(state) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (state[a] && state[a] === state[b] && state[a] === state[c]) return { player: state[a], line };
    }
    return null;
  }

  function minimax(state, isMax, depth) {
    const won = winnerOf(state);
    if (won) return won.player === "O" ? 10 - depth : depth - 10;
    if (!state.includes("")) return 0;
    if (isMax) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (state[i]) continue;
        state[i] = "O";
        bestScore = Math.max(bestScore, minimax(state, false, depth + 1));
        state[i] = "";
      }
      return bestScore;
    }
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (state[i]) continue;
      state[i] = "X";
      bestScore = Math.min(bestScore, minimax(state, true, depth + 1));
      state[i] = "";
    }
    return bestScore;
  }

  function bestMove() {
    let move = -1;
    let bestScore = -Infinity;
    const order = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (const i of order) {
      if (board[i]) continue;
      board[i] = "O";
      const value = minimax(board, false, 0);
      board[i] = "";
      if (value > bestScore) {
        bestScore = value;
        move = i;
      }
    }
    return move;
  }

  function randomMove() {
    const free = [];
    for (let i = 0; i < 9; i++) {
      if (!board[i]) free.push(i);
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  }

  function aiPlay() {
    if (roundOver || turn !== "O" || mode === "versus") return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (roundOver) return;
      const move = mode === "easy" && Math.random() < 0.65 ? randomMove() : bestMove();
      if (move >= 0) place(move);
    }, 350);
  }

  function place(index) {
    if (roundOver || board[index]) return;
    board[index] = turn;
    const cell = cells[index];
    cell.textContent = turn;
    cell.classList.add(turn.toLowerCase());
    cell.disabled = true;
    cell.setAttribute("aria-label", `Cell ${index + 1}, ${turn}`);
    const won = winnerOf(board);
    if (won) {
      for (const i of won.line) cells[i].classList.add("win");
      endRound(won.player);
      return;
    }
    if (!board.includes("")) {
      endRound(null);
      return;
    }
    turn = turn === "X" ? "O" : "X";
    renderStatus();
    if (mode !== "versus" && turn === "O") aiPlay();
  }

  function endRound(winner) {
    roundOver = true;
    for (const cell of cells) cell.disabled = true;
    let title;
    let text;
    if (!winner) {
      tally.D += 1;
      title = "It's a draw!";
      text = mode === "versus" ? "Evenly matched players." : "You held the line — well played.";
    } else {
      tally[winner] += 1;
      if (mode === "versus") {
        title = `Player ${winner} wins!`;
        text = "Nice three-in-a-row. Rematch?";
      } else if (winner === "X") {
        title = "You win!";
        text = "You beat the AI fair and square.";
      } else {
        title = "AI wins!";
        text = "The machine takes this round. Try again!";
      }
    }
    renderTally();
    renderStatus();
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlay) overlay.hidden = false;
  }

  boardEl.addEventListener("click", (event) => {
    const cell = event.target && event.target.closest ? event.target.closest(".cell") : null;
    if (!cell) return;
    if (mode !== "versus" && turn !== "X") return;
    const index = parseInt(cell.dataset.index, 10);
    if (Number.isFinite(index)) place(index);
  });

  if (newBtn) newBtn.addEventListener("click", () => {
    tally = { X: 0, O: 0, D: 0 };
    renderTally();
    newRound();
  });
  if (primaryBtn) primaryBtn.addEventListener("click", newRound);
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-mode]") : null;
      if (!button) return;
      mode = button.getAttribute("data-mode") || "hard";
      const buttons = modeRow.querySelectorAll("button");
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn === button));
      }
      newRound();
    });
  }

  build();
  renderTally();
  newRound();
})();
