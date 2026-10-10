// A drawing context that draws nothing and remembers what it was asked: every fill and stroke, with the style, the alpha and
// how many rings (moveTo) the path held. src/globe/render.ts draws through this shape, so a test can count its calls, and the
// feature steps put it behind HTMLCanvasElement.getContext, which jsdom does not have.
import type { DrawContext } from '../../src/globe/render';

export interface Paint {
  op: 'fill' | 'stroke';
  style: unknown;
  alpha: number;
  lineWidth: number;
  rings: number;
}

export const GRADIENT = { kind: 'gradient' };

export class FakeContext implements DrawContext {
  fillStyle: string | CanvasGradient = '';
  strokeStyle: string | CanvasGradient = '';
  lineWidth = 1;
  globalAlpha = 1;
  lineJoin: CanvasLineJoin = 'miter';
  paints: Paint[] = [];
  clears = 0;
  private rings = 0;

  beginPath(): void {
    this.rings = 0;
  }
  moveTo(): void {
    this.rings += 1;
  }
  lineTo(): void {}
  arc(): void {}
  closePath(): void {}
  fill(): void {
    this.paints.push({ op: 'fill', style: this.fillStyle, alpha: this.globalAlpha, lineWidth: this.lineWidth, rings: this.rings });
  }
  stroke(): void {
    this.paints.push({ op: 'stroke', style: this.strokeStyle, alpha: this.globalAlpha, lineWidth: this.lineWidth, rings: this.rings });
  }
  clearRect(): void {
    this.clears += 1;
  }
  setTransform(): void {}
  createRadialGradient(): CanvasGradient {
    return { ...GRADIENT, addColorStop: () => {} } as unknown as CanvasGradient;
  }

  /** Forgets what was drawn so far. */
  reset(): void {
    this.paints = [];
    this.clears = 0;
  }
}
