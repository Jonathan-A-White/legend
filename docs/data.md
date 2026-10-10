# World data

`npm run data:build` (`scripts/data-build.ts`, run with `tsx`) writes two files that ship with the app and are precached by
the service worker (`pwa-precache.ts`), so the globe and the country sheet work offline. Both are committed. A second run
changes nothing: `git diff --exit-code public/data` is clean.

Raw downloads go to `data/raw/` (git-ignored; the build downloads what is missing and skips what is there). The one network
answer that is not a plain file, Wikidata's, is committed as `data/snapshots/wikidata-currencies.json`, so after the first run
the build needs no network. To refresh it, delete the snapshot and run the build; commit the new snapshot with the new output.

## Sources and licences

| Source | Used for | Licence |
|---|---|---|
| [world-atlas](https://github.com/topojson/world-atlas) `countries-110m.json` (Mike Bostock; built from [Natural Earth](https://www.naturalearthdata.com)) | the country shapes, with ISO 3166-1 numeric ids | ISC; Natural Earth is public domain |
| [datasets/country-codes](https://github.com/datasets/country-codes) | numeric -> alpha-2, names, continent, each country's current ISO 4217 code | PDDL |
| [datasets/currency-codes](https://github.com/datasets/currency-codes) `codes-all.csv` (ISO 4217, current and historic) | currency names, withdrawal dates of old codes | PDDL |
| [Wikidata](https://www.wikidata.org) via `scripts/wikidata-currencies.rq` | each country's currencies with start and end dates (P38 with P580/P582) | CC0 |

## `public/data/world/countries.json`

TopoJSON (about 119 KB; kept under 120 KB). `objects.countries.geometries[]` has one shape per country, ordered by alpha-2:
`{type, arcs, id: "DE", properties: {name: "Germany"}}`. `id` is the ISO 3166-1 alpha-2 code; Kosovo is `XK`, the
user-assigned code. Shapes with no ISO code (Somaliland, Northern Cyprus) are left out. The top-level `names` maps alpha-2
to `{name, numeric, flag, continent}`: `numeric` is the three-digit ISO number (`""` for Kosovo), `flag` the flag emoji,
`continent` one of AF, AN, AS, EU, NA, OC, SA. The `land` object and the arcs only it used are dropped.

## `public/data/world/currencies.json`

`{ "DE": [row, ...] }`, countries in alpha-2 order, each country's rows oldest first, the current ones last. A row is
`{code, name, symbol, from, to, source}`:

- `code` the ISO 4217 code, `null` for an old currency that never had one (the reichsmark).
- `name` ISO 4217's name when the code has one, else Wikidata's label with a capital letter.
- `symbol` a common mark ($, €, £, ¥, ...) or `null`.
- `from`, `to` `YYYY-MM-DD` (ISO 4217's withdrawal dates are `YYYY-MM`), `null` when unknown. **`to: null` is the country's
  current currency.** `to` is the last day it was in use, so the Deutsche Mark has `to: "2001-12-31"` and the euro `from: "2002-01-01"`.
- `source` where the row came from: `wikidata`; `iso4217` (a withdrawn code ISO 4217 attributes to the country, with no
  start date); `country-codes` (the country's current code, added when Wikidata has no open row for it).

How the rows are made: Wikidata's rows first (a code-less row needs an end date, or it is not kept; a code-less twin of a row
with a code is dropped); an open Wikidata row whose code ISO 4217 has withdrawn gets the withdrawal date as its end; then each
country's current ISO 4217 currency is added if missing; then withdrawn ISO 4217 codes are added to the country their entity
names. Some countries use more than one currency at once (Panama, Zimbabwe, Bhutan, the French territories): all are `to: null`.
Wikidata is a community database; a row can be missing or odd, and the snapshot is the record of what it said.

## Reading it

`src/data/world.ts`: `loadCountries()`, `loadCurrencies()` (one fetch each, a failure is retried on the next call),
`countryName(countries, cc)` (the code itself when unknown) and `flagOf(cc)` (computed from the two letters).
Tests use the slices in `tests/support/world-fixtures.ts`, never the network; `tests/unit/world-data.test.ts` checks the
committed files.
