/* GameHub runtime smoke tests (dependency-free).
   Run from the repo root:  node tests/smoke.mjs
   Executes the real catalog.js + player.js + cards.js + script.js /
   launcher.js in stubbed DOM contexts and asserts catalog, filtering,
   sorting, URL hydration, player shelves, favorites and launching,
   plus Minecraft client resolution (local, HTTPS, missing, HTTP)
   and the external-game architecture (remote URL validation,
   blocked-embed fallback, provider rails/metadata). */
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (name) => readFileSync(path.join(root, name), "utf8");
const HOME_STACK = ["catalog.js", "player.js", "cards.js", "script.js"].map(load).join("\n");
const PAGE_STACK = ["catalog.js", "player.js", "cards.js", "launcher.js"].map(load).join("\n");

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
    contains(node) {
      let found = false;
      const walk = (current) => {
        for (const child of current.children || []) {
          if (child === node) found = true;
          walk(child);
        }
      };
      walk(this);
      return found;
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

function makeSandbox() {
  const cache = new Map();
  const store = new Map();
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
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
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
    __cache: cache,
    __store: store
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

/* ---------------- Homepage stack ---------------- */
const home = makeSandbox();
// Pre-seed the spotlight mount so renderSpotlight has a real target.
{
  const section = makeElement("section");
  const mount = makeElement("div");
  mount.className = "spotlight-inner";
  section.appendChild(mount);
  home.__cache.set("#spotlight", section);
}
const api = runWithStubs(HOME_STACK, home, [
  "GameHubCatalog", "GameHubPlayer", "GameHubCards",
  "state", "applyFilters", "hydrateFromUrl", "syncUrl", "getFilteredGames",
  "pickSpotlight", "renderRecent", "renderFavoritesShelf", "renderSpotlight"
]);
const Catalog = api.GameHubCatalog;
const Player = api.GameHubPlayer;
const Cards = api.GameHubCards;

t("homepage init ran without throwing", Boolean(api && Catalog && Player && Cards));

const sel = (s) => home.__cache.get(s);
const featuredHtml = sel("#featured-grid").innerHTML;
const popularHtml = sel("#popular-grid").innerHTML;
const minecraftHtml = sel("#minecraft-grid").innerHTML;
const newHtml = sel("#new-grid").innerHTML;
const gridHtml = sel("#games-grid").innerHTML;
const GAMES = Catalog.games;

t("catalog holds 51 games", GAMES.length === 51);
t("catalog holds 10 categories", Catalog.getCategories().length === 10);
t("featured renders 7 cards", count(featuredHtml, "<article") === 7);
t("featured honors featuredOrder (Snake first)", featuredHtml.indexOf("Snake") !== -1 && featuredHtml.indexOf("Snake") < featuredHtml.indexOf("Star Voyager"));
t("popular renders 11 cards", count(popularHtml, "<article") === 11);
t("minecraft rail renders 3 cards", count(minecraftHtml, "<article") === 3);
t("new rail renders 6 cards", count(newHtml, "<article") === 6);
t("new rail leads with latest entries", newHtml.indexOf("Ember Keep") !== -1 && newHtml.indexOf("Ember Keep") < newHtml.indexOf("Road Rush") && newHtml.indexOf("Road Rush") < newHtml.indexOf("Idle Miner") && newHtml.includes("Glow Grid"));
t("all games renders 51 cards", count(gridHtml, "<article") === 51);
t("cards carry generated type labels", gridHtml.includes("type-badge") && gridHtml.includes("HTML5") && gridHtml.includes("WebGL") && gridHtml.includes("WASM"));
t("cards carry version badges", gridHtml.includes("version-badge") && gridHtml.includes("v1.0.0"));
t("cards carry favorite toggles", count(gridHtml, "data-fav=") === 51 && gridHtml.includes("aria-pressed"));
t("play links use relative games/ paths", gridHtml.includes('href="games/eaglercraft-1-8/index.html"'));
t("no absolute paths in output", !/"\/(assets|games|index)/.test(gridHtml + featuredHtml));
t("stats rendered", sel("#stat-games").textContent === "51" && sel("#stat-categories").textContent === "10");
t("spotlight picks first featured available (Snake)", api.pickSpotlight() && api.pickSpotlight().slug === "snake");
t("spotlight renders into mount", sel("#spotlight").querySelector(".spotlight-inner").innerHTML.includes("Snake"));
t("empty shelves stay hidden", sel("#recent").hidden === true && sel("#favorites").hidden === true);

const REQUIRED_FIELDS = ["id", "title", "slug", "description", "category", "thumbnail", "featured", "popular", "status", "type", "version", "playUrl", "embed", "tags"];
t("every entry supports all catalog fields", GAMES.every((g) => REQUIRED_FIELDS.every((f) => f in g)));
t("types are known values", GAMES.every((g) => ["html5", "iframe", "external", "webgl", "wasm"].includes(g.type)));
t("statuses are known values", GAMES.every((g) => ["available", "coming-soon"].includes(g.status)));
t("46 games are available", GAMES.filter((g) => g.status === "available").length === 46);
t("available html5 entries link play pages", GAMES.filter((g) => g.status === "available" && g.type === "html5").every((g) => g.playUrl === `games/${g.slug}/play/index.html`));
t("slugs are unique", new Set(GAMES.map((g) => g.slug)).size === GAMES.length);
t("minecraft entries declare client playUrls", GAMES.filter((g) => g.category === "Minecraft").every((g) => g.playUrl === `games/${g.slug}/client/index.html`));
t("type chips generated with counts", JSON.stringify(Catalog.getTypes().map((x) => x.label)) === JSON.stringify(["HTML5", "WebGL", "WASM"]));
t("optional fields tolerated when missing", Catalog.getNewGames().length === 6 && Catalog.getFeatured().length === 7 && Catalog.sortGames(GAMES, "newest").length === 51);
t("related games derive from catalog", Catalog.getRelated(Catalog.gameBySlug("snake"), 3).length === 3 && !Catalog.getRelated(Catalog.gameBySlug("snake"), 3).some((g) => g.slug === "snake"));

/* ---------------- Catalog integrity on disk ---------------- */
const MINECRAFT_SLUGS = ["eaglercraft-1-8", "eaglercraftx-1-8", "eaglercraft-1-12"];
const NEW_GAMES = ["stack-tower", "sky-jump", "stellar-siege", "slide-puzzle", "glow-grid", "air-hockey", "reversi", "idle-miner", "road-rush", "ember-keep"];
const inRepo = (rel) => existsSync(path.join(root, rel));

const mcGames = MINECRAFT_SLUGS.map((slug) => Catalog.gameBySlug(slug));
t("all three Minecraft clients are cataloged", mcGames.every(Boolean) && mcGames.length === 3);
t("Minecraft entries carry full metadata", mcGames.every((g) => g && g.category === "Minecraft" && g.type === "webgl" && g.status === "coming-soon" && g.controls && g.difficulty && g.playUrl === `games/${g.slug}/client/index.html`));
t("Minecraft entries use sandbox/voxel tags", mcGames.every((g) => g.tags.includes("minecraft") && g.tags.includes("sandbox") && g.tags.includes("voxel") && g.tags.every((tag) => tag === tag.toLowerCase())));
t("Minecraft client dirs ship only placement docs", MINECRAFT_SLUGS.every((slug) => inRepo(`games/${slug}/client/README.md`) && !existsSync(path.join(root, "games", slug, "client", "index.html"))));

t("all 10 new games are available", NEW_GAMES.every((slug) => { const g = Catalog.gameBySlug(slug); return g && g.status === "available" && g.type === "html5"; }));
t("new games link play bundles", NEW_GAMES.every((slug) => Catalog.gameBySlug(slug).playUrl === `games/${slug}/play/index.html`));
t("new games ship complete play bundles", NEW_GAMES.every((slug) => ["index.html", "style.css", "game.js"].every((f) => inRepo(`games/${slug}/play/${f}`))));
t("new games declare controls + difficulty", NEW_GAMES.every((slug) => { const g = Catalog.gameBySlug(slug); return g.controls && ["Easy", "Medium", "Hard"].includes(g.difficulty); }));
t("new games use lowercase tags", NEW_GAMES.every((slug) => Catalog.gameBySlug(slug).tags.every((tag) => tag === tag.toLowerCase())));

t("every entry has a game page + thumbnail", Catalog.validGames().every((g) => inRepo(`games/${g.slug}/index.html`) && inRepo(g.thumbnail)));
t("all local playUrls exist on disk", Catalog.validGames().filter((g) => g.playUrl && !/^https?:/i.test(g.playUrl) && g.status === "available").every((g) => inRepo(g.playUrl)));
t("coming-soon client slots never fake availability", Catalog.validGames().filter((g) => (g.type === "webgl" || g.type === "wasm") && g.status === "coming-soon").every((g) => !existsSync(path.join(root, "games", g.slug, "play", "index.html"))));

/* Client-aware cards: configured/verified clients flip to playable. */
{
  const sb = makeSandbox();
  sb.GameHubClients = { clients: { "eaglercraft-1-8": { url: "https://cdn.example.com/e18/index.html" }, "eaglercraftx-1-8": { url: "http://misconfigured.example.com/" } } };
  const api2 = runWithStubs([load("catalog.js"), load("cards.js")].join("\n"), sb, ["GameHubCards", "GameHubCatalog"]);
  const C2 = api2.GameHubCards;
  const cat2 = api2.GameHubCatalog;
  const configured = C2.cardTemplate(cat2.gameBySlug("eaglercraft-1-8"), {});
  t("configured https client renders a playable Minecraft card", configured.includes("Play ") && !configured.includes("Coming soon") && configured.includes("card--minecraft"));
  const httpSlot = C2.cardTemplate(cat2.gameBySlug("eaglercraftx-1-8"), {});
  t("http client config keeps the card honest", httpSlot.includes("Coming soon") && !httpSlot.includes(">Play "));
  const steel = cat2.gameBySlug("steel-vanguard");
  const before = C2.cardTemplate(steel, {});
  C2.markClientAvailable("steel-vanguard");
  const after = C2.cardTemplate(steel, {});
  t("marked local clients flip cards to playable", before.includes("Coming soon") && !after.includes("Coming soon") && after.includes("Play "));
  const eagle = cat2.gameBySlug("eaglercraft-1-12");
  t("unconfigured slots stay coming-soon", C2.cardTemplate(eagle, {}).includes("Coming soon") && C2.clientReady(eagle) === false);
}

api.state.query = "sandbox"; api.state.category = "All"; api.state.type = null; api.state.sort = "featured"; api.state.favoritesOnly = false; api.applyFilters();
t("search matches tags ('sandbox' -> 3)", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.query = "wasm"; api.applyFilters();
t("search matches type label ('wasm' -> Steel Vanguard)", sel("#games-grid").innerHTML.includes("Steel Vanguard"));
api.state.query = "physics"; api.applyFilters();
t("search matches new tags ('physics' -> 2)", count(sel("#games-grid").innerHTML, "<article") === 2);
api.state.query = ""; api.state.category = "Racing"; api.applyFilters();
t("category filter Racing finds 3 games", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.category = "Sports"; api.applyFilters();
t("category filter Sports finds 3 games", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.category = "All"; api.state.type = "webgl"; api.applyFilters();
t("type filter webgl finds 3 clients", count(sel("#games-grid").innerHTML, "<article") === 3);
api.state.query = "zzz-no-such-game"; api.state.type = null; api.applyFilters();
t("no match shows empty state", sel("#empty-state").hidden === false);
t("query HTML is escaped", sel("#empty-message").innerHTML.includes("zzz-no-such-game"));

home.location.search = "?category=Minecraft"; api.state.query = ""; api.state.category = "All"; api.state.type = null; api.state.favoritesOnly = false; api.hydrateFromUrl();
t("hydrates ?category=Minecraft", api.state.category === "Minecraft" && api.state.type === null);
api.applyFilters();
t("minecraft URL filter renders 3", count(sel("#games-grid").innerHTML, "<article") === 3);
home.location.search = "?type=wasm"; api.hydrateFromUrl();
t("hydrates ?type=wasm", api.state.type === "wasm" && api.state.category === "All");
home.location.search = "?type=bogus"; api.state.type = null; api.hydrateFromUrl();
t("bogus type ignored", api.state.type === null);
home.location.search = "?category=Bogus"; api.state.category = "All"; api.hydrateFromUrl();
t("bogus category ignored", api.state.category === "All");
home.location.search = "?sort=az"; api.state.sort = "featured"; api.hydrateFromUrl();
t("hydrates ?sort=az", api.state.sort === "az");
home.location.search = "?sort=bogus"; api.state.sort = "featured"; api.hydrateFromUrl();
t("bogus sort ignored", api.state.sort === "featured");
home.location.search = "?favorites=1"; api.state.favoritesOnly = false; api.hydrateFromUrl();
t("hydrates ?favorites=1", api.state.favoritesOnly === true);
home.location.search = "";

/* Sorting. */
api.state.query = ""; api.state.category = "All"; api.state.type = null; api.state.favoritesOnly = false;
api.state.sort = "az"; api.applyFilters();
t("sort A-Z leads with Air Hockey", sel("#games-grid").innerHTML.indexOf("Air Hockey") < sel("#games-grid").innerHTML.indexOf("Arena Clash"));
api.state.sort = "newest"; api.applyFilters();
t("sort newest leads with Ember Keep", sel("#games-grid").innerHTML.indexOf("Ember Keep") < sel("#games-grid").innerHTML.indexOf("Knife Dodge") && sel("#games-grid").innerHTML.indexOf("Knife Dodge") < sel("#games-grid").innerHTML.indexOf("Snake"));
api.state.sort = "popular"; api.applyFilters();
t("sort popular leads with Snake", sel("#games-grid").innerHTML.indexOf(">Snake<") !== -1 && sel("#games-grid").innerHTML.indexOf(">Snake<") < sel("#games-grid").innerHTML.indexOf("Merge Blocks"));
api.state.sort = "featured";

/* Favorites view + shelves. */
api.state.favoritesOnly = true; api.applyFilters();
t("empty favorites view explains itself", sel("#empty-state").hidden === false && sel("#results-count").textContent === "No favorite games yet");
Player.toggleFavorite("snake");
Player.toggleFavorite("merge-blocks");
api.applyFilters();
t("favorites view shows 2 cards", count(sel("#games-grid").innerHTML, "<article") === 2);
api.renderFavoritesShelf();
t("favorites shelf unhides with 2 cards", sel("#favorites").hidden === false && count(sel("#favorites-grid").innerHTML, "<article") === 2);
Player.toggleFavorite("snake");
Player.toggleFavorite("merge-blocks");
api.renderFavoritesShelf();
t("favorites shelf hides again when emptied", sel("#favorites").hidden === true);
api.state.favoritesOnly = false;

/* Recently played shelf. */
Player.recordGamePlayed("snake");
api.renderRecent();
t("recent shelf unhides after a launch", sel("#recent").hidden === false && sel("#recent-grid").innerHTML.includes("Snake"));

const fallback = Cards.cardTemplate({ id: "x", title: "X", slug: "x", description: "d", category: "Arcade", thumbnail: null, type: "html5", status: "available" });
t("null thumbnail renders media-art", fallback.includes("media-art") && !fallback.includes("<img"));
const soon = Cards.cardTemplate({ id: "y", title: "Y", slug: "y", description: "d", category: "Arcade", thumbnail: null, type: "wasm", status: "coming-soon", version: "1.0.0" });
t("coming-soon card is honest", soon.includes("Coming soon") && soon.includes("Details") && !soon.includes("Play <"));
const prefixed = Cards.cardTemplate({ id: "snake", title: "Snake", slug: "snake", description: "d", category: "Arcade", thumbnail: "assets/thumbnails/snake.svg", type: "html5", status: "available", version: "1.0.0" }, { prefix: "../" });
t("related cards use page-relative paths", prefixed.includes('href="../games/snake/index.html"') && prefixed.includes('src="../assets/thumbnails/snake.svg"'));

/* Favorite toggle delegation (no inline handlers). */
{
  const favRoot = makeElement("div");
  const btn = makeElement("button");
  btn.setAttribute("data-fav", "snake");
  favRoot.appendChild(btn);
  Cards.wireFavorites(favRoot, () => {});
  const fire = (target) => {
    for (const fn of favRoot._listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} });
  };
  fire({ closest: () => btn });
  t("delegated toggle adds favorite", Player.isFavorite("snake") === true && btn.getAttribute("aria-pressed") === "true");
  fire({ closest: () => btn });
  t("delegated toggle removes favorite", Player.isFavorite("snake") === false && btn.getAttribute("aria-pressed") === "false");
  fire({ closest: () => null });
  t("clicks outside toggles are ignored", Player.getFavorites().length === 0);
}

/* ---------------- player.js: storage layer ---------------- */
{
  const sb = makeSandbox();
  const P = runWithStubs(load("player.js"), sb, ["GameHubPlayer"]).GameHubPlayer;
  t("player exposes required API", ["getFavorites", "toggleFavorite", "getRecentlyPlayed", "recordGamePlayed", "getStats", "getRecentSearches", "recordSearch"].every((f) => typeof P[f] === "function"));

  P.recordGamePlayed("snake");
  P.recordGamePlayed("sudoku");
  P.recordGamePlayed("snake");
  t("recent dedupes newest-first", JSON.stringify(P.getRecentlyPlayed()) === JSON.stringify(["snake", "sudoku"]));
  for (let i = 0; i < 12; i++) P.recordGamePlayed(`game-${i}`);
  t("recent caps at 10", P.getRecentlyPlayed().length === 10 && P.getRecentlyPlayed()[0] === "game-11");

  P.recordGamePlayed("snake");
  const stats = P.getStats("snake");
  t("stats track plays + last played", stats.gamesPlayed === 3 && stats.lastPlayed > 0);
  t("stats expose null best when unplayed", P.getStats("merge-blocks").bestScore === null);
  sb.__store.set("gh_snake_best", "120");
  t("stats read the real stored best", P.getStats("snake").bestScore === "120" && P.getStats("snake").bestLabel === "Best score");
  sb.__store.set("gh_turbo_bestlap", "95.25");
  t("stats format lap times", P.getStats("turbo-drift").bestScore === "1:35.2");
  sb.__store.set("gh_reaction_best", "240");
  t("stats format millisecond averages", P.getStats("reaction-arena").bestScore === "240 ms");

  P.recordSearch("maze");
  P.recordSearch(" voxel ");
  P.recordSearch("MAZE");
  t("searches trim + dedupe", JSON.stringify(P.getRecentSearches()) === JSON.stringify(["MAZE", "voxel"]));
  for (let i = 0; i < 10; i++) P.recordSearch(`q${i}`);
  t("searches cap within 5-10", P.getRecentSearches().length === 8);
  P.clearRecentSearches();
  t("searches clear", P.getRecentSearches().length === 0);

  sb.__store.set("gamehub:favorites", "{oops");
  sb.__store.set("gamehub:recent", "zzz");
  sb.__store.set("gamehub:plays", "[1,2");
  t("corrupted JSON is tolerated", P.getFavorites().length === 0 && P.getRecentlyPlayed().length === 0 && P.getStats("snake").gamesPlayed === 0);
}
{
  // localStorage throws (private mode): memory fallback keeps everything working.
  const sb = makeSandbox();
  sb.localStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); }
  };
  const P = runWithStubs(load("player.js"), sb, ["GameHubPlayer"]).GameHubPlayer;
  P.toggleFavorite("snake");
  P.recordGamePlayed("snake");
  P.recordSearch("maze");
  t("storage failure falls back to memory", P.isFavorite("snake") && P.getRecentlyPlayed()[0] === "snake" && P.getStats("snake").gamesPlayed === 1 && P.getRecentSearches()[0] === "maze");
  t("storage reports unavailable", P.storageAvailable() === false);
}

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

/* ---------------- Minecraft client resolution ---------------- */
const planFull = (config) => launch.resolveLaunch(config);
r = planFull({ slug: "eaglercraft-1-8", type: "webgl", playUrl: "", clientUrl: "https://cdn.example.com/e18/index.html" });
t("webgl https clientUrl -> embed remote unprobed", r.action === "embed" && r.probe === false && r.remote === true && r.url === "https://cdn.example.com/e18/index.html");
r = planFull({ slug: "eaglercraft-1-8", type: "webgl", playUrl: "", clientUrl: "http://insecure.example.com/e18/index.html" });
t("webgl http clientUrl -> refused", r.action === "error" && /HTTPS/.test(r.reason));
r = planFull({ slug: "eaglercraft-1-8", type: "webgl", playUrl: "client/index.html", clientUrl: "https://cdn.example.com/e18/index.html" });
t("webgl local client wins over configured remote", r.action === "embed" && r.probe === true && r.url === "client/index.html");
r = planFull({ slug: "eaglercraft-1-8", type: "wasm", playUrl: "", clientUrl: "https://cdn.example.com/w/index.html" });
t("wasm https clientUrl -> embed remote unprobed", r.action === "embed" && r.remote === true);
r = planFull({ slug: "eaglercraft-1-8", type: "html5", playUrl: "", clientUrl: "https://cdn.example.com/x/index.html" });
t("clientUrl never overrides html5 navigation rules", r.action === "error");

/* Central client configuration (client-config.js shape). */
{
  const sb = makeSandbox();
  sb.__null.add("#launcher");
  sb.GameHubClients = {
    clients: {
      "eaglercraft-1-8": { url: "https://cdn.example.com/e18/index.html" },
      "eaglercraftx-1-8": null,
      "eaglercraft-1-12": { url: "http://misconfigured.example.com/" }
    }
  };
  const mods = runWithStubs(load("launcher.js"), sb, ["resolveLaunch", "configuredClientUrl", "readClientConfig"]);
  t("central config resolves https client", mods.configuredClientUrl("eaglercraft-1-8") === "https://cdn.example.com/e18/index.html");
  t("central config empty slot stays empty", mods.configuredClientUrl("eaglercraftx-1-8") === "");
  t("central config surfaces http misconfiguration", mods.configuredClientUrl("eaglercraft-1-12") === "http://misconfigured.example.com/");
  const merged = planFull({ slug: "eaglercraft-1-8", type: "webgl", playUrl: "", clientUrl: mods.configuredClientUrl("eaglercraft-1-8") });
  t("configured https client plans a remote embed", merged.action === "embed" && merged.remote === true);
}

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
const walkHtml = (node) => {
  let out = node.innerHTML || "";
  for (const child of node.children || []) out += ` ${walkHtml(child)}`;
  return out;
};
const flush = () => new Promise((done) => setTimeout(done, 25));

// Missing-client flow: cover -> Play -> friendly error, nothing embedded.
{
  const sb = makeSandbox();
  const { stage } = buildLauncherPage(sb, { slug: "eaglercraft-1-8", title: "Eaglercraft 1.8", status: "coming-soon", type: "webgl", playUrl: "" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  t("launcher renders cover with Play button", hasClass(stage, "launcher-cover") && stage.querySelector("#launcher-play") !== null);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("missing client shows error state", hasClass(stage, "launcher-error"));
  t("error state embeds nothing", stage.querySelectorAll("iframe").length === 0 && count(JSON.stringify(stage.children.map((c) => c.className)), "launcher-frame") === 0);
  t("failed launch records no recent play", mods.GameHubPlayer.getRecentlyPlayed().length === 0);
}

// Successful embed flow with stubbed fetch probe.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: true, status: 200 });
  const { stage, toolbar, fsBtn, closeBtn } = buildLauncherPage(sb, { slug: "steel-vanguard", title: "Steel Vanguard", status: "coming-soon", type: "wasm", playUrl: "client/index.html" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("verified client embeds an iframe", Boolean(frame));
  t("iframe carries launch attributes", frame && frame.getAttribute("src") === "client/index.html" && frame.getAttribute("allowfullscreen") === "" && String(frame.getAttribute("allow")).includes("fullscreen") && frame.getAttribute("title").includes("Steel Vanguard"));
  t("toolbar appears while playing", toolbar.hidden === false);
  t("fullscreen button hides when unsupported", fsBtn.hidden === true);
  t("restart button appears while embedded", toolbar.querySelector(".launcher-restart") !== null && toolbar.querySelector(".launcher-restart").hidden === false);
  t("successful launch records recent play", mods.GameHubPlayer.getRecentlyPlayed()[0] === "steel-vanguard");
  t("successful launch counts a play", mods.GameHubPlayer.getStats("steel-vanguard").gamesPlayed === 1);
  closeBtn.__click();
  t("close returns to cover state", hasClass(stage, "launcher-cover"));
}

// Failed probe flow: 404 becomes a friendly error, never a raw browser 404.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: false, status: 404 });
  const { stage } = buildLauncherPage(sb, { slug: "turbo-drift", title: "Turbo Drift", status: "available", type: "html5", playUrl: "play/index.html" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("failed probe shows error state", hasClass(stage, "launcher-error"));
  t("failed probe navigates nowhere", sb.location._assigned === "");
  t("failed probe records no recent play", mods.GameHubPlayer.getRecentlyPlayed().length === 0);
}

// Successful navigate flow: probe passes, navigation + recent recording.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: true, status: 200 });
  buildLauncherPage(sb, { slug: "snake", title: "Snake", status: "available", type: "html5", playUrl: "play/index.html" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  sb.__cache.get("#launcher").querySelector("#launcher-play").__click();
  await flush();
  t("verified html5 navigates to play page", sb.location._assigned === "play/index.html");
  t("navigation records recent play", mods.GameHubPlayer.getRecentlyPlayed()[0] === "snake");
}

// External flow: clear hand-off panel, no auto-navigation, no iframe.
{
  const sb = makeSandbox();
  const { stage } = buildLauncherPage(sb, { slug: "partner-game", title: "Partner Game", status: "available", type: "external", playUrl: "https://example.com/play", provider: "Example Provider", externalUrl: "https://example.com/game" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const panel = stage.querySelector(".launcher-external");
  const openLink = panel ? panel.querySelector("a") : null;
  t("external game shows an open-game panel", Boolean(panel));
  t("external panel never auto-navigates", sb.location._assigned === "");
  t("external panel links to the provider page", Boolean(openLink) && openLink.getAttribute("href") === "https://example.com/play" && openLink.getAttribute("target") === "_blank" && (openLink.getAttribute("rel") || "").includes("noopener"));
  t("external panel names the provider", Boolean(panel) && walkHtml(panel).includes("Example Provider"));
  t("external game embeds nothing", stage.children.filter((c) => c._tag === "iframe").length === 0);
  t("external launch records recent play", mods.GameHubPlayer.getRecentlyPlayed()[0] === "partner-game");
}

// Sandbox attribute passthrough for untrusted embeds.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: true, status: 200 });
  const { stage } = buildLauncherPage(sb, { slug: "cloud-hopper", title: "Cloud Hopper", status: "available", type: "iframe", playUrl: "embed/index.html", embedSandbox: "allow-scripts" });
  runWithStubs(PAGE_STACK, sb, ["resolveLaunch"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("embed sandbox is honored", Boolean(frame) && frame.getAttribute("sandbox") === "allow-scripts");
}

// Configured remote client (no local files): embeds the HTTPS client.
{
  const sb = makeSandbox();
  sb.GameHubClients = { clients: { "eaglercraft-1-8": { url: "https://cdn.example.com/e18/index.html" } } };
  sb.setTimeout = () => 0; /* no 15s embed watchdog keeping the process alive */
  const { stage, toolbar } = buildLauncherPage(sb, { slug: "eaglercraft-1-8", title: "Eaglercraft 1.8", status: "coming-soon", type: "webgl", playUrl: "" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("configured https client embeds in viewport", Boolean(frame) && frame.getAttribute("src") === "https://cdn.example.com/e18/index.html");
  t("remote embed keeps the toolbar live", toolbar.hidden === false);
  t("remote client launch records recent play", mods.GameHubPlayer.getRecentlyPlayed()[0] === "eaglercraft-1-8");
}

// Local client missing -> automatic fallback to the configured HTTPS client.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: false, status: 404 });
  sb.GameHubClients = { clients: { "eaglercraftx-1-8": { url: "https://cdn.example.com/ex/index.html" } } };
  sb.setTimeout = () => 0; /* no 15s embed watchdog keeping the process alive */
  const { stage } = buildLauncherPage(sb, { slug: "eaglercraftx-1-8", title: "EaglercraftX 1.8", status: "coming-soon", type: "webgl", playUrl: "client/index.html" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  const frame = stage.children.find((c) => c._tag === "iframe");
  t("missing local client falls back to https client", Boolean(frame) && frame.getAttribute("src") === "https://cdn.example.com/ex/index.html");
  t("fallback launch records recent play", mods.GameHubPlayer.getRecentlyPlayed()[0] === "eaglercraftx-1-8");
}

// Local client missing + HTTP-only configuration -> honest error, no embed.
{
  const sb = makeSandbox();
  sb.fetch = () => Promise.resolve({ ok: false, status: 404 });
  sb.GameHubClients = { clients: { "eaglercraft-1-12": { url: "http://misconfigured.example.com/" } } };
  const { stage } = buildLauncherPage(sb, { slug: "eaglercraft-1-12", title: "Eaglercraft 1.12.2", status: "coming-soon", type: "webgl", playUrl: "client/index.html" });
  const mods = runWithStubs(PAGE_STACK, sb, ["resolveLaunch", "GameHubPlayer"]);
  stage.querySelector("#launcher-play").__click();
  await flush();
  t("http client config shows https error", hasClass(stage, "launcher-error") && walkHtml(stage).includes("HTTPS"));
  t("http client config embeds nothing", stage.children.filter((c) => c._tag === "iframe").length === 0);
  t("http client config records no recent play", mods.GameHubPlayer.getRecentlyPlayed().length === 0);
}

// Page status upgrades when a valid client is configured.
{
  const sb = makeSandbox();
  const statusEl = makeElement("dd");
  statusEl.textContent = "Coming soon";
  const noticeEl = makeElement("div");
  noticeEl.hidden = false;
  sb.__cache.set("[data-status-value]", statusEl);
  sb.__cache.set("[data-client-notice]", noticeEl);
  sb.GameHubClients = { clients: { "eaglercraft-1-8": { url: "https://cdn.example.com/e18/index.html" } } };
  buildLauncherPage(sb, { slug: "eaglercraft-1-8", title: "Eaglercraft 1.8", status: "coming-soon", type: "webgl", playUrl: "client/index.html" });
  runWithStubs(PAGE_STACK, sb, ["resolveLaunch"]);
  await flush();
  t("status value upgrades to Available", statusEl.textContent === "Available");
  t("client notice is retired", noticeEl.hidden === true);
}

// Unconfigured + unprobed slots stay honest ("Coming soon").
{
  const sb = makeSandbox();
  const statusEl = makeElement("dd");
  statusEl.textContent = "Coming soon";
  const noticeEl = makeElement("div");
  noticeEl.hidden = false;
  sb.__cache.set("[data-status-value]", statusEl);
  sb.__cache.set("[data-client-notice]", noticeEl);
  sb.fetch = () => Promise.resolve({ ok: false, status: 404 });
  buildLauncherPage(sb, { slug: "eaglercraft-1-12", title: "Eaglercraft 1.12.2", status: "coming-soon", type: "webgl", playUrl: "client/index.html" });
  runWithStubs(PAGE_STACK, sb, ["resolveLaunch"]);
  await flush();
  t("missing client keeps Coming soon status", statusEl.textContent === "Coming soon");
  t("missing client keeps the notice visible", noticeEl.hidden === false);
}

/* ---------------- Remote URL validation ---------------- */
{
  const sb = makeSandbox();
  sb.__null.add("#launcher");
  const mods = runWithStubs(load("launcher.js"), sb, ["validateRemoteUrl", "fallbackOpenUrl"]);
  const v = mods.validateRemoteUrl;
  t("validator exists and is centralized", typeof v === "function");
  let r = v("https://html5.gamedistribution.com/abc123/");
  t("validator accepts https URLs", r.ok === true && r.url === "https://html5.gamedistribution.com/abc123/");
  r = v("http://example.com/game");
  t("validator rejects http URLs", r.ok === false && /HTTPS/.test(r.reason));
  r = v("javascript:alert(1)");
  t("validator rejects javascript: scheme", r.ok === false);
  r = v("data:text/html,hello");
  t("validator rejects data: scheme", r.ok === false);
  r = v("https://user:pass@example.com/game");
  t("validator rejects embedded credentials", r.ok === false);
  r = v("  ");
  t("validator rejects empty URLs", r.ok === false);
  r = v("https://example.com/game?a=1&b=2");
  t("validator keeps query strings intact", r.ok === true && r.url.includes("?a=1&b=2"));
  t("fallback prefers the provider page over the embed URL", mods.fallbackOpenUrl({ externalUrl: "https://provider.example/game" }, "https://cdn.example/embed/") === "https://provider.example/game");
  t("fallback falls back to the embed URL when no provider page", mods.fallbackOpenUrl({}, "https://cdn.example/embed/") === "https://cdn.example/embed/");
  t("fallback refuses unsafe provider pages", mods.fallbackOpenUrl({ externalUrl: "http://provider.example/game" }, "") === "");
}

if (failures) {
  console.error(`\n${failures} FAILURE${failures === 1 ? "" : "S"}`);
  process.exit(1);
}
console.log("\nALL SMOKE TESTS PASSED");
