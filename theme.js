/* ============================================================
   GameHub — theme system (dark / midnight / light)
   One stored preference drives the whole platform through CSS
   custom properties: the <html> element carries
   data-theme="dark" | "midnight" | "light" and style.css swaps
   its token block, so every page, card, launcher and dialog
   changes together. The preference lives in localStorage under
   the shared "gamehub:" namespace.

   This file is loaded synchronously in <head> on every page so
   the correct theme is applied before the first paint (no flash
   of the wrong theme). It is dependency-free and never throws:
   when localStorage is blocked the theme simply falls back to the
   default for the session.
   Load order: theme.js (head) -> catalog.js -> … -> page script.
   ============================================================ */
"use strict";

var GameHubTheme = (function () {
  var PREFIX = "gamehub:";
  var KEY = "theme";
  var DEFAULT_THEME = "dark";
  var THEMES = ["dark", "midnight", "light"];
  var LABELS = { dark: "Dark", midnight: "Midnight", light: "Light" };
  var DESCRIPTIONS = {
    dark: "GameHub's classic dark gaming look",
    midnight: "Deep blue-black night mode with softer contrast",
    light: "Bright daytime theme with high contrast"
  };
  /* Browser chrome colour per theme (updated on <meta theme-color>). */
  var CHROME = { dark: "#0b0f1a", midnight: "#05060f", light: "#f4f6ff" };

  var memory = null;
  var listeners = [];

  function readRaw() {
    try {
      var store = localStorage;
      if (!store || typeof store.getItem !== "function") return memory;
      var value = store.getItem(PREFIX + KEY);
      return value == null ? memory : value;
    } catch (err) {
      return memory;
    }
  }

  function writeRaw(value) {
    memory = value;
    try {
      var store = localStorage;
      if (store && typeof store.setItem === "function") store.setItem(PREFIX + KEY, value);
    } catch (err) { /* storage blocked: memory fallback still themes this session */ }
  }

  function normalize(value) {
    var clean = String(value == null ? "" : value).trim().toLowerCase();
    return THEMES.indexOf(clean) === -1 ? "" : clean;
  }

  /* Stored preference first; the default theme otherwise. */
  function detect() {
    var stored = normalize(readRaw());
    if (stored) return stored;
    try {
      if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    } catch (err) { /* matchMedia unsupported: keep the default */ }
    return DEFAULT_THEME;
  }

  function current() {
    var attr = "";
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        attr = document.documentElement.getAttribute("data-theme");
      }
    } catch (err) { attr = ""; }
    return normalize(attr) || detect();
  }

  function metaTag() {
    try {
      if (typeof document === "undefined" || typeof document.querySelector !== "function") return null;
      return document.querySelector('meta[name="theme-color"]');
    } catch (err) {
      return null;
    }
  }

  function apply(theme) {
    var value = normalize(theme) || DEFAULT_THEME;
    try {
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.setAttribute("data-theme", value);
        if (document.documentElement.style) {
          document.documentElement.style.colorScheme = value === "light" ? "light" : "dark";
        }
      }
    } catch (err) { /* no document (tests / prerender): nothing to paint */ }
    var meta = metaTag();
    if (meta && typeof meta.setAttribute === "function") meta.setAttribute("content", CHROME[value] || CHROME.dark);
    return value;
  }

  function notify(theme) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](theme);
      } catch (err) { /* a listener must never break theming */ }
    }
    try {
      if (typeof document !== "undefined" && typeof document.dispatchEvent === "function" && typeof CustomEvent === "function") {
        document.dispatchEvent(new CustomEvent("gamehub:theme", { detail: { theme: theme } }));
      }
    } catch (err) { /* custom events unavailable: subscribers above already ran */ }
  }

  function set(theme) {
    var value = normalize(theme) || DEFAULT_THEME;
    writeRaw(value);
    apply(value);
    notify(value);
    syncSwitchers();
    return value;
  }

  function cycle() {
    var index = THEMES.indexOf(current());
    return set(THEMES[(index + 1) % THEMES.length]);
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"></path></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4z"></path></svg>';
  var STARS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.4 14.6A7.8 7.8 0 0 1 9.4 4.6a7.8 7.8 0 1 0 10 10z"></path><path d="M17.6 4.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"></path></svg>';
  var ICONS = { dark: MOON, midnight: STARS, light: SUN };

  function switcherMarkup() {
    return THEMES.map(function (theme) {
      return (
        '<button type="button" class="theme-option" data-theme-set="' + theme + '"' +
        ' aria-pressed="false" title="' + LABELS[theme] + ' theme"' +
        ' aria-label="Use the ' + LABELS[theme] + ' theme">' +
        ICONS[theme] +
        '<span class="theme-option-label">' + LABELS[theme] + "</span>" +
        "</button>"
      );
    }).join("");
  }

  /* Build one accessible segmented control. Buttons are real
     <button> elements, so keyboard users get them for free. */
  function createSwitcher(id) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    var group = document.createElement("div");
    group.className = "theme-switcher";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Colour theme");
    if (id) group.id = id;
    group.innerHTML = switcherMarkup();
    group.addEventListener("click", function (event) {
      var target = event.target;
      var button = target && typeof target.closest === "function" ? target.closest("[data-theme-set]") : null;
      if (!button) return;
      event.preventDefault();
      set(button.getAttribute("data-theme-set"));
    });
    return group;
  }

  var switchers = [];

  function syncSwitchers() {
    var active = current();
    for (var i = 0; i < switchers.length; i++) {
      var group = switchers[i];
      if (!group || typeof group.querySelectorAll !== "function") continue;
      var buttons = group.querySelectorAll("[data-theme-set]");
      for (var j = 0; j < buttons.length; j++) {
        var button = buttons[j];
        button.setAttribute("aria-pressed", String(button.getAttribute("data-theme-set") === active));
      }
    }
  }

  /* Mount a switcher into [data-theme-switcher] when a page marks a
     slot, otherwise append one to the primary header (all pages). */
  function mount(target) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    var host = target || null;
    if (typeof host === "string") host = document.querySelector(host);
    if (!host) {
      var marked = typeof document.querySelectorAll === "function" ? document.querySelectorAll("[data-theme-switcher]") : [];
      if (marked && marked.length) host = marked[0];
    }
    if (!host) host = typeof document.querySelector === "function" ? document.querySelector(".header-inner") : null;
    if (!host) return null;
    var group = createSwitcher();
    if (!group || typeof host.appendChild !== "function") return null;
    if (host.classList && typeof host.classList.add === "function") host.classList.add("has-theme-switcher");
    host.appendChild(group);
    switchers.push(group);
    syncSwitchers();
    onChange(syncSwitchers);
    return group;
  }

  function init() {
    apply(current());
    mount();
  }

  /* Apply immediately: this script is loaded in <head>. */
  apply(current());
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  return {
    THEMES: THEMES,
    LABELS: LABELS,
    DESCRIPTIONS: DESCRIPTIONS,
    DEFAULT_THEME: DEFAULT_THEME,
    current: current,
    get: current,
    set: set,
    apply: apply,
    cycle: cycle,
    onChange: onChange,
    mount: mount,
    createSwitcher: createSwitcher,
    switcherMarkup: switcherMarkup
  };
})();

if (typeof window !== "undefined" && window) {
  window.GameHubTheme = GameHubTheme;
}
