import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// The modules that have an index.ts (docs/module-map.md): src/bulk and src/capture import them by that entry only.
const ENTRY_MODULES = ['bulk', 'capture', 'collection', 'feedback', 'gate', 'globe', 'learn', 'quarters', 'rarity', 'share', 'tips', 'tutor', 'wishlist', 'worth'];

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
    // docs/module-map.md: import another module by its entry (../capture), never a file inside it (../capture/startItem).
    files: ['src/bulk/**/*.{ts,tsx}', 'src/capture/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ENTRY_MODULES.map((m) => `../${m}/*`),
              message: "Import a module by its entry ('../capture'), not a file inside it (docs/module-map.md): add the name to its index.ts.",
            },
          ],
        },
      ],
    },
  },
]);
