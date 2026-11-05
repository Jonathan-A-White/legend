// ATTRIBUTION.md is the one source of the credits (src/attribution.ts), and the About screen (src/About.tsx) shows every one of
// them, each with its link. The check reads the file from disk itself, so a credit the parser or the screen drops fails here.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { About } from '../../src/About';
import { attribution, boldOf, linksOf, parseAttribution, plainText, type Attribution } from '../../src/attribution';

const file = readFileSync('ATTRIBUTION.md', 'utf-8');

afterEach(cleanup);

/** The credits of the file (each bullet, its continuation lines joined) read here, apart from the parser under test. */
function bulletsOf(md: string): string[] {
  const bullets: string[] = [];
  let inToc = false;
  for (const line of md.split('\n')) {
    if (line.includes('<!-- toc -->')) inToc = true;
    if (!inToc && line.startsWith('- ')) bullets.push(line.slice(2).trim());
    else if (!inToc && /^ {2}\S/.test(line) && bullets.length > 0) bullets[bullets.length - 1] += ` ${line.trim()}`;
    else if (line.trim() === '') bullets.push('');
    if (line.includes('<!-- /toc -->')) inToc = false;
  }
  return bullets.filter((b) => b !== '');
}

/** What of `source` the screen does not show: a credit's name, one of its links (the name and the address), the quote, a section's heading. */
function missingFromScreen(source: Attribution, shown: Attribution = source): string[] {
  const { container } = render(createElement(About, { source: shown }));
  const main = within(container);
  const text = container.textContent ?? '';
  const missing: string[] = [];
  if (source.quote && !text.includes(source.quote.text)) missing.push(`quote: ${source.quote.text}`);
  if (source.quote && !text.includes(source.quote.by)) missing.push(`by: ${source.quote.by}`);
  for (const section of source.sections) {
    if (section.title && main.queryByRole('heading', { name: section.title }) === null) missing.push(`heading: ${section.title}`);
  }
  for (const credit of source.credits) {
    for (const name of boldOf(credit)) if (!text.includes(name)) missing.push(`credit: ${name}`);
    for (const { name, href } of linksOf(credit)) {
      const link = [...container.querySelectorAll('a')].find((a) => a.getAttribute('href') === href && a.textContent === name);
      if (!link) missing.push(`link: ${name} ${href}`);
    }
  }
  cleanup();
  return missing;
}

describe('the parsed ATTRIBUTION.md', () => {
  it("has Newton's line and who said it", () => {
    expect(attribution.quote?.text).toContain('standing on the shoulders of Giants');
    expect(attribution.quote?.by).toBe('Isaac Newton, letter to Robert Hooke, 1675');
  });

  it('has every bullet of the file as a credit, and not the table of contents', () => {
    expect(attribution.credits).toEqual(bulletsOf(file));
    expect(attribution.credits.length).toBeGreaterThan(20);
    expect(attribution.credits.join('\n')).not.toContain('(#libraries)');
  });

  it('keeps a paragraph that is not a bullet (what Worth says) as a note of its section', () => {
    const worth = attribution.sections.find((s) => s.title === 'Worth');
    expect(worth?.blocks).toHaveLength(1);
    expect(worth?.blocks[0].kind).toBe('note');
    expect(worth?.blocks[0].md).toContain('Legend ships no price data');
  });

  it('reads a bullet that goes on over several lines as one credit', () => {
    const parsed = parseAttribution('# T\n\n## S\n\n- **One** by [Me](https://a.example),\n  MIT.\n- **Two**.\n\nA note\nover two lines.\n');
    expect(parsed.credits).toEqual(['**One** by [Me](https://a.example), MIT.', '**Two**.']);
    expect(parsed.sections[0].blocks[2]).toEqual({ kind: 'note', md: 'A note over two lines.' });
  });

  it('writes a link as its name and nothing else', () => {
    expect(plainText('**[React](https://react.dev)**, `MIT`')).toBe('React, MIT');
  });
});

describe('the About screen', () => {
  it('shows Newton, every section and every credit of ATTRIBUTION.md, each link with its address', () => {
    expect(missingFromScreen(attribution)).toEqual([]);
  });

  it('fails the check when a credit of the file is absent from the screen', () => {
    const [first] = attribution.credits;
    const shown: Attribution = {
      ...attribution,
      sections: attribution.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.md !== first) })),
    };
    const gone = missingFromScreen(attribution, shown);
    expect(gone.length).toBeGreaterThan(0);
    expect(gone.join(' ')).toContain('bsv-kit');
  });
});
