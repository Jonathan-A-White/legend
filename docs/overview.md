# Legend overview

Legend is an offline-first PWA for collecting coins, banknotes and other pieces. It was built for Paul, who is eight, so it is
grown-up and never kiddy, and it is made so any collector can use it. The legend is the inscription on a coin.

Served at https://legend.allmymind.org (the VPS; no GitHub Pages). Licence-gated through bsv-kit; the tutor and photo
reader run as grist on the factory's mill. Private by default: only the grist they send and what they share leaves the phone: `docs/privacy.md`.

## Screens planned

Built: the licence gate (`docs/testing.md`), the shell, Settings (its About row opens `#/about`: credits from ATTRIBUTION.md), Home (`#/`), the Collection (count line, rough worth, search,
filters, Looking at, coin folders, Select to remove) and one item (photos, facts, rarity, notes, Edit, hold to Remove), Add (`#/add`: photo front and back, a queue names it, the Confirm sheet checks; Just looking stays out of the counts; Add many at once, `#/add/many`), the Wish list (`#/wishlist`: a saving goal, Got it!), the Globe (`#/globe`: a globe turned with a finger, lit where items come from) and the
Country sheet (`#/country/<cc>`: the items from there, the money now and before), Quarters (a US map lit with the quarters they
have, a checklist), Share, Tell the maker (`docs/feedback.md`), tips, Learn (grading, mint marks, years, Your path). The tutor (`?ask` on an item or a country: his questions, its answers, settings only on his Apply).

## Where things live

- `src/` the app, one folder per module: `docs/module-map.md`. Everything is stored in Dexie behind repositories, screens
  talk through the bus (`docs/events.md`), a setting is one registry entry.
- `docs/testing.md` how tests pass the licence gate (the device key seam).
- `features/*.feature` Gherkin scenarios; `features/steps/` their steps; `tests/unit/` unit tests; `tests/e2e/` Playwright.
- `public/data/us/` the US reference data (quarters, mints, grades, key dates, mintages, a states map), loaded by `src/data/us.ts`; sources and licences in `docs/data.md`; `npm run mintages:build` builds the mintages.
- `public/changelog.json` and `CHANGELOG.md` What's new; `ATTRIBUTION.md` credits every source.
- `docs/data.md` the world data (`npm run data:build`), in `public/data/world/`.
- `grinds/` grists and examples (`coin-from-photos` reads a coin, bill or Other; `item-value`; `coin-rarity`, an estimate on a tap; `legend-ask` the tutor); `schemas/`.

## One-line rules

- Make it easy to use correctly and hard to use incorrectly: large clear type, one-handed on a phone.
- Test first; every behaviour is a scenario; the gate in `CLAUDE.md` stays green.
- The page never scrolls and never zooms; a screen scrolls inside its own box.
- A new build waits for a tap (the Update banner); it never reloads under them.
- Data that ships in the repo must be free to redistribute and credited in `ATTRIBUTION.md`.
- Never bump the version; `mw next` does.
