// A drawing context for the pictures Share makes (src/share/): FakeContext plus the calls a picture adds (rectangles, text,
// images). It remembers every text drawn and every image placed, and stands in for HTMLCanvasElement.getContext and toBlob,
// which jsdom does not have. `install()` puts it behind every canvas and records the size of each canvas a picture was cut from.
import { Blob as NodeBlob } from 'node:buffer';
import type { PictureContext } from '../../src/share/picture';
import { FakeContext } from './fake-canvas';

export class FakePictureContext extends FakeContext implements PictureContext {
  font = '';
  textAlign: CanvasTextAlign = 'left';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  texts: string[] = [];
  images = 0;
  rects = 0;

  fillRect(): void {
    this.rects += 1;
  }
  strokeRect(): void {}
  fillText(text: string): void {
    this.texts.push(text);
  }
  measureText(text: string): TextMetrics {
    return { width: text.length * 10 } as TextMetrics;
  }
  drawImage(): void {
    this.images += 1;
  }
  save(): void {}
  restore(): void {}
  setLineDash(): void {}

  override reset(): void {
    super.reset();
    this.texts = [];
    this.images = 0;
    this.rects = 0;
  }
}

export interface Cut {
  width: number;
  height: number;
  type: string | undefined;
}

/** Puts `ctx` behind every canvas and makes toBlob answer a small JPEG; returns the pictures cut so far and a way to undo it. */
export function installPictureCanvas(ctx: FakePictureContext): { cuts: Cut[]; restore(): void } {
  const cuts: Cut[] = [];
  const original = { getContext: HTMLCanvasElement.prototype.getContext, toBlob: HTMLCanvasElement.prototype.toBlob };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string) {
    cuts.push({ width: this.width, height: this.height, type });
    callback(new NodeBlob(['jpeg'], { type }) as unknown as Blob);
  } as never;
  return {
    cuts,
    restore() {
      HTMLCanvasElement.prototype.getContext = original.getContext;
      HTMLCanvasElement.prototype.toBlob = original.toBlob;
    },
  };
}
