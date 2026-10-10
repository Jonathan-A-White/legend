// src/ui/Placeholder.tsx: what a screen shows until its story builds it: its name and one plain line on what will be there.
import type { ReactNode } from 'react';

export function Placeholder({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-wide text-accent">{title}</h1>
        {action}
      </div>
      <p className="mt-3 max-w-prose text-lg text-muted">{children}</p>
    </main>
  );
}
