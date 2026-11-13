import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
  allowScripts: Record<string, boolean>;
};
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, { resolved?: string }>;
};

const kitPins = Object.entries(pkg.dependencies).filter(([, spec]) => spec.startsWith('github:Jonathan-A-White/'));

describe('kit pins', () => {
  it('pins at least the three kits', () => {
    expect(kitPins.map(([name]) => name).sort()).toEqual(['bsv-kit', 'pwa-kit', 'voice-kit']);
  });

  it.each(kitPins)('%s is pinned by commit, in allowScripts too, and the lock resolves to the same commit', (name, spec) => {
    const sha = spec.split('#')[1];
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(pkg.allowScripts[spec]).toBe(true);
    expect(lock.packages[`node_modules/${name}`].resolved).toBe(`git+https://github.com/Jonathan-A-White/${name}.git#${sha}`);
  });
});
