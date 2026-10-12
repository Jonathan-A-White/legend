// scripts/wikitable.ts: a small reader for the tables in MediaWiki wikitext, as the mintage build needs it. Pure: text in, rows out.
// It knows `{|`, `|+` captions, `|-` rows, `!` and `|` cells (several to a line with `||` / `!!`), cell attributes, rowspan and
// colspan; it strips references, templates, links and markup from a cell's text. It is not a general wikitext parser.

export interface Cell {
  text: string;
  header: boolean;
}

export interface WikiTable {
  caption: string;
  /** Rows after rowspan/colspan are expanded, so every row lines up with the columns above it. */
  rows: Cell[][];
}

/** Text with the matching close of `open` ... `close` pairs removed, nesting allowed. */
function dropNested(text: string, open: string, close: string, keep?: (inner: string) => string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(open, i)) {
      let depth = 1;
      let j = i + open.length;
      while (j < text.length && depth > 0) {
        if (text.startsWith(open, j)) {
          depth++;
          j += open.length;
        } else if (text.startsWith(close, j)) {
          depth--;
          j += close.length;
        } else j++;
      }
      const inner = text.slice(i + open.length, Math.max(i + open.length, j - close.length));
      if (keep) out += keep(inner);
      i = j;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

/** What a template says in running text: sortname -> the two names, nowrap -> its text, fontcolor -> the coloured text, anything else nothing. */
function templateText(inner: string): string {
  const parts = splitTop(inner, '|').map((p) => clean(p));
  const name = parts[0].toLowerCase();
  if (name === 'sortname') return `${parts[1] ?? ''} ${parts[2] ?? ''}`.trim();
  if (name === 'nowrap' || name === 'nobr') return parts[1] ?? '';
  if (name === 'fontcolor' || name === 'font color') return parts[2] ?? '';
  return '';
}

/** Split on `sep` outside [[ ]] and {{ }}. */
export function splitTop(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depthL = 0;
  let depthT = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('[[', i)) {
      depthL++;
      i++;
    } else if (text.startsWith(']]', i)) {
      depthL = Math.max(0, depthL - 1);
      i++;
    } else if (text.startsWith('{{', i)) {
      depthT++;
      i++;
    } else if (text.startsWith('}}', i)) {
      depthT = Math.max(0, depthT - 1);
      i++;
    } else if (depthL === 0 && depthT === 0 && text.startsWith(sep, i)) {
      parts.push(text.slice(from, i));
      i += sep.length - 1;
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  return parts;
}

/** A cell's or caption's wikitext as plain text. */
export function clean(raw: string): string {
  let t = raw;
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '');
  t = t.replace(/<\/?noinclude>/gi, '');
  t = t.replace(/<ref\b[^>]*\/>/gi, '');
  t = t.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
  t = dropNested(t, '{{', '}}', templateText);
  t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');
  t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1');
  t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&amp;/g, '&');
  t = t.replace(/'{2,}/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

interface RawCell {
  text: string;
  header: boolean;
  rowspan: number;
  colspan: number;
}

const attrNumber = (attrs: string, name: string): number => {
  const m = new RegExp(`${name}\\s*=\\s*"?(\\d+)"?`, 'i').exec(attrs);
  return m ? Math.max(1, Number(m[1])) : 1;
};

/** `attrs | content` or just `content`: the attributes are the part before a top-level single bar, if they hold an `=`. */
function splitCell(source: string, header: boolean): RawCell {
  const parts = splitTop(source, '|');
  let attrs = '';
  let content = source;
  if (parts.length > 1 && /=/.test(parts[0]) && !/[[{]/.test(parts[0])) {
    attrs = parts[0];
    content = parts.slice(1).join('|');
  }
  return { text: clean(content), header, rowspan: attrNumber(attrs, 'rowspan'), colspan: attrNumber(attrs, 'colspan') };
}

/** Every table in the wikitext, in order. Tables nested in tables are not supported (none of the pages has one). */
export function parseTables(wikitext: string): WikiTable[] {
  // Markup that spans lines or hides lines: comments and the include markers.
  const text = wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, '')
    .replace(/<\/?noinclude>/gi, '');
  const tables: WikiTable[] = [];
  let raw: RawCell[][] | null = null;
  let current: RawCell[] | null = null;
  let caption = '';
  let last: RawCell | null = null;
  const closeRow = (): void => {
    if (raw && current && current.length > 0) raw.push(current);
    current = null;
    last = null;
  };
  const closeTable = (): void => {
    closeRow();
    if (raw) tables.push({ caption, rows: expand(raw) });
    raw = null;
  };
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('{|')) {
      if (raw) closeTable();
      raw = [];
      caption = '';
    } else if (!raw) continue;
    else if (trimmed.startsWith('|}')) closeTable();
    else if (trimmed.startsWith('|+')) caption = clean(trimmed.slice(2));
    else if (trimmed.startsWith('|-')) {
      closeRow();
      current = [];
    } else if (trimmed.startsWith('!') || trimmed.startsWith('|')) {
      current ??= [];
      const header = trimmed.startsWith('!');
      const body = trimmed.slice(1);
      for (const piece of splitTop(body, header ? '!!' : '||')) {
        last = splitCell(piece, header);
        current.push(last);
      }
    } else if (last) {
      last.text = clean(`${last.text} ${trimmed}`);
    }
  }
  if (raw) closeTable();
  return tables;
}

/** Lay the rows out on a grid, copying a rowspan's cell into the rows beneath it and a colspan's across its columns. */
function expand(rows: RawCell[][]): Cell[][] {
  const out: Cell[][] = [];
  const carried = new Map<number, { cell: Cell; left: number }>();
  for (const row of rows) {
    const cells: Cell[] = [];
    let col = 0;
    const fillCarried = (): void => {
      for (let c = carried.get(col); c; c = carried.get(col)) {
        cells[col] = c.cell;
        if (--c.left === 0) carried.delete(col);
        col++;
      }
    };
    for (const raw of row) {
      fillCarried();
      for (let k = 0; k < raw.colspan; k++) {
        const cell: Cell = { text: raw.text, header: raw.header };
        cells[col] = cell;
        if (raw.rowspan > 1) carried.set(col, { cell, left: raw.rowspan - 1 });
        col++;
      }
    }
    fillCarried();
    out.push(cells);
  }
  return out;
}
