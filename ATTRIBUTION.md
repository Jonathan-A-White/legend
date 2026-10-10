# Attribution

> If I have seen further it is by standing on the shoulders of Giants.
> — Isaac Newton, letter to Robert Hooke, 1675

Legend stands on other people's work, so it names every library, dataset, font, service and idea it builds on, with its
licence and what we changed. Credit is owed whether or not a licence asks for it.

## Libraries

- **[bsv-kit](https://github.com/Jonathan-A-White/bsv-kit)** by Jonathan A. White, MIT. The shared libraries of his phone
  apps: What's new (the update banner's summary and the sheet shown after an update), the licence check and the grist client
  (Add sends the photos of a coin or a bill to the photo reader through it; they leave the phone only when he taps Name it);
  one-time tips arrive with their story. Changes: none.
- **[React](https://react.dev)**, MIT. **[Dexie](https://dexie.org)**, Apache-2.0. **[Vite](https://vite.dev)**, MIT, with
  **[vite-plugin-pwa](https://vite-pwa-org.netlify.app)**, MIT, and **[Workbox](https://developer.chrome.com/docs/workbox)**,
  MIT. **[Tailwind CSS](https://tailwindcss.com)**, MIT. **[Ajv](https://ajv.js.org)**, MIT, checks the photo reader's answer against its schema.
  **[qrcode](https://github.com/soldair/node-qrcode)**, MIT, draws this phone's key as the QR code on Unlock. Used as published; changes: none.
- **[d3-geo](https://d3js.org/d3-geo)** and **[topojson-client](https://github.com/topojson/topojson-client)** by Mike
  Bostock, ISC: the Globe's projection, paths, graticule and picking, and the country shapes unpacked from TopoJSON. Used as
  published; changes: none.
- Tests: **[Vitest](https://vitest.dev)**, **[vitest-cucumber](https://github.com/amiceli/vitest-cucumber)**,
  **[Testing Library](https://testing-library.com)** and **[Playwright](https://playwright.dev)**. Not shipped in the app.

## Data

The photo reader's and the tutor's test pictures (`grinds/examples/coin-from-photos/`, the quarter again in `grinds/examples/legend-ask/`, used by `mw grist smoke legend` and the unit tests,
not shipped in the app) are from Wikimedia Commons, each scaled down and saved as a JPEG, nothing else changed:

- 1909-S VDB Lincoln cent, obverse and reverse: image by Lost Dutchman Rare Coins, coin design by Victor David Brenner.
  Public domain.
- Washington quarter, 1944-S, obverse and reverse: image by Brandon Grossardt, coin design by John Flanagan. Public domain.
- Canadian dime of 1955: photograph by Mister rf, coin design by Emanuel Hahn.
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).
- Bank of Canada 1935 one dollar specimen note: Bank of Canada, National Currency Museum. Public domain.

Each photo's page is linked in `grinds/examples/README.md`.

The US reference data in `public/data/us/` (the facts and the lists are written by hand; see `docs/data.md`):

- **Quarter designs** (`quarters.json`): the lists and release order were taken from Wikipedia's tables ([50 State Quarters](https://en.wikipedia.org/wiki/50_State_Quarters),
  [America the Beautiful quarters](https://en.wikipedia.org/wiki/America_the_Beautiful_quarters),
  [American Women quarters](https://en.wikipedia.org/wiki/American_Women_quarters),
  [Semiquincentennial coinage](https://en.wikipedia.org/wiki/United_States_Semiquincentennial_coinage)), text
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0), and are the programmes the
  [US Mint](https://www.usmint.gov/coins/coin-programs) publishes. Names, years and order are facts; each design line is
  our own short sentence, and we added the state and territory codes.
- **Mint marks** (`mints.json`): Wikipedia's [Mint mark](https://en.wikipedia.org/wiki/Mint_mark) (CC BY-SA 4.0), with the US Mint's
  [mint marks page](https://www.usmint.gov/learn/collecting-basics/mint-marks) as the reference. Facts; our own words.
- **Sheldon grades** (`grades.json`): the 1-to-70 scale was devised by William Sheldon (1949). The step names are the common
  ones; every description is written for Legend and not taken from a grading service.
- **Key dates** (`key-dates.json`): common knowledge of the hobby, with no prices and no mintage figures. Our own words.
- **States map** (`states.json`): **[us-atlas](https://github.com/topojson/us-atlas)** by Mike Bostock, ISC, from US Census
  Bureau cartographic boundaries (public domain), the `states-albers-10m` file. Changes: the national outline removed, and
  each state's two-letter code added in place of its FIPS id. Alaska and Hawaii are the file's own insets.

The world data in `public/data/world/` (built by `npm run data:build`; `docs/data.md` says how):

- **[Natural Earth](https://www.naturalearthdata.com)** 110m country shapes, public domain, as repackaged by
  **[world-atlas](https://github.com/topojson/world-atlas)** by Mike Bostock, ISC. Changes: a country's shape is kept under
  its ISO alpha-2 code with a name; Somaliland and Northern Cyprus (no ISO code) and the land outline are left out.
- **[datasets/country-codes](https://github.com/datasets/country-codes)** (ISO 3166-1 and 4217 facts: alpha-2 codes, names,
  continents, current currency codes) and **[datasets/currency-codes](https://github.com/datasets/currency-codes)** (the ISO 4217
  code list with withdrawal dates), both under the Public Domain Dedication and License (PDDL). Changes: joined, names
  tidied (US, UK, the Congos, Bosnia), flags drawn from the codes.
- **[Wikidata](https://www.wikidata.org)** (CC0): the currencies each country has had, with start and end dates, from the
  query in `scripts/wikidata-currencies.rq`, kept as a snapshot in `data/snapshots/`. Changes: rows with no code and no end date
  are dropped; ISO 4217 names replace Wikidata's labels where the code is known.

Nothing from Numista, PCGS, NGC, ucoin or Colnect is copied in.

## Worth

Legend ships no price data and copies none: those catalogues forbid it. The rough worth on an item is a range the factory's
model gives from the item's facts and grade guess (`grinds/item-value.json`), labelled a rough estimate for learning and never a
price, kept with its date and asked for again after 30 days.

## Ideas

- **Lampas**, the Governor's Koine Greek reader: the licence gate, the update flow, the build stamp and the way the
  code is cut into modules are taken from it.
- Mike Bostock's [versor dragging](https://observablehq.com/@d3/versor-dragging) (ISC): the Globe turns under the finger
  with a quaternion, as there; `src/globe/drag.ts` is that code, rewritten in TypeScript.
- **TradeTracker**, the Governor's shopping app: the camera capture (the 1600 px, under 1 MB still) and the queue of lookups
  to the factory that Add's photo queue follows.
- The owner's PWA best practices, which every screen follows.
