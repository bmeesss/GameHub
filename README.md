# GameHub

GameHub is a free browser gaming platform: a fast, fully static website
where players browse HTML5, iframe, WebGL, WASM and external games —
including a dedicated Minecraft section for Eaglercraft-style voxel
clients — and launch them instantly. No backend, no database, no build
step: just HTML, CSS and vanilla JavaScript. The catalog ships 41
games: 36 original playable titles plus 5 coming-soon placeholders
(including the Minecraft client slots).

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
  Popular, Minecraft, New Games, sortable All Games, Categories
- 36 original playable games across Arcade, Puzzle, Casual, Action,
  Racing, Sports, Adventure and Strategy — each self-contained under
  `games/<slug>/play/` with keyboard + touch controls
- Live search (titles, descriptions, categories, types, tags,
  versions) with recent searches, shareable URLs (`?q=...`,
  `?category=...`, `?type=...`, `?sort=...`, `?favorites=1`), result
  counts and an empty state
- Catalog-generated filters: categories plus game-type labels
  (HTML5, Iframe, WebGL, WASM, External) with computed counts
- One centralized game catalog (`catalog.js`) — new games appear on
  the homepage without touching homepage HTML
- Player shelves with zero backend: favorites, recently played,
  per-game stats and recent searches, all in `localStorage`
- Reusable per-game launcher (`launcher.js`) with cover, loading,
  error and playing states, responsive viewport, fullscreen and
  restart support — plus favorite toggle, personal stats, controls
  and catalog-driven related games on every game page
- Minecraft-ready: WebGL client slots, per-version pages, placement docs
- Original SVG artwork only — no copyrighted game assets or logos
- Accessible: skip link, semantic landmarks, keyboard-friendly controls,
  visible focus states, `prefers-reduced-motion` support
- Zero dependencies, zero console errors, committed test suites

## Supported game types

| Type       | How it launches                                                        |
| ---------- | ---------------------------------------------------------------------- |
| `html5`    | Verifies the local game page exists, then navigates to it              |
| `iframe`   | Embeds the game in a sandboxed, responsive viewport                    |
| `webgl`    | Embeds a local WebGL client (e.g. Eaglercraft) in a large viewport     |
| `wasm`     | Embeds a local WebAssembly client in a large viewport                  |
| `external` | Navigates to a configured HTTPS URL (same tab, never embedded blindly) |

Local targets are verified with a lightweight HEAD request **only after
the user presses Play** — game clients are never preloaded on the
homepage. Anything missing fails gracefully (`Game currently
unavailable` + the exact reason) instead of pretending to work.

## Project structure

```text
GameHub/
├── index.html                  # Homepage (all rails render from catalog)
├── style.css                   # Design system (CSS variables, launcher UI)
├── catalog.js                  # Game catalog + filters/sorts (source of truth)
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
  popularOrder: 1                // ordering inside the Popular rail
}
```

Rules:

- Append new entries **last** — entries without `releaseDate` fall back
  to tail-of-array order, newest first.
- `playUrl` for local games is relative to the **site root**
  (`games/<slug>/play/index.html`). For `external` it must be a full
  `https://` URL. Use `null` when nothing is wired up yet.
- `embed` overrides iframe attributes, e.g.
  `{ sandbox: "allow-scripts", allow: "fullscreen" }`.
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

Same as above, with `type: "iframe"` and
`playUrl: "games/<slug>/embed/index.html"`
(`data-play-url="embed/index.html"` on the page). Only embed content
you host yourself or that explicitly permits framing. Use `embed` /
`data-embed-sandbox` to sandbox untrusted content
(see Security below).

## How to add a WebGL/WASM game

1. Catalog entry with `type: "webgl"` (or `"wasm"`) and
   `playUrl: "games/<slug>/client/index.html"`.
2. Game page with `data-type="webgl"` and
   `data-play-url="client/index.html"`.
3. Place the client build (its `index.html` plus JS/WASM/data files) in
   `games/<slug>/client/`, all paths relative.
4. The launcher embeds it in a large responsive viewport with
   fullscreen support — only after Play is pressed.

## How to add an Eaglercraft client

GameHub is **Eaglercraft-ready, not Eaglercraft-bundled**. Placeholder
entries (`Eaglercraft 1.8`, `EaglercraftX 1.8`, `Eaglercraft 1.12.2`)
already exist with working launcher pages that clearly state the client
is missing. To make one playable:

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
5. Set the catalog entry's `status` to `"playable"`.
6. Run the test suites and press Play to verify.

To add a future version (e.g. 1.20.x): append a catalog entry, copy a
game page to `games/eaglercraft-1-20/index.html`, add a thumbnail, and
create `games/eaglercraft-1-20/client/README.md` following the existing
ones. The Minecraft rail, nav filter and type chips pick it up
automatically.

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
                         # favorites, URL hydration, launcher flows
node tests/games.mjs     # per-game runtime harness (every play bundle)
python3 tests/check.py   # links, fragments, configs, artwork, Pages rules
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
- Homepage: `style.css`, `catalog.js`, `player.js`, `cards.js`,
  `script.js`, `assets/...`, `games/<slug>/`.
- Game pages (two levels deep): `../../style.css`,
  `../../catalog.js`, `../../player.js`, `../../cards.js`,
  `../../launcher.js`, `../../assets/...`.
- Catalog `playUrl` is root-relative; game-page `data-play-url` is
  page-relative — both must resolve to the same file.
- `404.html` is self-contained (inline CSS/JS) since Pages can serve it
  from any depth.

## Security considerations

- **External games:** only `https://` URLs are accepted, and they are
  navigated to — never embedded in a hidden iframe. Review every
  external URL before publishing; you are sending players there.
- **Iframe embeds:** default `allow` is limited to
  `autoplay; fullscreen; gamepad; pointer-lock`. For content you do not
  fully trust, set `embed.sandbox` (e.g. `"allow-scripts"`) and omit
  `allow-same-origin` so the embed cannot touch GameHub's origin.
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
