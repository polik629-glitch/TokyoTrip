const CACHE_NAME = 'tokyo-trip-cache-v4'; // 💡 版本號 v4：Stale-While-Revalidate 秒開＋外部框架本地快取

// 本機核心檔案清單
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 1. 安裝 Service Worker 並預先快取核心檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // 立即跳過等待，強制接管
  );
});

// 2. 啟動並自動清理舊版快取（如 v1, v2, v3）
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
    }).then(() => self.clients.claim()) // 立即控制現有所有分頁
  );
});

// 3. 攔截網路請求：「快取秒開 ＋ 背景靜默更新」
self.addEventListener('fetch', event => {
  // 僅處理 GET 請求，避免干擾資料寫入或上傳
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 動態資料 API 與外部圖床直接走網路，不進靜態快取
  if (url.hostname.includes('api.github.com') || 
      url.hostname.includes('imgbb.com') ||
      url.hostname.includes('ibb.co')) {
    return; 
  }

  // 本機檔案與外部樣式框架（Tailwind CSS、FontAwesome）：有快取直接秒開，同時在背景抓新版覆蓋
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // 僅快取成功的回應（包含同源 basic 與跨域安全腳本 cors）
            if (networkResponse && networkResponse.status === 200 && 
               (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // 斷網或國外訊號極差時安靜略過，確保已載入的快取畫面正常運作
          });

        // ✨ 關鍵：快取存在時 0 毫秒直接回傳；完全沒快取才等待網路下載
        return cachedResponse || fetchPromise;
      });
    })
  );
});
