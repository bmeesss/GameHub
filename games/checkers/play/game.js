/* Checkers — original GameHub implementation.
   English draughts rules: mandatory captures, chained multi-jumps,
   crowning kings. Opponent is the built-in AI or a friend. */
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
  const countEl = document.getElementById("count");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const modeBtn = document.getElementById("modeBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIZE = 8;
  const CELL = canvas.width / SIZE;
  const BEST_KEY = "gh_best_checkers";

  let board = [];
  let turn = "r";
  let selected = null;
  let targets = [];
  let mode = "ai";
  let paused = false;
  let state = "idle";
  let chainPiece = null;
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
    } catch (err) { /* storage unavailable: score stays in memory only */ }
  }

  function showOverlay(title, text, label, visible) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = label;
    if (overlay) overlay.hidden = !visible;
  }

  const hideOverlay = () => { if (overlay) overlay.hidden = true; };

  /* ---------------- Model ----------------
     piece = { c: "r" | "b", king: false }. Dark squares only. */
  function startPosition() {
    const next = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const dark = (r + c) % 2 === 1;
        if (dark && r < 3) row.push({ c: "b", king: false });
        else if (dark && r > 4) row.push({ c: "r", king: false });
        else row.push(null);
      }
      next.push(row);
    }
    return next;
  }

  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const at = (r, c) => (inside(r, c) ? board[r][c] : null);
  const forward = (piece) => (piece.c === "r" ? -1 : 1);

  function capturesFor(r, c, source) {
    const piece = source[r][c];
    const out = [];
    if (!piece) return out;
    const dirs = piece.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[forward(piece), -1], [forward(piece), 1]];
    for (const [dr, dc] of dirs) {
      const mid = source[r + dr] ? source[r + dr][c + dc] : null;
      const land = source[r + 2 * dr] ? source[r + 2 * dr][c + 2 * dc] : null;
      if (inside(r + 2 * dr, c + 2 * dc) && mid && mid.c !== piece.c && !land) {
        out.push({ r: r + 2 * dr, c: c + 2 * dc, capture: { r: r + dr, c: c + dc } });
      }
    }
    return out;
  }

  function simpleMovesFor(r, c, source) {
    const piece = source[r][c];
    const out = [];
    if (!piece) return out;
    const dirs = piece.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[forward(piece), -1], [forward(piece), 1]];
    for (const [dr, dc] of dirs) {
      if (inside(r + dr, c + dc) && !source[r + dr][c + dc]) out.push({ r: r + dr, c: c + dc });
    }
    return out;
  }

  /* Moves are collected for the whole side: captures are mandatory. */
  function movesFor(color, source) {
    const scout = source || board;
    const capturing = [];
    const quiet = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = scout[r][c];
        if (!piece || piece.c !== color) continue;
        for (const move of capturesFor(r, c, scout)) {
          capturing.push({ from: { r: r, c: c }, move: move });
        }
        for (const move of simpleMovesFor(r, c, scout)) {
          quiet.push({ from: { r: r, c: c }, move: move });
        }
      }
    }
    return capturing.length ? capturing : quiet;
  }

  const countPieces = (color) => {
    let total = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c];
        if (piece && piece.c === color) total++;
      }
    }
    return total;
  };

  function refreshHud() {
    if (turnEl) turnEl.textContent = turn === "r" ? "Red" : "Blue";
    if (countEl) countEl.textContent = countPieces("r") + " - " + countPieces("b");
    if (bestEl) bestEl.textContent = String(wins);
  }

  function crown(piece, r) {
    if (!piece.king && ((piece.c === "r" && r === 0) || (piece.c === "b" && r === SIZE - 1))) {
      piece.king = true;
      return true;
    }
    return false;
  }

  function finish(title, text, won) {
    state = "over";
    chainPiece = null;
    if (won) {
      wins += 1;
      writeNumber(BEST_KEY, wins);
    }
    refreshHud();
    showOverlay(title, text, "Play again", true);
  }

  function checkEnd() {
    if (countPieces("r") === 0) {
      finish("Blue wins", "Every red piece is captured.", false);
      return true;
    }
    if (countPieces("b") === 0) {
      finish("Red wins", "Every blue piece is captured.", true);
      return true;
    }
    if (!movesFor(turn).length) {
      const winner = turn === "r" ? "Blue" : "Red";
      finish(winner + " wins", (turn === "r" ? "Red" : "Blue") + " has no legal move left.", turn === "b");
      return true;
    }
    return false;
  }

  function applyEntry(entry) {
    const piece = board[entry.from.r][entry.from.c];
    if (!piece) return;
    board[entry.move.r][entry.move.c] = piece;
    board[entry.from.r][entry.from.c] = null;
    if (entry.move.capture) board[entry.move.capture.r][entry.move.capture.c] = null;
    crown(piece, entry.move.r);
    /* Chained jumps continue with the same piece. */
    const more = capturesFor(entry.move.r, entry.move.c, board);
    if (entry.move.capture && more.length) {
      chainPiece = { r: entry.move.r, c: entry.move.c };
      selected = chainPiece;
      targets = more.map((move) => ({ r: move.r, c: move.c, capture: move.capture }));
      refreshHud();
      draw();
      return;
    }
    chainPiece = null;
    selected = null;
    targets = [];
    if (!checkEnd()) {
      turn = turn === "r" ? "b" : "r";
      refreshHud();
      draw();
      if (state === "playing" && mode === "ai" && turn === "b") scheduleAi();
    } else {
      refreshHud();
      draw();
    }
  }

  /* ---------------- AI ----------------
     One-ply lookahead: captures first, then advancement toward the
     far row with a bonus for keeping the back rank guarded. */
  function aiPick() {
    const moves = chainPiece
      ? capturesFor(chainPiece.r, chainPiece.c, board).map((move) => ({ from: { r: chainPiece.r, c: chainPiece.c }, move: move }))
      : movesFor("b");
    if (!moves.length) return null;
    let bestScore = -Infinity;
    let best = moves[0];
    for (const entry of moves) {
      let score = entry.move.capture ? 12 : 0;
      const step = entry.move.r - entry.from.r;
      score += step * 1.4;
      if (entry.move.r === SIZE - 1) score += 6;
      /* Prefer keeping pieces on the back row while the enemy is deep. */
      if (entry.from.r === 0) score -= 1.2;
      score += Math.random() * 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return best;
  }

  let aiTimer = null;
  function scheduleAi() {
    if (state !== "playing" || paused || mode !== "ai") return;
    const run = () => {
      if (state !== "playing" || paused || mode !== "ai") return;
      const entry = aiPick();
      if (!entry) {
        checkEnd();
        return;
      }
      applyEntry(entry);
    };
    if (typeof setTimeout === "function") aiTimer = setTimeout(run, 260);
    else run();
  }

  /* ---------------- Rendering ---------------- */
  function draw() {
    ctx.fillStyle = "#0e1428";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const dark = (r + c) % 2 === 1;
        ctx.fillStyle = dark ? "#2f3a5f" : "#c9d1ec";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    if (selected) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
      ctx.fillRect(selected.c * CELL, selected.r * CELL, CELL, CELL);
    }
    for (const move of targets) {
      ctx.beginPath();
      ctx.arc(move.c * CELL + CELL / 2, move.r * CELL + CELL / 2, CELL * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 211, 238, 0.85)";
      ctx.fill();
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, CELL * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = piece.c === "r" ? "#ef4444" : "#3b82f6";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.stroke();
        if (piece.king) {
          ctx.beginPath();
          ctx.arc(cx, cy, CELL * 0.16, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
        }
      }
    }
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

  function onPoint(point) {
    if (state !== "playing" || paused || !point || !inside(point.r, point.c)) return;
    if (chainPiece) {
      const move = targets.find((candidate) => candidate.r === point.r && candidate.c === point.c);
      if (move) applyEntry({ from: chainPiece, move: move });
      return;
    }
    if (mode === "ai" && turn === "b") return;
    const piece = board[point.r][point.c];
    if (piece && piece.c === turn) {
      const options = movesFor(turn).filter((entry) => entry.from.r === point.r && entry.from.c === point.c);
      selected = point;
      targets = options.map((entry) => ({ r: entry.move.r, c: entry.move.c, capture: entry.move.capture }));
      return;
    }
    if (selected && targets.some((move) => move.r === point.r && move.c === point.c)) {
      applyEntry({ from: selected, move: targets.find((move) => move.r === point.r && move.c === point.c) });
    }
  }

  canvas.addEventListener("click", (event) => onPoint(pointFromEvent(event)));
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (touch) onPoint(pointFromEvent(touch));
  }, { passive: true });

  function startGame() {
    board = startPosition();
    turn = "r";
    selected = null;
    targets = [];
    chainPiece = null;
    paused = false;
    state = "playing";
    hideOverlay();
    refreshHud();
    draw();
  }

  function toggleMode() {
    mode = mode === "ai" ? "local" : "ai";
    if (modeBtn) modeBtn.textContent = mode === "ai" ? "Mode: vs AI" : "Mode: 2 players";
    if (state === "playing" && mode === "ai" && turn === "b") scheduleAi();
  }

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "Your board is saved exactly as it is.", "Resume", true);
    else {
      hideOverlay();
      if (mode === "ai" && turn === "b" && !chainPiece) scheduleAi();
    }
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startGame();
  });
  pauseBtn?.addEventListener("click", togglePause);
  modeBtn?.addEventListener("click", toggleMode);

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "").toLowerCase();
    if (key === "p") togglePause();
    else if (key === "m") toggleMode();
    else if (key === "escape") { selected = null; targets = []; }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  board = startPosition();
  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void aiTimer;
})();
