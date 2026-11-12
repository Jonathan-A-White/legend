// tests/e2e/bulk-cut.spec.ts: src/bulk/cut.ts in a real browser. No screen uses the cutter yet, so the spec bundles it with esbuild and
// runs it on a generated 4000x3000 group photo (twelve coins, four across and three down), then lays the twelve cut-outs out as a
// grid. Each is 700 px or more, one coin on a neutral grey with nothing of a neighbour in a corner. Ends with a shot.
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { shot } from './shot';

test.use({ viewport: { width: 390, height: 844 } });

const WIDTH = 4000;
const HEIGHT = 3000;
const RADIUS = 380; // a 760 px coin: above the 700 px that reads well
const COLUMNS = 4;
const ROWS = 3;

test('cuts twelve coins out of a 4000x3000 group photo and shows them in a grid, each 700 px or more', async ({ page }) => {
  const bundle = await build({
    entryPoints: ['src/bulk/cut.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'legendCut',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  });
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0;background:#111;color:#eee;font-family:sans-serif"><main id="out"></main>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const result = await page.evaluate(
    async ([width, height, radius, columns, rows]) => {
      // the group photo: a wooden table, with twelve numbered coins on it
      const table = document.createElement('canvas');
      table.width = width;
      table.height = height;
      const g = table.getContext('2d')!;
      g.fillStyle = '#7a5a3a';
      g.fillRect(0, 0, width, height);
      const circles: { x: number; y: number; r: number }[] = [];
      for (let i = 0; i < columns * rows; i++) {
        const x = (width / columns) * ((i % columns) + 0.5);
        const y = (height / rows) * (Math.floor(i / columns) + 0.5);
        circles.push({ x, y, r: radius });
        const shine = g.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
        shine.addColorStop(0, '#f2e6c8');
        shine.addColorStop(1, '#a9803a');
        g.fillStyle = shine;
        g.beginPath();
        g.arc(x, y, radius, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#6b4c1c';
        g.lineWidth = 24;
        g.beginPath();
        g.arc(x, y, radius * 0.86, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = '#4a3410';
        g.font = 'bold 300px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(i + 1), x, y);
      }
      const photo = await new Promise<Blob>((resolve, reject) => table.toBlob((b) => (b ? resolve(b) : reject(new Error('no photo'))), 'image/jpeg', 0.9));
      table.width = 0;

      const cut = (window as unknown as { legendCut: { cutCoins: (f: Blob, c: typeof circles) => Promise<{ blob: Blob; thumb: Blob; width: number; height: number }[]> } }).legendCut;
      const stills = await cut.cutCoins(photo, circles);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px';
      document.getElementById('out')!.append(grid);
      const out = [];
      for (const still of stills) {
        const url = URL.createObjectURL(still.blob);
        const img = new Image();
        img.style.cssText = 'width:100%;height:auto;display:block';
        img.src = url;
        await img.decode();
        grid.append(img);
        // the picture's own corner and centre, read back from the encoded JPEG
        const probe = document.createElement('canvas');
        probe.width = img.naturalWidth;
        probe.height = img.naturalHeight;
        const p = probe.getContext('2d')!;
        p.drawImage(img, 0, 0);
        const at = (x: number, y: number) => Array.from(p.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3));
        const w = img.naturalWidth;
        out.push({
          width: img.naturalWidth,
          height: img.naturalHeight,
          bytes: still.blob.size,
          thumbBytes: still.thumb.size,
          corners: [at(2, 2), at(w - 3, 2), at(2, w - 3), at(w - 3, w - 3)],
          rim: at(w / 2 + (w / 2.08) * 0.92, w / 2),
          centre: at(w / 2 + w * 0.2, w / 2 - w * 0.2),
        });
        probe.width = 0;
      }
      return out;
    },
    [WIDTH, HEIGHT, RADIUS, COLUMNS, ROWS] as const,
  );

  expect(result).toHaveLength(12);
  for (const cutOut of result) {
    expect(cutOut.width).toBeGreaterThanOrEqual(700);
    expect(cutOut.height).toBe(cutOut.width);
    expect(cutOut.bytes).toBeLessThan(1_000_000);
    expect(cutOut.thumbBytes).toBeGreaterThan(0);
    // all four corners are the neutral dark grey (#333), nothing of the table or a neighbour
    for (const corner of cutOut.corners) for (const channel of corner) expect(Math.abs(channel - 0x33)).toBeLessThan(12);
    // the coin itself is not grey, right out to its rim
    expect(cutOut.rim[0]).toBeGreaterThan(0x60);
    expect(cutOut.centre[0]).toBeGreaterThan(0x60);
  }
  await expect(page.locator('#out img')).toHaveCount(12);
  await shot(page, 'bulk-cut');
});
