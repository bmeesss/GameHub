/* GameHub 3.0 — game page platform panels.
   Progressive enhancement for every game detail page: the visitor's own
   rating, private notes, collections and the achievements that game
   contributes to. Everything is optional — if profile.js or
   achievements.js are missing the panels simply do not render, and the
   launcher (launcher.js) keeps working exactly as before.

   All user-entered text is written with textContent / node values, so
   markup typed into a note can never execute. Static library SVG icons
   are the only innerHTML this file uses. */
"use strict";
(function () {
  var global = typeof window !== "undefined" ? window : null;
  if (!global) return;

  var Profile = global.GameHubProfile || null;
  var Achievements = global.GameHubAchievements || null;
  var Catalog = global.GameHubCatalog || null;
  var Cards = global.GameHubCards || null;
  var Player = global.GameHubPlayer || null;

  if (!Profile) return;

  var STAR_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"></path></svg>';
  var HEART_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.7C6.4 17.2 3 13.6 3 9.9 3 7.2 5.1 5 7.8 5c1.7 0 3.2.9 4.2 2.3C13 5.9 14.5 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.3-9 10.8z"></path></svg>';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function panel(title, description) {
    var box = el("section", "panel");
    box.appendChild(el("h2", null, title));
    if (description) box.appendChild(el("p", null, description));
    return box;
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

  /* ---------------- Page context ---------------- */
  function readSlug() {
    var launcher = document.querySelector(".launcher[data-slug]");
    if (launcher) {
      var value = launcher.getAttribute("data-slug");
      if (value) return value;
    }
    var parts = String(global.location && global.location.pathname || "").split("/");
    var index = parts.indexOf("games");
    if (index !== -1 && parts[index + 1]) return parts[index + 1];
    return "";
  }

  var slug = readSlug();
  if (!slug) return;

  var entry = Catalog && typeof Catalog.gameBySlug === "function" ? Catalog.gameBySlug(slug) : null;
  var gameId = entry && entry.id ? entry.id : slug;
  var gameTitle = entry && entry.title ? entry.title : slug;
  var mount = document.querySelector(".game-about");
  if (!mount || !mount.parentNode) return;

  var platform = el("section", "game-platform");
  platform.setAttribute("aria-label", "Your activity for " + gameTitle);

  /* ---------------- 1. My rating ---------------- */
  var ratingPanel = panel("My rating", "Your own score for this game. It stays in this browser and is never presented as a global rating.");
  var rating = el("div", "rating");
  var stars = el("div", "rating-stars");
  stars.setAttribute("role", "group");
  stars.setAttribute("aria-label", "Rate " + gameTitle + " from 1 to 5 stars");
  var starButtons = [];
  var ratingValue = el("span", "rating-value");
  var ratingNote = el("p", "rating-note", "Ratings are private to this device.");
  var clearRating = el("button", "btn btn-ghost btn-sm", "Clear rating");
  clearRating.type = "button";

  function paintRating() {
    var value = Profile.getRating(gameId);
    for (var i = 0; i < starButtons.length; i++) {
      var on = i < value;
      starButtons[i].classList.toggle("is-on", on);
      starButtons[i].setAttribute("aria-pressed", String(i + 1 === value));
      starButtons[i].setAttribute("aria-label", on ? "Rated " + (i + 1) + " of 5" : "Rate " + (i + 1) + " of 5");
    }
    ratingValue.textContent = value ? value + " / 5 stars (yours)" : "Not rated yet";
    clearRating.disabled = !value;
    clearRating.classList.toggle("is-hidden", !value);
  }

  for (var star = 1; star <= 5; star++) {
    (function (value) {
      var button = el("button", "star-btn");
      button.type = "button";
      button.innerHTML = STAR_SVG;
      button.setAttribute("data-star", String(value));
      button.addEventListener("click", function () {
        Profile.setRating(gameId, value);
        paintRating();
      });
      starButtons.push(button);
      stars.appendChild(button);
    })(star);
  }

  clearRating.addEventListener("click", function () {
    Profile.setRating(gameId, 0);
    paintRating();
  });

  rating.appendChild(stars);
  rating.appendChild(ratingValue);
  rating.appendChild(clearRating);
  rating.appendChild(ratingNote);
  ratingPanel.appendChild(rating);

  /* ---------------- 2. Notes ---------------- */
  var notePanel = panel("Your notes", "One private note per game, up to " + Profile.NOTE_LIMIT + " characters. Saved in this browser only.");
  var editor = el("div", "note-editor");
  var noteLabel = el("label", "sr-only", "Your note about " + gameTitle);
  var noteId = "game-note-" + gameId;
  noteLabel.setAttribute("for", noteId);
  var textarea = el("textarea", "text-area");
  textarea.id = noteId;
  textarea.setAttribute("maxlength", String(Profile.NOTE_LIMIT));
  textarea.setAttribute("rows", "4");
  textarea.setAttribute("placeholder", "Tactics, best score, what to try next\u2026");
  var counter = el("p", "note-counter");
  var saved = el("div", "note-saved");
  var savedWrap = el("div");
  var savedMeta = el("p", "note-meta");
  var actions = el("div", "form-actions");
  var saveButton = el("button", "btn btn-primary btn-sm", "Save note");
  saveButton.type = "button";
  var deleteButton = el("button", "btn btn-ghost btn-sm", "Delete note");
  deleteButton.type = "button";
  var noteStatus = el("span", "form-note");

  function paintCounter() {
    var length = textarea.value.length;
    counter.textContent = length + " / " + Profile.NOTE_LIMIT + " characters";
    counter.classList.toggle("is-full", length >= Profile.NOTE_LIMIT);
  }

  function paintNote() {
    var note = Profile.getNote(gameId);
    textarea.value = note ? note.text : "";
    paintCounter();
    while (savedWrap.firstChild) savedWrap.removeChild(savedWrap.firstChild);
    if (note) {
      saved.appendChild(document.createTextNode(note.text));
      savedWrap.appendChild(saved);
      savedMeta.textContent = note.at ? "Saved " + formatDate(note.at) : "Saved in this browser";
      savedWrap.appendChild(savedMeta);
      savedWrap.hidden = false;
      deleteButton.disabled = false;
    } else {
      savedWrap.hidden = true;
      deleteButton.disabled = true;
    }
  }

  textarea.addEventListener("input", paintCounter);
  saveButton.addEventListener("click", function () {
    var note = Profile.setNote(gameId, textarea.value);
    paintNote();
    noteStatus.textContent = note ? "Note saved." : "Empty notes are removed.";
  });
  deleteButton.addEventListener("click", function () {
    Profile.removeNote(gameId);
    paintNote();
    noteStatus.textContent = "Note deleted.";
  });

  actions.appendChild(saveButton);
  actions.appendChild(deleteButton);
  actions.appendChild(noteStatus);
  editor.appendChild(noteLabel);
  editor.appendChild(textarea);
  editor.appendChild(counter);
  editor.appendChild(actions);
  editor.appendChild(savedWrap);
  notePanel.appendChild(editor);

  /* ---------------- 3. Collections ---------------- */
  var collectionPanel = panel("Collections", "Favorites, Play Later and Completed are all kept locally in this browser.");
  var collectionActions = el("div", "game-collection-actions");

  var favButton = el("button", "icon-toggle");
  favButton.type = "button";
  favButton.setAttribute("data-fav-page", gameId);
  var favIcon = el("span", "icon-toggle-icon");
  favIcon.innerHTML = HEART_SVG;
  var favLabel = el("span", null, "Favorite");
  favButton.appendChild(favIcon);
  favButton.appendChild(favLabel);

  function paintFav() {
    var active = Boolean(Player && typeof Player.isFavorite === "function" && Player.isFavorite(gameId));
    favButton.classList.toggle("is-active", active);
    favButton.setAttribute("aria-pressed", String(active));
    favLabel.textContent = active ? "Favorited" : "Favorite";
    favButton.setAttribute("aria-label", (active ? "Remove " : "Add ") + gameTitle + (active ? " from" : " to") + " favorites");
  }

  favButton.addEventListener("click", function () {
    if (!Player || typeof Player.toggleFavorite !== "function") return;
    Player.toggleFavorite(gameId);
    paintFav();
    if (Cards && typeof Cards.refreshAchievements === "function") Cards.refreshAchievements();
  });
  paintFav();
  collectionActions.appendChild(favButton);

  if (Cards && typeof Cards.collectionButton === "function") {
    var markup = Cards.collectionButton("playlater", { id: gameId, title: gameTitle }) +
      Cards.collectionButton("completed", { id: gameId, title: gameTitle });
    if (markup) {
      var holder = el("span", "game-collection-buttons");
      holder.innerHTML = markup;
      while (holder.firstChild) collectionActions.appendChild(holder.firstChild);
      if (typeof Cards.wireCollections === "function") Cards.wireCollections(collectionActions);
      if (typeof Cards.syncCollectionButtons === "function") Cards.syncCollectionButtons(collectionActions);
    }
  }

  collectionPanel.appendChild(collectionActions);

  /* ---------------- 4. Activity stats ---------------- */
  var statsPanel = panel("Your activity", "Counted from your own play sessions on this device.");
  var statGrid = el("dl", "profile-hero-stats");
  var stats = Player && typeof Player.getStats === "function" ? Player.getStats(gameId) : null;
  var played = stats && stats.gamesPlayed ? stats.gamesPlayed : (Player && Player.getStats ? 0 : Profile.playedGames().filter(function (row) { return row.id === gameId; }).reduce(function (sum, row) { return sum + (row.plays || 0); }, 0));
  var seconds = Profile.getPlaytime(gameId);
  var cells = [
    ["Plays", String(played), played ? "" : "Not played yet"],
    ["Time played", seconds ? Profile.formatDuration(seconds) : "0m", "Tracked since GameHub 3.0"]
  ];
  if (stats && stats.bestScore) cells.push([stats.bestLabel || "Best", String(stats.bestScore), "Your best result"]);
  var achievements = Achievements && typeof Achievements.forGame === "function" ? Achievements.forGame(gameId, 6) : [];
  var unlockedHere = achievements.filter(function (row) { return row.unlocked; }).length;
  if (achievements.length) cells.push(["Achievements", unlockedHere + " / " + achievements.length, "Listed below"]);

  for (var c = 0; c < cells.length; c++) {
    var card = el("div", "stat-card");
    card.appendChild(el("dt", null, cells[c][0]));
    card.appendChild(el("dd", null, cells[c][1]));
    if (cells[c][2]) card.appendChild(el("small", null, cells[c][2]));
    statGrid.appendChild(card);
  }
  statsPanel.appendChild(statGrid);

  /* ---------------- 5. Achievements for this game ---------------- */
  var achievementPanel = null;
  function renderAchievements() {
    if (!Achievements || typeof Achievements.forGame !== "function") return;
    var rows = Achievements.forGame(gameId, 6);
    if (!rows.length) return;
    if (!achievementPanel) {
      achievementPanel = panel("Achievements for " + gameTitle, "Unlocked locally as you play \u2014 nothing is uploaded anywhere.");
      var grid = el("div", "achievement-grid");
      grid.setAttribute("data-game-achievements", gameId);
      achievementPanel.appendChild(grid);
    }
    var grid2 = achievementPanel.querySelector("[data-game-achievements]");
    if (!grid2) return;
    while (grid2.firstChild) grid2.removeChild(grid2.firstChild);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var card2 = el("article", "achievement " + (row.unlocked ? "is-unlocked" : "is-locked"));
      card2.setAttribute("data-achievement", row.id);
      var icon = el("span", "achievement-icon");
      /* Definitions carry the SVG markup directly; named keys
         still resolve through ICONS for forward compatibility. */
      var iconSvg = typeof row.icon === "string" && row.icon.indexOf("<svg") === 0
        ? row.icon
        : (Achievements.ICONS && Achievements.ICONS[row.icon] ? Achievements.ICONS[row.icon] : "");
      if (iconSvg) icon.innerHTML = iconSvg;
      card2.appendChild(icon);
      var body = el("div", "achievement-body");
      body.appendChild(el("h3", "achievement-title", row.title || row.id));
      body.appendChild(el("p", "achievement-desc", row.description || ""));
      var meta = el("div", "achievement-meta");
      var tier = el("span", "achievement-tier", row.tier || "bronze");
      tier.setAttribute("data-tier", row.tier || "bronze");
      meta.appendChild(tier);
      if (row.unlocked) {
        meta.appendChild(el("span", null, row.unlockedAt ? "Unlocked " + formatDate(row.unlockedAt) : "Unlocked"));
      } else {
        var percent = Math.max(0, Math.min(100, Number(row.percent) || 0));
        meta.appendChild(el("span", null, percent + "% complete"));
      }
      body.appendChild(meta);
      var progress = el("div", "achievement-progress");
      var bar = el("span");
      bar.style.width = Math.max(0, Math.min(100, Number(row.percent) || 0)) + "%";
      progress.appendChild(bar);
      body.appendChild(progress);
      card2.appendChild(body);
      grid2.appendChild(card2);
    }
    if (achievementPanel && !achievementPanel.parentNode) platform.appendChild(achievementPanel);
  }

  /* ---------------- Mount ---------------- */
  platform.appendChild(ratingPanel);
  platform.appendChild(notePanel);
  platform.appendChild(collectionPanel);
  platform.appendChild(statsPanel);
  renderAchievements();

  var related = document.querySelector(".game-related");
  if (related && related.parentNode) related.parentNode.insertBefore(platform, related);
  else mount.parentNode.appendChild(platform);

  if (typeof Profile.onChange === "function") {
    Profile.onChange(function () {
      paintRating();
      var active = document.activeElement;
      if (active !== textarea) paintNote();
      paintFav();
    });
  }
  paintNote();
})();
