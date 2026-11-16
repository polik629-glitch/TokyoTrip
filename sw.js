const CACHE_NAME = 'tokyo-trip-cache-v4'; // 💡 升級版本號至 v4，切換為秒開策略

const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 安裝 Service Worker 並快取本機核心檔案
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
            console.log('🧹 刪除過期快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求：改為「快取秒開 ＋ 背景靜默更新 (Stale-While-Revalidate)」
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 外部 CDN、圖片與 GitHub API 直接放行，不干擾正常請求
  if (url.hostname.includes('tailwindcss.com') || 
      url.hostname.includes('cdnjs.cloudflare.com') || 
      url.hostname.includes('api.github.com') || 
      url.hostname.includes('imgbb.com') ||
      url.hostname.includes('ibb.co')) {
    return; 
  }

  // 2. 本機核心檔案：有快取先秒開，同時在背景抓最新檔案覆蓋快取
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // 發起背景網路請求，抓到新檔案就默默更新快取
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // 斷網時安靜失敗即可，不影響已顯示的快取畫面
          });

        // ✨ 關鍵：只要快取有檔案，立刻秒回傳（0延遲）；若完全沒快取才等網路
        return cachedResponse || fetchPromise;
      });
    })
  );
});
