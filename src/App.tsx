// src/App.tsx: the licence gate around the shell every screen sits in. The shell is the Update banner over the current screen,
// the bottom bar under it, and the What's new sheet that shows once after an update. The screen switch below is the one place a
// new screen is added: one line. Until the phone's key holds a licence the gate shows Unlock instead of the shell (src/gate/).
import { Gate, type GateProps } from './gate';
import { UpdateBanner } from './UpdateBanner';
import { CountrySheet, GlobeScreen } from './globe';
import { BottomBar } from './nav/BottomBar';
import { countryOf, folderIdOf, itemIdOf, routeOf, useAddress } from './nav/route';
import { useRouteEvents } from './nav/useRouteEvents';
import { CaptureScreen, useNameQueue } from './capture';
import { CollectionScreen, ItemView } from './collection';
import { useSendWaiting } from './feedback';
import { Home } from './screens/home';
import { Learn } from './learn';
import { Quarters } from './quarters';
import { SettingsScreen } from './settings/SettingsScreen';
import { useAppearance } from './settings/useAppearance';
import { useUsageLog } from './tips';
import { WishListScreen } from './wishlist';
import { WhatsNewOnUpdate } from './whatsNew/WhatsNewOnUpdate';

function Screen({ hash }: { hash: string }) {
  switch (routeOf(hash)) {
    case 'collection':
      return <CollectionScreen />;
    case 'folder':
      return <CollectionScreen folderId={folderIdOf(hash)} />;
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
    case 'add':
      return <CaptureScreen />;
    case 'wishlist':
      return <WishListScreen />;
    case 'home':
      return <Home />;
  }
}

function Shell() {
  const hash = useAddress();
  useRouteEvents();
  useSendWaiting();
  useUsageLog();
  // The queue of photos for the factory runs for as long as the shell is up, which is only once the gate is open.
  useNameQueue();
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
