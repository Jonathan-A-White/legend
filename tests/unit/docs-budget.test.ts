// The docs a Builder reads first are kept short: each has a size budget, and CLAUDE.md must send a Builder to both others.
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const size = (path: string) => statSync(path).size;

describe('docs budgets', () => {
  it('docs/overview.md is under 3072 bytes', () => {
    expect(size('docs/overview.md')).toBeLessThan(3072);
  });

  it('docs/module-map.md is under 6144 bytes', () => {
    expect(size('docs/module-map.md')).toBeLessThan(6144);
  });

  it('CLAUDE.md is under 6144 bytes', () => {
    expect(size('CLAUDE.md')).toBeLessThan(6144);
  });

  it('CLAUDE.md names both docs', () => {
    const claude = readFileSync('CLAUDE.md', 'utf8');
    expect(claude).toContain('docs/overview.md');
    expect(claude).toContain('docs/module-map.md');
  });

  it('CLAUDE.md asks for the Docs line in every closing comment', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toContain('Docs: read');
  });
});
