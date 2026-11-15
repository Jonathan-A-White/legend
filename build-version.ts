// The version string Legend shows on its home screen: the package version moves only when the factory lands a
// story, so the build stamps its UTC time and the short git commit beside it and the collector can tell on their
// phone whether the new build has loaded. Shared by vite.config.ts and vitest.config.ts (as pwa-manifest.ts is) so a
// test reads the same string.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The short HEAD commit of the checkout at `cwd`; 'dev' when there is no git or no checkout, never a throw. */
export function shortCommit(cwd: string = process.cwd(), git = 'git'): string {
  try {
    const out = execFileSync(git, ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || 'dev';
  } catch {
    return 'dev';
  }
}

/**
 * The version the build stamps: the one package.json holds at HEAD, the commit the stamp names beside it, so the
 * two never disagree (mw-6ww.175.73: a working file older than HEAD stamped the old version beside the new commit).
 * Outside a checkout, or where HEAD has no package.json, the working file's version.
 */
export function packageVersion(cwd: string = process.cwd(), git = 'git'): string {
  try {
    const committed = execFileSync(git, ['show', 'HEAD:./package.json'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const version = (JSON.parse(committed) as { version?: unknown }).version;
    if (typeof version === 'string' && version) return version;
  } catch {
    // no git, no HEAD or no committed package.json: the working file below
  }
  return (JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as { version: string }).version;
}

/** '<version> · YYYY-MM-DD HH:MMZ · <commit>', the time in UTC. */
export function buildVersion(version: string, when: Date, commit: string): string {
  return `${version} · ${when.toISOString().slice(0, 16).replace('T', ' ')}Z · ${commit}`;
}
