/// <reference lib="webworker" />
// src/sw.ts: the service worker, built by vite-plugin-pwa's injectManifest strategy (vite.config.ts).
// It precaches the build, answers navigations with the cached app page, guards the precache against a
// wrong-typed script or stylesheet (PWA best practices, section 9), and takes over only when a window
// posts {type:'SKIP_WAITING'} after the collector's tap on the Update banner (section 10).
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { healPrecache, isGuardedAsset, serveAsset } from './precacheGuard';

declare const self: ServiceWorkerGlobalScope;

// A script or stylesheet whose precached copy is not what its extension says is never served from the
// precache. This listener comes BEFORE precacheAndRoute's own, which would otherwise answer first.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && isGuardedAsset(url.pathname)) {
    event.respondWith(serveAsset(event.request, self.caches));
  }
});

// On activate the entries already poisoned are deleted and fetched again, and the open windows are
// claimed, so the page's controllerchange tells it the new build is in control.
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([healPrecache(self.caches), self.clients.claim()]));
});

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// A tap on the 'Update ready' banner sends {type:'SKIP_WAITING'}: this build takes over at once.
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
