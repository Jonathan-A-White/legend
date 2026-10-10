// src/config.ts: the one place the app reads its fixed settings. The licence gate's issuer, collection and chain join
// them with the gate story.

/** The build's plain version number, '0.1.0': what the changelog's versions are compared with (src/whatsNew/). */
export const APP_SEMVER: string = __APP_SEMVER__;

/** The GitHub repository, and whether anyone can read it (About links to a version's heading in CHANGELOG.md only if so). */
export const REPO = 'Jonathan-A-White/legend';
export const REPO_PUBLIC = true;

/** Where the last version whose What's new they saw is remembered. */
export const LAST_SEEN_VERSION_STORAGE_KEY = 'legend.lastSeenVersion';
