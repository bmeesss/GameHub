/* ============================================================
   GameHub — achievements engine (local only)
   Twenty original achievements derived from the visitor's own
   local player data: launches, distinct games, favorites,
   high scores, categories, play days, collections, ratings,
   notes and a few per-game milestones.

   How it works
   ------------
   sync() builds a read-only snapshot of the local player data
   (player.js + profile.js, both optional), evaluates every
   achievement and stores the unlock date of any newly earned
   one under "gamehub:achievements". It is called automatically
   after relevant player-data changes: every mutation in
   profile.js / player.js funnels through GameHubProfile.notify()
   (or an explicit sync from the UI that performed the change),
   so no polling and no timers are needed.

   Nothing is uploaded and nothing is compared across visitors:
   progress is the visitor's own local activity only.
   Load order: catalog.js -> player.js -> profile.js ->
   achievements.js -> cards.js -> page script.
   ============================================================ */
"use strict";

var GameHubAchievements = (function () {
  var KEY = "achievements";

  /* ---------------- Optional module handles ---------------- */
  function onWindow(name) {
    try {
      if (typeof window !== "undefined" && window && window[name]) return window[name];
    } catch (err) { /* ignore */ }
    return null;
  }

  function catalog() {
    if (typeof GameHubCatalog !== "undefined" && GameHubCatalog) return GameHubCatalog;
    return onWindow("GameHubCatalog");
  }

  function player() {
    if (typeof GameHubPlayer !== "undefined" && GameHubPlayer) return GameHubPlayer;
    return onWindow("GameHubPlayer");
  }

  function profile() {
    if (typeof GameHubProfile !== "undefined" && GameHubProfile) return GameHubProfile;
    return onWindow("GameHubProfile");
  }

  /* ---------------- Safe storage (shared namespace) ---------------- */
  var memory = {};

  function store() {
    var api = profile();
    return api && api.storage ? api.storage : null;
  }

  function readMap() {
    var api = store();
    var data = api ? api.readJson(KEY, {}) : memory[KEY];
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    var out = {};
    for (var id in data) {
      if (!Object.prototype.hasOwnProperty.call(data, id)) continue;
      var row = data[id];
      var at = row && typeof row === "object" ? row.at : row;
      var value = typeof at === "number" ? at : parseFloat(at);
      if (Number.isFinite(value) && value > 0) out[id] = value;
    }
    return out;
  }

  function writeMap(map) {
    var api = store();
    if (api) {
      api.writeJson(KEY, map);
      return;
    }
    memory[KEY] = map;
  }

  /* ---------------- Icons (original, inline) ---------------- */
  var ICONS = {
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4M6 5h11l-1.8 3.5L17 12H6"></path></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2 5-5 2 2-5z"></path></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"></path></svg>',
    boot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v9l4 3 5 1v3H8l-3-4V3z"></path></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.7C6.4 17.2 3 13.6 3 9.9 3 7.2 5.1 5 7.8 5c1.7 0 3.2.9 4.2 2.3C13 5.9 14.5 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.3-9 10.8z"></path></svg>',
    shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h7v16H4zM15 4h5v16h-5z"></path><path d="M15 9h5"></path></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"></path><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M10 13h4l1 4H9zM8 20h8"></path></svg>',
    medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="15" r="5"></circle><path d="M8.5 3l2 6M15.5 3l-2 6"></path></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"></rect><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"></rect><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"></rect><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"></rect></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>',
    streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L6 13h5l-1.5 9L18 9.5h-5z"></path></svg>',
    puzzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4a2 2 0 1 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 1 1 0 4h-1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H7a1 1 0 0 1-1-1v-3H5a2 2 0 1 1 0-4h1V6a1 1 0 0 1 1-1h3z"></path></svg>',
    speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18a9 9 0 1 1 16 0"></path><path d="M12 14l4.5-4.5"></path></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"></path></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.6 2.6L16 9.5"></path></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z"></path></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 10-10-3-3L5 16z"></path><path d="M14 6l4 4"></path></svg>',
    snake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18h9a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7"></path><circle cx="18.5" cy="6" r="1.6" fill="currentColor" stroke="none"></circle></svg>',
    paddle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"></circle></svg>',
    tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V8l6-5 6 5v13"></path><path d="M10 21v-5h4v5M9 11h6"></path></svg>'
  };

  /* ---------------- Snapshot of local player activity ----------------
     Every value is best-effort: a missing module yields zeros so
     achievements can never crash a page. */
  function getIdSet() {
    var out = {};
    return out;
  }

  function snapshot() {
    var store = player();
    var prof = profile();
    var cat = catalog();

    var playedRows = store && typeof store.getPlayedGames === "function" ? store.getPlayedGames() : [];
    if (!Array.isArray(playedRows)) playedRows = [];
    var playedIds = [];
    var totalPlays = 0;
    var bestCount = 0;
    for (var i = 0; i < playedRows.length; i++) {
      var row = playedRows[i] || {};
      var id = String(row.id == null ? "" : row.id).trim();
      if (!id) continue;
      playedIds.push(id);
      var plays = Number(row.plays);
      totalPlays += Number.isFinite(plays) && plays > 0 ? plays : 0;
      if (store && typeof store.getBest === "function") {
        try {
          if (store.getBest(id)) bestCount++;
        } catch (err) { /* keep counting the rest */ }
      }
    }

    /* Categories of the games that were actually played. */
    var playedSet = getIdSet();
    for (var p = 0; p < playedIds.length; p++) playedSet[playedIds[p]] = true;
    var categories = [];
    var puzzleGames = 0;
    var tags = {};
    var games = cat && typeof cat.validGames === "function" ? cat.validGames() : [];
    for (var g = 0; g < games.length; g++) {
      var game = games[g];
      if (!game || !playedSet[game.id]) continue;
      if (game.category && categories.indexOf(game.category) === -1) categories.push(game.category);
      if (game.category === "Puzzle") puzzleGames++;
      var list = cat && typeof cat.tagsOf === "function" ? cat.tagsOf(game) : game.tags || [];
      for (var t = 0; t < list.length; t++) tags[String(list[t]).toLowerCase()] = true;
    }

    /* Category counts from the catalog (used by "play N of a genre"). */
    var catalogStats = cat && typeof cat.getCategories === "function" ? cat.getCategories() : [];
    var categoryCounts = {};
    for (var c = 0; c < catalogStats.length; c++) {
      var entry = catalogStats[c] || {};
      categoryCounts[entry.name] = entry.count || 0;
    }

    function collectionLength(kind) {
      if (!prof || typeof prof.collectionIds !== "function") return 0;
      var list = prof.collectionIds(kind);
      return Array.isArray(list) ? list.length : 0;
    }

    function numberFrom(api, method) {
      if (!api || typeof api[method] !== "function") return 0;
      var value = Number(api[method]());
      return Number.isFinite(value) && value > 0 ? value : 0;
    }

    return {
      playedIds: playedIds,
      playedSet: playedSet,
      gamesPlayed: playedIds.length,
      totalPlays: totalPlays,
      bestCount: bestCount,
      categories: categories,
      categoryCount: categories.length,
      puzzleGames: puzzleGames,
      tags: tags,
      favorites: collectionLength("favorites"),
      playLater: collectionLength("playlater"),
      completed: collectionLength("completed"),
      ratings: numberFrom(prof, "ratingCount"),
      notes: numberFrom(prof, "noteCount"),
      days: numberFrom(prof, "dayCount"),
      playSeconds: numberFrom(prof, "getTotalPlaytime"),
      categoryCounts: categoryCounts
    };
  }

  /* Per-game milestones read the game's own high score through the
     player layer, exactly like the game pages do. */
  function bestOf(id) {
    var api = player();
    if (!api || typeof api.getBest !== "function") return 0;
    try {
      var best = api.getBest(id);
      return best && Number.isFinite(best.value) ? best.value : 0;
    } catch (err) {
      return 0;
    }
  }

  /* ---------------- Achievement definitions ----------------
     progress(ctx) returns the current counter; the achievement is
     earned as soon as it reaches goal. matches(game) marks the
     achievements that belong to a game's detail page. */
  var LIST = [
    {
      id: "first-launch",
      title: "First Steps",
      description: "Play your very first GameHub game.",
      icon: ICONS.flag,
      goal: 1,
      tier: "bronze",
      progress: function (ctx) { return ctx.gamesPlayed; },
      matches: function () { return true; }
    },
    {
      id: "explorer-5",
      title: "Explorer",
      description: "Play 5 different games.",
      icon: ICONS.compass,
      goal: 5,
      tier: "silver",
      progress: function (ctx) { return ctx.gamesPlayed; },
      matches: function () { return true; }
    },
    {
      id: "explorer-10",
      title: "Globe Trotter",
      description: "Play 10 different games.",
      icon: ICONS.globe,
      goal: 10,
      tier: "gold",
      progress: function (ctx) { return ctx.gamesPlayed; },
      matches: function () { return true; }
    },
    {
      id: "marathon-25",
      title: "Marathon",
      description: "Launch games 25 times in total.",
      icon: ICONS.boot,
      goal: 25,
      tier: "gold",
      progress: function (ctx) { return ctx.totalPlays; },
      matches: function () { return true; }
    },
    {
      id: "first-favorite",
      title: "Shelf Starter",
      description: "Add your first game to Favorites.",
      icon: ICONS.heart,
      goal: 1,
      tier: "bronze",
      progress: function (ctx) { return ctx.favorites; },
      matches: function () { return true; }
    },
    {
      id: "curator-5",
      title: "Curator",
      description: "Collect 5 favorite games.",
      icon: ICONS.shelf,
      goal: 5,
      tier: "silver",
      progress: function (ctx) { return ctx.favorites; },
      matches: function () { return true; }
    },
    {
      id: "first-best",
      title: "Personal Best",
      description: "Set a high score in any game.",
      icon: ICONS.trophy,
      goal: 1,
      tier: "bronze",
      progress: function (ctx) { return ctx.bestCount; },
      matches: function () { return true; }
    },
    {
      id: "score-hunter",
      title: "Highscore Hunter",
      description: "Set high scores in 5 different games.",
      icon: ICONS.medal,
      goal: 5,
      tier: "gold",
      progress: function (ctx) { return ctx.bestCount; },
      matches: function () { return true; }
    },
    {
      id: "genre-hopper",
      title: "Genre Hopper",
      description: "Play games from 3 different categories.",
      icon: ICONS.grid,
      goal: 3,
      tier: "silver",
      progress: function (ctx) { return ctx.categoryCount; },
      matches: function () { return true; }
    },
    {
      id: "regular-3",
      title: "Regular",
      description: "Play on 3 different days.",
      icon: ICONS.calendar,
      goal: 3,
      tier: "silver",
      progress: function (ctx) { return ctx.days; },
      matches: function () { return true; }
    },
    {
      id: "dedicated-7",
      title: "Dedicated",
      description: "Play on 7 different days.",
      icon: ICONS.streak,
      goal: 7,
      tier: "gold",
      progress: function (ctx) { return ctx.days; },
      matches: function () { return true; }
    },
    {
      id: "puzzle-master",
      title: "Puzzle Master",
      description: "Play 5 Puzzle games.",
      icon: ICONS.puzzle,
      goal: 5,
      tier: "silver",
      progress: function (ctx) { return ctx.puzzleGames; },
      matches: function (game) { return Boolean(game) && game.category === "Puzzle"; }
    },
    {
      id: "speed-runner",
      title: "Full Throttle",
      description: "Race through any Racing game.",
      icon: ICONS.speed,
      goal: 1,
      tier: "bronze",
      progress: function (ctx) { return ctx.categories.indexOf("Racing") === -1 ? 0 : 1; },
      matches: function (game) { return Boolean(game) && game.category === "Racing"; }
    },
    {
      id: "planner-3",
      title: "Plan Ahead",
      description: "Add 3 games to Play Later.",
      icon: ICONS.bookmark,
      goal: 3,
      tier: "bronze",
      progress: function (ctx) { return ctx.playLater; },
      matches: function () { return true; }
    },
    {
      id: "finisher-5",
      title: "Finisher",
      description: "Mark 5 games as Completed.",
      icon: ICONS.check,
      goal: 5,
      tier: "gold",
      progress: function (ctx) { return ctx.completed; },
      matches: function () { return true; }
    },
    {
      id: "critic-5",
      title: "The Critic",
      description: "Give 5 games your own star rating.",
      icon: ICONS.star,
      goal: 5,
      tier: "silver",
      progress: function (ctx) { return ctx.ratings; },
      matches: function () { return true; }
    },
    {
      id: "note-taker",
      title: "Note Taker",
      description: "Write your first game note.",
      icon: ICONS.pen,
      goal: 1,
      tier: "bronze",
      progress: function (ctx) { return ctx.notes; },
      matches: function () { return true; }
    },
    {
      id: "snake-ace",
      title: "Snake Ace",
      description: "Score 100 or more in Snake.",
      icon: ICONS.snake,
      goal: 100,
      tier: "silver",
      gameId: "snake",
      progress: function () { return bestOf("snake"); },
      matches: function (game) { return Boolean(game) && game.id === "snake"; }
    },
    {
      id: "table-pro",
      title: "Table Pro",
      description: "Reach an Air Hockey streak of 5 or more.",
      icon: ICONS.paddle,
      goal: 5,
      tier: "silver",
      gameId: "air-hockey",
      progress: function () { return bestOf("air-hockey"); },
      matches: function (game) { return Boolean(game) && game.id === "air-hockey"; }
    },
    {
      id: "wave-breaker",
      title: "Wave Breaker",
      description: "Reach wave 10 in Tower Tactics.",
      icon: ICONS.tower,
      goal: 10,
      tier: "gold",
      gameId: "tower-tactics",
      progress: function () { return bestOf("tower-tactics"); },
      matches: function (game) { return Boolean(game) && game.id === "tower-tactics"; }
    }
  ];

  function definition(id) {
    var clean = String(id == null ? "" : id).trim();
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].id === clean) return LIST[i];
    }
    return null;
  }

  function clampProgress(value, goal) {
    var num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.min(Math.floor(num), goal);
  }

  /* ---------------- Evaluation ---------------- */
  function evaluate(ctx) {
    var snapshotData = ctx && typeof ctx === "object" && ctx.__snapshot ? ctx : snapshot();
    var results = [];
    for (var i = 0; i < LIST.length; i++) {
      var item = LIST[i];
      var raw = 0;
      try {
        raw = item.progress(snapshotData);
      } catch (err) {
        raw = 0;
      }
      var goal = item.goal || 1;
      results.push({
        item: item,
        progress: clampProgress(raw, goal),
        unlocked: clampProgress(raw, goal) >= goal
      });
    }
    return results;
  }

  function sync(options) {
    var opts = options && typeof options === "object" ? options : {};
    var ctx = opts.snapshot ? opts.snapshot : snapshot();
    ctx.__snapshot = true;
    var results = evaluate(ctx);
    var stored = readMap();
    var fresh = [];
    var changed = false;
    for (var i = 0; i < results.length; i++) {
      var row = results[i];
      if (row.unlocked && !Object.prototype.hasOwnProperty.call(stored, row.item.id)) {
        stored[row.item.id] = Date.now();
        fresh.push(row.item.id);
        changed = true;
      }
    }
    if (changed) {
      writeMap(stored);
      if (opts.announce !== false) announce(fresh);
    }
    return fresh;
  }

  /* ---------------- Read API ---------------- */
  function rowOf(item, stored, ctx) {
    var snapshotData = ctx && ctx.__snapshot ? ctx : snapshot();
    var raw = 0;
    try {
      raw = item.progress(snapshotData);
    } catch (err) {
      raw = 0;
    }
    var goal = item.goal || 1;
    var progress = clampProgress(raw, goal);
    var at = Object.prototype.hasOwnProperty.call(stored, item.id) ? stored[item.id] : 0;
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      tier: item.tier || "bronze",
      goal: goal,
      progress: progress,
      percent: Math.round((progress / goal) * 100),
      unlocked: Boolean(at),
      unlockedAt: at,
      gameId: item.gameId || ""
    };
  }

  function all() {
    var stored = readMap();
    var ctx = snapshot();
    ctx.__snapshot = true;
    return LIST.map(function (item) { return rowOf(item, stored, ctx); });
  }

  function get(id) {
    var item = definition(id);
    if (!item) return null;
    var ctx = snapshot();
    ctx.__snapshot = true;
    return rowOf(item, readMap(), ctx);
  }

  function unlockedRows() {
    return all().filter(function (row) { return row.unlocked; });
  }

  function unlockedCount() {
    return unlockedRows().length;
  }

  function total() {
    return LIST.length;
  }

  /* Achievements that belong to one game's page: the game's own
     milestones first, then the global ones it contributes to. */
  function forGame(game, limit) {
    if (!game) return [];
    var rows = all();
    var byId = {};
    for (var i = 0; i < rows.length; i++) byId[rows[i].id] = rows[i];
    var specific = [];
    var related = [];
    for (var j = 0; j < LIST.length; j++) {
      var item = LIST[j];
      var row = byId[item.id];
      if (!row) continue;
      var matches = false;
      try {
        matches = typeof item.matches === "function" ? Boolean(item.matches(game)) : false;
      } catch (err) {
        matches = false;
      }
      if (!matches) continue;
      if (item.gameId) specific.push(row);
      else related.push(row);
    }
    related.sort(function (a, b) {
      if (a.unlocked !== b.unlocked) return a.unlocked ? 1 : -1;
      return b.percent - a.percent;
    });
    var out = specific.concat(related);
    var max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 4;
    return out.slice(0, max);
  }

  /* ---------------- Toast announcements ---------------- */
  function container() {
    if (typeof document === "undefined") return null;
    var node = null;
    try {
      node = document.getElementById ? document.getElementById("gh-achievement-toasts") : null;
      if (node) return node;
      var created = document.createElement("div");
      created.id = "gh-achievement-toasts";
      created.className = "toast-stack";
      created.setAttribute("role", "status");
      created.setAttribute("aria-live", "polite");
      var host = document.body || document.documentElement;
      if (!host || typeof host.appendChild !== "function") return null;
      host.appendChild(created);
      return created;
    } catch (err) {
      return null;
    }
  }

  function announce(ids, options) {
    var opts = options && typeof options === "object" ? options : {};
    if (!Array.isArray(ids) || !ids.length) return [];
    var rows = [];
    for (var i = 0; i < ids.length; i++) {
      var row = get(ids[i]);
      if (row) rows.push(row);
    }
    var host = container();
    if (!host || typeof host.appendChild !== "function") return rows;
    for (var j = 0; j < rows.length; j++) {
      var data = rows[j];
      var card = document.createElement("div");
      card.className = "toast toast--achievement";
      var icon = document.createElement("span");
      icon.className = "toast-icon";
      icon.innerHTML = data.icon;
      var body = document.createElement("span");
      body.className = "toast-body";
      var title = document.createElement("strong");
      title.textContent = "Achievement unlocked: " + data.title;
      var text = document.createElement("span");
      text.textContent = data.description;
      body.appendChild(title);
      body.appendChild(text);
      card.appendChild(icon);
      card.appendChild(body);
      host.appendChild(card);
      if (opts.duration !== 0) {
        var remove = function (node) {
          return function () {
            if (node && node.parentNode && typeof node.parentNode.removeChild === "function") {
              node.parentNode.removeChild(node);
            }
          };
        };
        try {
          setTimeout(remove(card), 5200);
        } catch (err) { /* timers unavailable: toast stays in the DOM */ }
      }
    }
    return rows;
  }

  /* ---------------- Automatic re-checks ----------------
     Any mutation in profile.js (favorites, collections, ratings,
     notes, sessions, profile edits) fires onChange; the UI also
     calls sync() explicitly after player.js-only changes such as
     a game launch or a favorite toggle on a card. */
  var api = profile();
  if (api && typeof api.onChange === "function") {
    api.onChange(function (reason) {
      void reason;
      sync();
    });
  }
  try {
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("gamehub:change", function () {
        sync();
      });
    }
  } catch (err) { /* no document: sync() stays available manually */ }

  return {
    LIST: LIST,
    ICONS: ICONS,
    snapshot: snapshot,
    sync: sync,
    announce: announce,
    all: all,
    get: get,
    unlockedRows: unlockedRows,
    unlockedCount: unlockedCount,
    total: total,
    forGame: forGame,
    definition: definition
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubAchievements = GameHubAchievements;
}
