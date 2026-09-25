/* ============================================================
   GameHub — homepage controller
   Renders rails, filters, search, sorting and player shelves
   from the shared modules: catalog.js (metadata), player.js
   (favorites / recently played / searches) and cards.js (cards).
   No game code ever loads here: cards link out to game pages.
   Run tests with: node tests/smoke.mjs && python3 tests/check.py
   ============================================================ */
"use strict";

/* ---------------- Module handles ---------------- */
const Catalog = (() => {
  if (typeof GameHubCatalog !== "undefined" && GameHubCatalog) return GameHubCatalog;
  if (typeof window !== "undefined" && window.GameHubCatalog) return window.GameHubCatalog;
  return null;
})();
const Player = (() => {
  if (typeof GameHubPlayer !== "undefined" && GameHubPlayer) return GameHubPlayer;
  if (typeof window !== "undefined" && window.GameHubPlayer) return window.GameHubPlayer;
  return null;
})();
const Cards = (() => {
  if (typeof GameHubCards !== "undefined" && GameHubCards) return GameHubCards;
  if (typeof window !== "undefined" && window.GameHubCards) return window.GameHubCards;
  return null;
})();

const HOME_ALL = (Catalog && Catalog.ALL_CATEGORIES) || "All";
const HOME_MINECRAFT = (Catalog && Catalog.MINECRAFT_CATEGORY) || "Minecraft";
const HOME_SORTS = (Catalog && Catalog.SORT_OPTIONS) || ["featured", "popular", "newest", "az"];
const DEBOUNCE_MS = 150;
const SPOTLIGHT_FALLBACK_INDEX = 0;

/* ---------------- Helpers ---------------- */
const $ = (selector, scope = document) => scope.querySelector(selector);

const escapeHtml = (value) => {
  if (Cards) return Cards.escapeHtml(value);
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const debounce = (fn, wait) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const state = { query: "", category: HOME_ALL, type: null, sort: "featured", favoritesOnly: false };

const allGames = () => (Catalog ? Catalog.validGames() : []);
const listCategories = () => (Catalog ? Catalog.getCategories() : []);
const listTypes = () => (Catalog ? Catalog.getTypes() : []);
const listNew = () => (Catalog ? Catalog.getNewGames() : []);
const typeName = (type) => (Catalog ? Catalog.typeLabel(type) : "");
const catColor = (category) => (Catalog ? Catalog.categoryColor(category) : "#4f7cff");
const findGame = (id) => (Catalog && typeof Catalog.gameById === "function" ? Catalog.gameById(id) : null);
const favoritesOf = () => (Player ? Player.getFavorites() : []);

const getFilteredGames = () => {
  if (!Catalog) return [];
  const filtered = Catalog.filterGames({
    query: state.query,
    category: state.category,
    type: state.type,
    favoritesOnly: state.favoritesOnly,
    favorites: favoritesOf()
  });
  return Catalog.sortGames(filtered, state.sort);
};

const renderInto = (element, games) => {
  if (!element || !Cards) return;
  Cards.renderInto(element, games, { prefix: "" });
};

/* Replace broken thumbnails with generated art (delegated, capture phase). */
const handleMediaError = (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  const media = img.closest(".card-media, .game-cover, .spotlight-media");
  if (!media || media.querySelector(".media-art")) return;
  const art = document.createElement("span");
  art.className = "media-art";
  art.textContent = img.getAttribute("data-art") || "G";
  img.remove();
  media.prepend(art);
};

/* ---------------- Spotlight ---------------- */
const pickSpotlight = () => {
  const games = allGames();
  if (!games.length) return null;
  const featured = Catalog ? Catalog.getFeatured().filter((g) => g.status === "available") : [];
  return featured[0] || games[SPOTLIGHT_FALLBACK_INDEX] || null;
};

const renderSpotlight = () => {
  const section = $("#spotlight");
  if (!section) return;
  const game = pickSpotlight();
  const mount = section.querySelector(".spotlight-inner");
  if (!game || !Cards || !mount) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const url = Cards.gameUrl(game, "");
  const thumb = game.thumbnail || "";
  const media = thumb
    ? `<a class="spotlight-media" href="${url}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(thumb)}" alt="" width="640" height="360" data-art="${escapeHtml(game.title.charAt(0))}"></a>`
    : `<div class="spotlight-media"><span class="media-art" style="--art:${escapeHtml(catColor(game.category))}">${escapeHtml(game.title.charAt(0))}</span></div>`;
  const label = typeName(game.type);
  mount.innerHTML =
    `${media}<div class="spotlight-body">` +
      `<p class="eyebrow">Spotlight</p>` +
      `<h2 class="spotlight-title">${escapeHtml(game.title)}</h2>` +
      `<p class="spotlight-desc">${escapeHtml(game.description)}</p>` +
      `<div class="pill-row"><span class="pill">${escapeHtml(game.category)}</span>` +
        (label ? `<span class="type-badge">${escapeHtml(label)}</span>` : "") +
        (game.version ? `<span class="version-badge">v${escapeHtml(game.version)}</span>` : "") +
      `</div>` +
      `<div class="spotlight-actions">` +
        `<a class="btn btn-primary" href="${url}" aria-label="Play ${escapeHtml(game.title)}">Play now ` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>` +
        Cards.favButton(game) +
      `</div>` +
    `</div>`;
};

/* ---------------- Player shelves ---------------- */
const renderRecent = () => {
  const section = $("#recent");
  const grid = $("#recent-grid");
  if (!section || !grid) return;
  const ids = Player ? Player.getRecentlyPlayed() : [];
  const games = ids.map(findGame).filter(Boolean);
  section.hidden = games.length === 0;
  renderInto(grid, games);
};

const renderFavoritesShelf = () => {
  const section = $("#favorites");
  const grid = $("#favorites-grid");
  if (!section || !grid) return;
  const games = favoritesOf().map(findGame).filter(Boolean);
  section.hidden = games.length === 0;
  renderInto(grid, games);
};

/* ---------------- Rails ---------------- */
const renderFeatured = () => {
  renderInto($("#featured-grid"), Catalog ? Catalog.getFeatured() : []);
};

const renderPopular = () => {
  renderInto($("#popular-grid"), Catalog ? Catalog.getPopular() : []);
};

const renderMinecraft = () => {
  renderInto($("#minecraft-grid"), allGames().filter((g) => g.category === HOME_MINECRAFT));
};

const renderNew = () => {
  renderInto($("#new-grid"), listNew());
};

const renderCategories = () => {
  const grid = $("#categories-grid");
  if (!grid) return;
  grid.innerHTML = listCategories()
    .map(({ name, count }) => {
      const label = count === 1 ? "1 game" : `${count} games`;
      return (
        `<a class="category-card" href="#games" data-category="${escapeHtml(name)}">` +
          `<span class="category-dot" style="--dot:${catColor(name)}" aria-hidden="true">${escapeHtml(name.charAt(0))}</span>` +
          `<span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(label)}</p></span>` +
          `<span class="category-arrow" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>` +
          `</span></a>`
      );
    })
    .join("");
};

/* ---------------- Filter chips + sorting ---------------- */
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
  const total = allGames().length;
  const fragment = document.createDocumentFragment();
  fragment.appendChild(makeChip("category", HOME_ALL, HOME_ALL, total, state.category === HOME_ALL && !state.type && !state.favoritesOnly));
  if (Player) {
    fragment.appendChild(makeChip("favorites", "1", "♥ Favorites", favoritesOf().length, state.favoritesOnly));
  }
  for (const { name, count } of listCategories()) {
    fragment.appendChild(makeChip("category", name, name, count, state.category === name && !state.type && !state.favoritesOnly));
  }
  for (const { type, label, count } of listTypes()) {
    fragment.appendChild(makeChip("type", type, label, count, state.type === type && !state.favoritesOnly));
  }
  bar.appendChild(fragment);
};

const syncChips = () => {
  document.querySelectorAll("#filter-bar .chip").forEach((chip) => {
    let pressed = false;
    if (chip.dataset.kind === "favorites") pressed = state.favoritesOnly;
    else if (state.favoritesOnly) pressed = false;
    else if (chip.dataset.kind === "type") pressed = state.type === chip.dataset.value;
    else pressed = state.category === chip.dataset.value && !state.type;
    chip.setAttribute("aria-pressed", String(pressed));
  });
  const select = $("#sort-select");
  if (select && select.value !== state.sort) select.value = state.sort;
};

const syncUrl = () => {
  try {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.favoritesOnly) params.set("favorites", "1");
    else if (state.type) params.set("type", state.type);
    else if (state.category !== HOME_ALL) params.set("category", state.category);
    if (state.sort && state.sort !== "featured") params.set("sort", state.sort);
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
    const sort = params.get("sort");
    const favorites = params.get("favorites");
    if (q) state.query = q.slice(0, 80);
    if (favorites === "1") {
      state.favoritesOnly = true;
      state.category = HOME_ALL;
      state.type = null;
    } else if (type && typeName(type)) {
      state.type = type;
      state.category = HOME_ALL;
    } else if (category && (category === HOME_ALL || listCategories().some((c) => c.name === category))) {
      state.category = category;
      state.type = null;
    }
    if (sort && HOME_SORTS.includes(sort)) state.sort = sort;
  } catch {
    /* URL parsing unavailable — fall back to defaults. */
  }
};

/* ---------------- Catalog grid ---------------- */
const applyFilters = () => {
  const games = getFilteredGames();
  renderInto($("#games-grid"), games);

  const count = $("#results-count");
  if (count) {
    const total = allGames().length;
    if (state.favoritesOnly && games.length === 0 && favoritesOf().length === 0) {
      count.textContent = "No favorite games yet";
    } else {
      count.textContent = games.length === total && !state.favoritesOnly
        ? `Showing all ${total} games`
        : `Showing ${games.length} of ${total} games`;
    }
  }

  const empty = $("#empty-state");
  if (empty) {
    const showEmpty = games.length === 0;
    empty.hidden = !showEmpty;
    if (showEmpty) {
      const message = $("#empty-message");
      if (message) {
        const q = state.query.trim();
        if (state.favoritesOnly && favoritesOf().length === 0) {
          message.innerHTML = "You have no favorite games yet. Tap the <strong>♥</strong> on any game to pin it here.";
        } else if (q) {
          message.innerHTML = `No games match <strong>${escapeHtml(q)}</strong>. Try a different search term or category.`;
        } else {
          message.innerHTML = "No games in this view yet. Try a different filter.";
        }
      }
    }
  }

  syncChips();
};

const renderStats = () => {
  const gamesEl = $("#stat-games");
  const categoriesEl = $("#stat-categories");
  if (gamesEl) gamesEl.textContent = String(allGames().length);
  if (categoriesEl) categoriesEl.textContent = String(listCategories().length);
};

const renderYear = () => {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
};

/* ---------------- Recent searches ---------------- */
const renderRecentSearches = () => {
  const panel = $("#recent-searches");
  const input = $("#search-input");
  if (!panel || !input) return;
  const terms = Player ? Player.getRecentSearches().filter((t) => t.toLowerCase() !== input.value.trim().toLowerCase()) : [];
  if (!terms.length) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML =
    `<p class="recent-title">Recent searches</p>` +
    `<ul>` +
    terms.map((term) => `<li><button type="button" data-search="${escapeHtml(term)}">${escapeHtml(term)}</button></li>`).join("") +
    `</ul>` +
    `<button type="button" class="recent-clear" data-search-clear>Clear recent searches</button>`;
  panel.hidden = false;
};

const hideRecentSearches = () => {
  const panel = $("#recent-searches");
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }
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
  state.category = HOME_ALL;
  state.type = null;
  state.sort = "featured";
  state.favoritesOnly = false;
};

const focusFirstResult = () => {
  const first = $("#games-grid .card-body a, #games-grid .card-media");
  if (first) first.focus();
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
      renderRecentSearches();
    }, DEBOUNCE_MS));
    input.addEventListener("focus", renderRecentSearches);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (input.value) {
          input.value = "";
          resetFilters();
          applyFilters();
          syncUrl();
        }
        hideRecentSearches();
        input.blur();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusFirstResult();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = input.value;
      if (Player && state.query.trim()) Player.recordSearch(state.query.trim());
      applyFilters();
      syncUrl();
      hideRecentSearches();
      $("#games")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-search")) hideRecentSearches();
    });
  }

  $("#recent-searches")?.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-search-clear]");
    if (clear) {
      Player?.clearRecentSearches();
      hideRecentSearches();
      input?.focus();
      return;
    }
    const item = event.target.closest("[data-search]");
    if (!item || !input) return;
    input.value = item.dataset.search || "";
    state.query = input.value;
    applyFilters();
    syncUrl();
    hideRecentSearches();
    $("#games")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

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
    if (chip.dataset.kind === "favorites") {
      state.favoritesOnly = !state.favoritesOnly;
      if (state.favoritesOnly) {
        state.category = HOME_ALL;
        state.type = null;
      }
    } else if (chip.dataset.kind === "type") {
      state.type = chip.dataset.value || null;
      state.category = HOME_ALL;
      state.favoritesOnly = false;
    } else {
      state.category = chip.dataset.value || HOME_ALL;
      state.type = null;
      state.favoritesOnly = false;
    }
    applyFilters();
    syncUrl();
  });

  $("#sort-select")?.addEventListener("change", (event) => {
    const value = event.target.value;
    state.sort = HOME_SORTS.includes(value) ? value : "featured";
    applyFilters();
    syncUrl();
  });

  $("#categories-grid")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-category]");
    if (!card) return;
    state.category = card.dataset.category || HOME_ALL;
    state.type = null;
    state.favoritesOnly = false;
    applyFilters();
    syncUrl();
  });

  if (Cards) {
    Cards.wireFavorites(document, () => {
      renderFavoritesShelf();
      renderChips();
      syncChips();
      Cards.syncFavButtons(document);
      if (state.favoritesOnly) applyFilters();
    });
  }
};

/* ---------------- Init ---------------- */
hydrateFromUrl();
renderSpotlight();
renderRecent();
renderFavoritesShelf();
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
