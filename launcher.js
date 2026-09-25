/* ============================================================
   GameHub — reusable game launcher
   Every games/<slug>/index.html carries a #launcher section with
   data-* config; this script reads it and launches by game type:
     html5    -> verify local game page, then navigate to it
     iframe   -> verify (local) and embed in a safe container
     webgl    -> verify local client, embed in a large viewport
     wasm     -> verify local client, embed in a large viewport
     external -> navigate to the configured https URL
   Minecraft-style clients (webgl/wasm) resolve in this order:
     1. a local client at games/<slug>/client/index.html
     2. a centrally configured HTTPS client (client-config.js)
     3. a friendly error — never a fake loading screen
   Nothing is preloaded: clients only load after the user
   presses Play. Missing files always fail gracefully — a game is
   never presented as playable when its files are absent.
   The launcher also enhances game pages from the shared
   catalog/player/cards modules: favorite toggle, personal stats,
   controls, difficulty and catalog-driven related games. When a
   valid client is present (local or configured), the page status
   upgrades from "Coming soon" to "Available" at runtime.
   Load order on game pages: catalog.js -> player.js -> cards.js
   -> client-config.js -> launcher.js. Every enhancement degrades
   gracefully when a module failed to load.
   Run tests with: node tests/smoke.mjs && python3 tests/check.py
   ============================================================ */
"use strict";

/* ---------------- Shared modules (optional) ---------------- */
const Catalog = (() => {
  if (typeof GameHubCatalog !== "undefined" && GameHubCatalog) return GameHubCatalog;
  if (typeof window !== "undefined" && window && window.GameHubCatalog) return window.GameHubCatalog;
  return null;
})();
const Player = (() => {
  if (typeof GameHubPlayer !== "undefined" && GameHubPlayer) return GameHubPlayer;
  if (typeof window !== "undefined" && window && window.GameHubPlayer) return window.GameHubPlayer;
  return null;
})();
const Cards = (() => {
  if (typeof GameHubCards !== "undefined" && GameHubCards) return GameHubCards;
  if (typeof window !== "undefined" && window && window.GameHubCards) return window.GameHubCards;
  return null;
})();

/* Record a launch only when a game actually starts (verified
   target), never when an info page is merely opened. */
const recordLaunch = (slug) => {
  if (!Player || !slug) return;
  try {
    Player.recordGamePlayed(slug);
  } catch {
    /* Player storage must never break launching. */
  }
};

/* ---------------- Pure launch planner ---------------- */
const LAUNCH_TYPES = ["html5", "iframe", "external", "webgl", "wasm"];
const PROBE_TIMEOUT_MS = 8000;
const DEFAULT_IFRAME_ALLOW = "autoplay; fullscreen; gamepad; pointer-lock";

const isRemoteUrl = (url) => /^https?:\/\//i.test(String(url || "").trim());

const isHttpsUrl = (url) => /^https:\/\/[^/]/i.test(String(url || "").trim());

/* Conventional client location for WebGL/WASM games missing files. */
const clientHint = (slug) => `games/${slug}/client/index.html`;

/* ---------------- Central client configuration ----------------
   client-config.js may define window.GameHubClients:
     { clients: { "<slug>": { url: "https://host/path/index.html" } } }
   A local client (the page's data-play-url) always wins; the
   configured HTTPS client is the fallback when no local client is
   present. GameHub bundles no client files itself — the URL must
   point at a build the operator is allowed to serve. */
const readClientConfig = () => {
  if (typeof GameHubClients !== "undefined" && GameHubClients) return GameHubClients;
  if (typeof window !== "undefined" && window && window.GameHubClients) return window.GameHubClients;
  return null;
};

const configuredClientUrl = (slug, fallback = "") => {
  let url = "";
  const config = readClientConfig();
  const entry = config && config.clients ? config.clients[slug] : null;
  if (entry && typeof entry === "object") url = String(entry.url || "").trim();
  if (!url) url = String(fallback || "").trim();
  return url;
};

/* Types whose play target is a heavyweight client bundle. */
const CLIENT_TYPES = ["webgl", "wasm"];
const isClientType = (type) => CLIENT_TYPES.includes(type);


/* Decide what Play should do. Never touches the network or DOM,
   so it is cheap to unit test and safe to call speculatively.
   config: { slug, type, playUrl, clientUrl } — all strings,
   playUrl/clientUrl may be "". For webgl/wasm the local client
   (playUrl) wins; a valid HTTPS clientUrl is the fallback. */
const resolveLaunch = (config) => {
  const slug = String((config && config.slug) || "").trim();
  const type = String((config && config.type) || "").trim().toLowerCase();
  const playUrl = String((config && config.playUrl) || "").trim();
  const clientUrl = String((config && config.clientUrl) || "").trim();

  if (!LAUNCH_TYPES.includes(type)) {
    return { action: "error", reason: "This game uses an unsupported game type." };
  }
  if (!playUrl) {
    if (isClientType(type)) {
      if (clientUrl) {
        if (!isHttpsUrl(clientUrl)) {
          return { action: "error", reason: "The configured client URL must use HTTPS.", detail: "Update client-config.js — HTTP clients are refused." };
        }
        return { action: "embed", url: clientUrl, probe: false, remote: true };
      }
      return {
        action: "error",
        reason: "Client files have not been added yet.",
        detail: slug ? `Expected at ${clientHint(slug)}.` : ""
      };
    }
    return { action: "error", reason: "A play URL has not been configured for this game yet." };
  }
  if (type === "external") {
    if (!isHttpsUrl(playUrl)) {
      return { action: "error", reason: "External games must use a secure (HTTPS) URL." };
    }
    return { action: "external", url: playUrl };
  }
  if (type === "html5") {
    if (isRemoteUrl(playUrl)) {
      return { action: "error", reason: "HTML5 games must be hosted locally on GameHub." };
    }
    return { action: "navigate", url: playUrl, probe: true };
  }
  /* iframe, webgl, wasm: embeddable types. */
  if (isRemoteUrl(playUrl)) {
    if (!isHttpsUrl(playUrl)) {
      return { action: "error", reason: "Remote game content must be served over HTTPS." };
    }
    return { action: "embed", url: playUrl, probe: false };
  }
  return { action: "embed", url: playUrl, probe: true };
};

/* ---------------- Small DOM helpers ---------------- */
const $ = (selector, scope = document) => scope.querySelector(selector);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"></path></svg>`,
  expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4M12 16h.01"></path></svg>`
};

/* ---------------- Availability probing ----------------
   HEAD-check a local target before navigating/embedding so a
   missing client becomes a friendly error instead of a raw 404.
   Skipped on file:// (fetch is unreliable there) and when fetch
   is unavailable — the browser then handles failures natively. */
const probeUrl = (url) => {
  if (typeof fetch !== "function") return Promise.resolve({ ok: true, skipped: true });
  try {
    if (location.protocol === "file:") return Promise.resolve({ ok: true, skipped: true });
  } catch {
    return Promise.resolve({ ok: true, skipped: true });
  }
  let timer = null;
  let controller = null;
  try {
    controller = new AbortController();
    timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  } catch {
    controller = null;
  }
  const options = { method: "HEAD", cache: "no-store" };
  if (controller) options.signal = controller.signal;
  return fetch(url, options).then(
    (response) => {
      if (timer) clearTimeout(timer);
      return { ok: Boolean(response && response.ok), status: response ? response.status : 0 };
    },
    () => {
      if (timer) clearTimeout(timer);
      return { ok: false, status: 0 };
    }
  );
};

/* ---------------- Fullscreen ---------------- */
const isFullscreen = () =>
  Boolean(document.fullscreenElement || document.webkitFullscreenElement);

const requestFullscreen = (node) => {
  try {
    if (node.requestFullscreen) return node.requestFullscreen();
    if (node.webkitRequestFullscreen) return node.webkitRequestFullscreen();
  } catch {
    /* fall through to rejection below */
  }
  return Promise.reject(new Error("Fullscreen is not supported."));
};

const exitFullscreen = () => {
  try {
    if (document.exitFullscreen && document.fullscreenElement) return document.exitFullscreen();
    if (document.webkitExitFullscreen && document.webkitFullscreenElement) return document.webkitExitFullscreen();
  } catch {
    /* no fullscreen session to exit */
  }
  return Promise.resolve();
};

const supportsFullscreen = () =>
  Boolean(document.documentElement && (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen));

/* ---------------- Launcher UI ---------------- */
const readConfig = (section) => {
  const data = section.dataset || {};
  return {
    slug: String(data.slug || "").trim(),
    title: String(data.title || "This game").trim(),
    status: String(data.status || "").trim().toLowerCase(),
    type: String(data.type || "").trim().toLowerCase(),
    playUrl: String(data.playUrl || "").trim(),
    clientUrl: String(data.clientUrl || "").trim(),
    sandbox: String(data.embedSandbox || "").trim(),
    allow: String(data.embedAllow || DEFAULT_IFRAME_ALLOW).trim() || DEFAULT_IFRAME_ALLOW
  };
};

/* Merge the central client configuration into a page config:
   client-config.js wins over the page's data-client-url. */
const withClientConfig = (config) => {
  if (!isClientType(config.type)) return { ...config, clientUrl: "" };
  return { ...config, clientUrl: configuredClientUrl(config.slug, config.clientUrl) };
};

/* Status read-out shown in the launcher toolbar. */
const STATUS_TEXT = {
  ready: "Ready to play",
  loading: "Loading client…",
  running: "Running",
  blocked: "Client not loading — it may block embedding"
};

const setStatus = (launcher, key, url = "") => {
  const node = $(".launcher-status", launcher);
  if (!node) return;
  node.setAttribute("data-state", key);
  node.textContent = STATUS_TEXT[key] || "";
  if (key === "blocked" && url && isHttpsUrl(url)) {
    node.appendChild(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.className = "launcher-status-link";
    link.setAttribute("href", url);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
    link.textContent = "Open the client in a new tab";
    node.appendChild(link);
  }
};

const clearStage = (stage) => {
  while (stage.firstChild) stage.firstChild.remove();
};

const renderCover = (launcher, stage, config) => {
  clearStage(stage);
  const cover = el("div", "launcher-cover");
  const title = el("p", "launcher-cover-title", `Ready to play <strong>${escapeHtml(config.title)}</strong>`);
  const play = el("button", "btn btn-primary btn-lg", `${ICONS.play}<span>Play now</span>`);
  play.type = "button";
  play.id = "launcher-play";
  const note = el("p", "launcher-cover-note", "The game loads only after you press Play.");
  play.addEventListener("click", () => startLaunch(launcher, stage, config));
  cover.appendChild(title);
  cover.appendChild(play);
  cover.appendChild(note);
  stage.appendChild(cover);
  setToolbar(launcher, { playing: false });
  setStatus(launcher, "ready");
};

const renderLoading = (launcher, stage, config) => {
  clearStage(stage);
  const loading = el("div", "launcher-loading");
  loading.setAttribute("role", "status");
  loading.appendChild(el("span", "spinner", `<span class="sr-only">Loading</span>`));
  loading.appendChild(el("p", "", `Loading <strong>${escapeHtml(config.title)}</strong>…`));
  stage.appendChild(loading);
  setStatus(launcher, "loading");
};

const renderError = (launcher, stage, config, reason, detail) => {
  clearStage(stage);
  const error = el("div", "launcher-error");
  error.appendChild(el("div", "launcher-error-icon", ICONS.warn));
  error.appendChild(el("h3", "", "Game currently unavailable"));
  error.appendChild(el("p", "", escapeHtml(reason)));
  if (detail) error.appendChild(el("p", "launcher-error-detail", escapeHtml(detail)));
  const actions = el("div", "launcher-error-actions");
  const retry = el("button", "btn btn-ghost btn-sm", "Try again");
  retry.type = "button";
  retry.addEventListener("click", () => startLaunch(launcher, stage, config));
  const back = el("a", "btn btn-ghost btn-sm", "Back to catalog");
  back.setAttribute("href", "../../index.html#games");
  actions.appendChild(retry);
  actions.appendChild(back);
  error.appendChild(actions);
  stage.appendChild(error);
  setToolbar(launcher, { playing: false });
  setStatus(launcher, "");
};

const setToolbar = (launcher, { playing }) => {
  const toolbar = $(".launcher-toolbar", launcher);
  if (!toolbar) return;
  toolbar.hidden = !playing;
  const fullscreenBtn = $(".launcher-fullscreen", toolbar);
  if (fullscreenBtn) fullscreenBtn.hidden = !supportsFullscreen();
  const restartBtn = $(".launcher-restart", toolbar);
  if (restartBtn) {
    const embedded = Boolean($("iframe", launcher));
    restartBtn.hidden = !playing || !embedded;
  }
};

const ensureRestartButton = (launcher, stage, config) => {
  const toolbar = $(".launcher-toolbar", launcher);
  if (!toolbar || $(".launcher-restart", toolbar)) return;
  const restart = el("button", "btn btn-ghost btn-sm launcher-restart", "Restart game");
  restart.type = "button";
  restart.hidden = true;
  restart.addEventListener("click", () => {
    const frame = $("iframe", stage);
    if (frame) {
      const src = frame.getAttribute("src");
      frame.setAttribute("src", src || "");
    } else {
      startLaunch(launcher, stage, config);
    }
  });
  toolbar.appendChild(restart);
};

/* Embed a verified client. For remote (unprobed) HTTPS clients a
   load watchdog watches for hosts that refuse framing: instead of
   silently showing a blank viewport, the status area explains the
   problem and offers a new-tab escape hatch. The iframe itself is
   never destroyed, so a slow-but-working client keeps loading. */
const REMOTE_LOAD_TIMEOUT_MS = 15000;

const embedGame = (launcher, stage, config, url, remote = false) => {
  clearStage(stage);
  const frame = document.createElement("iframe");
  frame.className = "launcher-frame";
  frame.setAttribute("src", url);
  frame.setAttribute("title", `${config.title} — game viewport`);
  frame.setAttribute("allow", config.allow);
  frame.setAttribute("allowfullscreen", "");
  if (config.sandbox) frame.setAttribute("sandbox", config.sandbox);
  frame.setAttribute("loading", "eager");
  let settled = false;
  frame.addEventListener("error", () => {
    settled = true;
    renderError(launcher, stage, config, "The game failed to load in its viewport.", "");
  });
  frame.addEventListener("load", () => {
    settled = true;
    setStatus(launcher, "running");
  });
  stage.appendChild(frame);
  setToolbar(launcher, { playing: true });
  setStatus(launcher, remote ? "loading" : "running");
  if (remote && typeof setTimeout === "function") {
    setTimeout(() => {
      if (settled) return;
      try {
        if (typeof stage.contains === "function" && !stage.contains(frame)) return;
      } catch {
        return;
      }
      setStatus(launcher, "blocked", url);
    }, REMOTE_LOAD_TIMEOUT_MS);
  }
};

const closeGame = (launcher, stage, config) => {
  exitFullscreen();
  renderCover(launcher, stage, config);
};

const toggleFullscreen = (stage) => {
  if (isFullscreen()) {
    exitFullscreen();
  } else {
    try {
      const result = requestFullscreen(stage);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch {
      /* Fullscreen unavailable — the game remains playable inline. */
    }
  }
};

const startLaunch = (launcher, stage, baseConfig) => {
  /* Merge the central client configuration on every attempt so
     operators can point a slot at an HTTPS client at any time. */
  const config = withClientConfig(baseConfig);
  const plan = resolveLaunch(config);
  if (plan.action === "error") {
    renderError(launcher, stage, config, plan.reason, plan.detail || "");
    return;
  }
  if (plan.action === "external") {
    renderLoading(launcher, stage, config);
    recordLaunch(config.slug);
    location.assign(plan.url);
    return;
  }
  if (!plan.probe) {
    renderLoading(launcher, stage, config);
    recordLaunch(config.slug);
    embedGame(launcher, stage, config, plan.url, Boolean(plan.remote));
    return;
  }
  renderLoading(launcher, stage, config);
  probeUrl(plan.url).then((result) => {
    if (!result.ok) {
      /* Local target missing: client-type games fall back to the
         centrally configured HTTPS client before giving up. */
      if (isClientType(config.type)) {
        const remote = configuredClientUrl(config.slug, config.clientUrl);
        if (remote && isHttpsUrl(remote)) {
          recordLaunch(config.slug);
          embedGame(launcher, stage, config, remote, true);
          return;
        }
        if (remote) {
          renderError(launcher, stage, config, "The configured client URL must use HTTPS.", "Update client-config.js — HTTP clients are refused.");
          return;
        }
      }
      const detail = isClientType(config.type)
        ? `Client files have not been added yet.${config.slug ? ` Expected at ${clientHint(config.slug)}.` : ""}`
        : `Could not load the game files${result.status ? ` (HTTP ${result.status})` : ""}.`;
      renderError(launcher, stage, config, "The game files could not be found.", detail);
      return;
    }
    if (plan.action === "navigate") {
      recordLaunch(config.slug);
      location.assign(plan.url);
      return;
    }
    recordLaunch(config.slug);
    embedGame(launcher, stage, config, plan.url, false);
  });
};

/* ---------------- Client status on game pages ----------------
   Minecraft-style slots ship as "Coming soon" until a client is
   present. A HEAD request (existence only — no client assets are
   downloaded) or a valid central configuration upgrades the
   visible status to "Available" and retires the notice, so the
   page never claims "Coming soon" once a client is genuinely
   configured. The catalog stays the static source of truth; this
   is a runtime display upgrade only. */
const clientAvailability = (config) => {
  const clientUrl = withClientConfig(config).clientUrl;
  if (clientUrl) {
    return Promise.resolve(isHttpsUrl(clientUrl) ? { available: true, source: "remote" } : { available: false, source: "" });
  }
  if (!config.playUrl) return Promise.resolve({ available: false, source: "" });
  return probeUrl(config.playUrl).then((result) =>
    result.ok && !result.skipped ? { available: true, source: "local" } : { available: false, source: "" }
  );
};

const enhanceClientStatus = (config) => {
  if (!isClientType(config.type)) return;
  clientAvailability(config).then((result) => {
    if (!result.available) return;
    const statusValue = $("[data-status-value]");
    if (statusValue) statusValue.textContent = "Available";
    const notice = $("[data-client-notice]");
    if (notice) notice.hidden = true;
    if (Cards && typeof Cards.markClientAvailable === "function") Cards.markClientAvailable(config.slug);
  });
};

const initLauncher = () => {
  const launcher = $("#launcher");
  if (!launcher) return;
  const stage = $("#launcher-stage", launcher);
  if (!stage) return;
  const config = withClientConfig(readConfig(launcher));
  initLauncher.config = config;
  renderCover(launcher, stage, config);
  ensureRestartButton(launcher, stage, config);

  $(".launcher-fullscreen", launcher)?.addEventListener("click", () => toggleFullscreen(stage));
  $(".launcher-close", launcher)?.addEventListener("click", () => closeGame(launcher, stage, config));
  document.addEventListener("fullscreenchange", () => {
    const button = $(".launcher-fullscreen", launcher);
    if (button) button.classList.toggle("is-active", isFullscreen());
  });
  enhanceClientStatus(config);
};

/* ---------------- Shared page niceties ---------------- */
const renderYear = () => {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
};

const initCoverFallback = () => {
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const cover = img.closest(".game-cover");
    if (!cover) return;
    const art = document.createElement("span");
    art.className = "media-art";
    art.textContent = img.getAttribute("data-art") || "G";
    img.remove();
    cover.prepend(art);
  }, true);
};

/* ---------------- Game page enhancements ----------------
   Favorite toggle, personal stats, controls and related games
   are injected from the shared modules so the 41 static pages
   stay thin and never duplicate catalog metadata. */
const HEART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.7C6.4 17.2 3 13.6 3 9.9 3 7.2 5.1 5 7.8 5c1.7 0 3.2.9 4.2 2.3C13 5.9 14.5 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.3-9 10.8z"></path></svg>`;

const catalogEntry = (config) => {
  if (Catalog && typeof Catalog.gameBySlug === "function") {
    const entry = Catalog.gameBySlug(config.slug);
    if (entry) return entry;
  }
  return { id: config.slug, slug: config.slug, title: config.title, type: config.type };
};

const enhanceFavorite = (entry) => {
  if (!Player) return;
  const actions = $(".game-actions");
  if (!actions || $("[data-fav-page]", actions)) return;
  const button = el("button", "btn btn-ghost", `${HEART_ICON}<span>Favorite</span>`);
  button.type = "button";
  button.setAttribute("data-fav-page", entry.id || "");
  const paint = () => {
    const active = Player.isFavorite(entry.id);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", `${active ? "Remove" : "Add"} ${entry.title || "this game"} ${active ? "from" : "to"} favorites`);
    const label = $("span", button);
    if (label) label.textContent = active ? "Favorited" : "Favorite";
  };
  button.addEventListener("click", () => {
    Player.toggleFavorite(entry.id);
    paint();
  });
  paint();
  actions.appendChild(button);
};

const enhanceStats = (entry, config) => {
  if (!Player) return;
  const info = $(".game-info");
  if (!info || $("#game-stats")) return;
  if (config.status === "coming-soon") return;
  const stats = Player.getStats(entry.id);
  const box = el("dl", "game-stats");
  box.id = "game-stats";
  const rows = [];
  rows.push(`<div><dt>Played</dt><dd>${stats.gamesPlayed > 0 ? `${stats.gamesPlayed} time${stats.gamesPlayed === 1 ? "" : "s"}` : "Not yet"}</dd></div>`);
  if (stats.gamesPlayed > 0 && stats.lastPlayed) {
    rows.push(`<div><dt>Last played</dt><dd>${escapeHtml(Player.formatLastPlayed(stats.lastPlayed))}</dd></div>`);
  }
  if (stats.bestScore) {
    rows.push(`<div><dt>${escapeHtml(stats.bestLabel || "Best")}</dt><dd>${escapeHtml(stats.bestScore)}</dd></div>`);
  }
  box.innerHTML = rows.join("");
  const heading = el("p", "game-stats-title", "Your stats <span>(this browser only)</span>");
  const wrap = el("div", "game-stats-wrap");
  wrap.appendChild(heading);
  wrap.appendChild(box);
  info.appendChild(wrap);
};

const enhanceMeta = (entry) => {
  if (!entry.difficulty) return;
  const meta = $(".game-meta");
  if (!meta || $("[data-meta-difficulty]", meta)) return;
  meta.innerHTML += `<div data-meta-difficulty><dt>Difficulty</dt><dd>${escapeHtml(entry.difficulty)}</dd></div>`;
};

const enhanceControls = (entry) => {
  if (!entry.controls) return;
  const about = $(".game-about");
  if (!about || $(".how-to", about)) return;
  about.appendChild(el("p", "how-to", `<strong>How to play:</strong> ${escapeHtml(entry.controls)}`));
};

const enhanceRelated = (entry) => {
  if (!Catalog || !Cards) return;
  const about = $(".game-about");
  if (!about || $("#related-grid")) return;
  const related = Catalog.getRelated(entry, 3);
  if (!related.length) return;
  const section = el("section", "game-related");
  section.setAttribute("aria-labelledby", "related-title");
  section.innerHTML = `<h2 id="related-title">More like this</h2><div class="grid" id="related-grid"></div>`;
  const parent = about.parentNode;
  if (parent) parent.appendChild(section);
  else about.appendChild(section);
  Cards.renderInto($("#related-grid"), related, { prefix: "../" });
};

const initGamePage = (config) => {
  if (!config || !config.slug) return;
  if (!$(".game-info") && !$(".game-about")) return;
  const entry = catalogEntry(config);
  if (!entry || !entry.id) return;
  enhanceFavorite(entry);
  enhanceStats(entry, config);
  enhanceMeta(entry);
  enhanceControls(entry);
  enhanceRelated(entry);
  if (Cards) Cards.wireFavorites(document, () => Cards.syncFavButtons(document));
};

/* ---------------- Init ---------------- */
renderYear();
initCoverFallback();
initLauncher();
initGamePage(initLauncher.config || null);
