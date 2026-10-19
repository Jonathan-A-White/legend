# Legend module map

A module is a folder under `src/` with one job and one entry; import that.

| Module | One responsibility | Entry | Status |
|---|---|---|---|
| App shell | Start the app: scroll guard, banner, worker | `src/main.tsx`, `src/App.tsx`, `src/config.ts`, `src/sw.ts` | built |
| Update flow | Banner, What's new | `src/UpdateBanner.tsx`, `src/whatsNew/` | built |
| gate | Hold the app shut until the phone's key holds a licence: `Gate` wraps the shell | `src/gate/index.ts` | built |
| data | The local store (Dexie: items, photos, settings, meta, asks, values, outbox, usage, savings, folders) and types; `kinds.ts` the kinds' words | `src/data/db.ts` | built |
| data/world | Countries (TopoJSON, names, flags) and currencies by date, in `public/data/world/` | `src/data/world.ts` | built |
| data/repositories | The only way UI reaches Dexie: a file per family, with `useLiveQuery` hooks beside them | `src/data/repositories/index.ts` | built |
| data/us | The US reference data (quarters, mints, grades, key dates, mintages, the states map) and its loaders; sources in `docs/data.md` | `src/data/us.ts` | built |
| rarity | How rare a coin is: pure rules (`findRow`, `placeInSeries`), `rarityWords` (for the tutor), `RarityLine`, `Strip`; `TutorRarity` asks on a tap (`item.rarity`); `keyDateStruck` | `src/rarity/index.ts` | built |
| services | What leaves the phone: `grist.ts`, `feedback.ts`, tutor `ask.ts`, licence, device key, app update (pwa-kit), the photo reader `nameItem.ts` (on a worker: `sendOffThread.ts`), `nameQueue.ts` (one at a time, resumes from `item.reading`, values), `itemAnswer.ts`, `value.ts`, `rarity.ts` | `src/UpdateBanner.tsx` | built |
| events | The typed bus screens talk through; every kind is in `docs/events.md` | `src/events/bus.ts` | built |
| settings | The registry (a setting is declared once), the rows, the screen, theme, text size | `src/settings/registry.ts`, `rows.ts`, `SettingsScreen.tsx` | built |
| nav | Hash routes, the bottom bar, reopen where they left | `src/nav/route.ts`, `lastRoute.ts`, `BottomBar.tsx` | built |
| ui | Shared: scroll guard, build stamp, `HoldBar` (hold to act), `useSheetBack` (Back closes a sheet), `useObjectUrl` | `src/ui/` | built |
| globe | The Globe (`#/globe`) and Country sheet (`#/country/<cc>`): a canvas globe; `render.ts` draws, `controller.ts` loops and pinches, `pick.ts` picks near a tap | `src/globe/index.ts` | built |
| quarters | Quarters (`#/quarters`): the US map lit by his quarters, State sheet, Checklist; `match.ts` (pure) names an item's design, `summary.ts` counts, `topo.ts` draws | `src/quarters/index.ts` | built |
| collection | The Collection (`#/collection`: count, search, filters, Looking at, Folders, Select: `Choose.tsx`; `#/folder/<id>` one folder) and one item (`#/item/<id>`: photos, facts, rarity, notes, Edit, Remove); `search.ts`, `view.ts` pure | `src/collection/index.ts` | built |
| share | Share: a globe picture or item card, else Save picture; `text.ts` says what a card may say (Other: subtype) | `src/share/index.ts` | built |
| learn | Learn (`#/learn`, `/grading`, `/mints`, `/years`, `/path`), each ends in Ask the tutor; pure: `grading.ts`, `mints.ts`, `years.ts`, `path.ts` | `src/learn/index.ts` | built |
| feedback | Tell the maker: `FeedbackButton`, `TellTheMakerButton` open `FeedbackSheet`; `outbox.ts` sends; `docs/feedback.md` | `src/feedback/index.ts` | built |
| tips | One-time `HintCard` tips (`hints.ts`), the usage log (`usageLog.ts`) | `src/tips/index.ts` | built |
| tutor | The Ask sheet over an item or country (`?ask`): `AskBox`, `suggestions.ts` (an Other's are about the piece), answers kept in asks, settings cards; `request.ts` says what goes | `src/tutor/index.ts` | built |
| capture | Add (`#/add`): viewfinder (`CaptureScreen`: Coin, Bill, Other; `useCamera`), `captureStill` (1600 px, <1 MB, 320 px thumb), `startItem` (stores, queues), Confirm sheet, `useNameQueue` | `src/capture/index.ts` | built |
| worth | A rough worth, never a price (an Other's guess counts at medium+): `WorthLine`, `RoughWorth`, `format.ts` (`worthOf` adds a set's ranges); Show values hides it | `src/worth/index.ts` | built |
| wishlist | The Wish list (`#/wishlist`, from the Collection): goal card, wished coins, Got it!, Let it go; `WishSheet` is Wish for it on the Confirm sheet; `tally.ts` (pure) the money | `src/wishlist/index.ts` | built |
| screens | One folder per screen, entry `index.ts` | `src/screens/<name>/index.ts` | `home` |

## Grinds

`grinds/<kind>.json` with `.md` instructions (a forwarding grind like `feedback` has none), `schemas/<kind>-{input,answer}-<v>.schema.json` and scenarios in
`grinds/examples/<kind>/` (`grinds/examples/README.md`; `mw grist smoke legend` runs them). A grind change updates its scenarios.

## Screens

The bottom bar has Collection, Globe,
Quarters, Learn and Settings (`src/settings/SettingsScreen.tsx`); `home` is `#/`; `item` (`#/item/<id>`) and `country`
(`#/country/<cc>`) are reached from them. Those live in their module folders above; `add` (`#/add`, `src/capture/`) opens over the bar.

**A new screen is a new folder.** Never grow a screen's file with another screen's code, and never import
from inside another module's folder, only its entry.

## Files every story would collide on

- `src/App.tsx`: the screen switch; a screen is one case here.
- `src/settings/registry.ts`: add a setting as one entry in `SETTINGS`, then `npm run grind:build` (the tutor's list). `src/events/bus.ts` and
  `docs/events.md`: add a kind in both (a test fails if they differ). `src/nav/route.ts`: a new route is a case in `routeOf`.
- `src/data/db.ts`: a change adds `this.version(n)`, never edits an old one.
- `src/data/repositories/index.ts`: re-exports, one name a line.
- `package.json`, `package-lock.json`: keep to your own lines.
- `ATTRIBUTION.md`, `CHANGELOG.md`, `public/changelog.json`: credits and What's new (`mw next` writes it).

## Rules

- UI reaches the store only through a repository; a repository owns its transactions.
- Anything that leaves the phone lives in `services/` (a shared picture, in `share/`).
