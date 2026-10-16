// The one place the kinds' words live (src/data/kinds.ts): every ItemKind has an entry, and the helpers speak them.
import { describe, expect, it } from 'vitest';
import type { Item, ItemKind } from '../../src/data/db';
import { KINDS, KIND_ORDER, countWords, isReplica, itemName, kindInfo, unnamedTitle } from '../../src/data/kinds';

const every: Record<ItemKind, true> = { coin: true, note: true, other: true };

describe('the kinds table', () => {
  it('has an entry for every ItemKind, with every word filled in', () => {
    for (const kind of Object.keys(every) as ItemKind[]) {
      const info = KINDS[kind];
      expect(info, kind).toBeDefined();
      for (const word of [info.label, info.plural, info.unnamed, info.count[0], info.count[1], info.searchWords]) expect(word, kind).not.toBe('');
    }
    expect(Object.keys(KINDS).sort()).toEqual(Object.keys(every).sort());
    expect([...KIND_ORDER].sort()).toEqual(Object.keys(every).sort());
  });

  it('says Other the way the story wants it', () => {
    expect(KINDS.other.label).toBe('Other');
    expect(KINDS.other.unnamed).toBe('Unnamed piece');
    expect(countWords('other', 1)).toBe('1 other piece');
    expect(countWords('other', 3)).toBe('3 other pieces');
    expect(countWords('coin', 2)).toBe('2 coins');
    expect(countWords('note', 1)).toBe('1 bill');
  });

  it('falls back to an item of an unknown kind as a bill, as it always did', () => {
    expect(kindInfo('mystery' as ItemKind)).toBe(KINDS.note);
  });

  it('titles an unnamed piece by its subtype when it is an Other', () => {
    const base = { kind: 'other', subtype: 'Subway token' } as Pick<Item, 'kind' | 'subtype'>;
    expect(unnamedTitle(base)).toBe('Subway token');
    expect(unnamedTitle({ kind: 'other', subtype: '  ' })).toBe('Unnamed piece');
    expect(unnamedTitle({ kind: 'other' })).toBe('Unnamed piece');
    expect(unnamedTitle({ kind: 'coin', subtype: 'Subway token' })).toBe('Unnamed coin');
    expect(unnamedTitle({ kind: 'note' })).toBe('Unnamed bill');
  });

  it('knows a replica by its subtype, and only an Other', () => {
    expect(isReplica({ kind: 'other', subtype: 'Replica' })).toBe(true);
    expect(isReplica({ kind: 'other', subtype: 'copy' })).toBe(true);
    expect(isReplica({ kind: 'other', subtype: 'Reproduction' })).toBe(true);
    expect(isReplica({ kind: 'other', subtype: 'Subway token' })).toBe(false);
    expect(isReplica({ kind: 'other' })).toBe(false);
    expect(isReplica({ kind: 'coin', subtype: 'Replica' })).toBe(false);
  });

  it('names a replica as a replica, never as the real piece', () => {
    const replica = { kind: 'other', subtype: 'Replica', denomination: 'Continental dollar' } as const;
    expect(itemName(replica)).toBe('Replica · Continental dollar');
    expect(itemName({ ...replica, denomination: 'Replica of the 1804 silver dollar' })).toBe('Replica of the 1804 silver dollar');
    expect(itemName({ ...replica, denomination: 'Copy of a Brasher doubloon' })).toBe('Copy of a Brasher doubloon');
    expect(itemName({ ...replica, denomination: '' })).toBe('Replica');
    expect(itemName({ kind: 'other', subtype: 'Subway token', denomination: 'NYC Transit token' })).toBe('NYC Transit token');
    expect(itemName({ kind: 'coin', denomination: 'Quarter dollar' })).toBe('Quarter dollar');
    expect(itemName({ kind: 'coin', denomination: '' })).toBe('Unnamed coin');
  });
});
