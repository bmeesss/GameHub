#!/usr/bin/env python3
"""GameHub static verification (dependency-free).
Run from the repo root:  python3 tests/check.py
Checks links, fragments, catalog integrity, launcher page configs,
relative-path discipline and GitHub Pages compatibility.
"""
import html.parser
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

errors = []
checks = 0


def fail(message):
    errors.append(message)


def ok():
    global checks
    checks += 1


class LinkParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        for attr in ("href", "src", "action"):
            if attr in attrs and attrs[attr] is not None:
                self.refs.append((tag, attr, attrs[attr]))


def site_html_files():
    out = []
    for dirpath, dirnames, files in os.walk("."):
        if ".git" in dirpath or dirpath.startswith("./tests"):
            continue
        for name in files:
            if name.endswith(".html"):
                out.append(os.path.normpath(os.path.join(dirpath, name)))
    return sorted(out)


def strip_query(url):
    return url.split("?", 1)[0]


HTML_FILES = site_html_files()
PARSED = {}
for path in HTML_FILES:
    with open(path, encoding="utf-8") as handle:
        parser = LinkParser()
        parser.feed(handle.read())
    PARSED[path] = parser

# ---- 1. Internal links resolve -------------------------------------------
for path in HTML_FILES:
    base = os.path.dirname(os.path.abspath(path))
    for tag, attr, url in PARSED[path].refs:
        if not url or url.startswith(("#", "http://", "https://", "mailto:", "data:", "javascript:")):
            continue
        target, _, fragment = strip_query(url).partition("#")
        if target in ("", "./"):
            continue  # same-page reference; fragments checked below
        full = os.path.normpath(os.path.join(base, target))
        if not os.path.exists(full):
            fail(f"{path}: <{tag}> {attr}={url!r} -> missing {full}")
ok()

# ---- 2. Fragment targets exist --------------------------------------------
for path in HTML_FILES:
    base = os.path.dirname(os.path.abspath(path))
    for tag, attr, url in PARSED[path].refs:
        if not url or url.startswith(("http://", "https://", "mailto:", "data:", "javascript:")):
            continue
        target, _, fragment = strip_query(url).partition("#")
        if not fragment:
            continue
        other = path if target in ("", "./") else os.path.normpath(os.path.join(base, target))
        rel = os.path.relpath(other, ".")
        if other.endswith(".html") and os.path.exists(other) and fragment not in PARSED[rel].ids:
            fail(f"{path}: {attr}={url!r} -> missing #{fragment} in {rel}")
ok()

# ---- 3. Catalog integrity -------------------------------------------------
js = open("script.js", encoding="utf-8").read()
match = re.search(r"const GAMES = \[(.*?)\n\];", js, re.S)
if not match:
    fail("script.js: GAMES catalog not found")
    ENTRIES = []
else:
    ENTRIES = re.split(r"\n  \},\n  \{", match.group(1).strip()[1:-1])

REQUIRED = ["id", "title", "slug", "description", "category", "thumbnail",
            "featured", "popular", "status", "type", "version", "playUrl", "embed", "tags"]
TYPES = {"html5", "iframe", "external", "webgl", "wasm"}
STATUSES = {"available", "coming-soon"}
catalog = []

for entry in ENTRIES:
    get = lambda f: (re.search(rf'\b{f}:\s*"([^"]*)"', entry) or [None, None])[1]
    get_raw = lambda f: (re.search(rf"\b{f}:\s*(\S+?)(,|\n)", entry) or [None, None])[1]
    game = {field: get(field) for field in ["id", "title", "slug", "description", "category", "thumbnail", "status", "type", "version"]}
    game["featured"] = get_raw("featured")
    game["popular"] = get_raw("popular")
    game["playUrl"] = None if re.search(r"\bplayUrl:\s*null", entry) else get("playUrl")
    game["embed"] = None if re.search(r"\bembed:\s*null", entry) else "object"
    tags = re.search(r"\btags:\s*\[(.*?)\]", entry, re.S)
    game["tags"] = re.findall(r'"([^"]+)"', tags.group(1)) if tags else None
    game["_missing"] = [f for f in REQUIRED if not re.search(rf"\b{f}\s*:", entry)]
    catalog.append(game)

print(f"catalog entries: {len(catalog)}")
for game in catalog:
    slug = game["slug"] or "?"
    if game["_missing"]:
        fail(f"catalog {slug}: missing fields {game['_missing']}")
    if game["id"] != slug:
        fail(f"catalog {slug}: id {game['id']!r} != slug")
    if game["type"] not in TYPES:
        fail(f"catalog {slug}: bad type {game['type']!r}")
    if game["status"] not in STATUSES:
        fail(f"catalog {slug}: bad status {game['status']!r}")
    if game["featured"] not in ("true", "false") or game["popular"] not in ("true", "false"):
        fail(f"catalog {slug}: featured/popular must be booleans")
    if not game["version"]:
        fail(f"catalog {slug}: empty version")
    if game["tags"] is None:
        fail(f"catalog {slug}: tags must be an array")
    elif any(tag != tag.lower() for tag in game["tags"]):
        fail(f"catalog {slug}: tags must be lowercase")
    thumb = game["thumbnail"]
    if thumb and not os.path.exists(thumb):
        fail(f"catalog {slug}: thumbnail missing: {thumb}")
    url = game["playUrl"]
    if url:
        if url.startswith("http"):
            if not url.startswith("https://"):
                fail(f"catalog {slug}: remote playUrl must be https")
            if game["type"] != "external":
                fail(f"catalog {slug}: remote playUrl only allowed for type external")
        elif not url.startswith(f"games/{slug}/"):
            fail(f"catalog {slug}: local playUrl must live under games/{slug}/, got {url}")
ok()

slugs = [g["slug"] for g in catalog]
if len(set(slugs)) != len(slugs):
    fail("catalog: duplicate slugs")
print(f"slugs: {', '.join(slugs)}")

# ---- 4. Game pages match the catalog --------------------------------------
for game in catalog:
    slug = game["slug"]
    page_path = os.path.join("games", slug, "index.html")
    if not os.path.exists(page_path):
        fail(f"catalog {slug}: missing {page_path}")
        continue
    page = open(page_path, encoding="utf-8").read()
    data = dict(re.findall(r'data-([a-z-]+)="([^"]*)"', page.split('<section class="launcher"')[1].split("</section>")[0] if '<section class="launcher"' in page else ""))
    for key, field in [("slug", "slug"), ("title", "title"), ("type", "type"), ("version", "version"), ("status", "status")]:
        if data.get(key) != game[field]:
            fail(f"{page_path}: data-{key}={data.get(key)!r} != catalog {game[field]!r}")
    url = game["playUrl"]
    if url and not url.startswith("http"):
        expected = url[len(f"games/{slug}/"):]
        if data.get("play-url") != expected:
            fail(f"{page_path}: data-play-url={data.get('play-url')!r}, expected page-relative {expected!r}")
    elif url and url.startswith("http"):
        if data.get("play-url") != url:
            fail(f"{page_path}: data-play-url mismatch for external URL")
    elif "data-play-url" in data:
        fail(f"{page_path}: data-play-url present but catalog playUrl is null")
    for token in ['id="launcher"', 'id="launcher-stage"', "launcher-fullscreen", "launcher-close", 'src="../../launcher.js"', 'class="breadcrumb"']:
        if token not in page:
            fail(f"{page_path}: missing launcher element {token}")
    if f"assets/thumbnails/{slug}.svg" not in page:
        fail(f"{page_path}: artwork path mismatch")
ok()

# ---- 5. Minecraft client dirs: docs present, no fake binaries --------------
for game in catalog:
    if game["category"] != "Minecraft":
        continue
    client_dir = os.path.join("games", game["slug"], "client")
    readme = os.path.join(client_dir, "README.md")
    if not os.path.exists(readme):
        fail(f"{client_dir}: missing placement README")
        continue
    body = open(readme, encoding="utf-8").read().lower()
    if "legally" not in body or "index.html" not in body:
        fail(f"{readme}: must explain legal placement + expected index.html")
    extra = [f for f in os.listdir(client_dir) if f != "README.md"]
    if extra:
        fail(f"{client_dir}: must not ship game files, found {extra}")
ok()

# ---- 6. Homepage rails, nav and filters ------------------------------------
index = open("index.html", encoding="utf-8").read()
for token in ["featured-grid", "popular-grid", "minecraft-grid", "new-grid",
              "games-grid", "categories-grid", "filter-bar", "empty-state",
              "search-form", "search-input", "results-count", "stat-games",
              "stat-categories", "year", 'href="?category=Minecraft#games"']:
    if token not in index:
        fail(f"index.html: missing {token}")
for slug in slugs:
    page = open(os.path.join("games", slug, "index.html"), encoding="utf-8").read()
    if "../../index.html?category=Minecraft#games" not in page:
        fail(f"games/{slug}: missing Minecraft nav link")
if "launcher.js" in index:
    fail("index.html: must not load launcher.js (game clients stay off the homepage)")
ok()

# ---- 7. Relative-path + hygiene discipline ---------------------------------
site_files = []
for dirpath, dirnames, files in os.walk("."):
    if ".git" in dirpath or dirpath.startswith("./tests"):
        continue
    dirnames[:] = [d for d in dirnames if d != "client"]  # client dirs stay empty by design
    for name in files:
        if name.endswith((".html", ".css", ".js", ".svg")):
            site_files.append(os.path.join(dirpath, name))

for path in site_files:
    body = open(path, encoding="utf-8").read()
    if re.search(r'(href|src|action)\s*=\s*"/', body):
        fail(f"{path}: root-absolute href/src/action (breaks project Pages URLs)")
    if path.endswith(".css") and re.search(r"url\(\s*/", body):
        fail(f"{path}: root-absolute url() in CSS")
    if path.endswith((".html", ".js")) and "console." in body:
        fail(f"{path}: console.* output left in site code")
    if re.search(r"TODO|FIXME|XXX|lorem", body, re.I):
        fail(f"{path}: placeholder text (TODO/FIXME/lorem)")
    if path.endswith(".svg"):
        try:
            ET.fromstring(body)
        except ET.ParseError as exc:
            fail(f"{path}: malformed SVG: {exc}")
        if "<script" in body.lower():
            fail(f"{path}: scripts forbidden in artwork")
        for color in re.findall(r'(?:fill|stroke|stop-color)="([^"]+)"', body):
            if color.startswith("url(") or color == "none":
                continue
            if not re.fullmatch(r"#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?", color):
                fail(f"{path}: invalid color {color}")
ok()

# ---- 8. GitHub Pages compatibility ------------------------------------------
if not os.path.exists(".nojekyll"):
    fail("missing .nojekyll (required for Pages)")
page404 = open("404.html", encoding="utf-8").read()
if re.search(r'<link[^>]+href="(?!#)', page404) or "<script src" in page404 or "<img" in page404:
    fail("404.html: must stay self-contained (inline CSS/JS only)")
launcher = open("launcher.js", encoding="utf-8").read()
for token in ['"html5"', '"iframe"', '"external"', '"webgl"', '"wasm"', "resolveLaunch", "requestFullscreen"]:
    if token not in launcher:
        fail(f"launcher.js: missing {token}")
if "node_modules" in os.listdir(".") or os.path.exists("package.json"):
    fail("site must stay dependency-free (no node_modules/package.json)")
ok()


# ---- 9. Available games are launchable + self-contained ---------------------
ids = [g["id"] for g in catalog]
if len(set(ids)) != len(ids):
    fail("catalog: duplicate ids")
available = [g for g in catalog if g["status"] == "available"]
print(f"available entries: {len(available)}")
for game in available:
    slug = game["slug"]
    url = game["playUrl"]
    if not url:
        fail(f"catalog {slug}: available game must declare playUrl")
        continue
    if url.startswith("http"):
        continue  # external URLs are verified at Play time, not here
    full = os.path.normpath(url)
    if not os.path.exists(full):
        fail(f"catalog {slug}: available playUrl missing: {url}")
    if game["type"] == "html5":
        for leaf in ("game.js", "style.css"):
            sibling = os.path.join(os.path.dirname(full), leaf)
            if not os.path.exists(sibling):
                fail(f"catalog {slug}: available html5 game missing {sibling}")
# Play bundles must be self-contained (no remote fetches or embeds).
for game in catalog:
    play_dir = os.path.join("games", game["slug"] or "?", "play")
    if not os.path.isdir(play_dir):
        continue
    for name in sorted(os.listdir(play_dir)):
        bundle = os.path.join(play_dir, name)
        if not os.path.isfile(bundle) or not name.endswith((".html", ".css", ".js", ".svg")):
            continue
        body = open(bundle, encoding="utf-8").read()
        if re.search(r"https?://|url\(\s*//|src\s*=\s*\"//|href\s*=\s*\"//", body):
            fail(f"{bundle}: remote URL in play bundle (games must be self-contained)")
ok()

print(f"\n{checks} check groups passed, {len(site_files)} site files scanned")
if errors:
    print(f"{len(errors)} ERRORS:")
    for message in errors:
        print(f" - {message}")
    sys.exit(1)
print("ALL STATIC CHECKS PASSED")
