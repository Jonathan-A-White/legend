// The tutor's small parts: the Markdown it writes as drawn, a suggested setting in words, which suggestions may be drawn, and the
// count of his collection a question carries.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import { Markdown } from '../../src/tutor/Markdown';
import { itemFacts, summarize } from '../../src/tutor/request';
import { suggestionsFor } from '../../src/tutor/suggestions';
import { drawable, settingWords } from '../../src/tutor/settingWords';

const html = (text: string) => render(<Markdown text={text} />).container.innerHTML;

describe('the Markdown the tutor writes', () => {
  it('draws paragraphs, bold, italics and lists', () => {
    const out = html('Look at **the hair** and *the rim*.\n\n- the date\n- the mint mark\n\n1. first\n2. second');
    expect(out).toContain('<p>Look at <strong>the hair</strong> and <em>the rim</em>.</p>');
    expect(out).toContain('<ul class="space-y-1 pl-6 list-disc"><li>the date</li><li>the mint mark</li></ul>');
    expect(out).toContain('<ol class="space-y-1 pl-6 list-decimal"><li>first</li><li>second</li></ol>');
  });

  it('never makes HTML of the text, and draws a link as its words', () => {
    const out = html('<img src=x onerror=alert(1)> see [the Mint](https://usmint.gov)');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('see the Mint');
    expect(out).not.toContain('href');
  });
});

describe('a suggested setting', () => {
  it('reads as the Settings screen names it', () => {
    expect(settingWords('textSize', 'large')).toBe('Text size large');
    expect(settingWords('tutorVoice', true)).toBe('Read answers aloud on');
    expect(settingWords('sizeCap', 2400)).toBe('Photo size limit 2400 px');
  });

  it('is drawn only for a talkable setting and a value it allows', () => {
    expect(drawable({ key: 'textSize', value: 'large' })).toBe(true);
    expect(drawable({ key: 'textSize', value: 'huge' })).toBe(false);
    expect(drawable({ key: 'sharing', value: false })).toBe(false);
    expect(drawable({ key: 'ownerName', value: 'Paul' })).toBe(false);
    expect(drawable({ key: 'nothing', value: 1 })).toBe(false);
    expect(drawable({ key: 'sizeCap', value: 9000 })).toBe(false);
  });
});

describe('the count of his collection', () => {
  const item = (kind: 'coin' | 'note' | 'other', country: string | null) => ({ kind, country }) as Item;

  it('counts by country and kind, the biggest first, unknown as ?', () => {
    expect(summarize([item('coin', 'US'), item('note', 'JP'), item('coin', 'US'), item('coin', null), item('note', 'US')])).toEqual({
      items: 5,
      coins: 3,
      notes: 2,
      others: 0,
      countries: [
        { code: 'US', coins: 2, notes: 1, others: 0 },
        { code: '?', coins: 1, notes: 0, others: 0 },
        { code: 'JP', coins: 0, notes: 1, others: 0 },
      ],
    });
  });

  it('counts an Other apart, never as a bill', () => {
    expect(summarize([item('coin', 'US'), item('other', 'US'), item('other', null)])).toEqual({
      items: 3,
      coins: 1,
      notes: 0,
      others: 2,
      countries: [
        { code: 'US', coins: 1, notes: 0, others: 1 },
        { code: '?', coins: 0, notes: 0, others: 1 },
      ],
    });
  });
});

describe('what the tutor is told of an Other', () => {
  const token = { kind: 'other', subtype: 'Subway token', country: null, currency: null, denomination: 'Fare token', faceValue: null, year: null, mintMark: null, series: null, design: null, gradeGuess: null, material: '', inscription: '', gradeNotes: '', funFact: '', status: 'confirmed' } as unknown as Item;

  it('carries its subtype, and a coin carries none', () => {
    expect(itemFacts(token, null, null)).toMatchObject({ kind: 'other', subtype: 'Subway token' });
    expect(itemFacts({ ...token, kind: 'coin' }, null, null).subtype).toBeNull();
    expect(itemFacts({ ...token, subtype: undefined }, null, null).subtype).toBeNull();
  });
});

describe('the questions suggested', () => {
  it('are the grading ones for a coin and about the piece for an Other', () => {
    expect(suggestionsFor({ screen: 'item', kind: 'coin', subtype: null })).toContain('How do I grade this one?');
    const token = suggestionsFor({ screen: 'item', kind: 'other', subtype: 'Subway token' });
    expect(token).toEqual(['What was this subway token used for?', 'Is it rare?', 'How can I tell a real one?']);
    expect(suggestionsFor({ screen: 'item', kind: 'other', subtype: 'NYC token' })[0]).toBe('What was this NYC token used for?');
    expect(suggestionsFor({ screen: 'item', kind: 'other', subtype: null })[0]).toBe('What was this piece used for?');
    const chips = suggestionsFor({ screen: 'item', kind: 'coin', subtype: null });
    expect(chips).toHaveLength(3);
    expect(chips).toContain('How rare is it?');
    expect(chips).not.toContain("What's special about this year?");
    expect(suggestionsFor({ screen: 'country', kind: null, subtype: null })).toContain('What money did they use before?');
  });
});
