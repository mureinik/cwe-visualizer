import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import nodePlugin from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'public/data'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2025,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Backend Node.js code: prepare-data.ts and any future scripts/*.ts.
    // Not applied to src/** (browser code, never runs under Node) or to
    // *.config.{js,ts} (tooling config — its imports are devDependencies,
    // which eslint-plugin-n's unpublished-import rules would misflag).
    files: ['scripts/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      nodePlugin.configs['flat/recommended-module'],
    ],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['test/**/*.{ts,tsx,mjs,js}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  }
);
