// src/App.tsx: the shell every screen sits in: the Update banner over the current screen, the bottom bar under it, and the
// What's new sheet that shows once after an update. The screen switch below is the one place a new screen is added: one line.
import { UpdateBanner } from './UpdateBanner';
import { CountrySheet, GlobeScreen } from './globe';
import { BottomBar } from './nav/BottomBar';
import { countryOf, itemIdOf, routeOf, useAddress } from './nav/route';
import { useRouteEvents } from './nav/useRouteEvents';
import { Collection } from './screens/collection';
import { Home } from './screens/home';
import { Item } from './screens/item';
import { Learn } from './screens/learn';
import { Quarters } from './screens/quarters';
import { SettingsScreen } from './settings/SettingsScreen';
import { useAppearance } from './settings/useAppearance';
import { WhatsNewOnUpdate } from './whatsNew/WhatsNewOnUpdate';

function Screen({ hash }: { hash: string }) {
  switch (routeOf(hash)) {
    case 'collection':
      return <Collection />;
    case 'globe':
      return <GlobeScreen />;
    case 'quarters':
      return <Quarters />;
    case 'learn':
      return <Learn />;
    case 'settings':
      return <SettingsScreen />;
    case 'item':
      return <Item id={itemIdOf(hash)!} />;
    case 'country':
      return <CountrySheet code={countryOf(hash)!} />;
    case 'home':
      return <Home />;
  }
}

export function App() {
  const hash = useAddress();
  useRouteEvents();
  useAppearance();
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
