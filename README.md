# GameHub

GameHub is a free browser gaming platform: a fast, fully static website
where players browse HTML5, iframe, WebGL, WASM and external games —
including a dedicated Minecraft section for Eaglercraft-style voxel
clients — and launch them instantly. No backend, no database, no build
step: just HTML, CSS and vanilla JavaScript. The catalog ships 58
games: 46 original playable titles, 7 real games streamed from or
linked to official providers (GameDistribution, GameMonetize, itch.io,
Poki) and 5 coming-soon placeholders (including the Minecraft client
slots).

Live project page (once Pages is enabled):

**https://bmeesss.github.io/GameHub/**

> GameHub does **not** ship Minecraft itself. Voxel clients (Eaglercraft
> builds, texture packs, `assets.epk`-style files) are never downloaded,
> mirrored or bundled by this project. Where a game needs files we cannot
> legally redistribute, the launcher stays honest about it and the guides
> below explain exactly where to place your own legally sourced build.

## Features

- Modern dark gaming interface, responsive from mobile to desktop
- Homepage discovery: Spotlight, Play Again, Favorites, Featured,
  Popular, Minecraft, Play Online, External Games, New Games,
  sortable All Games, Categories
- 53 playable games: 46 original GameHub games (each self-contained
  under `games/<slug>/play/` with keyboard + touch controls — newest:
  Stack Tower, Sky Jump, Stellar Siege, Slide Puzzle, Glow Grid,
  Air Hockey, Reversi, Idle Miner, Road Rush, Ember Keep) plus
  7 real games from official providers
- Provider games, CrazyGames-style: 5 officially embeddable games
  (GameDistribution, GameMonetize) stream inside GameHub's own
  launcher viewport, and 2 more (itch.io, Poki) deep-link to the
  provider's page through a clear hand-off panel — every provider
  game gets the same professional detail page as a local game
- Live search (titles, descriptions, categories, types, tags,
  versions, providers) with recent searches, shareable URLs
  (`?q=...`, `?category=...`, `?type=...`, `?sort=...`,
  `?favorites=1`), result counts and an empty state
- Catalog-generated filters: categories plus game-type labels
  (HTML5, Iframe, WebGL, WASM, External) with computed counts
- One centralized game catalog (`catalog.js`) — new games appear on
  the homepage without touching homepage HTML
- Player shelves with zero backend: favorites, recently played,
  per-game stats and recent searches, all in `localStorage`
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
- Accessible: skip link, semantic landmarks, keyboard-friendly controls,
  visible focus states, `prefers-reduced-motion` support
- Zero dependencies, zero console errors, committed test suites

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
├── style.css                   # Design system (CSS variables, launcher UI)
├── catalog.js                  # Game catalog + filters/sorts (source of truth)
├── client-config.js            # Central Minecraft/WebGL client URLs
├── player.js                   # Favorites/recent/stats/searches (localStorage)
├── cards.js                    # Shared game-card renderer + favorite toggles
├── script.js                   # Homepage controller (rails, search, sort)
├── launcher.js                 # Reusable per-game launcher runtime
├── assets/
│   ├── favicon.svg
│   └── thumbnails/             # One SVG per game: <slug>.svg
├── games/
│   └── <game-slug>/
│       ├── index.html          # Launcher page (Play/fullscreen/back)
│       ├── play/               # local HTML5 game bundle (index.html, game.js, style.css)
│       ├── embed/              # (optional) local iframe game files
│       └── client/             # (optional) local WebGL/WASM client files
├── tests/
│   ├── smoke.mjs               # Runtime tests: node tests/smoke.mjs
│   ├── games.mjs               # Per-game harness: node tests/games.mjs
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
node tests/games.mjs     # per-game runtime harness (every play bundle)
python3 tests/check.py   # links, fragments, configs, artwork, Pages
                         # rules, client-config + provider discipline
```

All three are dependency-free (Node.js and Python 3 standard
libraries only — dev tools, not site dependencies).

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

## Path rules

- NEVER root-absolute: `/assets/...`, `/games/...`, `/index.html`.
- Homepage: `style.css`, `catalog.js`, `client-config.js`, `player.js`,
  `cards.js`, `script.js`, `assets/...`, `games/<slug>/`.
- Game pages (two levels deep): `../../style.css`,
  `../../catalog.js`, `../../player.js`, `../../cards.js`,
  `../../client-config.js`, `../../launcher.js`, `../../assets/...`.
- Catalog `playUrl` is root-relative; game-page `data-play-url` is
  page-relative — both must resolve to the same file.
- `404.html` is self-contained (inline CSS/JS) since Pages can serve it
  from any depth.

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
- Advise players to use official server addresses with voxel clients
  and never enter Mojang/Microsoft credentials into third-party pages.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Missing
APIs (History, Fullscreen, `fetch`, `IntersectionObserver`) degrade
gracefully without errors.

## Roadmap

- More original games across every category
- More voxel client versions as legal builds become available
- Optional: combined category+type filtering, per-game achievements
- Optional: export/import of local player data (still no accounts)

## Assets & license

All artwork in `assets/` is original SVG created for this project —
no third-party or copyrighted game assets, no official Minecraft logos.
Every playable title under `games/*/play/` is original code and art
created for GameHub. If a third-party game is ever added, its license
file and attribution must ship alongside it and be noted here.
