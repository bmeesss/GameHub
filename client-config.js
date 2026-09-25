/* ============================================================
   GameHub — central client configuration
   Point WebGL/WASM game slots (the Minecraft clients) at a
   client build you are legally allowed to serve, without
   touching the launcher or the catalog. Edit this one file,
   deploy, done.

   clients["<slug>"]:
     null  -> rely on a local client shipped inside the repo at
              games/<slug>/client/index.html (verified at Play
              time, never preloaded).
     { url: "https://…" } -> use this HTTPS client whenever no
              local client is present. The URL must be HTTPS
              (HTTP is refused) and must point to a build you
              have the rights to host. GameHub never downloads,
              mirrors or bundles client files itself.

   Example:
     clients: { "eaglercraft-1-8": { url: "https://clients.example.com/eagler18/index.html" } }

   Notes:
   - Local clients always win over configured URLs.
   - The remote host must allow embedding (iframe framing) or
     the launcher will surface an embedding warning after load.
   - Leave a slot at null when you ship its files locally.
   ============================================================ */
"use strict";

var GameHubClients = {
  clients: {
    "eaglercraft-1-8": null,
    "eaglercraftx-1-8": null,
    "eaglercraft-1-12": null
  }
};

if (typeof window !== "undefined" && window) {
  window.GameHubClients = GameHubClients;
}
