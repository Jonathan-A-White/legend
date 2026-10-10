// The settings registry (src/settings/registry.ts): every setting declared once; writing saves and tells the bus; the
// tutor's door (applyChanges, undoChange) takes only talkable settings and only values they allow.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/data/db';
import { clearBus, subscribe } from '../../src/events/bus';
import { SETTINGS, applyChanges, currentSettings, settingOf, undoChange, writeSetting } from '../../src/settings/registry';
import { ROWS, visibleRows } from '../../src/settings/rows';

beforeEach(async () => {
  clearBus();
  await db.open();
  await db.settings.clear();
});

describe('the registry', () => {
  it('declares each setting once, with a default its kind allows and a one-line hint', () => {
    expect(new Set(SETTINGS.map((s) => s.key)).size).toBe(SETTINGS.length);
    for (const s of SETTINGS) {
      expect(s.label, s.key).not.toBe('');
      expect(s.hint.length, `${s.key}'s hint`).toBeLessThanOrEqual(90);
      expect(s.help, s.key).not.toBe('');
      if (s.kind === 'switch') expect(typeof s.default, s.key).toBe('boolean');
      if (s.kind === 'choice') expect(s.options.map((o) => o.value), s.key).toContain(s.default);
      if (s.kind === 'number') expect(s.default >= s.min && s.default <= s.max, s.key).toBe(true);
      if (s.dependsOn) expect(settingOf(s.dependsOn.key), `${s.key} depends on a setting`).toBeDefined();
    }
  });

  it('reads the default until a value is written', async () => {
    expect((await currentSettings()).theme).toBe('system');
    await writeSetting('theme', 'dark');
    expect((await currentSettings()).theme).toBe('dark');
  });

  it('writeSetting saves the value and publishes settings.changed with what it replaced', async () => {
    const heard = vi.fn();
    subscribe('settings.changed', heard);
    await writeSetting('showValues', false);
    expect(heard).toHaveBeenCalledExactlyOnceWith({ kind: 'settings.changed', key: 'showValues', value: false, previous: true });
    expect((await db.settings.get('showValues'))?.value).toBe(false);
  });

  it('refuses an unknown key and a value the setting does not allow', async () => {
    await expect(writeSetting('nope', 1)).rejects.toThrow(/no setting/);
    await expect(writeSetting('theme', 'purple')).rejects.toThrow(/allow/);
    await expect(writeSetting('sizeCap', 99999)).rejects.toThrow(/allow/);
    await expect(writeSetting('showValues', 'yes')).rejects.toThrow(/allow/);
  });

  it('ignores a stored value that is no longer allowed and falls back to the default', async () => {
    await db.settings.put({ key: 'theme', value: 'purple' });
    expect((await currentSettings()).theme).toBe('system');
  });
});

describe('the tutor’s door', () => {
  it('applyChanges applies a list in order and says what it replaced', async () => {
    const { applied, refused } = await applyChanges([
      { key: 'theme', value: 'dark' },
      { key: 'textSize', value: 'large' },
      { key: 'theme', value: 'light' },
    ]);
    expect(refused).toEqual([]);
    expect(applied.map((c) => [c.key, c.from, c.to])).toEqual([
      ['theme', 'system', 'dark'],
      ['textSize', 'normal', 'large'],
      ['theme', 'dark', 'light'],
    ]);
    expect((await currentSettings()).theme).toBe('light');
  });

  it('refuses what is not talkable, unknown, or not allowed, and says why in a plain sentence', async () => {
    const { applied, refused } = await applyChanges([
      { key: 'sharing', value: true },
      { key: 'colour', value: 'red' },
      { key: 'theme', value: 'purple' },
      { key: 'theme' },
      'theme',
    ]);
    expect(applied).toEqual([]);
    expect(refused).toHaveLength(5);
    expect(refused[0]).toMatch(/Sharing/);
    expect((await currentSettings()).sharing).toBe(false);
  });

  it('applyChanges takes no list that is not a list', async () => {
    expect(await applyChanges('theme=dark')).toEqual({ applied: [], refused: [] });
  });

  it('undoChange puts back what the last change replaced', async () => {
    const { applied } = await applyChanges([
      { key: 'theme', value: 'dark' },
      { key: 'answerLength', value: 'long' },
    ]);
    await undoChange(applied[applied.length - 1]);
    const now = await currentSettings();
    expect(now.answerLength).toBe('medium');
    expect(now.theme).toBe('dark');
  });

  it('marks which settings the tutor may change', () => {
    expect(settingOf('theme')?.talkable).toBe(true);
    expect(settingOf('sharing')?.talkable).toBe(false);
  });
});

describe('a setting that depends on another', () => {
  it('is hidden while its parent is off and drawn when it is on', () => {
    const rows = [
      { key: 'parent', label: 'Parent', hint: 'h', help: 'h', section: 'appearance' as const, kind: 'switch' as const, default: false, talkable: true },
      { key: 'child', label: 'Child', hint: 'h', help: 'h', section: 'appearance' as const, kind: 'switch' as const, default: false, talkable: true, dependsOn: { key: 'parent', equals: true } },
    ];
    expect(visibleRows({ parent: false }, rows).map((r) => r.key)).toEqual(['parent']);
    expect(visibleRows({ parent: true }, rows).map((r) => r.key)).toEqual(['parent', 'child']);
  });

  it('hides the photo size cap while originals are kept', () => {
    const keys = (values: Record<string, never | boolean>) => visibleRows(values).map((r) => r.key);
    expect(keys({ keepOriginals: true })).not.toContain('sizeCap');
    expect(keys({ keepOriginals: false })).toContain('sizeCap');
    expect(ROWS.some((r) => r.dependsOn)).toBe(true);
  });
});
