/* GameHub per-game runtime tests (dependency-free).
   Run from the repo root:  node tests/games.mjs
   Discovers games/<slug>/play/game.js, executes each in a stub DOM,
   steps animation frames, dispatches synthetic keyboard/click input,
   and fails on any exception, unknown element id, or missing hookup. */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gamesDir = path.join(root, "games");
const slugs = readdirSync(gamesDir)
  .filter((s) => existsSync(path.join(gamesDir, s, "play", "game.js")))
  .sort();

let failures = 0;
let ran = 0;
const t = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failures++;
};

/* ---------------- Stub DOM ---------------- */
function makeCtx2d(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol") return undefined;
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "getImageData") {
        return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      }
      if (prop === "createImageData") {
        return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      }
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      if (prop === "createPattern") return () => ({});
      if (prop === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

function makeElement(tag, id = "") {
  const classes = new Set();
  const el = {
    _tag: String(tag).toLowerCase(),
    _attrs: {},
    _listeners: {},
    _parent: null,
    children: [],
    id,
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    innerHTML: "",
    textContent: "",
    value: "",
    width: 300,
    height: 150,
    clientWidth: 800,
    clientHeight: 600,
    offsetWidth: 800,
    offsetHeight: 600,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : Boolean(force);
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains: (c) => classes.has(c)
    },
    get parentNode() { return this._parent; },
    get firstChild() { return this.children[0] || null; },
    get className() { return [...classes].join(" "); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    appendChild(child) { child._parent = this; this.children.push(child); return child; },
    prepend(child) { child._parent = this; this.children.unshift(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child._parent = null;
      return child;
    },
    replaceChildren(...kids) {
      for (const child of this.children) child._parent = null;
      this.children = [];
      for (const kid of kids) this.appendChild(kid);
    },
    remove() {
      if (this._parent) this._parent.removeChild(this);
    },
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      const list = this._listeners[type] || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    closest() { return null; },
    focus() {},
    blur() {},
    click() { this.__dispatch("click", fakeEvent("click")); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; },
    querySelector(sel) { return queryAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(this, sel); },
    __dispatch(type, event) { for (const fn of this._listeners[type] || []) fn(event); }
  };
  if (el._tag === "canvas") {
    el.getContext = (kind) => (kind === "2d" ? makeCtx2d(el) : null);
  }
  return el;
}

function fakeEvent(type, extra = {}) {
  return { type, preventDefault() {}, stopPropagation() {}, ...extra };
}

function matches(el, sel) {
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(sel)) return el._tag === sel.toLowerCase();
  return false;
}

function queryAll(rootEl, sel) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (matches(child, sel)) out.push(child);
      walk(child);
    }
  };
  walk(rootEl);
  return out;
}

function makeSandbox(knownIds) {
  const elements = new Map();
  const requested = new Set();
  const rafQueue = [];
  const timers = new Set();
  let rafId = 0;
  let now = 0;
  const store = new Map();

  const sandbox = {
    console,
    now: () => now,
    performance: { now: () => now },
    devicePixelRatio: 2,
    navigator: { maxTouchPoints: 0, userAgent: "GameHubTests" },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    setTimeout: (fn, ms, ...args) => {
      const id = setTimeout(fn, ms, ...args);
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); clearTimeout(id); },
    setInterval: (fn, ms, ...args) => {
      const id = setInterval(fn, ms, ...args);
      timers.add(id);
      return id;
    },
    clearInterval: (id) => { timers.delete(id); clearInterval(id); },
    requestAnimationFrame: (cb) => { rafQueue.push(cb); return ++rafId; },
    cancelAnimationFrame: () => {},
    location: { protocol: "https:", pathname: "/GameHub/", assign() {} },
    history: { replaceState() {} },
    document: null,
    window: null,
    __requested: requested,
    __rafQueue: rafQueue,
    __timers: timers,
    __advance(ms) { now += ms; }
  };

  const docListeners = {};
  const winListeners = {};
  const doc = {
    _listeners: docListeners,
    readyState: "loading",
    hidden: false,
    activeElement: null,
    documentElement: makeElement("html"),
    body: makeElement("body"),
    addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    removeEventListener() {},
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => {
      requested.add(id);
      return elements.get(id) || null;
    },
    querySelector: (sel) => {
      if (sel.startsWith("#")) return doc.getElementById(sel.slice(1));
      return queryAll(doc.body, sel)[0] || null;
    },
    querySelectorAll: (sel) => queryAll(doc.body, sel),
    __dispatch(type, event) { for (const fn of docListeners[type] || []) fn(event); }
  };
  const win = {
    _listeners: winListeners,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 2,
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
    removeEventListener() {},
    requestAnimationFrame: sandbox.requestAnimationFrame,
    cancelAnimationFrame: sandbox.cancelAnimationFrame,
    localStorage: sandbox.localStorage,
    performance: sandbox.performance,
    navigator: sandbox.navigator,
    __dispatch(type, event) { for (const fn of winListeners[type] || []) fn(event); }
  };
  sandbox.document = doc;
  sandbox.window = win;
  sandbox.globalThis = sandbox;

  for (const [id, tag] of knownIds) {
    const el = makeElement(tag, id);
    if (tag === "canvas") { el.width = 480; el.height = 640; }
    elements.set(id, el);
    doc.body.appendChild(el);
  }
  return { sandbox, elements };
}

function knownIdsFromHtml(html) {
  const ids = [];
  const seen = new Set();
  for (const match of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*\bid="([^"]+)"/g)) {
    if (!seen.has(match[2])) {
      seen.add(match[2]);
      ids.push([match[2], match[1].toLowerCase()]);
    }
  }
  return ids;
}

/* ---------------- Per-game run ---------------- */
const FRAME_BUDGET = 420;
const FRAME_MS = 1000 / 60;

async function runGame(slug) {
  ran++;
  const dir = path.join(gamesDir, slug, "play");
  const label = `game ${slug}`;
  try {
    const html = readFileSync(path.join(dir, "index.html"), "utf8");
    const js = readFileSync(path.join(dir, "game.js"), "utf8");
    const css = readFileSync(path.join(dir, "style.css"), "utf8");
    void css;

    const usesCanvas = /<canvas/i.test(html);
    const { sandbox, elements } = makeSandbox(knownIdsFromHtml(html));
    const context = vm.createContext(sandbox);
    vm.runInContext(js, context, { filename: `${slug}/game.js` });

    sandbox.document.__dispatch("DOMContentLoaded", fakeEvent("DOMContentLoaded"));
    sandbox.window.__dispatch("load", fakeEvent("load"));

    let frames = 0;
    let rafSeen = 0;
    const step = (n) => {
      for (let i = 0; i < n; i++) {
        const cb = sandbox.__rafQueue.shift();
        if (!cb) {
          sandbox.__advance(FRAME_MS);
          continue;
        }
        rafSeen++;
        sandbox.__advance(FRAME_MS);
        cb(sandbox.performance.now());
        frames++;
        if (frames > FRAME_BUDGET * 4) break;
      }
    };
    const key = (keyName, type = "keydown") => {
      const event = fakeEvent(type, { key: keyName, code: keyName, repeat: false });
      sandbox.window.__dispatch(type, event);
      sandbox.document.__dispatch(type, event);
    };
    const clickAll = (selector) => {
      for (const el of sandbox.document.querySelectorAll(selector)) el.click();
    };

    step(30);
    key("Enter"); step(20);
    key(" "); step(60);
    clickAll("button"); step(40);
    for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "p", "P", "Escape", "r", " ", "Enter"]) {
      key(k); step(8);
      key(k, "keyup"); step(4);
    }
    clickAll("button"); step(60);
    // Let pending timers fire at least once.
    await new Promise((done) => setTimeout(done, 30));
    step(60);

    const htmlIds = new Set(knownIdsFromHtml(html).map(([id]) => id));
    const unknown = [...sandbox.__requested].filter((id) => !htmlIds.has(id));
    t(`${label} runs without errors`, true);
    t(`${label} references only existing element ids`, unknown.length === 0, unknown.join(", "));
    if (usesCanvas) {
      t(`${label} drives frames via requestAnimationFrame`, rafSeen > 0);
    }
    // Buttons must exist for core flows (start/restart surfaced in UI).
    const buttons = sandbox.document.querySelectorAll("button");
    t(`${label} exposes buttons in play UI`, buttons.length > 0);
    void elements;
    for (const id of sandbox.__timers) {
      try { clearTimeout(id); clearInterval(id); } catch { /* noop */ }
    }
  } catch (error) {
    t(`${label} runs without errors`, false, String((error && error.stack) || error).split("\n").slice(0, 3).join(" | "));
  }
}

console.log(`Discovered ${slugs.length} playable game(s): ${slugs.join(", ") || "(none)"}`);
t("discovers all 36 play bundles", slugs.length === 36);
for (const slug of slugs) {
  await runGame(slug);
}

if (ran === 0) {
  console.error("No playable games discovered — expected games/<slug>/play/game.js files.");
  process.exit(1);
}
if (failures) {
  console.error(`\n${failures} FAILURE${failures === 1 ? "" : "S"}`);
  process.exit(1);
}
console.log(`\nALL GAME TESTS PASSED (${ran} games)`);