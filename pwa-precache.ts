// The injectManifest options, shared by vite.config.ts and its unit test. Workbox drops a file over
// maximumFileSizeToCacheInBytes (default 2 MiB) from the precache without an error, so the limit is
// raised past the biggest chunk the app will ship. The shell, its icons and the changelog are precached
// whole, with the two world files (public/data/world/, ~160 KB); data a later story adds that is too big for that is
// named here by file, no wildcard.
export const injectManifestOptions = {
  globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}', 'changelog.json', 'data/world/*.json'],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
};
