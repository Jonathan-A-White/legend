// features/steps/photo-reader.steps.ts: runs features/photo-reader.feature against src/services/itemAnswer.ts.
import { expect } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { parseCoinAnswer, mapAnswerToItem, type ParsedCoinAnswer } from '../../src/services/itemAnswer';
import { quarterAnswer } from '../../tests/support/coin-answers';

let raw: unknown;
let parsed: ParsedCoinAnswer;

const feature = await loadFeature('features/photo-reader.feature');

describeFeature(feature, ({ Scenario }) => {
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
});
