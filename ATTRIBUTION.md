# Attribution

> If I have seen further it is by standing on the shoulders of Giants.
> — Isaac Newton, letter to Robert Hooke, 1675

Legend stands on other people's work, so it names every library, dataset, font, service and idea it builds on, with its
licence and what we changed. Credit is owed whether or not a licence asks for it.

## Libraries

- **[bsv-kit](https://github.com/Jonathan-A-White/bsv-kit)** by Jonathan A. White, MIT. The shared libraries of his phone
  apps: What's new (the update banner's summary and the sheet shown after an update) now; the licence check, the grist
  client and one-time tips arrive with their stories. Changes: none.
- **[React](https://react.dev)**, MIT. **[Dexie](https://dexie.org)**, Apache-2.0. **[Vite](https://vite.dev)**, MIT, with
  **[vite-plugin-pwa](https://vite-pwa-org.netlify.app)**, MIT, and **[Workbox](https://developer.chrome.com/docs/workbox)**,
  MIT. **[Tailwind CSS](https://tailwindcss.com)**, MIT. **[Ajv](https://ajv.js.org)**, MIT, checks the photo reader's answer against its schema. Used as published; changes: none.
- Tests: **[Vitest](https://vitest.dev)**, **[vitest-cucumber](https://github.com/amiceli/vitest-cucumber)**,
  **[Testing Library](https://testing-library.com)** and **[Playwright](https://playwright.dev)**. Not shipped in the app.

## Data

The photo reader's test pictures (`grinds/examples/coin-from-photos/`, used by `mw grist smoke legend` and the unit tests,
not shipped in the app) are from Wikimedia Commons, each scaled down and saved as a JPEG, nothing else changed:

- 1909-S VDB Lincoln cent, obverse and reverse: image by Lost Dutchman Rare Coins, coin design by Victor David Brenner.
  Public domain.
- Washington quarter, 1944-S, obverse and reverse: image by Brandon Grossardt, coin design by John Flanagan. Public domain.
- Canadian dime of 1955: photograph by Mister rf, coin design by Emanuel Hahn.
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).
- Bank of Canada 1935 one dollar specimen note: Bank of Canada, National Currency Museum. Public domain.

Each photo's page is linked in `grinds/examples/README.md`.

None else ships yet. Named ahead, for the globe (a later story): **[Natural Earth](https://www.naturalearthdata.com)** map
data, public domain, and **[world-atlas](https://github.com/topojson/world-atlas)** by Mike Bostock, ISC, which repackages
it. They will be credited here, with what we changed, in the story that adds them.

## Ideas

- **Lampas**, the Governor's Koine Greek reader: the licence gate, the update flow, the build stamp and the way the
  code is cut into modules are taken from it.
- The owner's PWA best practices, which every screen follows.
