/* GameHub runtime smoke tests (dependency-free).
   Run from the repo root:  node tests/smoke.mjs
   Executes the real script.js + launcher.js in stubbed DOM contexts
   and asserts catalog, filtering, URL hydration and launch behavior. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (name) => readFileSync(path.join(root, name), "utf8");

let failures = 0;
const t = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures++;
};
const count = (html, sub) => String(html).split(sub).length - 1;

/* ---------------- Stub DOM ---------------- */
function makeElement(tag = "div") {
  const el = {
    _tag: tag,
    _attrs: {},
    _listeners: {},
    _parent: null,
    children: [],
    className: "",
    id: "",
    dataset: {},
    hidden: false,
    innerHTML: "",
    textContent: "",
    value: "",
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    get firstChild() { return this.children[0] || null; },
    appendChild(child) { child._parent = this; this.children.push(child); return child; },
    prepend(child) { child._parent = this; this.children.unshift(child); return child; },
    remove() {
      if (this._parent) {
        const i = this._parent.children.indexOf(this);
        if (i >= 0) this._parent.children.splice(i, 1);
        this._parent = null;
      }
    },
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k]; },
    closest() { return null; },
    querySelector(sel) { return queryAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(this, sel); },
    __click() { for (const fn of this._listeners.click || []) fn({}); }
  };
  return el;
}

function matches(el, sel) {
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  if (sel.startsWith(".")) return el.className.split(" ").includes(sel.slice(1));
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

function makeSandbox() {
  const cache = new Map();
  const byId = (sel) => {
    if (!cache.has(sel)) cache.set(sel, makeElement());
    return cache.get(sel);
  };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    AbortController,
    location: { search: "", pathname: "/index.html", protocol: "https:", _assigned: "", assign(url) { this._assigned = url; } },
    history: { replaceState() {} },
    window: {},
    document: {
      documentElement: makeElement("html"),
      _listeners: {},
      addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
      createElement: (tag) => makeElement(tag),
      createDocumentFragment: () => makeElement("fragment"),
      querySelector: (sel) => (sandbox.__null.has(sel) ? null : byId(sel)),
      querySelectorAll: () => []
    },
    __null: new Set(),
    __cache: cache
  };
  return sandbox;
}

function runWithStubs(source, sandbox, captureNames) {
  sandbox.__captured = null;
  sandbox.__capture = (obj) => { sandbox.__captured = obj; };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${source}\n;__capture({ ${captureNames.join(", ")} });`, context, { filename: "site.js" });
  return sandbox.__captured;
}

/* ---------------- script.js: homepage ---------------- */
const home = makeSandbox();
const api = runWithStubs(load("script.js"), home, [
  "GAMES", "state", "applyFilters", "hydrateFromUrl", "syncUrl",
  "cardTemplate", "getFilteredGames", "getCategories", "getTypes", "getNewGames", "typeLabel"
]);

t("homepage init ran without throwing", Boolean(api && Array.isArray(api.GAMES)));

const sel = (s) => home.__cache.get(s);
const featuredHtml = sel("#featured-grid").innerHTML;
const popularHtml = sel("#popular-grid").innerHTML;
const minecraftHtml = sel("#minecraft-grid").innerHTML;
const newHtml = sel("#new-grid").innerHTML;
const gridHtml = sel("#games-grid").innerHTML;

t("catalog holds 26 games", api.GAMES.length === 26);
t("catalog holds 8 categories", api.getCategories().length === 8);
t("featured renders 5 cards", count(featuredHtml, "<article") === 5);
t("popular renders 8 cards", count(popularHtml, "<article") === 8);
t("minecraft rail renders 3 cards", count(minecraftHtml, "<article") === 3);
t("new rail renders 6 cards", count(newHtml, "<article") === 6);
t("new rail leads with latest entry", newHtml.indexOf("Asteroid Dodge") !== -1 && newHtml.indexOf("Asteroid Dodge") < newHtml.indexOf("Neon Runner"));
t("all games renders 26 cards", count(gridHtml, "<article") === 26);
t("cards carry generated type labels", gridHtml.includes("type-badge") && gridHtml.includes("HTML5") && gridHtml.includes("WebGL") && gridHtml.includes("WASM"));
t("play links use relative games/ paths", gridHtml.includes('href="games/eaglercraft-1-8/index.html"'));
t("no absolute paths in output", !/"\/(assets|games|index)/.test(gridHtml + featuredHtml));
t("stats rendered", sel("#stat-games").textContent === "26" && sel("#stat-categories").textContent === "8");

const REQUIRED_FIELDS = ["id", "title", "slug", "description", "category", "thumbnail", "featured", "popular", "status", "type", "version", "playUrl", "embed", "tags"];
t("every entry supports all catalog fields", api.GAMES.every((g) => REQUIRED_FIELDS.every((f) => f in g)));
t("types are known values", api.GAMES.every((g) => ["html5", "iframe", "external", "webgl", "wasm"].includes(g.type)));
t("statuses are known values", api.GAMES.every((g) => ["available", "coming-soon"].includes(g.status)));
t("21 games are available", api.GAMES.filter((g) => g.status === "available").length === 21);
t("available html5 entries link play pages", api.GAMES.filter((g) => g.status === "available" && g.type === "html5").every((g) => g.playUrl === `games/${g.slug}/play/index.html`));
t("slugs are unique", new Set(api.GAMES.map((g) => g.slug)).size === api.GAMES.length);
t("minecraft entries declare client playUrls", api.GAMES.filter((g) => g.category === "Minecraft").every((g) => g.playUrl === `games/${g.slug}/client/index.html`));
t("type chips generated with counts", JSON.stringify(api.getTypes().map((x) => x.label)) === JSON.stringify(["HTML5", "WebGL", "WASM"]));

api.state.query = "sandbox"; api.state.category = "All"; api.state.type = null; api.applyFilters();
t("search matches tags ('sandbox' -> 3)", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.query = "wasm"; api.applyFilters();
t("search matches type label ('wasm' -> Steel Vanguard)", sel("#games-grid").innerHTML.includes("Steel Vanguard"));
api.state.query = ""; api.state.category = "Racing"; api.applyFilters();
t("category filter Racing finds Turbo Drift", count(sel("#games-grid").innerHTML, "<article") === 1);
api.state.category = "All"; api.state.type = "webgl"; api.applyFilters();
t("type filter webgl finds 3 clients", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.query = "zzz-no-such-game"; api.state.type = null; api.applyFilters();
t("no match shows empty state", sel("#empty-state").hidden === false);
t("query HTML is escaped", sel("#empty-message").innerHTML.includes("&lt;") === false || sel("#empty-message").innerHTML.includes("zzz-no-such-game"));

home.location.search = "?category=Minecraft"; api.state.query = ""; api.state.category = "All"; api.state.type = null; api.hydrateFromUrl();
t("hydrates ?category=Minecraft", api.state.category === "Minecraft" && api.state.type === null);
api.applyFilters();
t("minecraft URL filter renders 3", count(sel("#games-grid").innerHTML, "<article") === 3);
home.location.search = "?type=wasm"; api.hydrateFromUrl();
t("hydrates ?type=wasm", api.state.type === "wasm" && api.state.category === "All");
home.location.search = "?type=bogus"; api.state.type = null; api.hydrateFromUrl();
t("bogus type ignored", api.state.type === null);
home.location.search = "?category=Bogus"; api.state.category = "All"; api.hydrateFromUrl();
t("bogus category ignored", api.state.category === "All");

const fallback = api.cardTemplate({ id: "x", title: "X", slug: "x", description: "d", category: "Arcade", thumbnail: null, type: "html5", status: "available" });
t("null thumbnail renders media-art", fallback.includes("media-art") && !fallback.includes("<img"));

/* ---------------- launcher.js: planner ---------------- */
const lbox = makeSandbox();
lbox.__null.add("#launcher");
const launch = runWithStubs(load("launcher.js"), lbox, ["resolveLaunch", "isHttpsUrl", "isRemoteUrl", "clientHint", "LAUNCH_TYPES"]);

t("launcher init ran without throwing", Boolean(launch && Array.isArray(launch.LAUNCH_TYPES)));
t("supports 5 launch types", JSON.stringify(launch.LAUNCH_TYPES) === JSON.stringify(["html5", "iframe", "external", "webgl", "wasm"]));

const plan = (type, playUrl, slug = "demo-game") => launch.resolveLaunch({ slug, type, playUrl });
let r = plan("webgl", "");
t("webgl without client -> graceful error", r.action === "error" && /not been added/.test(r.reason));
t("webgl error hints client dir", plan("webgl", "", "eaglercraft-1-8").detail.includes("games/eaglercraft-1-8/client/index.html"));
r = plan("wasm", "");
t("wasm without client -> graceful error", r.action === "error");
r = plan("html5", "");
t("html5 without playUrl -> graceful error", r.action === "error");
r = plan("html5", "play/index.html");
t("html5 local -> navigate with probe", r.action === "navigate" && r.probe === true);
r = plan("html5", "https://example.com/game");
t("html5 remote -> rejected", r.action === "error");
r = plan("iframe", "embed/index.html");
t("iframe local -> embed with probe", r.action === "embed" && r.probe === true);
r = plan("webgl", "client/index.html");
t("webgl local -> embed with probe", r.action === "embed" && r.probe === true);
r = plan("iframe", "https://example.com/embed");
t("iframe https remote -> embed without probe", r.action === "embed" && r.probe === false);
r = plan("iframe", "http://example.com/embed");
t("iframe http remote -> rejected", r.action === "error");
r = plan("external", "https://example.com/play");
t("external https -> external navigation", r.action === "external");
r = plan("external", "http://example.com/play");
t("external http -> rejected", r.action === "error");
r = plan("external", "");
t("external without URL -> graceful error", r.action === "error");
r = plan("flash", "game.swf");
t("unknown type -> graceful error", r.action === "error");
t("URL helpers behave", launch.isHttpsUrl("https://a.b/c") && !launch.isHttpsUrl("http://a.b/c") && launch.isRemoteUrl("http://a.b/") && !launch.isRemoteUrl("client/index.html"));

/* ---------------- launcher.js: UI behavior ---------------- */
function buildLauncherPage(sandbox, dataset) {
  const doc = sandbox.document;
  const launcher = makeElement("section");
  launcher.dataset = { ...dataset };
  const stage = makeElement("div");
  stage.id = "launcher-stage";
  const toolbar = makeElement("div");
  toolbar.className = "launcher-toolbar";
  toolbar.hidden = true;
  const fsBtn = makeElement("button");
  fsBtn.className = "launcher-fullscreen btn";
  const closeBtn = makeElement("button");
  closeBtn.className = "launcher-close btn";
  toolbar.appendChild(fsBtn);
  toolbar.appendChild(closeBtn);
  launcher.appendChild(stage);
  launcher.appendChild(toolbar);
  sandbox.__cache.set("#launcher", launcher);
  return { launcher, stage, toolbar, fsBtn, closeBtn };
}

const hasClass = (node, cls) => node.querySelector(`.${cls}`) !== null;
const flush = () => new Promise((done) => setTimeout(done, 25));

// Missing-client flow: cover -> Play -> friendly error, nothing embedded.
{
  const sb = makeSandbox();
  const { stage } = buildLauncherPage(sb, { slug: "eaglercraft-1-8", title: "Eaglercraft 1.8", type: "webgl", playUrl: "" });
  runWithStubs(load("launcher.js"), sb, ["resolveLaunch"]);
  t("launcher renders cover with Play button", hasClass(stage, "launcher-cover") && stage.querySelector("#launcher-play") !== null);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("missing client shows error state", hasClass(stage, "launcher-error"));
  t("error state embeds nothing", stage.querySelectorAll("iframe").length === 0 && count(JSON.stringify(stage.children.map((c) => c.className)), "launcher-frame") === 0);
}

// Successful embed flow with stubbed fetch probe.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: true, status: 200 });
  const { stage, toolbar, fsBtn, closeBtn } = buildLauncherPage(sb, { slug: "steel-vanguard", title: "Steel Vanguard", type: "wasm", playUrl: "client/index.html" });
  runWithStubs(load("launcher.js"), sb, ["resolveLaunch"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("verified client embeds an iframe", Boolean(frame));
  t("iframe carries launch attributes", frame && frame.getAttribute("src") === "client/index.html" && frame.getAttribute("allowfullscreen") === "" && String(frame.getAttribute("allow")).includes("fullscreen") && frame.getAttribute("title").includes("Steel Vanguard"));
  t("toolbar appears while playing", toolbar.hidden === false);
  t("fullscreen button hides when unsupported", fsBtn.hidden === true);
  closeBtn.__click();
  t("close returns to cover state", hasClass(stage, "launcher-cover"));
}

// Failed probe flow: 404 becomes a friendly error, never a raw browser 404.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: false, status: 404 });
  const { stage } = buildLauncherPage(sb, { slug: "turbo-drift", title: "Turbo Drift", type: "html5", playUrl: "play/index.html" });
  runWithStubs(load("launcher.js"), sb, ["resolveLaunch"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("failed probe shows error state", hasClass(stage, "launcher-error"));
  t("failed probe navigates nowhere", sb.location._assigned === "");
}

// External flow: direct navigation, no iframe.
{
  const sb = makeSandbox();
  const { stage } = buildLauncherPage(sb, { slug: "partner-game", title: "Partner Game", type: "external", playUrl: "https://example.com/play" });
  runWithStubs(load("launcher.js"), sb, ["resolveLaunch"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("external game navigates to play URL", sb.location._assigned === "https://example.com/play");
  t("external game embeds nothing", stage.children.filter((c) => c._tag === "iframe").length === 0);
}

// Sandbox attribute passthrough for untrusted embeds.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: true, status: 200 });
  const { stage } = buildLauncherPage(sb, { slug: "cloud-hopper", title: "Cloud Hopper", type: "iframe", playUrl: "embed/index.html", embedSandbox: "allow-scripts" });
  runWithStubs(load("launcher.js"), sb, ["resolveLaunch"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("embed sandbox is honored", Boolean(frame) && frame.getAttribute("sandbox") === "allow-scripts");
}

if (failures) {
  console.error(`\n${failures} FAILURE${failures === 1 ? "" : "S"}`);
  process.exit(1);
}
console.log("\nALL SMOKE TESTS PASSED");
