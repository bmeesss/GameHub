/* GameHub 3.0 — category landing page controller.
   Every category page is a thin shell: the title, description, game
   count, featured / popular / recently added rails and the full grid
   all come from catalog.js, so the catalog stays the single source of
   truth and nothing is duplicated by hand.

   Paths: category pages live at categories/<slug>/index.html, so asset
   prefixes are "../../" and the shared helper builds them relatively. */
"use strict";
(function () {
  var global = typeof window !== "undefined" ? window : null;
  if (!global) return;

  var Catalog = global.GameHubCatalog || null;
  var Cards = global.GameHubCards || null;
  if (!Catalog) return;

  var main = document.querySelector("[data-category]");
  if (!main) return;
  var name = main.getAttribute("data-category") || "";
  var info = typeof Catalog.getCategoryInfo === "function" ? Catalog.getCategoryInfo(name) : null;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  if (!info) {
    var missing = $("[data-category-missing]");
    if (missing) missing.hidden = false;
    return;
  }

  var games = Catalog.validGames().filter(function (game) {
    return name === Catalog.ALL_CATEGORIES || game.category === name;
  });

  /* ---------------- Hero ---------------- */
  var heroTitle = $("[data-category-title]");
  var heroCount = $("[data-category-count]");
  var heroDescription = $("[data-category-description]");
  var heroDot = $("[data-category-dot]");
  var heroLead = $("[data-category-lead]");

  if (heroTitle) heroTitle.textContent = name;
  if (heroDescription) heroDescription.textContent = info.description || "";
  if (heroCount) heroCount.textContent = games.length + (games.length === 1 ? " game" : " games");
  var countNodes = document.querySelectorAll("[data-category-count]");
  for (var n = 0; n < countNodes.length; n++) {
    countNodes[n].textContent = games.length + (games.length === 1 ? " game" : " games");
  }
  if (heroDot) {
    heroDot.textContent = name.charAt(0);
    heroDot.style.setProperty("--dot", info.color || "#4f7cff");
  }
  if (heroLead) heroLead.textContent = name + " games on GameHub";

  if (games.length) {
    var available = games.filter(function (game) { return game.status === "available"; });
    var remote = games.filter(function (game) { return Boolean(game.provider); });
    var multiplayer = games.filter(function (game) { return Catalog.isMultiplayer(game); });
    var statHost = $("[data-category-stats]");
    if (statHost) {
      clear(statHost);
      var stats = [
        ["Playable now", String(available.length)],
        ["Provider games", String(remote.length)],
        ["Local multiplayer", String(multiplayer.length)]
      ];
      for (var s = 0; s < stats.length; s++) {
        var card = el("div", "stat-card");
        card.appendChild(el("dt", null, stats[s][0]));
        card.appendChild(el("dd", null, stats[s][1]));
        statHost.appendChild(card);
      }
    }
  }

  /* Chip row: every category, current one marked. */
  var chips = $("[data-category-chips]");
  if (chips && typeof Catalog.getCategoryList === "function") {
    clear(chips);
    var list = Catalog.getCategoryList();
    for (var i = 0; i < list.length; i++) {
      var chip = document.createElement("a");
      chip.className = "chip-link";
      chip.href = "../" + String(list[i].name).toLowerCase() + "/index.html";
      chip.textContent = list[i].name + " (" + list[i].count + ")";
      if (list[i].name === name) chip.setAttribute("aria-current", "page");
      chips.appendChild(chip);
    }
    var allChip = document.createElement("a");
    allChip.className = "chip-link";
    allChip.href = "../../index.html#games";
    allChip.textContent = "All games (" + Catalog.validGames().length + ")";
    chips.appendChild(allChip);
  }

  /* ---------------- Rails ---------------- */
  function renderRail(sectionId, gridId, subset) {
    var section = document.getElementById(sectionId);
    var grid = document.getElementById(gridId);
    if (!section || !grid || !Cards) return;
    if (sectionId !== "category-all") {
      section.hidden = subset.length === 0;
      if (!subset.length) return;
    }
    Cards.renderInto(grid, subset, { prefix: "../../" });
  }

  var featuredIds = typeof Catalog.getFeatured === "function" ? Catalog.getFeatured().map(function (game) { return game.id; }) : [];
  var popularIds = typeof Catalog.getPopular === "function" ? Catalog.getPopular().map(function (game) { return game.id; }) : [];
  var newest = games.slice().sort(function (a, b) {
    var left = String(a.releaseDate || "");
    var right = String(b.releaseDate || "");
    if (left === right) return 0;
    return left < right ? 1 : -1;
  }).slice(0, 6);

  renderRail("category-featured", "category-featured-grid", games.filter(function (game) { return featuredIds.indexOf(game.id) !== -1; }));
  renderRail("category-popular", "category-popular-grid", games.filter(function (game) { return popularIds.indexOf(game.id) !== -1; }));
  renderRail("category-recent", "category-recent-grid", newest);
  renderRail("category-all", "category-all-grid", games);

  /* ---------------- Empty state ---------------- */
  var empty = $("[data-category-empty]");
  var hasGames = games.length > 0;
  if (empty) empty.hidden = hasGames;
  var allSection = $("#category-all");
  if (allSection && !hasGames) allSection.hidden = true;

  /* ---------------- Related categories ---------------- */
  var relatedHost = $("[data-category-related]");
  if (relatedHost && games.length) {
    var tags = {};
    for (var g = 0; g < games.length; g++) {
      var list2 = Array.isArray(games[g].tags) ? games[g].tags : [];
      for (var t = 0; t < list2.length; t++) tags[list2[t]] = (tags[list2[t]] || 0) + 1;
    }
    var top = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a] || a.localeCompare(b); }).slice(0, 10);
    clear(relatedHost);
    for (var k = 0; k < top.length; k++) {
      var link = document.createElement("a");
      link.className = "chip-link";
      link.href = "../../index.html?q=" + encodeURIComponent(top[k]) + "#games";
      link.textContent = top[k];
      relatedHost.appendChild(link);
    }
  }
})();
