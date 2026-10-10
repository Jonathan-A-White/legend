# Legend module map

A module is a folder under `src/` with one responsibility and one entry file; others import the entry, not its insides. Two stories should change two modules without touching the same file. Planned folders are made by the story
that needs them, with the entry file named here.

| Module | One responsibility | Entry | Status |
|---|---|---|---|
| App shell | Start the app: scroll guard, banner, service worker, config | `src/main.tsx`, `src/App.tsx`, `src/config.ts`, `src/sw.ts` | built |
| Update flow | Banner, waiting build, What's new | `src/UpdateBanner.tsx`, `src/whatsNew/` | built |
| gate | Hold the app shut until the phone's key holds a licence: `Gate` wraps the shell in `App.tsx`, `Unlock` is what it shows meanwhile | `src/gate/index.ts` | built |
| data | The local store (Dexie v2: items, photos, settings, meta, asks, values, outbox) and its record types | `src/data/db.ts` | built |
| data/world | The world's countries (TopoJSON, names, flags) and their currencies by date, shipped in `public/data/world/` (`npm run data:build`; `docs/data.md`) | `src/data/world.ts` | built |
| data/repositories | The only way UI reaches Dexie: a file per family (items, photos, settings, meta, asks, values, outbox), with `useLiveQuery` hooks beside them | `src/data/repositories/index.ts` | built |
| data/us | The US reference data (quarters, mints, grades, key dates, the states map) and its loaders; sources in `docs/data.md` | `src/data/us.ts` | built |
| services | Everything that leaves the phone: grist client, `feedback.ts`, licence, device key, app update | `src/services/appUpdate.ts` | built (`licenceCheck.ts`, `licenceCache.ts`, `deviceKey.ts` for the gate; `itemAnswer.ts` checks the photo reader's answer) |
| events | The typed in-app bus screens talk through; every kind is in `docs/events.md` | `src/events/bus.ts` | built |
| settings | The registry (a setting is declared once), the rows, the screen, theme, text size | `src/settings/registry.ts`, `rows.ts`, `SettingsScreen.tsx` | built |
| nav | Hash routes, the bottom bar, reopen where they left (a trail of 20) | `src/nav/route.ts`, `lastRoute.ts`, `BottomBar.tsx` | built |
| ui | Shared controls: scroll guard, build stamp, placeholder, `HoldBar` (hold to act), `useSheetBack` (Back closes a sheet), both from Lampas | `src/ui/` (one file each) | built |
| globe | The Globe (`#/globe`) and Country sheet (`#/country/<cc>`): a d3-geo globe on a 2D canvas. `render.ts` draws a frame (pure); `controller.ts` is the one requestAnimationFrame loop, the finger and the idle spin; `clock.ts` is its clock seam | `src/globe/index.ts` | built |
| quarters | The Quarters screen (`#/quarters`): the US map lit by his quarters, the State sheet (`#/quarters?state=OH`), the Checklist, the territory tiles; `match.ts` (pure) says which design an item is, `summary.ts` counts, `topo.ts` draws; rules: `docs/data.md` | `src/quarters/index.ts` | built |
| collection | The Collection (`#/collection`: count line, search, filters, grid or list) and one item (`#/item/<id>`: photos, facts, notes, Edit, hold to Remove); `search.ts` and `view.ts` are pure | `src/collection/index.ts` | built |
| share | Share: a picture of the globe or an item card, else Save picture; `text.ts` says what a card may say | `src/share/index.ts` | built |
| learn | Learn (`#/learn`, `/grading`, `/mints`, `/years`, `/path`), each ending in Ask the tutor (disabled). Pure rules: `grading.ts`, `mints.ts`, `years.ts`, `path.ts` | `src/learn/index.ts` | built |
| feedback | Tell the maker: `FeedbackButton` and `TellTheMakerButton` (Settings) open `FeedbackSheet`; `outbox.ts` sends; `docs/feedback.md` | `src/feedback/index.ts` | built |
| tips | One-time `HintCard` tips (`hints.ts`; camera and tutor cards wait for their screens) and the usage log (`usageLog.ts`, counts only) | `src/tips/index.ts` | built |
| screens | One folder per screen, entry `index.ts` | `src/screens/<name>/index.ts` | `home` |

## Grinds

`grinds/<kind>.json` with `.md` instructions (a forwarding grind such as `feedback` has none), `schemas/<kind>-{input,answer}-<v>.schema.json` and scenarios in
`grinds/examples/<kind>/` (`grinds/examples/README.md`; `mw grist smoke legend` runs them). A grind change updates its scenarios.

## Screens

Each screen is a folder `src/screens/<name>/` exporting its component from `index.ts`. The bottom bar has Collection, Globe,
Quarters, Learn and Settings (`src/settings/SettingsScreen.tsx`); `home` is `#/`; `item` (`#/item/<id>`) and `country`
(`#/country/<cc>`) are reached from them. Those screens live in their module folders above. Planned: `add`, `search`, `tutor`, `about`.

**A new screen is a new folder.** Never grow an existing screen's file with another screen's code, and never import
from inside another module's folder, only its entry.

## Files every story would collide on

- `src/App.tsx`: the screen switch. Add a screen with one case here, nothing else.
- `src/settings/registry.ts`: add a setting as one entry in `SETTINGS`; the screen draws it by its kind. `src/events/bus.ts` and
  `docs/events.md`: add a kind in both (a test fails if they differ). `src/nav/route.ts`: a new route is a case in `routeOf`.
- `src/data/db.ts`: the Dexie version list. A change adds a new `this.version(n)`; never edit an old one.
- `src/data/repositories/index.ts`: a re-export list. Add your names on their own lines.
- `package.json` and `package-lock.json`: dependencies. Keep a story's changes to its own lines.
- `ATTRIBUTION.md`, `CHANGELOG.md`, `public/changelog.json`: credits and What's new (`mw next` writes the changelog).

When a story must touch one of these, keep the edit small and at the end of the list.

## Rules

- UI reaches the store only through a repository; a repository owns its transactions.
- Anything that leaves the phone lives in `services/` (a shared picture, in `share/`, on a tap).
- A story that changes a source, a screen's purpose or a module boundary updates this file, `docs/overview.md` and
  `ATTRIBUTION.md` in the same story.
