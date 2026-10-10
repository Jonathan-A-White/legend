// src/collection/fields.ts: what Edit offers and how it reads what was typed.

export { GRADES } from '../data/grades';

export const parseTags = (text: string): string[] => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))];
