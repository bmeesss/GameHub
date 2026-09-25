/* ============================================================
   GameHub — reusable game launcher
   Every games/<slug>/index.html carries a #launcher section with
   data-* config; this script reads it and launches by game type:
     html5    -> verify local game page, then navigate to it
     iframe   -> verify (local) and embed in a safe container;
                 remote provider games embed straight away
     webgl    -> verify local client, embed in a large viewport
     wasm     -> verify local client, embed in a large viewport
     external -> clear "Open game" panel linking to the provider's
                 https page (never auto-navigation)
   Minecraft-style clients (webgl/wasm) resolve in this order:
     1. a local client at games/<slug>/client/index.html
     2. a centrally configured HTTPS client (client-config.js)
     3. a friendly error — never a fake loading screen
   Remote safety: every remote target (provider embed, external
   link, configured client) passes the central validateRemoteUrl
   gate — HTTPS only, no credentials, no script-y schemes. URLs
   come from the catalog/page config, never from user input.
   Nothing is preloaded: games only load after the user presses
   Play. Missing files always fail gracefully — a game is never
   presented as playable when its files are absent.
   Remote embeds are watched by a load watchdog: when a provider
   refuses framing, a blocked overlay explains the problem and
   offers "Open game" on the provider's site. The iframe is never
   destroyed, so a slow-but-working game keeps loading.
   The launcher also enhances game pages from the shared
   catalog/player/cards modules: favorite toggle, personal stats,
   controls, difficulty, hosting attribution ("Hosted by GameHub"
   vs "Provided by <provider>") and catalog-driven related games.
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

/* ---------------- Central remote-URL validator ----------------
   The single gate for every remote target: provider embeds
   (iframe), provider links (external) and configured Minecraft
   clients. Enforces HTTPS, refuses credentials and script-y
   schemes. Every URL comes from the catalog or page config —
   never from user input — so this is a consistency check that
   also stops accidental http:// or misconfigured entries. */
const BLOCKED_URL_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "blob:"];

const validateRemoteUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return { ok: false, reason: "No remote URL is configured for this game." };
  const lower = raw.toLowerCase();
  for (const scheme of BLOCKED_URL_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { ok: false, reason: "Blocked an unsafe URL scheme." };
    }
  }
  if (!lower.startsWith("https://")) {
    return { ok: false, reason: "Remote game content must be served over HTTPS." };
  }
  const authority = raw.slice(8).split(/[/?#]/)[0];
  if (!authority || authority.includes("@")) {
    return { ok: false, reason: "Remote game URLs must not embed credentials." };
  }
  return { ok: true, url: raw };
};

/* Where a blocked/unembeddable game should send the player: the
   provider's game page when known, otherwise the remote target
   itself. Always re-validated — never trust page config blindly. */
const fallbackOpenUrl = (config, embedUrl = "") => {
  const candidates = [config && config.externalUrl, embedUrl];
  for (const candidate of candidates) {
    const check = validateRemoteUrl(candidate);
    if (check.ok) return check.url;
  }
  return "";
};

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
        const check = validateRemoteUrl(clientUrl);
        if (!check.ok) {
          return { action: "error", reason: "The configured client URL must use HTTPS.", detail: "Update client-config.js — HTTP clients are refused." };
        }
        return { action: "embed", url: check.url, probe: false, remote: true };
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
    const check = validateRemoteUrl(playUrl);
    if (!check.ok) {
      return { action: "error", reason: "External games must use a secure (HTTPS) URL.", detail: check.reason };
    }
    return { action: "external", url: check.url };
  }
  if (type === "html5") {
    if (isRemoteUrl(playUrl)) {
      return { action: "error", reason: "HTML5 games must be hosted locally on GameHub." };
    }
    return { action: "navigate", url: playUrl, probe: true };
  }
  /* iframe, webgl, wasm: embeddable types. Remote targets stream
     from a provider and cannot be probed (cross-origin), so they
     embed unprobed under the load watchdog instead. */
  if (isRemoteUrl(playUrl)) {
    const check = validateRemoteUrl(playUrl);
    if (!check.ok) {
      return { action: "error", reason: check.reason };
    }
    return { action: "embed", url: check.url, probe: false, remote: true };
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
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"></path></svg>`,
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
    provider: String(data.provider || "").trim(),
    externalUrl: String(data.externalUrl || "").trim(),
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
  loading: "Loading game…",
  running: "Running",
  blocked: "Not loading — the game may block embedding"
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
    link.textContent = "Open the game in a new tab";
    node.appendChild(link);
  }
};

const clearStage = (stage) => {
  while (stage.firstChild) stage.firstChild.remove();
};

/* Cover note adapts to where the game actually runs, so remote
   games stay honest about what pressing Play will do. */
const coverNoteFor = (config) => {
  if (config.type === "external") {
    return "The game opens on the provider's website in a new tab.";
  }
  if (config.type === "iframe" && isRemoteUrl(config.playUrl)) {
    return "The game streams from the provider and loads only after you press Play.";
  }
  return "The game loads only after you press Play.";
};

const renderCover = (launcher, stage, config) => {
  clearStage(stage);
  const cover = el("div", "launcher-cover");
  const title = el("p", "launcher-cover-title", `Ready to play <strong>${escapeHtml(config.title)}</strong>`);
  const play = el("button", "btn btn-primary btn-lg", `${ICONS.play}<span>Play now</span>`);
  play.type = "button";
  play.id = "launcher-play";
  const note = el("p", "launcher-cover-note", escapeHtml(coverNoteFor(config)));
  play.addEventListener("click", () => startLaunch(launcher, stage, config));
  cover.appendChild(title);
  cover.appendChild(play);
  cover.appendChild(note);
  stage.appendChild(cover);
  setOpenGameButton(launcher, config, null);
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

const renderError = (launcher, stage, config, reason, detail, openUrl = "") => {
  clearStage(stage);
  const error = el("div", "launcher-error");
  error.appendChild(el("div", "launcher-error-icon", ICONS.warn));
  error.appendChild(el("h3", "", "Game currently unavailable"));
  error.appendChild(el("p", "", escapeHtml(reason)));
  if (detail) error.appendChild(el("p", "launcher-error-detail", escapeHtml(detail)));
  const actions = el("div", "launcher-error-actions");
  if (openUrl) {
    /* Remote games always keep an escape hatch to the provider. */
    const open = el("a", "btn btn-primary btn-sm", `<span>Open game</span>${ICONS.open}`);
    open.setAttribute("href", openUrl);
    open.setAttribute("target", "_blank");
    open.setAttribute("rel", "noopener noreferrer");
    actions.appendChild(open);
  }
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

/* ---------------- External (provider) games ----------------
   type "external" games cannot run inside GameHub at all, so
   Play shows a clear hand-off panel instead of navigating away:
   the provider's page opens in a new tab, GameHub stays put. */
const renderExternalPanel = (launcher, stage, config, url) => {
  clearStage(stage);
  const panel = el("div", "launcher-external");
  panel.appendChild(el("div", "launcher-external-icon", ICONS.open));
  panel.appendChild(el("h3", "", escapeHtml(config.title)));
  const provider = config.provider ? escapeHtml(config.provider) : "the provider";
  panel.appendChild(el("p", "", `This game runs on ${provider}&#39;s website, so it opens in a new tab. GameHub stays right here.`));
  const actions = el("div", "launcher-external-actions");
  const open = el("a", "btn btn-primary btn-lg", `<span>Open game</span>${ICONS.open}`);
  open.setAttribute("href", url);
  open.setAttribute("target", "_blank");
  open.setAttribute("rel", "noopener noreferrer");
  actions.appendChild(open);
  panel.appendChild(actions);
  panel.appendChild(el("p", "launcher-cover-note", "GameHub does not host the game files."));
  stage.appendChild(panel);
  setOpenGameButton(launcher, config, null);
  setToolbar(launcher, { playing: false });
  setStatus(launcher, "ready");
};

/* ---------------- Toolbar "Open game" link ----------------
   While a remote game is embedded, the toolbar keeps a direct
   link to the provider's page: if the embed misbehaves, the
   player always has a one-click way out. */
const setOpenGameButton = (launcher, config, embedUrl) => {
  const toolbar = $(".launcher-toolbar", launcher);
  if (!toolbar) return;
  let link = $(".launcher-open", toolbar);
  const openUrl = embedUrl === null ? "" : fallbackOpenUrl(config, embedUrl);
  if (!openUrl) {
    if (link) link.hidden = true;
    return;
  }
  if (!link) {
    link = el("a", "btn btn-ghost btn-sm launcher-open", `<span>Open game</span>${ICONS.open}`);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
    toolbar.appendChild(link);
  }
  link.hidden = false;
  link.setAttribute("href", openUrl);
};

/* ---------------- Blocked-embed overlay ----------------
   Cross-origin iframes cannot be inspected, so embeddability is
   decided by curation and enforced best-effort: when a remote
   game shows no sign of life before the watchdog fires, this
   overlay explains the problem and offers the provider's page.
   The iframe itself is kept (never destroyed) — "Keep waiting"
   dismisses the overlay and a game that is merely slow keeps
   loading underneath; a later load event clears everything. */
const showBlockedOverlay = (launcher, stage, config, url) => {
  if ($(".launcher-blocked", stage)) return;
  const openUrl = fallbackOpenUrl(config, url);
  const box = el("div", "launcher-blocked");
  box.setAttribute("role", "alert");
  box.appendChild(el("div", "launcher-error-icon", ICONS.warn));
  box.appendChild(el("h3", "", "This game cannot be embedded here."));
  box.appendChild(el("p", "", "It did not respond inside GameHub in time — the provider may refuse embedding."));
  const actions = el("div", "launcher-blocked-actions");
  if (openUrl) {
    const open = el("a", "btn btn-primary btn-sm", `<span>Open game</span>${ICONS.open}`);
    open.setAttribute("href", openUrl);
    open.setAttribute("target", "_blank");
    open.setAttribute("rel", "noopener noreferrer");
    actions.appendChild(open);
  }
  const retry = el("button", "btn btn-ghost btn-sm", "Try again");
  retry.type = "button";
  retry.addEventListener("click", () => startLaunch(launcher, stage, config));
  actions.appendChild(retry);
  const keepWaiting = el("button", "btn btn-ghost btn-sm", "Keep waiting");
  keepWaiting.type = "button";
  keepWaiting.addEventListener("click", () => {
    box.remove();
    setStatus(launcher, "loading");
  });
  actions.appendChild(keepWaiting);
  box.appendChild(actions);
  stage.appendChild(box);
  setStatus(launcher, "blocked", openUrl);
};

const hideBlockedOverlay = (stage) => {
  const box = $(".launcher-blocked", stage);
  if (box) box.remove();
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

/* Embed a verified game. Remote (unprobed) HTTPS targets —
   provider embeds and configured clients — run under a load
   watchdog: instead of silently showing a blank viewport, a
   blocked overlay explains the problem and offers the provider's
   page. The iframe itself is never destroyed, so a slow-but-
   working game keeps loading and a late load event recovers. */
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
    if (remote) {
      renderError(launcher, stage, config, "The game failed to load in its viewport.", "", fallbackOpenUrl(config, url));
    } else {
      renderError(launcher, stage, config, "The game failed to load in its viewport.", "");
    }
  });
  frame.addEventListener("load", () => {
    settled = true;
    hideBlockedOverlay(stage);
    setStatus(launcher, "running");
  });
  stage.appendChild(frame);
  setToolbar(launcher, { playing: true });
  setStatus(launcher, remote ? "loading" : "running");
  if (remote) {
    setOpenGameButton(launcher, config, url);
    if (typeof setTimeout === "function") {
      setTimeout(() => {
        if (settled) return;
        try {
          if (typeof stage.contains === "function" && !stage.contains(frame)) return;
        } catch {
          return;
        }
        showBlockedOverlay(launcher, stage, config, url);
      }, REMOTE_LOAD_TIMEOUT_MS);
    }
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
    /* External games never auto-navigate: a clear hand-off panel
       links to the provider (new tab) and records the launch. */
    recordLaunch(config.slug);
    renderExternalPanel(launcher, stage, config, plan.url);
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
   are injected from the shared modules so the static pages
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

/* Hosting attribution row: GameHub's own games vs provider games.
   Kept dynamic so all 58 game pages stay metadata-free and the
   catalog remains the single source of truth. */
const enhanceHosting = (entry, config) => {
  const meta = $(".game-meta");
  if (!meta || $("[data-meta-hosting]", meta)) return;
  const provider = String((entry && entry.provider) || config.provider || "").trim();
  const row = el("div");
  row.setAttribute("data-meta-hosting", "");
  row.innerHTML = `<dt>Hosting</dt><dd>${escapeHtml(provider ? `Provided by ${provider}` : "Hosted by GameHub")}</dd>`;
  meta.appendChild(row);
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
  enhanceHosting(entry, config);
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
