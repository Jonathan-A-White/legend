# Legend overview

Legend is an offline-first PWA for collecting coins and banknotes. It was built for Paul, who is eight, so it is
grown-up and never kiddy, and it is made so any collector can use it. The legend is the inscription around a coin.

Served at https://legend.allmymind.org (the VPS; no GitHub Pages). Licence-gated through bsv-kit; the tutor and the
photo reader run as grist on the factory's mill. Private by default: nothing leaves the phone but the grist they send
and what they choose to share.

## Screens planned

Built: the shell (a bottom bar with Collection, Globe, Quarters, Learn, Settings; reopens where they left), Settings
(Appearance, Collection, Photos, Tutor, Privacy, About), Home (name and build stamp, `#/`), the Globe (`#/globe`: a globe
turned with one finger, lit where the items come from; search spins it to a country; Not yet lists the countries with
nothing yet) and the Country sheet (`#/country/<cc>`: the items from there, the money now and before). Collection, Quarters
and Learn are placeholders. Planned: the licence gate, the collection and one item, add an item (photograph a coin or a
note, the photo reader names it, they confirm), search, the Quarters album, the tutor, About (credits, What's new).

## Where things live

- `src/` the app, one folder per module: `docs/module-map.md`. Everything is stored in Dexie behind repositories, screens
  talk through the bus (`docs/events.md`), a setting is one registry entry.
- `features/*.feature` Gherkin scenarios; `features/steps/` their steps; `tests/unit/` unit tests; `tests/e2e/` Playwright.
- `public/data/us/` the US reference data (138 quarter designs, mints, Sheldon grades, key dates, a states map), loaded by `src/data/us.ts`; sources and licences in `docs/data.md`.
- `public/changelog.json` and `CHANGELOG.md` What's new; `ATTRIBUTION.md` credits every source.
- `docs/data.md` the world data (`npm run data:build`: countries and currencies, sources and licences); `public/data/world/`.
- `grinds/` the grist definitions and their examples (`coin-from-photos`: a photo in, a named item out); `schemas/` their schemas.

## One-line rules

- Make it easy to use correctly and hard to use incorrectly: large clear type, one-handed on a phone.
- Test first; every behaviour is a scenario; the gate in `CLAUDE.md` stays green.
- The page never scrolls and never zooms; a screen scrolls inside its own box.
- A new build waits for a tap (the Update banner); it never reloads under them.
- Data that ships in the repo must be free to redistribute and credited in `ATTRIBUTION.md`.
- Never bump the version by hand; `mw next` does.
