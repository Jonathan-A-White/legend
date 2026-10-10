// tests/e2e/camera.ts: a back camera that films a coin on a table, for the Add specs: a canvas stream in portrait. `grain` lays a
// fixed speckle over the table and the coin, so a kept photo weighs what a real one does (a smooth gradient encodes to almost nothing).
import type { Page } from '@playwright/test';

export async function fakeCamera(page: Page, { width = 720, height = 1280, grain = false } = {}): Promise<void> {
  await page.addInitScript(
    ([w, h, speckled]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      let noise: HTMLCanvasElement | null = null;
      if (speckled) {
        noise = document.createElement('canvas');
        noise.width = w;
        noise.height = h;
        const n = noise.getContext('2d')!;
        const image = n.createImageData(w, h);
        let seed = 7;
        for (let i = 0; i < image.data.length; i += 4) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          const v = seed % 256;
          image.data[i] = v;
          image.data[i + 1] = (v * 7) % 256;
          image.data[i + 2] = (v * 13) % 256;
          image.data[i + 3] = 70;
        }
        n.putImageData(image, 0, 0);
      }
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.35;
      const draw = () => {
        g.fillStyle = '#3a3128';
        g.fillRect(0, 0, w, h);
        const grad = g.createRadialGradient(cx - r * 0.24, cy - r * 0.32, r * 0.08, cx, cy, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#c9ccd1');
        grad.addColorStop(1, '#5b5f66');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = 12;
        g.beginPath();
        g.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
        g.stroke();
        if (noise) g.drawImage(noise, 0, 0);
        requestAnimationFrame(draw);
      };
      draw();
      const stream = canvas.captureStream(15);
      navigator.mediaDevices.getUserMedia = async () => stream;
    },
    [width, height, grain] as const,
  );
}
