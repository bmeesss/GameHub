# EaglercraftX 1.8 client directory

This folder is intentionally empty. It is where a **legally distributable**
EaglercraftX 1.8 browser client belongs.

Expected layout once you supply your own build:

```text
games/eaglercraftx-1-8/client/
├── index.html        # client entry point (loaded by the GameHub launcher)
├── ...               # the client's own JS, WASM and data files
└── README.md         # this file (keep it)
```

GameHub never downloads, mirrors or bundles the client for you.
See "Adding an Eaglercraft client" in the main README for the full guide,
including the legal notes. Do not commit Mojang-copyrighted assets
(textures, sounds, `assets.epk`-style packs) unless you hold a license
that permits redistribution.
