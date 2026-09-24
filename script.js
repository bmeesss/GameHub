/* ============================================================
   GameHub — homepage logic
   Single source of truth: the GAMES catalog below.
   To add a game: append an entry + create games/<slug>/index.html
   + add assets/thumbnails/<slug>.svg (see README).
   Game pages are powered by launcher.js (loaded per page).
   Run tests with: node tests/smoke.mjs && python3 tests/check.py
   ============================================================ */
"use strict";

/* ---------------- Game catalog ----------------
   type:    "html5" | "iframe" | "external" | "webgl" | "wasm"
   status:  "available" | "coming-soon"
   version: free-form version string shown on the game page.
   playUrl: site-root-relative path (local game/client) or full
            https URL (external only). Null when not supplied yet.
            Local targets are verified at Play time, never preloaded.
   embed:   null or { sandbox, allow } iframe overrides.
   tags:    lowercase search/filter keywords.
   Newest entries are appended LAST (drives the New Games rail). */
const GAMES = [
  {
    id: "neon-breakout",
    title: "Neon Breakout",
    slug: "neon-breakout",
    description: "Smash through glowing brick waves with a light-charged paddle and chain massive combos.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/neon-breakout.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/neon-breakout/play/index.html",
    embed: null,
    tags: ["breakout", "single-player"]
  },
  {
    id: "pixel-puzzles",
    title: "Pixel Puzzles",
    slug: "pixel-puzzles",
    description: "Guide falling blocks into perfect lines in this fast, brain-teasing arcade puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/pixel-puzzles.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/pixel-puzzles/play/index.html",
    embed: null,
    tags: ["blocks", "casual"]
  },
  {
    id: "star-voyager",
    title: "Star Voyager",
    slug: "star-voyager",
    description: "Pilot a lone starfighter through asteroid storms and battle waves of cosmic raiders.",
    category: "Action",
    thumbnail: "assets/thumbnails/star-voyager.svg",
    featured: true,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/star-voyager/play/index.html",
    embed: null,
    tags: ["shooter", "space"]
  },
  {
    id: "labyrinth-dash",
    title: "Labyrinth Dash",
    slug: "labyrinth-dash",
    description: "Race the clock through shifting mazes, grab time shards and find the exit before time runs out.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/labyrinth-dash.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/labyrinth-dash/play/index.html",
    embed: null,
    tags: ["maze", "time-attack"]
  },
  {
    id: "tower-tactics",
    title: "Tower Tactics",
    slug: "tower-tactics",
    description: "Build clever tower defenses, manage resources and hold the line against endless sieges.",
    category: "Strategy",
    thumbnail: "assets/thumbnails/tower-tactics.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/tower-tactics/play/index.html",
    embed: null,
    tags: ["tower-defense", "single-player"]
  },
  {
    id: "reaction-arena",
    title: "Reaction Arena",
    slug: "reaction-arena",
    description: "Test your reflexes in rapid-fire reaction trials and chase your best average time.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/reaction-arena.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/reaction-arena/play/index.html",
    embed: null,
    tags: ["reflex", "casual"]
  },
  {
    id: "turbo-drift",
    title: "Turbo Drift",
    slug: "turbo-drift",
    description: "Race neon sunset circuits, dodge traffic and chase the perfect lap time.",
    category: "Racing",
    thumbnail: "assets/thumbnails/turbo-drift.svg",
    featured: true,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/turbo-drift/play/index.html",
    embed: null,
    tags: ["racing", "drift", "single-player"]
  },
  {
    id: "arena-clash",
    title: "Arena Clash",
    slug: "arena-clash",
    description: "Face off against other players in fast, tactical arena showdowns.",
    category: "Multiplayer",
    thumbnail: "assets/thumbnails/arena-clash.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "html5",
    version: "1.0.0",
    playUrl: null,
    embed: null,
    tags: ["multiplayer", "pvp", "arena"]
  },
  {
    id: "steel-vanguard",
    title: "Steel Vanguard",
    slug: "steel-vanguard",
    description: "Command a battle mech in a high-performance WebAssembly shooter.",
    category: "Action",
    thumbnail: "assets/thumbnails/steel-vanguard.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "wasm",
    version: "1.0.0",
    playUrl: null,
    embed: null,
    tags: ["mech", "shooter", "single-player"]
  },
  {
    id: "cloud-hopper",
    title: "Cloud Hopper",
    slug: "cloud-hopper",
    description: "Bounce across drifting sky islands in a breezy casual platformer.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/cloud-hopper.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/cloud-hopper/play/index.html",
    embed: null,
    tags: ["platformer", "casual"]
  },
  {
    id: "eaglercraft-1-8",
    title: "Eaglercraft 1.8",
    slug: "eaglercraft-1-8",
    description: "The classic browser voxel experience. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraft-1-8.svg",
    featured: true,
    popular: true,
    status: "coming-soon",
    type: "webgl",
    version: "1.8",
    playUrl: "games/eaglercraft-1-8/client/index.html",
    embed: null,
    tags: ["minecraft", "multiplayer", "sandbox", "voxel"]
  },
  {
    id: "eaglercraftx-1-8",
    title: "EaglercraftX 1.8",
    slug: "eaglercraftx-1-8",
    description: "An extended 1.8 voxel client build. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraftx-1-8.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "webgl",
    version: "1.8",
    playUrl: "games/eaglercraftx-1-8/client/index.html",
    embed: null,
    tags: ["minecraft", "multiplayer", "sandbox", "voxel"]
  },
  {
    id: "eaglercraft-1-12",
    title: "Eaglercraft 1.12.2",
    slug: "eaglercraft-1-12",
    description: "A newer-generation 1.12 voxel client. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraft-1-12.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "webgl",
    version: "1.12.2",
    playUrl: "games/eaglercraft-1-12/client/index.html",
    embed: null,
    tags: ["minecraft", "sandbox", "voxel"]
  },
  {
    id: "snake",
    title: "Snake",
    slug: "snake",
    description: "Guide a hungry neon snake, gobble orbs and grow — just don't bite your own tail.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/snake.svg",
    featured: true,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/snake/play/index.html",
    embed: null,
    tags: ["snake", "classic", "single-player"]
  },
  {
    id: "paddle-clash",
    title: "Paddle Clash",
    slug: "paddle-clash",
    description: "A neon paddle duel: outlast the AI or face a friend in fast first-to-7 showdowns.",
    category: "Multiplayer",
    thumbnail: "assets/thumbnails/paddle-clash.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/paddle-clash/play/index.html",
    embed: null,
    tags: ["pong", "versus", "local-multiplayer"]
  },
  {
    id: "feather-flight",
    title: "Feather Flight",
    slug: "feather-flight",
    description: "Flap through floating gates as a tiny glowing bird in this one-button arcade test.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/feather-flight.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/feather-flight/play/index.html",
    embed: null,
    tags: ["flappy", "one-button", "casual"]
  },
  {
    id: "memory-match",
    title: "Memory Match",
    slug: "memory-match",
    description: "Flip tiles and match every pair in this calm memory workout with two board sizes.",
    category: "Casual",
    thumbnail: "assets/thumbnails/memory-match.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/memory-match/play/index.html",
    embed: null,
    tags: ["memory", "matching", "casual"]
  },
  {
    id: "merge-blocks",
    title: "Merge Blocks",
    slug: "merge-blocks",
    description: "Slide numbered tiles together and chase the legendary 2048 in this addictive puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/merge-blocks.svg",
    featured: true,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/merge-blocks/play/index.html",
    embed: null,
    tags: ["2048", "sliding", "numbers"]
  },
  {
    id: "minefield",
    title: "Minefield",
    slug: "minefield",
    description: "Flag the hidden mines with pure logic across three board sizes in this classic puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/minefield.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/minefield/play/index.html",
    embed: null,
    tags: ["minesweeper", "logic", "classic"]
  },
  {
    id: "click-frenzy",
    title: "Click Frenzy",
    slug: "click-frenzy",
    description: "How fast can you click? Ten seconds on the clock — chase your best clicks-per-second.",
    category: "Casual",
    thumbnail: "assets/thumbnails/click-frenzy.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/click-frenzy/play/index.html",
    embed: null,
    tags: ["clicking", "speed", "casual"]
  },
  {
    id: "mole-patrol",
    title: "Mole Patrol",
    slug: "mole-patrol",
    description: "Bonk mischievous moles as they pop up — and smash golden moles for bonus points.",
    category: "Casual",
    thumbnail: "assets/thumbnails/mole-patrol.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/mole-patrol/play/index.html",
    embed: null,
    tags: ["whack-a-mole", "reflex", "casual"]
  },
  {
    id: "sudoku",
    title: "Sudoku",
    slug: "sudoku",
    description: "The classic number puzzle with pencil notes, hints and three difficulties.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/sudoku.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/sudoku/play/index.html",
    embed: null,
    tags: ["sudoku", "numbers", "logic"]
  },
  {
    id: "four-in-a-row",
    title: "Four in a Row",
    slug: "four-in-a-row",
    description: "Drop discs, build lines of four and outsmart the CPU in this timeless duel.",
    category: "Strategy",
    thumbnail: "assets/thumbnails/four-in-a-row.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/four-in-a-row/play/index.html",
    embed: null,
    tags: ["connect-four", "board", "versus"]
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    slug: "tic-tac-toe",
    description: "Noughts and crosses against a beatable or unbeatable AI — or a friend.",
    category: "Casual",
    thumbnail: "assets/thumbnails/tic-tac-toe.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/tic-tac-toe/play/index.html",
    embed: null,
    tags: ["tic-tac-toe", "board", "versus"]
  },
  {
    id: "neon-runner",
    title: "Neon Runner",
    slug: "neon-runner",
    description: "Sprint the neon skyline: double-jump spikes, dodge drones and grab every coin.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/neon-runner.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/neon-runner/play/index.html",
    embed: null,
    tags: ["runner", "endless", "jumping"]
  },
  {
    id: "asteroid-dodge",
    title: "Asteroid Dodge",
    slug: "asteroid-dodge",
    description: "Thread your ship through an endless asteroid storm and grab repair cells to survive.",
    category: "Action",
    thumbnail: "assets/thumbnails/asteroid-dodge.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/asteroid-dodge/play/index.html",
    embed: null,
    tags: ["dodger", "space", "survival"]
  }
];

const CATEGORY_COLORS = {
  Action: "#fb7185",
  Arcade: "#22d3ee",
  Casual: "#fb923c",
  Minecraft: "#4ade80",
  Multiplayer: "#e879f9",
  Puzzle: "#a78bfa",
  Racing: "#fbbf24",
  Strategy: "#34d399"
};
const TYPE_LABELS = {
  html5: "HTML5",
  iframe: "Iframe",
  external: "External",
  webgl: "WebGL",
  wasm: "WASM"
};
const TYPE_ORDER = ["html5", "iframe", "webgl", "wasm", "external"];
const MINECRAFT_CATEGORY = "Minecraft";
const NEW_RAIL_SIZE = 6;
const DEFAULT_CATEGORY_COLOR = "#4f7cff";
const ALL_CATEGORIES = "All";
const DEBOUNCE_MS = 150;

/* ---------------- Helpers ---------------- */
const $ = (selector, scope = document) => scope.querySelector(selector);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const gameUrl = (slug) => `games/${encodeURIComponent(slug)}/index.html`;

const categoryColor = (category) => CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;

const typeLabel = (type) => TYPE_LABELS[type] || "";

const tagsOf = (game) => (Array.isArray(game.tags) ? game.tags : []);

const debounce = (fn, wait) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const state = { query: "", category: ALL_CATEGORIES, type: null };

const isValidGame = (game) =>
  Boolean(game && game.id && game.title && game.slug && game.category);

const validGames = () => GAMES.filter(isValidGame);

/* ---------------- Card templates ---------------- */
const mediaInner = (game) => {
  if (game.thumbnail) {
    return `<img src="${escapeHtml(game.thumbnail)}" alt="" loading="lazy" width="640" height="360" data-art="${escapeHtml(game.title.charAt(0))}">`;
  }
  return `<span class="media-art" style="--art:${categoryColor(game.category)}">${escapeHtml(game.title.charAt(0))}</span>`;
};

const cardTemplate = (game) => {
  const url = gameUrl(game.slug);
  const title = escapeHtml(game.title);
  const label = typeLabel(game.type);
  const badge = game.status === "coming-soon"
    ? `<span class="card-status">Coming soon</span>`
    : "";
  const typeBadge = label ? `<span class="type-badge">${escapeHtml(label)}</span>` : "";
  return (
    `<article class="card" data-game-id="${escapeHtml(game.id)}">` +
      `<a class="card-media" href="${url}" tabindex="-1" aria-hidden="true">${mediaInner(game)}${badge}</a>` +
      `<div class="card-body">` +
        `<div class="pill-row"><span class="pill">${escapeHtml(game.category)}</span>${typeBadge}</div>` +
        `<h3 class="card-title">${title}</h3>` +
        `<p class="card-desc">${escapeHtml(game.description)}</p>` +
        `<div class="card-foot">` +
          `<a class="btn btn-primary btn-sm" href="${url}" aria-label="Play ${title}">Play ` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>` +
        `</div>` +
      `</div>` +
    `</article>`
  );
};

/* Replace broken thumbnails with generated art (delegated, capture phase). */
const handleMediaError = (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  const media = img.closest(".card-media, .game-cover");
  if (!media) return;
  const letter = escapeHtml(img.getAttribute("data-art") || "G");
  const art = document.createElement("span");
  art.className = "media-art";
  art.textContent = letter;
  img.remove();
  media.prepend(art);
};

/* ---------------- Filtering ---------------- */
const getFilteredGames = () => {
  const query = state.query.trim().toLowerCase();
  return validGames().filter((game) => {
    if (state.category !== ALL_CATEGORIES && game.category !== state.category) return false;
    if (state.type && game.type !== state.type) return false;
    if (!query) return true;
    const haystack = `${game.title} ${game.description} ${game.category} ${typeLabel(game.type)} ${tagsOf(game).join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
};

const getCategories = () => {
  const counts = new Map();
  for (const game of validGames()) {
    counts.set(game.category, (counts.get(game.category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const getTypes = () => {
  const counts = new Map();
  for (const game of validGames()) {
    if (!TYPE_LABELS[game.type]) continue;
    counts.set(game.type, (counts.get(game.type) || 0) + 1);
  }
  return TYPE_ORDER
    .filter((type) => counts.has(type))
    .map((type) => ({ type, label: TYPE_LABELS[type], count: counts.get(type) }));
};

const getNewGames = () => validGames().slice(-NEW_RAIL_SIZE).reverse();

/* ---------------- Rendering ---------------- */
const renderInto = (element, games) => {
  if (!element) return;
  element.innerHTML = games.map(cardTemplate).join("");
};

const renderFeatured = () => {
  renderInto($("#featured-grid"), validGames().filter((g) => g.featured));
};

const renderPopular = () => {
  renderInto($("#popular-grid"), validGames().filter((g) => g.popular));
};

const renderMinecraft = () => {
  renderInto($("#minecraft-grid"), validGames().filter((g) => g.category === MINECRAFT_CATEGORY));
};

const renderNew = () => {
  renderInto($("#new-grid"), getNewGames());
};

const renderCategories = () => {
  const grid = $("#categories-grid");
  if (!grid) return;
  grid.innerHTML = getCategories()
    .map(({ name, count }) => {
      const label = count === 1 ? "1 game" : `${count} games`;
      return (
        `<a class="category-card" href="#games" data-category="${escapeHtml(name)}">` +
          `<span class="category-dot" style="--dot:${categoryColor(name)}" aria-hidden="true">${escapeHtml(name.charAt(0))}</span>` +
          `<span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(label)}</p></span>` +
          `<span class="category-arrow" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>` +
          `</span></a>`
      );
    })
    .join("");
};

const makeChip = (kind, value, label, count, pressed) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chip";
  button.textContent = `${label} `;
  const countSpan = document.createElement("span");
  countSpan.className = "count";
  countSpan.textContent = `(${count})`;
  button.appendChild(countSpan);
  button.setAttribute("aria-pressed", String(pressed));
  button.dataset.kind = kind;
  button.dataset.value = value;
  return button;
};

const renderChips = () => {
  const bar = $("#filter-bar");
  if (!bar) return;
  bar.querySelectorAll(".chip").forEach((chip) => chip.remove());
  const total = validGames().length;
  const fragment = document.createDocumentFragment();
  fragment.appendChild(makeChip("category", ALL_CATEGORIES, ALL_CATEGORIES, total, state.category === ALL_CATEGORIES && !state.type));
  for (const { name, count } of getCategories()) {
    fragment.appendChild(makeChip("category", name, name, count, state.category === name && !state.type));
  }
  for (const { type, label, count } of getTypes()) {
    fragment.appendChild(makeChip("type", type, label, count, state.type === type));
  }
  bar.appendChild(fragment);
};

const syncChips = () => {
  document.querySelectorAll("#filter-bar .chip").forEach((chip) => {
    const pressed = chip.dataset.kind === "type"
      ? state.type === chip.dataset.value
      : state.category === chip.dataset.value && !state.type;
    chip.setAttribute("aria-pressed", String(pressed));
  });
};

const syncUrl = () => {
  try {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.type) params.set("type", state.type);
    else if (state.category !== ALL_CATEGORIES) params.set("category", state.category);
    const query = params.toString();
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  } catch {
    /* History API unavailable (e.g. sandboxed iframe) — filtering still works. */
  }
};

const hydrateFromUrl = () => {
  try {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    const category = params.get("category");
    const type = params.get("type");
    if (q) state.query = q.slice(0, 80);
    if (type && TYPE_LABELS[type]) {
      state.type = type;
      state.category = ALL_CATEGORIES;
    } else if (category && (category === ALL_CATEGORIES || getCategories().some((c) => c.name === category))) {
      state.category = category;
      state.type = null;
    }
  } catch {
    /* URL parsing unavailable — fall back to defaults. */
  }
};

const applyFilters = () => {
  const games = getFilteredGames();
  renderInto($("#games-grid"), games);

  const count = $("#results-count");
  if (count) {
    const total = validGames().length;
    count.textContent = games.length === total
      ? `Showing all ${total} games`
      : `Showing ${games.length} of ${total} games`;
  }

  const empty = $("#empty-state");
  if (empty) {
    const showEmpty = games.length === 0;
    empty.hidden = !showEmpty;
    if (showEmpty) {
      const message = $("#empty-message");
      if (message) {
        const q = state.query.trim();
        message.innerHTML = q
          ? `No games match <strong>${escapeHtml(q)}</strong>. Try a different search term or category.`
          : `No games in this category yet. Try a different filter.`;
      }
    }
  }

  syncChips();
};

const renderStats = () => {
  const gamesEl = $("#stat-games");
  const categoriesEl = $("#stat-categories");
  if (gamesEl) gamesEl.textContent = String(validGames().length);
  if (categoriesEl) categoriesEl.textContent = String(getCategories().length);
};

const renderYear = () => {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
};

/* ---------------- Navigation highlight ---------------- */
const initScrollSpy = () => {
  const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
  if (!links.length || !("IntersectionObserver" in window)) return;
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) =>
          link.setAttribute("aria-current", String(link.getAttribute("href") === `#${entry.target.id}`))
        );
      }
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
};

/* ---------------- Events ---------------- */
const resetFilters = () => {
  state.query = "";
  state.category = ALL_CATEGORIES;
  state.type = null;
};

const initEvents = () => {
  document.addEventListener("error", handleMediaError, true);

  const form = $("#search-form");
  const input = $("#search-input");
  if (form && input) {
    if (state.query) input.value = state.query;
    input.addEventListener("input", debounce(() => {
      state.query = input.value;
      applyFilters();
      syncUrl();
    }, DEBOUNCE_MS));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && input.value) {
        input.value = "";
        resetFilters();
        applyFilters();
        syncUrl();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = input.value;
      applyFilters();
      syncUrl();
      $("#games")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  $("#clear-search")?.addEventListener("click", () => {
    resetFilters();
    if (input) input.value = "";
    applyFilters();
    syncUrl();
    input?.focus();
  });

  $("#filter-bar")?.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    if (chip.dataset.kind === "type") {
      state.type = chip.dataset.value || null;
      state.category = ALL_CATEGORIES;
    } else {
      state.category = chip.dataset.value || ALL_CATEGORIES;
      state.type = null;
    }
    applyFilters();
    syncUrl();
  });

  $("#categories-grid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-category]");
    if (!card) return;
    state.category = card.dataset.category || ALL_CATEGORIES;
    state.type = null;
    applyFilters();
    syncUrl();
  });
};

/* ---------------- Init ---------------- */
hydrateFromUrl();
renderFeatured();
renderPopular();
renderMinecraft();
renderNew();
renderCategories();
renderChips();
renderStats();
renderYear();
applyFilters();
initEvents();
initScrollSpy();
