self.addEventListener("install", (e) => {
        e.waitUntil(
                caches.open("tea-app-cache").then((cache) => {
                        return cache.addAll([
                                "/",
                                "/index.html",
                                "/style.css",
                                "/app.js",
                                "/manifest.json",
                                "/icons/icon-192.png",
                                "/icons/icon-512.png"
                        ]);
                })
        );
});

self.addEventListener("fetch", (e) => {
        e.respondWith(
                caches.match(e.request).then((response) => {
                        return response || fetch(e.request);
                })
        );
});
