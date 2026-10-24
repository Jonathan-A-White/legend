# Bulk add: many fronts in one photo, flip, many backs in one

Design for the story mw-f9fv9f.17, from the feedback of 2026-10-24 01:22Z (Legend 0.1.56, the Collection screen):
"take many fronts once and then you flip them all over and do many backs all at once and it matches them all ... we
wouldn't want to mismatch between the front and the back. And the coins would have to be cut out from each other in the
pictures so the pictures should still look like just one front one back". Approved as fitting `VISION.md` (useful for other
collectors, elegant, never kiddy). No product code is in this story; section 4 is the slice plan a Mayor files.

The rule above all others, from his words and the Governor's principle ("easy to use correctly and hard to use
incorrectly"): **a wrong pair is never saved unasked.** Everything below is built so the app either pairs surely, or says
it is unsure and shows him, and nothing is stored until he taps Save.

## What the code gives today

(The story named `src/add/`; the camera is `src/capture/`.)

- `CaptureScreen.tsx` (`#/add`, `#/add?folder=<id>`): a viewfinder, `Front` then `Back`, one coin per Name it. `useCamera.ts`
  asks only `{ facingMode: 'environment' }`, so the video is whatever the phone picks by default (often 1280x720 or 1920x1080).
  `grabFrame` copies a frame; `stillFromFrame` and `stillFromFile` (`captureStill.ts`) encode a JPEG: long side at most
  1600 px (the `sizeCap` setting, 800 to 3200), under 1 MB, upright, with a 320 px thumbnail. `stillFromFile` reads EXIF.
- `startItem.ts`: `addItemWithPhotos` stores the item and its `obverse` and `reverse` photos as one write, `putInFolder`
  when opened from a folder, then `nameQueue.kick()`. `nameQueue.ts` sends one grist at a time (`coin-from-photos` 1.1,
  `sides: ['obverse', 'reverse']`, one to four photos, 4 MB cap in `grinds/coin-from-photos.json`) and keeps the answer on the
  item. Nothing in the repo finds a coin inside a picture: there is no detection or crop code and no image dependency.
- The grind reads a coin or note from its photos. It cannot be told "these two photos might not be the same coin": it
  answers from what it sees and has no field for a mismatch.
- The Confirm sheet already shows the item with both photos for his That's right or Not quite.

Two facts that shape the design. First, a group photo has to be sharper than today's: twelve coins across a 1280 px frame
would be about 250 px each, too small to read a date; the group photos are taken at the camera's full size and only each
cut-out coin is shrunk to the existing limits. Second, the existing per-coin flow, queue and Confirm sheet are kept as they
are: bulk add is a new way to make the same stored item (two photos, front first), so nothing after Save changes.

## 1. The flow at 390x844

A new screen, `#/add/many` (also `#/add/many?folder=<id>`, putting every coin into that coin folder as `#/add?folder=` does),
opened from a button **Add many at once** under the Add entry on the Collection and on a coin folder. Coins only in the first
version; a bill or an Other goes through Add as today. Up to 12 coins in a batch (4 across, 3 down at most); more is a
second batch.

Full-screen like Add, thumb-reachable bottom bar, big type at the top. Four steps; the step name is the 4xl prompt as in Add.

1. **Fronts.** Prompt `Fronts`, caption "Lay the coins out with a thumb's width between them, fronts up, on a plain
   surface." A dashed grid guide (4 x 3 cells) lies over the viewfinder. Shutter, `Use a photo`. After the photo, the coins
   found are outlined on it and numbered 1..n, and the line says "12 coins found". Buttons: `Retake`, `Next`. If the count
   looks wrong he sees it here ("Two coins touch: move them apart and retake").
2. **Flip.** A full-screen card, no camera: "Turn each coin over where it lies. Do not move it." with a drawing of one coin
   flipping in place, and a big `Backs` button (see choice 1 for the alternative). Nothing to get wrong; it is one tap.
3. **Backs.** Prompt `Backs`. The viewfinder shows the fronts' circles as faint ghost outlines (the same numbers) so he can
   hold the phone where it was and see each coin land in its ring. After the photo, the same found-and-numbered check. The
   count must equal the fronts' count: if it does not, the line says "12 fronts but 11 backs" and only `Retake` is offered;
   he cannot continue with an unequal count.
4. **Review.** Nothing is stored yet. The top line reads "12 coins to save" (and "2 to check" when some are unsure). Under it
   a scrolling list of every pair, large: front circle, back circle side by side, its number, a rough size ("same size"), and
   its state. A sure pair has a plain frame; an unsure pair has an amber frame and the words why ("The back is smaller than
   the front. Check it."). Actions on a pair, each one tap:
   - **Swap the back**: tap a pair's `Swap`, then tap another pair's back (or the rest of the batch's unpaired back, if any);
     the two backs trade places and both pairs are re-marked. Two taps, undoable with `Undo`.
   - **Leave out**: a coin with no match is left out of the batch (it is kept to retake alone).
   - **Looks right** on an amber pair: he says he has looked; it turns plain.
   `Save 12 coins` at the bottom is disabled while an amber pair is unchecked and says "Check 2 first". Tapping it stores
   every pair (as `startItem` does: one write per coin, in order) and queues each for the factory, then goes to the
   Collection (or the folder) with "12 coins saved. The factory is reading them." Also `Retake the backs` and `Start over`;
   `Close` asks "Leave without saving? Nothing from this batch is saved yet."

Rules for the whole screen: the page never scrolls (the review list scrolls inside its box); the group photos are held in
memory only and dropped at Save or Close (v1; see slice 8 for keeping a draft); nothing leaves the phone until Save, and then
only each coin's two cut-outs go to the factory, as today (`docs/privacy.md` is unchanged: the group photos never leave).

## 2. How coins are found and cut out

**Recommendation: on the phone, in pure TypeScript, no dependency, no network.** Offline first, instant, no fuel, and the
"two coins touch" and "coin too small" checks can speak at once while the coins are still on the table.

Find (`src/bulk/find.ts`, pure functions over `{ width, height, data: Uint8ClampedArray }` so vitest tests need no canvas):

1. Draw the group photo to a canvas about 640 px on the long side (a copy; the original is kept for the cut).
2. Estimate the background colour as the median of the border pixels and mark every pixel whose colour distance from it is
   over a threshold (Otsu over the distance histogram, so a white sheet, a dark cloth and a wooden table all work).
3. Label connected blobs; throw away specks (under 0.4% of the image) and blobs whose area against their enclosing circle is
   under 0.8 (not round: a hand, a ruler, a shadow).
4. A blob whose area is more than 1.6 times the median is two or more coins touching: reported as `touching`, not cut. In v1
   the answer is "Two coins touch: move them apart". (Splitting touching coins by a distance transform is a later slice, not
   needed to be correct.)
5. Each coin is a circle `{ x, y, r }` in full-size pixels, ordered row by row then left to right (cluster rows by y within
   half a median diameter).

Cut (`src/bulk/cut.ts`): for each circle, `drawImage` the square of side `2.08 r` from the full-size bitmap (`createImageBitmap`,
EXIF-aware as `stillFromFile` does), paint everything outside the circle a neutral dark grey (so a neighbour's rim never
peeks into the corner and the picture "looks like just one front, one back"), and encode it through the existing
`shrinkToLimit`/`fitWithin` path: the long side at most the `sizeCap` setting, under 1 MB, plus the 320 px thumbnail. One
bitmap is decoded once and each crop released before the next (a four-year-old Samsung must not hold twelve canvases).

**Camera size.** The in-app viewfinder must ask for more than the default: `getUserMedia` with `width: { ideal: 4096 }`,
`height: { ideal: 3072 }` (the phone gives what it can), and where the browser has `ImageCapture`, `takePhoto()` for the full
sensor picture. `Use a photo` (the file picker with the phone's own camera app) always gives the full picture and is the
fallback. After the photo the app measures the median coin diameter: **700 px or more** is good, **500 to 700** shows "Coins
look small. Move closer or use fewer coins" but continues, **under 500** refuses ("Too small to read a date"). These numbers
are a first estimate; slice 2 checks the reader against a 600 px coin before they are fixed.

**The grist alternative, and why not.** A vision request could return boxes for the coins. It needs the network, takes
several seconds up to a minute through Postern and the mill, costs a request per group photo (a sonnet read with one image
at effort medium, like one existing coin read; the repo holds no fuel price, so the Mayor reads the fuel cost off the
ledger before quoting a figure), and a language model's boxes are rough (a few percent off at best), so the cut would need
the device's refinement anyway. It would also send the whole group photo, more than the coins, which the privacy rule
("nothing leaves the phone but what he sends") argues against. It is kept as the fallback only if slice 1's detector
fails on the Governor's real tables (choice 2).

**Cost per photo, on the phone recommended:** zero requests. Naming costs what it costs now: one `coin-from-photos` request
per coin (two photos of at most 1 MB each), sent one at a time by `nameQueue`, so 12 coins are 12 requests exactly as 12
single adds would be. The only added cost is the pairing check inside those same requests (section 3), which is no extra
request, a few more words in the answer.

## 3. How pairs are matched, and what shows when unsure

Pairing is a pure function (`src/bulk/pair.ts`) of the fronts' circles and the backs' circles, and the instruction of
choice 1 (default: coins turned in place, so a back lies where its front lay).

1. **Same count or stop.** Unequal counts never reach pairing (section 1 step 3).
2. **Assign.** Find the one-to-one assignment that minimises, for each pair, the distance between the two centres plus the
   difference of radii, both in coin radii (`d/r + |r1-r2|/r`), solved by the Hungarian method (n is at most 12, trivial).
   When the whole tray was turned like a page (choice 1, option B), the backs' x is mirrored about the tray's middle first.
3. **Size check, free and strong.** A coin and its back are the same size in the picture when the phone is held at the same
   height: a back whose radius differs from its front's by more than 5% is flagged ("The back is smaller than the front").
   This catches a quarter paired to a dime (24.3 mm against 17.9 mm is a 36% gap); it cannot tell a cent (19.05 mm) from a
   nickel (21.2 mm) at 11% unless the phone is held very steadily, so the other checks matter.
4. **Margin check.** For each pair, the cost of its best alternative partner against its own: if the next-best back costs
   less than twice as much, the pair is flagged ("This front is close to another coin. Check it."). Coins laid a thumb's
   width apart almost never trip this; a nudged or crowded coin does.
5. **The reader's check, after Save, at no extra request.** The coin-from-photos grind gets a new answer field
   `sidesAgree` (`true`, `false`, or `null` when it cannot tell), version 1.2 of the schemas: "the obverse and the reverse
   are the two sides of one coin or piece of the same series and denomination" (a Lincoln cent front over a Washington
   quarter back is `false`). It is asked on every coin read, bulk or not. When `false`, the item's Confirm sheet opens with
   a notice ("The back may belong to a different coin") with `Retake the back` and `That's right`. This is the net under
   the nets; it runs after Save, so it is the second
   check, not the one that guards the Save (that is the review).
6. **What is shown when unsure.** A flagged pair shows in amber with the reason, sorts to the top of the Review list, and
   blocks `Save` until he taps `Looks right` or swaps it. He cannot save an amber pair without looking at it. A sure pair
   is still shown in full, so a pair that is wrong but looked sure is still visible; the line "12 coins to save" is not
   a button, the pairs are.

What is deliberately **not** used: the order the coins were photographed in (nobody keeps order across a flip), the
reader's guessed year to pair (too slow and offline-hostile), and any silent correction. The app never reorders his pairs
without telling him; every change is a swap he asked for.

Known limits, stated so the Mayor does not file them as bugs: coins of one design and size (twelve quarters of one year)
cannot be told apart by size or look, so position is the only evidence and the margin check is the guard; two coins that
swap places while turning are indistinguishable by the app, and the review is what protects against that.

## 4. Slice plan

Each slice is one story for a Builder, files and acceptance criteria that are checked by running something. The gate
(`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`) is part of every slice's acceptance and not repeated. Each
slice that adds behaviour adds a Gherkin scenario in `features/bulk-add.feature` first. Order: 1, 2, 3 need nothing else
and can run in any order; 4 needs 1 and 2; 5 needs 3 and 4; 6 is independent; 7 needs all; 8 is optional.

**Slice 1: find coins in a photo (pure).**
Files: `src/bulk/find.ts`, `tests/unit/bulk-find.test.ts`, `src/bulk/index.ts`, `docs/module-map.md` (a new `bulk` row: trim
another row first, it is 7 bytes under its budget).
AC: `npm test` runs `tests/unit/bulk-find.test.ts`, which draws synthetic images and finds in them: a 4x3 grid of discs of one
radius on a plain background gives 12 circles in row-major order within 2% of the true centres and radii; the same on a
dark background and a mid-grey one; discs of two radii are both found; two touching discs give one `touching` result and
no circle; a hand-sized blob, a speck and a coin-less picture give no circles; a sheet with a gradient (lighter on the left)
still gives 12. A run on each single-coin example photo in `grinds/examples/coin-from-photos/` (the quarters, the cent, the dime) finds exactly one circle
in `tests/unit/bulk-find.test.ts`. `bulk` code imports nothing from another module's inside.

**Slice 2: cut a coin out of a full-size photo.**
Files: `src/bulk/cut.ts`, `tests/unit/bulk-cut.test.ts`, `grinds/examples/coin-from-photos/lincoln-600px.json` and its two
photos (the 1909-S pair scaled to 600 px with ffmpeg, under 200 KB), `tests/e2e/bulk-cut.spec.ts`.
AC: `npm test` runs `tests/unit/bulk-cut.test.ts` with a fake canvas that records its calls: for a circle `{x,y,r}` the
source rectangle is a square of `2.08 r` centred on it, the area outside the circle is painted grey, the output long side
is at most the `sizeCap` setting and the blob under 1 MB with a 320 px thumbnail, and every canvas is released
(`width = 0`) before the next coin. `npx playwright test --project=shots tests/e2e/bulk-cut.spec.ts` cuts a generated 4000x3000 group photo and
shows the 12 cut-outs in a grid, ending in `shot(page, 'bulk-cut')`, each 700 px or more. `mw grist smoke legend` passes the
new 600 px scenario (year 1909, mint mark S) so the 500 and 700 px thresholds are backed by a real read; if it fails, the story
raises the thresholds and says so on the bead.

**Slice 3: pair fronts to backs (pure).**
Files: `src/bulk/pair.ts`, `tests/unit/bulk-pair.test.ts`, `features/bulk-add.feature` (a first scenario of pairing).
AC: `npm test` runs `tests/unit/bulk-pair.test.ts`: 12 fronts and the same 12 backs, each moved by up to 20% of its radius,
pair every coin to its own back and flag none; with the tray mirrored option the mirrored backs pair the same; one back 10%
smaller is flagged with the size reason; two crowded coins whose backs are swapped in position are both flagged with the
margin reason and never silently re-paired; 11 backs against 12 fronts returns a refusal, not pairs; a pair's flag lists
every reason that applies; the same input gives the same output twice (no randomness).

**Slice 4: the camera for a group photo and the Fronts, Flip, Backs steps.**
Files: `src/bulk/BulkScreen.tsx`, `src/bulk/steps.ts`, `src/capture/useCamera.ts` (a `resolution` option, default unchanged),
`src/nav/route.ts` (the `#/add/many` route, `isKeptHash`, `tabOf`, `addManyHash`), `src/App.tsx` (the case),
`tests/unit/route.test.ts`, `features/bulk-add.feature`, `features/steps/bulk-add.steps.tsx`, `tests/e2e/bulk-add.spec.ts`.
AC: `npm test` shows the new route resolves and the existing `useCamera` tests still pass with the default constraints.
`npm run shots` runs `tests/e2e/bulk-add.spec.ts` at 390x844 with a fake camera and gallery photos: Fronts shows the 4x3 guide,
a photo of 12 discs shows "12 coins found" with numbered outlines (`shot(page, 'bulk-fronts')`), `Next` shows the Flip card
(`shot(page, 'bulk-flip')`), `Backs` shows the 12 ghost rings (`shot(page, 'bulk-backs')`), a back photo of 11 discs shows
"12 fronts but 11 backs" with only `Retake` and no way to continue, and a photo with two touching coins shows "Two coins
touch: move them apart". The camera is released when the screen closes (the existing useCamera test pattern).

**Slice 5: the Review screen, swap, and Save.**
Files: `src/bulk/Review.tsx`, `src/bulk/saveBatch.ts`, `src/capture/startItem.ts` (export what saveBatch reuses; no behaviour
change), `features/bulk-add.feature`, `features/steps/bulk-add.steps.tsx`, `tests/unit/bulk-save.test.ts`, `tests/e2e/bulk-add.spec.ts`.
AC: `npm test` runs the scenarios: after the Backs step the items table holds 0 new items (nothing stored before Save);
an amber pair keeps `Save` disabled with "Check 1 first" until `Looks right` or a swap; `Swap` then a tap on another pair's
back trades the two backs and `Undo` restores them; `Leave out` drops the pair and the count line reads "11 coins to save";
`Save 11 coins` stores 11 items each with an `obverse` photo that is its front cut-out and a `reverse` photo that is the
paired back cut-out (checked by comparing each stored blob with the one the test gave that pair), all `pending`, queued once each
(`nameQueue` sends them in order), and in a coin folder opened with `#/add/many?folder=<id>` every one is in that folder; a
refused write stores nothing of the batch it was part of and says so. `npm run shots` runs the Review at 390x844 with 12 pairs, 2
amber, ending in `shot(page, 'bulk-review')`; the amber pairs are first and all pairs are reachable by scrolling inside the box.

**Slice 6: the reader says when the two sides do not agree.**
Files: `grinds/coin-from-photos.md`, `grinds/coin-from-photos.json` (versions 1.2), `schemas/coin-from-photos-input-1.2.schema.json`,
`schemas/coin-from-photos-answer-1.2.schema.json`, `grinds/examples/coin-from-photos/sides-disagree.json` (the 1909-S
obverse with the 1944-S quarter's reverse, photos already in the folder), `src/services/nameItem.ts` (`NAME_VERSION`),
`src/services/itemAnswer.ts`, `src/data/db.ts` (an optional `sidesAgree` on Item, no new version needed), `src/capture/ConfirmSheet.tsx`,
`tests/unit/grind-examples.test.ts`, `tests/unit/itemAnswer.test.ts`, `features/photo-reader.feature`.
AC: `npm test` passes the grind-example shape tests and the new `itemAnswer` cases (`sidesAgree: false` is kept on the item;
`null` and a missing field are not a warning; an answer of 1.1 shape is still read); the replica text test still passes
(the rule stays worded as it is). `mw grist smoke legend` passes `sides-disagree` (`sidesAgree` equals `false`) and every old
scenario (`sidesAgree` is `true` or `null` on the matching pairs, never `false`). The Confirm sheet scenario shows "The back
may belong to a different coin" for a `false` and nothing for `true` and `null`.

**Slice 7: entry points, docs, and the demo.**
Files: `src/collection/CollectionScreen.tsx`, `src/collection/Folders.tsx` (the `Add many at once` button), `docs/overview.md`
(under 3 KB: one clause), `docs/privacy.md`, `docs/module-map.md`, `ATTRIBUTION.md` only if a source changed (none expected),
`tests/e2e/collection.spec.ts`, `features/collection.feature`.
AC: `npm test` shows the button opens `#/add/many` from the Collection and `#/add/many?folder=<id>` from a coin folder;
the docs budget tests pass; `docs/privacy.md` says the group photos never leave the phone and its test, if any, passes;
`npm run shots` shows the button on the Collection and a coin folder at 390x844. The story ends in the epic's demo story: the
Governor photographs real coins, flips them, takes the backs, sees the Review, and closes it with "Looks good".

**Slice 8 (optional, after the demo): keep a batch if the app is closed.**
Files: `src/data/db.ts` (a new `version(n)` and a `batches` store holding the two group photos and the choices, tests/unit/db.test.ts
updated), `src/bulk/draft.ts`, `src/bulk/BulkScreen.tsx`.
AC: `npm test` shows a batch left at Review reappears after the app is reopened with the same pairs and checks, is deleted at
Save and at `Start over`, and a draft older than 7 days is dropped.

## 5. For the Governor

Three choices. Each has a recommendation; the Mayor puts them on one decision card.

**Choice 1: how does he turn the coins over?**
- A. Turn each coin over where it lies, and do not move it (recommended). Easiest for anyone, nothing to learn, the back is
  in the same place as its front, so position pairs them. Risk: a coin nudged a little while turning; the size and margin
  checks and the Review cover it.
- B. Turn the whole tray or sheet over like a page. Fast with many coins on a card, but the backs come out mirrored left to
  right, and it only works on a sheet he can lift and flip without a coin sliding, and loose coins slide.
- C. Let him pick in a setting. More to explain, two behaviours to test; only if a collector asks.
Recommendation: A in the first version; the pairing code already supports B, so it can be turned on later by a setting.

**Choice 2: how are the coins found in the photo?**
- A. On the phone (recommended). Free, instant, works without a signal, the group photo never leaves the phone. It needs the
  coins a thumb's width apart on a plain surface, and it tells him when two touch.
- B. By the factory (grist). Copes with a messy table, but needs a signal, takes seconds to a minute, costs a request for
  every group photo, sends the whole table, and is still not exact enough to cut with.
- C. The phone first, and the factory only when the phone finds nothing. Best of both, but two code paths and fuel spent on the
  hardest photos; only worth building if the phone's version fails on his real tables.
Recommendation: A, then C only if his own tables show it is needed.

**Choice 3: how strict is the check before Save?**
- A. Every pair is shown; one the app is unsure of is amber and blocks Save until he looks at it (recommended). Quick when
  the coins are clear, and he cannot save an unsure pair without having seen it.
- B. Look at every pair one by one, a tap each. The safest, but twelve taps and one-handed on a phone it wears.
- C. Save everything, and flag a doubt afterward on the Confirm sheet. Fastest, but a mismatch is saved first and found
  later, which is the thing he said he never wanted.
Recommendation: A. The reader's check (`sidesAgree`) runs after Save as a second net in any case.
