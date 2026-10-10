// public/changelog.json (What's new in the app) and CHANGELOG.md (the same lines for GitHub) start at 0.1.0.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('changelog', () => {
  it('public/changelog.json has a 0.1.0 entry', () => {
    const entries = JSON.parse(readFileSync('public/changelog.json', 'utf8')) as { version: string; kind: string; text: string }[];
    const first = entries.find((entry) => entry.version === '0.1.0');
    expect(first?.kind).toBe('new');
    expect(first?.text.length).toBeGreaterThan(0);
  });

  it('CHANGELOG.md has a 0.1.0 heading', () => {
    expect(readFileSync('CHANGELOG.md', 'utf8')).toMatch(/^## 0\.1\.0$/m);
  });

  it('public/changelog.json carries each version once', () => {
    const entries = JSON.parse(readFileSync('public/changelog.json', 'utf8')) as { version: string }[];
    const versions = entries.map((entry) => entry.version);
    expect(versions.filter((version, at) => versions.indexOf(version) !== at)).toEqual([]);
  });

  it('CHANGELOG.md carries each version heading once', () => {
    const headings: string[] = readFileSync('CHANGELOG.md', 'utf8').match(/^## \d+\.\d+\.\d+$/gm) ?? [];
    expect(headings.filter((heading, at) => headings.indexOf(heading) !== at)).toEqual([]);
  });
});
