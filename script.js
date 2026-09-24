/* ============================================================
   GameHub — homepage logic
   Single source of truth: the GAMES catalog below.
   To add a game: append an entry + create games/<slug>/index.html
   + add assets/thumbnails/<slug>.svg (see README).
   ============================================================ */
"use strict";

/* ---------------- Game catalog ----------------
   thumbnail: relative path to artwork, or null to render
   generated CSS/SVG placeholder art instead.
   status: "playable" | "coming-soon"                       */
const GAMES = [
  {
    id: "neon-breakout",
    title: "Neon Breakout",
    slug: "neon-breakout",
    description: "Smash through glowing brick waves with a light-charged paddle and chain massive combos.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/neon-breakout.svg",
    featured: true,
    popular: true,
    status: "coming-soon"
  },
  {
    id: "pixel-puzzles",
    title: "Pixel Puzzles",
    slug: "pixel-puzzles",
    description: "Slot colorful blocks into perfect patterns in this calm, brain-teasing puzzle collection.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/pixel-puzzles.svg",
    featured: true,
    popular: false,
    status: "coming-soon"
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
    status: "coming-soon"
  },
  {
    id: "labyrinth-dash",
    title: "Labyrinth Dash",
    slug: "labyrinth-dash",
    description: "Race the clock through shifting mazes, dodge traps and find the exit before time runs out.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/labyrinth-dash.svg",
    featured: false,
    popular: true,
    status: "coming-soon"
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
    status: "coming-soon"
  },
  {
    id: "reaction-arena",
    title: "Reaction Arena",
    slug: "reaction-arena",
    description: "Test your reflexes in rapid-fire reaction trials and climb the reaction-time ranks.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/reaction-arena.svg",
    featured: false,
    popular: false,
    status: "coming-soon"
  }
];

const CATEGORY_COLORS = {
  Arcade: "#22d3ee",
  Puzzle: "#a78bfa",
  Action: "#fb7185",
  Strategy: "#34d399"
};
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

const debounce = (fn, wait) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const state = { query: "", category: ALL_CATEGORIES };

const isValidGame = (game) =>
  Boolean(game && game.id && game.title && game.slug && game.category);

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
  const badge = game.status === "coming-soon"
    ? `<span class="card-status">Coming soon</span>`
    : "";
  return (
    `<article class="card" data-game-id="${escapeHtml(game.id)}">` +
      `<a class="card-media" href="${url}" tabindex="-1" aria-hidden="true">${mediaInner(game)}${badge}</a>` +
      `<div class="card-body">` +
        `<span class="pill">${escapeHtml(game.category)}</span>` +
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
  return GAMES.filter((game) => {
    if (!isValidGame(game)) return false;
    if (state.category !== ALL_CATEGORIES && game.category !== state.category) return false;
    if (!query) return true;
    const haystack = `${game.title} ${game.description} ${game.category}`.toLowerCase();
    return haystack.includes(query);
  });
};

const getCategories = () => {
  const counts = new Map();
  for (const game of GAMES) {
    if (!isValidGame(game)) continue;
    counts.set(game.category, (counts.get(game.category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/* ---------------- Rendering ---------------- */
const renderInto = (element, games) => {
  if (!element) return;
  element.innerHTML = games.map(cardTemplate).join("");
};

const renderFeatured = () => {
  renderInto($("#featured-grid"), GAMES.filter((g) => isValidGame(g) && g.featured));
};

const renderPopular = () => {
  renderInto($("#popular-grid"), GAMES.filter((g) => isValidGame(g) && g.popular));
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

const renderChips = () => {
  const bar = $("#filter-bar");
  if (!bar) return;
  bar.querySelectorAll(".chip").forEach((chip) => chip.remove());
  const categories = getCategories();
  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const chips = [{ name: ALL_CATEGORIES, count: total }, ...categories];
  const fragment = document.createDocumentFragment();
  for (const { name, count } of chips) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `${name} `;
    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = `(${count})`;
    button.appendChild(countSpan);
    button.setAttribute("aria-pressed", String(state.category === name));
    button.dataset.category = name;
    fragment.appendChild(button);
  }
  bar.appendChild(fragment);
};

const syncChips = () => {
  document.querySelectorAll("#filter-bar .chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.category === state.category));
  });
};

const syncUrl = () => {
  try {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.category !== ALL_CATEGORIES) params.set("category", state.category);
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
    if (q) state.query = q.slice(0, 80);
    if (category && (category === ALL_CATEGORIES || getCategories().some((c) => c.name === category))) {
      state.category = category;
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
    const total = GAMES.filter(isValidGame).length;
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
  if (gamesEl) gamesEl.textContent = String(GAMES.filter(isValidGame).length);
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
        state.query = "";
        state.category = ALL_CATEGORIES;
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
    state.query = "";
    state.category = ALL_CATEGORIES;
    if (input) input.value = "";
    applyFilters();
    syncUrl();
    input?.focus();
  });

  $("#filter-bar")?.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category || ALL_CATEGORIES;
    applyFilters();
    syncUrl();
  });

  $("#categories-grid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-category]");
    if (!card) return;
    state.category = card.dataset.category || ALL_CATEGORIES;
    applyFilters();
    syncUrl();
  });
};

/* ---------------- Init ---------------- */
hydrateFromUrl();
renderFeatured();
renderPopular();
renderCategories();
renderChips();
renderStats();
renderYear();
applyFilters();
initEvents();
initScrollSpy();
