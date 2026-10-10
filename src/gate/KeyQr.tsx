// src/gate/KeyQr.tsx: the phone's key as a QR code on Unlock, so Postern's Issue a licence scanner can read it. Drawn as
// one SVG path (qr.ts): nothing touches a canvas or injects markup. Black on white whatever the theme, so it scans.
import { qrPath, QUIET_ZONE } from './qr';

export function KeyQr({ text, label }: { text: string; label: string }) {
  const { size, path } = qrPath(text);
  const extent = size + QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="key-qr"
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className="size-52 shrink-0 self-center rounded-lg"
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
