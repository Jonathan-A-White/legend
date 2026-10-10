// tests/unit/key-qr.test.ts: the QR on Unlock carries the exact key string: the SVG path read back into a module grid
// equals the modules the `qrcode` package makes for that key at error level M.
import { describe, expect, it } from 'vitest';
import { create } from 'qrcode';
import { qrPath, QUIET_ZONE } from '../../src/gate/qr';

const KEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

/** Read `M<col> <row>h1v1h-1z` squares back into rows of booleans. */
function gridFromPath(path: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const m of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) grid[Number(m[2])][Number(m[1])] = true;
  return grid;
}

describe('qrPath', () => {
  it('draws exactly the modules of the key at error level M', () => {
    const { size, path } = qrPath(KEY);
    const { modules } = create(KEY, { errorCorrectionLevel: 'M' });
    expect(size).toBe(modules.size);
    const grid = gridFromPath(path, size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) expect(grid[row][col]).toBe(Boolean(modules.data[row * size + col]));
    }
    expect(path.replace(/M\d+ \d+h1v1h-1z/g, '')).toBe('');
  });

  it('is not the code of a different key, and uses a quiet zone of 4', () => {
    expect(qrPath(KEY).path).not.toBe(qrPath(KEY.slice(0, -1) + '9').path);
    expect(QUIET_ZONE).toBe(4);
  });
});
