/* Idle Miner — original GameHub implementation.
   Idle clicker: swing the pickaxe, hire miners, watch the gems pile up. */
"use strict";
(function () {
  const shell = document.getElementById("shell");
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else if (shell && shell.requestFullscreen) {
          shell.requestFullscreen();
        }
      } catch (err) { /* fullscreen unsupported */ }
    });
  }

  const gemEl = document.getElementById("gems");
  const gpsEl = document.getElementById("gps");
  const clickEl = document.getElementById("per-click");
  const totalEl = document.getElementById("total");
  const bestEl = document.getElementById("best");
  const mineBtn = document.getElementById("mineBtn");
  const shopEl = document.getElementById("shop");
  const resetBtn = document.getElementById("resetBtn");
  if (!mineBtn || !shopEl) return;

  const UPGRADES = [
    { id: "pickaxe", name: "Pickaxe", desc: "+1 gem per swing", base: 15, growth: 1.15, effect: "click" },
    { id: "miner", name: "Auto-miner", desc: "+1 gem per second", base: 60, growth: 1.16, effect: "gps1" },
    { id: "drill", name: "Drill rig", desc: "+6 gems per second", base: 500, growth: 1.17, effect: "gps6" },
    { id: "foundry", name: "Gem foundry", desc: "+40 gems per second", base: 4200, growth: 1.18, effect: "gps40" }
  ];

  const SAVE_KEY = "gh_idle_miner_save";
  let gems = 0;
  let totalMined = 0;
  let levels = { pickaxe: 0, miner: 0, drill: 0, foundry: 0 };
  let best = 0;
  let floaters = [];
  let resetArmed = false;
  let loaded = false;

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        gems = Number(data.gems) || 0;
        totalMined = Number(data.totalMined) || 0;
        if (data.levels && typeof data.levels === "object") {
          for (const u of UPGRADES) levels[u.id] = Math.max(0, Math.floor(Number(data.levels[u.id]) || 0));
        }
      }
    } catch (err) {
      /* corrupted save: start fresh */
    }
    try {
      best = parseInt(localStorage.getItem("gh_best_idle-miner"), 10) || 0;
    } catch (err) {
      best = 0;
    }
    loaded = true;
  }

  function save() {
    if (!loaded) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ gems, totalMined, levels }));
    } catch (err) { /* storage unavailable */ }
  }

  function costOf(upgrade) {
    return Math.ceil(upgrade.base * Math.pow(upgrade.growth, levels[upgrade.id]));
  }

  function perClick() {
    return 1 + levels.pickaxe;
  }

  function perSecond() {
    return levels.miner + levels.drill * 6 + levels.foundry * 40;
  }

  function format(n) {
    if (n < 1000) return String(Math.floor(n));
    const units = ["K", "M", "B", "T", "Qa", "Qi"];
    let value = n;
    let unit = -1;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit += 1;
    }
    return `${value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)}${units[unit]}`;
  }

  function renderHud() {
    if (gemEl) gemEl.textContent = format(gems);
    if (gpsEl) gpsEl.textContent = `${format(perSecond())}/s`;
    if (clickEl) clickEl.textContent = `${format(perClick())}/swing`;
    if (totalEl) totalEl.textContent = format(totalMined);
    if (bestEl) bestEl.textContent = format(best);
    for (const u of UPGRADES) {
      const btn = shopEl.querySelector(`[data-upgrade="${u.id}"]`);
      if (!btn) continue;
      const cost = costOf(u);
      btn.querySelector(".shop-cost").textContent = `${format(cost)} gems`;
      btn.querySelector(".shop-level").textContent = `Lv ${levels[u.id]}`;
      btn.disabled = gems < cost;
      btn.classList.toggle("affordable", gems >= cost);
    }
  }

  function mine() {
    const gain = perClick();
    gems += gain;
    totalMined += gain;
    floaters.push({ text: `+${format(gain)}`, life: 40 });
    if (floaters.length > 6) floaters.shift();
    renderHud();
    save();
  }

  function buy(upgrade) {
    const cost = costOf(upgrade);
    if (gems < cost) return;
    gems -= cost;
    levels[upgrade.id] += 1;
    renderHud();
    save();
  }

  function resetProgress() {
    if (!resetArmed) {
      resetArmed = true;
      if (resetBtn) resetBtn.textContent = "Click again to wipe";
      return;
    }
    gems = 0;
    totalMined = 0;
    levels = { pickaxe: 0, miner: 0, drill: 0, foundry: 0 };
    resetArmed = false;
    if (resetBtn) resetBtn.textContent = "Reset progress";
    renderHud();
    save();
  }

  function tick() {
    const gain = perSecond() / 10;
    if (gain > 0) {
      gems += gain;
      totalMined += gain;
    }
  }

  mineBtn.addEventListener("click", mine);
  shopEl.addEventListener("click", (event) => {
    const btn = event.target && event.target.closest ? event.target.closest("[data-upgrade]") : null;
    if (!btn) return;
    const upgrade = UPGRADES.find((u) => u.id === btn.getAttribute("data-upgrade"));
    if (upgrade) buy(upgrade);
  });
  if (resetBtn) resetBtn.addEventListener("click", resetProgress);

  /* Build the shop. */
  for (const u of UPGRADES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shop-item";
    btn.setAttribute("data-upgrade", u.id);
    btn.innerHTML =
      `<span class="shop-name">${u.name}</span>` +
      `<span class="shop-desc">${u.desc}</span>` +
      `<span class="shop-level">Lv 0</span>` +
      `<span class="shop-cost">…</span>`;
    shopEl.appendChild(btn);
  }

  load();
  if (totalMined > best) best = Math.floor(totalMined);
  try {
    localStorage.setItem("gh_best_idle-miner", String(Math.floor(best)));
  } catch (err) { /* storage unavailable */ }

  setInterval(() => {
    tick();
    if (Math.floor(totalMined) > best) {
      best = Math.floor(totalMined);
      try {
        localStorage.setItem("gh_best_idle-miner", String(best));
      } catch (err) { /* storage unavailable */ }
    }
    renderHud();
  }, 100);
  setInterval(save, 5000);

  renderHud();
})();
