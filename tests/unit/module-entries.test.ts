// docs/module-map.md: "never import from inside another module's folder, only its entry". A module with an index.ts is imported as
// '../<module>', never '../<module>/<file>'. bulk and capture are held to it here (and by the lint, eslint.config.js).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const filesOf = (dir: string) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`);

const deepImports = (module: string): string[] =>
  filesOf(`src/${module}`).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/from '\.\.\/([a-z]+)\/[^']+'/g)]
      .filter(([, other]) => existsSync(`src/${other}/index.ts`))
      .map(([line]) => `${file}: ${line}`),
  );

describe('module entries', () => {
  for (const module of ['bulk', 'capture']) {
    it(`src/${module} reaches into no other module past its entry`, () => {
      expect(deepImports(module)).toEqual([]);
    });
  }
});
