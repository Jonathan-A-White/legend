// A clock the test turns by hand, put in place of src/globe/clock.ts's: frames run only when advance() is called, one every
// 16 ms of pretend time, and a timer fires when the pretend time reaches it.
import { clock, type Clock } from '../../src/globe/clock';

export class ManualClock {
  time = 1000;
  private frames = new Map<number, (t: number) => void>();
  private timers = new Map<number, { at: number; fn: () => void }>();
  private next = 1;
  private saved: Clock = { ...clock };

  readonly api: Clock = {
    now: () => this.time,
    frame: (cb) => {
      const id = this.next++;
      this.frames.set(id, cb);
      return id;
    },
    cancelFrame: (id) => void this.frames.delete(id),
    later: (fn, ms) => {
      const id = this.next++;
      this.timers.set(id, { at: this.time + ms, fn });
      return id;
    },
    cancelLater: (id) => void this.timers.delete(id),
  };

  install(): void {
    Object.assign(clock, this.api);
  }

  restore(): void {
    Object.assign(clock, this.saved);
  }

  /** True while a frame is asked for. */
  get framePending(): boolean {
    return this.frames.size > 0;
  }

  get timersPending(): number {
    return this.timers.size;
  }

  /** Moves time on by `ms` in 16 ms steps, running the frames asked for and the timers that come due. */
  advance(ms: number): void {
    const end = this.time + ms;
    while (this.time < end) {
      this.time = Math.min(end, this.time + 16);
      for (const [id, t] of [...this.timers]) {
        if (t.at <= this.time) {
          this.timers.delete(id);
          t.fn();
        }
      }
      const due = [...this.frames];
      this.frames.clear();
      for (const [, cb] of due) cb(this.time);
    }
  }
}
