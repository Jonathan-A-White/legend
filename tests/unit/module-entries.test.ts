// docs/module-map.md: "never import from inside another module's folder, only its entry". A folder under src with an index.ts is a
// module: a file outside it imports the folder ('../capture'), never a file inside it ('../capture/startItem'). The folders are found
// here, not listed, so a new module is held from its first file (the lint, eslint.config.js, finds them the same way).
// An entry that exports a screen brings everything the screen imports, so sending a pure name through it can close a loop
// (rarity -> learn's entry -> YearsPage -> rarity): src has no runtime import cycle either. `import type` is erased and makes none.
// When the loop test fails, do not reach past the entry again: put the shared name in the lower of the two modules (the key dates
// are rarity's, src/rarity/years.ts), or under both in src/data or src/ui (data/quarterDesign.ts, ui/useLoaded.ts), or have the
// caller hand it over (the Globe gives share its renderer, so share imports only types from src/globe).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });

const FILES = walk('src');
/** Every folder under src that has an index.ts. */
const MODULES = [...new Set(FILES.filter((file) => file.endsWith('/index.ts')).map((file) => dirname(file)))].sort();

interface Import {
  /** the line as written, on one line */
  text: string;
  /** what the specifier names, from the repo's root; null for a package */
  path: string | null;
  /** `import type` or `export type`: erased, so it is no edge when the app runs */
  typeOnly: boolean;
}

const STATIC = /^[ \t]*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s+)?'([^']+)'/gm;
const DYNAMIC = /\bimport\(\s*'([^']+)'\s*\)/g;

function importsOf(file: string): Import[] {
  const source = readFileSync(file, 'utf8');
  const pathOf = (spec: string) => (spec.startsWith('.') ? normalize(join(dirname(file), spec.replace(/\?.*$/, ''))) : null);
  const line = (text: string) => text.trim().replace(/\s+/g, ' ');
  return [
    ...[...source.matchAll(STATIC)].map((m) => ({ text: line(m[0]), path: pathOf(m[2]), typeOnly: m[1] !== undefined })),
    ...[...source.matchAll(DYNAMIC)].map((m) => ({ text: line(m[0]), path: pathOf(m[1]), typeOnly: true })),
  ];
}

const inside = (path: string, dir: string) => path.startsWith(`${dir}/`);

/** The imports that reach a file inside `module` from a file outside it. */
const deepImports = (module: string): string[] =>
  FILES.filter((file) => !inside(file, module)).flatMap((file) =>
    importsOf(file)
      .filter(({ path }) => path !== null && inside(path, module))
      .map(({ text }) => `${file}: ${text}`),
  );

/** The source file a path names: itself, with .ts or .tsx, or a folder's index.ts. */
const fileOf = (path: string): string | undefined => [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`, path].find((p) => /\.tsx?$/.test(p) && existsSync(p));

/** The groups of files that import each other in a loop when the app runs (Tarjan's strongly connected components). */
function cycles(): string[][] {
  const edges = new Map(FILES.map((file) => [file, importsOf(file).flatMap(({ path, typeOnly }) => (path === null || typeOnly ? [] : (fileOf(path) ?? [])))]));
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];
  const visit = (file: string): void => {
    index.set(file, index.size);
    low.set(file, index.get(file)!);
    stack.push(file);
    for (const next of edges.get(file) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(file, Math.min(low.get(file)!, low.get(next)!));
      } else if (stack.includes(next)) low.set(file, Math.min(low.get(file)!, index.get(next)!));
    }
    if (low.get(file) !== index.get(file)) return;
    const group = stack.splice(stack.indexOf(file));
    if (group.length > 1) found.push(group.sort());
  };
  for (const file of FILES) if (!index.has(file)) visit(file);
  return found;
}

describe('module entries', () => {
  it('finds the modules: every folder under src with an index.ts', () => {
    expect(MODULES).toEqual(expect.arrayContaining(['src/bulk', 'src/capture', 'src/collection', 'src/data/repositories', 'src/learn', 'src/rarity', 'src/screens/home', 'src/share', 'src/tutor']));
    expect(MODULES.every((module) => existsSync(`${module}/index.ts`))).toBe(true);
  });

  for (const module of MODULES) {
    it(`nothing outside ${module} reaches past its entry`, () => {
      expect(deepImports(module)).toEqual([]);
    });
  }

  it('src has no runtime import cycle', () => {
    expect(cycles()).toEqual([]);
  });
});
