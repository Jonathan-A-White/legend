// features/steps/gate.steps.tsx: runs features/gate.feature: the Unlock screen, the device key, the held / none / revoked
// answers, the offline grace, Check again and the key storage seam (docs/testing.md).
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import type { licence } from 'bsv-kit/bsv';
import { App } from '../../src/App';
import { db } from '../../src/data/db';
import { DEVICE_KEY_STORAGE_KEY } from '../../src/config';
import { fetchLicenceStatus } from '../../src/services/licenceCheck';
import { qrPath } from '../../src/gate/qr';
import { addMint, addRevoke, HOLDER, ISSUER_PUB, newChain, STRANGER } from '../../tests/support/licence-chain';

afterAll(() => {
  cleanup();
  vi.unstubAllGlobals();
  db.close();
});

const user = userEvent.setup();
const SOME_ISSUER = '02' + 'ab'.repeat(32);
const HOUR = 3_600_000;

type Status = licence.LicenceStatus;
const checkedAt = () => new Date(clock).toISOString();
const outpoint = { txid: 'a'.repeat(64), vout: 0 };

let answer: Status | Error;
let clock: number;
let issuer: string;
let stubChain: ReturnType<typeof newChain> | undefined;
let notedKey = '';
let copied = '';

function reset(): void {
  window.localStorage.clear();
  window.location.hash = '';
  answer = { state: 'none', checkedAt: '' };
  clock = Date.parse('2026-10-10T12:00:00.000Z');
  issuer = SOME_ISSUER;
  stubChain = undefined;
  notedKey = '';
  cleanup();
}

const holds = (): Status => ({ state: 'held', outpoint, collection: 'legend', checkedAt: checkedAt() });

async function open(): Promise<void> {
  cleanup();
  render(
    <App
      gate={{
        issuer,
        now: () => clock,
        check: !issuer
          ? undefined
          : stubChain
            ? (publicKeyHex) => fetchLicenceStatus(publicKeyHex, { issuer, reader: stubChain })
            : async () => {
                if (answer instanceof Error) throw answer;
                return answer;
              },
      }}
    />,
  );
}

/** The issuer (or someone else) minted a licence to the key every chain scenario gives this phone. */
function mintOnStubChain(signer?: typeof STRANGER): void {
  issuer = ISSUER_PUB;
  window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, HOLDER.toHex());
  stubChain = stubChain ?? newChain();
  addMint(stubChain, signer);
}

const keyText = () => screen.getByTestId('device-key').textContent ?? '';
const bottomBar = () => screen.queryByRole('navigation', { name: 'Screens' });

async function seeApp(): Promise<void> {
  expect(await screen.findByRole('navigation', { name: 'Screens' })).toBeInTheDocument();
}

async function seeUnlock(): Promise<void> {
  expect(await screen.findByRole('heading', { name: 'Unlock' })).toBeInTheDocument();
}

function appNotShown(): void {
  expect(bottomBar()).not.toBeInTheDocument();
}

const feature = await loadFeature('features/gate.feature');

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(reset);

  Scenario('A phone with no licence sees Unlock with its public key and Copy', ({ Given, When, Then, And }) => {
    Given("the chain says this phone's key has no licence", () => {
      answer = { state: 'none', checkedAt: checkedAt() };
    });
    When('Legend is opened', open);
    Then('he sees the Unlock screen', seeUnlock);
    And('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(text)).toBeInTheDocument();
    });
    And('the Unlock screen shows a device key', async () => {
      await waitFor(() => expect(keyText()).toMatch(/^0[23][0-9a-f]{64}$/));
    });
    And('there is a Copy button', () => {
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    });
    And('the app is not shown', appNotShown);
    When('he taps Copy', async () => {
      await user.click(screen.getByRole('button', { name: 'Copy' }));
      // user-event's clipboard stub lasts one step (each step is a test), so read it here.
      copied = await navigator.clipboard.readText();
    });
    Then('the clipboard holds the device key', () => {
      expect(copied).toBe(keyText());
    });
  });

  Scenario("The Unlock screen shows the phone's key as a QR code for Postern to scan", ({ Given, When, Then, And }) => {
    Given("the chain says this phone's key has no licence", () => {
      answer = { state: 'none', checkedAt: checkedAt() };
    });
    When('Legend is opened', open);
    Then('he sees the Unlock screen', seeUnlock);
    And('the Unlock screen shows the device key as a QR code', async () => {
      await waitFor(() => expect(keyText()).toMatch(/^0[23][0-9a-f]{64}$/));
      const qr = screen.getByRole('img', { name: 'This phone’s key as a QR code' });
      expect(qr.querySelector('path')?.getAttribute('d')).toBe(qrPath(keyText()).path);
    });
  });

  Scenario('A licence held by the issuer opens the app', ({ Given, When, Then, And }) => {
    Given("the issuer minted a licence to this phone's key on a stub chain", () => mintOnStubChain());
    When('Legend is opened', open);
    Then('he sees the app', seeApp);
    And('the Unlock screen is gone', () => {
      expect(screen.queryByRole('heading', { name: 'Unlock' })).not.toBeInTheDocument();
    });
  });

  Scenario('A licence from another issuer does not open the app', ({ Given, When, Then, And }) => {
    Given("someone other than the issuer minted a licence to this phone's key on a stub chain", () => mintOnStubChain(STRANGER));
    When('Legend is opened', open);
    Then('he sees the Unlock screen', seeUnlock);
    And('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(text)).toBeInTheDocument();
    });
    And('the app is not shown', appNotShown);
  });

  Scenario('A revoked licence shows Licence revoked', ({ Given, And, When, Then }) => {
    Given("the issuer minted a licence to this phone's key on a stub chain", () => mintOnStubChain());
    And('the issuer then signed a revoke for it', () => addRevoke(stubChain!));
    When('Legend is opened', open);
    Then('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(text)).toBeInTheDocument();
    });
    And('the app is not shown', appNotShown);
  });

  Scenario('Offline within 24 hours of a held check opens the app', ({ Given, And, When, Then }) => {
    Given("the chain says this phone's key holds a licence", () => {
      answer = holds();
    });
    And('Legend is opened', open);
    And('he is in the app', seeApp);
    When('the phone is offline and Legend is opened again 6 hours later', async () => {
      answer = new Error('offline');
      clock += 6 * HOUR;
      await open();
    });
    Then('he sees the app', seeApp);
  });

  Scenario('Offline more than 24 hours after a held check does not open the app', ({ Given, And, When, Then }) => {
    Given("the chain says this phone's key holds a licence", () => {
      answer = holds();
    });
    And('Legend is opened', open);
    And('he is in the app', seeApp);
    When('the phone is offline and Legend is opened again 25 hours later', async () => {
      answer = new Error('offline');
      clock += 25 * HOUR;
      await open();
    });
    Then('he sees the Unlock screen', seeUnlock);
    And('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(new RegExp(text.replace("'", '.')))).toBeInTheDocument();
    });
    And('the app is not shown', appNotShown);
  });

  Scenario('Check again re-asks the chain', ({ Given, And, When, Then }) => {
    Given("the chain says this phone's key has no licence", () => {
      answer = { state: 'none', checkedAt: checkedAt() };
    });
    And('Legend is opened', open);
    And('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(text)).toBeInTheDocument();
    });
    When('the licence is issued and he taps Check again', async () => {
      answer = holds();
      await user.click(await screen.findByRole('button', { name: 'Check again' }));
    });
    Then('he sees the app', seeApp);
  });

  Scenario('The key survives a reload', ({ Given, And, When, Then }) => {
    Given("the chain says this phone's key has no licence", () => {
      answer = { state: 'none', checkedAt: checkedAt() };
    });
    And('Legend is opened', open);
    And('he notes the device key', async () => {
      await seeUnlock();
      notedKey = keyText();
      expect(notedKey).not.toBe('');
    });
    When('Legend is opened again', open);
    Then('the Unlock screen shows the same device key', async () => {
      await seeUnlock();
      expect(keyText()).toBe(notedKey);
    });
  });

  Scenario('A key stored through the test seam is the device key', ({ Given, When, Then }) => {
    Given('the private key {string} is stored under {string} before Legend boots', (_, hex: string, name: string) => {
      expect(name).toBe(DEVICE_KEY_STORAGE_KEY);
      window.localStorage.setItem(name, hex);
    });
    When('Legend is opened', open);
    Then('the Unlock screen shows the public key {string}', async (_, publicKey: string) => {
      await seeUnlock();
      expect(keyText()).toBe(publicKey);
    });
  });

  Scenario('The Unlock screen says in plain words what a licence is', ({ Given, When, Then }) => {
    Given("the chain says this phone's key has no licence", () => {
      answer = { state: 'none', checkedAt: checkedAt() };
    });
    When('Legend is opened', open);
    Then('he sees the words that explain a licence and who issues it', async () => {
      await seeUnlock();
      const words = screen.getByRole('region', { name: 'What a licence is' });
      expect(words).toHaveTextContent(/licence is a pass/i);
      expect(words).toHaveTextContent(/Dad/);
      expect(words).toHaveTextContent(/Postern/);
    });
  });

  Scenario('No issuer set keeps the gate shut and says so', ({ Given, When, Then, And }) => {
    Given('no licence issuer is configured', () => {
      issuer = '';
    });
    When('Legend is opened', open);
    Then('he sees {string}', async (_, text: string) => {
      expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
    });
    And('the app is not shown', appNotShown);
  });
});
