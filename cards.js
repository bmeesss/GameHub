/* ============================================================
   GameHub — shared game card renderer
   One card template for the homepage rails, the catalog grid
   and the "More like this" blocks on game pages. Favorite
   toggles are real <button> elements wired through a single
   delegated listener per container (no inline handlers), so
   dynamically rendered cards stay interactive without rebinding.
   Depends on catalog.js + player.js when present, but degrades
   gracefully: cards render with zero player state rather than
   throwing when a module failed to load.
   Load order: catalog.js -> player.js -> cards.js -> page script.
   ============================================================ */
"use strict";

var GameHubCards = (function () {
  var FALLBACK_COLOR = "#4f7cff";

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

  /* profile.js owns collections, ratings and notes. Cards degrade to
     "no personal data" when it failed to load. */
  function profile() {
    if (typeof GameHubProfile !== "undefined" && GameHubProfile) return GameHubProfile;
    if (typeof window !== "undefined" && window && window.GameHubProfile) return window.GameHubProfile;
    return null;
  }

  function inCollection(kind, id) {
    var store = profile();
    return Boolean(store && typeof store.inCollection === "function" && store.inCollection(kind, id));
  }

  function toggleCollection(kind, id) {
    var store = profile();
    if (!store || typeof store.toggleCollection !== "function") return false;
    return store.toggleCollection(kind, id);
  }

  function ratingOf(id) {
    var store = profile();
    if (!store || typeof store.getRating !== "function") return 0;
    return store.getRating(id) || 0;
  }

  /* Re-evaluating achievements after a data change keeps them
     honest without every caller having to remember. */
  function refreshAchievements() {
    var engine = null;
    if (typeof GameHubAchievements !== "undefined" && GameHubAchievements) engine = GameHubAchievements;
    else if (typeof window !== "undefined" && window && window.GameHubAchievements) engine = window.GameHubAchievements;
    if (engine && typeof engine.sync === "function") {
      try {
        engine.sync();
      } catch (err) { /* achievements must never break a card */ }
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function categoryColor(category) {
    var cat = catalog();
    if (cat && typeof cat.categoryColor === "function") return cat.categoryColor(category);
    return FALLBACK_COLOR;
  }

  function typeLabel(type) {
    var cat = catalog();
    if (cat && typeof cat.typeLabel === "function") return cat.typeLabel(type);
    return "";
  }

  function isValid(game) {
    var cat = catalog();
    if (cat && typeof cat.isValidGame === "function") return cat.isValidGame(game);
    return Boolean(game && game.id && game.title && game.slug && game.category);
  }

  /* Minecraft-style client slots (webgl/wasm) flip from "Coming
     soon" to playable as soon as a client is genuinely available:
     either shipped locally (marked after an existence check by the
     launcher/homepage) or configured centrally over HTTPS in
     client-config.js. Cards never claim playability without one. */
  var availableClients = typeof Set === "function" ? new Set() : null;

  function clientConfig() {
    if (typeof GameHubClients !== "undefined" && GameHubClients) return GameHubClients;
    if (typeof window !== "undefined" && window && window.GameHubClients) return window.GameHubClients;
    return null;
  }

  function isClientGame(game) {
    return Boolean(game) && (game.type === "webgl" || game.type === "wasm");
  }

  function httpsClientUrl(game) {
    var config = clientConfig();
    var entry = config && config.clients ? config.clients[game.slug] : null;
    var url = entry && typeof entry === "object" ? String(entry.url || "").trim() : "";
    return /^https:\/\/[^/]/i.test(url) ? url : "";
  }

  function clientReady(game) {
    if (!isClientGame(game) || game.status !== "coming-soon") return false;
    if (availableClients && availableClients.has(game.id)) return true;
    return Boolean(httpsClientUrl(game));
  }

  function markClientAvailable(id) {
    var clean = String(id == null ? "" : id).trim();
    if (!clean || !availableClients) return;
    availableClients.add(clean);
  }

  function isFavorite(id) {
    var store = player();
    return Boolean(store && typeof store.isFavorite === "function" && store.isFavorite(id));
  }

  function gameUrl(game, prefix) {
    return (prefix || "") + "games/" + encodeURIComponent(game.slug) + "/index.html";
  }

  function thumbUrl(game, prefix) {
    var src = game.thumbnail || "";
    if (!src) return "";
    if (/^(https?:|data:)/i.test(src)) return src;
    return (prefix || "") + src.replace(/^\.\//, "");
  }

  function mediaInner(game, prefix) {
    var src = thumbUrl(game, prefix);
    if (src) {
      var first = game.title ? game.title.charAt(0) : "G";
      return "<img src=\"" + escapeHtml(src) + "\" alt=\"\" loading=\"lazy\" width=\"640\" height=\"360\" data-art=\"" + escapeHtml(first) + "\">";
    }
    return "<span class=\"media-art\" style=\"--art:" + escapeHtml(categoryColor(game.category)) + "\">" + escapeHtml(game.title ? game.title.charAt(0) : "G") + "</span>";
  }

  var HEART_SVG = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20.7C6.4 17.2 3 13.6 3 9.9 3 7.2 5.1 5 7.8 5c1.7 0 3.2.9 4.2 2.3C13 5.9 14.5 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.3-9 10.8z\"></path></svg>";
  var BOOKMARK_SVG = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z\"></path></svg>";
  var CHECK_SVG = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8 12.5l2.6 2.6L16 9.5\"></path></svg>";
  var STAR_SVG = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z\"></path></svg>";

  var COLLECTION_META = {
    playlater: { label: "Play Later", active: "In Play Later", icon: BOOKMARK_SVG },
    completed: { label: "Completed", active: "Completed", icon: CHECK_SVG }
  };
  var ARROW_SVG = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14M13 6l6 6-6 6\"></path></svg>";

  function favButton(game) {
    var active = isFavorite(game.id);
    var label = (active ? "Remove " : "Add ") + game.title + (active ? " from" : " to") + " favorites";
    return (
      "<button class=\"fav-btn" + (active ? " is-active" : "") + "\" type=\"button\"" +
      " data-fav=\"" + escapeHtml(game.id) + "\"" +
      " aria-pressed=\"" + (active ? "true" : "false") + "\"" +
      " aria-label=\"" + escapeHtml(label) + "\"" +
      " title=\"" + escapeHtml(active ? "Remove from favorites" : "Add to favorites") + "\">" +
      HEART_SVG +
      "</button>"
    );
  }

  function collectionButton(kind, game) {
    var meta = COLLECTION_META[kind];
    if (!meta || !game || !game.id) return "";
    var active = inCollection(kind, game.id);
    var title = escapeHtml(game.title || "this game");
    var label = active ? meta.active : meta.label;
    return (
      "<button class=\"icon-toggle" + (active ? " is-active" : "") + "\" type=\"button\"" +
      " data-collection=\"" + escapeHtml(kind) + "\" data-game=\"" + escapeHtml(game.id) + "\"" +
      " aria-pressed=\"" + (active ? "true" : "false") + "\"" +
      " aria-label=\"" + escapeHtml((active ? "Remove " + (game.title || "this game") + " from " : "Add " + (game.title || "this game") + " to ") + meta.label) + "\"" +
      " title=\"" + title + " — " + meta.label + "\">" +
      meta.icon +
      "<span>" + escapeHtml(label) + "</span>" +
      "</button>"
    );
  }

  /* The visitor's own star rating, shown on cards as a reminder.
     It is never presented as a global rating. */
  function ratingBadge(game) {
    var value = ratingOf(game && game.id);
    if (!value) return "";
    var stars = "";
    for (var i = 1; i <= 5; i++) stars += i <= value ? "★" : "☆";
    return (
      "<span class=\"mine-badge mine-badge--rating\" title=\"Your rating (stored in this browser)\">" +
      stars + " My rating</span>"
    );
  }

  function cardTools(game) {
    if (!profile()) return "";
    var parts = [collectionButton("playlater", game), collectionButton("completed", game), ratingBadge(game)];
    var html = parts.filter(Boolean).join("");
    return html ? "<div class=\"card-tools\">" + html + "</div>" : "";
  }

  /* options: { prefix, fav } — prefix is "" on the homepage and
     "../" on game pages; fav:false hides the favorite toggle. */
  function cardTemplate(game, options) {
    if (!isValid(game)) return "";
    var opts = options || {};
    var prefix = opts.prefix || "";
    var showFav = opts.fav !== false;
    var url = gameUrl(game, prefix);
    var title = escapeHtml(game.title);
    var comingSoon = game.status === "coming-soon" && !clientReady(game);
    var minecraft = game.category === "Minecraft";
    var label = typeLabel(game.type);
    var badge = comingSoon ? "<span class=\"card-status\">Coming soon</span>" : "";
    var typeBadge = label ? "<span class=\"type-badge\">" + escapeHtml(label) + "</span>" : "";
    var versionBadge = game.version ? "<span class=\"version-badge\">v" + escapeHtml(game.version) + "</span>" : "";
    /* Provider games carry a small provider badge so players can
       see at a glance where a game comes from. */
    var provider = typeof game.provider === "string" ? game.provider.trim() : "";
    var providerBadge = provider ? "<span class=\"provider-badge\">" + escapeHtml(provider) + "</span>" : "";
    var action = comingSoon
      ? "<a class=\"btn btn-ghost btn-sm\" href=\"" + url + "\" aria-label=\"" + title + " details\">Details " + ARROW_SVG + "</a>"
      : "<a class=\"btn btn-primary btn-sm\" href=\"" + url + "\" aria-label=\"Play " + title + "\">Play " + ARROW_SVG + "</a>";
    return (
      "<article class=\"card" + (comingSoon ? " card--soon" : "") + (minecraft ? " card--minecraft" : "") + "\" data-game-id=\"" + escapeHtml(game.id) + "\">" +
        "<a class=\"card-media\" href=\"" + url + "\" tabindex=\"-1\" aria-hidden=\"true\">" + mediaInner(game, prefix) + badge + "</a>" +
        (showFav ? favButton(game) : "") +
        "<div class=\"card-body\">" +
          "<div class=\"pill-row\"><span class=\"pill\">" + escapeHtml(game.category) + "</span>" + typeBadge + versionBadge + providerBadge + "</div>" +
          "<h3 class=\"card-title\">" + title + "</h3>" +
          "<p class=\"card-desc\">" + escapeHtml(game.description) + "</p>" +
          (opts.tools === false ? "" : cardTools(game)) +
          "<div class=\"card-foot\">" + action + "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderCards(games, options) {
    if (!Array.isArray(games)) return "";
    return games.map(function (game) { return cardTemplate(game, options); }).join("");
  }

  function renderInto(element, games, options) {
    if (!element) return;
    element.innerHTML = renderCards(games, options);
  }

  /* Refresh every favorite toggle inside root to match stored state. */
  function syncFavButtons(root) {
    var scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    var store = player();
    var buttons = scope.querySelectorAll("[data-fav]");
    for (var i = 0; i < buttons.length; i++) {
      paintFavButton(buttons[i], store);
    }
  }

  function favTitleFor(gameId, active) {
    var cat = catalog();
    var game = cat && typeof cat.gameById === "function" ? cat.gameById(gameId) : null;
    return game && game.title ? game.title : "this game";
  }

  function paintFavButton(button, store) {
    var id = button.getAttribute("data-fav");
    var active = Boolean(store && typeof store.isFavorite === "function" && store.isFavorite(id));
    var title = favTitleFor(id, active);
    if (button.classList) button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", (active ? "Remove " : "Add ") + title + (active ? " from" : " to") + " favorites");
    button.setAttribute("title", active ? "Remove from favorites" : "Add to favorites");
  }

  /* One delegated click listener per container. onToggle(id, active)
     fires after the stored state changed; the button is repainted
     first so the UI never lags behind storage. */
  function wireFavorites(root, onToggle) {
    if (!root || typeof root.addEventListener !== "function") return;
    if (root.__ghFavWired) return;
    root.__ghFavWired = true;
    root.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-fav]") : null;
      if (!button) return;
      if (typeof root.contains === "function" && !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      var store = player();
      if (!store || typeof store.toggleFavorite !== "function") return;
      var id = button.getAttribute("data-fav");
      var active = store.toggleFavorite(id);
      paintFavButton(button, store);
      refreshAchievements();
      if (typeof onToggle === "function") {
        try {
          onToggle(id, active);
        } catch (err) { /* listener errors must not break the toggle */ }
      }
    });
  }

  /* Play Later / Completed toggles: same delegated pattern as the
     favorite toggle, again without a single inline handler. */
  function paintCollectionButton(button, store) {
    var kind = button.getAttribute("data-collection");
    var gameId = button.getAttribute("data-game");
    var meta = COLLECTION_META[kind];
    if (!meta) return;
    var active = Boolean(store && typeof store.inCollection === "function" && store.inCollection(kind, gameId));
    var cat = catalog();
    var game = cat && typeof cat.gameById === "function" ? cat.gameById(gameId) : null;
    var gameTitle = game && game.title ? game.title : "this game";
    if (button.classList) button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", (active ? "Remove " + gameTitle + " from " : "Add " + gameTitle + " to ") + meta.label);
    var label = button.querySelector ? button.querySelector("span") : null;
    if (label) label.textContent = active ? meta.active : meta.label;
  }

  function syncCollectionButtons(root) {
    var scope = root || (typeof document !== "undefined" ? document : null);
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    var store = profile();
    var buttons = scope.querySelectorAll("[data-collection]");
    for (var i = 0; i < buttons.length; i++) paintCollectionButton(buttons[i], store);
  }

  function wireCollections(root, onToggle) {
    if (!root || typeof root.addEventListener !== "function") return;
    if (root.__ghCollectionsWired) return;
    root.__ghCollectionsWired = true;
    root.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-collection]") : null;
      if (!button) return;
      if (typeof root.contains === "function" && !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      var store = profile();
      if (!store || typeof store.toggleCollection !== "function") return;
      var kind = button.getAttribute("data-collection");
      var id = button.getAttribute("data-game");
      var active = store.toggleCollection(kind, id);
      paintCollectionButton(button, store);
      refreshAchievements();
      if (typeof onToggle === "function") {
        try {
          onToggle(kind, id, active);
        } catch (err) { /* listener errors must not break the toggle */ }
      }
    });
  }

  /* One call mounts both delegated listeners plus the favorite
     repaint; used by every page that renders cards. */
  function wireCardTools(root, onFav, onCollection) {
    wireFavorites(root, onFav);
    wireCollections(root, onCollection);
  }

  return {
    escapeHtml: escapeHtml,
    gameUrl: gameUrl,
    cardTemplate: cardTemplate,
    renderCards: renderCards,
    renderInto: renderInto,
    favButton: favButton,
    syncFavButtons: syncFavButtons,
    paintFavButton: paintFavButton,
    wireFavorites: wireFavorites,
    wireCollections: wireCollections,
    wireCardTools: wireCardTools,
    syncCollectionButtons: syncCollectionButtons,
    paintCollectionButton: paintCollectionButton,
    collectionButton: collectionButton,
    ratingBadge: ratingBadge,
    isClientGame: isClientGame,
    clientReady: clientReady,
    markClientAvailable: markClientAvailable,
    refreshAchievements: refreshAchievements
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubCards = GameHubCards;
}
