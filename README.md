# GameHub

GameHub is a free browser game hub: a fast, fully static website where players can
browse arcade, puzzle, action and strategy games and play them instantly.
No backend, no database, no build step — just HTML, CSS and vanilla JavaScript.

Once GitHub Pages is enabled, the site is served as a project page at:

**https://bmeesss.github.io/GameHub/**

## Features

- Modern dark gaming interface, responsive from mobile to desktop
- Hero section, featured games, full catalog, categories and popular games
- Live game search with shareable URLs (`?q=...`) and an empty-state UI
- Category filtering via chips and category cards
- Centralized JavaScript game catalog — one entry per game
- One page per game at `games/<slug>/`
- Original placeholder SVG artwork (no copyrighted assets)
- Accessible: skip link, semantic landmarks, keyboard-friendly controls,
  visible focus states and `prefers-reduced-motion` support
- Zero dependencies, zero console errors

## Project structure

```text
GameHub/
├── index.html                  # Homepage (catalog renders here)
├── style.css                   # Full design system (CSS variables)
├── script.js                   # Game catalog + search/filter/render logic
├── assets/
│   ├── favicon.svg
│   └── thumbnails/             # One SVG per game: <slug>.svg
├── games/
│   └── <game-slug>/
│       └── index.html          # One page per game
├── 404.html                    # Self-contained not-found page
├── .nojekyll                   # Disables Jekyll on GitHub Pages
└── README.md
```

## How to add a game

Adding a game takes three steps. No build, no other files to touch.

**1. Add a catalog entry** in `script.js` (`GAMES` array):

```js
{
  id: "my-game",
  title: "My Game",
  slug: "my-game",
  description: "One or two sentences about the game.",
  category: "Arcade",
  thumbnail: "assets/thumbnails/my-game.svg",
  featured: false,
  popular: false,
  status: "playable"
}
```

Field notes:

- `slug` must match the folder name in `games/` and the thumbnail filename.
- `thumbnail` is a path relative to the site root. Use `null` to fall back to
  generated gradient art instead of an image file.
- `status` is `"playable"` or `"coming-soon"`. Coming-soon games get a badge
  on their card.

**2. Create the game page** at `games/my-game/index.html`.

Copy any existing page under `games/` and update the title, description,
category and artwork path. All paths on game pages go up two levels:

- stylesheet: `../../style.css`
- favicon: `../../assets/favicon.svg`
- artwork: `../../assets/thumbnails/my-game.svg`
- home links: `../../index.html` (never `/` or `/index.html`)

**3. Add the thumbnail** at `assets/thumbnails/my-game.svg` (640×360).
Any original SVG/PNG/WebP works — just keep the catalog path in sync.

The homepage (featured, popular, categories, search, counts) updates
automatically from the catalog.

## Local preview

Any static file server works. From the repository root:

```bash
# Python (usually pre-installed)
python3 -m http.server 8080

# or Node
npx serve .
```

Then open http://localhost:8080/ in a browser.
VS Code's "Live Server" extension works too.

> The live server is only for previewing. The site itself has no
> server-side code and runs the same from any static host.

## Deploying to GitHub Pages

1. Push the branch to GitHub.
2. Open the repository on GitHub and go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select your branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
5. Wait a minute, then open **https://bmeesss.github.io/GameHub/**.

Notes:

- The `.nojekyll` file is required — it tells GitHub Pages to serve the
  site as plain static files.
- The site uses only relative paths, so it works identically at a project
  URL (`...github.io/GameHub/`), a user URL, a custom domain, or `localhost`.
- Every link and asset is verified relative — see "Path rules" below.

## Path rules (read before editing)

GitHub Pages project sites are hosted under a sub-path, so absolute
root paths break. Follow these rules:

- NEVER use root-absolute paths: `/assets/...`, `/games/...`, `/index.html`.
- Homepage assets: `style.css`, `script.js`, `assets/...`, `games/<slug>/`.
- Game pages (two levels deep): `../../style.css`, `../../assets/...`.
- In-page anchors (`#games`, `#categories`) are fine everywhere.
- `404.html` is fully self-contained (inline CSS, no external files) because
  GitHub Pages can serve it from any URL depth.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). No polyfills.
Where a browser API is missing (e.g. `IntersectionObserver`, History API),
features degrade gracefully without errors.

## Roadmap

- Replace placeholder entries with real playable browser games
- Per-game instructions/controls sections as games become playable
- More categories as the catalog grows
- Optional: tags, sorting and "recently added" rails

## Assets & license

All artwork in `assets/` (favicon and thumbnails) is original SVG created
for this project — no third-party or copyrighted game assets are used.
