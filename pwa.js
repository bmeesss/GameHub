/* ============================================================
   GameHub — optional PWA bootstrap
   Registers the offline service worker on GitHub Pages (and any
   other static host) using a relative URL, so the site keeps
   working from a project sub-path such as /GameHub/.

   Scope rules (see service-worker.js): only same-origin GameHub
   assets are cached. Remote provider games stay entirely on the
   network — GameHub never pretends a provider game is a local file.
   Registration is skipped on file:// and when service workers are
   unavailable, so every existing flow keeps working.
   Load order: any page, deferred.
   ============================================================ */
"use strict";

var GameHubPWA = (function () {
  var registered = null;

  function scriptDir() {
    try {
      var current = document.currentScript;
      if (current && typeof current.getAttribute === "function") {
        var src = String(current.getAttribute("src") || "");
        var index = src.lastIndexOf("/");
        if (index >= 0) return src.slice(0, index + 1);
      }
    } catch (err) { /* fall back to the site root */ }
    return "";
  }

  function supported() {
    try {
      if (typeof navigator === "undefined" || !navigator.serviceWorker) return false;
      if (typeof location === "undefined") return false;
      return location.protocol === "http:" || location.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  function register() {
    if (!supported()) return null;
    if (registered) return registered;
    var url = scriptDir() + "service-worker.js";
    try {
      registered = navigator.serviceWorker.register(url).then(
        function (registration) {
          return registration;
        },
        function () {
          return null;
        }
      );
    } catch (err) {
      registered = null;
    }
    return registered;
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("load", register);
  } else {
    register();
  }

  return {
    register: register,
    supported: supported,
    url: function () { return scriptDir() + "service-worker.js"; }
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubPWA = GameHubPWA;
}
