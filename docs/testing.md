# Testing behind the licence gate

Legend opens on an Unlock screen until the phone's key holds a `legend` licence on chain (`src/gate/`, wrapped around the
shell in `src/App.tsx`). The gate is not switched off for tests: a test that needs the app either answers the licence lookup
or starts from a key it knows. This page names the one place the key lives and how a test seeds it.

## The device key's storage (the test seam)

- Place: `window.localStorage`, under the key **`legend.deviceKey`** (`DEVICE_KEY_STORAGE_KEY` in `src/config.ts`).
- Value: the private key as 64 lower-case hex characters (a number from 1 up to the curve order).
- It lives outside the Dexie database on purpose (`src/data/db.ts` is shared by other stories; a key must never ride in
  an export or a sync).
- Made once on first open (`getOrCreateDeviceKey`, `src/services/deviceKey.ts`) and never rewritten while it is
  valid. A stored value that is not a usable key (not hex, zero, past the curve order) is replaced by a new one.
- The Unlock screen shows the matching **public** key (33 bytes, 66 hex chars) in `data-testid="device-key"`;
  that is what Postern's Key screen issues a licence to.
- The last `held` answer is remembered in `localStorage` under **`legend.licenceHeld`** = `{"publicKeyHex": …, "at": <ms>}`
  for 24 h (`src/services/licenceCache.ts`), so an offline open within a day still unlocks.

The seam is a storage location, not a bypass: the gate still asks the chain whether that key holds a licence
minted by the issuer. A seeded key with no licence sees Unlock.

### Seeding a known key in Playwright

Every e2e spec except `tests/e2e/gate.spec.ts` starts with `await openUnlocked(page)` (`tests/e2e/unlocked.ts`). It seeds
the key, plants the offline-grace memory (a minute old, good for 24 h) and refuses every WhatsOnChain request, so the gate
opens on its remembered "held" answer. A spec about the gate itself seeds only the key, and the refused chain shows
"Can’t reach the chain":

```ts
await seedDeviceKey(page);            // or seedDeviceKey(page, PRIVATE_KEY_HEX)
await page.goto('/');
await expect(page.getByTestId('device-key')).toHaveText(SEED_PUBLIC_KEY);
```

`SEED_PRIVATE_KEY` is 1 and `SEED_PUBLIC_KEY` is `0279be66…1798`, the well-known generator point.

A live spec (`tests/e2e/<name>-live.spec.ts`, which runs against the deployed app) that needs the real reader seeds a key
whose licence is on testnet, through the same seam, and lets the real lookup run.

### Seeding a key in a Gherkin step

`App` takes an optional `gate` prop for tests: an injected `check` (what the chain says) and `now` (the clock).

```ts
window.localStorage.setItem('legend.deviceKey', '00'.repeat(31) + '01');
render(<App gate={{ issuer, now: () => clock, check: async () => status }} />);
```

A feature about something behind the gate renders `<App gate={openGate} />` (`tests/support/open-gate.ts`, a check that
always says held). `features/gate.feature` is the gate's own behaviour, with steps in `features/steps/gate.steps.tsx`;
neither it nor any unit test touches the network. `fetchLicenceStatus` is tested with bsv-kit's `FakeChainReader`
(`tests/unit/licence-check.test.ts`); `tests/support/licence-chain.ts` builds the mint, transfer and issuer-revoke
transactions it reads.

## The camera and the factory (Add)

The photo reader is bsv-kit's `sendGrist` and `awaitAnswer`; a test puts its own in their place, so nothing touches the network:

- **Feature steps** call `setGristPort(port)` (`src/services/nameItem.ts`) with `tests/support/fake-grist.ts`'s `fakeGrist().port`: every send is
  remembered with its params, `onSend` and `onAnswer` say what happens next, and `nameQueue.configure({ backoffBaseMs })` shortens the retry.
- **Playwright specs** set `window.__legendGrist` in an init script to an object with the same two functions (`tests/e2e/add.spec.ts`).
- **The camera**: jsdom has none, so `tests/support/fake-camera.ts` gives `getUserMedia` a stream, the video a size and a canvas whose
  encoded size follows its pixels and quality (so the 1 MB limit really bites). In Chromium a spec replaces `navigator.mediaDevices.getUserMedia`
  with a canvas's `captureStream()` (`tests/e2e/add.spec.ts`).

## Live check (not in the gate)

`npm run check:licence -- <66-hex public key>` asks testnet what the gate would answer for that key (`held`, `revoked`,
`indexing` or `none`). A gate story is accepted only with this run, because the stub chain cannot show that the real issuer
and collection find a real licence.

## Settings (`src/config.ts`)

| Name | Env var | Default |
| --- | --- | --- |
| issuer public key | `VITE_LEGEND_ISSUER` | the Governor's issuer key `035666d4…44c4` (public); a blank value means the default |
| collection | none | `legend` |
| chain | `VITE_LEGEND_CHAIN` | `testnet` (bsv-kit reads testnet only so far; `mainnet` shows a setup message) |
| Postern door | `VITE_POSTERN_DOOR` | `https://postern.allmymind.org` |

Vite bakes these in at build time: set the variable for `npm run build`.
