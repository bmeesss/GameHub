/* Four in a Row — original GameHub implementation.
   Connect-four strategy: heuristic minimax AI, two difficulties, 2-player. */
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
  const scoreAEl = document.getElementById("scoreA");
  const scoreDEl = document.getElementById("scoreD");
  const scoreBEl = document.getElementById("scoreB");
  const newBtn = document.getElementById("newBtn");
  const modeRow = document.getElementById("modeRow");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  if (!boardEl) return;

  const COLS = 7;
  const ROWS = 6;
  const ORDER = [3, 2, 4, 1, 5, 0, 6];

  let mode = "normal";
  let grid = [];
  let slots = [];
  let turn = "a";
  let roundOver = false;
  let tally = { a: 0, b: 0, d: 0 };
  let aiTimer = null;

  function renderTally() {
    if (scoreAEl) scoreAEl.textContent = String(tally.a);
    if (scoreDEl) scoreDEl.textContent = String(tally.d);
    if (scoreBEl) scoreBEl.textContent = String(tally.b);
  }

  function renderStatus() {
    if (!statusEl) return;
    if (roundOver) {
      statusEl.textContent = "Round over";
      return;
    }
    if (mode === "versus") {
      statusEl.textContent = turn === "a" ? "Player 1's move" : "Player 2's move";
    } else {
      statusEl.textContent = turn === "a" ? "Your move" : "CPU is thinking…";
    }
  }

  function build() {
    while (boardEl.firstChild) boardEl.firstChild.remove();
    slots = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.setAttribute("role", "gridcell");
      slot.dataset.index = String(i);
      const disc = document.createElement("span");
      disc.className = "disc";
      disc.setAttribute("aria-hidden", "true");
      slot.appendChild(disc);
      slot.setAttribute("aria-label", `Column ${(i % COLS) + 1}`);
      boardEl.appendChild(slot);
      slots.push(slot);
    }
  }

  function newRound() {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    turn = "a";
    roundOver = false;
    for (const slot of slots) {
      slot.className = "slot";
    }
    if (overlay) overlay.hidden = true;
    renderStatus();
  }

  function paint(index, player) {
    slots[index].classList.add("filled", player);
  }

  function dropRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (!grid[row][col]) return row;
    }
    return -1;
  }

  function winnerOn(boardState) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const player = boardState[y][x];
        if (!player) continue;
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (const [dx, dy] of directions) {
          const cells = [[x, y]];
          for (let i = 1; i < 4; i++) {
            const nx = x + dx * i;
            const ny = y + dy * i;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || boardState[ny][nx] !== player) break;
            cells.push([nx, ny]);
          }
          if (cells.length === 4) return { player, cells };
        }
      }
    }
    return null;
  }

  function scoreWindow(window, player) {
    const foe = player === "b" ? "a" : "b";
    const mine = window.filter((v) => v === player).length;
    const empty = window.filter((v) => v === "").length;
    const theirs = window.filter((v) => v === foe).length;
    if (mine === 4) return 100000;
    if (mine === 3 && empty === 1) return 120;
    if (mine === 2 && empty === 2) return 12;
    if (theirs === 3 && empty === 1) return -150;
    if (theirs === 2 && empty === 2) return -10;
    return 0;
  }

  function evaluate(boardState) {
    let value = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (x + 3 < COLS) value += scoreWindow([boardState[y][x], boardState[y][x + 1], boardState[y][x + 2], boardState[y][x + 3]], "b");
        if (y + 3 < ROWS) value += scoreWindow([boardState[y][x], boardState[y + 1][x], boardState[y + 2][x], boardState[y + 3][x]], "b");
        if (x + 3 < COLS && y + 3 < ROWS) {
          value += scoreWindow([boardState[y][x], boardState[y + 1][x + 1], boardState[y + 2][x + 2], boardState[y + 3][x + 3]], "b");
        }
        if (x + 3 < COLS && y - 3 >= 0) {
          value += scoreWindow([boardState[y][x], boardState[y - 1][x + 1], boardState[y - 2][x + 2], boardState[y - 3][x + 3]], "b");
        }
      }
    }
    for (let y = 0; y < ROWS; y++) {
      if (boardState[y][3] === "b") value += 6;
    }
    return value;
  }

  function validColumns(boardState) {
    return ORDER.filter((col) => !boardState[0][col]);
  }

  function minimax(boardState, depth, alpha, beta, maximizing) {
    const won = winnerOn(boardState);
    if (won) return won.player === "b" ? 1000000 + depth : -1000000 - depth;
    const moves = validColumns(boardState);
    if (!moves.length) return 0;
    if (depth === 0) return evaluate(boardState);
    if (maximizing) {
      let value = -Infinity;
      for (const col of moves) {
        let row = ROWS - 1;
        while (boardState[row][col]) row -= 1;
        boardState[row][col] = "b";
        value = Math.max(value, minimax(boardState, depth - 1, alpha, beta, false));
        boardState[row][col] = "";
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    }
    let value = Infinity;
    for (const col of moves) {
      let row = ROWS - 1;
      while (boardState[row][col]) row -= 1;
      boardState[row][col] = "a";
      value = Math.min(value, minimax(boardState, depth - 1, alpha, beta, true));
      boardState[row][col] = "";
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  function aiColumn() {
    const depth = mode === "easy" ? 2 : 4;
    if (mode === "easy" && Math.random() < 0.3) {
      const moves = validColumns(grid);
      return moves.length ? moves[Math.floor(Math.random() * moves.length)] : -1;
    }
    let choice = -1;
    let value = -Infinity;
    for (const col of validColumns(grid)) {
      let row = ROWS - 1;
      while (grid[row][col]) row -= 1;
      grid[row][col] = "b";
      const score = minimax(grid, depth - 1, -Infinity, Infinity, false);
      grid[row][col] = "";
      if (score > value) {
        value = score;
        choice = col;
      }
    }
    return choice;
  }

  function aiPlay() {
    if (roundOver || turn !== "b" || mode === "versus") return;
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (roundOver) return;
      const col = aiColumn();
      if (col >= 0) play(col);
    }, 400);
  }

  function play(col) {
    if (roundOver) return;
    const row = dropRow(col);
    if (row < 0) return;
    grid[row][col] = turn;
    paint(row * COLS + col, turn);
    const won = winnerOn(grid);
    if (won) {
      for (const [x, y] of won.cells) {
        slots[y * COLS + x].classList.add("win");
      }
      endRound(won.player);
      return;
    }
    if (!grid[0].includes("")) {
      endRound(null);
      return;
    }
    turn = turn === "a" ? "b" : "a";
    renderStatus();
    if (mode !== "versus" && turn === "b") aiPlay();
  }

  function endRound(winner) {
    roundOver = true;
    let title;
    let text;
    if (!winner) {
      tally.d += 1;
      title = "Board full — draw!";
      text = "No room left and no connect-four. Rematch?";
    } else {
      tally[winner === "a" ? "a" : "b"] += 1;
      if (mode === "versus") {
        title = winner === "a" ? "Player 1 wins!" : "Player 2 wins!";
        text = "Four connected. Brilliant tactics!";
      } else if (winner === "a") {
        title = "You win!";
        text = "You outsmarted the CPU. Superb reading of the board!";
      } else {
        title = "CPU wins!";
        text = "The machine found the connect-four first. Try again!";
      }
    }
    renderTally();
    renderStatus();
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlay) overlay.hidden = false;
  }

  boardEl.addEventListener("click", (event) => {
    const slot = event.target && event.target.closest ? event.target.closest(".slot") : null;
    if (!slot) return;
    if (mode !== "versus" && turn !== "a") return;
    const index = parseInt(slot.dataset.index, 10);
    if (Number.isFinite(index)) play(index % COLS);
  });

  if (newBtn) newBtn.addEventListener("click", () => {
    tally = { a: 0, b: 0, d: 0 };
    renderTally();
    newRound();
  });
  if (primaryBtn) primaryBtn.addEventListener("click", newRound);
  if (modeRow) {
    modeRow.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-mode]") : null;
      if (!button) return;
      mode = button.getAttribute("data-mode") || "normal";
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
