import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import nodePlugin from 'eslint-plugin-n';
import stylistic from '@stylistic/eslint-plugin';
import yml from 'eslint-plugin-yml';
import jsonc from 'eslint-plugin-jsonc';
import html from '@html-eslint/eslint-plugin';
import tseslint from 'typescript-eslint';

// The app must never contact MITRE (or anything else) at runtime: it reads
// only the prebuilt JSON under /data/, which scripts/prepare-data.ts fetches
// at build time. See CLAUDE.md.
const NO_RUNTIME_NETWORK =
  'The app must never contact MITRE at runtime; it may only fetch the prebuilt ' +
  "'/data/...' JSON, as a string literal. Fetch data at build time in scripts/prepare-data.ts.";

// eslint-plugin-jsonc's presets check JSON's syntax but leave its layout alone.
const JSON_LAYOUT = {
  'jsonc/indent': ['error', 2],
  'jsonc/key-spacing': 'error',
  'jsonc/comma-style': 'error',
  'jsonc/object-curly-spacing': ['error', 'always'],
  'jsonc/array-bracket-spacing': 'error',
  'jsonc/object-curly-newline': ['error', { consistent: true }],
  'jsonc/array-bracket-newline': ['error', 'consistent'],
};

// Type-aware linting for the TypeScript that tsconfig.json covers.
const typeChecked = [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked];
const projectService = {
  parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
};

export default tseslint.config(
  // Dot-directories hold local tools' state (.claude, .serena, ...), except
  // .github, which is ours.
  { ignores: ['dist', 'public/data', 'coverage', '.*/', '!.github/'] },
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
          selector: 'NewExpression[callee.name=/^(XMLHttpRequest|WebSocket|EventSource)$/]',
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
    // Backend Node.js code: prepare-data.ts, the CI helpers in
    // .github/scripts/, and any future scripts of either kind. Not applied to src/** (browser code, never runs under Node) or to
    // *.config.{js,ts} (tooling config — its imports are devDependencies,
    // which eslint-plugin-n's unpublished-import rules would misflag).
    files: ['scripts/**/*.ts', '.github/scripts/**/*.ts'],
    extends: [...typeChecked, nodePlugin.configs['flat/recommended-module']],
    languageOptions: {
      ...projectService,
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    // vite.config.ts also defines the coverage thresholds, with types, so it
    // needs the TypeScript parser. It's in tsconfig.json, so it gets the same
    // type-aware rules as the rest of the TypeScript.
    files: ['*.config.ts'],
    extends: typeChecked,
    languageOptions: {
      ...projectService,
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
  },
  // Formatting. Nothing else enforces it, so it's ESLint's job, for every
  // file type ESLint can parse. CSS is the exception, formatted by Stylelint
  // (see .stylelintrc.json). The options match the style the code already had.
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true,
        arrowParens: true,
        braceStyle: '1tbs',
        commaDangle: 'always-multiline',
      }),
    ],
    rules: {
      // Quote a key only when it must be, and always quote numeric ones
      // (CWE ids like '79').
      '@stylistic/quote-props': ['error', 'as-needed', { numbers: true }],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      // Break after a binary operator, but before the ternary's ? and : and a
      // union's leading |.
      '@stylistic/operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before', '|': 'before', '&': 'before' } }],
      // Both would force JSX the code writes on one line (`cond ? (`, text
      // next to an expression) onto several, for no gain in readability.
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/jsx-one-expression-per-line': 'off',
    },
  },
  {
    files: ['**/*.{yml,yaml}'],
    extends: [yml.configs['flat/standard']],
    rules: {
      // GitHub Actions spells an event with no settings as `push:`.
      'yml/no-empty-mapping-value': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [html.configs['flat/recommended']],
    rules: {
      '@html-eslint/indent': ['error', 2],
    },
  },
  {
    // package-lock.json is npm's to format.
    files: ['**/*.json'],
    ignores: ['package-lock.json'],
    extends: [jsonc.configs['flat/recommended-with-json']],
    rules: JSON_LAYOUT,
  },
  {
    // tsconfig.json allows comments, like any .jsonc file.
    files: ['**/*.jsonc', 'tsconfig.json'],
    extends: [jsonc.configs['flat/recommended-with-jsonc']],
    rules: JSON_LAYOUT,
  },
);
