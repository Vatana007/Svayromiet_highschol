// កំណត់ឈ្មោះ Cache (ប្ដូរលេខ v1 ទៅ v2 ពេលអ្នក Update កូដថ្មី)
const CACHE_NAME = 'svayromeit-app-v5';

// បញ្ចូលឈ្មោះឯកសារទាំងអស់ដែលចង់ឱ្យវា Save ទុកពេល Offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './styles.css',
  './admin-style.css',
  './script.js',
  './admin-script.js',
  './translations.json',
  './manifest.json',
];

// ពេល Install Service Worker ឱ្យវា Save ឯកសារខាងលើទុក
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ពេល App ទាញយកទិន្នន័យ (Fetch) ឱ្យឆែកមើល Cache សិន
self.addEventListener('fetch', (event) => {
  // មិន Cache រាល់ការ Request ទៅកាន់ Google Apps Script API ទេ
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // បើមានក្នុង Cache (Offline) ឱ្យបង្ហាញ Cache, បើអត់ទេ ឱ្យទាញពី Internet ថ្មី
      return cachedResponse || fetch(event.request);
    })
  );
});

// សម្អាត Cache ចាស់ៗចោលពេលយើង Update App ទៅជំនាន់ថ្មី (v2, v3...)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});