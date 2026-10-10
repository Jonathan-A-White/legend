# Grind examples

Each grind in `grinds/<kind>.json` keeps scenarios, BDD-style, under `grinds/examples/<kind>/<name>.json`. A scenario is
what a collector does (the request and its photos) and what the answer must show (`expect`). `mw grist smoke legend` sends
the request to the real grist and checks the answer against `expect`; `tests/unit/grind-examples.test.ts` checks every
scenario's shape without a network, and fails when a grind has no scenario.

```json
{
  "description": "One plain sentence: the situation and what must come back.",
  "schemaVersion": "1.0",
  "request": { "kind": "coin", "hint": null, "sides": ["obverse", "reverse"] },
  "photos": ["lincoln-1909s-obverse.jpg", "lincoln-1909s-reverse.jpg"],
  "expect": {
    "country": { "equals": "US" },
    "year": { "equals": 1909 },
    "confidence": { "one_of": ["high", "medium"] }
  }
}
```

- `schemaVersion`: one of the grind's `versions`; names the input and answer schema
  (`schemas/<kind>-input-<version>.schema.json`).
- `request`: the grind's input exactly as the app sends it; valid against the input schema. For coin-from-photos, `sides`
  names what each photo shows, in the photos' order.
- `photos`: file names beside the scenario (`.jpg`, `.jpeg` or `.webp`), as many as the grind's `attachments` allow. Public-safe
  only: free to redistribute, no people, no personal data, no real serial numbers, under 200 KB. Scenarios may share a photo.
- `expect`: answer path (a field name; dots for nested fields) to a check. A check is a bare value (the field equals it) or an
  object of the names below; `mw grist smoke` refuses any other name, so use these exactly, and `tests/unit/grind-examples.test.ts`
  fails an example that does not. Every name given for a path must hold:
  - `equals`: the value is exactly this
  - `is_null`: `true` the value is null, `false` it is not
  - `one_of`: the value is one of these
  - `contains`: a string field includes this text
  - `matches`: a string field matches this regular expression (case classes such as `[Cc]ent`: no inline flags)
  - `present`: `true` the field is in the answer, `false` it is left out
  - `all`: a list of checks of these same names, each of which must hold too (for a field that must show several things)

Every `expect` path must be a field of the grind's answer schema, and every `equals` or `one_of` value must be one the schema
allows.

A story that changes a grind's behaviour updates or adds its scenarios in the same story. A new grind needs at least one
scenario or the unit test fails.

## coin-from-photos: where each photo comes from

Every photo is on Wikimedia Commons and free to use; each was scaled down (long side 600 to 1000 px) and saved as a JPEG
under 100 KB, nothing else changed. Credit is also in `ATTRIBUTION.md`.

| File | Source and author | Licence |
|---|---|---|
| `lincoln-1909s-obverse.jpg`, `lincoln-1909s-reverse.jpg` | [1909-S VDB Lincoln cent obverse](https://commons.wikimedia.org/wiki/File:1909-S_VDB_Lincoln_cent_obverse.jpg) and [reverse](https://commons.wikimedia.org/wiki/File:1909-S_VDB_Lincoln_cent_reverse.jpg); image by Lost Dutchman Rare Coins, coin design by Victor David Brenner | Public domain |
| `washington-quarter-1944s-obverse.jpg`, `washington-quarter-1944s-reverse.jpg` | [Washington Quarter Silver 1944S Obverse](https://commons.wikimedia.org/wiki/File:Washington_Quarter_Silver_1944S_Obverse.png) and [Reverse](https://commons.wikimedia.org/wiki/File:Washington_Quarter_Silver_1944S_Reverse.png); image by Brandon Grossardt, coin design by John Flanagan | Public domain |
| `canada-dime-1955.jpg` | [Canada $0.1 1955](https://commons.wikimedia.org/wiki/File:Canada_$0.1_1955.jpg); photograph by Mister rf, coin design by Emanuel Hahn | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| `canada-1935-one-dollar-note.jpg` | [Obverse of $1 banknote, Canada 1935 Series, English version](https://commons.wikimedia.org/wiki/File:Obverse_of_$1_banknote,_Canada_1935_Series,_English_version.jpg); Bank of Canada, from the National Currency Museum. A specimen note: its number A0000003 is the specimen's, not a real note's | Public domain |
