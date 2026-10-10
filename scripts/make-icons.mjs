// scripts/make-icons.mjs: renders public/icon.svg to public/icon-192.png and public/icon-512.png with
// Playwright's Chromium (`npm run icons`). The PNGs are committed; run this only when the glyph changes.
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const extraLibDir = join(homedir(), '.cache', 'ms-playwright-system-libs', 'usr', 'lib', 'x86_64-linux-gnu');
const env = existsSync(extraLibDir)
  ? { ...process.env, LD_LIBRARY_PATH: [extraLibDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') }
  : process.env;

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch({ channel: 'chromium', env });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    writeFileSync(`public/icon-${size}.png`, await page.screenshot({ type: 'png' }));
    await page.close();
  }
} finally {
  await browser.close();
}
