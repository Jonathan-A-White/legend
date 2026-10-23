# What leaves the phone

Legend keeps everything on the phone: the collection, the photos and the notes live in the phone's own store (IndexedDB).
Nothing is sent anywhere unless he asks for it, and only these things ever leave.

## What leaves

- **Grist he sends.** Asking the tutor a question or having a coin read from its photos sends that one request to the
  factory's mill (grist, through `src/services/`). It goes when he taps Ask (or a suggested question) or Add, never in the
  background. A question to the tutor carries his question; on an item, its facts (never his notes or tags, but with its
  rarity line, the same words the item shows) and its two photos; on a country, the country and no photo; always a count of his collection by country and kind, the settings the
  tutor may suggest, and the last three questions asked there with their answers. The tutor can suggest a setting, never
  change one: it changes only when he taps Apply.
- **Let the tutor do it.** On Tell the maker and What is the asking price?, tapping this button sends the tutor the form's name and
  fields with what each holds so far (his message, the price, the store), one request for each answer he gives, and the last
  three of the exchange; nothing of his collection and no photo goes (`src/tutor/formRequest.ts`). The tutor never sends the form: only his tap on Send does.
- **A rough worth.** Once an item is named, its facts and grade guess (never its photos, notes or tags) go to the mill to ask
  what it might roughly be worth, once, and again after 30 days or when its grade guess or year changes (`src/services/value.ts`).
  A coin he is only looking at asks at once. Turning Show values off in Settings, Collection, stops the asking and hides the figures.
- **How rare it is.** For a coin or note Legend's tables do not cover, tapping How rare is it? sends its facts (never photos,
  notes, tags or grade) to the mill, once per tap (`src/services/rarity.ts`). The estimate is kept on the item.
- **A picture he shares.** The Share button on the globe and on an item makes one JPEG on the phone and hands it to the phone's
  own share sheet (`navigator.share`), and he chooses who gets it. A phone with no share sheet shows a Save picture link instead
  and nothing is sent. Only a tap on Share does this (`src/share/`).
  - The globe picture is the globe as he left it with his lit countries, a caption ("Paul's coins come from 12 countries"; the
    name is the Your name setting, empty says My), the Legend mark and the date.
  - An item card is both photos, the country, denomination, year, mint, series, design, the grade guess marked guess, and the
    inscription.
- **The licence check** (once the gate is built). Opening the app checks that the phone holds a licence for Legend. It sends
  the licence, not the collection.
- **The app itself.** The phone downloads new builds of the app and its reference data (countries, quarters). Nothing of his goes
  with those requests.

## What never leaves

- His notes, tags, estimates of worth, wear notes, the fun fact, and any text that looks like a serial number (a run of eight
  or more digits): a card never carries them (`src/share/text.ts` leaves them out, and a test fails if one gets in).
- The Wish list: a wished coin's asking price, store and savings stay on the phone (no card or picture carries them, and a
  wished coin is not in the globe's count). Nothing is sent for them but the rough worth the factory is asked for, and the price and
  store he types or says while the tutor helps fill in that form.
- The collection as a whole, the photos he did not share, and what he searched for or looked at.
- Anything at all while **Sharing** is off in Settings, Privacy: no Share button is drawn then. The tutor cannot turn Sharing
  on; only he can.

A line under each Share button says "Only this picture leaves the phone." until he has used it once.
