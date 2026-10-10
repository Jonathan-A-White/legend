// src/App.tsx: the shell every screen sits in: the Update banner over the current screen, and the What's new sheet that
// shows once after an update. There is one screen so far (src/screens/home); the nav module arrives with the second.
import { UpdateBanner } from './UpdateBanner';
import { Home } from './screens/home';
import { WhatsNewOnUpdate } from './whatsNew/WhatsNewOnUpdate';

export function App() {
  return (
    // data-shell: the scroll guard (src/ui/scrollGuard.ts) keeps this box at scrollTop 0
    <div data-shell className="flex h-full flex-col overflow-clip bg-canvas text-ink">
      <UpdateBanner />
      <Home />
      <WhatsNewOnUpdate />
    </div>
  );
}
