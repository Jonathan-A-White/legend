import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { QuarterDesign } from '../../src/data/us';
import { buildMintages, PAGES, renderMintages, snapshotPath } from '../../scripts/mintages-build';
import { clean, parseTables } from '../../scripts/wikitable';

describe('the wikitext table reader', () => {
  const text = `Intro
{| class="wikitable"
|+Eagle reverse, 1932–1964 (Silver)
! Year !! Mint !! Mintage<ref name=":0">{{Cite web|url=http://x}}</ref>
|-
| rowspan="2" |1932
|(P)
| align="right" |5,404,000
|-
|D
|436,800<ref>x</ref>
|-
| {{sortname|Dr.|Sally Ride}} || [[Denver Mint|Denver]] || '''bold''' 1<br />2
|}
after`;

  it('reads captions, header and body cells, strips references and fills a rowspan', () => {
    const [table] = parseTables(text);
    expect(table.caption).toBe('Eagle reverse, 1932–1964 (Silver)');
    expect(table.rows.map((r) => r.map((c) => c.text))).toEqual([
      ['Year', 'Mint', 'Mintage'],
      ['1932', '(P)', '5,404,000'],
      ['1932', 'D', '436,800'],
      ['Dr. Sally Ride', 'Denver', 'bold 1 2'],
    ]);
    expect(table.rows[0][0].header).toBe(true);
  });

  it('cleans links, templates and markup out of a cell', () => {
    expect(clean("[[Hot Springs National Park|Hot Springs]] {{nowrap|500 million}} ''x''&nbsp;y {{tooltip|a|b}}")).toBe(
      'Hot Springs 500 million x y',
    );
  });
});

describe('the committed snapshots', () => {
  const quarters = JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[];
  const texts = Object.fromEntries(PAGES.map((p) => [p.page, readFileSync(snapshotPath(p.page), 'utf8')]));

  it('has a snapshot for every page', () => {
    for (const p of PAGES) expect(existsSync(snapshotPath(p.page)), p.page).toBe(true);
  });

  it('build mintages.json exactly as committed, so no number is typed by hand', () => {
    const built = renderMintages(buildMintages(texts, quarters));
    expect(built).toBe(readFileSync('public/data/us/mintages.json', 'utf8'));
  });

  it('refuses a page whose tables have gone missing, rather than guessing', () => {
    expect(() => buildMintages({ ...texts, Lincoln_cent_mintage_figures: 'no tables here' }, quarters)).toThrow(/Lincoln/);
  });
});
