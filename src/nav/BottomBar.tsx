// src/nav/BottomBar.tsx: the five screens, always one tap away at the thumb: large targets, a label under each icon, the
// active one lit. An item lights Collection and a country lights Globe. The links are plain hash links, so Back walks them.
import type { ReactElement } from 'react';
import { TABS, hashFor, routeOf, tabOf, useAddress, type Tab } from './route';

const ICON_PROPS = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const TAB_FACE: Record<Tab, { label: string; icon: ReactElement }> = {
  collection: {
    label: 'Collection',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="5.5" />
      </svg>
    ),
  },
  globe: {
    label: 'Globe',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5Z" />
      </svg>
    ),
  },
  quarters: {
    label: 'Quarters',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  learn: {
    label: 'Learn',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 5.5c3-1.5 5.5-1.5 8 0 2.5-1.5 5-1.5 8 0V19c-3-1.5-5.5-1.5-8 0-2.5-1.5-5-1.5-8 0V5.5ZM12 5.5V19" />
      </svg>
    ),
  },
  settings: {
    label: 'Settings',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
    ),
  },
};

export function BottomBar() {
  const active = tabOf(routeOf(useAddress()));
  return (
    <nav aria-label="Screens" className="shrink-0 select-none border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {TABS.map((tab) => {
          const on = tab === active;
          return (
            <li key={tab} className="flex-1">
              <a
                href={hashFor(tab)}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-sm font-medium ${on ? 'text-accent' : 'text-muted'}`}
              >
                <span className={`rounded-full px-4 py-0.5 ${on ? 'bg-accent/15' : ''}`}>{TAB_FACE[tab].icon}</span>
                <span>{TAB_FACE[tab].label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
