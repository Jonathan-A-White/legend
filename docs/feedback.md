# Feedback and tips

## Tell the maker

A small **…** on the Collection, Globe, Quarters and Learn bars, and **Tell the maker** in Settings (Feedback row), open one
sheet (`src/feedback/FeedbackSheet.tsx`). Two big entries: **Can I add this?** (kind `add`) and **Something's wrong** (kind
`wrong`); neither tapped, the words go as kind `other`. A box for their words (1200 characters at most), an optional
**Attach a screenshot** (one JPEG, PNG or WebP, 8 MB at most) and **Send**, which waits for words. Under the box sits voice-kit's Composer (**Hold to talk**, or
**Type it here**, then **Send these words**): its words go with the box's, as the feedback.

### What is sent

One grist of the kind `feedback` (`grinds/feedback.json`, input `schemas/feedback-input-1.0.schema.json`):

```json
{ "kind": "add", "screen": "Globe", "text": "their words", "app_version": "0.1.11-…" }
```

Nothing else: no item, no collection, no photo of a coin, no name. The one attachment is the screenshot they chose. The grist is
sealed to the mill with the phone's device key and posted through Postern (`src/services/grist.ts` `askGrind`,
`src/services/feedback.ts`). Nothing is sent until they tap Send.

### Where it goes

The grind is a forwarding one (`"forward": "mayor"`): no model reads it. The mill mails the grist, with its screenshot, to the
Mayor and answers `{"status":"sent"}`. **The Mayor files each one as a bead** for the Legend rig; that is how the factory reads
them. The sheet says *Sent, thank you: the factory reads these* once the mill has answered.

### Offline

Send always writes the feedback to the `outbox` store first (`src/feedback/outbox.ts`; the screenshot is kept in the record).
If the phone is offline or the mill cannot be reached, the sheet says *Saved on this phone. It goes when you are online.* and the
record waits. It is sent when the phone's `online` event fires, when the app opens, and on the next Send; passes run one at a time
so a record never goes twice. A record leaves the outbox only after the mill's receipt.

## Tips

Three one-line tips, each shown once and dismissed with **Got it** (`src/tips/`): camera *Front first, then back, in daylight*;
globe *Drag to turn, pinch to zoom, tap a lit country*; tutor *Ask about the coin in front of you*. They are static (no grind). The list and
"dismissed for good" are pwa-kit's `tips`; the dismissals are in `localStorage` under `legend.tipsDismissed`. A screen draws its tip
with `<HintCard event={CAMERA_OPENED | GLOBE_OPENED | TUTOR_OPENED} />`. The Globe draws its own; the camera and tutor tips are
drawn by the stories that build those screens.

The usage log (`src/tips/usageLog.ts`) counts, per local day, every bus event kind, `screen:<route>` and `tip.shown:<id>` /
`tip.dismissed:<id>`, in the `usage` store. Counts only; it never keeps an event's other fields or anything they typed, and it never
leaves the phone.

## Let the tutor do it

Under the fields of Tell the maker (and of What is the asking price?, `src/wishlist/wishForm.ts`) sits the button **Let the tutor do
it** (`src/tutor/FormDoor.tsx`). It opens a panel where the tutor asks one question at a time (the `legend-ask` grind with `form` in
its request, `src/tutor/formRequest.ts`; voice-kit's `forms` describes the form) and each answer fills the matching field: *What is it?*
(the two kinds), *Your message*, and a *screenshot* only he can add (the panel offers Choose a picture or No picture). When the required
field holds something the panel shows the question `tell-the-maker` puts ("Send to the maker (Can I add this?): ...?") and a **Send**
that runs that same confirm command (`src/feedback/feedbackForm.ts`): the sheet's own Send runs it too, so there is one path into the
outbox. The tutor never sends; Stop helping closes the panel and keeps what is filled. `wish-for` is the same for **Add to Wish list**.
