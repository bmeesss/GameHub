# GameHub

GameHub is a free browser gaming platform: a fast, fully static website
where players browse HTML5, iframe, WebGL, WASM and external games —
including a dedicated Minecraft section for Eaglercraft-style voxel
clients — and launch them instantly. No backend, no database, no build
step: just HTML, CSS and vanilla JavaScript.

**GameHub 3.0** adds a complete local player layer: three themes, a
profile with statistics and 14 original avatars, 20 achievements,
collections, per-game ratings and notes, playtime tracking, a
command-palette style search overlay, catalog-generated category
landing pages, multiplayer metadata and an optional installable
offline mode — all in `localStorage`, no accounts, no tracking.

The catalog ships **73 games**: 61 original playable titles (each a
self-contained bundle under `games/<slug>/play/`), 5 real games from
officially embeddable providers (GameDistribution, GameMonetize), 2
provider deep-links (itch.io, Poki) and 5 coming-soon placeholders
(three Minecraft/Eaglercraft client slots, one WASM title, one online
multiplayer title). 68 entries are launchable today.

Live project page (once Pages is enabled):

**https://bmeesss.github.io/GameHub/**

> GameHub does **not** ship Minecraft itself. Voxel clients (Eaglercraft
> builds, texture packs, `assets.epk`-style files) are never downloaded,
> mirrored or bundled by this project. Where a game needs files we cannot
> legally redistribute, the launcher stays honest about it and the guides
> below explain exactly where to place your own legally sourced build.

## Features

- Modern gaming interface with **three themes** — Dark, Midnight and
  Light — switchable from the header or the profile page, remembered
  locally and applied before first paint
- **Profile system** (`profile/index.html`): display name, one of 14
  original inline-SVG avatars, lifetime statistics (games played,
  sessions, playtime, achievements), collections, ratings, notes and
  played-game history — 100% local, no accounts, no network calls
- **Achievements**: 20 original definitions (first launch, explore 5/10
  games, 25 launches, favorites, first highscore, multiple categories,
  multiple days, per-game milestones…) auto-checked after player-data
  changes, with locked/unlocked state, progress bars, unlock dates and
  toast notifications
- **Collections**: Favorites, Play Later and Completed, with a card
  button for each (real `<button>`s, delegated handlers, no inline
  `onclick` anywhere)
- **My Rating** (1–5 stars) on every game page — local only, never
  presented as a global rating — and **one private note per game**
  (500 characters, live counter, text-only rendering)
- **Continue Playing** homepage rail: up to 6 newest games,
  deduplicated, hidden when empty, driven by the existing recent-play
  data (no second tracking system)
- **Global search overlay** (`Ctrl+K` or `/`): live results across
  titles, descriptions, categories, tags, types, versions and
  providers, full keyboard navigation (↑/↓/Enter/Escape), recent
  searches and shareable `?q=…` URLs
- **Category landing pages** for all ten categories, generated from the
  catalog: description, computed count, featured/popular/recent rails,
  complete grid, related tags and an empty state
- Homepage discovery order: Spotlight, Continue Playing, Play Again,
  Favorites, Featured, Popular, Minecraft, Play Online, External
  Games, New Games, Categories, sortable All Games — empty personal
  rails hide themselves
- Provider games, CrazyGames-style: 5 officially embeddable games
  (GameDistribution, GameMonetize) stream inside GameHub's own
  launcher viewport, and 2 more (itch.io, Poki) deep-link to the
  provider's page through a clear hand-off panel — every provider
  game gets the same professional detail page as a local game
- **Multiplayer metadata**: every entry declares `multiplayer` and —
  when true — `multiplayerMode: "local" | "online"`; 11 local
  head-to-head games (Air Hockey, Chess, Checkers, Pool, Battle Tanks,
  Pirate Duel…), never a faked online mode
- **Optional PWA**: `manifest.webmanifest` plus a same-origin-only
  service worker that precaches the local shell; provider games and
  `games/*/client/` files are never cached
- 68 launchable games: 61 original HTML5 titles (newest: Chess,
  Checkers, Pool, Target Shooter, Word Hunt, Maze Escape, Helicopter
  Run, Rocket Landing, Survival Arena, Farm Defender, Pirate Duel,
  Snowboard Rush, Color Match, Battle Tanks, Typing Sprint) plus
  5 provider-streamed and 2 provider-linked games — each self-contained
  under `games/<slug>/play/` with keyboard + touch controls
- Catalog-generated filters: categories plus game-type labels
  (HTML5, Iframe, WebGL, WASM, External) with computed counts
- One centralized game catalog (`catalog.js`) — new games appear on the
  homepage, category pages and search without touching HTML
- Player shelves with zero backend: favorites, recently played,
  collections, ratings, notes, per-game stats and recent searches, all
  in one `localStorage` namespace (`gamehub:*`) with corruption-safe
  parsing and an in-memory fallback when storage is blocked
- Reusable per-game launcher (`launcher.js`) with cover, loading,
  running, blocked and error states, a live status area, responsive
  viewport, fullscreen, restart and close — plus favorite toggle,
  personal stats, hosting attribution ("Hosted by GameHub" vs
  "Provided by <provider>"), controls and catalog-driven related
  games on every game page
- Minecraft-ready: WebGL client slots, per-version pages, placement
  docs and a central client configuration (`client-config.js`) that
  can point each slot at a legally obtained HTTPS-hosted client
  without rebuilding anything
- Original SVG artwork only — no copyrighted game assets, no fake
  publisher logos
- Accessible: skip link, semantic landmarks, ARIA dialog/combobox/
  listbox search, real buttons, keyboard-friendly controls, visible
  focus states, `prefers-reduced-motion` support
- Zero dependencies, zero build step, zero console errors, committed
  test suites

## The 3.0 platform layer

Everything below is client-side only. The whole personal layer lives in
`localStorage` under the single `gamehub:` prefix and degrades to an
in-memory store when storage is blocked (private mode, disabled
cookies) — the site stays fully usable either way.

| Module | Responsibility |
| ------ | -------------- |
| `theme.js` | Applies and remembers the colour theme (`gamehub:theme`); injects the header switcher |
| `profile.js` | Profile document, collections, ratings, notes, playtime and session tracking, day log, statistics, `clearAll()` |
| `achievements.js` | 20 achievement definitions, progress evaluation, unlock storage, toast notifications |
| `search.js` | Global search overlay: ranking, DOM rendering, keyboard model, recent searches |
| `session.js` | Play-page playtime sessions (flushed every 15 s and on `pagehide`) |
| `game-page.js` | Per-game panels: rating, notes, collections, activity, game-specific achievements |
| `profile-page.js` | Profile page controller (statistics, avatar picker, collections, ratings, notes, reset) |
| `category-page.js` | Category landing pages rendered from catalog data |
| `pwa.js` | Registers `service-worker.js` relative to the site root, on http(s) only |

### Profile & storage

One namespace, one parser. Every read goes through a corruption-safe
`readJson` that discards broken values instead of throwing; every write
is wrapped so a full or blocked `localStorage` can never break a page.
Keys used: `profile`, `favorites`, `recent`, `plays`, `playtime`,
`session`, `days`, `achievements`, `ratings`, `notes`, `playlater`,
`completed`, `searches`. The profile page can wipe everything with one
**Clear data** action (`profile.clearAll()`), and per-game storage
written by the games themselves (`gh_*` keys) is listed but never
touched by the platform.

### Themes

Dark (default), Midnight and Light. The theme is stored in
`gamehub:theme`, applied to `<html data-theme>` before first paint,
mirrored to `<meta name="theme-color">`, and switched by real
`<button>` elements (`[data-theme-set]`, `aria-pressed`) in the header
and on the profile page. First visit honours `prefers-color-scheme`.

### Achievements

20 original definitions: first launch, 5 and 10 different games, 25
total launches, first and fifth favorite, first highscore, high scores
in 5 games, 3 categories, 3 and 7 distinct days, 5 Puzzle games, any
Racing game, 3 Play Later entries, 5 Completed games, 5 personal
ratings, first note — plus per-game milestones (Snake 100, Air Hockey
streak 5, Tower Tactics wave 10). Definitions are plain data with
inline SVG icons; progress is computed from existing player data and
re-checked whenever a `gamehub:change` event fires. The UI shows
locked, unlocked, progress percentage and unlock date.

### Collections, ratings and notes

Favorites, Play Later and Completed each get their own card button and
appear on the game page and the profile page. Ratings are 1–5 stars
stored per game; the wording everywhere is deliberately personal
("My rating"), never a global score. Notes are one per game, capped at
500 characters, saved explicitly, and rendered with `textContent` —
HTML or script input is displayed as literal text, never executed.

### Continue Playing

The homepage rail reuses the existing recent-play list (no second
tracking system): newest first, deduplicated by game id, capped at six
entries, and hidden entirely when empty.

### Global search

`Ctrl+K` (or `/`) opens a real overlay dialog with a combobox input and
a listbox of results. Ranking weighs title matches first, then
category, tags, type, provider, version and description; results are
full game cards' worth of information with keyboard navigation,
`aria-activedescendant`, Home/End, Escape, and a "See all results" row
that hands the query to the homepage's `?q=…#games` view. Recent
searches are stored locally (max 8) and the homepage's existing URL
search behaviour is untouched.

### Category pages

`categories/<slug>/index.html` exists for all ten categories and is
generated, not hand-maintained: title, description, count, colour dot,
featured/popular/recent rails where data exists, the complete grid,
tag-derived chips and an empty state all come from `catalog.js`
helpers. Category pages load catalog → player → profile →
achievements → cards → search → `category-page.js` (never the
launcher).

### Multiplayer metadata

```js
multiplayer: true,
multiplayerMode: "local"   // "local" | "online", required when multiplayer is true
```

`"online"` is only ever set when a real backend/protocol exists — today
none do, so every multiplayer entry is `"local"` (shared keyboard or
pointer, two players on one device). `tests/platform.mjs` fails the
build if an entry claims online play without a backend.

### PWA / offline

`manifest.webmanifest` describes an installable app (standalone, `./`
scope, original icons: two SVGs and three PNGs). `service-worker.js`
precaches the local shell (HTML, CSS, JS, manifest, icons) and uses
network-first navigation with a cache fallback. It is deliberately
strict: same-origin `GET` only, `/client/` paths are never cached, and
cross-origin requests (provider games, external links) are never
intercepted or stored. Registration happens in `pwa.js` and requires
`http(s):`, so `file://` previews are unaffected.

## Supported game types

| Type       | How it launches                                                          |
| ---------- | ------------------------------------------------------------------------ |
| `html5`    | Verifies the local game page exists, then navigates to it                |
| `iframe`   | Embeds the game in a responsive viewport — a local bundle or an official provider embed streamed over HTTPS |
| `webgl`    | Embeds a WebGL client (e.g. Eaglercraft) in a large viewport             |
| `wasm`     | Embeds a WebAssembly client in a large viewport                           |
| `external` | Shows a clear "Open game" hand-off panel linking to the provider's HTTPS page in a new tab — GameHub never auto-navigates away |

WebGL/WASM clients resolve in a strict order:

1. **Local client** — `games/<slug>/client/index.html` (verified with a
   lightweight HEAD request, only after Play is pressed)
2. **Configured HTTPS client** — the URL set for the slug in
   `client-config.js` (used when no local client exists)
3. **Honest error** — a friendly message naming the expected location.
   Never a fake loading screen, never "Available" without a client.

Anything missing fails gracefully (`Game currently unavailable` + the
exact reason) instead of pretending to work. Game clients are never
preloaded: the homepage and game pages only ever issue tiny HEAD
requests, and the client itself loads exclusively inside the Play
viewport.

## Provider games (iframe & external)

GameHub mixes its own games with real games from external providers,
CrazyGames-style. Two integration modes exist:

- **`iframe` with a remote `playUrl`** — the game is officially
  embeddable by its provider and streams inside GameHub's own launcher
  viewport: lazy-loaded (the iframe is only created after Play),
  fullscreen, restart and close work exactly like local games. These
  appear in the homepage's **Play Online** rail.
- **`external`** — the provider does not permit embedding (X-Frame-
  Options / CSP), so Play shows a clear hand-off panel ("Open game",
  new tab, `rel="noopener noreferrer"`). GameHub stays open in the
  original tab. These appear in the **External Games** rail.

Every remote entry carries provider metadata:

```js
provider: "GameDistribution",                  // display name
externalUrl: "https://gamedistribution.com/games/one-more-pass/",
                                              // the provider's game page
playUrl: "https://html5.gamedistribution.com/<id>/?gd_sdk_referrer_url=https://bmeesss.github.io/GameHub/games/one-more-pass/index.html"
```

- `provider` powers the card badge, the "Provided by X" pill and
  hosting row on the game page, search matching and the neutral
  disclaimer: *"Game provided by X. GameHub does not host the game
  files."* Local games show "Hosted by GameHub" instead.
- `externalUrl` is the target of every "Open game" fallback button.
- The GameDistribution embed URLs carry a `gd_sdk_referrer_url`
  parameter pointing at the game's page on the canonical GitHub Pages
  deployment — their SDK documents this as the correct integration
  (bare URLs still work but degrade ad performance for the provider).
  Update it if you deploy under a different host.

### The current provider batch

| Game | Provider | Mode | Why |
| ---- | -------- | ---- | -- |
| One More Pass | GameDistribution | iframe | official embed platform, no frame restrictions |
| Tennis Masters 2026 | GameDistribution | iframe | official embed platform |
| Racing in City | GameDistribution | iframe | official embed platform |
| Moto X3M Dead Ahead | GameDistribution | iframe | official embed platform |
| Stellar Bastion | GameMonetize | iframe | official embed platform |
| Sort the Court! | itch.io | external | itch.io serves no permissive embeds — deep link only |
| Stickman Hook | Poki | external | Poki blocks embedding — deep link only |

Only providers whose business model *is* embedding (GameDistribution,
GameMonetize serve `html5.*` embed endpoints specifically for framing)
are used in iframe mode; everybody else gets honest deep links.

### Blocked embeds and the watchdog

Cross-origin iframes cannot be inspected from the outside, so
embeddability is decided by curation (only official embed endpoints)
and enforced best-effort at runtime:

- Remote embeds start under a **15-second load watchdog**. If the
  iframe shows no sign of life, a blocked overlay appears:
  *"This game cannot be embedded here."* with **Open game** (provider
  page, new tab), **Try again** and **Keep waiting**.
- The iframe is never destroyed — a slow-but-working game keeps
  loading underneath, "Keep waiting" dismisses the overlay, and a late
  `load` event clears it automatically and flips the status to
  "Running".
- While any remote game is embedded, the toolbar keeps a persistent
  **Open game** link to the provider page — a one-click escape hatch
  even when no overlay is showing.

### How to add a provider game

1. **Research first** — verify the game's official page, the official
   embed URL (if any), whether framing actually works, and that
   linking/embedding is appropriate for that provider. Never scrape,
   mirror or bypass X-Frame-Options/CSP.
2. Append a catalog entry: `type: "iframe"` with the https embed URL
   as `playUrl` (plus `embed: { allow: "autoplay; fullscreen;
   gamepad; pointer-lock" }`), or `type: "external"` with the
   provider's page as `playUrl`. Always set `provider` and
   `externalUrl` (both https; `tests/check.py` enforces this on every
   remote entry).
3. Copy `games/one-more-pass/index.html` (iframe) or
   `games/stickman-hook/index.html` (external) as the page template —
   it carries `data-provider`, `data-external-url`, the provider pill
   and the neutral disclaimer notice.
4. Add an original `assets/thumbnails/<slug>.svg` (640×360). Never
   use provider logos or ripped artwork.
5. Run the test suites. The Play Online / External Games rails,
   category chips, type chips and search pick the game up
   automatically.

## Project structure

```text
GameHub/
├── index.html                  # Homepage (all rails render from catalog)
├── style.css                   # Design system (CSS variables, all themes)
├── theme.js                    # Theme engine (dark/midnight/light) — head
├── catalog.js                  # Game catalog + filters/sorts (source of truth)
├── client-config.js            # Central Minecraft/WebGL client URLs
├── player.js                   # Favorites/recent/plays/stats/searches
├── profile.js                  # Profile, collections, ratings, notes, playtime
├── achievements.js             # 20 achievements, progress + unlock state
├── cards.js                    # Shared game-card renderer + card tools
├── search.js                   # Global search overlay (Ctrl+K / "/")
├── session.js                  # Play-page playtime sessions
├── game-page.js                # Per-game platform panels (rating, notes…)
├── profile-page.js             # Profile page controller
├── category-page.js            # Category landing page controller
├── script.js                   # Homepage controller (rails, search, sort)
├── launcher.js                 # Reusable per-game launcher runtime
├── pwa.js                      # Service-worker registration bootstrap
├── service-worker.js           # Offline shell cache (local assets only)
├── manifest.webmanifest        # Installable-app manifest
├── assets/
│   ├── favicon.svg
│   ├── icon.svg                # App icon (any-purpose)
│   ├── icon-maskable.svg       # App icon (maskable, safe zone)
│   ├── icon-192.png            # Generated PNG icons (192/512/maskable 512)
│   └── thumbnails/             # One SVG per game: <slug>.svg
├── profile/
│   └── index.html              # Profile page
├── categories/
│   └── <category-slug>/
│       └── index.html          # Catalog-generated category landing page
├── games/
│   └── <game-slug>/
│       ├── index.html          # Launcher page (Play/fullscreen/back)
│       ├── play/               # local HTML5 game bundle (index.html, game.js, style.css)
│       ├── embed/              # (optional) local iframe game files
│       └── client/             # (optional) local WebGL/WASM client files
├── tests/
│   ├── smoke.mjs               # Runtime + architecture: node tests/smoke.mjs
│   ├── games.mjs               # Per-game harness: node tests/games.mjs
│   ├── platform.mjs            # 3.0 platform layer: node tests/platform.mjs
│   └── check.py                # Static checks: python3 tests/check.py
├── 404.html                    # Self-contained not-found page
├── .nojekyll                   # Disables Jekyll on GitHub Pages
└── README.md
```

## The catalog

`catalog.js` holds the `GAMES` array — the single source of truth —
plus the shared filter/sort/related helpers (`window.GameHubCatalog`).
Every entry supports:

```js
{
  id: "my-game",                 // unique, matches slug by convention
  title: "My Game",
  slug: "my-game",               // folder name under games/
  description: "One or two sentences.",
  category: "Arcade",            // drives category chips + rails
  thumbnail: "assets/thumbnails/my-game.svg",  // or null for generated art
  featured: false,               // shows in Featured rail
  popular: false,                // shows in Popular rail
  status: "available",           // "available" | "coming-soon"
  type: "html5",                 // html5 | iframe | external | webgl | wasm
  version: "1.0.0",              // shown on the game page
  playUrl: "games/my-game/play/index.html",    // or https URL, or null
  embed: null,                   // or { sandbox, allow } iframe overrides
  tags: ["single-player"],       // lowercase search keywords
  // --- optional (rendering never breaks when missing) ---
  releaseDate: "2026-09-25",     // YYYY-MM-DD, drives New Games + newest sort
  controls: "How to play…",      // shown in the game page How-to box
  difficulty: "Medium",          // Easy | Medium | Hard
  featuredOrder: 1,              // ordering inside the Featured rail
  popularOrder: 1,               // ordering inside the Popular rail
  multiplayer: false,            // true when more than one player shares a device
  multiplayerMode: "local",      // required when multiplayer is true: "local" | "online"
  // --- remote provider games only (see "Provider games") ---
  provider: "GameDistribution",  // "Provided by X" attribution
  externalUrl: "https://…"       // provider game page (https, fallback target)
}
```

Rules:

- Append new entries **last** — entries without `releaseDate` fall back
  to tail-of-array order, newest first.
- `playUrl` for local games is relative to the **site root**
  (`games/<slug>/play/index.html`). For remote entries (`iframe` from
  a provider, or `external`) it must be a full `https://` URL —
  `tests/check.py` refuses anything else, and remote entries must also
  declare `provider` + `externalUrl`. Use `null` when nothing is wired
  up yet.
- `embed` overrides iframe attributes, e.g.
  `{ sandbox: "allow-scripts", allow: "fullscreen" }`. Provider embeds
  intentionally use **no sandbox** — their ad/SDK layer needs storage
  access; sandboxing is for content you host yourself.
- `provider`/`externalUrl` are only allowed on remote entries.
- `multiplayerMode` is only allowed when `multiplayer: true`, and
  `"online"` is only allowed when a real backend/protocol exists. Until
  one does, every multiplayer game is `"local"` (two players, one
  device). `getMultiplayerGames()`, `getLocalMultiplayerGames()` and
  `getOnlineMultiplayerGames()` expose the split, and the card UI shows
  a multiplayer pill on those entries.
- `tests/check.py` and `tests/platform.mjs` both enforce the field
  rules; the platform suite fails if a game ever claims online play
  without a backend.
- The game page's `data-*` attributes must mirror the catalog entry
  (`tests/check.py` enforces this).

## How to add a normal HTML5 game

1. Append a catalog entry with `type: "html5"`,
   `playUrl: "games/<slug>/play/index.html"`, plus `releaseDate`,
   `controls` and `difficulty`.
2. Copy any page under `games/` to `games/<slug>/index.html` and update
   the title, description, category, artwork path, OG tags and the
   `#launcher` `data-*` config (`data-type="html5"`,
   `data-play-url="play/index.html"` — page-relative). Keep the four
   module scripts (`catalog.js`, `player.js`, `cards.js`,
   `launcher.js`): favorites, stats, controls and related games are
   injected from the catalog automatically.
3. Add `assets/thumbnails/<slug>.svg` (640×360, original art).
4. Put the game itself in `games/<slug>/play/` as a self-contained
   bundle: `index.html` + `game.js` + `style.css`, with no external
   URLs. Every game needs a start screen, a game-over/restart flow,
   a score or objective, keyboard + touch controls, instructions,
   and pause where it makes sense (see the existing games for the
   pattern). Persist best scores as plain numbers under
   `gh_best_<slug>` in `localStorage` and register the key in
   `player.js` (`BEST_SCORES`) so the game page can display it.
5. Run `node tests/smoke.mjs && node tests/games.mjs &&
   python3 tests/check.py`.

## How to add an iframe game

**Local embed:** same as an HTML5 game, with `type: "iframe"` and
`playUrl: "games/<slug>/embed/index.html"`
(`data-play-url="embed/index.html"` on the page). Only embed content
you host yourself or that explicitly permits framing. Use `embed` /
`data-embed-sandbox` to sandbox untrusted content
(see Security below).

**Remote provider embed:** see "Provider games (iframe & external)"
above — `type: "iframe"` with an https `playUrl`, plus `provider`
and `externalUrl`.

## How to add a WebGL/WASM game

1. Catalog entry with `type: "webgl"` (or `"wasm"`) and
   `playUrl: "games/<slug>/client/index.html"`.
2. Game page with `data-type="webgl"` and
   `data-play-url="client/index.html"`.
3. Place the client build (its `index.html` plus JS/WASM/data files) in
   `games/<slug>/client/`, all paths relative — or configure a hosted
   HTTPS client in `client-config.js` (see below).
4. The launcher embeds it in a large responsive viewport with
   fullscreen support — only after Play is pressed. While the catalog
   `status` stays `"coming-soon"`, the game page and cards flip to
   "Available" automatically once a client is present (local file
   verified, or a valid HTTPS URL configured).

## How to add an Eaglercraft client

GameHub is **Eaglercraft-ready, not Eaglercraft-bundled**. Placeholder
entries (`Eaglercraft 1.8`, `EaglercraftX 1.8`, `Eaglercraft 1.12.2`)
already exist with working launcher pages that clearly state the client
is missing. There are two ways to make one playable — no rebuild, no
code changes either way:

### Option A — ship the client locally

1. Obtain a browser client build you are **legally allowed to
   redistribute**. Examples of legitimate sources, depending on your
   situation:
   - an open-source client whose license permits redistribution
     (keep its license file with the build),
   - a client you wrote yourself,
   - a build the rights holder explicitly allowed you to host.
2. If the client needs Mojang-copyrighted assets (textures, sounds,
   `assets.epk`-style packs) that you may **not** redistribute, do not
   commit them. Either ship the client asset-free (many clients can
   load vanilla assets from the player's own files at runtime) or do
   not publish the game at all.
3. Copy the build into the matching folder, e.g.:

   ```text
   games/eaglercraft-1-8/client/
   ├── index.html
   └── ... (client JS, WASM, data)
   ```

   Each `client/` folder has a README describing the expected layout.
4. Keep every client-internal path relative so it works under the
   `/GameHub/` project URL.
5. The launcher, game page and homepage cards detect the client
   automatically (tiny HEAD check). Optionally flip the catalog
   entry's `status` to `"available"` so the static HTML matches.

### Option B — point at your own HTTPS-hosted client

Edit `client-config.js` (one line per slot):

```js
clients: {
  "eaglercraft-1-8": { url: "https://clients.example.com/e18/index.html" },
  "eaglercraftx-1-8": null,   // keep null to rely on a local client
  "eaglercraft-1-12": null
}
```

Rules and behavior:

- The URL **must be HTTPS** — HTTP is refused everywhere (no mixed
  content, ever).
- A local client in `games/<slug>/client/` always wins; the configured
  URL is the automatic fallback when no local client exists.
- `tests/check.py` fails the build if a configured URL is not HTTPS,
  and every slot must keep an entry (use `null` for "local only").
- The remote host must permit iframe embedding. If it sends
  `X-Frame-Options: DENY` or a restrictive `Content-Security-Policy`
  `frame-ancestors`, the client cannot render inside the GameHub
  viewport — after 15 seconds the launcher status area explains this
  and offers an "open the client in a new tab" escape hatch instead of
  showing a blank frame. There is no way for GameHub to bypass such
  headers; host the client somewhere that allows framing (your own
  static host does by default).
- Configure only clients you are legally allowed to serve. GameHub
  never downloads, mirrors or bundles client files itself.

To add a future version (e.g. 1.20.x): append a catalog entry, copy a
game page to `games/eaglercraft-1-20/index.html`, add a thumbnail,
create `games/eaglercraft-1-20/client/README.md` following the existing
ones and add a slot in `client-config.js`. The Minecraft rail, nav
filter and type chips pick it up automatically.

## Local preview

Any static file server works. From the repository root:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

> The server is only for previewing. The site has no server-side code
> and behaves identically from any static host. Note: availability
> probing is skipped under `file://`, so always preview over HTTP.

## Tests

```bash
node tests/smoke.mjs     # catalog, search, filters, sorting, player data,
                         # favorites, URL hydration, launcher flows,
                         # Minecraft client resolution (local/HTTPS/
                         # missing/HTTP), the external-game architecture
                         # (remote URL validation, blocked-embed fallback,
                         # provider rails/metadata) + on-disk integrity
node tests/games.mjs     # per-game runtime harness (all 61 play bundles:
                         # each bundle boots, renders, responds to input and
                         # stores progress under its own gh_* key)
node tests/platform.mjs  # 3.0 platform layer: profile storage + corruption,
                         # notes/XSS escaping, themes, achievements,
                         # sessions/playtime, multiplayer + provider
                         # metadata, card escaping, category pages, PWA
                         # files, shared navigation, inline-handler audit
python3 tests/check.py   # links, fragments, configs, artwork, Pages
                         # rules, client-config + provider discipline
```

All four are dependency-free (Node.js and Python 3 standard libraries
only — dev tools, not site dependencies). Run them from the repository
root; they are the contract for every catalog or page change.

## Deploying to GitHub Pages

1. Push the branch to GitHub.
2. Open the repository → **Settings → Pages**.
3. **Source:** Deploy from a branch → your branch → `/ (root)` → Save.
4. Open **https://bmeesss.github.io/GameHub/** after a minute.

Notes:

- `.nojekyll` is required — Pages must serve the site as plain files.
- Everything is relative, so the same code works at a project URL,
  user URL, custom domain or localhost.
- Large clients stay out of the homepage bundle: each loads only when
  its game page's Play button is pressed.
- The service worker (`service-worker.js`) is registered by `pwa.js`
  only over `https:`/`http:` — Pages serves over HTTPS, so the site
  becomes installable there. It caches **local shell files only**;
  provider games, remote embeds and `games/*/client/` files are never
  cached or served from the cache. Bump `CACHE_NAME` when the shell
  changes.
- The manifest lives at the site root; icons are generated PNG/SVG files
  under `assets/` and must keep their relative paths for the same
  project-URL portability.

## Path rules

- NEVER root-absolute: `/assets/...`, `/games/...`, `/index.html`.
- Homepage: `style.css`, `theme.js`, `catalog.js`, `client-config.js`,
  `player.js`, `profile.js`, `achievements.js`, `cards.js`, `search.js`,
  `script.js`, `pwa.js`, `manifest.webmanifest`, `assets/...`.
- Game pages (two levels deep): `../../style.css`, `../../theme.js`
  (head), later `../../catalog.js`, `../../player.js`, `../../profile.js`,
  `../../achievements.js`, `../../cards.js`, `../../client-config.js`,
  `../../search.js`, `../../launcher.js`, `../../game-page.js`,
  `../../pwa.js`, `../../assets/...`.
- Play bundles (three levels deep) load only their sibling
  `style.css`/`game.js` plus `../../../session.js` with a
  `data-game="<slug>"` attribute, which is how playtime is attributed.
- Category pages (two levels deep) load the platform modules and
  `category-page.js` — never `launcher.js`.
- Homepage and `profile/index.html` must never load `launcher.js`:
  game clients stay off those pages.
- Catalog `playUrl` is root-relative; game-page `data-play-url` is
  page-relative — both must resolve to the same file.
- `search.js` derives its own path prefix from its `<script src>`, so
  every page must include it with the correct relative depth.
- `404.html` is self-contained (inline CSS/JS) since Pages can serve it
  from any depth; it reads the theme from `localStorage` directly.

## Security considerations

- **Remote game URLs:** every remote target (provider embed, external
  link, configured client) passes one central validator
  (`validateRemoteUrl` in `launcher.js`): **HTTPS only** (HTTP is
  refused everywhere — no mixed content, ever), no credentials in the
  URL, no `javascript:`/`data:` schemes. URLs come exclusively from
  the catalog and page config — never from user input — and
  `tests/check.py` re-verifies them statically. Review every external
  URL before publishing; you are sending players there.
- **External games:** `type: "external"` never embeds anything. Play
  shows a hand-off panel; the provider's page opens in a new tab with
  `rel="noopener noreferrer"`. GameHub never auto-navigates the
  current tab away.
- **Provider embeds:** only officially embeddable endpoints are used
  (see "Provider games"). They intentionally ship **without** a
  sandbox attribute — the providers' ad/SDK layer requires storage
  access — so they are third-party content running in a frame on our
  pages; that is the standard deal for embeddable game platforms.
- **Iframe embeds you host:** default `allow` is limited to
  `autoplay; fullscreen; gamepad; pointer-lock`. For content you do not
  fully trust, set `embed.sandbox` (e.g. `"allow-scripts"`) and omit
  `allow-same-origin` so the embed cannot touch GameHub's origin.
- **No frame-header bypassing:** GameHub never scrapes, proxies or
  otherwise circumvents `X-Frame-Options` or CSP `frame-ancestors`.
  Sites that refuse framing get a deep link (`type: "external"`),
  nothing more.
- **Local clients** (your own HTML5/WebGL/WASM builds) run unsandboxed
  by default since over-sandboxing breaks storage, pointer lock and
  WebGL. Only ship code you trust — treat `games/*/` like first-party
  code and review it accordingly.
- **No secrets:** the site is 100% static and public; never commit API
  keys, tokens or private URLs.
- **User-controlled content:** display names, notes, ratings and
  recent searches are rendered exclusively with `textContent` (never
  `innerHTML`), so `<script>`/`<svg onload=…>` payloads are displayed
  as literal text. Display names additionally strip `<`/`>` and cap at
  24 characters; notes cap at 500. `tests/platform.mjs` feeds hostile
  payloads through the real rendering paths and asserts no element or
  event-handler attribute is ever created.
- **`innerHTML` uses are audited:** every remaining `innerHTML` write
  in the codebase builds trusted, catalog- or constant-derived markup
  (icons, pills, templates). Catalog text passes through `escapeHtml`
  in `cards.js` before it is interpolated at all.
- **No inline event handlers:** there is no `onclick=`/`onload=` in any
  shipped file — all behaviour is delegated or bound with
  `addEventListener`, and a test asserts it.
- **Search input:** the overlay never echoes the query as HTML, never
  navigates to a URL built from raw input (the "See all results" row
  uses a fixed `index.html?q=` prefix and re-encodes), and result rows
  are created as DOM nodes, not markup strings.
- **Storage parsing:** every `localStorage` read is wrapped and
  type-checked; corrupt JSON, wrong types and out-of-range values fall
  back to safe defaults instead of throwing. No `eval`, no `Function`,
  no `setTimeout("string")` anywhere in the codebase.
- **Iframe sources** are limited to the catalog's curated HTTPS URLs;
  no user input can ever set a frame `src`, and no page allows arbitrary
  `javascript:` or `data:` URLs.
- Advise players to use official server addresses with voxel clients
  and never enter Mojang/Microsoft credentials into third-party pages.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Missing
APIs (History, Fullscreen, `fetch`, `IntersectionObserver`) degrade
gracefully without errors.

## Roadmap

- More original games across every category
- More voxel client versions as legal builds become available
- Optional: combined category+type filtering on top of the existing
  category and type chips
- Optional: export/import of local player data (still no accounts)
- Optional: real online multiplayer — only with an actual backend and
  protocol, never a simulated lobby

## Assets & license

All artwork in `assets/` is original SVG created for this project —
no third-party or copyrighted game assets, no official Minecraft logos.
Every playable title under `games/*/play/` is original code and art
created for GameHub. If a third-party game is ever added, its license
file and attribution must ship alongside it and be noted here.
