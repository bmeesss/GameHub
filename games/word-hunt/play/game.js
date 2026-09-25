/* Word Hunt — original GameHub implementation.
   Boggle-style word search on a generated 4x4 board. The board is
   only accepted when the built-in dictionary actually finds enough
   words on it, so every round is solvable and fair. */
"use strict";
(function () {
  const shell = document.getElementById("shell");
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (shell && shell.requestFullscreen) shell.requestFullscreen();
      } catch (err) { /* fullscreen unsupported */ }
    });
  }

  const canvas = document.getElementById("game");
  const scoreEl = document.getElementById("score");
  const wordsEl = document.getElementById("words");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const feedEl = document.getElementById("feed");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const primaryBtn = document.getElementById("primaryBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIZE = 4;
  const CELL = canvas.width / SIZE;
  const BEST_KEY = "gh_best_word-hunt";
  const ROUND_SECONDS = 90;

  /* Common English words, 3–8 letters, chosen so they can all appear
     on a 4x4 board. Kept deliberately everyday: no proper nouns. */
  const WORDS = ("ace ache acre act add age aid aim air ale alive allow almond alone also amber ample anchor angle ankle ant ape apple apron arch area argue arm army arrow art ash aside ask atom aunt away axe baby badge bag bake bald ball balloon ban bank bar barn base basin basket bat bath baton beach bead beam bean bear beard beast bee beef bell belt bench bend berry bet bike bill bird bite blade blame blank blast blaze bleak blend blimp blink block bloom blow blue bluff blunt blur board boast boat bold bolt bomb bond bone bonus book boost boot border bore born boss bottle bounce bowl box brain branch brave bread break brew brick bridge brief bright bring brisk broad brook broom brown brush bubble bucket budge bugle build bulb bulk bull bump bundle bunny burrow bus bush butter button cabin cable cactus cage cake calm camel camp canal candle cane canoe canvas cap cape car card care cargo carp carrot cart carve case cash castle cat catch cave cedar cell cereal chain chair chalk charm chase cheek cheese chess chest chew chief child chill chime chip choice choir chord chunk cider cinch circle citrus city clam clamp clap clash clasp class claw clay clean clear clerk click cliff climb cling clock close cloth cloud clover club clue coach coal coast coat cobra cocoa code coil coin cold collapse collar colony color colt comb comet comfort comic common cone cook cool copper coral cord core cork corn cost cottage cotton couch cough count course court cousin cover cow coyote crab crack craft crane crash crate crawl crayon cream creek crew crib crime crisp crop cross crow crowd crown crumb crush cry crystal cube cup curl current curve cushion cut cycle dab dad daily dairy daisy damp dance dandy dare dark dart dash date dawn day deal deck deep deer defend degree delay deliver delta demand dense dent depth desert design desk detail detect dial diamond dice diet dig dime dine dinner dire dish dive dock doctor dodge dog doll dolphin dome donkey door dot dough dove down draft drag dragon drain drama draw dream dress drift drill drink drive drop drum duck due dull dust duty eagle ear early earn ease east easy eat edge egg eight elbow elder elect element elf elm else ember empty end enemy energy engine enjoy enough enter entire entry equal error escape essay event exact exit extra eye fable fabric face fact fade fair fairy faith fake falcon fall fame family fan fancy fang far farm fast fate fawn feast feather feed feel fence fern fetch fever few field fierce fig fight file fill film find fine finger finish fire firm first fish fist fit five fix flag flake flame flash flat flavor flea flee fleet flesh flick flight flint flip float flock flood floor flour flow flower flu fluid flush flute foam focus fog foil fold folk follow fond food fool foot force forest forge fork form fort fortune forward fossil foster fox frame free fresh friend fringe frog front frost fruit fuel full fun funny fur furnace future gadget gain galaxy gala game gang gap garden garlic gate gather gauge gear gene gentle gift ginger giraffe give glad glance glass glaze glide glimpse globe gloom glory glove glow glue goal goat gold golf gone goose gorilla gospel grace grade grain grand granite grape graph grasp grass grate gravel gravity graze great green greet grid grill grind grip grit groan groom ground group grove grow growl guard guess guest guide guitar gulf gull gum gust habit hail hair half hall halt ham hammer hamster hand handle hang harbor hard hare harm harp harvest hat hatch haul hawk hay hazard hazel head heal health heap hear heart heat hedge heel height hello helmet help hen herb herd hero heron hidden hide high hike hill hint hip hire history hive hobby hockey hold hole holiday hollow home honest honey honor hood hoof hook hope horizon horn horse hose host hot hotel hour house hover hug huge human humble humor hunt hurdle hurry hurt hut hyena ice icon idea idle image imagine impact inch include index indoor infant inflate ink inlet inner insect inside inspire instead invent invite iron island ivory ivy jacket jade jail jam jar jaw jazz jelly jet jewel join joke jolly journey joy judge juice jumbo jump jungle junior just keen keep kettle key kick kid kind king kiss kit kitchen kite kitten kiwi knee kneel knife knight knit knob knock knot know label labor lace ladder lady lagoon lake lamb lamp land lane lantern lap large laser last latch late laugh launch laundry lava law lawn layer lazy lead leaf league lean leap learn lease leash leave ledge left leg legend lemon length lens leopard less lesson level lever liberty library license life lift light like lily lime limit line link lion liquid list listen little live lizard load loaf loan lobby lobster local lock log logic lonely long look loop loose lord lose loss lost lot loud love low loyal lucky lumber lunar lunch lung luxury magnet maid mail main major make mammal manage mango manner mansion mantle manual map marble march margin marine mark market marry marsh mask mason master match mate math matter maybe maze meadow meal mean measure meat medal media medium meet melon melt member memory mention menu mercy merge merit mesh message metal meter method middle might mild mile milk mill mind mine mineral minor mint minute mirror miss mist mix mixture mobile model modern modest moist mold moment monitor monkey month mood moon moral more morning moss most mother motion motor mound mount mouse mouth move movie much mud muffin mug mule multiply muscle museum mushroom music must mystery nail name napkin narrow nation nature navy near neat neck nectar need needle negative neighbor neither nephew nerve nest net never new news next nice nickel night nimble nine noble nod noise noon normal north nose note notice novel now number nurse nut oak oasis oat obey object ocean odd offer office often oil old olive omega once onion online only open opera opinion orange orbit orchard order organ origin other otter ounce outdoor outer oval oven over own oxygen oyster pace pack paddle page paint pair palace pale palm pan panda panel panic panther paper parade parcel parent park parrot part party pass past path patient pattern pause pavement paw pay peace peach peak peanut pear pearl pebble pelican pen pencil penguin people pepper per perfect perhaps period permit person pet phase phrase piano pick picnic picture pie piece pier pig pigeon pile pilot pin pine pink pioneer pipe pirate pit pitch pixel pizza place plain plan plane planet plank plant plastic plate play plaza pleasant please pledge plenty plot plow plug plumber plunge plus pocket poem poet point polar pole police polish pond pony pool poor pop porch portal portion pose position possible post pot potato pottery pouch pound pour powder power praise prawn prayer precise predict prefer prepare present press pretend pretty prevent price pride primary print prior prism prize probe problem process produce program project promise proof proper protect proud prove provide public pudding puff pull pulp pulse pump pumpkin punch puppy pure purple purpose purse puzzle pyramid quail quake quality quartz queen quest quick quiet quill quilt quirk quit quiz rabbit race rack radar radio raft rail rain rainbow raise rake rally ramp ranch range rapid rare rat rate rather raven raw ray razor reach read ready real reason rebuild recall receive recipe record recover red reduce reef reel refer reflect refresh refuse regard region regret regular reject relax release relief remain remark remedy remind remote remove render renew rent repair repeat replace report request rescue research reserve reset resist resolve resort resource respect rest result retain retire retreat return reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring rinse ripe ripple rise risk ritual river road roast robin robot rock rocket rod role roll roof room root rope rose rotate rough round route row royal rub ruby rug rule ruler rumor run rural rush rust sack saddle safe sail sailor salad salmon salt salute same sample sand sandwich sandy sap sauce sausage save saw say scale scan scarf scatter scene scent school science scissors scooter score scout scrap scratch screen screw scribble scroll sea seal search season seat second secret section secure seed seek seem select self sell send sense sentence separate serenade series serious serve session settle seven several sew shade shadow shaft shake shallow shame shape share shark sharp shed sheep sheet shelf shell shelter shield shift shine ship shirt shock shoe shoot shop shore short shoulder shout show shrimp shrine shut shy sibling sick side siege sight sign silent silk silly silver similar simple since sing single sink sip sister sit site six size skate sketch ski skill skin skip skirt skull slab slam sleep sleeve slender slice slide slight slim slip slope slot slow small smart smash smell smile smoke smooth snail snake snap sneak snow soap soar sock soft soil solar soldier solid solve some song soon sort soul sound soup sour source south space spare spark speak spear special speed spell spend sphere spice spider spike spill spin spirit splash split spoil sponge spoon sport spot spray spread spring sprinkle sprint square squash squeak squeeze squirrel stable stack stadium staff stage stair stalk stamp stand star start state station statue stay steady steak steal steam steel steep steer stem step stew stick still sting stitch stock stone stool stop store storm story stove straight strand strange strap straw stream street strength stretch strike string strip stripe strong stuck study stuff stump sturdy style subject subtle success sudden sugar suit summer summit sun sunny sunset supper supply support suppose sure surf surface surprise surround survey survive swan swarm sway sweater sweep sweet swell swift swim swing switch sword symbol system table tackle tactic tag tail tailor take tale talk tall tame tank tape target task taste taught taxi tea teach team tear technical teeth tell temper temple tempo tenant tend tennis tent term terrace terrible test thank thick thief thin thing think third thorn though thought thread three thrive throat throne through throw thumb thunder ticket tide tidy tiger tight tile timber time tiny tip tire tissue title toast today toe together toil token toll tomato tone tongue tonight tool tooth top topic torch total touch tough tour tourist toward towel tower town toy trace track trade traffic trail train trait tram transfer trap travel tray treasure treat tree trend trial tribe trick trigger trim trip trophy tropic trouble truck true trumpet trunk trust truth tube tuna tunnel turbo turkey turn turtle twelve twenty twice twin twist two type udder ultimate umbrella uncle under uniform union unique unit universe unlock until unusual upgrade uphill upon upper upset urban usage useful usual vacant vacation valley value van vanish variety various vase vast vault vegetable vehicle velvet vendor venture verb verify version vessel veteran viable vibrant victory video view village vine vinegar vintage violet violin virtue visible vision visit visual vital vivid vocal voice volcano volume vote voyage waffle wagon waist wait walk wall wallet walnut walrus wander want war ward warm warn warrior wash wasp waste watch water wave wax way weak wealth weapon wear weather weave web wedding wedge weed week weep weigh weight welcome weld well west wet whale wheat wheel where whether which whip whisper whistle white whole whom wide widow width wild will willow wind window wine wing wink winner winter wipe wire wisdom wise wish wit witness wolf woman wonder wood wool word work world worm worry worth wound wrap wreck wrist write wrong yacht yard yarn yawn year yeast yellow yes yield yogurt young youth zebra zero zone zoo").split(" ");

  const DICTIONARY = {};
  const PREFIXES = {};
  for (const word of WORDS) {
    DICTIONARY[word] = true;
    for (let i = 2; i < word.length; i++) PREFIXES[word.slice(0, i)] = true;
  }

  const VOWELS = "aeiou";
  const LETTER_POOL =
    "aaaaabbccddeeeeeeeffgghhiiiiijklllmmnnnnnoooppqrrrsssttttuuuvwxyz";

  let grid = [];
  let found = [];
  let selectedPath = [];
  let current = "";
  let score = 0;
  let best = readNumber(BEST_KEY);
  let remaining = ROUND_SECONDS;
  let total = 0;
  let state = "idle";
  let paused = false;
  let dragging = false;
  let feed = "Drag or click letters";

  function readNumber(key) {
    try {
      const raw = localStorage.getItem(key);
      const value = parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (err) { /* storage unavailable */ }
  }

  function showOverlay(title, text, label, visible) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (primaryBtn) primaryBtn.textContent = label;
    if (overlay) overlay.hidden = !visible;
  }

  const hideOverlay = () => { if (overlay) overlay.hidden = true; };

  function refreshHud() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (wordsEl) wordsEl.textContent = found.length + (total ? " / " + total : "");
    if (timeEl) timeEl.textContent = String(Math.max(0, Math.ceil(remaining)));
    if (bestEl) bestEl.textContent = String(best);
    if (feedEl) feedEl.textContent = feed;
  }

  /* ---------------- Board generation ---------------- */
  const NEIGHBOURS = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) list.push(nr * SIZE + nc);
        }
      }
      NEIGHBOURS.push(list);
    }
  }

  function randomGrid() {
    const letters = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const roll = Math.random();
      if (roll < 0.34) {
        letters.push(VOWELS.charAt(Math.floor(Math.random() * VOWELS.length)));
      } else {
        letters.push(LETTER_POOL.charAt(Math.floor(Math.random() * LETTER_POOL.length)));
      }
    }
    return letters;
  }

  function solve(letters) {
    const hits = [];
    const visit = (index, word, used) => {
      if (word.length > 8) return;
      if (!PREFIXES[word] && !DICTIONARY[word]) return;
      if (DICTIONARY[word] && word.length >= 3) hits.push(word);
      for (const next of NEIGHBOURS[index]) {
        if (used.indexOf(next) !== -1) continue;
        visit(next, word + letters[next], used.concat(next));
      }
    };
    for (let i = 0; i < letters.length; i++) visit(i, letters[i], [i]);
    return hits.filter((word, index) => hits.indexOf(word) === index).sort();
  }

  function newBoard() {
    let letters = randomGrid();
    let words = solve(letters);
    let attempt = 0;
    while (words.length < 14 && attempt < 120) {
      letters = randomGrid();
      words = solve(letters);
      attempt++;
    }
    grid = letters;
    return words;
  }

  const wordScore = (word) => (word.length >= 7 ? 6 : word.length === 6 ? 5 : word.length === 5 ? 3 : word.length === 4 ? 2 : 1);

  /* ---------------- Round flow ---------------- */
  function startRound() {
    selectedPath = [];
    current = "";
    found = [];
    score = 0;
    remaining = ROUND_SECONDS;
    state = "playing";
    paused = false;
    dragging = false;
    feed = "Find 3+ letter words";
    const words = newBoard();
    total = words.length;
    hideOverlay();
    refreshHud();
  }

  function endRound(reason) {
    state = "over";
    if (score > best) {
      best = score;
      writeNumber(BEST_KEY, best);
    }
    refreshHud();
    const possible = total ? " The board held " + total + " words." : "";
    showOverlay("Time up", reason + " You scored " + score + " points with " + found.length + " words." + possible, "New board", true);
  }

  function submitWord() {
    const word = current.toLowerCase();
    if (word.length < 3) {
      feed = "Too short — three letters minimum";
      selectedPath = [];
      current = "";
      refreshHud();
      return;
    }
    if (found.indexOf(word) !== -1) {
      feed = word + " is already found";
    } else if (DICTIONARY[word]) {
      score += wordScore(word);
      found.push(word);
      feed = word + " +" + wordScore(word) + " (" + found.length + "/" + total + ")";
    } else {
      feed = word + " is not in the word list";
    }
    selectedPath = [];
    current = "";
    refreshHud();
  }

  function addLetter(index) {
    if (state !== "playing" || paused) return;
    if (selectedPath.indexOf(index) !== -1) return;
    if (selectedPath.length) {
      const last = selectedPath[selectedPath.length - 1];
      if (NEIGHBOURS[last].indexOf(index) === -1) return;
    }
    selectedPath.push(index);
    current += grid[index];
    feed = "Spelling: " + current;
    refreshHud();
  }

  function update(dt) {
    if (state !== "playing" || paused) return;
    remaining -= dt / 1000;
    if (remaining <= 0) {
      remaining = 0;
      endRound("You beat the clock's worth of letters.");
      return;
    }
    refreshHud();
  }

  /* ---------------- Rendering ---------------- */
  function draw() {
    ctx.fillStyle = "#0e1428";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < grid.length; i++) {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      const x = c * CELL;
      const y = r * CELL;
      const active = selectedPath.indexOf(i) !== -1;
      const last = selectedPath.length ? selectedPath[selectedPath.length - 1] : -1;
      ctx.fillStyle = active ? "#3b2b6b" : "#161f3c";
      ctx.fillRect(x + 5, y + 5, CELL - 10, CELL - 10);
      ctx.lineWidth = i === last ? 3 : 1;
      ctx.strokeStyle = i === last ? "#22d3ee" : "rgba(148, 163, 216, 0.28)";
      ctx.strokeRect(x + 5, y + 5, CELL - 10, CELL - 10);
      ctx.fillStyle = "#f2f5ff";
      ctx.font = "bold " + Math.round(CELL * 0.44) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(grid[i].toUpperCase(), x + CELL / 2, y + CELL / 2);
    }
    /* Trail between selected letters */
    ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
    ctx.lineWidth = 4;
    for (let i = 1; i < selectedPath.length; i++) {
      const a = selectedPath[i - 1];
      const b = selectedPath[i];
      ctx.beginPath();
      ctx.moveTo((a % SIZE) * CELL + CELL / 2, Math.floor(a / SIZE) * CELL + CELL / 2);
      ctx.lineTo((b % SIZE) * CELL + CELL / 2, Math.floor(b / SIZE) * CELL + CELL / 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(34, 211, 238, 0.95)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(current.toUpperCase(), 12, canvas.height - 14);
  }

  function loop() {
    update(1000 / 60);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- Input ---------------- */
  function cellFromEvent(event) {
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const x = ((event.clientX || 0) - rect.left) * (canvas.width / (rect.width || canvas.width));
    const y = ((event.clientY || 0) - rect.top) * (canvas.height / (rect.height || canvas.height));
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return -1;
    return Math.floor(y / CELL) * SIZE + Math.floor(x / CELL);
  }

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    const index = cellFromEvent(event);
    if (index >= 0) addLetter(index);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const index = cellFromEvent(event);
    if (index >= 0) addLetter(index);
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    submitWord();
  });
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    dragging = true;
    const index = cellFromEvent({ clientX: touch.clientX, clientY: touch.clientY });
    if (index >= 0) addLetter(index);
  }, { passive: true });
  canvas.addEventListener("touchend", () => {
    dragging = false;
    submitWord();
  });

  window.addEventListener("keydown", (event) => {
    const key = String(event.key || "");
    if (key === "Backspace" && current.length) {
      selectedPath.pop();
      current = current.slice(0, -1);
      refreshHud();
      return;
    }
    if (key === "Enter") {
      submitWord();
      return;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      const letter = key.toLowerCase();
      const candidates = [];
      grid.forEach((value, index) => {
        if (value === letter && selectedPath.indexOf(index) === -1) candidates.push(index);
      });
      const last = selectedPath.length ? selectedPath[selectedPath.length - 1] : -1;
      const neighbour = candidates.find((index) => last === -1 || NEIGHBOURS[last].indexOf(index) !== -1);
      if (neighbour !== undefined) addLetter(neighbour);
      return;
    }
    if (key.toLowerCase() === "p") togglePause();
  });

  function togglePause() {
    if (state !== "playing") return;
    paused = !paused;
    if (paused) showOverlay("Paused", "The clock is stopped and your board stays put.", "Resume", true);
    else hideOverlay();
  }

  primaryBtn?.addEventListener("click", () => {
    if (paused && state === "playing") { togglePause(); return; }
    startRound();
  });
  pauseBtn?.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing" && !paused) togglePause();
  });

  grid = randomGrid().map((letter) => letter);
  refreshHud();
  draw();
  requestAnimationFrame(loop);
  void WORDS;
})();
