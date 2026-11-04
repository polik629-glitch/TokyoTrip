const CACHE_NAME = 'tokyo-trip-cache-v2';

// 💡 修正：只快取本機檔案，避免外部 CDN 因為 CORS 限制導致 Service Worker 安裝失敗
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 安裝 Service Worker 並快取本機檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 啟動並清理舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 💡 關鍵防呆：如果是外部 CDN 或 API（例如 Tailwind、FontAwesome、GitHub API、ImgBB），
  // 絕對不要讓 Service Worker 去強行攔截快取，直接放行讓瀏覽器透過網路抓取！
  if (url.hostname.includes('tailwindcss.com') || 
      url.hostname.includes('cdnjs.cloudflare.com') || 
      url.hostname.includes('api.github.com') || 
      url.hostname.includes('imgbb.com')) {
    return; 
  }

  // 其他本機請求：優先從快取拿，沒有再走網路
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(() => {
          // 斷網且快取沒有時的備援
        });
      })
  );
});
