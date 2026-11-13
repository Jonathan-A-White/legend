import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A module is a folder under src with an index.ts (docs/module-map.md). They are found, not listed, so a new one is held from its
// first file; tests/unit/module-entries.test.ts finds them the same way and checks every import by where it lands.
const entryModules = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      return [...(existsSync(`${path}/index.ts`) ? [entry.name] : []), ...entryModules(path)];
    });
const ENTRY_MODULES = entryModules(fileURLToPath(new URL('./src', import.meta.url))).sort();

export default defineConfig([
  globalIgnores(['dist', 'shots', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended, // includes no-explicit-any
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // docs/module-map.md: import another module by its entry (../capture), never a file inside it (../capture/startItem). Every
    // file of src is held to it, for every module: a relative import that names a module's folder and then goes on is refused.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^\\.{1,2}/(.*/)?(${ENTRY_MODULES.join('|')})/.+`,
              message: "Import a module by its entry ('../capture'), not a file inside it (docs/module-map.md): add the name to its index.ts.",
            },
          ],
        },
      ],
    },
  },
]);
