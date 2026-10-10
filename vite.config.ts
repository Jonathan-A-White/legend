import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { pwaManifest } from './pwa-manifest';
import { injectManifestOptions } from './pwa-precache';
import { buildVersion, shortCommit } from './build-version';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// https://vite.dev/config/
export default defineConfig({
  // Served at the root of https://legend.allmymind.org: root-absolute asset paths, a self-contained dist/.
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new build waits until they tap the Update banner (PWA best practices, section 10).
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: pwaManifest,
      injectManifest: injectManifestOptions,
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion(pkg.version, new Date(), shortCommit())),
    // The plain version number (what changelog.json's versions are compared with), without the build's time and commit.
    __APP_SEMVER__: JSON.stringify(pkg.version),
  },
});
