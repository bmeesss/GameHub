/* ============================================================
   GameHub — game catalog (single source of truth)
   Every game page, rail, filter and related-games block reads
   this file. To add a game: append an entry + create
   games/<slug>/index.html + add assets/thumbnails/<slug>.svg
   (see README). Game pages are powered by launcher.js.
   Required entry fields: id, title, slug, description, category,
   thumbnail, featured, popular, status, type, version, playUrl,
   embed, tags.
   Optional entry fields (rendering must never break when they
   are missing): releaseDate, controls, difficulty, featuredOrder,
   popularOrder.
   Helpers are exposed as window.GameHubCatalog; classic scripts
   keep working from file:// with zero dependencies.
   Run tests with: node tests/smoke.mjs && python3 tests/check.py
   ============================================================ */
"use strict";

/* ---------------- Game catalog ----------------
   type:    "html5" | "iframe" | "external" | "webgl" | "wasm"
   status:  "available" | "coming-soon"
   version: free-form version string shown on the game page.
   playUrl: site-root-relative path (local game/client) or full
            https URL (external only). Null when not supplied yet.
            Local targets are verified at Play time, never preloaded.
   embed:   null or { sandbox, allow } iframe overrides.
   tags:    lowercase search/filter keywords.
   Newest entries are appended LAST (drives the New Games rail). */
const GAMES = [
  {
    id: "neon-breakout",
    title: "Neon Breakout",
    slug: "neon-breakout",
    description: "Smash through glowing brick waves with a light-charged paddle and chain massive combos.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/neon-breakout.svg",
    featured: false,
    popular: true,
    popularOrder: 5,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/neon-breakout/play/index.html",
    embed: null,
    tags: ["breakout", "single-player"],
    controls: "Move the paddle with the mouse or arrow keys. Bounce the ball to smash every brick.",
    difficulty: "Medium"
  },
  {
    id: "pixel-puzzles",
    title: "Pixel Puzzles",
    slug: "pixel-puzzles",
    description: "Guide falling blocks into perfect lines in this fast, brain-teasing arcade puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/pixel-puzzles.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/pixel-puzzles/play/index.html",
    embed: null,
    tags: ["blocks", "casual"],
    controls: "Arrow keys to move falling blocks, Up or Space to rotate, Down to drop faster.",
    difficulty: "Medium"
  },
  {
    id: "star-voyager",
    title: "Star Voyager",
    slug: "star-voyager",
    description: "Pilot a lone starfighter through asteroid storms and battle waves of cosmic raiders.",
    category: "Action",
    thumbnail: "assets/thumbnails/star-voyager.svg",
    featured: true,
    featuredOrder: 2,
    popular: true,
    popularOrder: 2,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/star-voyager/play/index.html",
    embed: null,
    tags: ["shooter", "space"],
    controls: "Arrow keys or WASD to fly, Space to shoot. Dodge asteroids and raiders.",
    difficulty: "Medium"
  },
  {
    id: "labyrinth-dash",
    title: "Labyrinth Dash",
    slug: "labyrinth-dash",
    description: "Race the clock through shifting mazes, grab time shards and find the exit before time runs out.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/labyrinth-dash.svg",
    featured: false,
    popular: true,
    popularOrder: 7,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/labyrinth-dash/play/index.html",
    embed: null,
    tags: ["maze", "time-attack"],
    controls: "Arrow keys or WASD to run the maze. Grab time shards and reach the exit before time ends.",
    difficulty: "Hard"
  },
  {
    id: "tower-tactics",
    title: "Tower Tactics",
    slug: "tower-tactics",
    description: "Build clever tower defenses, manage resources and hold the line against endless sieges.",
    category: "Strategy",
    thumbnail: "assets/thumbnails/tower-tactics.svg",
    featured: false,
    popular: true,
    popularOrder: 6,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/tower-tactics/play/index.html",
    embed: null,
    tags: ["tower-defense", "single-player"],
    controls: "Click a tower, then click the grid to build. Spend gold wisely and survive every siege.",
    difficulty: "Medium"
  },
  {
    id: "reaction-arena",
    title: "Reaction Arena",
    slug: "reaction-arena",
    description: "Test your reflexes in rapid-fire reaction trials and chase your best average time.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/reaction-arena.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/reaction-arena/play/index.html",
    embed: null,
    tags: ["reflex", "casual"],
    controls: "Click or tap as fast as you can when the target lights up. Keep your average low.",
    difficulty: "Medium"
  },
  {
    id: "turbo-drift",
    title: "Turbo Drift",
    slug: "turbo-drift",
    description: "Race neon sunset circuits, dodge traffic and chase the perfect lap time.",
    category: "Racing",
    thumbnail: "assets/thumbnails/turbo-drift.svg",
    featured: true,
    featuredOrder: 3,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/turbo-drift/play/index.html",
    embed: null,
    tags: ["racing", "drift", "single-player"],
    controls: "Arrow keys or WASD to steer and drift. Complete every lap as fast as you can.",
    difficulty: "Medium"
  },
  {
    id: "arena-clash",
    title: "Arena Clash",
    slug: "arena-clash",
    description: "Face off against other players in fast, tactical arena showdowns.",
    category: "Multiplayer",
    thumbnail: "assets/thumbnails/arena-clash.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "html5",
    version: "1.0.0",
    playUrl: null,
    embed: null,
    tags: ["multiplayer", "pvp", "arena"]
  },
  {
    id: "steel-vanguard",
    title: "Steel Vanguard",
    slug: "steel-vanguard",
    description: "Command a battle mech in a high-performance WebAssembly shooter.",
    category: "Action",
    thumbnail: "assets/thumbnails/steel-vanguard.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "wasm",
    version: "1.0.0",
    playUrl: null,
    embed: null,
    tags: ["mech", "shooter", "single-player"]
  },
  {
    id: "cloud-hopper",
    title: "Cloud Hopper",
    slug: "cloud-hopper",
    description: "Bounce across drifting sky islands in a breezy casual platformer.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/cloud-hopper.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/cloud-hopper/play/index.html",
    embed: null,
    tags: ["platformer", "casual"],
    controls: "Arrow keys or Space to jump between sky islands. Do not fall.",
    difficulty: "Easy"
  },
  {
    id: "eaglercraft-1-8",
    title: "Eaglercraft 1.8",
    slug: "eaglercraft-1-8",
    description: "The classic browser voxel experience. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraft-1-8.svg",
    featured: true,
    featuredOrder: 7,
    popular: true,
    popularOrder: 11,
    status: "coming-soon",
    type: "webgl",
    version: "1.8",
    playUrl: "games/eaglercraft-1-8/client/index.html",
    embed: null,
    tags: ["minecraft", "multiplayer", "sandbox", "voxel"]
  },
  {
    id: "eaglercraftx-1-8",
    title: "EaglercraftX 1.8",
    slug: "eaglercraftx-1-8",
    description: "An extended 1.8 voxel client build. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraftx-1-8.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "webgl",
    version: "1.8",
    playUrl: "games/eaglercraftx-1-8/client/index.html",
    embed: null,
    tags: ["minecraft", "multiplayer", "sandbox", "voxel"]
  },
  {
    id: "eaglercraft-1-12",
    title: "Eaglercraft 1.12.2",
    slug: "eaglercraft-1-12",
    description: "A newer-generation 1.12 voxel client. Supply your own legally distributable client to play.",
    category: "Minecraft",
    thumbnail: "assets/thumbnails/eaglercraft-1-12.svg",
    featured: false,
    popular: false,
    status: "coming-soon",
    type: "webgl",
    version: "1.12.2",
    playUrl: "games/eaglercraft-1-12/client/index.html",
    embed: null,
    tags: ["minecraft", "sandbox", "voxel"]
  },
  {
    id: "snake",
    title: "Snake",
    slug: "snake",
    description: "Guide a hungry neon snake, gobble orbs and grow — just don't bite your own tail.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/snake.svg",
    featured: true,
    featuredOrder: 1,
    popular: true,
    popularOrder: 1,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/snake/play/index.html",
    embed: null,
    tags: ["snake", "classic", "single-player"],
    controls: "Steer with the arrow keys or WASD, or swipe on touch screens. Eat orbs, avoid walls and your tail.",
    difficulty: "Medium"
  },
  {
    id: "paddle-clash",
    title: "Paddle Clash",
    slug: "paddle-clash",
    description: "A neon paddle duel: outlast the AI or face a friend in fast first-to-7 showdowns.",
    category: "Multiplayer",
    thumbnail: "assets/thumbnails/paddle-clash.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/paddle-clash/play/index.html",
    embed: null,
    tags: ["pong", "versus", "local-multiplayer"],
    controls: "Player 1: W and S. Player 2: Up and Down. First to 7 points wins.",
    difficulty: "Medium"
  },
  {
    id: "feather-flight",
    title: "Feather Flight",
    slug: "feather-flight",
    description: "Flap through floating gates as a tiny glowing bird in this one-button arcade test.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/feather-flight.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/feather-flight/play/index.html",
    embed: null,
    tags: ["flappy", "one-button", "casual"],
    controls: "Press Space, click, or tap to flap. Thread every gate without touching it.",
    difficulty: "Easy"
  },
  {
    id: "memory-match",
    title: "Memory Match",
    slug: "memory-match",
    description: "Flip tiles and match every pair in this calm memory workout with two board sizes.",
    category: "Casual",
    thumbnail: "assets/thumbnails/memory-match.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/memory-match/play/index.html",
    embed: null,
    tags: ["memory", "matching", "casual"],
    controls: "Click or tap tiles to flip them. Match every pair in as few moves as you can.",
    difficulty: "Easy"
  },
  {
    id: "merge-blocks",
    title: "Merge Blocks",
    slug: "merge-blocks",
    description: "Slide numbered tiles together and chase the legendary 2048 in this addictive puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/merge-blocks.svg",
    featured: true,
    featuredOrder: 4,
    popular: true,
    popularOrder: 3,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/merge-blocks/play/index.html",
    embed: null,
    tags: ["2048", "sliding", "numbers"],
    controls: "Arrow keys or swipe to slide tiles. Merge matching numbers to reach 2048.",
    difficulty: "Medium"
  },
  {
    id: "minefield",
    title: "Minefield",
    slug: "minefield",
    description: "Flag the hidden mines with pure logic across three board sizes in this classic puzzler.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/minefield.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/minefield/play/index.html",
    embed: null,
    tags: ["minesweeper", "logic", "classic"],
    controls: "Click to reveal a cell, right-click or long-press to flag a mine. Clear the board with logic.",
    difficulty: "Medium"
  },
  {
    id: "click-frenzy",
    title: "Click Frenzy",
    slug: "click-frenzy",
    description: "How fast can you click? Ten seconds on the clock — chase your best clicks-per-second.",
    category: "Casual",
    thumbnail: "assets/thumbnails/click-frenzy.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/click-frenzy/play/index.html",
    embed: null,
    tags: ["clicking", "speed", "casual"],
    controls: "Click or tap as fast as you can for 10 seconds. Beat your best clicks-per-second.",
    difficulty: "Easy"
  },
  {
    id: "mole-patrol",
    title: "Mole Patrol",
    slug: "mole-patrol",
    description: "Bonk mischievous moles as they pop up — and smash golden moles for bonus points.",
    category: "Casual",
    thumbnail: "assets/thumbnails/mole-patrol.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/mole-patrol/play/index.html",
    embed: null,
    tags: ["whack-a-mole", "reflex", "casual"],
    controls: "Click or tap moles as they pop up. Golden moles are worth bonus points.",
    difficulty: "Easy"
  },
  {
    id: "sudoku",
    title: "Sudoku",
    slug: "sudoku",
    description: "The classic number puzzle with pencil notes, hints and three difficulties.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/sudoku.svg",
    featured: false,
    popular: true,
    popularOrder: 4,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/sudoku/play/index.html",
    embed: null,
    tags: ["sudoku", "numbers", "logic"],
    controls: "Click a cell, then type 1-9. Use notes and hints to solve the grid.",
    difficulty: "Medium"
  },
  {
    id: "four-in-a-row",
    title: "Four in a Row",
    slug: "four-in-a-row",
    description: "Drop discs, build lines of four and outsmart the CPU in this timeless duel.",
    category: "Strategy",
    thumbnail: "assets/thumbnails/four-in-a-row.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/four-in-a-row/play/index.html",
    embed: null,
    tags: ["connect-four", "board", "versus"],
    controls: "Click a column to drop your disc. Connect four before the CPU does.",
    difficulty: "Medium"
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    slug: "tic-tac-toe",
    description: "Noughts and crosses against a beatable or unbeatable AI — or a friend.",
    category: "Casual",
    thumbnail: "assets/thumbnails/tic-tac-toe.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/tic-tac-toe/play/index.html",
    embed: null,
    tags: ["tic-tac-toe", "board", "versus"],
    controls: "Click a square to place your mark. Get three in a row to win.",
    difficulty: "Easy"
  },
  {
    id: "neon-runner",
    title: "Neon Runner",
    slug: "neon-runner",
    description: "Sprint the neon skyline: double-jump spikes, dodge drones and grab every coin.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/neon-runner.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/neon-runner/play/index.html",
    embed: null,
    tags: ["runner", "endless", "jumping"],
    controls: "Space or Up to jump and double-jump. Dodge spikes and drones, grab coins.",
    difficulty: "Medium"
  },
  {
    id: "asteroid-dodge",
    title: "Asteroid Dodge",
    slug: "asteroid-dodge",
    description: "Thread your ship through an endless asteroid storm and grab repair cells to survive.",
    category: "Action",
    thumbnail: "assets/thumbnails/asteroid-dodge.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/asteroid-dodge/play/index.html",
    embed: null,
    tags: ["dodger", "space", "survival"],
    controls: "Arrow keys or WASD to thread the storm. Grab repair cells to survive.",
    difficulty: "Medium"
  
  },
  {
    id: "brick-dodge",
    title: "Brick Dodge",
    slug: "brick-dodge",
    description: "Weave your ship through a storm of falling bricks and survive as long as you can.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/brick-dodge.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/brick-dodge/play/index.html",
    embed: null,
    tags: ["dodger", "survival", "reflex"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or A and D to slide your ship. Dodge every falling brick.",
    difficulty: "Easy"
  },
  {
    id: "hue-switch",
    title: "Hue Switch",
    slug: "hue-switch",
    description: "Shift your orb's color mid-flight and thread gates that match your glow.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/hue-switch.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/hue-switch/play/index.html",
    embed: null,
    tags: ["colors", "reflex", "timing"],
    releaseDate: "2026-09-25",
    controls: "Press Space or tap to cycle colors. Fly through gates that match your orb.",
    difficulty: "Medium"
  },
  {
    id: "box-push",
    title: "Box Push",
    slug: "box-push",
    description: "Shove every crate onto its glowing target across 5 handcrafted warehouses.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/box-push.svg",
    featured: true,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/box-push/play/index.html",
    embed: null,
    tags: ["sokoban", "logic", "crates"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or WASD to push crates. Press R to restart a level.",
    difficulty: "Medium",
    featuredOrder: 6
  },
  {
    id: "circuit-rush",
    title: "Circuit Rush",
    slug: "circuit-rush",
    description: "Outlast a rival light-cycle in a neon arena: trap it before it traps you.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/circuit-rush.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/circuit-rush/play/index.html",
    embed: null,
    tags: ["arena", "versus", "lights"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or WASD to steer. Trap the rival cycle without crashing.",
    difficulty: "Medium"
  },
  {
    id: "word-scramble",
    title: "Word Scramble",
    slug: "word-scramble",
    description: "Unscramble word after word against the 60-second clock and build a streak.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/word-scramble.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/word-scramble/play/index.html",
    embed: null,
    tags: ["words", "spelling", "timed"],
    releaseDate: "2026-09-25",
    controls: "Type your guess and press Enter. Solve as many words as you can in 60 seconds.",
    difficulty: "Easy"
  },
  {
    id: "number-rush",
    title: "Number Rush",
    slug: "number-rush",
    description: "Tap the tiles from 1 to 25 in order as fast as your eyes and fingers allow.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/number-rush.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/number-rush/play/index.html",
    embed: null,
    tags: ["numbers", "speed", "focus"],
    releaseDate: "2026-09-25",
    controls: "Click or tap the numbers from 1 to 25 in order. Fewer mistakes, faster time.",
    difficulty: "Easy"
  },
  {
    id: "quick-math",
    title: "Quick Math",
    slug: "quick-math",
    description: "Solve rapid-fire arithmetic before the timer drains. Streaks boost your score.",
    category: "Puzzle",
    thumbnail: "assets/thumbnails/quick-math.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/quick-math/play/index.html",
    embed: null,
    tags: ["math", "numbers", "timed"],
    releaseDate: "2026-09-25",
    controls: "Click the correct answer, or press 1 to 4. Answer fast to build a streak.",
    difficulty: "Easy"
  },
  {
    id: "echo-pads",
    title: "Echo Pads",
    slug: "echo-pads",
    description: "Watch the glowing pads, then echo their pattern back in this memory duel.",
    category: "Casual",
    thumbnail: "assets/thumbnails/echo-pads.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/echo-pads/play/index.html",
    embed: null,
    tags: ["memory", "pattern", "simon"],
    releaseDate: "2026-09-25",
    controls: "Watch the sequence, then repeat it by clicking the pads in order.",
    difficulty: "Easy"
  },
  {
    id: "highway-escape",
    title: "Highway Escape",
    slug: "highway-escape",
    description: "Weave through highway traffic at breakneck speed and escape the endless chase.",
    category: "Racing",
    thumbnail: "assets/thumbnails/highway-escape.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/highway-escape/play/index.html",
    embed: null,
    tags: ["dodger", "cars", "endless"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or A and D to change lanes. Dodge traffic and grab fuel to keep going.",
    difficulty: "Medium",
    popularOrder: 9
  },
  {
    id: "zombie-survival",
    title: "Zombie Survival",
    slug: "zombie-survival",
    description: "Hold the arena against endless zombie waves with auto-fire and sharp footwork.",
    category: "Action",
    thumbnail: "assets/thumbnails/zombie-survival.svg",
    featured: true,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/zombie-survival/play/index.html",
    embed: null,
    tags: ["zombies", "survival", "waves"],
    releaseDate: "2026-09-25",
    controls: "Move with WASD or the arrow keys. Your blaster auto-fires at the nearest zombie.",
    difficulty: "Hard",
    featuredOrder: 5,
    popularOrder: 8
  },
  {
    id: "mini-golf",
    title: "Mini Golf",
    slug: "mini-golf",
    description: "Putt through 6 tricky mini-golf holes with walls, sand and moving hazards.",
    category: "Sports",
    thumbnail: "assets/thumbnails/mini-golf.svg",
    featured: false,
    popular: true,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/mini-golf/play/index.html",
    embed: null,
    tags: ["golf", "physics", "precision"],
    releaseDate: "2026-09-25",
    controls: "Drag from the ball to aim and set power, then release to putt.",
    difficulty: "Medium",
    popularOrder: 10
  },
  {
    id: "basketball-shot",
    title: "Basketball Shot",
    slug: "basketball-shot",
    description: "Time your flick and sink basket after basket as the hoop starts to move.",
    category: "Sports",
    thumbnail: "assets/thumbnails/basketball-shot.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/basketball-shot/play/index.html",
    embed: null,
    tags: ["basketball", "physics", "flick"],
    releaseDate: "2026-09-25",
    controls: "Drag down from the ball to set arc and power, then release to shoot.",
    difficulty: "Medium"
  },
  {
    id: "cast-and-catch",
    title: "Cast and Catch",
    slug: "cast-and-catch",
    description: "Slide your net along the pier and catch falling fish, but dodge the old boots.",
    category: "Casual",
    thumbnail: "assets/thumbnails/cast-and-catch.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/cast-and-catch/play/index.html",
    embed: null,
    tags: ["catching", "reflex", "fishing"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or mouse to slide the net. Catch fish, dodge boots.",
    difficulty: "Easy"
  },
  {
    id: "dungeon-escape",
    title: "Dungeon Escape",
    slug: "dungeon-escape",
    description: "Grab the key, dodge the patrolling guards and slip out of 3 torch-lit dungeons.",
    category: "Adventure",
    thumbnail: "assets/thumbnails/dungeon-escape.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/dungeon-escape/play/index.html",
    embed: null,
    tags: ["stealth", "maze", "escape"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or WASD to move. Grab the key, then reach the exit without touching a guard.",
    difficulty: "Medium"
  },
  {
    id: "knife-dodge",
    title: "Knife Dodge",
    slug: "knife-dodge",
    description: "Dash left and right as the circus knives rain down. Survive the full 60 seconds.",
    category: "Arcade",
    thumbnail: "assets/thumbnails/knife-dodge.svg",
    featured: false,
    popular: false,
    status: "available",
    type: "html5",
    version: "1.0.0",
    playUrl: "games/knife-dodge/play/index.html",
    embed: null,
    tags: ["dodger", "survival", "circus"],
    releaseDate: "2026-09-25",
    controls: "Arrow keys or A and D to dash. Dodge every falling knife for 60 seconds.",
    difficulty: "Medium"
  }
];

const CATEGORY_COLORS = {
  Action: "#fb7185",
  Adventure: "#84cc16",
  Arcade: "#22d3ee",
  Casual: "#fb923c",
  Minecraft: "#4ade80",
  Multiplayer: "#e879f9",
  Puzzle: "#a78bfa",
  Racing: "#fbbf24",
  Sports: "#60a5fa",
  Strategy: "#34d399"
};
const TYPE_LABELS = {
  html5: "HTML5",
  iframe: "Iframe",
  external: "External",
  webgl: "WebGL",
  wasm: "WASM"
};
const TYPE_ORDER = ["html5", "iframe", "webgl", "wasm", "external"];
const SORT_OPTIONS = ["featured", "popular", "newest", "az"];
const MINECRAFT_CATEGORY = "Minecraft";
const NEW_RAIL_SIZE = 6;
const DEFAULT_CATEGORY_COLOR = "#4f7cff";
const ALL_CATEGORIES = "All";

/* ---------------- Catalog helpers ---------------- */
const isValidGame = (game) =>
  Boolean(game && game.id && game.title && game.slug && game.category);

const validGames = () => GAMES.filter(isValidGame);

const gameById = (id) => validGames().find((game) => game.id === id) || null;

const gameBySlug = (slug) => validGames().find((game) => game.slug === slug) || null;

const categoryColor = (category) => CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;

const typeLabel = (type) => TYPE_LABELS[type] || "";

const tagsOf = (game) => (game && Array.isArray(game.tags) ? game.tags : []);

/* Missing optional fields never break rendering: every access below
   treats them as absent rather than throwing. */
const orderOf = (game, field) =>
  game && Number.isFinite(game[field]) ? game[field] : Number.MAX_SAFE_INTEGER;

const releaseOf = (game) => (game && typeof game.releaseDate === "string" ? game.releaseDate : "");

const getCategories = () => {
  const counts = new Map();
  for (const game of validGames()) {
    counts.set(game.category, (counts.get(game.category) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const getTypes = () => {
  const counts = new Map();
  for (const game of validGames()) {
    if (!TYPE_LABELS[game.type]) continue;
    counts.set(game.type, (counts.get(game.type) || 0) + 1);
  }
  return TYPE_ORDER
    .filter((type) => counts.has(type))
    .map((type) => ({ type, label: TYPE_LABELS[type], count: counts.get(type) }));
};

const catalogIndex = (game) => GAMES.indexOf(game);

const getFeatured = () =>
  validGames()
    .filter((game) => game.featured)
    .sort((a, b) => orderOf(a, "featuredOrder") - orderOf(b, "featuredOrder") || catalogIndex(a) - catalogIndex(b));

const getPopular = () =>
  validGames()
    .filter((game) => game.popular)
    .sort((a, b) => orderOf(a, "popularOrder") - orderOf(b, "popularOrder") || catalogIndex(a) - catalogIndex(b));

const getNewGames = (size = NEW_RAIL_SIZE) => {
  const dated = [];
  const undated = [];
  for (const game of validGames()) {
    (releaseOf(game) ? dated : undated).push(game);
  }
  dated.sort((a, b) =>
    (releaseOf(b) < releaseOf(a) ? -1 : releaseOf(b) > releaseOf(a) ? 1 : 0) ||
    catalogIndex(b) - catalogIndex(a));
  undated.sort((a, b) => catalogIndex(b) - catalogIndex(a));
  return dated.concat(undated).slice(0, size);
};

const searchMatches = (game, query) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = `${game.title || ""} ${game.description || ""} ${game.category || ""} ${typeLabel(game.type)} ${game.version || ""} ${tagsOf(game).join(" ")}`.toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
};

const filterGames = (options = {}) => {
  const query = options.query || "";
  const category = options.category || ALL_CATEGORIES;
  const type = options.type || null;
  const favoritesOnly = Boolean(options.favoritesOnly);
  const favorites = Array.isArray(options.favorites) ? options.favorites : [];
  return validGames().filter((game) => {
    if (category !== ALL_CATEGORIES && game.category !== category) return false;
    if (type && game.type !== type) return false;
    if (favoritesOnly && !favorites.includes(game.id)) return false;
    return searchMatches(game, query);
  });
};

const sortGames = (games, sort = "featured") => {
  const list = [...games];
  if (sort === "az") {
    list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  } else if (sort === "newest") {
    list.sort((a, b) =>
      (releaseOf(b) < releaseOf(a) ? -1 : releaseOf(b) > releaseOf(a) ? 1 : 0) ||
      catalogIndex(b) - catalogIndex(a));
  } else if (sort === "popular") {
    list.sort((a, b) =>
      Number(Boolean(b.popular)) - Number(Boolean(a.popular)) ||
      orderOf(a, "popularOrder") - orderOf(b, "popularOrder") ||
      catalogIndex(a) - catalogIndex(b));
  } else {
    list.sort((a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      orderOf(a, "featuredOrder") - orderOf(b, "featuredOrder") ||
      catalogIndex(a) - catalogIndex(b));
  }
  return list;
};

const getRelated = (game, size = 3) => {
  if (!isValidGame(game)) return [];
  const want = Math.max(0, size | 0);
  const tags = new Set(tagsOf(game));
  const scored = [];
  for (const other of validGames()) {
    if (other.id === game.id) continue;
    let score = 0;
    if (other.category === game.category) score += 10;
    for (const tag of tagsOf(other)) {
      if (tags.has(tag)) score += 2;
    }
    if (other.popular) score += 1;
    scored.push({ game: other, score, index: catalogIndex(other) });
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, want).map((row) => row.game);
};

var GameHubCatalog = {
  games: GAMES,
  CATEGORY_COLORS,
  TYPE_LABELS,
  TYPE_ORDER,
  SORT_OPTIONS,
  MINECRAFT_CATEGORY,
  NEW_RAIL_SIZE,
  ALL_CATEGORIES,
  isValidGame,
  validGames,
  gameById,
  gameBySlug,
  categoryColor,
  typeLabel,
  tagsOf,
  getCategories,
  getTypes,
  getFeatured,
  getPopular,
  getNewGames,
  searchMatches,
  filterGames,
  sortGames,
  getRelated
};

if (typeof window !== "undefined" && window) {
  window.GameHubCatalog = GameHubCatalog;
}
