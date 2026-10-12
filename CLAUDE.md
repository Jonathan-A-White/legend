# CLAUDE.md

Guide for AI assistants (Builders) working on Legend: a licence-gated, offline-first PWA for collecting coins and
banknotes, served at https://legend.allmymind.org from the VPS (Vite `base` is `/`; the Laptop's after_landing rsyncs
`dist/`). There is no GitHub Pages workflow: do not add one, and do not change `.github/workflows/` unless a story says
so. Never bump `package.json`'s version (`mw next` does). No AI attribution lines in commits.

VISION.md is the Governor's vision for this app: a change that would cross one of its lines stops and says so.

## Gate command

```bash
npm ci --no-audit --no-fund && TZ=UTC npm test && npm run typecheck && npm run lint && npm run build
```

All must pass clean before a story is done. A fresh worktree has no `node_modules`: `npm ci` first (Node 20+).

## Read first

1. `docs/overview.md`: what Legend is, the screens planned, where things live, the one-line rules.
2. `docs/module-map.md`: the modules, their entry files, the files stories collide on. A new screen is a new folder.
3. The vault's PWA best practices (`/home/jwhite/millwright-vault/seats/builder/pwa-best-practices/README.md`, then only
   the topics your story needs). A screen that breaks one of its rules is not done.
4. The rig memory (`/home/jwhite/millwright-vault/seats/builder/rigs/legend.md`): the Mayor loads it into your seat.

The Governor's principle for every screen: "make this app easy to use correctly and hard to use incorrectly". Elegant,
large clear type, one-handed on a phone, never kiddy. Private by default.

## Scripts

```bash
npm run dev          # dev server
npm run build        # tsc -b + vite build -> dist/ (self-contained, root-absolute /assets/...)
npm run preview      # serve dist/ locally
npm test             # vitest run: unit tests and feature specs
npm run test:bdd     # vitest run, features/steps only
npm run typecheck    # tsc -b --noEmit, strict
npm run lint         # eslint, no explicit any
npm run shots        # Playwright at 390x844 against `vite preview` of dist/ (build first, or npm run gate:shots); writes shots/<name>.png
npm run e2e:live     # live specs (tests/e2e/*-live.spec.ts: photo-live, ask-live) against the DEPLOYED app; not in the gate; see Live tests
npm run data:build   # rebuild public/data/world/*.json from data/raw and data/snapshots (docs/data.md); a second run changes nothing
npm run mintages:build # rebuild public/data/us/mintages.json from data/snapshots/mintages; needs no network
npm run icons        # re-render public/icon-192.png and icon-512.png from public/icon.svg
npm run grind:build  # write the talkable settings into grinds/legend-ask.md and its answer schema (after a registry change)
```

## Tests

- Test-first: write the failing test or scenario before the code that makes it pass.
- Every behaviour is a Gherkin scenario in `features/*.feature` with steps in `features/steps/*.steps.ts(x)`
  (@amiceli/vitest-cucumber), run inside `npm test`. Import `@testing-library/react/dont-cleanup-after-each` before React
  Testing Library in a step file. A repeated identical step text in one scenario is refused; a `.feature` prose line must
  not start with Given/When/Then/And.
- Unit tests in `tests/unit/`, shared fakes in `tests/support/`. jsdom with `fake-indexeddb`, `TZ=UTC`.
- jsdom has no layout: a layout claim is proven by a Playwright spec in `tests/e2e/` at 390x844 ending with
  `shot(page, name)`. Service workers are blocked in e2e.
- esbuild refuses to run inside jsdom: a test needing a real build runs `node node_modules/vite/bin/vite.js build --outDir <tmp>`
  in a child process (`features/steps/install.steps.tsx`).

## Live tests

`npm run e2e:live` runs the `live` Playwright project: `photo-live` (Add with the example quarter's two photos, expects US and a
quarter) and `ask-live` (asks where the mint mark is). They use the real licence gate, Postern and the mill, so they spend fuel,
prove a landing only after the deploy (the grist door's CORS allows only https://legend.allmymind.org; `LEGEND_LIVE_URL`
overrides the origin), and need a key with a Legend licence: `LEGEND_TEST_KEY` or `~/.config/mw/legend-test.env`. No key: SKIP,
exit 0. An unlicensed key fails on Unlock, saying so. The chromium and shots projects ignore them. Never print the key.

## Docs stay true

A story that changes a source of data, a screen's purpose or a module boundary updates `docs/overview.md`,
`docs/module-map.md` and `ATTRIBUTION.md` in the same story. Keep them under budget (`tests/unit/docs-budget.test.ts`:
overview 3 KB, module map 6 KB, this file 6 KB). Data that ships must be free to redistribute (Wikidata CC0, Natural Earth,
US Mint figures, ISO 4217): never copy in Numista, PCGS, NGC, ucoin or Colnect data.

## Dependencies

bsv-kit has no release tag: it is pinned by commit in `package.json` (a re-pin also bumps `package-lock.json`'s
`node_modules/bsv-kit` version and drops its `integrity` by hand, or `npm ci` refuses). Import `bsv-kit/bsv`, `bsv-kit/grist`,
`bsv-kit/whats-new`, never `@bsv-kit/*`. `package.json`'s `allowScripts` lets its prepare build run under npm 11.

## Closing comment

Every closing comment ends with: `Docs: read <files>; <helped|unused|hurt> because <one line>`.
