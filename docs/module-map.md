# Legend module map

A module is a folder under `src/` with one responsibility and one entry file; other modules import the entry, not its
insides. Two stories should be able to change two modules without touching the same file. Status is built or planned;
planned folders are created by the story that needs them, with the entry file named here.

| Module | One responsibility | Entry | Status |
|---|---|---|---|
| App shell | Start the app: scroll guard, banner, service worker, config | `src/main.tsx`, `src/App.tsx`, `src/config.ts`, `src/sw.ts` | built |
| Update flow | Banner, waiting build, What's new | `src/UpdateBanner.tsx`, `src/whatsNew/` | built |
| gate | Hold the app shut until the phone's key holds a licence | `src/gate/Gate.tsx` | planned |
| data | The local store (Dexie) and pure logic over it | `src/data/db.ts` | built, no stores yet |
| data/repositories | The only way UI reaches Dexie: one file per table family | `src/data/repositories/index.ts` | built, empty |
| services | Everything that leaves the phone: grist client, licence, device key, app update | `src/services/appUpdate.ts` | built (grist, licence planned) |
| events | The typed in-app bus screens talk through | `src/events/bus.ts` | planned |
| settings | The settings registry and the rows Settings draws | `src/settings/registry.ts` | planned |
| nav | Address, history, back, reopen where they left | `src/nav/route.ts` | planned |
| ui | Shared controls and gestures: scroll guard, build stamp, sheets | `src/ui/` (one file each) | built |
| screens | One folder per screen, entry `index.ts` | `src/screens/<name>/index.ts` | `home` built |

## Screens

Each screen is a folder `src/screens/<name>/` exporting its component from `index.ts`: `home` (built); planned:
`collection`, `item`, `add`, `search`, `globe`, `tutor`, `settings`, `about`.

**A new screen is a new folder.** Never grow an existing screen's file with another screen's code, and never import
from inside another module's folder, only its entry.

## Files every story would collide on

- `src/App.tsx`: the screen switch. Add a screen with one line here, nothing else.
- `src/data/db.ts`: the Dexie version list. A change adds a new `this.version(n)`; never edit an old one.
- `src/data/repositories/index.ts`: a re-export list. Add your names on their own lines.
- `package.json` and `package-lock.json`: dependencies. Keep a story's changes to its own lines.
- `ATTRIBUTION.md`, `CHANGELOG.md`, `public/changelog.json`: credits and What's new (`mw next` writes the changelog).

When a story must touch one of these, keep the edit small and at the end of the list so merges stay trivial.

## Rules

- UI reaches the store only through a repository; a repository owns its transactions.
- Anything that leaves the phone lives in `services/`; the licence and the grist client are copied from Lampas.
- A story that changes a source, a screen's purpose or a module boundary updates this file, `docs/overview.md` and
  `ATTRIBUTION.md` in the same story.
