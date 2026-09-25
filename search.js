/* ============================================================
   GameHub — global search overlay
   A real dialog (role="dialog", aria-modal) with live results,
   full keyboard control and no dependencies.

   Open with Ctrl+K, Cmd+K, "/" or the header search button.
   Navigate results with ArrowUp / ArrowDown and open with Enter.
   Escape closes the dialog and returns focus to the trigger.
   Typing the last row opens the full result list on the homepage
   with the classic shareable URL (?q=…#games), so the overlay and
   the existing URL search behaviour stay in sync.

   Searched fields come from the catalog: title, description,
   category, tags, type, version and provider — the catalog stays
   the single source of truth. Results are built with DOM APIs and
   textContent only, so catalog text can never become HTML.
   Load order: catalog.js -> player.js -> profile.js ->
   achievements.js -> cards.js -> search.js -> page script.
   ============================================================ */
"use strict";

var GameHubSearch = (function () {
  var MAX_RESULTS = 8;

  function catalog() {
    if (typeof GameHubCatalog !== "undefined" && GameHubCatalog) return GameHubCatalog;
    if (typeof window !== "undefined" && window && window.GameHubCatalog) return window.GameHubCatalog;
    return null;
  }

  function player() {
    if (typeof GameHubPlayer !== "undefined" && GameHubPlayer) return GameHubPlayer;
    if (typeof window !== "undefined" && window && window.GameHubPlayer) return window.GameHubPlayer;
    return null;
  }

  function achievements() {
    if (typeof GameHubAchievements !== "undefined" && GameHubAchievements) return GameHubAchievements;
    if (typeof window !== "undefined" && window && window.GameHubAchievements) return window.GameHubAchievements;
    return null;
  }

  /* ---------------- Relative path prefix ----------------
     search.js is loaded from the site root on every page, so the
     script's own src already tells us how deep the current page
     is: "search.js" -> root page, "../../search.js" -> game page. */
  function prefixFromScript() {
    try {
      var current = document.currentScript;
      if (current && typeof current.getAttribute === "function") {
        var src = current.getAttribute("src") || "";
        var index = src.lastIndexOf("/");
        if (index >= 0) return src.slice(0, index + 1);
      }
    } catch (err) { /* fall through to the pathname heuristic */ }
    try {
      var path = String(location.pathname || "");
      if (/\/games\/[^/]+\/play\/[^/]*$/.test(path)) return "../../../";
      if (/\/games\/[^/]+\/[^/]*$/.test(path)) return "../../";
      if (/\/(profile|categories)\/[^/]*$/.test(path)) return "../";
    } catch (err) { /* unknown: assume the site root */ }
    return "";
  }

  var PREFIX = prefixFromScript();

  function homeUrl() {
    return PREFIX + "index.html";
  }

  function gameUrl(game) {
    return PREFIX + "games/" + encodeURIComponent(game.slug) + "/index.html";
  }

  function thumbUrl(game) {
    var src = String((game && game.thumbnail) || "");
    if (!src || /^(https?:|data:)/i.test(src)) return src;
    return PREFIX + src.replace(/^\.\//, "");
  }

  /* ---------------- Ranking ----------------
     Catalog.searchMatches already decides inclusion (it covers
     every searchable field); this adds a relevance order on top so
     title matches win over description matches. */
  function score(game, query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return 0;
    var title = String(game.title || "").toLowerCase();
    var category = String(game.category || "").toLowerCase();
    var provider = String(game.provider || "").toLowerCase();
    var tags = (game.tags || []).join(" ").toLowerCase();
    var type = catalog() && catalog().typeLabel ? String(catalog().typeLabel(game.type)).toLowerCase() : "";
    var version = String(game.version || "").toLowerCase();
    var description = String(game.description || "").toLowerCase();
    var total = 0;
    if (title === q) total += 120;
    if (title.indexOf(q) === 0) total += 80;
    else if (title.indexOf(q) !== -1) total += 55;
    if (category === q) total += 40;
    else if (category.indexOf(q) !== -1) total += 20;
    if (tags.indexOf(q) !== -1) total += 16;
    if (type.indexOf(q) !== -1) total += 14;
    if (provider.indexOf(q) !== -1) total += 12;
    if (version.indexOf(q) !== -1) total += 8;
    if (description.indexOf(q) !== -1) total += 6;
    if (game.featured) total += 2;
    if (game.popular) total += 1;
    return total;
  }

  function search(query) {
    var cat = catalog();
    if (!cat || typeof cat.filterGames !== "function") return [];
    var q = String(query == null ? "" : query).trim();
    var pool = cat.validGames ? cat.validGames() : cat.games || [];
    var matches = q
      ? pool.filter(function (game) { return cat.searchMatches(game, q); })
      : cat.getPopular
        ? cat.getPopular().slice(0, MAX_RESULTS)
        : pool.slice(0, MAX_RESULTS);
    if (q) {
      matches = matches.slice().sort(function (a, b) {
        return score(b, q) - score(a, q) || String(a.title).localeCompare(String(b.title));
      });
    }
    return matches.slice(0, MAX_RESULTS);
  }

  /* ---------------- DOM helpers ---------------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgIcon(path, extra) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path +
      (extra || "") + "</svg>"
    );
  }

  var state = {
    overlay: null,
    input: null,
    list: null,
    count: null,
    trigger: null,
    results: [],
    active: -1,
    lastFocus: null,
    built: false
  };

  function build() {
    if (state.built || typeof document === "undefined" || typeof document.createElement !== "function") return state.overlay;
    var overlay = el("div", "search-overlay");
    overlay.id = "gh-search-overlay";
    overlay.hidden = true;

    var backdrop = el("div", "search-backdrop");
    backdrop.setAttribute("data-search-close", "");
    overlay.appendChild(backdrop);

    var dialog = el("div", "search-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "gh-search-title");

    var head = el("div", "search-dialog-head");
    var icon = el("span", "search-dialog-icon");
    icon.innerHTML = svgIcon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.6-3.6"></path>');
    var label = el("h2", "sr-only", "Search games");
    label.id = "gh-search-title";
    var input = el("input", "search-dialog-input");
    input.id = "gh-search-input";
    input.type = "search";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 80;
    input.placeholder = "Search games, categories, providers…";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", "gh-search-results");
    input.setAttribute("aria-label", "Search games");
    var kbd = el("kbd", "search-kbd", "Esc");
    head.appendChild(icon);
    head.appendChild(label);
    head.appendChild(input);
    head.appendChild(kbd);

    var list = el("ul", "search-results");
    list.id = "gh-search-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Search results");

    var foot = el("div", "search-dialog-foot");
    var hint = el("span", "search-foot-hint", "↑↓ to navigate · Enter to open · Esc to close");
    var count = el("span", "search-foot-count");
    count.id = "gh-search-count";
    foot.appendChild(hint);
    foot.appendChild(count);

    dialog.appendChild(head);
    dialog.appendChild(list);
    dialog.appendChild(foot);
    overlay.appendChild(dialog);

    overlay.addEventListener("click", function (event) {
      var target = event.target;
      if (target && typeof target.closest === "function" && target.closest("[data-search-close]")) {
        close();
      }
    });
    overlay.addEventListener("keydown", onKeydown);
    dialog.addEventListener("keydown", onKeydown);
    input.addEventListener("input", function () {
      render(state.input.value);
    });

    var host = document.body || document.documentElement;
    if (host && typeof host.appendChild === "function") host.appendChild(overlay);
    state.overlay = overlay;
    state.input = input;
    state.list = list;
    state.count = count;
    state.built = true;
    return overlay;
  }

  function optionId(index) {
    return "gh-search-option-" + index;
  }

  function resultRow(game, index) {
    var row = el("li", "search-result-item");
    row.setAttribute("role", "presentation");
    var link = el("a", "search-result");
    link.id = optionId(index);
    link.setAttribute("role", "option");
    link.setAttribute("aria-selected", "false");
    link.setAttribute("tabindex", "-1");
    link.href = gameUrl(game);

    var media = el("span", "search-result-media");
    var src = thumbUrl(game);
    if (src) {
      var img = el("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.width = 96;
      img.height = 54;
      media.appendChild(img);
    } else {
      media.appendChild(el("span", "media-art", String(game.title || "?").charAt(0)));
    }
    var body = el("span", "search-result-body");
    body.appendChild(el("span", "search-result-title", String(game.title || "")));
    var sub = el("span", "search-result-sub");
    var cat = catalog();
    var parts = [String(game.category || "")];
    if (cat && cat.typeLabel) parts.push(String(cat.typeLabel(game.type)));
    if (game.version) parts.push("v" + game.version);
    if (game.provider) parts.push(String(game.provider));
    sub.textContent = parts.filter(Boolean).join(" · ");
    body.appendChild(sub);
    var arrow = el("span", "search-result-arrow");
    arrow.innerHTML = svgIcon('<path d="M5 12h14M13 6l6 6-6 6"></path>');
    link.appendChild(media);
    link.appendChild(body);
    link.appendChild(arrow);
    row.appendChild(link);
    return row;
  }

  function allResultsRow(query, matches) {
    var row = el("li", "search-result-item search-result-item--all");
    row.setAttribute("role", "presentation");
    var link = el("a", "search-result search-result--all");
    link.id = optionId(matches.length);
    link.setAttribute("role", "option");
    link.setAttribute("aria-selected", "false");
    link.setAttribute("tabindex", "-1");
    link.href = homeUrl() + "?q=" + encodeURIComponent(query) + "#games";
    var icon = el("span", "search-result-media search-result-media--icon");
    icon.innerHTML = svgIcon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.6-3.6"></path>');
    var body = el("span", "search-result-body");
    body.appendChild(el("span", "search-result-title", "See all results for “" + query + "”"));
    body.appendChild(el("span", "search-result-sub", "Filter the full catalog on the homepage"));
    link.appendChild(icon);
    link.appendChild(body);
    row.appendChild(link);
    return row;
  }

  function render(query) {
    if (!state.list) return;
    var q = String(query == null ? "" : query).trim();
    var matches = search(q);
    state.results = matches;
    state.list.textContent = "";
    if (!matches.length) {
      var empty = el("li", "search-empty");
      empty.setAttribute("role", "presentation");
      empty.appendChild(el("strong", null, q ? "No games match “" + q + "”" : "No games yet"));
      empty.appendChild(el("span", null, "Try another title, category, tag or provider."));
      state.list.appendChild(empty);
      state.active = -1;
      if (state.count) state.count.textContent = "";
      if (state.input) state.input.setAttribute("aria-activedescendant", "");
      return;
    }
    for (var i = 0; i < matches.length; i++) {
      state.list.appendChild(resultRow(matches[i], i));
    }
    if (q) state.list.appendChild(allResultsRow(q, matches));
    state.active = -1;
    if (state.count) {
      state.count.textContent = q
        ? matches.length + (matches.length === 1 ? " result" : " results") + " for “" + q + "”"
        : "Popular right now";
    }
    if (state.input) state.input.setAttribute("aria-activedescendant", "");
    setActive(0, false);
  }

  function options() {
    if (!state.list || typeof state.list.querySelectorAll !== "function") return [];
    return Array.prototype.slice.call(state.list.querySelectorAll('[role="option"]'));
  }

  function setActive(index, scroll) {
    var items = options();
    if (!items.length) return;
    var next = index;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    for (var i = 0; i < items.length; i++) {
      var isActive = i === next;
      if (items[i].classList) items[i].classList.toggle("is-active", isActive);
      items[i].setAttribute("aria-selected", isActive ? "true" : "false");
    }
    state.active = next;
    if (state.input) state.input.setAttribute("aria-activedescendant", items[next].id || "");
    if (scroll && typeof items[next].scrollIntoView === "function") {
      try {
        items[next].scrollIntoView({ block: "nearest" });
      } catch (err) { /* older browsers: element stays visible anyway */ }
    }
  }

  function move(delta) {
    var items = options();
    if (!items.length) return;
    setActive(state.active + delta, true);
  }

  function activeOption() {
    var items = options();
    if (!items.length) return null;
    var index = state.active >= 0 && state.active < items.length ? state.active : 0;
    return items[index];
  }

  function remember(query) {
    var store = player();
    var q = String(query == null ? "" : query).trim();
    if (store && typeof store.recordSearch === "function" && q) {
      try {
        store.recordSearch(q);
      } catch (err) { /* recent searches are a nicety, never a blocker */ }
    }
  }

  function follow(url) {
    if (!url) return;
    if (typeof location !== "undefined" && typeof location.assign === "function") {
      location.assign(url);
      return;
    }
    if (typeof location !== "undefined") location.href = url;
  }

  function submit() {
    var option = activeOption();
    if (!option) return;
    var href = option.getAttribute("href") || option.href || "";
    if (href) remember(state.input ? state.input.value : "");
    close();
    follow(href);
  }

  function onKeydown(event) {
    /* The handler listens on both the overlay and the dialog (a
       child), so one keypress bubbles through it twice — bail out on
       the second pass instead of moving the selection twice. */
    if (event.defaultPrevented) return;
    var key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      setActive(0, true);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      setActive(options().length - 1, true);
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    if (key === "Tab") {
      /* Keep focus inside the dialog while it is open. */
      var focusable = options();
      if (!focusable.length) return;
      event.preventDefault();
      move(event.shiftKey ? -1 : 1);
    }
  }

  function onDocumentKeydown(event) {
    var key = event.key;
    var meta = event.ctrlKey || event.metaKey;
    if (meta && (key === "k" || key === "K")) {
      event.preventDefault();
      if (isOpen()) close();
      else open();
      return;
    }
    if (key === "/" && !meta && !event.altKey) {
      if (isTyping(event.target)) return;
      event.preventDefault();
      open();
    }
  }

  function isTyping(target) {
    if (!target) return false;
    var tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return Boolean(target.isContentEditable);
  }

  function isOpen() {
    return Boolean(state.overlay && state.overlay.hidden === false);
  }

  function open(initialQuery) {
    build();
    if (!state.overlay) return false;
    state.lastFocus = document.activeElement || state.trigger || null;
    state.overlay.hidden = false;
    if (state.trigger) state.trigger.setAttribute("aria-expanded", "true");
    if (state.input) {
      var current = typeof initialQuery === "string" ? initialQuery : "";
      var main = document.getElementById ? document.getElementById("search-input") : null;
      if (!current && main && main.value && document.activeElement === main) current = main.value;
      state.input.value = current;
      try {
        state.input.focus();
      } catch (err) { /* focus may be blocked: the dialog is still usable */ }
      if (typeof state.input.select === "function") {
        try { state.input.select(); } catch (err) { /* ignore */ }
      }
    }
    render(state.input ? state.input.value : "");
    try {
      if (typeof document !== "undefined" && document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.add("search-open");
      }
    } catch (err) { /* ignore */ }
    return true;
  }

  function close() {
    if (!state.overlay) return false;
    state.overlay.hidden = true;
    if (state.trigger) state.trigger.setAttribute("aria-expanded", "false");
    try {
      if (typeof document !== "undefined" && document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.remove("search-open");
      }
    } catch (err) { /* ignore */ }
    var previous = state.lastFocus || state.trigger;
    if (previous && typeof previous.focus === "function") {
      try { previous.focus(); } catch (err) { /* ignore */ }
    }
    return true;
  }

  function toggle() {
    if (isOpen()) return close();
    return open();
  }

  /* ---------------- Header trigger ---------------- */
  var TRIGGER_ICON = svgIcon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.6-3.6"></path>');

  function mountTrigger() {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    var existing = document.getElementById ? document.getElementById("gh-search-trigger") : null;
    if (existing) {
      state.trigger = existing;
      return existing;
    }
    var host = document.querySelector ? document.querySelector(".header-inner") : null;
    if (!host) return null;
    var button = el("button", "search-trigger");
    button.id = "gh-search-trigger";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "gh-search-overlay");
    button.setAttribute("aria-label", "Search games (Ctrl+K)");
    button.title = "Search games (Ctrl+K)";
    button.innerHTML = '<span class="search-trigger-icon">' + TRIGGER_ICON + '</span>' +
      '<span class="search-trigger-label">Search</span>' +
      '<kbd class="search-trigger-kbd">Ctrl K</kbd>';
    var form = document.querySelector ? document.querySelector(".header-search") : null;
    if (form && form.parentNode && typeof form.parentNode.insertBefore === "function") {
      form.parentNode.insertBefore(button, form);
    } else if (typeof host.appendChild === "function") {
      host.appendChild(button);
    } else {
      return null;
    }
    button.addEventListener("click", function () {
      open();
    });
    state.trigger = button;
    return button;
  }

  function init() {
    if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
    build();
    mountTrigger();
    document.addEventListener("keydown", onDocumentKeydown);
    /* The overlay is created lazily on demand when a page never
       calls open() — build it here so ids/aria-controls resolve. */
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  return {
    PREFIX: PREFIX,
    MAX_RESULTS: MAX_RESULTS,
    search: search,
    score: score,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: isOpen,
    render: render,
    mountTrigger: mountTrigger,
    gameUrl: gameUrl,
    homeUrl: homeUrl
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubSearch = GameHubSearch;
}
