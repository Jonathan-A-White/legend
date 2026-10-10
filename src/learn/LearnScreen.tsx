// src/learn/LearnScreen.tsx: Learn at #/learn: four cards, each a page of its own (#/learn/grading, /mints, /years, /path). Everything
// on these pages is drawn from the reference data the app ships and his own items; nothing here leaves the phone.
import { FeedbackButton } from '../feedback';
import { useAddress } from '../nav/route';
import { AskTutor } from './AskTutor';
import { GradingPage } from './GradingPage';
import { MintsPage } from './MintsPage';
import { PathPage } from './PathPage';
import { YearsPage } from './YearsPage';

const CARDS = [
  { href: '#/learn/grading', title: 'Grading', line: 'How worn is a coin? Learn the scale and grade one of yours.' },
  { href: '#/learn/mints', title: 'Mints', line: 'The letter on a coin and where to find it.' },
  { href: '#/learn/years', title: 'Special years', line: 'The dates worth looking for in your series.' },
  { href: '#/learn/path', title: 'Your path', line: 'Where you are and what to try next.' },
] as const;

function LearnHome() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4">
      <header>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-wide text-accent">Learn</h1>
          <FeedbackButton screen="Learn" className="-mr-2" />
        </div>
        <p className="mt-1 text-lg text-muted">Learn from the coins you have.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {CARDS.map((c) => (
          <li key={c.href}>
            <a href={c.href} className="flex min-h-20 flex-col justify-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-80">
              <span className="text-xl font-semibold">{c.title}</span>
              <span className="text-base text-muted">{c.line}</span>
            </a>
          </li>
        ))}
      </ul>
      <AskTutor prefill="What should I learn about my coins first?" />
    </main>
  );
}

export function Learn() {
  switch (useAddress().split('?')[0]) {
    case '#/learn/grading':
      return <GradingPage />;
    case '#/learn/mints':
      return <MintsPage />;
    case '#/learn/years':
      return <YearsPage />;
    case '#/learn/path':
      return <PathPage />;
    default:
      return <LearnHome />;
  }
}
