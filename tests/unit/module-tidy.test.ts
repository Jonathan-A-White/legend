// The tidy-ups after the module-entry work: a hook lives in one file, every Entry the module map names exists, and a type
// several modules use is declared in the lowest module that owns it (CountryOption is data/world's, not capture's).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });

describe('module tidy', () => {
  it('has no hook exported from two files of src', () => {
    const seen = new Map<string, string[]>();
    for (const file of walk('src')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/^export function (use[A-Za-z]+)/gm)) {
        seen.set(match[1], [...(seen.get(match[1]) ?? []), file]);
      }
    }
    const twice = [...seen].filter(([, files]) => files.length > 1);
    expect(twice).toEqual([]);
  });

  it('keeps useLoaded in src/ui only', () => {
    expect(existsSync('src/globe/useLoaded.ts')).toBe(false);
    expect(existsSync('src/ui/useLoaded.ts')).toBe(true);
  });

  it('names, in every Entry of the module map, paths that exist', () => {
    const rows = readFileSync('docs/module-map.md', 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Module') && !line.startsWith('|---'));
    expect(rows.length).toBeGreaterThan(10);
    const missing: string[] = [];
    for (const row of rows) {
      const entry = row.split('|')[3] ?? '';
      let folder = '';
      for (const match of entry.matchAll(/`([^`]+)`/g)) {
        const path = match[1];
        if (path.includes('<')) continue; // a pattern (src/screens/<name>/index.ts), not a file
        // a bare name (rows.ts) sits beside the first path of the row (src/settings/registry.ts)
        const full = path.startsWith('src/') ? path : join(folder, path);
        if (path.startsWith('src/') && !folder) folder = full.endsWith('/') ? full : full.slice(0, full.lastIndexOf('/'));
        if (!existsSync(full)) missing.push(`${row.split('|')[1].trim()}: ${full}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('gives services an entry under src/services/', () => {
    const row = readFileSync('docs/module-map.md', 'utf8')
      .split('\n')
      .find((line) => line.startsWith('| services'));
    expect(row).toBeDefined();
    expect(row!.split('|')[3]).toMatch(/src\/services\//);
    expect(row!.split('|')[3]).not.toMatch(/UpdateBanner/);
  });

  it('declares CountryOption in data/world and imports it from there in the tutor', () => {
    expect(readFileSync('src/data/world.ts', 'utf8')).toMatch(/export interface CountryOption/);
    expect(readFileSync('src/capture/useCountries.ts', 'utf8')).not.toMatch(/export interface CountryOption/);
    expect(readFileSync('src/tutor/formCommands.ts', 'utf8')).toMatch(/import type \{ CountryOption \} from '\.\.\/data\/world'/);
  });
});
