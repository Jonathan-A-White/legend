// src/attribution.ts: ATTRIBUTION.md is the one source of the credits: the About screen is built from it, so what the app shows
// and what the repository says cannot differ. Only the markdown that file uses is read: a title, a '> ' quote whose last line
// begins '— ', an intro paragraph, '## ' sections of paragraphs and '- ' bullets (continued by the lines under them), the
// '<!-- toc -->' block (skipped), **bold**, `code` and [Name](https://…) links.
import attributionMd from '../ATTRIBUTION.md?raw';

export interface Quote {
  text: string;
  by: string;
}

export interface Block {
  /** 'credit' is a bullet: one library, dataset, photo or idea; 'note' is a paragraph between them */
  kind: 'credit' | 'note';
  /** the markdown of the block, its lines joined by a space */
  md: string;
}

export interface Section {
  /** null for the blocks that come before the first '## ' heading */
  title: string | null;
  blocks: Block[];
}

export interface Attribution {
  quote: Quote | null;
  intro: string;
  sections: Section[];
  /** every credit (bullet) of every section, in order */
  credits: string[];
}

export function parseAttribution(md: string): Attribution {
  const quote: string[] = [];
  let by = '';
  const intro: string[] = [];
  const sections: Section[] = [];
  let inToc = false;
  // a blank line ends a paragraph; the next plain line starts a new one
  let open = false;
  for (const line of md.split('\n')) {
    if (line.trim() === '<!-- toc -->') inToc = true;
    if (inToc) {
      if (line.trim() === '<!-- /toc -->') inToc = false;
      continue;
    }
    if (line.startsWith('# ')) continue;
    if (line.trim() === '') {
      open = false;
      continue;
    }
    const last = sections[sections.length - 1];
    if (line.startsWith('## ')) {
      sections.push({ title: line.slice(3).trim(), blocks: [] });
      open = false;
    } else if (line.startsWith('> ')) {
      const text = line.slice(2).trim();
      if (text.startsWith('— ')) by = text.slice(2).trim();
      else quote.push(text);
    } else if (!last) {
      intro.push(line.trim());
    } else if (line.startsWith('- ')) {
      last.blocks.push({ kind: 'credit', md: line.slice(2).trim() });
      open = true;
    } else if (open) {
      last.blocks[last.blocks.length - 1].md += ` ${line.trim()}`;
    } else {
      last.blocks.push({ kind: 'note', md: line.trim() });
      open = true;
    }
  }
  return {
    quote: quote.length > 0 ? { text: quote.join(' '), by } : null,
    intro: intro.join(' '),
    sections,
    credits: sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'credit').map((b) => b.md)),
  };
}

export const attribution: Attribution = parseAttribution(attributionMd);

/** The links of a line of markdown: each one's name and address. */
export function linksOf(md: string): { name: string; href: string }[] {
  return [...md.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ name: m[1], href: m[2] }));
}

/** The bold names of a line of markdown (the credit's own name), without the marks. */
export function boldOf(md: string): string[] {
  return [...md.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => plainText(m[1]));
}

/** The text as it reads on screen: no markdown marks, a link as its name. */
export function plainText(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*/g, '').replace(/`/g, '');
}
