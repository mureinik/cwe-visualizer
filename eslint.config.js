import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import nodePlugin from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';

// The app must never contact MITRE (or anything else) at runtime: it reads
// only the prebuilt JSON under /data/, which scripts/prepare-data.ts fetches
// at build time. See CLAUDE.md.
const NO_RUNTIME_NETWORK =
  'The app must never contact MITRE at runtime; it may only fetch the prebuilt ' +
  "'/data/...' JSON, as a string literal. Fetch data at build time in scripts/prepare-data.ts.";

// Type-aware linting for the TypeScript that tsconfig.json covers.
const typeChecked = [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked];
const projectService = {
  parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
};

export default tseslint.config(
  { ignores: ['dist', 'public/data'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [...typeChecked, jsxA11y.configs.recommended],
    languageOptions: {
      ...projectService,
      ecmaVersion: 2025,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'no-restricted-syntax': [
        'error',
        {
          // \u002F is '/': esquery ends a regex at the first bare slash.
          selector:
            "CallExpression:matches([callee.name='fetch'], [callee.property.name='fetch'])" +
            ":not([arguments.0.type='Literal'][arguments.0.value=/^\\u002Fdata\\u002F/])",
          message: NO_RUNTIME_NETWORK,
        },
        {
          selector: "NewExpression[callee.name=/^(XMLHttpRequest|WebSocket|EventSource)$/]",
          message: NO_RUNTIME_NETWORK,
        },
        {
          selector: "CallExpression[callee.property.name='sendBeacon']",
          message: NO_RUNTIME_NETWORK,
        },
      ],
    },
  },
  {
    // Backend Node.js code: prepare-data.ts and any future scripts/*.ts.
    // Not applied to src/** (browser code, never runs under Node) or to
    // *.config.{js,ts} (tooling config — its imports are devDependencies,
    // which eslint-plugin-n's unpublished-import rules would misflag).
    files: ['scripts/**/*.ts'],
    extends: [...typeChecked, nodePlugin.configs['flat/recommended-module']],
    languageOptions: {
      ...projectService,
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
    files: ['test/**/*.{ts,tsx}'],
    extends: typeChecked,
    languageOptions: {
      ...projectService,
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  }
);
