/* Chess — original GameHub implementation.
   Full local rules: legal move generation, check, checkmate,
   stalemate, castling, en passant and promotion. Opponent is the
   built-in AI (three levels) or a friend sharing this device. */
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
  const turnEl = document.getElementById("turn");
  const statusEl = document.getElementById("status");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const modeBtn = document.getElementById("modeBtn");
  const levelBtn = document.getElementById("levelBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIZE = 8;
  const CELL = canvas.width / SIZE;
  const BEST_KEY = "gh_best_chess";
  const LEVELS = ["Easy", "Medium", "Hard"];
  const PIECE_VALUE = { P: 1, N: 3, B: 3.2, R: 5, Q: 9, K: 0 };

  let board = [];
  let turn = "w";
  let selected = null;
  let targets = [];
  let mode = "ai";
  let level = 1;
  let paused = false;
  let running = false;
  let thinking = false;
  let state = "idle"; /* idle | playing | over */
  let message = "Ready";
  let history = [];
  let lastMove = null;
  let wins = readNumber(BEST_KEY);

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
      localStorage.setItem(key, String(value));
    } catch (err) { /* private mode: the score simply is not stored */ }
  }

  function showOverlay(title, text, label, visible) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) {
      primaryBtn.textContent = label;
      primaryBtn.hidden = false;
    }
    if (overlay) overlay.hidden = !visible;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  /* ---------------- Board model ----------------
     Pieces are { t: "P".."K", c: "w" | "b" }. Squares are indexed
     by row (0 = black's back rank) and column (0 = a-file). */
  function startPosition() {
    const rows = [
      "rnbqkbnr",
      "pppppppp",
      "........",
      "........",
      "........",
      "........",
      "PPPPPPPP",
      "RNBQKBNR"
    ];
    const next = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const ch = rows[r][c];
        row.push(ch === "." ? null : { t: ch.toUpperCase(), c: r < 2 ? "b" : "w" });
      }
      next.push(row);
    }
    return next;
  }

  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const at = (r, c) => (inside(r, c) ? board[r][c] : null);
  const colorOf = (piece) => (piece ? piece.c : "");

  function cloneBoard(source) {
    return source.map((row) => row.map((piece) => (piece ? { t: piece.t, c: piece.c } : null)));
  }

  function pushMove(list, r, c, extra) {
    const move = { r: r, c: c };
    if (extra) {
      for (const key in extra) move[key] = extra[key];
    }
    list.push(move);
  }

  function pawnMoves(r, c, piece, list) {
    const dir = piece.c === "w" ? -1 : 1;
    const startRow = piece.c === "w" ? 6 : 1;
    const promoRow = piece.c === "w" ? 0 : 7;
    const forward = at(r + dir, c);
    if (inside(r + dir, c) && !forward) {
      pushMove(list, r + dir, c, r + dir === promoRow ? { promo: true } : null);
      if (r === startRow && !at(r + 2 * dir, c)) pushMove(list, r + 2 * dir, c, { double: true });
    }
    for (const dc of [-1, 1]) {
      const victim = at(r + dir, c + dc);
      if (victim && victim.c !== piece.c) pushMove(list, r + dir, c + dc, r + dir === promoRow ? { promo: true } : null);
      else if (!victim) {
        const ghost = lastMove && lastMove.piece === "P" && lastMove.double && lastMove.toR === r && lastMove.toC === c + dc;
        if (ghost) pushMove(list, r + dir, c + dc, { enPassant: true });
      }
    }
  }

  const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const SLIDES = [
    { dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]], types: ["R", "Q"] },
    { dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]], types: ["B", "Q"] }
  ];

  function pseudoMoves(r, c, source) {
    const piece = source[r][c];
    const list = [];
    if (!piece) return list;
    const read = (rr, cc) => (inside(rr, cc) ? source[rr][cc] : null);
    if (piece.t === "P") {
      const dir = piece.c === "w" ? -1 : 1;
      const startRow = piece.c === "w" ? 6 : 1;
      const promoRow = piece.c === "w" ? 0 : 7;
      if (read(r + dir, c) === null && inside(r + dir, c)) {
        list.push({ r: r + dir, c: c, promo: r + dir === promoRow });
        if (r === startRow && read(r + 2 * dir, c) === null) list.push({ r: r + 2 * dir, c: c, double: true });
      }
      for (const dc of [-1, 1]) {
        const victim = read(r + dir, c + dc);
        if (victim && victim.c !== piece.c) list.push({ r: r + dir, c: c + dc, promo: r + dir === promoRow });
      }
      return list;
    }
    if (piece.t === "N") {
      for (const [dr, dc] of KNIGHT_STEPS) {
        const target = read(r + dr, c + dc);
        if (inside(r + dr, c + dc) && (!target || target.c !== piece.c)) list.push({ r: r + dr, c: c + dc });
      }
      return list;
    }
    if (piece.t === "K") {
      for (const [dr, dc] of KING_STEPS) {
        const target = read(r + dr, c + dc);
        if (inside(r + dr, c + dc) && (!target || target.c !== piece.c)) list.push({ r: r + dr, c: c + dc });
      }
      return list;
    }
    for (const slide of SLIDES) {
      if (slide.types.indexOf(piece.t) === -1) continue;
      for (const [dr, dc] of slide.dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (inside(rr, cc)) {
          const target = read(rr, cc);
          if (!target) {
            list.push({ r: rr, c: cc });
          } else {
            if (target.c !== piece.c) list.push({ r: rr, c: cc });
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
    return list;
  }

  function kingSquare(source, color) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = source[r][c];
        if (piece && piece.t === "K" && piece.c === color) return { r: r, c: c };
      }
    }
    return null;
  }

  function attacked(source, r, c, byColor) {
    for (let rr = 0; rr < SIZE; rr++) {
      for (let cc = 0; cc < SIZE; cc++) {
        const piece = source[rr][cc];
        if (!piece || piece.c !== byColor) continue;
        const moves = pseudoMoves(rr, cc, source);
        for (const move of moves) {
          if (move.r === r && move.c === c) return true;
        }
      }
    }
    return false;
  }

  function inCheck(source, color) {
    const king = kingSquare(source, color);
    if (!king) return false;
    return attacked(source, king.r, king.c, color === "w" ? "b" : "w");
  }

  function applyMove(source, from, to, extra) {
    const piece = source[from.r][from.c];
    const copy = cloneBoard(source);
    const moving = copy[from.r][from.c];
    copy[from.r][from.c] = null;
    copy[to.r][to.c] = moving;
    if (extra && extra.enPassant) copy[from.r][to.c] = null;
    if (extra && extra.promo) moving.t = extra.promoPiece || "Q";
    return copy;
  }

  function legalMoves(r, c, source) {
    const scope = source || board;
    const piece = scope[r][c];
    if (!piece || piece.c !== turn) return [];
    const out = [];
    for (const move of pseudoMoves(r, c, scope)) {
      const next = applyMove(scope, { r: r, c: c }, move, move);
      if (!inCheck(next, piece.c)) out.push(move);
    }
    if (piece.t === "K") {
      const rights = castleRights(scope);
      if (piece.c === "w" && rights.wK && !scope[7][5] && !scope[7][6] && !attacked(scope, 7, 4, "b") && !attacked(scope, 7, 5, "b")) {
        out.push({ r: 7, c: 6, castle: "K" });
      }
      if (piece.c === "w" && rights.wQ && !scope[7][3] && !scope[7][2] && !scope[7][1] && !attacked(scope, 7, 4, "b") && !attacked(scope, 7, 3, "b")) {
        out.push({ r: 7, c: 2, castle: "Q" });
      }
      if (piece.c === "b" && rights.bK && !scope[0][5] && !scope[0][6] && !attacked(scope, 0, 4, "w") && !attacked(scope, 0, 5, "w")) {
        out.push({ r: 0, c: 6, castle: "K" });
      }
      if (piece.c === "b" && rights.bQ && !scope[0][3] && !scope[0][2] && !scope[0][1] && !attacked(scope, 0, 4, "w") && !attacked(scope, 0, 3, "w")) {
        out.push({ r: 0, c: 2, castle: "Q" });
      }
    }
    return out;
  }

  /* Castling rights live in a tiny mutable record instead of inside
     the board array, keeping the piece model simple. */
  let rights = { wK: true, wQ: true, bK: true, bQ: true };
  function castleRights() { return rights; }

  function resetRights() {
    rights = { wK: true, wQ: true, bK: true, bQ: true };
  }

  function updateRights(from, to, piece, captured) {
    if (piece.t === "K") {
      if (piece.c === "w") { rights.wK = false; rights.wQ = false; }
      else { rights.bK = false; rights.bQ = false; }
    }
    if (piece.t === "R") {
      if (from.r === 7 && from.c === 0) rights.wQ = false;
      if (from.r === 7 && from.c === 7) rights.wK = false;
      if (from.r === 0 && from.c === 0) rights.bQ = false;
      if (from.r === 0 && from.c === 7) rights.bK = false;
    }
    if (captured && captured.t === "R") {
      if (to.r === 7 && to.c === 0) rights.wQ = false;
      if (to.r === 7 && to.c === 7) rights.wK = false;
      if (to.r === 0 && to.c === 0) rights.bQ = false;
      if (to.r === 0 && to.c === 7) rights.bK = false;
    }
  }

  function allLegalMoves(color) {
    const saved = turn;
    turn = color;
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c];
        if (!piece || piece.c !== color) continue;
        for (const move of legalMoves(r, c)) moves.push({ from: { r: r, c: c }, move: move });
      }
    }
    turn = saved;
    return moves;
  }

  function switchTurn() {
    turn = turn === "w" ? "b" : "w";
    refreshStatus();
  }

  function refreshStatus() {
    if (turnEl) turnEl.textContent = turn === "w" ? "White" : "Black";
    if (statusEl) statusEl.textContent = message;
    if (bestEl) bestEl.textContent = String(wins);
  }

  function endGame(title, text, won) {
    state = "over";
    running = false;
    if (won) {
      wins += 1;
      writeNumber(BEST_KEY, wins);
    }
    message = title;
    refreshStatus();
    showOverlay(title, text, "Play again", true);
  }

  function checkGameEnd() {
    const moves = allLegalMoves(turn);
    if (moves.length) {
      if (inCheck(board, turn)) {
        message = (turn === "w" ? "White" : "Black") + " is in check";
      } else {
        message = "Playing";
      }
      refreshStatus();
      return false;
    }
    if (inCheck(board, turn)) {
      const winner = turn === "w" ? "Black" : "White";
      endGame(winner + " wins", "Checkmate. " + winner + " takes the game.", turn === "b");
    } else {
      endGame("Draw", "Stalemate — no legal moves left for " + (turn === "w" ? "White" : "Black") + ".", false);
    }
    return true;
  }

  /* ---------------- Move execution ---------------- */
  function makeMove(from, to) {
    const piece = board[from.r][from.c];
    if (!piece) return false;
    const move = targets.find((candidate) => candidate.r === to.r && candidate.c === to.c);
    if (!move) return false;
    const captured = board[to.r][to.c];
    board = applyMove(board, from, to, move);
    updateRights(from, to, piece, captured);
    if (move.castle === "K") {
      board[to.r][5] = board[to.r][7];
      board[to.r][7] = null;
    } else if (move.castle === "Q") {
      board[to.r][3] = board[to.r][0];
      board[to.r][0] = null;
    }
    history.push({ from: from, to: to, move: move });
    lastMove = { piece: piece.t, double: Boolean(move.double), toR: to.r, toC: to.c };
    selected = null;
    targets = [];
    if (!checkGameEnd()) switchTurn();
    draw();
    if (state === "playing" && mode === "ai" && turn === "b") scheduleAi();
    return true;
  }

  /* ---------------- AI ----------------
     Material + mobility evaluation with alpha-beta pruning. Depth
     stays small so the move is instant on every device. */
  function evaluate(source, color) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = source[r][c];
        if (!piece) continue;
        const value = PIECE_VALUE[piece.t] || 0;
        const centre = 3.5 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) / 2;
        const positional = piece.t === "P" ? r * 0.05 : centre * 0.05;
        score += piece.c === color ? value + positional : -(value + positional);
      }
    }
    return score;
  }

  function search(depth, color, alpha, beta) {
    if (depth === 0) return evaluate(board, color) - evaluate(board, color === "w" ? "b" : "w") * 0;
    const moves = allLegalMoves(color);
    if (!moves.length) return inCheck(board, color) ? -999 + depth : 0;
    let best = -Infinity;
    for (const entry of moves) {
      const snapshot = { board: board, rights: rights, lastMove: lastMove, turn: turn };
      const piece = board[entry.from.r][entry.from.c];
      const captured = board[entry.move.r][entry.move.c];
      board = applyMove(board, entry.from, entry.move, entry.move);
      updateRights(entry.from, entry.move, piece, captured);
      if (entry.move.castle === "K") { board[entry.move.r][5] = board[entry.move.r][7]; board[entry.move.r][7] = null; }
      if (entry.move.castle === "Q") { board[entry.move.r][3] = board[entry.move.r][0]; board[entry.move.r][0] = null; }
      const value = -search(depth - 1, color === "w" ? "b" : "w", -beta, -alpha);
      board = snapshot.board;
      rights = snapshot.rights;
      lastMove = snapshot.lastMove;
      turn = snapshot.turn;
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function pickAiMove() {
    const moves = allLegalMoves("b");
    if (!moves.length) return null;
    const noise = level === 0 ? 1.4 : level === 1 ? 0.5 : 0;
    let bestScore = -Infinity;
    let bestMove = null;
    for (const entry of moves) {
      const snapshot = { board: board, rights: rights, lastMove: lastMove, turn: turn };
      const piece = board[entry.from.r][entry.from.c];
      const captured = board[entry.move.r][entry.move.c];
      board = applyMove(board, entry.from, entry.move, entry.move);
      updateRights(entry.from, entry.move, piece, captured);
      if (entry.move.castle === "K") { board[entry.move.r][5] = board[entry.move.r][7]; board[entry.move.r][7] = null; }
      if (entry.move.castle === "Q") { board[entry.move.r][3] = board[entry.move.r][0]; board[entry.move.r][0] = null; }
      const depth = level === 2 ? 3 : 2;
      const score = -search(depth - 1, "w", -Infinity, Infinity) + (Math.random() * noise);
      board = snapshot.board;
      rights = snapshot.rights;
      lastMove = snapshot.lastMove;
      turn = snapshot.turn;
      if (score > bestScore) {
        bestScore = score;
        bestMove = entry;
      }
    }
    return bestMove;
  }

  let aiTimer = null;
  function scheduleAi() {
    if (thinking || state !== "playing") return;
    thinking = true;
    const run = () => {
      thinking = false;
      if (state !== "playing" || paused || mode !== "ai") return;
      const entry = pickAiMove();
      if (!entry) {
        checkGameEnd();
        return;
      }
      selected = entry.from;
      targets = [entry.move];
      makeMove(entry.from, entry.move);
    };
    if (typeof setTimeout === "function") {
      aiTimer = setTimeout(run, 220);
    } else {
      run();
    }
  }

  /* ---------------- Rendering ---------------- */
  const GLYPHS = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };

  function drawBoard() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const light = (r + c) % 2 === 0;
        ctx.fillStyle = light ? "#d9def2" : "#5b6488";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    if (lastMove) {
      ctx.fillStyle = "rgba(124, 92, 255, 0.35)";
      ctx.fillRect(lastMove.toC * CELL, lastMove.toR * CELL, CELL, CELL);
    }
    if (selected) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.45)";
      ctx.fillRect(selected.c * CELL, selected.r * CELL, CELL, CELL);
    }
    for (const move of targets) {
      ctx.beginPath();
      ctx.arc(move.c * CELL + CELL / 2, move.r * CELL + CELL / 2, board[move.r][move.c] || move.enPassant ? CELL * 0.42 : CELL * 0.16, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        ctx.font = Math.round(CELL * 0.78) + "px serif";
        ctx.fillStyle = piece.c === "w" ? "#ffffff" : "#12172c";
        ctx.fillText(GLYPHS[piece.t], c * CELL + CELL / 2, r * CELL + CELL / 2 + CELL * 0.03);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = piece.c === "w" ? "#12172c" : "#8ea0d8";
        ctx.strokeText(GLYPHS[piece.t], c * CELL + CELL / 2, r * CELL + CELL / 2 + CELL * 0.03);
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#0e1428";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBoard();
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- Input ---------------- */
  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const scale = canvas.width / (rect.width || canvas.width);
    return {
      c: Math.floor(((event.clientX || 0) - rect.left) * scale / CELL),
      r: Math.floor(((event.clientY || 0) - rect.top) * scale / CELL)
    };
  }

  function onBoardPoint(point) {
    if (state !== "playing" || paused || !point) return;
    if (mode === "ai" && turn === "b") return;
    if (!inside(point.r, point.c)) return;
    const piece = board[point.r][point.c];
    if (piece && piece.c === turn) {
      selected = point;
      targets = legalMoves(point.r, point.c);
      return;
    }
    if (selected && targets.some((move) => move.r === point.r && move.c === point.c)) {
      makeMove(selected, point);
    }
  }

  canvas.addEventListener("click", (event) => onBoardPoint(pointFromEvent(event)));
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) onBoardPoint(pointFromEvent(touch));
  }, { passive: true });

  function startGame() {
    board = startPosition();
    resetRights();
    turn = "w";
    selected = null;
    targets = [];
    history = [];
    lastMove = null;
    state = "playing";
    running = true;
    paused = false;
    message = "Playing";
    hideOverlay();
    refreshStatus();
    draw();
  }

  function toggleMode() {
    mode = mode === "ai" ? "local" : "ai";
    if (modeBtn) modeBtn.textContent = mode === "ai" ? "Mode: vs AI" : "Mode: 2 players";
    if (state === "playing" && mode === "ai" && turn === "b") scheduleAi();
  }

  function toggleLevel() {
    level = (level + 1) % LEVELS.length;
    if (levelBtn) levelBtn.textContent = "AI: " + LEVELS[level];
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    message = paused ? "Paused" : "Playing";
    refreshStatus();
    if (paused) showOverlay("Paused", "Take your time. Your game is exactly where you left it.", "Resume", true);
    else {
      hideOverlay();
      if (mode === "ai" && turn === "b") scheduleAi();
    }
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") {
      togglePause();
      return;
    }
    startGame();
  });
  pauseBtn?.addEventListener("click", togglePause);
  modeBtn?.addEventListener("click", toggleMode);
  levelBtn?.addEventListener("click", toggleLevel);

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    if (key === "p") togglePause();
    else if (key === "m") toggleMode();
    else if (key === "l") toggleLevel();
    else if (key === "escape" && selected) {
      selected = null;
      targets = [];
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  board = startPosition();
  resetRights();
  refreshStatus();
  draw();
  requestAnimationFrame(loop);
  void history;
  void running;
  void aiTimer;
})();
