/* ============================================================
   GameHub — reusable game launcher
   Every games/<slug>/index.html carries a #launcher section with
   data-* config; this script reads it and launches by game type:
     html5    -> verify local game page, then navigate to it
     iframe   -> verify (local) and embed in a safe container
     webgl    -> verify local client, embed in a large viewport
     wasm     -> verify local client, embed in a large viewport
     external -> navigate to the configured https URL
   Nothing is preloaded: clients only load after the user
   presses Play. Missing files always fail gracefully — a game is
   never presented as playable when its files are absent.
   Run tests with: node tests/smoke.mjs && python3 tests/check.py
   ============================================================ */
"use strict";

/* ---------------- Pure launch planner ---------------- */
const LAUNCH_TYPES = ["html5", "iframe", "external", "webgl", "wasm"];
const PROBE_TIMEOUT_MS = 8000;
const DEFAULT_IFRAME_ALLOW = "autoplay; fullscreen; gamepad; pointer-lock";

const isRemoteUrl = (url) => /^https?:\/\//i.test(String(url || "").trim());

const isHttpsUrl = (url) => /^https:\/\/[^/]/i.test(String(url || "").trim());

/* Conventional client location for WebGL/WASM games missing files. */
const clientHint = (slug) => `games/${slug}/client/index.html`;

/* Decide what Play should do. Never touches the network or DOM,
   so it is cheap to unit test and safe to call speculatively.
   config: { slug, type, playUrl } — all strings, playUrl may be "". */
const resolveLaunch = (config) => {
  const slug = String((config && config.slug) || "").trim();
  const type = String((config && config.type) || "").trim().toLowerCase();
  const playUrl = String((config && config.playUrl) || "").trim();

  if (!LAUNCH_TYPES.includes(type)) {
    return { action: "error", reason: "This game uses an unsupported game type." };
  }
  if (!playUrl) {
    if (type === "webgl" || type === "wasm") {
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
    type: String(data.type || "").trim().toLowerCase(),
    playUrl: String(data.playUrl || "").trim(),
    sandbox: String(data.embedSandbox || "").trim(),
    allow: String(data.embedAllow || DEFAULT_IFRAME_ALLOW).trim() || DEFAULT_IFRAME_ALLOW
  };
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
};

const renderLoading = (stage, config) => {
  clearStage(stage);
  const loading = el("div", "launcher-loading");
  loading.setAttribute("role", "status");
  loading.appendChild(el("span", "spinner", `<span class="sr-only">Loading</span>`));
  loading.appendChild(el("p", "", `Loading <strong>${escapeHtml(config.title)}</strong>…`));
  stage.appendChild(loading);
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
};

const setToolbar = (launcher, { playing }) => {
  const toolbar = $(".launcher-toolbar", launcher);
  if (!toolbar) return;
  toolbar.hidden = !playing;
  const fullscreenBtn = $(".launcher-fullscreen", toolbar);
  if (fullscreenBtn) fullscreenBtn.hidden = !supportsFullscreen();
};

const embedGame = (launcher, stage, config, url) => {
  clearStage(stage);
  const frame = document.createElement("iframe");
  frame.className = "launcher-frame";
  frame.setAttribute("src", url);
  frame.setAttribute("title", `${config.title} — game viewport`);
  frame.setAttribute("allow", config.allow);
  frame.setAttribute("allowfullscreen", "");
  if (config.sandbox) frame.setAttribute("sandbox", config.sandbox);
  frame.setAttribute("loading", "eager");
  frame.addEventListener("error", () => {
    renderError(launcher, stage, config, "The game failed to load in its viewport.", "");
  });
  stage.appendChild(frame);
  setToolbar(launcher, { playing: true });
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

const startLaunch = (launcher, stage, config) => {
  const plan = resolveLaunch(config);
  if (plan.action === "error") {
    renderError(launcher, stage, config, plan.reason, plan.detail || "");
    return;
  }
  if (plan.action === "external") {
    renderLoading(stage, config);
    location.assign(plan.url);
    return;
  }
  if (!plan.probe) {
    renderLoading(stage, config);
    embedGame(launcher, stage, config, plan.url);
    return;
  }
  renderLoading(stage, config);
  probeUrl(plan.url).then((result) => {
    if (!result.ok) {
      const detail = config.type === "webgl" || config.type === "wasm"
        ? `Client files have not been added yet.${config.slug ? ` Expected at ${clientHint(config.slug)}.` : ""}`
        : `Could not load the game files${result.status ? ` (HTTP ${result.status})` : ""}.`;
      renderError(launcher, stage, config, "The game files could not be found.", detail);
      return;
    }
    if (plan.action === "navigate") {
      location.assign(plan.url);
      return;
    }
    embedGame(launcher, stage, config, plan.url);
  });
};

const initLauncher = () => {
  const launcher = $("#launcher");
  if (!launcher) return;
  const stage = $("#launcher-stage", launcher);
  if (!stage) return;
  const config = readConfig(launcher);
  renderCover(launcher, stage, config);

  $(".launcher-fullscreen", launcher)?.addEventListener("click", () => toggleFullscreen(stage));
  $(".launcher-close", launcher)?.addEventListener("click", () => closeGame(launcher, stage, config));
  document.addEventListener("fullscreenchange", () => {
    const button = $(".launcher-fullscreen", launcher);
    if (button) button.classList.toggle("is-active", isFullscreen());
  });
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

/* ---------------- Init ---------------- */
renderYear();
initCoverFallback();
initLauncher();
