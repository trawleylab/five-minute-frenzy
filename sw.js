/* Five Minute Frenzy service worker — same strategy as the sibling apps:
   network-first app shell (plain deploys reach installed iPads on their next
   online launch), cache-first icons, relative paths for subfolder hosting. */
importScripts("version.js");                 // single source of truth for the version
const CACHE = "five-minute-frenzy-v" + self.APP_VERSION;

const SCOPE = self.registration ? self.registration.scope : "./";
const ASSETS = [
  "",
  "index.html",
  "styles.css",
  "logic.js",
  "app.js",
  "version.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "icons/icon-maskable-512.png",
].map((p) => new URL(p, SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // only ever touch our own caches — siblings share this origin on github.io
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("five-minute-frenzy-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL(SCOPE).pathname)) return;

  const isShell =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    /(?:^|\/)(index\.html|app\.js|logic\.js|version\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname);

  if (isShell) {
    // no-cache = always revalidate with GitHub Pages (its max-age is 10 min),
    // so a deploy reaches the iPad on the very next online launch
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => putInCache(req, res))
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            if (req.mode === "navigate") return caches.match(new URL("index.html", SCOPE).toString());
            return new Response("", { status: 504, statusText: "offline" });
          })
        )
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => putInCache(req, res)).catch(() => new Response("", { status: 504 }))
      )
    );
  }
});
