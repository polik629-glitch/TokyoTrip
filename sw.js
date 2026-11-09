const CACHE_NAME = 'tokyo-trip-cache-v3'; // 💡 升級版本號，強制觸發更新

// 💡 只快取本機核心檔案
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
      .then(() => self.skipWaiting()) // 立即跳過等待，強制接管
  );
});

// 啟動並清理舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 刪除過期快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 立即控制現有分頁
  );
});

// 攔截網路請求：改為「網路優先 (Network First)」
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 外部 CDN 或 API 直接放行，不走快取
  if (url.hostname.includes('tailwindcss.com') || 
      url.hostname.includes('cdnjs.cloudflare.com') || 
      url.hostname.includes('api.github.com') || 
      url.hostname.includes('imgbb.com') ||
      url.hostname.includes('ibb.co')) {
    return; 
  }

  // 2. 本機網頁檔案改採「網路優先」策略！
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // 連線正常：更新快取並回傳最新檔案
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 斷網或離線時：退回使用快取備援
        return caches.match(event.request);
      })
  );
});
