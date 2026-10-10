// src/gate/qr.ts: a QR code as plain data, the way Postern draws its key QR (src/key/qr.ts): the `qrcode` package
// encodes at error level M and the dark modules come back as one SVG path, one unit square per module (KeyQr.tsx draws it).
import { create } from 'qrcode';

/** White border around the code, in modules; scanners need it to find the edges. */
export const QUIET_ZONE = 4;

export function qrPath(text: string): { size: number; path: string } {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules;
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (data[row * size + col]) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { size, path };
}
