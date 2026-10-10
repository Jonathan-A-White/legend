# Events

Screens do not call each other. They talk through one typed bus, `src/events/bus.ts`:

```ts
publish({ kind: 'item.added', id });
const off = subscribe('item.added', (event) => { /* … */ }); // later: off()
latest('route.changed');                         // the last one published, or undefined
useEvent('settings.changed', (event) => { /* … */ }); // React: subscribed while mounted
useLatest('route.changed');                      // React: the last one, re-rendering when another comes
```

- Listeners are called in the order they subscribed. A listener that throws is logged and the others still hear the event.
- A listener hears only events published after it subscribed; a screen that mounts late reads `latest(kind)` or `useLatest`.
- Payloads are plain values (ids, keys, hashes), never records: a listener that needs the record asks its repository.
- `AppEvent` in `bus.ts` is the list of kinds. Add a kind there and a row below; `tests/unit/bus.test.ts` fails when the
  two differ. Tests call `clearBus()` to forget listeners and kept events.

## Kinds

| Kind | Payload | Published by | Listened to by |
| --- | --- | --- | --- |
| `item.added` | `{ id }` | `addItem` in `src/data/repositories/items.ts` | nobody yet |
| `item.named` | `{ id }`: the item got its country, denomination and the rest | `nameItem` (items.ts) | nobody yet |
| `item.updated` | `{ id }` | `updateItem` (items.ts) | nobody yet |
| `item.removed` | `{ id }`: kept with `deletedAt` set | `removeItem` (items.ts) | nobody yet |
| `route.changed` | `{ hash, route }`: the whole hash and its screen name | `useRouteEvents` in `src/nav/useRouteEvents.ts`, from App | nobody yet |
| `settings.changed` | `{ key, value, previous }` | `writeSetting` in `src/settings/registry.ts`: Settings and the tutor both write through it | nobody yet (the theme and text size are read live) |
| `ask.sent` | `{ id, itemId }`; `itemId` is null for a question about the app | `addAsk` in `src/data/repositories/asks.ts` | nobody yet |
| `ask.answered` | `{ id, itemId }` | `answerAsk` (asks.ts) | nobody yet |
| `feedback.sent` | `{ feedback }`: add, wrong or other | `submitFeedback` in `src/services/feedback.ts`, once the mill has the grist | nobody yet |
| `tip.shown` | `{ id }`: camera, globe or tutor | `HintCard` in `src/tips/` | the usage log (`subscribeAll`) |
| `tip.dismissed` | `{ id }` | `HintCard` (the tap on Got it) | the usage log |
