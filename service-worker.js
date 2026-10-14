/* Generador de Menús Grupo · Service Worker v22 · 14/10/2026
 * Publicar junto a index.html v22 y conservar manifest.webmanifest e icons/.
 * Navegaciones: red primero, caché como respaldo si se pierde la conexión.
 */
'use strict';

// Cambiar este nombre en cada nueva versión publicada para renovar la caché.
const CACHE = 'menus-grupo-pwa-v22-20261014';
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest'
];
const ICONS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const MANIFEST_URL = new URL('./manifest.webmanifest', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Guardar la última versión del generador y su manifest, evitando cachés previas.
    for (const path of APP_SHELL) {
      const request = new Request(new URL(path, self.registration.scope), { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) throw new Error('No se pudo precargar ' + path);
      await cache.put(request, response);
    }

    // Los iconos mejoran la instalación PWA, pero un icono ausente no debe
    // impedir que se actualice el generador.
    await Promise.all(ICONS.map(async path => {
      try {
        const request = new Request(new URL(path, self.registration.scope), { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      } catch (_) { /* Icono opcional */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('menus-grupo-pwa-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate' || url.href === INDEX_URL;
  const isManifest = url.href === MANIFEST_URL;

  // HTML y manifest: siempre intentar red antes de usar la copia sin conexión.
  if (isPage || isManifest) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const key = isPage ? INDEX_URL : MANIFEST_URL;
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh.ok) {
          await cache.put(key, fresh.clone()).catch(() => {});
          return fresh;
        }
        return (await cache.match(key)) || fresh;
      } catch (_) {
        return (await cache.match(key)) || Response.error();
      }
    })());
    return;
  }

  // Iconos y otros recursos locales: caché primero y descarga si falta.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  })());
});
