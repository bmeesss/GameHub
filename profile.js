/* ============================================================
   GameHub — local profile layer (localStorage only)
   One namespaced profile document plus the per-game player data
   that belongs to a profile: collections (Play Later, Completed),
   star ratings, notes, tracked playtime and the day log used by
   achievements. Favorites and recently-played stay owned by
   player.js — this module reads them, never duplicates them.

   Storage keys (single namespace, all prefixed with "gamehub:"):
     theme        "dark" | "midnight" | "light"  (owned by theme.js)
     profile      { name, avatar, createdAt, updatedAt }
     playlater    JSON array of game ids, newest-first
     completed    JSON array of game ids, newest-first
     ratings      JSON object: id -> 1..5
     notes        JSON object: id -> { text, at }
     playtime     JSON object: id -> seconds
     session      active play session { id, started, lastFlush }
     days         JSON array of "YYYY-MM-DD" strings, newest-first
     achievements owned by achievements.js

   Robustness rules (same contract as player.js):
   - corrupted JSON is discarded, never thrown
   - every value is type-checked and clamped before use
   - when localStorage throws (private mode, disabled storage) an
     in-memory fallback keeps the platform usable for the session
   - user text (display name, notes) is only ever rendered through
     textContent by the UI, never as HTML
   Load order: catalog.js -> player.js -> profile.js -> achievements.js
   -> cards.js -> page script.
   ============================================================ */
"use strict";

var GameHubProfile = (function () {
  var PREFIX = "gamehub:";
  var NAME_LIMIT = 24;
  var NOTE_LIMIT = 500;
  var DAY_LIMIT = 120;
  var DEFAULT_NAME = "Player";
  var MAX_SESSION_SECONDS = 4 * 60 * 60;

  var COLLECTIONS = {
    favorites: { label: "Favorites" },
    playlater: { label: "Play Later" },
    completed: { label: "Completed" }
  };
  var COLLECTION_KEYS = ["favorites", "playlater", "completed"];

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
      if (store) {
        var value = store.getItem(PREFIX + key);
        if (value != null) return value;
      }
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

  function removeKey(key) {
    var store = backend();
    try {
      if (store && typeof store.removeItem === "function") store.removeItem(PREFIX + key);
    } catch (err) { storageOk = false; }
    delete memory[key];
  }

  function readJson(key, fallback) {
    var raw = readRaw(key);
    if (raw == null || raw === "") return fallback;
    try {
      var parsed = JSON.parse(raw);
      return parsed === undefined || parsed === null ? fallback : parsed;
    } catch (err) {
      return fallback; /* corrupted JSON: start clean, never throw */
    }
  }

  function writeJson(key, value) {
    try {
      writeRaw(key, JSON.stringify(value));
    } catch (err) { /* unserializable value: ignore, UI keeps working */ }
  }

  function cleanId(id) {
    return String(id == null ? "" : id).trim().slice(0, 80);
  }

  function cleanText(value, limit) {
    var text = String(value == null ? "" : value);
    /* Control characters (including newlines in names) are dropped;
       the remaining text is stored verbatim and rendered as text. */
    text = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>]/g, "");
    text = text.replace(/\s+/g, " ").trim();
    return text.slice(0, limit);
  }

  function nowMs() {
    var value = Date.now();
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  /* ---------------- Change notifications ----------------
     Every mutation funnels through notify() so achievements can
     re-evaluate themselves after relevant player data changes. */
  var listeners = [];

  function notify(reason) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](reason || "change");
      } catch (err) { /* a listener must never break a mutation */ }
    }
    try {
      if (typeof document !== "undefined" && typeof document.dispatchEvent === "function" && typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent("gamehub:change", { detail: { reason: reason || "change" } }));
      }
    } catch (err) { /* custom events unavailable: local listeners already ran */ }
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  /* ---------------- Profile document ---------------- */
  var AVATARS = [
    {
      id: "nova",
      label: "Nova",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-nova" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"></stop><stop offset="1" stop-color="#22d3ee"></stop></linearGradient></defs><circle cx="32" cy="32" r="26" fill="url(#ghav-nova)"></circle><path d="M32 8v48M8 32h48M15 15l34 34M49 15L15 49" stroke="#0b0f1a" stroke-width="2" opacity="0.28"></path><circle cx="25" cy="29" r="3.4" fill="#0b0f1a"></circle><circle cx="39" cy="29" r="3.4" fill="#0b0f1a"></circle><path d="M25 40c4 4 10 4 14 0" stroke="#0b0f1a" stroke-width="2.6" fill="none" stroke-linecap="round"></path></svg>'
    },
    {
      id: "pulse",
      label: "Pulse",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-pulse" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"></stop><stop offset="1" stop-color="#22d3ee"></stop></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="16" fill="url(#ghav-pulse)"></rect><path d="M12 34h8l5-12 7 24 6-16 4 4h10" stroke="#062018" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="22" r="2.6" fill="#062018"></circle><circle cx="42" cy="22" r="2.6" fill="#062018"></circle></svg>'
    },
    {
      id: "cuboid",
      label: "Cuboid",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-cuboid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb923c"></stop><stop offset="1" stop-color="#fb7185"></stop></linearGradient></defs><path d="M32 6l24 14v24L32 58 8 44V20z" fill="url(#ghav-cuboid)"></path><path d="M32 6v52M8 20l24 14 24-14" stroke="#3a1405" stroke-width="2.4" fill="none" opacity="0.45"></path><circle cx="24" cy="30" r="3" fill="#3a1405"></circle><circle cx="40" cy="30" r="3" fill="#3a1405"></circle><path d="M25 40h14" stroke="#3a1405" stroke-width="2.6" stroke-linecap="round"></path></svg>'
    },
    {
      id: "lantern",
      label: "Lantern",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-lantern" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbbf24"></stop><stop offset="1" stop-color="#f97316"></stop></linearGradient></defs><path d="M32 4l24 14v28L32 60 8 46V18z" fill="url(#ghav-lantern)"></path><circle cx="32" cy="32" r="13" fill="#3b2404" opacity="0.5"></circle><circle cx="27" cy="30" r="3.2" fill="#fff3c4"></circle><circle cx="38" cy="30" r="3.2" fill="#fff3c4"></circle><path d="M27 39c3 3 8 3 11 0" stroke="#fff3c4" stroke-width="2.4" fill="none" stroke-linecap="round"></path></svg>'
    },
    {
      id: "comet",
      label: "Comet",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-comet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"></stop><stop offset="1" stop-color="#6366f1"></stop></linearGradient></defs><path d="M4 12c14 2 24 10 30 22" stroke="#a78bfa" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"></path><path d="M2 24c12 2 20 8 26 18" stroke="#22d3ee" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"></path><circle cx="38" cy="38" r="20" fill="url(#ghav-comet)"></circle><circle cx="32" cy="35" r="3.2" fill="#0b0f1a"></circle><circle cx="45" cy="35" r="3.2" fill="#0b0f1a"></circle><path d="M33 46c3 2.6 8 2.6 11 0" stroke="#0b0f1a" stroke-width="2.4" fill="none" stroke-linecap="round"></path></svg>'
    },
    {
      id: "vortex",
      label: "Vortex",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-vortex" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"></stop><stop offset="1" stop-color="#7c5cff"></stop></linearGradient></defs><circle cx="32" cy="32" r="26" fill="#0f1526"></circle><circle cx="32" cy="32" r="26" fill="none" stroke="url(#ghav-vortex)" stroke-width="3"></circle><circle cx="32" cy="32" r="17" fill="none" stroke="#22d3ee" stroke-width="2.4" opacity="0.7"></circle><circle cx="32" cy="32" r="9" fill="none" stroke="#7c5cff" stroke-width="2.4"></circle><circle cx="27" cy="30" r="2.6" fill="#f2f5ff"></circle><circle cx="38" cy="30" r="2.6" fill="#f2f5ff"></circle></svg>'
    },
    {
      id: "sprout",
      label: "Sprout",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-sprout" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#84cc16"></stop><stop offset="1" stop-color="#22c55e"></stop></linearGradient></defs><rect x="6" y="6" width="52" height="52" rx="26" fill="url(#ghav-sprout)"></rect><path d="M32 54c0-14 0-20 0-26" stroke="#0c2410" stroke-width="2.6" stroke-linecap="round"></path><path d="M32 30c-10 0-14-6-14-12 8 0 14 4 14 12zM32 34c10 0 14-6 14-12-8 0-14 4-14 12z" fill="#0c2410" opacity="0.5"></path><circle cx="25" cy="22" r="2.6" fill="#0c2410"></circle><circle cx="39" cy="22" r="2.6" fill="#0c2410"></circle></svg>'
    },
    {
      id: "frost",
      label: "Frost",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-frost" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93c5fd"></stop><stop offset="1" stop-color="#22d3ee"></stop></linearGradient></defs><path d="M32 4l24 14v28L32 60 8 46V18z" fill="url(#ghav-frost)"></path><path d="M32 14v36M18 22l28 20M46 22L18 42" stroke="#082033" stroke-width="2.2" opacity="0.45"></path><circle cx="25" cy="30" r="3" fill="#082033"></circle><circle cx="39" cy="30" r="3" fill="#082033"></circle><path d="M26 41h12" stroke="#082033" stroke-width="2.6" stroke-linecap="round"></path></svg>'
    },
    {
      id: "ember",
      label: "Ember",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-ember" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fb7185"></stop><stop offset="1" stop-color="#fbbf24"></stop></linearGradient></defs><path d="M32 4c12 12 20 20 20 30a20 20 0 0 1-40 0c0-10 8-18 20-30z" fill="url(#ghav-ember)"></path><path d="M32 24c6 7 10 11 10 17a10 10 0 0 1-20 0c0-6 4-10 10-17z" fill="#40100f" opacity="0.35"></path><circle cx="27" cy="38" r="2.8" fill="#2b0a09"></circle><circle cx="37" cy="38" r="2.8" fill="#2b0a09"></circle></svg>'
    },
    {
      id: "tide",
      label: "Tide",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-tide" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"></stop><stop offset="1" stop-color="#2563eb"></stop></linearGradient></defs><circle cx="32" cy="32" r="26" fill="url(#ghav-tide)"></circle><path d="M8 38c6-6 12-6 18 0s12 6 18 0 8-4 12-2" stroke="#04203a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.55"></path><path d="M8 47c6-6 12-6 18 0s12 6 18 0 8-4 12-2" stroke="#04203a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.35"></path><circle cx="25" cy="24" r="3" fill="#04203a"></circle><circle cx="39" cy="24" r="3" fill="#04203a"></circle></svg>'
    },
    {
      id: "circuit",
      label: "Circuit",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-circuit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"></stop><stop offset="1" stop-color="#0ea5e9"></stop></linearGradient></defs><rect x="14" y="14" width="36" height="36" rx="9" fill="url(#ghav-circuit)"></rect><path d="M14 24H4M14 32H4M14 40H4M50 24h10M50 32h10M50 40h10M24 14V4M32 14V4M40 14V4M24 50v10M32 50v10M40 50v10" stroke="#052033" stroke-width="2.4" stroke-linecap="round"></path><circle cx="26" cy="29" r="3" fill="#052033"></circle><circle cx="38" cy="29" r="3" fill="#052033"></circle><path d="M26 39h12" stroke="#052033" stroke-width="2.6" stroke-linecap="round"></path></svg>'
    },
    {
      id: "nimbus",
      label: "Nimbus",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-nimbus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e8ff"></stop><stop offset="1" stop-color="#94a3ff"></stop></linearGradient></defs><path d="M18 42a11 11 0 0 1 1-22 15 15 0 0 1 28 4 9 9 0 0 1-2 18z" fill="url(#ghav-nimbus)"></path><path d="M26 46l-3 8M36 46l-3 8M45 46l-3 8" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"></path><circle cx="27" cy="31" r="2.8" fill="#131a33"></circle><circle cx="39" cy="31" r="2.8" fill="#131a33"></circle></svg>'
    },
    {
      id: "prism",
      label: "Prism",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-prism" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"></stop><stop offset="1" stop-color="#7c5cff"></stop></linearGradient></defs><path d="M32 5l27 50H5z" fill="url(#ghav-prism)"></path><path d="M32 5v50" stroke="#2a0b2f" stroke-width="2.2" opacity="0.4"></path><path d="M14 40h36" stroke="#2a0b2f" stroke-width="2.2" opacity="0.3"></path><circle cx="26" cy="36" r="2.8" fill="#2a0b2f"></circle><circle cx="38" cy="36" r="2.8" fill="#2a0b2f"></circle><path d="M27 45h10" stroke="#2a0b2f" stroke-width="2.4" stroke-linecap="round"></path></svg>'
    },
    {
      id: "bolt",
      label: "Bolt",
      svg: '<svg viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="ghav-bolt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#facc15"></stop><stop offset="1" stop-color="#f97316"></stop></linearGradient></defs><circle cx="32" cy="32" r="26" fill="#131a33"></circle><path d="M36 6L18 34h10l-4 24 20-30H32z" fill="url(#ghav-bolt)"></path><circle cx="21" cy="20" r="2.4" fill="#facc15" opacity="0.7"></circle><circle cx="46" cy="46" r="2.4" fill="#f97316" opacity="0.7"></circle></svg>'
    }
  ];

  var DEFAULT_AVATAR = "nova";

  function avatarIds() {
    return AVATARS.map(function (avatar) { return avatar.id; });
  }

  function avatarById(id) {
    var clean = String(id == null ? "" : id).trim().toLowerCase();
    for (var i = 0; i < AVATARS.length; i++) {
      if (AVATARS[i].id === clean) return AVATARS[i];
    }
    return null;
  }

  function avatarSvg(id) {
    var avatar = avatarById(id) || avatarById(DEFAULT_AVATAR);
    return avatar ? avatar.svg : "";
  }

  function getProfile() {
    var raw = readJson("profile", null);
    var data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var name = cleanText(data.name, NAME_LIMIT) || DEFAULT_NAME;
    var avatar = avatarById(data.avatar) ? String(data.avatar).toLowerCase() : DEFAULT_AVATAR;
    var created = typeof data.createdAt === "number" && data.createdAt > 0 ? data.createdAt : 0;
    var updated = typeof data.updatedAt === "number" && data.updatedAt > 0 ? data.updatedAt : 0;
    return { name: name, avatar: avatar, createdAt: created, updatedAt: updated };
  }

  function saveProfile(patch) {
    var current = getProfile();
    var data = patch && typeof patch === "object" ? patch : {};
    var next = {
      name: Object.prototype.hasOwnProperty.call(data, "name") ? cleanText(data.name, NAME_LIMIT) || DEFAULT_NAME : current.name,
      avatar: Object.prototype.hasOwnProperty.call(data, "avatar") && avatarById(data.avatar)
        ? String(data.avatar).toLowerCase()
        : current.avatar,
      createdAt: current.createdAt || nowMs(),
      updatedAt: nowMs()
    };
    writeJson("profile", next);
    notify("profile");
    return next;
  }

  function setDisplayName(name) {
    return saveProfile({ name: name }).name;
  }

  function getDisplayName() {
    return getProfile().name;
  }

  function setAvatar(id) {
    return saveProfile({ avatar: id }).avatar;
  }

  function getAvatar() {
    return getProfile().avatar;
  }

  /* Theme stays owned by theme.js (one key, one writer); these
     helpers exist so the profile UI can present it as a setting. */
  function getTheme() {
    if (typeof GameHubTheme !== "undefined" && GameHubTheme) return GameHubTheme.current();
    if (typeof window !== "undefined" && window && window.GameHubTheme) return window.GameHubTheme.current();
    var stored = String(readRaw("theme") || "").trim().toLowerCase();
    return stored === "light" || stored === "midnight" ? stored : "dark";
  }

  function setTheme(theme) {
    var value = String(theme == null ? "" : theme).trim().toLowerCase();
    if (value !== "dark" && value !== "midnight" && value !== "light") value = "dark";
    if (typeof GameHubTheme !== "undefined" && GameHubTheme) return GameHubTheme.set(value);
    if (typeof window !== "undefined" && window && window.GameHubTheme) return window.GameHubTheme.set(value);
    writeRaw("theme", value);
    notify("theme");
    return value;
  }

  /* ---------------- Collections ----------------
     Favorites live in player.js ("gamehub:favorites"); Play Later
     and Completed live here. One API hides the difference. */
  function playerModule() {
    if (typeof GameHubPlayer !== "undefined" && GameHubPlayer) return GameHubPlayer;
    if (typeof window !== "undefined" && window && window.GameHubPlayer) return window.GameHubPlayer;
    return null;
  }

  function normalizeCollection(kind) {
    var clean = String(kind == null ? "" : kind).trim().toLowerCase();
    return COLLECTION_KEYS.indexOf(clean) === -1 ? "" : clean;
  }

  function readIdList(key) {
    var list = readJson(key, []);
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

  function writeIdList(key, list) {
    writeJson(key, list.slice(0, 400));
  }

  function collectionIds(kind) {
    var clean = normalizeCollection(kind);
    if (!clean) return [];
    if (clean === "favorites") {
      var player = playerModule();
      if (player && typeof player.getFavorites === "function") return player.getFavorites();
      return readIdList("favorites");
    }
    return readIdList(clean);
  }

  function inCollection(kind, id) {
    var clean = normalizeCollection(kind);
    var gameId = cleanId(id);
    if (!clean || !gameId) return false;
    if (clean === "favorites") {
      var player = playerModule();
      if (player && typeof player.isFavorite === "function") return player.isFavorite(gameId);
    }
    return collectionIds(clean).indexOf(gameId) !== -1;
  }

  function addToCollection(kind, id) {
    var clean = normalizeCollection(kind);
    var gameId = cleanId(id);
    if (!clean || !gameId) return collectionIds(clean);
    if (clean === "favorites") {
      var player = playerModule();
      if (player && typeof player.addFavorite === "function") {
        player.addFavorite(gameId);
        notify("favorites");
        return collectionIds(clean);
      }
    }
    var list = collectionIds(clean).filter(function (x) { return x !== gameId; });
    list.unshift(gameId);
    writeIdList(clean, list);
    notify(clean);
    return list;
  }

  function removeFromCollection(kind, id) {
    var clean = normalizeCollection(kind);
    var gameId = cleanId(id);
    if (!clean || !gameId) return collectionIds(clean);
    if (clean === "favorites") {
      var player = playerModule();
      if (player && typeof player.removeFavorite === "function") {
        player.removeFavorite(gameId);
        notify("favorites");
        return collectionIds(clean);
      }
    }
    writeIdList(clean, collectionIds(clean).filter(function (x) { return x !== gameId; }));
    notify(clean);
    return collectionIds(clean);
  }

  function toggleCollection(kind, id) {
    var clean = normalizeCollection(kind);
    var gameId = cleanId(id);
    if (!clean || !gameId) return false;
    if (inCollection(clean, gameId)) {
      removeFromCollection(clean, gameId);
      return false;
    }
    addToCollection(clean, gameId);
    return true;
  }

  function collectionCount(kind) {
    return collectionIds(kind).length;
  }

  /* ---------------- Ratings (1-5, local only) ---------------- */
  function readRatings() {
    var data = readJson("ratings", {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function getRating(id) {
    var gameId = cleanId(id);
    if (!gameId) return 0;
    var value = readRatings()[gameId];
    var num = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(num)) return 0;
    var rounded = Math.round(num);
    return rounded >= 1 && rounded <= 5 ? rounded : 0;
  }

  function setRating(id, value) {
    var gameId = cleanId(id);
    if (!gameId) return 0;
    var ratings = readRatings();
    var num = Math.round(Number(value));
    if (!Number.isFinite(num) || num < 1 || num > 5) {
      delete ratings[gameId];
      writeJson("ratings", ratings);
      notify("ratings");
      return 0;
    }
    ratings[gameId] = num;
    writeJson("ratings", ratings);
    notify("ratings");
    return num;
  }

  function getRatings() {
    var ratings = readRatings();
    var out = {};
    for (var key in ratings) {
      if (!Object.prototype.hasOwnProperty.call(ratings, key)) continue;
      var rating = getRating(key);
      if (rating) out[key] = rating;
    }
    return out;
  }

  function ratingCount() {
    return Object.keys(getRatings()).length;
  }

  /* ---------------- Notes (max 500 characters) ---------------- */
  function readNotes() {
    var data = readJson("notes", {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function sanitizeNoteText(value) {
    /* Newlines are allowed inside notes; markup characters are not
       executed anywhere because notes are rendered as text nodes. */
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, NOTE_LIMIT);
  }

  function getNote(id) {
    var gameId = cleanId(id);
    if (!gameId) return null;
    var row = readNotes()[gameId];
    if (!row || typeof row !== "object") return null;
    var text = sanitizeNoteText(row.text).trim();
    if (!text) return null;
    var at = typeof row.at === "number" && row.at > 0 ? row.at : 0;
    return { text: text, at: at };
  }

  function setNote(id, text) {
    var gameId = cleanId(id);
    if (!gameId) return null;
    var clean = sanitizeNoteText(text).trim();
    var notes = readNotes();
    if (!clean) {
      delete notes[gameId];
      writeJson("notes", notes);
      notify("notes");
      return null;
    }
    var next = { text: clean, at: nowMs() };
    notes[gameId] = next;
    writeJson("notes", notes);
    notify("notes");
    return next;
  }

  function removeNote(id) {
    return setNote(id, "");
  }

  function noteCount() {
    return Object.keys(readNotes()).filter(function (id) { return Boolean(getNote(id)); }).length;
  }

  /* ---------------- Playtime ----------------
     Only time actually spent with a game running is counted: the
     launcher and the generated play pages start a session, flush it
     periodically and settle it on unload. Sessions are capped and
     never claimed as global statistics. */
  function readPlaytime() {
    var data = readJson("playtime", {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function getPlaytime(id) {
    var gameId = cleanId(id);
    if (!gameId) return 0;
    var value = readPlaytime()[gameId];
    var num = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
  }

  function addPlaytime(id, seconds) {
    var gameId = cleanId(id);
    var amount = Number(seconds);
    if (!gameId || !Number.isFinite(amount) || amount <= 0) return getPlaytime(gameId);
    var capped = Math.min(amount, MAX_SESSION_SECONDS);
    var data = readPlaytime();
    data[gameId] = getPlaytime(gameId) + Math.round(capped);
    writeJson("playtime", data);
    notify("playtime");
    return getPlaytime(gameId);
  }

  function getTotalPlaytime() {
    var data = readPlaytime();
    var total = 0;
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      total += getPlaytime(key);
    }
    return total;
  }

  function formatDuration(seconds) {
    var value = Math.max(0, Math.round(Number(seconds) || 0));
    if (value < 60) return value + "s";
    var minutes = Math.floor(value / 60);
    if (minutes < 60) {
      var rest = value % 60;
      return rest ? minutes + "m " + rest + "s" : minutes + "m";
    }
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    return mins ? hours + "h " + mins + "m" : hours + "h";
  }

  var session = null;

  function readSession() {
    var row = readJson("session", null);
    if (!row || typeof row !== "object") return null;
    var id = cleanId(row.id);
    var started = typeof row.started === "number" && row.started > 0 ? row.started : 0;
    var lastFlush = typeof row.lastFlush === "number" && row.lastFlush > 0 ? row.lastFlush : started;
    if (!id || !started) return null;
    return { id: id, started: started, lastFlush: lastFlush };
  }

  function writeSession(row) {
    if (!row) {
      removeKey("session");
      return;
    }
    writeJson("session", row);
  }

  /* Start (or resume) a session for a game. Resuming matters for
     GameHub's own HTML5 games: the launcher starts the session, the
     game page continues the very same one. */
  function startSession(id) {
    var gameId = cleanId(id);
    if (!gameId) return null;
    var now = nowMs();
    var existing = readSession();
    if (existing && existing.id === gameId && now - existing.started < MAX_SESSION_SECONDS * 1000) {
      session = existing;
    } else {
      session = { id: gameId, started: now, lastFlush: now };
      writeSession(session);
    }
    touchDay();
    notify("session");
    return { id: session.id, started: session.started };
  }

  /* Book the elapsed seconds without ending the session. */
  function flushSession() {
    var row = session || readSession();
    if (!row) return 0;
    var now = nowMs();
    var elapsed = Math.max(0, (now - row.lastFlush) / 1000);
    if (elapsed > 1) addPlaytime(row.id, elapsed);
    row.lastFlush = now;
    session = row;
    writeSession(row);
    return Math.round(elapsed);
  }

  function stopSession() {
    var row = session || readSession();
    if (!row) return 0;
    var now = nowMs();
    var elapsed = Math.max(0, (now - row.lastFlush) / 1000);
    if (elapsed > 1) addPlaytime(row.id, elapsed);
    session = null;
    writeSession(null);
    notify("session");
    return Math.round(elapsed);
  }

  function activeSession() {
    var row = session || readSession();
    return row ? { id: row.id, started: row.started } : null;
  }

  /* ---------------- Day log (for streak-style achievements) ---------------- */
  function dayKey(date) {
    var value = date instanceof Date ? date : new Date();
    if (isNaN(value.getTime())) value = new Date();
    var month = String(value.getMonth() + 1).padStart(2, "0");
    var day = String(value.getDate()).padStart(2, "0");
    return value.getFullYear() + "-" + month + "-" + day;
  }

  function getDays() {
    var list = readJson("days", []);
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var key = String(list[i] == null ? "" : list[i]).trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    }
    return out.slice(0, DAY_LIMIT);
  }

  function touchDay(date) {
    var key = dayKey(date);
    var days = getDays();
    if (days[0] === key) return days;
    var next = [key].concat(days.filter(function (existing) { return existing !== key; })).slice(0, DAY_LIMIT);
    writeJson("days", next);
    return next;
  }

  function dayCount() {
    return getDays().length;
  }

  /* ---------------- Summary stats for the profile page ---------------- */
  function playedGames() {
    var player = playerModule();
    if (!player) return [];
    if (typeof player.getPlayedGames === "function") return player.getPlayedGames();
    return [];
  }

  function summary() {
    var profile = getProfile();
    var played = playedGames();
    var totalPlays = 0;
    for (var i = 0; i < played.length; i++) totalPlays += played[i].plays || 0;
    var totalSeconds = getTotalPlaytime();
    var active = activeSession();
    if (active) {
      var live = Math.max(0, (nowMs() - active.started) / 1000);
      totalSeconds += Math.min(live, MAX_SESSION_SECONDS);
    }
    return {
      name: profile.name,
      avatar: profile.avatar,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      theme: getTheme(),
      gamesPlayed: played.length,
      totalPlays: totalPlays,
      totalSeconds: Math.round(totalSeconds),
      totalTime: formatDuration(totalSeconds),
      favorites: collectionIds("favorites").length,
      playLater: collectionIds("playlater").length,
      completed: collectionIds("completed").length,
      ratings: ratingCount(),
      notes: noteCount(),
      days: dayCount(),
      sessionSeconds: active ? Math.round(Math.min(Math.max(0, (nowMs() - active.started) / 1000), MAX_SESSION_SECONDS)) : 0
    };
  }

  /* ---------------- Reset ---------------- */
  function clearAll() {
    var keys = ["profile", "playlater", "completed", "ratings", "notes", "playtime", "session", "days", "achievements", "favorites", "recent", "plays", "searches"];
    for (var i = 0; i < keys.length; i++) removeKey(keys[i]);
    session = null;
    notify("reset");
    return true;
  }

  function storageAvailable() {
    return backend() !== null;
  }

  return {
    NAME_LIMIT: NAME_LIMIT,
    NOTE_LIMIT: NOTE_LIMIT,
    MAX_SESSION_SECONDS: MAX_SESSION_SECONDS,
    DEFAULT_NAME: DEFAULT_NAME,
    COLLECTIONS: COLLECTIONS,
    COLLECTION_KEYS: COLLECTION_KEYS,
    AVATARS: AVATARS,
    avatarIds: avatarIds,
    avatarById: avatarById,
    avatarSvg: avatarSvg,
    getProfile: getProfile,
    saveProfile: saveProfile,
    getDisplayName: getDisplayName,
    setDisplayName: setDisplayName,
    getAvatar: getAvatar,
    setAvatar: setAvatar,
    getTheme: getTheme,
    setTheme: setTheme,
    collectionIds: collectionIds,
    inCollection: inCollection,
    addToCollection: addToCollection,
    removeFromCollection: removeFromCollection,
    toggleCollection: toggleCollection,
    collectionCount: collectionCount,
    getRating: getRating,
    setRating: setRating,
    getRatings: getRatings,
    ratingCount: ratingCount,
    getNote: getNote,
    setNote: setNote,
    removeNote: removeNote,
    noteCount: noteCount,
    getPlaytime: getPlaytime,
    addPlaytime: addPlaytime,
    getTotalPlaytime: getTotalPlaytime,
    formatDuration: formatDuration,
    startSession: startSession,
    flushSession: flushSession,
    stopSession: stopSession,
    activeSession: activeSession,
    dayKey: dayKey,
    getDays: getDays,
    touchDay: touchDay,
    dayCount: dayCount,
    playedGames: playedGames,
    summary: summary,
    clearAll: clearAll,
    onChange: onChange,
    notify: notify,
    storageAvailable: storageAvailable,
    storage: { read: readRaw, write: writeRaw, readJson: readJson, writeJson: writeJson, remove: removeKey }
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubProfile = GameHubProfile;
}
