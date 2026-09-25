/* ============================================================
   GameHub — player data layer (localStorage only)
   Favorites, recently played, per-game stats and recent
   searches. No backend, no accounts, no tracking: every value
   lives in the visitor's own browser under namespaced keys.

   Storage keys (all prefixed with "gamehub:"):
     favorites  JSON array of game ids, newest-first
     recent     JSON array of { id, at } objects, max 10
     plays      JSON object: id -> { count, at }
     searches   JSON array of recent search strings, max 8
   Best scores are NOT duplicated here: each game owns its own
   localStorage key, and BEST_SCORES maps game id -> key/format
   so the hub can display the real stored value.
   Corrupted JSON is discarded; when localStorage throws (private
   mode, disabled storage) an in-memory fallback keeps the site
   fully usable for the session.
   Load order: catalog.js -> player.js -> cards.js -> page script.
   ============================================================ */
"use strict";

var GameHubPlayer = (function () {
  var PREFIX = "gamehub:";
  var RECENT_LIMIT = 10;
  var SEARCH_LIMIT = 8;

  /* Best-score registry: game id -> { key, label, kind }.
     kind "int" | "float1" | "ms" | "laptime" | "secs1".
     Games without a meaningful best are absent on purpose. */
  var BEST_SCORES = {
    "snake":          { key: "gh_snake_best",    label: "Best score",  kind: "int" },
    "labyrinth-dash": { key: "gh_maze_best",     label: "Best level",  kind: "int" },
    "tower-tactics":  { key: "gh_td_best",       label: "Best wave",   kind: "int" },
    "reaction-arena": { key: "gh_reaction_best", label: "Best avg",    kind: "ms" },
    "click-frenzy":   { key: "gh_click_best",    label: "Best CPS",    kind: "float1" },
    "mole-patrol":    { key: "gh_mole_best",     label: "Best score",  kind: "int" },
    "feather-flight": { key: "gh_feather_best",  label: "Best score",  kind: "int" },
    "asteroid-dodge": { key: "gh_dodge_best",    label: "Best score",  kind: "int" },
    "neon-runner":    { key: "gh_runner_best",   label: "Best score",  kind: "int" },
    "merge-blocks":   { key: "gh_merge_best",    label: "Best tile",   kind: "int" },
    "turbo-drift":    { key: "gh_turbo_bestlap", label: "Best lap",    kind: "laptime" },
    "brick-dodge":    { key: "gh_best_brick-dodge",    label: "Best score",    kind: "int" },
    "hue-switch":     { key: "gh_best_hue-switch",     label: "Best gates",    kind: "int" },
    "box-push":       { key: "gh_best_box-push",       label: "Best level",    kind: "int" },
    "circuit-rush":   { key: "gh_best_circuit-rush",   label: "Best streak",   kind: "int" },
    "word-scramble":  { key: "gh_best_word-scramble",  label: "Best words",    kind: "int" },
    "number-rush":    { key: "gh_best_number-rush",    label: "Best time",     kind: "secs1" },
    "quick-math":     { key: "gh_best_quick-math",     label: "Best streak",   kind: "int" },
    "echo-pads":      { key: "gh_best_echo-pads",      label: "Best round",    kind: "int" },
    "highway-escape": { key: "gh_best_highway-escape", label: "Best distance", kind: "int" },
    "zombie-survival":{ key: "gh_best_zombie-survival",label: "Best kills",    kind: "int" },
    "mini-golf":      { key: "gh_best_mini-golf",      label: "Best total",    kind: "int" },
    "basketball-shot":{ key: "gh_best_basketball-shot",label: "Best streak",   kind: "int" },
    "cast-and-catch": { key: "gh_best_cast-and-catch", label: "Best catch",    kind: "int" },
    "dungeon-escape": { key: "gh_best_dungeon-escape", label: "Best level",    kind: "int" },
    "knife-dodge":    { key: "gh_best_knife-dodge",    label: "Best time",     kind: "int" }
  };

  /* ---------------- Safe storage ---------------- */
  var memory = {};
  var storageOk = null;

  function backend() {
    if (storageOk === false) return null;
    try {
      var store = localStorage;
      if (!store || typeof store.getItem !== "function") {
        storageOk = false;
        return null;
      }
      if (storageOk === null) {
        store.setItem(PREFIX + "probe", "1");
        store.removeItem(PREFIX + "probe");
        storageOk = true;
      }
      return store;
    } catch (err) {
      storageOk = false;
      return null;
    }
  }

  function readRaw(key) {
    var store = backend();
    try {
      if (store) return store.getItem(PREFIX + key);
    } catch (err) { storageOk = false; }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function writeRaw(key, value) {
    var store = backend();
    if (store) {
      try {
        store.setItem(PREFIX + key, value);
        return;
      } catch (err) { storageOk = false; }
    }
    memory[key] = value;
  }

  function readJson(key, fallback) {
    var raw = readRaw(key);
    if (raw == null || raw === "") return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed === undefined ? fallback : parsed;
    } catch (err) {
      return fallback; /* corrupted JSON: start clean, never throw */
    }
  }

  function writeJson(key, value) {
    try {
      writeRaw(key, JSON.stringify(value));
    } catch (err) { /* unserializable: ignore, UI still works */ }
  }

  function cleanId(id) {
    return String(id == null ? "" : id).trim();
  }

  /* ---------------- Favorites ---------------- */
  function getFavorites() {
    var list = readJson("favorites", []);
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var id = cleanId(list[i]);
      if (id && !seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    return out;
  }

  function isFavorite(id) {
    id = cleanId(id);
    if (!id) return false;
    return getFavorites().indexOf(id) !== -1;
  }

  function addFavorite(id) {
    id = cleanId(id);
    if (!id) return getFavorites();
    var list = getFavorites().filter(function (x) { return x !== id; });
    list.unshift(id);
    writeJson("favorites", list);
    return list;
  }

  function removeFavorite(id) {
    id = cleanId(id);
    var list = getFavorites().filter(function (x) { return x !== id; });
    writeJson("favorites", list);
    return list;
  }

  function toggleFavorite(id) {
    id = cleanId(id);
    if (!id) return false;
    if (isFavorite(id)) {
      removeFavorite(id);
      return false;
    }
    addFavorite(id);
    return true;
  }

  /* ---------------- Recently played ----------------
     Recorded only when a playable game is actually launched,
     never when an info page is merely opened. */
  function getRecentlyPlayed() {
    var list = readJson("recent", []);
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var id = cleanId(item.id);
      if (id && !seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    return out.slice(0, RECENT_LIMIT);
  }

  function recordGamePlayed(id) {
    id = cleanId(id);
    if (!id) return getStats("");
    var now = Date.now();
    var list = [{ id: id, at: now }];
    var seen = {};
    seen[id] = true;
    var prev = readJson("recent", []);
    if (Array.isArray(prev)) {
      for (var i = 0; i < prev.length && list.length < RECENT_LIMIT; i++) {
        var old = prev[i] || {};
        var oldId = cleanId(old.id);
        if (oldId && !seen[oldId]) {
          seen[oldId] = true;
          list.push({ id: oldId, at: typeof old.at === "number" ? old.at : now });
        }
      }
    }
    writeJson("recent", list);
    recordPlay(id, now);
    return getStats(id);
  }

  /* ---------------- Play counts ---------------- */
  function readPlays() {
    var data = readJson("plays", {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function getPlays(id) {
    id = cleanId(id);
    var row = readPlays()[id];
    var count = row && typeof row.count === "number" && row.count > 0 ? Math.floor(row.count) : 0;
    var at = row && typeof row.at === "number" && row.at > 0 ? row.at : 0;
    return { plays: count, lastPlayed: at };
  }

  function recordPlay(id, now) {
    id = cleanId(id);
    if (!id) return getPlays("");
    var plays = readPlays();
    var row = plays[id] || {};
    var count = typeof row.count === "number" && row.count > 0 ? Math.floor(row.count) : 0;
    plays[id] = { count: count + 1, at: typeof now === "number" ? now : Date.now() };
    writeJson("plays", plays);
    return getPlays(id);
  }

  /* ---------------- Best scores ----------------
     Read-only view of each game's own storage key. */
  function readNumber(key) {
    var raw = null;
    var store = backend();
    try {
      if (store) raw = store.getItem(key);
    } catch (err) { storageOk = false; }
    if (raw == null || raw === "") return 0;
    var value = parseFloat(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function formatLapTime(total) {
    var minutes = Math.floor(total / 60);
    var secs = Math.floor(total % 60);
    var tenths = Math.floor((total % 1) * 10);
    return minutes + ":" + (secs < 10 ? "0" : "") + secs + "." + tenths;
  }

  function formatBest(kind, value) {
    if (kind === "ms") return String(Math.round(value)) + " ms";
    if (kind === "float1") return value.toFixed(1);
    if (kind === "secs1") return value.toFixed(1) + "s";
    if (kind === "laptime") return formatLapTime(value);
    return String(Math.round(value));
  }

  function getBest(id) {
    id = cleanId(id);
    var spec = BEST_SCORES[id];
    if (!id || !spec) return null;
    var value = readNumber(spec.key);
    if (!value) return null;
    return { label: spec.label, display: formatBest(spec.kind, value), value: value };
  }

  /* ---------------- Combined stats ---------------- */
  function getStats(id) {
    id = cleanId(id);
    var plays = getPlays(id);
    var best = getBest(id);
    return {
      gamesPlayed: plays.plays,
      lastPlayed: plays.lastPlayed,
      bestScore: best ? best.display : null,
      bestLabel: best ? best.label : null
    };
  }

  function formatLastPlayed(at) {
    if (!at) return "";
    var date = new Date(at);
    if (isNaN(date.getTime())) return "";
    var now = Date.now();
    var day = 24 * 60 * 60 * 1000;
    if (now - at < day && date.toDateString() === new Date(now).toDateString()) return "Today";
    if (now - at < 2 * day && new Date(now - day).toDateString() === date.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /* ---------------- Recent searches ---------------- */
  function getRecentSearches() {
    var list = readJson("searches", []);
    if (!Array.isArray(list)) return [];
    var out = [];
    for (var i = 0; i < list.length && out.length < SEARCH_LIMIT; i++) {
      var term = String(list[i] == null ? "" : list[i]).trim().slice(0, 80);
      if (term && out.indexOf(term) === -1) out.push(term);
    }
    return out;
  }

  function recordSearch(term) {
    term = String(term == null ? "" : term).trim().slice(0, 80);
    if (!term) return getRecentSearches();
    var list = [term];
    var prev = getRecentSearches();
    for (var i = 0; i < prev.length && list.length < SEARCH_LIMIT; i++) {
      if (prev[i].toLowerCase() !== term.toLowerCase()) list.push(prev[i]);
    }
    writeJson("searches", list);
    return list;
  }

  function clearRecentSearches() {
    writeJson("searches", []);
    return [];
  }

  /* ---------------- Availability ---------------- */
  function storageAvailable() {
    return backend() !== null;
  }

  return {
    RECENT_LIMIT: RECENT_LIMIT,
    SEARCH_LIMIT: SEARCH_LIMIT,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    toggleFavorite: toggleFavorite,
    getRecentlyPlayed: getRecentlyPlayed,
    getRecent: getRecentlyPlayed,
    recordGamePlayed: recordGamePlayed,
    recordRecent: recordGamePlayed,
    getPlays: getPlays,
    recordPlay: recordPlay,
    getBest: getBest,
    getStats: getStats,
    formatLastPlayed: formatLastPlayed,
    getRecentSearches: getRecentSearches,
    recordSearch: recordSearch,
    clearRecentSearches: clearRecentSearches,
    storageAvailable: storageAvailable
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubPlayer = GameHubPlayer;
}
