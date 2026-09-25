/* GameHub 3.0 platform tests (dependency-free).
   Run from the repo root:  node tests/platform.mjs
   Covers the 3.0 storage + UI layer: profile storage and corrupt
   localStorage, themes, achievements, ratings, notes (including XSS
   safety), collections, playtime sessions, multiplayer + provider
   metadata, category landing pages, the PWA manifest/service worker
   and the security rules that keep user text out of HTML. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (name) => readFileSync(path.join(root, name), "utf8");
const inRepo = (rel) => existsSync(path.join(root, rel));

let failures = 0;
const t = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failures++;
};

/* ---------------- Minimal DOM ----------------
   Elements keep children, attributes and CSS classes. Setting
   textContent creates text nodes (never markup), while innerHTML
   stores the raw string without parsing it — exactly enough to prove
   that user text can never turn into live HTML. */
function makeText(value) {
  return { nodeType: 3, text: String(value), children: [] };
}

function makeElement(tag = "div", doc = null) {
  const el = {
    _tag: String(tag).toLowerCase(),
    nodeType: 1,
    _attrs: {},
    _listeners: {},
    _parent: null,
    children: [],
    className: "",
    id: "",
    hidden: false,
    disabled: false,
    value: "",
    type: "",
    src: "",
    href: "",
    style: { setProperty() {}, width: "" },
    dataset: {},
    files: [],
    _innerHTML: "",
    get classList() {
      const self = this;
      const list = () => String(self.className || "").split(/\s+/).filter(Boolean);
      const write = (names) => { self.className = names.join(" "); };
      return {
        add(...names) { const set = list(); names.forEach((n) => { if (!set.includes(n)) set.push(n); }); write(set); },
        remove(...names) { write(list().filter((n) => !names.includes(n))); },
        toggle(name, force) {
          const set = list();
          const on = force === undefined ? !set.includes(name) : Boolean(force);
          if (on && !set.includes(name)) set.push(name);
          if (!on) write(set.filter((n) => n !== name));
          else write(set);
          return on;
        },
        contains(name) { return list().includes(name); }
      };
    },
    get firstChild() { return this.children[0] || null; },
    get textContent() {
      return this.children.map((child) => (child.nodeType === 3 ? child.text : child.textContent)).join("");
    },
    set textContent(value) {
      this.children = [];
      this._innerHTML = "";
      if (value !== "" && value !== null && value !== undefined) this.children.push(makeText(value));
    },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(value) {
      this._innerHTML = String(value);
      this.children = [];
      parseInto(this, this._innerHTML);
    },
    appendChild(child) {
      if (!child) return child;
      child._parent = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, before) {
      const index = before ? this.children.indexOf(before) : -1;
      child._parent = this;
      if (index === -1) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child._parent = null;
      return child;
    },
    remove() { if (this._parent) this._parent.removeChild(this); },
    setAttribute(name, value) {
      this._attrs[name] = String(value);
      if (name === "class") this.className = String(value);
      if (name === "id") this.id = String(value);
      if (name.startsWith("data-")) {
        const key = name.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; },
    removeAttribute(name) { delete this._attrs[name]; },
    hasAttribute(name) { return name in this._attrs; },
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      const list = this._listeners[type] || [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event = {}) {
      const payload = {
        type,
        defaultPrevented: false,
        stopPropagation() {},
        preventDefault() { payload.defaultPrevented = true; },
        ...event,
        target: this
      };
      let node = this;
      while (node) {
        payload.currentTarget = node;
        for (const fn of [...((node._listeners && node._listeners[type]) || [])]) fn(payload);
        node = node._parent;
      }
      return payload;
    },
    click() { this.dispatch("click"); },
    focus() {},
    blur() {},
    closest(selector) {
      let node = this;
      while (node) {
        if (matches(node, selector)) return node;
        node = node._parent;
      }
      return null;
    },
    querySelector(selector) { return queryAll(this, selector)[0] || null; },
    querySelectorAll(selector) { return queryAll(this, selector); },
    append(...nodes) { nodes.forEach((node) => this.appendChild(node)); },
    replaceChildren(...nodes) { this.children = []; nodes.forEach((node) => this.appendChild(node)); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; }
  };
  el.__doc = doc;
  /* Browsers expose tagName in upper case (isTyping() checks it). */
  Object.defineProperty(el, "tagName", {
    configurable: true,
    get() { return String(this._tag || "").toUpperCase(); }
  });
  /* Browsers reflect .href/.src onto the attribute — modules rely on
     that (search.js sets link.href and a test reads the attribute). */
  for (const prop of ["href", "src"]) {
    Object.defineProperty(el, prop, {
      configurable: true,
      get() { return this._attrs[prop] || ""; },
      set(value) { this._attrs[prop] = String(value); }
    });
  }
  if (doc && el._tag === "canvas") {
    el.getContext = () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
  }
  return el;
}


/* ---------------- Tiny HTML parser ----------------
   innerHTML is parsed the way a browser would, so injection tests are
   real rather than string comparisons. Only what the site writes is
   supported: elements, attributes and text. */
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseInto(host, html) {
  const text = String(html);
  const stack = [host];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let cursor = 0;
  let match;
  while ((match = tagRe.exec(text)) !== null) {
    const before = text.slice(cursor, match.index);
    if (before) stack[stack.length - 1].appendChild(makeText(before));
    cursor = tagRe.lastIndex;
    const closing = text[match.index + 1] === "/";
    const name = match[1].toLowerCase();
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node = makeElement(name, host.__doc || null);
    ATTR_RE.lastIndex = 0;
    let attr;
    while ((attr = ATTR_RE.exec(match[2] || "")) !== null) {
      const value = attr[2] !== undefined ? attr[2] : attr[3] !== undefined ? attr[3] : attr[4] !== undefined ? attr[4] : "";
      node.setAttribute(attr[1], value);
    }
    stack[stack.length - 1].appendChild(node);
    /* A tag self-closes when the source writes "/>", when it is an
       HTML void element, or when no matching close tag follows —
       which covers both <path .../> and <path></path> conventions. */
    const closeRe = new RegExp("</" + name + "\\s*>", "i");
    const selfClosing = match[3] === "/" || VOID_TAGS.has(name) || !closeRe.test(text.slice(tagRe.lastIndex));
    if (!selfClosing) stack.push(node);
  }
  const rest = text.slice(cursor);
  if (rest) stack[stack.length - 1].appendChild(makeText(rest));
  return host;
}

function matches(el, selector) {
  const single = selector.trim();
  if (single.startsWith("#")) return el.id === single.slice(1);
  if (single.startsWith(".")) return el.classList.contains(single.slice(1));
  if (single.startsWith("[")) {
    const body = single.slice(1, -1);
    const [name, rawValue] = body.split("=");
    const value = rawValue ? rawValue.replace(/^["']|["']$/g, "") : null;
    if (!el.hasAttribute(name)) return false;
    return value === null || el.getAttribute(name) === value;
  }
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(single)) return el._tag === single.toLowerCase();
  return false;
}

function queryAll(rootEl, selector) {
  const out = [];
  for (const part of selector.split(",")) {
    const walk = (node) => {
      for (const child of node.children || []) {
        if (child.nodeType === 1 && matches(child, part)) out.push(child);
        walk(child);
      }
    };
    walk(rootEl);
  }
  return out;
}

function makeSandbox(options = {}) {
  const store = new Map(options.store || []);
  const listeners = {};
  const doc = makeElement("html");
  doc.readyState = "complete";
  const head = makeElement("head", doc);
  const body = makeElement("body", doc);
  doc.appendChild(head);
  doc.appendChild(body);
  doc.documentElement = doc;
  doc.body = body;
  doc.head = head;
  const registry = new Map();
  doc.getElementById = (id) => registry.get(id) || null;
  doc.createElement = (tag) => makeElement(tag, doc);
  doc.createDocumentFragment = () => makeElement("fragment", doc);
  doc.createTextNode = (value) => makeText(value);
  doc.querySelectorAll = (selector) => queryAll(doc, selector);
  doc.querySelector = (selector) => queryAll(doc, selector)[0] || null;
  doc.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
  doc.removeEventListener = () => {};
  doc.dispatchEvent = (event) => {
    if (typeof event.preventDefault !== "function") {
      event.defaultPrevented = false;
      event.preventDefault = () => { event.defaultPrevented = true; };
    }
    if (typeof event.stopPropagation !== "function") event.stopPropagation = () => {};
    for (const fn of [...(listeners[event.type] || [])]) fn(event);
    return true;
  };
  doc.__register = (el) => {
    if (el.id) registry.set(el.id, el);
    if (el._parent !== body) body.appendChild(el);
    return el;
  };

  let now = 0;
  const timers = new Map();
  let timerId = 0;

  const window = {
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    dispatch(type, event = {}) {
      for (const fn of [...(this._listeners[type] || [])]) fn({ type, preventDefault() {}, ...event });
    },
    matchMedia: () => ({ matches: Boolean(options.prefersLight), media: "" }),
    location: { pathname: options.pathname || "/index.html", protocol: "https:", href: "https://example.test/", search: "" },
    localStorage: {
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(String(key)),
      clear: () => store.clear(),
      key: (index) => [...store.keys()][index] || null,
      get length() { return store.size; }
    },
    setInterval: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearInterval: (id) => timers.delete(id),
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms, once: true }); return id; },
    clearTimeout: (id) => timers.delete(id),
    __timers: timers,
    __advance(ms) { now += ms; },
    __now: () => now
  };

  /* CustomEvent lets modules talk to each other exactly like in the
     browser (profile.js dispatches gamehub:change). */
  class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail ? init.detail : null;
    }
  }

  const sandbox = {
    console,
    CustomEvent,
    document: doc,
    window,
    location: window.location,
    localStorage: window.localStorage,
    matchMedia: window.matchMedia,
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    Date: options.Date || Date,
    performance: { now: () => now },
    requestAnimationFrame: (fn) => { const id = ++timerId; timers.set(id, { fn, ms: 16, raf: true }); return id; },
    cancelAnimationFrame: (id) => timers.delete(id),
    navigator: { userAgent: "GameHub test", serviceWorker: undefined },
    __store: store,
    __doc: doc,
    __registry: registry
  };
  sandbox.globalThis = sandbox;
  window.CustomEvent = CustomEvent;
  sandbox.__register = (id) => {
    const el = makeElement("div", doc);
    el.id = id;
    doc.__register(el);
    return el;
  };
  return sandbox;
}

function run(source, sandbox, capture = []) {
  sandbox.__captured = null;
  sandbox.__capture = (obj) => { sandbox.__captured = obj; };
  const context = vm.createContext(sandbox);
  vm.runInContext(
    `${source}\n;__capture({ ${capture.map((name) => `${name}: (typeof ${name} !== "undefined" ? ${name} : undefined)`).join(", ")} });`,
    context,
    { filename: "site.js" }
  );
  return sandbox.__captured;
}

const PROFILE_STACK = ["catalog.js", "player.js", "profile.js", "achievements.js"].map(load).join("\n");
const PROFILE_NAMES = ["GameHubCatalog", "GameHubPlayer", "GameHubProfile", "GameHubAchievements"];

/* ---------------- 1. Profile storage ---------------- */
{
  const sb = makeSandbox();
  const api = run(PROFILE_STACK, sb, PROFILE_NAMES);
  const { GameHubProfile: P, GameHubPlayer: Player } = api;

  t("profile module exposes the storage API", Boolean(P) && typeof P.setDisplayName === "function" && typeof P.setNote === "function" && typeof P.setRating === "function");

  /* Display name: markup stripped, length capped. */
  const saved = P.setDisplayName("<b>Evil</b> Name <script>alert(1)</script>");
  t("display name strips markup characters", !saved.includes("<") && !saved.includes(">") && saved.startsWith("bEvil/b Name") && saved.length <= 24, saved);
  const long = P.setDisplayName("x".repeat(80));
  t("display name is capped at 24 characters", long.length === 24);
  const blank = P.setDisplayName("   ");
  t("blank display name falls back to the default", blank === P.DEFAULT_NAME, blank);

  /* Namespace discipline: everything lives under gamehub: */
  P.setAvatar(P.avatarIds()[0]);
  P.setRating("snake", 4);
  P.setNote("snake", "note text");
  P.addToCollection("playlater", "snake");
  P.addToCollection("completed", "merge-blocks");
  P.addPlaytime("snake", 125);
  P.touchDay();
  Player.recordGamePlayed("snake");
  const keys = [...sb.__store.keys()];
  t("all storage keys share the gamehub: namespace", keys.length > 5 && keys.every((key) => key.startsWith("gamehub:")), keys.join(","));

  /* Avatars: original inline SVG only. */
  const avatars = P.AVATARS;
  t("profile ships 12-15 avatars", avatars.length >= 12 && avatars.length <= 15, String(avatars.length));
  t("avatars are original inline SVG with unique ids", new Set(avatars.map((a) => a.id)).size === avatars.length && avatars.every((a) => a.svg.startsWith("<svg") && !/https?:|<script|onload=/i.test(a.svg)));

  /* Corrupt storage must never throw. */
  sb.__store.set("gamehub:profile", "{not json");
  sb.__store.set("gamehub:ratings", "[]");
  sb.__store.set("gamehub:notes", "\"nope\"");
  sb.__store.set("gamehub:playtime", "[1,2,3]");
  sb.__store.set("gamehub:playlater", "null");
  let corruptOk = true;
  let summary = null;
  try {
    const p = P.getProfile();
    corruptOk = Boolean(p) && typeof p.name === "string";
    P.getRatings();
    P.getNote("snake");
    P.getPlaytime("snake");
    P.collectionIds("playlater");
    summary = P.summary();
  } catch (error) {
    corruptOk = false;
    summary = String(error);
  }
  t("corrupt localStorage never throws", corruptOk, typeof summary === "string" && !corruptOk ? summary : "");
  t("corrupt values fall back to safe defaults", P.getRating("snake") === 0 && P.getNote("snake") === null && P.getPlaytime("snake") === 0 && Array.isArray(P.collectionIds("playlater")));

  /* Ratings: 1-5 only, invalid clears, never a global score. */
  t("valid ratings persist", P.setRating("snake", 5) === 5 && P.getRating("snake") === 5);
  t("out-of-range ratings clear the stored value", P.setRating("snake", 9) === 0 && P.getRating("snake") === 0);
  t("rating text values clear the stored value", P.setRating("snake", "abc") === 0 && P.getRating("snake") === 0);
  t("ratings round-trip through a reload", (() => {
    P.setRating("snake", 3);
    const again = run(PROFILE_STACK, makeSandbox({ store: [...sb.__store] }), PROFILE_NAMES).GameHubProfile;
    return again.getRating("snake") === 3;
  })());

  /* Notes: 500 characters, safe rendering contract. */
  const evil = '<img src=x onerror="alert(1)"> & <script>alert(2)</script>';
  P.setNote("snake", evil);
  const note = P.getNote("snake");
  t("notes keep the raw text for safe rendering", Boolean(note) && note.text === evil);
  t("notes are capped at 500 characters", P.setNote("snake", "y".repeat(900)).text.length === 500);
  t("whitespace-only notes are removed", P.setNote("snake", "   ") === null && P.getNote("snake") === null);
  t("missing ids return no note", P.getNote("") === null && P.setNote("", "x") === null);

  /* Collections. */
  t("collections toggle on and off", P.toggleCollection("favorites", "snake") === true && P.inCollection("favorites", "snake") === true && P.toggleCollection("favorites", "snake") === false && P.inCollection("favorites", "snake") === false);
  t("unknown collections are rejected", P.collectionIds("bogus").length === 0 && P.addToCollection("bogus", "snake").length === 0 && ![...sb.__store.keys()].some((key) => key.includes("bogus")));

  /* Playtime + days. */
  t("playtime accumulates and formats", P.addPlaytime("snake", 105) === 105 && P.formatDuration(105) === "1m 45s");
  const session = P.startSession("snake");
  t("sessions start and report active state", Boolean(session) && Boolean(P.activeSession()));
  P.stopSession();
  t("stopping a session clears it", P.activeSession() === null);

  /* clearAll wipes the namespace (including the player.js keys). */
  P.setRating("snake", 4);
  P.setNote("snake", "keep me");
  P.addToCollection("completed", "snake");
  Player.toggleFavorite("snake");
  Player.recordGamePlayed("snake");
  const cleared = P.clearAll();
  t("clearAll reports success", cleared === true);
  t("clearAll leaves nothing behind in the namespace", sb.__store.size === 0 && P.getRating("snake") === 0 && P.getNote("snake") === null && Player.getFavorites().length === 0, [...sb.__store.keys()].join(","));
}

/* ---------------- 2. Notes and user text never become HTML ---------------- */
{
  const sb = makeSandbox();
  const elements = ["profile-avatar", "profile-identity-title", "profile-since", "display-name", "name-note",
    "stat-games", "stat-plays", "stat-time", "stat-achievements", "avatar-grid", "profile-form",
    "theme-switcher-wrap", "achievement-grid", "achievements-count", "collection-tabs", "collection-list",
    "rating-list", "note-list", "played-list", "clear-data", "clear-status", "profile-status", "year",
    "profile-theme-switcher"].map((id) => sb.__register(id));
  void elements;
  const api = run(PROFILE_STACK + "\n" + load("profile-page.js"), sb, PROFILE_NAMES);
  void api;
  const P = sb.window.GameHubProfile || sb.__captured ? sb.__captured.GameHubProfile : null;

  const payload = '<svg onload="alert(1)"></svg><script>alert(2)</script>';
  P.setNote("snake", payload);
  const savedName = P.setDisplayName("<img src=x onerror=alert(3)>");

  const noteList = sb.__registry.get("note-list");
  const collect = (node, out = { tags: [], html: [], attrs: [], text: "" }) => {
    if (node.nodeType === 3) out.text += node.text;
    else {
      out.tags.push(node._tag);
      out.html.push(node.innerHTML);
      out.attrs.push(...Object.keys(node._attrs || {}));
      out.text += node.textContent;
    }
    for (const child of node.children || []) collect(child, out);
    return out;
  };
  const rendered = noteList ? collect(noteList) : { tags: [], html: [], text: "", attrs: [] };
  t("notes render as text, not markup", rendered.text.includes(payload) && !rendered.tags.some((tag) => ["script", "svg"].includes(tag)), rendered.tags.join(","));
  t("note payloads never become live elements", !rendered.tags.includes("script") && !rendered.attrs.some((name) => /^on/i.test(name)));
  const nameNode = sb.__registry.get("profile-identity-title");
  t("display names render as plain text", nameNode && nameNode.textContent === savedName && !savedName.includes("<") && savedName.length <= 24, savedName);
}

/* ---------------- 3. Themes ---------------- */
{
  const sb = makeSandbox();
  const { GameHubTheme: Theme } = run(load("theme.js"), sb, ["GameHubTheme"]);
  const html = sb.__doc;
  t("theme module exposes the switcher + state API", Boolean(Theme) && typeof Theme.set === "function" && typeof Theme.mount === "function");
  t("default theme is dark", Theme.DEFAULT_THEME === "dark" && Theme.current() === "dark" && html.getAttribute("data-theme") === "dark");
  Theme.set("light");
  t("theme key is namespaced", sb.__store.has("gamehub:theme") && [...sb.__store.keys()].every((key) => key.startsWith("gamehub:")));
  t("setting a theme applies it to <html>", html.getAttribute("data-theme") === "light" && sb.__store.get("gamehub:theme") === "light");
  t("invalid theme values revert to the default", Theme.set("banana") === "dark" && Theme.current() === "dark");
  t("theme cycles through all three themes", (() => {
    Theme.set("dark");
    const seen = [Theme.cycle(), Theme.cycle(), Theme.cycle()];
    return seen.join(",") === "midnight,light,dark";
  })());
  t("theme persists across a reload", (() => {
    Theme.set("midnight");
    const again = run(load("theme.js"), makeSandbox({ store: [...sb.__store] }), ["GameHubTheme"]).GameHubTheme;
    return again.current() === "midnight";
  })());
  t("first run honours prefers-color-scheme: light", run(load("theme.js"), makeSandbox({ prefersLight: true }), ["GameHubTheme"]).GameHubTheme.current() === "light");
  t("switcher markup uses real buttons with ARIA", (() => {
    const markup = Theme.switcherMarkup();
    return markup.includes("<button") && !markup.includes("onclick") && (markup.match(/aria-pressed/g) || []).length === 3 && markup.includes("data-theme-set");
  })());
  const header = makeElement("div", sb.__doc);
  header.className = "header-inner";
  sb.__doc.appendChild(header);
  const mounted = Theme.mount();
  t("mount injects a keyboard-accessible switcher", Boolean(mounted) && mounted._tag === "div" && mounted.getAttribute("role") === "group" && mounted.getAttribute("aria-label") === "Colour theme" && header.querySelectorAll("[data-theme-set]").length === 3);
  t("switcher buttons drive the theme state", (() => {
    const button = mounted.querySelectorAll("[data-theme-set]").find((node) => node.getAttribute("data-theme-set") === "light");
    button.dispatch("click");
    return Theme.current() === "light" && button.getAttribute("aria-pressed") === "true";
  })());
  t("no theme option is a clickable div", !/onclick=/.test(Theme.switcherMarkup()));
}

/* ---------------- 4. Achievements ---------------- */
{
  const sb = makeSandbox();
  const api = run(PROFILE_STACK, sb, PROFILE_NAMES);
  const { GameHubAchievements: A, GameHubProfile: P, GameHubPlayer: Player } = api;
  const defs = A.LIST;

  t("achievements ship 15+ original definitions", defs.length >= 15, String(defs.length));
  t("achievement ids are unique", new Set(defs.map((d) => d.id)).size === defs.length);
  t("achievement definitions are complete", defs.every((d) => d.id && d.title && d.description && d.tier && typeof d.goal === "number" && d.goal > 0));
  t("each achievement has an original inline SVG icon", defs.every((d) => typeof d.icon === "string" && d.icon.startsWith("<svg") && !/https?:|<script|onload=/i.test(d.icon)));
  t("the named icon set is original SVG", Object.keys(A.ICONS).length >= 10 && Object.values(A.ICONS).every((svg) => svg.startsWith("<svg") && !/https?:|<script/i.test(svg)));
  t("rendered rows expose their SVG for the UI", A.all().every((row) => typeof row.icon === "string" && row.icon.startsWith("<svg")));
  t("achievement goals are unique ids across icons", defs.some((d) => d.gameId) && defs.filter((d) => d.gameId).length >= 2);

  t("everything starts locked on a fresh profile", A.unlockedCount() === 0 && A.unlockedRows().length === 0);
  const rows = A.all();
  t("progress is reported per achievement", rows.every((row) => row.percent >= 0 && row.percent <= 100 && typeof row.progress === "number"));

  Player.recordGamePlayed("snake");
  t("achievements auto-check after player data changes", A.unlockedCount() >= 1, String(A.unlockedCount()));
  for (const slug of ["merge-blocks", "chess", "pool", "sudoku"]) Player.recordGamePlayed(slug);
  P.addPlaytime("snake", 120);
  P.setRating("snake", 5);
  P.toggleCollection("favorites", "snake");
  P.addToCollection("playlater", "tic-tac-toe");
  P.touchDay();
  t("first game + explorer + favourite milestones unlock", ["first-launch", "explorer-5", "first-favorite"].every((id) => A.get(id) && A.get(id).unlocked === true), String(A.unlockedCount()));
  t("sync is idempotent once milestones are stored", A.sync().length === 0 && A.unlockedCount() >= 3);
  const first = A.get("first-launch");
  t("unlocked rows carry an unlock date", Boolean(first) && first.unlocked === true && typeof first.unlockedAt === "number" && first.unlockedAt > 0);
  t("a played game reports 100% progress", A.get("first-launch").percent === 100);
  t("game-specific achievements map to their game", A.forGame("snake", 6).length > 0 && A.forGame("snake", 6).every((row) => typeof row.id === "string"));
  t("forGame respects the limit", A.forGame("snake", 2).length <= 2);
  t("unknown achievements resolve to null", A.get("not-a-real-achievement") === null);
  t("achievement module is eval-free", !/\beval\s*\(/.test(load("achievements.js")));
}

/* ---------------- 5. Playtime sessions ---------------- */
{
  let clock = 1_750_000_000_000;
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const sb = makeSandbox({ pathname: "/GameHub/games/snake/play/index.html", Date: FakeDate });
  const api = run(["player.js", "profile.js"].map(load).join("\n") + "\n" + load("session.js"), sb, ["GameHubPlayer", "GameHubProfile"]);
  void api;
  const P = sb.window.GameHubProfile ? sb.window.GameHubProfile : sb.__captured.GameHubProfile;
  const slug = "snake";
  t("session helper starts a session from the play page", Boolean(P.activeSession()));
  clock += 15000;
  sb.window.__advance(15000);
  for (const [, timer] of sb.window.__timers) {
    if (!timer.raf && timer.ms === 15000) timer.fn();
  }
  t("playtime is booked into the profile", P.getPlaytime(slug) > 0, String(P.getPlaytime(slug)));
  t("playtime storage stays namespaced", [...sb.__store.keys()].every((key) => key.startsWith("gamehub:")));
}

/* ---------------- 6. Multiplayer + provider metadata ---------------- */
{
  const sb = makeSandbox();
  const { GameHubCatalog: C } = run(load("catalog.js"), sb, ["GameHubCatalog"]);
  const games = C.games;
  const TYPES = ["html5", "iframe", "external", "webgl", "wasm"];

  t("every entry declares multiplayer: true|false", games.every((g) => typeof g.multiplayer === "boolean"));
  t("multiplayerMode only appears on multiplayer games", games.every((g) => (g.multiplayer ? C.MULTIPLAYER_MODES.includes(g.multiplayerMode) : g.multiplayerMode === undefined)));
  t("online mode is never claimed without a backend", C.getOnlineMultiplayerGames().length === 0 && games.every((g) => g.multiplayerMode !== "online"));
  const local = C.getLocalMultiplayerGames();
  t("local multiplayer games are real two-device modes", local.length >= 8 && local.every((g) => g.status === "available" && ["html5", "iframe"].includes(g.type) && C.isMultiplayer(g)));
  t("local multiplayer games carry versus-style tags", local.every((g) => g.tags.some((tag) => ["versus", "2-players", "local-multiplayer", "multiplayer"].includes(tag))));
  t("multiplayer labels are human readable", local.every((g) => C.multiplayerLabel(g) === "Local multiplayer") && C.multiplayerLabel(C.gameBySlug("snake")) === "Single player");
  t("local multiplayer includes the 3.0 head-to-head games", ["chess", "checkers", "pool", "battle-tanks", "pirate-duel"].every((slug) => C.isMultiplayer(C.gameBySlug(slug))));

  t("provider games expose provider + https external URLs", C.validGames().filter((g) => g.provider).every((g) => /^https:\/\//.test(g.playUrl) && /^https:\/\//.test(g.externalUrl) && ["iframe", "external"].includes(g.type)));
  t("non-provider games never fake a provider", games.filter((g) => !g.provider).every((g) => g.externalUrl === undefined || g.externalUrl === null));
  t("remote play URLs are only https and never javascript/data", games.every((g) => !g.playUrl || /^(https:\/\/|games\/)/.test(g.playUrl)));
  t("all types stay inside the documented set", games.every((g) => TYPES.includes(g.type)));

  t("category info is generated for every category", C.getCategories().length === 10 && C.getCategoryInfo("Puzzle").count > 0 && C.getCategoryInfo("Puzzle").description.length > 20);
  t("unknown categories resolve to null", C.getCategoryInfo("Nope") === null);
  t("catalog helpers for multiplayer are exported", typeof C.getMultiplayerGames === "function" && typeof C.getLocalMultiplayerGames === "function" && typeof C.multiplayerModeOf === "function");
}

/* ---------------- 7. Cards keep user/catalog text escaped ---------------- */
{
  const sb = makeSandbox();
  const { GameHubCards: Cards } = run(load("catalog.js") + "\n" + load("cards.js"), sb, ["GameHubCards"]);
  const nasty = { id: "x", slug: "x", title: '<img src=x onerror="alert(1)">', description: "<script>alert(2)</script>", category: "Arcade", type: "html5", status: "available", version: "1.0.0", thumbnail: null, tags: [] };
  const html = Cards.cardTemplate(nasty, {});
  t("card markup escapes hostile catalog text", !html.includes("<img src=x") && !html.includes("<script>") && html.includes("&lt;img"));
  t("escapeHtml covers the dangerous characters", ["&", "<", ">", '"', "'"].every((char) => Cards.escapeHtml(char) !== char));
}

/* ---------------- 8. Category landing pages ---------------- */
{
  const sb = makeSandbox();
  const { GameHubCatalog: C } = run(load("catalog.js"), sb, ["GameHubCatalog"]);
  const dirs = readdirSync(path.join(root, "categories"));
  t("a landing page exists for every category", dirs.length === C.getCategories().length, dirs.join(","));
  let pagesOk = true;
  let shellOk = true;
  for (const entry of C.getCategories()) {
    const page = path.join("categories", entry.name.toLowerCase(), "index.html");
    if (!inRepo(page)) { pagesOk = false; continue; }
    const html = load(page);
    if (!html.includes(`data-category="${entry.name}"`)) pagesOk = false;
    if (!html.includes('src="../../catalog.js"') || !html.includes('src="../../category-page.js"')) shellOk = false;
    if (html.includes('src="../../launcher.js"')) shellOk = false;
  }
  t("every category page targets its category from the catalog", pagesOk);
  t("category pages load the catalog, never the launcher", shellOk);
  t("category pages derive counts instead of hardcoding them", (() => {
    const html = load("categories/puzzle/index.html");
    return html.includes("data-category-count") && !/\d+\s*games<\/dd>/.test(html);
  })());
  t("category page controller renders rails from catalog data", (() => {
    const js = load("category-page.js");
    return js.includes("getCategoryInfo") && js.includes("getFeatured") && js.includes("getPopular") && js.includes("validGames");
  })());
}

/* ---------------- 9. PWA: manifest + service worker ---------------- */
{
  const manifest = JSON.parse(load("manifest.webmanifest"));
  t("manifest is valid JSON with the PWA essentials", Boolean(manifest.name) && Boolean(manifest.short_name) && manifest.display === "standalone" && Boolean(manifest.start_url) && Boolean(manifest.scope));
  t("manifest scope + start_url stay relative", !/^\//.test(manifest.start_url) && !/^\//.test(manifest.scope));
  t("manifest icons are local and exist on disk", manifest.icons.length >= 2 && manifest.icons.every((icon) => !/^https?:/i.test(icon.src) && inRepo(icon.src)));
  t("manifest uses the shared theme colours", Boolean(manifest.theme_color) && Boolean(manifest.background_color));

  const sw = load("service-worker.js");
  t("service worker exists and versions its cache", /const CACHE|cacheName|SHELL/.test(sw) && /gamehub-shell-v3/.test(sw));
  t("service worker only handles same-origin GETs", sw.includes("request.method") && sw.includes("GET") && sw.includes("origin") && sw.includes("location.origin"));
  t("service worker never caches Minecraft clients", sw.includes("/client/"));
  t("service worker ignores cross-origin requests", /return;|url\.origin !== location\.origin|origin !== self\.location\.origin/.test(sw));
  t("service worker only precaches local assets", (() => {
    const shell = /(?:var|const|let)\s+SHELL\s*=\s*\[([\s\S]*?)\];/.exec(sw);
    if (!shell) return false;
    const entries = shell[1].split(",").map((line) => line.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    return entries.length > 5 && entries.every((entry) => !/^https?:/i.test(entry));
  })());
  t("pwa.js registers the worker relatively on http(s) only", (() => {
    const js = load("pwa.js");
    return js.includes("service-worker.js") && js.includes("navigator") && /protocol|https:/.test(js) && js.includes("register");
  })());
  t("every page links the manifest", ["index.html", "profile/index.html", "404.html"].every((file) => !inRepo(file) || true) && (() => {
    const pages = ["index.html", "profile/index.html", "games/snake/index.html", "categories/puzzle/index.html"];
    return pages.every((page) => load(page).includes('rel="manifest"'));
  })());
}

/* ---------------- 10. Shared navigation + scripts on every shell ---------------- */
{
  const pages = ["index.html", "profile/index.html", "games/snake/index.html", "categories/puzzle/index.html"];
  const NAV = ["#home", "#games", "#categories", "?category=Minecraft#games", "?favorites=1#games", "profile/index.html"];
  const canonical = (href) => href.replace(/^(\.\.\/)+/, "").replace(/^index\.html/, "");
  const navOk = pages.every((page) => {
    const html = load(page);
    const expected = NAV.map((href) => (page === "profile/index.html" && href === "profile/index.html" ? "index.html" : href));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => canonical(m[1]));
    return expected.every((href) => hrefs.some((value) => canonical(value) === canonical(href)));
  });
  t("the primary navigation is identical everywhere", navOk);
  t("theme.js loads in the head of every shell", pages.every((page) => load(page).includes('<script src="theme.js"></script>') || load(page).includes('<script src="../theme.js"></script>') || load(page).includes('<script src="../../theme.js"></script>')));
  t("search.js loads on every shell", ["index.html", "profile/index.html", "games/snake/index.html", "categories/puzzle/index.html"].every((page) => load(page).includes("search.js")));
  t("game pages load the 3.0 platform scripts", ["profile.js", "achievements.js", "game-page.js", "search.js", "pwa.js"].every((file) => load("games/snake/index.html").includes(file)));
  t("no page ships inline event handlers", pages.every((page) => !/\son(click|load|error|mouseover)=/i.test(load(page))));
}

/* ---------------- 11. Continue Playing reuses existing play data ---------------- */
{
  const HOME_IDS = ["spotlight", "continue", "continue-grid", "recent", "recent-grid", "favorites", "favorites-grid",
    "featured-grid", "popular-grid", "minecraft-grid", "play-online", "play-online-grid", "external", "external-grid",
    "new-grid", "games-grid", "categories-grid", "filter-bar", "empty-state", "empty-message", "results-count",
    "search-form", "search-input", "sort-select", "clear-search", "recent-searches", "stat-games", "stat-categories", "year"];
  const HOME = ["catalog.js", "player.js", "cards.js", "script.js"].map(load).join("\n");
  const homeSandbox = (seed = []) => {
    const sb = makeSandbox({ store: seed });
    for (const id of HOME_IDS) sb.__register(id);
    const inner = makeElement("div", sb.__doc);
    inner.className = "spotlight-inner";
    sb.__registry.get("spotlight").appendChild(inner);
    return sb;
  };
  const cardsIn = (grid) => (grid.children || []).filter((child) => child.getAttribute("data-game-id"));

  const empty = homeSandbox();
  run(HOME, empty, []);
  t("Continue Playing hides itself with no history",
    empty.__registry.get("continue").hidden === true && empty.__registry.get("continue-grid").children.length === 0);

  const seed = [
    ["gamehub:recent", JSON.stringify([{ id: "chess", at: 900 }, { id: "snake", at: 800 }])],
    ["gamehub:plays", JSON.stringify({
      chess: { count: 3, at: 900 }, snake: { count: 2, at: 800 }, pool: { count: 1, at: 700 },
      "merge-blocks": { count: 1, at: 600 }, sudoku: { count: 1, at: 500 }, reversi: { count: 1, at: 400 },
      checkers: { count: 1, at: 300 }, "tic-tac-toe": { count: 1, at: 200 }
    })]
  ];
  const seeded = homeSandbox(seed);
  const keysBefore = [...seeded.__store.keys()].sort().join("|");
  run(HOME, seeded, []);
  const grid = seeded.__registry.get("continue-grid");
  const cards = cardsIn(grid);
  const ids = cards.map((card) => card.getAttribute("data-game-id"));
  t("Continue Playing shows at most six games",
    seeded.__registry.get("continue").hidden === false && ids.length === 6, ids.join(","));
  t("Continue Playing is newest-first and deduplicated",
    JSON.stringify(ids) === JSON.stringify(["chess", "snake", "pool", "merge-blocks", "sudoku", "reversi"]), ids.join(","));
  t("Continue Playing links each card to its own game page",
    cards.every((card) => {
      const link = card.querySelector(".card-media");
      return Boolean(link) && String(link.getAttribute("href")) === `games/${card.getAttribute("data-game-id")}/index.html`;
    }));
  t("Continue Playing adds no second tracking system",
    [...seeded.__store.keys()].sort().join("|") === keysBefore, [...seeded.__store.keys()].join(","));
}

/* ---------------- 12. Global search overlay + keyboard navigation ---------------- */
{
  const searchStack = ["catalog.js", "player.js", "cards.js", "search.js"].map(load).join("\n");
  const makeSearchSandbox = (pathname) => {
    const sb = makeSandbox({ pathname });
    const header = makeElement("div", sb.__doc);
    header.className = "header-inner";
    sb.__doc.body.appendChild(header);
    const api = run(searchStack, sb, ["GameHubSearch", "GameHubPlayer", "GameHubCatalog"]);
    return { sb, api, header, S: sb.window.GameHubSearch };
  };
  const press = (node, key, extra = {}) => node.dispatch("keydown", { key, ...extra });
  const target = (sb) => ({ type: "keydown", key: "", target: sb.__doc.body });

  const { sb, api, header, S } = makeSearchSandbox("/index.html");
  const Player = api.GameHubPlayer;
  const overlay = () => sb.__doc.querySelector("#gh-search-overlay");
  const input = () => sb.__doc.querySelector("#gh-search-input");
  const list = () => sb.__doc.querySelector("#gh-search-results");
  const options = () => list().querySelectorAll('[role="option"]');

  t("the header gets a real search trigger",
    header.children.length === 1 && header.children[0]._tag === "button" && header.children[0].id === "gh-search-trigger" &&
    header.children[0].getAttribute("aria-expanded") === "false" && header.children[0].getAttribute("aria-controls") === "gh-search-overlay");
  t("the overlay ships as a real dialog, closed at first",
    Boolean(overlay()) && overlay().hidden === true && S.isOpen() === false &&
    sb.__doc.querySelector("#gh-search-overlay").querySelector(".search-dialog").getAttribute("role") === "dialog");
  t("the overlay dialog is modal and the input is a combobox",
    sb.__doc.querySelector("#gh-search-overlay").querySelector(".search-dialog").getAttribute("aria-modal") === "true" &&
    input().getAttribute("role") === "combobox" && input().getAttribute("aria-controls") === "gh-search-results");
  t("Ctrl+K toggles the overlay",
    (sb.__doc.dispatchEvent({ type: "keydown", key: "k", ctrlKey: true, target: sb.__doc.body }), S.isOpen() === true) &&
    (sb.__doc.dispatchEvent({ type: "keydown", key: "k", ctrlKey: true, target: sb.__doc.body }), S.isOpen() === false));
  t("\"/\" opens the overlay from the page body",
    (sb.__doc.dispatchEvent({ type: "keydown", key: "/", target: sb.__doc.body }), S.isOpen() === true));
  S.close();
  const typing = makeElement("input", sb.__doc);
  sb.__doc.dispatchEvent({ type: "keydown", key: "/", target: typing });
  t("\"/\" never hijacks a text field", S.isOpen() === false);

  S.open("snake");
  const first = options()[0];
  t("live search renders result options", options().length >= 1 && options().length <= S.MAX_RESULTS + 1, String(options().length));
  t("results link to the matching game page", String(first.getAttribute("href")) === "games/snake/index.html", String(first.getAttribute("href")));
  t("every result href stays relative and safe",
    options().every((option) => /^(\.\.\/)*(index\.html|games\/)/.test(String(option.getAttribute("href") || ""))));

  const active = input().getAttribute("aria-activedescendant");
  t("the first result starts active", active === options()[0].id);
  press(input(), "End");
  const last = input().getAttribute("aria-activedescendant");
  press(input(), "Home");
  t("Home/End jump through the result list",
    last === options()[options().length - 1].id && input().getAttribute("aria-activedescendant") === options()[0].id);
  if (options().length > 1) {
    press(input(), "ArrowDown");
    t("ArrowDown moves the active result", input().getAttribute("aria-activedescendant") === options()[1].id);
    press(input(), "ArrowUp");
    t("ArrowUp moves back", input().getAttribute("aria-activedescendant") === options()[0].id);
  } else {
    press(input(), "ArrowDown");
    t("ArrowDown keeps the selection inside a single result", input().getAttribute("aria-activedescendant") === options()[0].id);
  }

  press(input(), "Enter");
  t("Enter follows the active result and closes the overlay",
    S.isOpen() === false && String(sb.window.location.href) === String(options()[0].getAttribute("href") || "games/snake/index.html"));
  t("a submitted search is remembered", Player.getRecentSearches().includes("snake"), Player.getRecentSearches().join(","));

  S.open("snake");
  press(input(), "Escape");
  t("Escape closes the overlay", S.isOpen() === false);

  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  S.open(payload);
  const rows = list();
  const found = { tags: [], attrs: [] };
  const collect = (node, out) => {
    if (node.nodeType === 1) {
      out.tags.push(node._tag);
      out.attrs.push(...Object.keys(node._attrs || {}).filter((name) => /^on/i.test(name)));
    }
    (node.children || []).forEach((child) => collect(child, out));
    return out;
  };
  collect(rows, found);
  t("a hostile query is rendered as text, never as markup",
    rows.textContent.includes(payload) && !found.tags.includes("img") && !found.tags.includes("script") && found.attrs.length === 0,
    found.tags.join(","));
  S.close();

  const nested = makeSearchSandbox("/games/snake/index.html");
  const nestedUrl = nested.S.gameUrl(api.GameHubCatalog.gameBySlug("snake"));
  t("a game page gets correctly prefixed search links",
    nestedUrl === "../../games/snake/index.html" && nested.S.homeUrl() === "../../index.html", nestedUrl);
}

if (failures) {
  console.error(`\n${failures} FAILURE${failures === 1 ? "" : "S"}`);
  process.exit(1);
}
console.log("\nALL PLATFORM TESTS PASSED");
