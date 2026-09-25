/* ============================================================
   GameHub — playtime session tracking for generated game pages
   GameHub's own games live at games/<slug>/play/index.html and run
   standalone (no launcher iframe), so this tiny script books the
   time actually spent in the game into the local profile.

   It never guesses: the slug comes from the <script data-game="…">
   attribute (or from the page path as a fallback), the session is
   flushed every 15 seconds and settled on page hide, and the
   values are capped by profile.js. Games keep working untouched
   when profile.js is missing — this file simply does nothing.

   Load order on play pages: profile.js -> session.js -> game.js.
   ============================================================ */
"use strict";

var GameHubSession = (function () {
  var FLUSH_MS = 15000;

  function profile() {
    if (typeof GameHubProfile !== "undefined" && GameHubProfile) return GameHubProfile;
    if (typeof window !== "undefined" && window && window.GameHubProfile) return window.GameHubProfile;
    return null;
  }

  function achievements() {
    if (typeof GameHubAchievements !== "undefined" && GameHubAchievements) return GameHubAchievements;
    if (typeof window !== "undefined" && window && window.GameHubAchievements) return window.GameHubAchievements;
    return null;
  }

  function slugFromScript() {
    try {
      var current = document.currentScript;
      if (current && typeof current.getAttribute === "function") {
        var value = String(current.getAttribute("data-game") || "").trim();
        if (/^[a-z0-9][a-z0-9-]*$/.test(value)) return value;
      }
    } catch (err) { /* fall through to the path heuristic */ }
    try {
      var match = /\/games\/([a-z0-9][a-z0-9-]*)\//.exec(String(location.pathname || ""));
      if (match) return match[1];
    } catch (err) { /* no path information available */ }
    return "";
  }

  var slug = "";
  var timer = null;
  var settled = false;

  function stop() {
    if (settled) return;
    settled = true;
    var store = profile();
    if (store && typeof store.stopSession === "function") {
      try {
        store.stopSession();
      } catch (err) { /* storage problems must not break the game */ }
    }
    var engine = achievements();
    if (engine && typeof engine.sync === "function") {
      try {
        engine.sync();
      } catch (err) { /* achievements are best-effort */ }
    }
  }

  function start() {
    slug = slugFromScript();
    if (!slug) return false;
    var store = profile();
    if (!store || typeof store.startSession !== "function") return false;
    try {
      store.startSession(slug);
    } catch (err) {
      return false;
    }
    try {
      timer = setInterval(function () {
        var api = profile();
        if (api && typeof api.flushSession === "function") api.flushSession();
        var engine = achievements();
        if (engine && typeof engine.sync === "function") engine.sync();
      }, FLUSH_MS);
    } catch (err) { /* interval unavailable: the unload handler still settles */ }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", stop);
      window.addEventListener("beforeunload", stop);
    }
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", function () {
        var api = profile();
        if (!api) return;
        try {
          if (document.hidden && typeof api.flushSession === "function") api.flushSession();
        } catch (err) { /* ignore */ }
      });
    }
    return true;
  }

  if (typeof document !== "undefined") {
    var boot = function () { start(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    slug: function () { return slug || slugFromScript(); },
    flush: function () {
      var api = profile();
      if (api && typeof api.flushSession === "function") return api.flushSession();
      return 0;
    },
    stop: stop,
    start: start,
    FLUSH_MS: FLUSH_MS
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubSession = GameHubSession;
}
