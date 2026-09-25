/* GameHub 3.0 — profile page controller.
   Renders the local profile: name, avatar, theme, achievements,
   collections, ratings, notes and recent play. Everything comes from
   profile.js / player.js / achievements.js, and every user-supplied
   string is written with textContent so stored markup can never run. */
"use strict";
(function () {
  var global = typeof window !== "undefined" ? window : null;
  if (!global) return;

  var Profile = global.GameHubProfile || null;
  var Achievements = global.GameHubAchievements || null;
  var Catalog = global.GameHubCatalog || null;
  var Cards = global.GameHubCards || null;
  var Player = global.GameHubPlayer || null;
  var Theme = global.GameHubTheme || null;

  if (!Profile) return;

  var YEAR = document.getElementById("year");
  if (YEAR) YEAR.textContent = String(new Date().getFullYear());

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function formatDate(at) {
    var when = new Date(at);
    if (isNaN(when.getTime())) return "";
    try {
      return when.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (err) {
      return when.toISOString().slice(0, 10);
    }
  }

  function gameFor(id) {
    if (Catalog && typeof Catalog.gameById === "function") {
      var entry = Catalog.gameById(id);
      if (entry) return entry;
    }
    return { id: id, title: id, slug: id, thumbnail: "", category: "" };
  }

  function gameLink(entry) {
    var slug = entry.slug || entry.id;
    return "../games/" + encodeURIComponent(slug) + "/index.html";
  }

  /* A compact row: artwork, title, subtitle and optional actions. */
  function collectionRow(entry, subtitle, actions) {
    var row = el("div", "collection-row");
    var image = el("img");
    image.src = entry.thumbnail ? "../" + entry.thumbnail : "../assets/favicon.svg";
    image.alt = "";
    image.loading = "lazy";
    image.width = 74;
    image.height = 42;
    row.appendChild(image);
    var body = el("div", "collection-row-body");
    var link = el("a", "collection-row-title", entry.title || entry.id);
    link.href = gameLink(entry);
    body.appendChild(link);
    body.appendChild(el("span", "collection-row-sub", subtitle || entry.category || "Game"));
    row.appendChild(body);
    if (actions && actions.length) {
      var holder = el("div", "collection-row-actions");
      for (var i = 0; i < actions.length; i++) holder.appendChild(actions[i]);
      row.appendChild(holder);
    }
    return row;
  }

  function removeButton(label, onClick) {
    var button = el("button", "btn btn-ghost btn-sm", label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  function emptyNote(text) {
    return el("p", "empty-note", text);
  }

  /* ---------------- Identity ---------------- */
  function paintIdentity() {
    var profile = Profile.getProfile();
    var avatar = Profile.avatarById(profile.avatar);
    var holder = $("[data-profile-avatar]") || document.getElementById("profile-avatar");
    if (holder) {
      clear(holder);
      holder.innerHTML = avatar && avatar.svg ? avatar.svg : "";
      holder.setAttribute("aria-hidden", "true");
    }
    var name = document.getElementById("profile-identity-title");
    if (name) name.textContent = profile.name;
    var since = document.getElementById("profile-since");
    if (since) {
      since.textContent = profile.createdAt ? "Playing since " + formatDate(profile.createdAt) : "Playing on this browser";
    }
    var input = document.getElementById("display-name");
    if (input && document.activeElement !== input) input.value = profile.name === Profile.DEFAULT_NAME ? "" : profile.name;
    var status = document.getElementById("name-note");
    if (status) status.textContent = "Up to " + Profile.NAME_LIMIT + " characters. Markup characters are stripped.";
    document.title = profile.name + " — Profile — GameHub";
  }

  function paintStats() {
    var summary = Profile.summary();
    var set = function (id, value) {
      var node = document.getElementById(id);
      if (node) node.textContent = String(value);
    };
    set("stat-games", summary.gamesPlayed);
    set("stat-plays", summary.totalPlays);
    set("stat-time", Profile.formatDuration(summary.totalSeconds));
    set("stat-achievements", (Achievements ? Achievements.unlockedCount() : 0) + " / " + (Achievements ? Achievements.total() : 0));
  }

  function paintAvatars() {
    var grid = document.getElementById("avatar-grid");
    if (!grid) return;
    clear(grid);
    var current = Profile.getAvatar();
    var avatars = Profile.AVATARS;
    for (var i = 0; i < avatars.length; i++) {
      (function (avatar) {
        var button = el("button", "avatar-option");
        button.type = "button";
        button.setAttribute("data-avatar", avatar.id);
        button.setAttribute("aria-pressed", String(avatar.id === current));
        button.innerHTML = avatar.svg;
        button.appendChild(el("span", null, avatar.label));
        button.addEventListener("click", function () {
          Profile.setAvatar(avatar.id);
          paintAvatars();
          paintIdentity();
          var status = document.getElementById("profile-status");
          if (status) status.textContent = "Avatar saved.";
        });
        grid.appendChild(button);
      })(avatars[i]);
    }
  }

  var form = document.getElementById("profile-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = document.getElementById("display-name");
      var saved = Profile.setDisplayName(input ? input.value : "");
      paintIdentity();
      paintStats();
      var status = document.getElementById("profile-status");
      if (status) status.textContent = "Saved as " + saved + ".";
    });
  }

  /* ---------------- Theme ---------------- */
  function paintTheme() {
    var wrap = document.getElementById("theme-switcher-wrap");
    if (!wrap || !Theme || typeof Theme.createSwitcher !== "function") return;
    if (wrap.querySelector(".theme-switcher")) return;
    var switcher = Theme.createSwitcher("profile-theme-switcher");
    if (!switcher) return;
    wrap.appendChild(switcher);
    if (typeof Theme.onChange === "function") {
      Theme.onChange(function () {
        if (Cards && typeof Cards.syncCollectionButtons === "function") Cards.syncCollectionButtons(document);
      });
    }
  }

  /* ---------------- Achievements ---------------- */
  function paintAchievements() {
    var grid = document.getElementById("achievement-grid");
    if (!grid || !Achievements) return;
    var rows = Achievements.all();
    clear(grid);
    var count = document.getElementById("achievements-count");
    if (count) count.textContent = Achievements.unlockedCount() + " of " + Achievements.total() + " unlocked.";
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var card = el("article", "achievement " + (row.unlocked ? "is-unlocked" : "is-locked"));
      card.setAttribute("data-achievement", row.id);
      var icon = el("span", "achievement-icon");
      /* Definitions carry the SVG markup directly; named keys
         still resolve through ICONS for forward compatibility. */
      var iconSvg = typeof row.icon === "string" && row.icon.indexOf("<svg") === 0
        ? row.icon
        : (Achievements.ICONS && Achievements.ICONS[row.icon] ? Achievements.ICONS[row.icon] : "");
      if (iconSvg) icon.innerHTML = iconSvg;
      card.appendChild(icon);
      var body = el("div", "achievement-body");
      body.appendChild(el("h3", "achievement-title", row.title || row.id));
      body.appendChild(el("p", "achievement-desc", row.description || ""));
      var meta = el("div", "achievement-meta");
      var tier = el("span", "achievement-tier", row.tier || "bronze");
      tier.setAttribute("data-tier", row.tier || "bronze");
      meta.appendChild(tier);
      if (row.gameId) {
        var game = gameFor(row.gameId);
        var link = el("a", "section-link", game.title || row.gameId);
        link.href = gameLink(game);
        meta.appendChild(link);
      }
      meta.appendChild(el("span", null, row.unlocked ? (row.unlockedAt ? "Unlocked " + formatDate(row.unlockedAt) : "Unlocked") : Math.max(0, Math.min(100, row.percent || 0)) + "% complete"));
      body.appendChild(meta);
      var progress = el("div", "achievement-progress");
      var bar = el("span");
      bar.style.width = Math.max(0, Math.min(100, Number(row.percent) || 0)) + "%";
      progress.appendChild(bar);
      body.appendChild(progress);
      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  /* ---------------- Collections ---------------- */
  var collectionTab = "favorites";

  function collectionIds(kind) {
    return Profile.collectionIds(kind);
  }

  function paintCollectionTabs() {
    var tabs = document.getElementById("collection-tabs");
    if (!tabs) return;
    clear(tabs);
    for (var i = 0; i < Profile.COLLECTION_KEYS.length; i++) {
      (function (kind) {
        var meta = Profile.COLLECTIONS[kind];
        var count = collectionIds(kind).length;
        var button = el("button", "chip-link", (meta ? meta.label : kind) + " (" + count + ")");
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("data-collection-tab", kind);
        button.setAttribute("aria-selected", String(kind === collectionTab));
        if (kind === collectionTab) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
        button.addEventListener("click", function () {
          collectionTab = kind;
          paintCollectionTabs();
          paintCollections();
        });
        tabs.appendChild(button);
      })(Profile.COLLECTION_KEYS[i]);
    }
  }

  function paintCollections() {
    var list = document.getElementById("collection-list");
    if (!list) return;
    var ids = collectionIds(collectionTab);
    clear(list);
    if (!ids.length) {
      list.appendChild(emptyNote("Nothing here yet. Use the collection buttons on any game card or game page to fill this list."));
      return;
    }
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var entry = gameFor(id);
        var action = removeButton("Remove", function () {
          Profile.removeFromCollection(collectionTab, id);
          paintCollections();
          paintCollectionTabs();
        });
        list.appendChild(collectionRow(entry, entry.category, [action]));
      })(ids[i]);
    }
  }

  /* ---------------- Ratings ---------------- */
  function paintRatings() {
    var list = document.getElementById("rating-list");
    if (!list) return;
    var ratings = Profile.getRatings();
    var ids = Object.keys(ratings);
    clear(list);
    if (!ids.length) {
      list.appendChild(emptyNote("You have not rated anything yet. Every game page has a private 1\u20135 star rating."));
      return;
    }
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var entry = gameFor(id);
        var value = ratings[id];
        var stars = "";
        for (var star = 1; star <= 5; star++) stars += star <= value ? "\u2605" : "\u2606";
        list.appendChild(collectionRow(entry, stars + " (" + value + "/5, yours)", [
          removeButton("Clear", function () {
            Profile.setRating(id, 0);
            paintRatings();
            paintStats();
          })
        ]));
      })(ids[i]);
    }
  }

  /* ---------------- Notes ---------------- */
  function paintNotes() {
    var list = document.getElementById("note-list");
    if (!list) return;
    clear(list);
    var notes = [];
    var entries = Catalog && typeof Catalog.validGames === "function" ? Catalog.validGames() : [];
    for (var i = 0; i < entries.length; i++) {
      var note = Profile.getNote(entries[i].id);
      if (note) notes.push({ entry: entries[i], note: note });
    }
    if (!notes.length) {
      list.appendChild(emptyNote("No notes yet. Each game page has a note box for tactics, high scores or reminders."));
      return;
    }
    for (var j = 0; j < notes.length; j++) {
      (function (row) {
        var wrapper = el("div", "collection-row");
        var image = el("img");
        image.src = row.entry.thumbnail ? "../" + row.entry.thumbnail : "../assets/favicon.svg";
        image.alt = "";
        image.loading = "lazy";
        image.width = 74;
        image.height = 42;
        wrapper.appendChild(image);
        var body = el("div", "collection-row-body");
        var link = el("a", "collection-row-title", row.entry.title || row.entry.id);
        link.href = gameLink(row.entry);
        body.appendChild(link);
        var saved = el("p", "note-saved");
        saved.textContent = row.note.text;
        body.appendChild(saved);
        body.appendChild(el("span", "note-meta", row.note.at ? "Saved " + formatDate(row.note.at) : "Saved in this browser"));
        wrapper.appendChild(body);
        var actions = el("div", "collection-row-actions");
        actions.appendChild(removeButton("Delete", function () {
          Profile.removeNote(row.entry.id);
          paintNotes();
          paintStats();
        }));
        wrapper.appendChild(actions);
        list.appendChild(wrapper);
      })(notes[j]);
    }
  }

  /* ---------------- Recently played ---------------- */
  function paintPlayed() {
    var list = document.getElementById("played-list");
    if (!list) return;
    clear(list);
    var played = Profile.playedGames();
    if (!played.length) {
      list.appendChild(emptyNote("No plays recorded yet. Launch any GameHub game and it will show up here."));
      return;
    }
    for (var i = 0; i < played.length; i++) {
      (function (row) {
        var entry = gameFor(row.id);
        var seconds = Profile.getPlaytime(row.id);
        var subtitle = (row.plays || 0) + (row.plays === 1 ? " play" : " plays") +
          (seconds ? " \u00b7 " + Profile.formatDuration(seconds) : "") +
          (row.at ? " \u00b7 " + formatDate(row.at) : "");
        list.appendChild(collectionRow(entry, subtitle, []));
      })(played[i]);
    }
  }

  /* ---------------- Clear data ---------------- */
  var clearButton = document.getElementById("clear-data");
  if (clearButton) {
    clearButton.addEventListener("click", function () {
      Profile.clearAll();
      if (Player && typeof Player.clearAll === "function") Player.clearAll();
      paintAll();
      var status = document.getElementById("clear-status");
      if (status) status.textContent = "All local GameHub data cleared.";
    });
  }

  function paintAll() {
    paintIdentity();
    paintStats();
    paintAvatars();
    paintTheme();
    paintAchievements();
    paintCollectionTabs();
    paintCollections();
    paintRatings();
    paintNotes();
    paintPlayed();
  }

  paintAll();

  if (typeof Profile.onChange === "function") {
    Profile.onChange(function () {
      paintStats();
      paintAchievements();
      paintCollections();
      paintCollectionTabs();
      paintRatings();
      paintNotes();
      paintPlayed();
      paintIdentity();
    });
  }
  if (Achievements && typeof Achievements.sync === "function") Achievements.sync();
})();
