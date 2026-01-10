// 更新版本号以强制刷新缓存
const CACHE_NAME = 'voicenotes-v5';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/db.js',
    '/js/recorder.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    // 立即激活新 SW
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // 删除旧缓存
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 网络优先策略（确保获取最新代码）
self.addEventListener('fetch', (event) => {
    // API 请求不缓存
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // 成功获取网络响应，更新缓存
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
