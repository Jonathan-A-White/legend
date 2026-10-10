# What leaves the phone

Legend keeps everything on the phone: the collection, the photos and the notes live in the phone's own store (IndexedDB).
Nothing is sent anywhere unless he asks for it, and only these things ever leave.

## What leaves

- **Grist he sends.** Asking the tutor a question or having a coin read from its photos (as those screens are built) sends
  that one request to the factory's mill (grist, through `src/services/`): the question or the photos it is about. It goes
  when he taps Ask or Add, never in the background.
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
- The collection as a whole, the photos he did not share, and what he searched for or looked at.
- Anything at all while **Sharing** is off in Settings, Privacy: no Share button is drawn then. The tutor cannot turn Sharing
  on; only he can.

A line under each Share button says "Only this picture leaves the phone." until he has used it once.
