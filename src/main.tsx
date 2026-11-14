import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'pwa-kit/whats-new/styles.css';
import 'voice-kit/composer/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { restoreLastRoute } from './nav/lastRoute';
import { startAppUpdates } from 'pwa-kit/app-update';
import { fetchChangelog, hasNewsSince } from 'pwa-kit/whats-new';
import { APP_SEMVER } from './config';
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
// looks for a new build (pwa-kit/app-update). A waiting build whose changelog has no line after the running version
// (tests, lint, a version bump) raises no banner and is taken quietly; one with a line is offered (pwa-kit's hasNewsSince).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) {
      startAppUpdates(
        { container: navigator.serviceWorker, registration, reload: () => window.location.reload() },
        { version: APP_SEMVER, hasNewsSince: hasNewsSince(() => fetchChangelog(import.meta.env.BASE_URL)) },
      );
    }
  },
});
