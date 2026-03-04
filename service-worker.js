const CACHE_NAME = "trassu-quiz-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/images/q1.jpg",
  "/images/q2.jpg",
  "/images/q3.jpg",
  "/images/q4.jpg",
  "/images/q5.jpg",
  "/images/porsche911.jpg",
  "/images/ferrariF40.jpg",
  "/images/lamborghiniHuracan.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
