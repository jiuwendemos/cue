/* CUE offline shell. The show pack is compiled into the app; this keeps the
   shell and the hashed assets available in a venue basement with no bars.

   The API is never cached. A stale readiness board or agent status on site is
   worse than a slow one, so /api and /mcp always go to the network. */
const CACHE = "cue-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"];

const isShell = (path) =>
  /\/(index\.html|manifest\.webmanifest|favicon\.svg|icon-[^/]+\.(png|svg))$/.test(path) || path.endsWith("/");

const isAsset = (path) => path.includes("/assets/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data: network only. Never a cached API response.
  if (url.pathname.startsWith("/api/") || url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html"))),
    );
    return;
  }

  if (!isAsset(url.pathname) && !isShell(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
