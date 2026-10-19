// Legend keeps no second copy of the update state machine: it is pwa-kit/app-update's (mw-ti1qik.2).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : [path];
  });
}

describe('the update state machine', () => {
  it('has no src/services/appUpdate.ts of its own', () => {
    expect(existsSync('src/services/appUpdate.ts')).toBe(false);
  });

  it('is defined nowhere in src', () => {
    const copies = sources('src').filter((p) => /TAKE_OVER_PATIENCE_MS\s*=/.test(readFileSync(p, 'utf8')));
    expect(copies).toEqual([]);
  });
});
