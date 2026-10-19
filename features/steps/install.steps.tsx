// features/steps/install.steps.tsx — runs features/install.feature: the manifest of a real build, the
// zoom and scroll rules in index.html and the root css, the update banner under a fake registration and
// the home screen's build stamp.
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { UpdateBanner } from '../../src/UpdateBanner';
import { startAppUpdates, type AppUpdates } from 'pwa-kit/app-update';
import { Home } from '../../src/screens/home';
import { fakeSetup, fakeWorker, type FakeSetup, type FakeWorker } from '../../tests/support/fake-registration';

// A real vite build takes a few seconds.
vi.setConfig({ testTimeout: 90_000 });

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

interface Icon {
  sizes?: string;
  type?: string;
  purpose?: string;
  src: string;
}
interface Manifest {
  name: string;
  short_name: string;
  display: string;
  icons: Icon[];
}

const outDir = mkdtempSync(join(tmpdir(), 'legend-build-'));
let built = false;
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

// vite's own CLI in a child process: esbuild refuses to run inside this jsdom test environment.
function buildOnce(): void {
  if (built) return;
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { stdio: 'inherit' });
  built = true;
}

let html = '';
let css = '';

let setup: FakeSetup;
let waiting: FakeWorker;
let updates: AppUpdates | undefined;
afterAll(() => {
  updates?.stop();
  cleanup();
});

const feature = await loadFeature('features/install.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('The manifest makes Legend installable', ({ Given, Then }) => {
    Given('the app is built', () => {
      buildOnce();
    });

    Then('the manifest names the app Legend, display standalone, with 192 and 512 maskable icons', () => {
      const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8')) as Manifest;
      expect(manifest.name).toBe('Legend');
      expect(manifest.short_name).toBe('Legend');
      expect(manifest.display).toBe('standalone');
      const maskable = (size: string) => manifest.icons.find((icon) => icon.sizes === size && icon.type === 'image/png' && icon.purpose === 'maskable');
      expect(maskable('192x192')).toBeDefined();
      expect(maskable('512x512')).toBeDefined();
      for (const icon of manifest.icons) {
        expect(readFileSync(join(outDir, icon.src.replace(/^\//, ''))).length).toBeGreaterThan(0);
      }
    });
  });

  Scenario('The build is served from the root of its own domain', ({ Given, Then }) => {
    Given('the app is built', () => {
      buildOnce();
    });

    Then('every asset of the built page is root-absolute and no GitHub Pages workflow exists', () => {
      const page = readFileSync(join(outDir, 'index.html'), 'utf8');
      expect(page).toMatch(/src="\/assets\/[^"]+\.js"/);
      expect(page).toMatch(/href="\/assets\/[^"]+\.css"/);
      expect(page).not.toMatch(/(src|href)="\.\/?assets/);
      expect(read('vite.config.ts')).toMatch(/base:\s*'\/'/);
      expect(existsSync(join(process.cwd(), '.github', 'workflows', 'deploy.yml'))).toBe(false);
    });
  });

  Scenario('The page cannot be zoomed or scrolled', ({ Given, Then }) => {
    Given('the document and its root stylesheet', () => {
      html = read('index.html');
      css = read('src/index.css');
    });

    Then('the document forbids pinch zoom and double-tap zoom and the body never scrolls under the app', () => {
      const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
      for (const token of ['width=device-width', 'initial-scale=1.0', 'viewport-fit=cover', 'maximum-scale=1', 'user-scalable=no', 'interactive-widget=resizes-content']) {
        expect(viewport).toContain(token);
      }
      expect(css).toMatch(/html\s*\{[^}]*touch-action:\s*manipulation/);
      const root = css.match(/html,\s*body,\s*#root\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(root).toMatch(/overflow:\s*clip/);
      expect(root).toMatch(/overscroll-behavior:\s*none/);
      expect(root).toMatch(/height:\s*100dvh/);
      expect(root).not.toMatch(/100vh/);
    });
  });

  Scenario('An update waits for a tap', ({ Given, And, When, Then }) => {
    Given('the service worker registers with the prompt flow', () => {
      const config = read('vite.config.ts');
      expect(config).toMatch(/registerType:\s*'prompt'/);
      expect(config).not.toMatch(/autoUpdate/);
    });

    And('a newer build is waiting behind the one in control', () => {
      cleanup();
      updates?.stop();
      waiting = fakeWorker('installed');
      setup = fakeSetup({ waiting });
      updates = startAppUpdates({ container: setup.container, registration: setup.registration, reload: setup.reload });
      render(<UpdateBanner />);
    });

    Then('the banner says Update', () => {
      expect(screen.getByRole('button', { name: /Update/ })).toBeEnabled();
    });

    And('nothing is taken yet', () => {
      expect(waiting.postMessage).not.toHaveBeenCalled();
      expect(setup.reload).not.toHaveBeenCalled();
    });

    When('they tap Update', async () => {
      await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    });

    Then('the waiting build is told to take over', () => {
      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(waiting.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  Scenario('The home screen says which build is running', ({ Given, Then }) => {
    Given('the home screen is open', () => {
      cleanup();
      render(<Home />);
    });

    Then('the home screen shows the version, build time and commit', () => {
      expect(screen.getByRole('heading', { name: 'Legend' })).toBeInTheDocument();
      const stamp = screen.getByTestId('build-version').textContent ?? '';
      const match = stamp.match(/^v(\d+\.\d+\.\d+) · (\d{4}-\d{2}-\d{2} \d{2}:\d{2})Z · (\S+)$/);
      expect(match, stamp).not.toBeNull();
      const pkg = JSON.parse(read('package.json')) as { version: string };
      expect(match?.[1]).toBe(pkg.version);
    });
  });
});
