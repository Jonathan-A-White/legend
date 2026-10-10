// src/tutor/Markdown.tsx: the tutor writes Markdown (grinds/legend-ask.md asks for short paragraphs, **bold**, *italics* and short
// lists); this draws that much and no more. It never makes HTML from the text, so an answer is safe to draw as it comes: a heading
// is drawn as a bold line, a link as its words, and anything else as the plain text it is. The text takes the size around it.
import { memo, type ReactNode } from 'react';

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] } | { kind: 'h'; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** The text cut into paragraphs, lists and headings. */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const last = blocks[blocks.length - 1];
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    const heading = HEADING.exec(line);
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] });
    } else if (heading) {
      blocks.push({ kind: 'h', text: heading[1] });
    } else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (last?.kind === 'p') {
      last.lines.push(line.trim());
    } else if ((last?.kind === 'ul' || last?.kind === 'ol') && /^\s+/.test(line)) {
      last.items[last.items.length - 1] += ` ${line.trim()}`;
    } else {
      blocks.push({ kind: 'p', lines: [line.trim()] });
    }
  }
  return blocks.filter((b) => b.kind !== 'p' || b.lines.length > 0);
}

const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)(.+?)\*|_(?!\s)(.+?)_(?![A-Za-z0-9])|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g;

/** One line's bold, italics, code and links as nodes. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) nodes.push(text.slice(at, m.index));
    const key = nodes.length;
    if (m[1] ?? m[2]) nodes.push(<strong key={key}>{inline(m[1] ?? m[2])}</strong>);
    else if (m[3] ?? m[4]) nodes.push(<em key={key}>{inline(m[3] ?? m[4])}</em>);
    else if (m[5]) nodes.push(<code key={key}>{m[5]}</code>);
    else nodes.push(m[6]);
    at = m.index + m[0].length;
  }
  if (at < text.length) nodes.push(text.slice(at));
  return nodes;
}

/** Memoized on its text: an answer is read once, however often the sheet around it redraws. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {blocksOf(text).map((block, i) => {
        if (block.kind === 'h') return <p key={i} className="font-semibold">{inline(block.text)}</p>;
        if (block.kind === 'p') return <p key={i}>{inline(block.lines.join(' '))}</p>;
        const List = block.kind;
        return (
          <List key={i} className={`space-y-1 pl-6 ${List === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
});
