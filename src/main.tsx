import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'bsv-kit/whats-new/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startAppUpdates } from './services/appUpdate';
import { installScrollGuard } from './ui/scrollGuard';

installScrollGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// vite.config.ts: registerType 'prompt', so a new build waits for the collector's tap on the banner. The registration
// goes to the update logic, which shows the banner, sends SKIP_WAITING on the tap, reloads once, and
// looks for a new build (src/services/appUpdate.ts).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) startAppUpdates({ container: navigator.serviceWorker, registration, reload: () => window.location.reload() });
  },
});
