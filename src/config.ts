// src/config.ts: the one place the app reads its fixed settings. The licence gate and the grist client read theirs here;
// each can be set at build time (VITE_LEGEND_*), and the defaults below are what `npm run build` bakes in when nothing is set.

/** The build's plain version number, '0.1.0': what the changelog's versions are compared with (src/whatsNew/). */
// A plain node script (scripts/check-licence.ts) imports this file with no build define in place.
export const APP_SEMVER: string = typeof __APP_SEMVER__ === 'undefined' ? '0.0.0' : __APP_SEMVER__;

/** The GitHub repository, and whether anyone can read it (About links to a version's heading in CHANGELOG.md only if so). */
export const REPO = 'Jonathan-A-White/legend';
export const REPO_PUBLIC = true;

/** Where the last version whose What's new they saw is remembered. */
export const LAST_SEEN_VERSION_STORAGE_KEY = 'legend.lastSeenVersion';

/** The collection a Legend licence is minted in. */
export const COLLECTION = 'legend';

/**
 * The issuer's public key (66 hex chars): only a licence minted by a transaction this key signed counts, and
 * only until this key signs a revoke (bsv-kit's licenceStatus with { issuer }). It is the Governor's issuer
 * key, public by design. VITE_LEGEND_ISSUER overrides it for a build.
 */
export const DEFAULT_ISSUER = '035666d4ea414a65801ac092a4e28be6515065adcc7ac58d9cc76db8d5597f44c4';
// import.meta.env does not exist when a plain node script (scripts/check-licence.ts) imports this file.
const env: Record<string, string | undefined> = import.meta.env ?? {};
export const ISSUER: string = (env.VITE_LEGEND_ISSUER?.trim() || DEFAULT_ISSUER).toLowerCase();

/** The chain the licence is read from. Testnet until the Governor says mainnet (VITE_LEGEND_CHAIN=mainnet). */
export type Chain = 'testnet' | 'mainnet';
export const CHAIN: Chain = env.VITE_LEGEND_CHAIN === 'mainnet' ? 'mainnet' : 'testnet';

/** The Postern door the grist client talks to. */
export const POSTERN_DOOR: string = env.VITE_POSTERN_DOOR ?? 'https://postern.allmymind.org';

/**
 * Where the device key (a 32-byte private key as 64 hex chars) lives: localStorage, outside the Dexie
 * database. It is also the test seam (docs/testing.md): a test may write a known key here before boot.
 */
export const DEVICE_KEY_STORAGE_KEY = 'legend.deviceKey';

/** Where the last 'held' answer is remembered, for the offline grace. */
export const LICENCE_CACHE_STORAGE_KEY = 'legend.licenceHeld';

/** How long a 'held' answer keeps the app open when the chain cannot be reached. */
export const LICENCE_GRACE_MS = 24 * 60 * 60 * 1000;
