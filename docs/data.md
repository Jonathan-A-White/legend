# Data

Two sets of static JSON ship with the app, both precached (`pwa-precache.ts`): the world data (`public/data/world/`) and the US reference data (`public/data/us/`). No catalogue is copied in.

## World data

`npm run data:build` (`scripts/data-build.ts`, run with `tsx`) writes two files that ship with the app and are precached by
the service worker (`pwa-precache.ts`), so the globe and the country sheet work offline. Both are committed. A second run
changes nothing: `git diff --exit-code public/data` is clean.

Raw downloads go to `data/raw/` (git-ignored; the build downloads what is missing and skips what is there). The one network
answer that is not a plain file, Wikidata's, is committed as `data/snapshots/wikidata-currencies.json`, so after the first run
the build needs no network. To refresh it, delete the snapshot and run the build; commit the new snapshot with the new output.

### Sources and licences

| Source | Used for | Licence |
|---|---|---|
| [world-atlas](https://github.com/topojson/world-atlas) `countries-110m.json` (Mike Bostock; built from [Natural Earth](https://www.naturalearthdata.com)) | the country shapes, with ISO 3166-1 numeric ids | ISC; Natural Earth is public domain |
| [datasets/country-codes](https://github.com/datasets/country-codes) | numeric -> alpha-2, names, continent, each country's current ISO 4217 code | PDDL |
| [datasets/currency-codes](https://github.com/datasets/currency-codes) `codes-all.csv` (ISO 4217, current and historic) | currency names, withdrawal dates of old codes | PDDL |
| [Wikidata](https://www.wikidata.org) via `scripts/wikidata-currencies.rq` | each country's currencies with start and end dates (P38 with P580/P582) | CC0 |

### `public/data/world/countries.json`

TopoJSON (about 119 KB; kept under 120 KB). `objects.countries.geometries[]` has one shape per country, ordered by alpha-2:
`{type, arcs, id: "DE", properties: {name: "Germany"}}`. `id` is the ISO 3166-1 alpha-2 code; Kosovo is `XK`, the
user-assigned code. Shapes with no ISO code (Somaliland, Northern Cyprus) are left out. The top-level `names` maps alpha-2
to `{name, numeric, flag, continent}`: `numeric` is the three-digit ISO number (`""` for Kosovo), `flag` the flag emoji,
`continent` one of AF, AN, AS, EU, NA, OC, SA. The `land` object and the arcs only it used are dropped.

### `public/data/world/currencies.json`

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

### Reading it

`src/data/world.ts`: `loadCountries()`, `loadCurrencies()` (one fetch each, a failure is retried on the next call),
`countryName(countries, cc)` (the code itself when unknown) and `flagOf(cc)` (computed from the two letters).
Tests use the slices in `tests/support/world-fixtures.ts`, never the network; `tests/unit/world-data.test.ts` checks the
committed files.

## US data

What ships in `public/data/us/`, where it came from and how to change it. Everything is static JSON, precached for offline
use (`pwa-precache.ts`), loaded by `src/data/us.ts`. `tests/unit/us-data.test.ts` pins the counts and samples. Everything is
hand-written from public facts: no catalogue (Numista, PCGS, NGC, ucoin, Colnect) is copied, and no file gives a price.

| File | Holds | Source |
|---|---|---|
| `quarters.json` | 138 circulating quarter designs, 1999-2026: `program`, `year`, `order`, `name`, `jurisdiction`, `design`, `mintMarks`, `notes` | Wikipedia tables (CC BY-SA 4.0) for names, years and release order, which match the US Mint's programme pages |
| `mints.json` | `mints`: the eight marks (P, D, S, W, CC, O, C, D Dahlonega) with city, years and a note; `placement`: where the mark sits on the cent, nickel, dime and quarter | Wikipedia "Mint mark" (CC BY-SA 4.0); the US Mint mint marks page is the reference (it blocked the Builder's fetch, so placement is from general knowledge: check it when a story relies on it) |
| `grades.json` | Sheldon steps PO-1 to MS-70, each with the numbers it covers (`from`-`to`) and a plain description on a Lincoln cent and a Washington quarter | Sheldon's scale; descriptions written for Legend |
| `key-dates.json` | Lincoln cent, Jefferson nickel, Roosevelt dime and Washington quarter: key dates and varieties, one plain reason each | Hobby knowledge; our words, no prices or mintages |
| `states.json` | TopoJSON of the 50 states and DC (Albers, 975 x 610, under 100 KB), `properties: {name, code}` | us-atlas `states-albers-10m` (ISC; Census data, public domain) |

### Rules

- `program` is one of `state` (50), `dc-territories` (6), `america-the-beautiful` (56), `washington-crossing` (1),
  `american-women` (20), `semiquincentennial` (5). `order` is the release order inside the programme, from 1.
- `jurisdiction` is the state or territory code (the park's state for America the Beautiful); `null` for the three
  programmes that are not about a place. The territories (PR, GU, AS, VI, MP) are not in `states.json`: the Albers file has
  only the 50 states and DC, so the Quarters map draws the territories as chips.
- Every quarter lists `P`, `D` and `S`; the W-marked circulation quarters (2019-W) are not tracked as separate designs.
- The last 2026 design (Gettysburg Address) is scheduled for 21 October 2026; its `notes` say so.
- State quarters with known errors are not listed one by one: key dates points to the Mint, with no values.
- Grades: a number is looked up with `gradeFor`; the steps' `from`-`to` together cover 1 to 70 exactly once.
- A new source adds a row here and in `ATTRIBUTION.md` in the same story.

### Matching items to designs (the Quarters screen)

`src/quarters/match.ts` (pure) decides which design an item is. The item must be `country` US with a denomination containing
"quarter"; case, accents and punctuation are ignored. A programme in `series` ("America the Beautiful quarters, Yosemite",
"50 State Quarters") narrows the designs, and `year` must equal the design's year when the item has one. Then, in order: (1)
the `design` field is exactly a design's name ("Yosemite", "Yosemite National Park") or its look: this is the hand override,
writing the name in the item's design field says what the piece is; (2) the series after the programme words names the design;
(3) a programme with one design needs no name, or the design text contains the name or look. Two equally good designs, or none,
is no match: a year or a programme is needed unless the design is exactly a name. "Yosemite National Park" is also "Yosemite"
(the text from "National" or "(" on is dropped). A place is lit when he has all of its designs in the chosen programme, half
when some; the American Women, Crossing the Delaware and 2026 designs have no place, so they only count and list.

### Learn (`src/learn/`)

Every Learn page reads the files above and his own items; nothing leaves the phone. Rules, all pure and tested:

- Grading: `bandsOf` groups the 30 steps into bands (MS to PO). A coin's `gradeGuess` sits at its step when it names one ('VF-30',
  'MS65') or on its band when it does not ('VF'); 'EF' is XF and 'P' is PO. The walk's three answers give a band (`walkBand`) and
  only Keep writes it to the item.
- Mints: a US coin is under the mint with its mark; where two share a mark (D) the year picks one (Denver 1906-, Dahlonega 1838-1861).
- Special years: a coin's series is found from its series text, else its denomination. It matches a key date by series and year, by mint
  mark where the date names one, and with no mark where the date is plain or a doubled die; those say to look closely.
- Your path: levels start at counts Grading 0/5/20 (items with a gradeGuess), Mints 0/3/8 (distinct US marks), World 1/5/15/30
  (countries), Quarters 0/10/30/60 (designs matched), Looking 0/5/20 (items tagged `considered`), Tutor 0/3/10 (asks).
