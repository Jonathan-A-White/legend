// features/steps/photo-reader.steps.tsx: runs features/photo-reader.feature against src/services/itemAnswer.ts and the Confirm sheet
// (src/capture/ConfirmSheet.tsx) over a seeded Dexie.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { ConfirmSheet } from '../../src/capture/ConfirmSheet';
import { db, type Item } from '../../src/data/db';
import { addItem } from '../../src/data/repositories';
import { parseCoinAnswer, mapAnswerToItem, itemChanges, type ParsedCoinAnswer } from '../../src/services/itemAnswer';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { quarterAnswer } from '../../tests/support/coin-answers';

beforeAll(() => {
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
});
afterAll(() => {
  cleanup();
  db.close();
});
let raw: unknown;
let parsed: ParsedCoinAnswer;
let item: Item;

/** A coin named from this answer, as the name queue keeps it (itemChanges), waiting to be checked. */
async function named(answer: Record<string, unknown>): Promise<Item> {
  const parsedAnswer = parseCoinAnswer(answer);
  if (!parsedAnswer.ok) throw new Error(parsedAnswer.error);
  return addItem({ kind: 'coin', ...itemChanges(mapAnswerToItem(parsedAnswer.answer), 'coin'), status: 'named' });
}
const openSheet = async () => {
  render(<ConfirmSheet item={item} onClose={() => undefined} onLetGo={() => undefined} />);
  await screen.findByRole('dialog', { name: 'Confirm' });
  await screen.findByText('🇺🇸 United States');
};
const sheet = () => screen.getByRole('dialog', { name: 'Confirm' });
const noWarning = () => {
  expect(within(sheet()).queryByText('The back may belong to a different coin')).toBeNull();
  expect(within(sheet()).queryByRole('button', { name: 'Retake the back' })).toBeNull();
  expect(within(sheet()).getAllByRole('button', { name: "That's right" })).toHaveLength(1);
};

const feature = await loadFeature('features/photo-reader.feature');

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  Scenario('A good answer for a quarter is read and mapped', ({ Given, When, Then }) => {
    Given('the photo reader answers for a 1944 Washington quarter struck at Denver', () => {
      raw = quarterAnswer();
    });
    When('Legend reads the answer', () => {
      parsed = parseCoinAnswer(raw);
    });
    Then('it is accepted with country US, denomination quarter dollar, year 1944 and mint mark D', () => {
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const item = mapAnswerToItem(parsed.answer);
      expect(item).toMatchObject({ country: 'US', denomination: 'quarter dollar', year: 1944, mintMark: 'D' });
    });
  });

  Scenario('An answer with an extra key is refused', ({ Given, When, Then }) => {
    Given('the photo reader answers with an extra key', () => {
      raw = { ...quarterAnswer(), estimatedValue: 12.5 };
    });
    When('Legend reads the answer', () => {
      parsed = parseCoinAnswer(raw);
    });
    Then('it is refused and nothing is kept', () => {
      expect(parsed.ok).toBe(false);
    });
  });

  Scenario("A banknote's serial number is never accepted", ({ Given, When, Then }) => {
    Given('the photo reader answers for a banknote with a serial number field', () => {
      raw = { ...quarterAnswer(), kind: 'note', serialNumber: 'A0000003' };
    });
    When('Legend reads the answer', () => {
      parsed = parseCoinAnswer(raw);
    });
    Then('it is refused and nothing is kept', () => {
      expect(parsed.ok).toBe(false);
    });
  });

  Scenario('A worn date is a range and the answer is only low confidence', ({ Given, When, Then }) => {
    Given('the photo reader answers with a year range and no year but medium confidence', () => {
      raw = { ...quarterAnswer(), year: null, yearRange: [1941, 1945], confidence: 'medium' };
    });
    When('Legend reads the answer', () => {
      parsed = parseCoinAnswer(raw);
    });
    Then('it is accepted with year null and confidence low', () => {
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const item = mapAnswerToItem(parsed.answer);
      expect(item.year).toBeNull();
      expect(item.yearRange).toEqual([1941, 1945]);
      expect(item.confidence).toBe('low');
    });
  });

  Scenario('A backwards year range is refused', ({ Given, When, Then }) => {
    Given('the photo reader answers with a year range that runs backwards', () => {
      raw = { ...quarterAnswer(), year: null, yearRange: [1945, 1941] };
    });
    When('Legend reads the answer', () => {
      parsed = parseCoinAnswer(raw);
    });
    Then('it is refused and nothing is kept', () => {
      expect(parsed.ok).toBe(false);
    });
  });

  Scenario('The Confirm sheet warns when the reader says the back belongs to a different coin', ({ Given, When, Then }) => {
    Given('a named coin whose answer said the two sides do not agree', async () => {
      item = await named({ ...quarterAnswer(), sidesAgree: false });
    });
    When('he opens the Confirm sheet', openSheet);
    Then('it says "The back may belong to a different coin" with the buttons Retake the back and That\'s right', async () => {
      const s = within(sheet());
      expect(s.getByText('The back may belong to a different coin')).toBeInTheDocument();
      expect(s.getByRole('button', { name: 'Retake the back' })).toBeInTheDocument();
      expect(s.getAllByRole('button', { name: "That's right" })).toHaveLength(1);
      // That's right is how he says the pair is fine: the warning goes and the usual button is there
      await userEvent.click(s.getByRole('button', { name: "That's right" }));
      expect(within(sheet()).queryByText('The back may belong to a different coin')).toBeNull();
      expect(within(sheet()).getByRole('button', { name: "That's right" })).toBeInTheDocument();
    });
  });

  Scenario('The Confirm sheet says nothing when the reader says the two sides agree', ({ Given, When, Then }) => {
    Given('a named coin whose answer said the two sides agree', async () => {
      item = await named({ ...quarterAnswer(), sidesAgree: true });
    });
    When('he opens the Confirm sheet', openSheet);
    Then('it has no warning about the back and shows the usual That\'s right', noWarning);
  });

  Scenario('The Confirm sheet says nothing when the reader could not tell', ({ Given, When, Then }) => {
    Given('a named coin whose answer said it could not tell whether the sides agree', async () => {
      item = await named({ ...quarterAnswer(), sidesAgree: null });
    });
    When('he opens the Confirm sheet', openSheet);
    Then('it has no warning about the back and shows the usual That\'s right', noWarning);
  });

  Scenario('The Confirm sheet says nothing for a coin read before the check existed', ({ Given, When, Then }) => {
    Given('a named coin read before the reader checked the sides', async () => {
      item = await named(quarterAnswer());
    });
    When('he opens the Confirm sheet', openSheet);
    Then('it has no warning about the back and shows the usual That\'s right', noWarning);
  });
});
