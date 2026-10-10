// src/collection/fields.ts: what Edit offers and how it reads what was typed.

/** Sheldon's adjectival grades, worst to best. */
export const GRADES = [
  ['P', 'Poor'],
  ['FR', 'Fair'],
  ['AG', 'About Good'],
  ['G', 'Good'],
  ['VG', 'Very Good'],
  ['F', 'Fine'],
  ['VF', 'Very Fine'],
  ['XF', 'Extremely Fine'],
  ['AU', 'About Uncirculated'],
  ['MS', 'Mint State'],
] as const;

export const parseTags = (text: string): string[] => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))];
