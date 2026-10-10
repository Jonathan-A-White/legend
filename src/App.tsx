// src/App.tsx: the licence gate around the shell every screen sits in. The shell is the Update banner over the current screen,
// the bottom bar under it, and the What's new sheet that shows once after an update. The screen switch below is the one place a
// new screen is added: one line. Until the phone's key holds a licence the gate shows Unlock instead of the shell (src/gate/).
import { Gate, type GateProps } from './gate';
import { UpdateBanner } from './UpdateBanner';
import { CountrySheet, GlobeScreen } from './globe';
import { BottomBar } from './nav/BottomBar';
import { countryOf, itemIdOf, routeOf, useAddress } from './nav/route';
import { useRouteEvents } from './nav/useRouteEvents';
import { CollectionScreen, ItemView } from './collection';
import { Home } from './screens/home';
import { Learn } from './screens/learn';
import { Quarters } from './quarters';
import { SettingsScreen } from './settings/SettingsScreen';
import { useAppearance } from './settings/useAppearance';
import { WhatsNewOnUpdate } from './whatsNew/WhatsNewOnUpdate';

function Screen({ hash }: { hash: string }) {
  switch (routeOf(hash)) {
    case 'collection':
      return <CollectionScreen />;
    case 'globe':
      return <GlobeScreen />;
    case 'quarters':
      return <Quarters />;
    case 'learn':
      return <Learn />;
    case 'settings':
      return <SettingsScreen />;
    case 'item':
      return <ItemView id={itemIdOf(hash)!} />;
    case 'country':
      return <CountrySheet code={countryOf(hash)!} />;
    case 'home':
      return <Home />;
  }
}

function Shell() {
  const hash = useAddress();
  useRouteEvents();
  return (
    // data-shell: the scroll guard (src/ui/scrollGuard.ts) keeps this box at scrollTop 0
    <div data-shell className="flex h-full flex-col overflow-clip bg-canvas text-ink">
      <UpdateBanner />
      <Screen hash={hash} />
      <BottomBar />
      <WhatsNewOnUpdate />
    </div>
  );
}

/** `gate` is for tests: an injected licence check and clock (docs/testing.md). The app itself passes none. */
export function App({ gate }: { gate?: Omit<GateProps, 'children'> }) {
  // The theme and text size apply on the Unlock screen too.
  useAppearance();
  return (
    <Gate {...gate}>
      <Shell />
    </Gate>
  );
}
