// mw-6ww.175.73: the build stamped the version from the working package.json but the commit from HEAD, so a working
// file older than HEAD showed the old version beside the new commit (the same fault as Lampas's mw-6ww.175.54).
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOOK_TIMEOUT_MS } from 'pwa-kit/test-preset';
import { packageVersion } from '../../build-version';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf-8' }).trim();
}

describe('packageVersion', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  }, HOOK_TIMEOUT_MS);

  function checkout(): string {
    const dir = mkdtempSync(join(tmpdir(), 'legend-version-'));
    dirs.push(dir);
    git(dir, 'init', '-q');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.7.1' }));
    git(dir, 'add', 'package.json');
    git(dir, 'commit', '-q', '-m', 'one');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.7.2' }));
    git(dir, 'commit', '-q', '-am', 'two');
    return dir;
  }

  it('is the version HEAD holds when the working package.json is older and uncommitted', () => {
    const dir = checkout();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.7.1' }));
    expect(packageVersion(dir)).toBe('0.7.2');
  });

  it('is the working file version outside a git checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'legend-version-nogit-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
    expect(packageVersion(dir, 'git-that-does-not-exist')).toBe('1.2.3');
  });
});

describe('the configs stamp both globals from packageVersion', () => {
  it.each(['vite.config.ts', 'vitest.config.ts'])('%s reads the version HEAD holds, not the working file', (file) => {
    const config = readFileSync(file, 'utf-8');
    expect(config).toContain('packageVersion()');
    expect(config).not.toContain('pkg.version');
  });
});
