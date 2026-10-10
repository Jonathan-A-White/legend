import type { ManifestOptions } from 'vite-plugin-pwa';

// One plain object, imported by vite.config.ts and by the tests, so the manifest cannot drift unseen.
// The theme and background match index.html's theme-color meta and the root background in src/index.css.
export const THEME_COLOR = '#07130f';

export const pwaManifest: Partial<ManifestOptions> = {
  name: 'Legend',
  short_name: 'Legend',
  description: 'Collect coins and banknotes: photograph one, learn what it is, keep it in a private collection',
  display: 'standalone',
  orientation: 'portrait',
  start_url: '/',
  scope: '/',
  background_color: THEME_COLOR,
  theme_color: THEME_COLOR,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    // the same art: its coin sits inside the central 80%, the safe zone of a maskable icon
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
};
