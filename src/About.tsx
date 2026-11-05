// src/About.tsx: About Legend at #/about, opened from Settings' About row. Newton's line, why Legend credits, then every credit
// (libraries, data, worth, ideas) as ATTRIBUTION.md has it: the screen is built from that file (src/attribution.ts), so a credit
// added there shows here with no edit to this file. A link opens in a new tab; the build stamp is at the foot.
import { Fragment, type ReactNode } from 'react';
import { attribution, type Attribution } from './attribution';
import { BuildVersion } from './ui/BuildVersion';

/** A line of markdown as nodes: **bold**, `code` and [Name](url) links marked up. */
function inline(md: string): ReactNode[] {
  return md.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/).flatMap((part, i): ReactNode[] => {
    if (part.startsWith('**')) return [<strong key={i}>{inline(part.slice(2, -2))}</strong>];
    if (part.startsWith('`')) return [<code key={i} className="text-sm break-words">{part.slice(1, -1)}</code>];
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return [
        <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="text-accent underline">
          {link[1]}
        </a>,
      ];
    }
    return [<Fragment key={i}>{part}</Fragment>];
  });
}

/** `source` is for tests: the credits to draw. The app passes none and draws ATTRIBUTION.md. */
export function About({ source = attribution }: { source?: Attribution }) {
  const { quote, intro, sections } = source;
  return (
    <main aria-label="About Legend" className="flex min-h-0 flex-1 flex-col px-4">
      <div className="flex shrink-0 items-center pt-[max(env(safe-area-inset-top),0.5rem)]">
        <a href="#/settings" className="-ml-3 flex min-h-12 items-center gap-1 rounded-xl px-3 text-lg font-medium text-accent">
          <span aria-hidden="true">‹</span> Settings
        </a>
      </div>
      <h1 className="text-3xl font-semibold tracking-wide text-accent">About Legend</h1>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {quote ? (
          <blockquote className="border-l-4 border-accent pl-4">
            <p className="text-xl leading-snug italic">{quote.text}</p>
            {quote.by ? <footer className="mt-1 text-base text-muted">{quote.by}</footer> : null}
          </blockquote>
        ) : null}
        <p className="pt-4 text-lg leading-relaxed">{inline(intro)}</p>
        {sections.map((section) => (
          <section key={section.title ?? ''} aria-label={section.title ?? undefined}>
            {section.title ? <h2 className="pt-6 text-xl font-semibold text-ink">{section.title}</h2> : null}
            <ul className="list-none space-y-4 pt-3">
              {section.blocks.map((block) => (
                <li key={block.md} className={`text-base leading-relaxed break-words ${block.kind === 'note' ? 'text-muted' : ''}`}>
                  {inline(block.md)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <BuildVersion className="pt-6" />
      </div>
    </main>
  );
}
