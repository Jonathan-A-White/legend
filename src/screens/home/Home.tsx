// src/screens/home/Home.tsx: the first screen: the app's name, what it is for, and which build is running.
// The collection, the camera and the rest arrive as their own screens (docs/overview.md).
import { BuildVersion } from '../../ui/BuildVersion';

export function Home() {
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-between overflow-y-auto px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <img src="/icon.svg" alt="" aria-hidden="true" width={144} height={144} className="rounded-3xl border border-line" />
        <div>
          <h1 className="text-4xl font-semibold tracking-wide text-accent">Legend</h1>
          <p className="mt-2 text-lg text-muted">Coins and banknotes, kept.</p>
        </div>
      </div>
      <BuildVersion />
    </main>
  );
}
