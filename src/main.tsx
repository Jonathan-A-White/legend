import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'pwa-kit/whats-new/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { restoreLastRoute } from './nav/lastRoute';
import { startAppUpdates } from 'pwa-kit/app-update';
import { installScrollGuard } from './ui/scrollGuard';

installScrollGuard();
// A bare open reopens where they left off, before the first render reads the address.
restoreLastRoute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// vite.config.ts: registerType 'prompt', so a new build waits for the collector's tap on the banner. The registration
// goes to the update logic, which shows the banner, sends SKIP_WAITING on the tap, reloads once, and
// looks for a new build (pwa-kit/app-update).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) startAppUpdates({ container: navigator.serviceWorker, registration, reload: () => window.location.reload() });
  },
});
