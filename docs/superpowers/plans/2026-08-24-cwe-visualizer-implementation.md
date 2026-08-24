# CWE Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CWE Visualizer end-to-end: a data pipeline that turns MITRE's published CWE corpus into a static JSON graph, a Vite + React SPA that lets a user browse and search that graph as a collapsible tree, and the GitHub Actions/Vercel pipeline that builds, tests, and auto-redeploys it — with the pre-commit lint+test gate working before any of that application code exists.

**Architecture:** A build-time-only Node.js script (`scripts/prepare-data.ts`, run natively — no build step) downloads and parses MITRE's CWE XML into `public/data/cwe.json` — the running app never talks to MITRE or parses XML. A Vite + React + TypeScript SPA reads that static JSON, builds in-memory parent/child indices once on load, and renders a lazily-expanded tree with search and a detail panel. GitHub Actions runs lint/test/build on every PR and, on a daily schedule, compares MITRE's live Last-Modified header against the deployed site's own `meta.json` and pokes a Vercel deploy hook when they differ — no git state involved.

**Tech Stack:** Node.js (>=24), Vite, React 18, TypeScript, `fast-xml-parser`, `adm-zip`, Vitest, React Testing Library, ESLint (flat config), Husky + lint-staged, GitHub Actions, Vercel (zero-config).

**Spec:** `docs/superpowers/specs/2026-08-23-cwe-visualizer-design.md`

## Global Constraints

- Node.js, `engines.node >= 24` in `package.json`; GitHub Actions uses `node-version: 24`.
- `scripts/prepare-data.ts` is run directly by `node` — Node 24 carries stable, unflagged TypeScript type-stripping (the default since Node 23.6), so the data pipeline gets real type safety with no build step, no `ts-node`/`tsx`. This only works for erasable syntax (interfaces, type annotations — no enums/namespaces/decorators), which is all this script needs.
- The running app never fetches from MITRE or parses XML — only `scripts/prepare-data.ts` does, ahead of time. `public/data/*.json` is always gitignored; nothing generated is ever committed.
- Zip extraction uses the `adm-zip` dependency (not a hand-rolled zip reader). XML parsing uses `fast-xml-parser`.
- `package.json` lists `"author": "Allon Mureinik"` and a `"repository"` pointing at `https://github.com/mureinik/cwe-visualizer.git`.
- Every commit message in this repo ends with only `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` — never add a `Claude-Session:` line.
- Commit messages follow **Conventional Commits**: `<type>(<optional scope>): <description>`, using `feat`, `fix`, `chore`, `docs`, `ci`, or `test` as the type. The exact subject line given in each task's "Commit" step is already in this format and must be used verbatim; any commit not dictated verbatim by a task (e.g. a fix-round commit made in response to review findings) must still follow this format — pick the type that matches what actually changed (`fix` for a review-driven correction, `test` for a test-only addition, etc.).
- **All 16 tasks execute on the `feat/cwe-visualizer` branch, in the git worktree at `.worktrees/feat-cwe-visualizer`** — not on `main`. This supersedes the plan's original "Tasks 1–15 commit directly to main" bootstrap assumption (ruled by the user during execution setup, 2026-08-24). The branch merges into `main` only at the end, via `superpowers:finishing-a-development-branch`. This changes Task 16's Step 4 (which read "commit and push to main directly" — it now just commits to the branch like every other task) and pushes Task 16's Steps 5–8 (Vercel project creation, the `DEPLOYED_SITE_URL`/`VERCEL_DEPLOY_HOOK_URL` repo variable/secret, branch protection, and the live workflow-dispatch check) to run **after** the branch has merged into `main` and been pushed — those steps need `main` to actually carry the CI workflow and the deployed site, which only exist once the merge has happened.
- CWE **Categories** and **Views** are out of scope for this plan (spec's Future Work item — file a follow-up issue once Task 16 lands and the repo is protected).
- No automated LLM PR reviewer in this iteration — review is manual.
- ESLint's flat config uses `ecmaVersion: 2025` throughout. `scripts/**/*.ts` and any other Node-only backend code additionally gets `eslint-plugin-n`'s `flat/recommended-module` rules (not applied to `src/**` browser code, which never runs under Node).
- Test files live under `test/`, mirroring the `src/` structure they cover; nothing is co-located under `src/`.
- All test files import Vitest globals explicitly (`import { describe, it, expect } from 'vitest'`) — no reliance on Vitest's `globals: true` config, so ESLint needs no special test-global allowances.

---

## File Structure

```
cwe-visualizer/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── update-data.yml
│   └── ISSUE_TEMPLATE/
│       └── change.md
├── .husky/
│   └── pre-commit
├── public/
│   └── data/                        # gitignored, generated by scripts/prepare-data.ts
├── scripts/
│   └── prepare-data.ts
├── src/
│   ├── components/
│   │   ├── DetailPanel.tsx
│   │   ├── SearchBox.tsx
│   │   └── Tree.tsx
│   ├── lib/
│   │   └── graph.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── test/
│   ├── components/
│   │   ├── DetailPanel.test.tsx
│   │   ├── SearchBox.test.tsx
│   │   └── Tree.test.tsx
│   ├── fixtures/
│   │   └── cwec-sample.xml
│   ├── lib/
│   │   └── graph.test.ts
│   ├── scripts/
│   │   └── prepare-data.test.ts
│   ├── App.test.tsx
│   └── setup.ts
├── .gitignore
├── eslint.config.js
├── index.html
├── LICENSE                          # already exists
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

---

### Task 1: Project init — package.json and .gitignore

**Files:**
- Create: `package.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a `package.json` with `name`, `type: "module"`, `engines.node >= 24`, `author`, `repository`, and an empty `scripts`/`dependencies`/`devDependencies` that every later task adds to. A `.gitignore` covering `node_modules/`, `dist/`, `coverage/`.

- [ ] **Step 1: Create package.json**

Run: `npm init -y`

- [ ] **Step 2: Edit package.json to the project's baseline shape**

Replace the generated content with:

```json
{
  "name": "cwe-visualizer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "A visual explorer for the full CWE (Common Weakness Enumeration) corpus.",
  "author": "Allon Mureinik",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/mureinik/cwe-visualizer.git"
  },
  "engines": {
    "node": ">=24"
  },
  "scripts": {},
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
coverage/
.DS_Store
*.local
```

- [ ] **Step 4: Verify**

Run: `npm install`
Expected: succeeds with no dependencies to install (creates `package-lock.json`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: initialize package.json and .gitignore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Vite + React + TypeScript app shell

**Files:**
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: `package.json` from Task 1.
- Produces: a placeholder `App` component (`export function App()`, default-exported too) rendering an `<h1>CWE Visualizer</h1>` — Task 13 replaces its body but keeps this export shape. `npm run dev` / `npm run build` / `npm run preview` scripts.

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 4: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CWE Visualizer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/index.css**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
}
```

- [ ] **Step 6: Create src/App.tsx (placeholder — Task 13 replaces the body)**

```tsx
export function App() {
  return <h1>CWE Visualizer</h1>;
}

export default App;
```

- [ ] **Step 7: Create src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 8: Add dev/build/preview scripts to package.json**

Edit the `"scripts"` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview"
}
```

- [ ] **Step 9: Verify the app builds and runs**

Run: `npm run build`
Expected: succeeds, produces a `dist/` directory (already gitignored).

Run: `npm run dev -- --port 5173 &` then `curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'`, then kill the dev server.
Expected: output is `<title>CWE Visualizer</title>`.

- [ ] **Step 10: Commit**

```bash
git add index.html tsconfig.json vite.config.ts src package.json
git commit -m "feat: add Vite + React + TypeScript app shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: ESLint configuration

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `npm run lint` — every later task's new files must pass it before being committed (the pre-commit hook in Task 5 enforces this automatically going forward). `scripts/**/*.ts` (created in Task 6) is pre-wired here with `eslint-plugin-n`'s recommended Node rules, ahead of that file existing.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-plugin-n globals
```

- [ ] **Step 2: Create eslint.config.js**

```js
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
```

This exact composition (including `nodePlugin.configs['flat/recommended-module']` merged via `extends` inside a scoped `files` block) was verified directly: built a scratch project with matching files under each glob, confirmed `npx eslint .` exits clean, and confirmed `n/no-missing-import` actually fires on a genuinely broken import in `scripts/**`.

- [ ] **Step 3: Add the lint script to package.json**

```json
"lint": "eslint ."
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: exits 0, no errors, against the current scaffold from Task 2.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore: add ESLint flat config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Vitest + React Testing Library

**Files:**
- Modify: `vite.config.ts`
- Create: `test/setup.ts`
- Create: `test/App.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `App` from `src/App.tsx` (Task 2).
- Produces: `npm test` (`vitest run`) — every later task's test file relies on this command and on `test/setup.ts`'s jest-dom matcher extension being active.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add the test config to vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
```

- [ ] **Step 3: Create test/setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Write the smoke test — test/App.test.tsx**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Add the test script to package.json**

```json
"test": "vitest run"
```

- [ ] **Step 6: Run the test suite and verify it passes**

Run: `npm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts test package.json package-lock.json
git commit -m "chore: add Vitest and React Testing Library

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Husky + lint-staged pre-commit hook

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run lint` (Task 3) and `npm test` (Task 4).
- Produces: a working `git commit` gate. **Every task from Task 6 onward commits through this hook** — no application code is written before this task lands.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D husky lint-staged
```

- [ ] **Step 2: Initialize Husky**

Run: `npx husky init`
Expected: creates `.husky/pre-commit` (containing `npm test`) and adds `"prepare": "husky"` to `package.json`'s `scripts`.

- [ ] **Step 3: Edit .husky/pre-commit to run lint-staged before the full suite**

```
npx lint-staged
npm test
```

- [ ] **Step 4: Add the lint-staged config to package.json**

Add a top-level key:

```json
"lint-staged": {
  "*.{js,jsx,ts,tsx,mjs}": "eslint --fix"
}
```

- [ ] **Step 5: Verify the hook blocks a bad commit**

```bash
cat > src/lint-staged-check.ts <<'EOF'
export function bad() {
  const unused = 1;
  return 2;
}
EOF
git add src/lint-staged-check.ts
git commit -m "test: verify pre-commit hook blocks bad code"
```

Expected: the commit is rejected — `eslint --fix` cannot autofix an unused local variable, so it reports `'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars`, `lint-staged` fails, and the hook exits non-zero with no commit created. (An earlier draft of this step used a merely badly-*formatted* snippet — `eslint --fix` silently reformats that and the commit succeeds, which defeats the point of this check. Verified empirically during Task 5's execution: use a real, non-autofixable lint error like the unused-variable example above.)

- [ ] **Step 6: Remove the throwaway file and unstage**

```bash
rm src/lint-staged-check.ts
git reset
rm /tmp/lint-staged-check.ts
```

- [ ] **Step 7: Verify the hook allows a clean commit**

```bash
git add .husky package.json package-lock.json
git commit -m "chore: add Husky + lint-staged pre-commit hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Expected: `npx lint-staged` and `npm test` both run and pass as part of this commit, and the commit succeeds.

**This is the end of scaffolding.** Every subsequent task's commit is gated by this hook.

---

### Task 6: prepare-data.ts — zip/XML parsing (slow path)

**Files:**
- Create: `scripts/prepare-data.ts`
- Create: `test/fixtures/cwec-sample.xml`
- Create: `test/scripts/prepare-data.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `adm-zip`, `fast-xml-parser`, `@types/node`.
- Produces (named exports from `scripts/prepare-data.ts`, used by Task 7 and by the CLI entrypoint):
  - `interface CweNode { id: string; name: string; abstraction: string; status: string; description: string; url: string }`
  - `interface CweEdge { from: string; to: string; type: string }`
  - `interface CweMeta { cweVersion: string; lastModified: string; generatedAt: string }`
  - `interface CweData { meta: CweMeta; nodes: Record<string, CweNode>; edges: CweEdge[] }`
  - `extractXmlFromZip(buffer: Buffer): string`
  - `parseCatalog(xmlText: string, lastModified: string | null): CweData`
  - `writeOutput(outDir: string, data: CweData): Promise<void>` — writes `cwe.json` (the full `data`) and `meta.json` (`{ meta: data.meta }`) into `outDir`, creating it if needed.

  These interfaces are declared locally in this file rather than imported from `src/lib/graph.ts` (Task 9 defines an identically-shaped set there): the two files run in different environments (a plain Node script vs. a Vite-bundled browser app) and keeping them decoupled avoids any cross-resolution coupling between Node's strict ESM loader and Vite's bundler resolution. They agree by contract — `prepare-data.ts`'s output is exactly `src/lib/graph.ts`'s `CweData` input — not by import.

**Design note — this file is TypeScript, run directly by Node (no build step):** Node 24 has stable, unflagged type-stripping (default since Node 23.6) for erasable TS syntax — interfaces and type annotations, which is all this script uses. Verified directly in this environment: a multi-file `.ts` program with interfaces, `Buffer`/`fs`/`path` types, `async`/`await`, and a real `adm-zip` + `fast-xml-parser` parse ran correctly via plain `node foo.ts`, zero flags, zero transpile step. `tsc --noEmit` (Task 2's `build` script) still type-checks it — `scripts` is added to `tsconfig.json`'s `include` below.

**Design note — description text does not need markup-flattening:** it looked plausible that `<Description>` elements could contain inline XHTML markup requiring flattening (this was the original design here), so before writing this task the real, current CWE catalog (MITRE's `cwec_latest.xml.zip`, v4.20) was downloaded and every one of its 969 `Weakness/Description` elements was checked with an XML parser for child elements. **None had any** — `Weakness/Description` is always plain text. (Inline `<xhtml:p>` markup does appear elsewhere in the catalog — e.g. inside `Mitigation` descriptions — but not in the field this app reads.) So `parseCatalog` below just reads `w.Description` as a string; no separate tag-stripping step.

- [ ] **Step 1: Install dependencies**

```bash
npm install adm-zip fast-xml-parser
npm install -D @types/node
```

- [ ] **Step 2: Add scripts to tsconfig.json's include and add the node types**

Edit `tsconfig.json`'s `compilerOptions.types` and `include`:

```json
"types": ["vite/client", "node"]
```

```json
"include": ["src", "test", "scripts", "vite.config.ts"]
```

- [ ] **Step 3: Create the fixture XML — test/fixtures/cwec-sample.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Weakness_Catalog Name="CWE" Version="4.15" Date="2024-11-19">
  <Weaknesses>
    <Weakness ID="74" Name="Injection" Abstraction="Class" Status="Incomplete">
      <Description>The product constructs all or part of a command using externally-influenced input.</Description>
    </Weakness>
    <Weakness ID="79" Name="Cross-site Scripting" Abstraction="Base" Status="Stable">
      <Description>The product does not neutralize user-controllable input before it is placed in output.</Description>
      <Related_Weaknesses>
        <Related_Weakness Nature="ChildOf" CWE_ID="74" View_ID="1000"/>
        <Related_Weakness Nature="PeerOf" CWE_ID="80" View_ID="1000"/>
      </Related_Weaknesses>
    </Weakness>
    <Weakness ID="80" Name="Improper Neutralization of Script-Related HTML Tags" Abstraction="Base" Status="Stable">
      <Description>The product receives input and neutralizes special characters, but the neutralization is incomplete.</Description>
      <Related_Weaknesses>
        <Related_Weakness Nature="ChildOf" CWE_ID="74" View_ID="1000"/>
        <Related_Weakness Nature="PeerOf" CWE_ID="79" View_ID="1000"/>
      </Related_Weaknesses>
    </Weakness>
    <Weakness ID="89" Name="SQL Injection" Abstraction="Base" Status="Stable">
      <Description>The product constructs SQL commands using externally-influenced input.</Description>
      <Related_Weaknesses>
        <Related_Weakness Nature="ChildOf" CWE_ID="74" View_ID="1000"/>
        <Related_Weakness Nature="CanFollow" CWE_ID="20" View_ID="1000"/>
      </Related_Weaknesses>
    </Weakness>
  </Weaknesses>
</Weakness_Catalog>
```

- [ ] **Step 4: Write the failing tests — test/scripts/prepare-data.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { extractXmlFromZip, parseCatalog, writeOutput, type CweData } from '../../scripts/prepare-data.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_XML = path.join(__dirname, '..', 'fixtures', 'cwec-sample.xml');

describe('extractXmlFromZip', () => {
  it('extracts the XML entry text from a zip buffer', () => {
    const zip = new AdmZip();
    zip.addFile('cwec_latest.xml', readFileSync(FIXTURE_XML));
    const xmlText = extractXmlFromZip(zip.toBuffer());
    expect(xmlText).toContain('<Weakness_Catalog');
  });

  it('throws when the zip has no XML entry', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('no xml here'));
    expect(() => extractXmlFromZip(zip.toBuffer())).toThrow(/No XML entry/);
  });
});

describe('parseCatalog', () => {
  const xmlText = readFileSync(FIXTURE_XML, 'utf-8');
  const data = parseCatalog(xmlText, '"abc123"');

  it('extracts catalog metadata', () => {
    expect(data.meta.cweVersion).toBe('4.15');
    expect(data.meta.lastModified).toBe('"abc123"');
    expect(data.meta.generatedAt).toEqual(expect.any(String));
  });

  it('parses every weakness into a node', () => {
    expect(Object.keys(data.nodes).sort()).toEqual(['74', '79', '80', '89']);
    expect(data.nodes['79']).toMatchObject({
      id: '79',
      name: 'Cross-site Scripting',
      abstraction: 'Base',
      status: 'Stable',
      description: 'The product does not neutralize user-controllable input before it is placed in output.',
      url: 'https://cwe.mitre.org/data/definitions/79.html',
    });
  });

  it('builds an edge per Related_Weakness with its nature as the type', () => {
    const edgesFrom79 = data.edges.filter((e) => e.from === '79');
    expect(edgesFrom79).toEqual([
      { from: '79', to: '74', type: 'ChildOf' },
      { from: '79', to: '80', type: 'PeerOf' },
    ]);
  });

  it('has no edges for a weakness with no Related_Weaknesses element', () => {
    expect(data.edges.filter((e) => e.from === '74')).toEqual([]);
  });

  it('throws on a catalog missing the expected root element', () => {
    expect(() => parseCatalog('<NotACatalog/>', '"x"')).toThrow(/Unexpected CWE catalog format/);
  });
});

describe('writeOutput', () => {
  it('writes cwe.json and meta.json to the output directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
    try {
      const data: CweData = {
        meta: { cweVersion: '4.15', lastModified: '"abc"', generatedAt: '2026-01-01T00:00:00.000Z' },
        nodes: {},
        edges: [],
      };
      await writeOutput(dir, data);
      const cweJson = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8'));
      const metaJson = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf-8'));
      expect(cweJson).toEqual(data);
      expect(metaJson).toEqual({ meta: data.meta });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: FAIL — `scripts/prepare-data.ts` does not exist yet.

- [ ] **Step 6: Implement scripts/prepare-data.ts**

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export interface CweNode {
  id: string;
  name: string;
  abstraction: string;
  status: string;
  description: string;
  url: string;
}

export interface CweEdge {
  from: string;
  to: string;
  type: string;
}

export interface CweMeta {
  cweVersion: string;
  lastModified: string;
  generatedAt: string;
}

export interface CweData {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  edges: CweEdge[];
}

interface RawRelatedWeakness {
  '@_Nature': string;
  '@_CWE_ID': string | number;
}

interface RawWeakness {
  '@_ID': string | number;
  '@_Name'?: string;
  '@_Abstraction'?: string;
  '@_Status'?: string;
  Description?: unknown;
  Related_Weaknesses?: { Related_Weakness?: RawRelatedWeakness | RawRelatedWeakness[] };
}

export function extractXmlFromZip(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (entries.length === 0) {
    throw new Error('No XML entry found in CWE zip archive');
  }
  return entries[0].getData().toString('utf-8');
}

export function parseCatalog(xmlText: string, lastModified: string | null): CweData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xmlText);
  const catalog = doc.Weakness_Catalog;
  if (!catalog || !catalog['@_Version']) {
    throw new Error('Unexpected CWE catalog format: missing Weakness_Catalog/Version');
  }

  const rawWeaknesses: RawWeakness | RawWeakness[] | undefined = catalog.Weaknesses?.Weakness;
  const weaknessList = Array.isArray(rawWeaknesses) ? rawWeaknesses : rawWeaknesses ? [rawWeaknesses] : [];

  const nodes: Record<string, CweNode> = {};
  const edges: CweEdge[] = [];

  for (const w of weaknessList) {
    const id = String(w['@_ID']);
    nodes[id] = {
      id,
      name: w['@_Name'] ?? '',
      abstraction: w['@_Abstraction'] ?? '',
      status: w['@_Status'] ?? '',
      description: typeof w.Description === 'string' ? w.Description.trim() : '',
      url: `https://cwe.mitre.org/data/definitions/${id}.html`,
    };

    const rawRelated = w.Related_Weaknesses?.Related_Weakness;
    const relatedList = Array.isArray(rawRelated) ? rawRelated : rawRelated ? [rawRelated] : [];
    for (const rel of relatedList) {
      edges.push({
        from: id,
        to: String(rel['@_CWE_ID']),
        type: rel['@_Nature'],
      });
    }
  }

  return {
    meta: {
      cweVersion: String(catalog['@_Version']),
      lastModified: lastModified ?? '',
      generatedAt: new Date().toISOString(),
    },
    nodes,
    edges,
  };
}

export async function writeOutput(outDir: string, data: CweData): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'cwe.json'), JSON.stringify(data, null, 2));
  await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify({ meta: data.meta }, null, 2));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 8: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 9: Commit**

```bash
git add scripts/prepare-data.ts test/fixtures/cwec-sample.xml test/scripts/prepare-data.test.ts package.json package-lock.json tsconfig.json
git commit -m "feat: parse MITRE's CWE catalog into a normalized JSON graph

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: prepare-data.ts — fast path and error handling

**Files:**
- Modify: `scripts/prepare-data.ts`
- Modify: `test/scripts/prepare-data.test.ts`

**Interfaces:**
- Consumes: `extractXmlFromZip`, `parseCatalog`, `writeOutput`, `CweData`, `CweMeta` from Task 6.
- Produces: `readLocalMeta(outDir: string): Promise<CweMeta | null>` and `run(options?: { sourceUrl?: string, outDir?: string, fetchImpl?: typeof fetch }): Promise<{ updated: boolean, meta: CweMeta }>` — the orchestrator the CLI entrypoint calls, and what Task 8 wires into `npm run prepare-data`.

- [ ] **Step 1: Write the failing tests — append to test/scripts/prepare-data.test.ts**

First, change the two import lines at the top of the file:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

and

```ts
import { extractXmlFromZip, parseCatalog, writeOutput, run, type CweData } from '../../scripts/prepare-data.ts';
```

Then append this block at the end of the file:

```ts
function zipBuffer() {
  const zip = new AdmZip();
  zip.addFile('cwec_latest.xml', readFileSync(FIXTURE_XML));
  return zip.toBuffer();
}

function fakeFetch({ lastModified = '"v1"' }: { lastModified?: string } = {}) {
  return vi.fn(async (_url: string, options?: { method?: string }) => {
    if (options?.method === 'HEAD') {
      return { ok: true, status: 200, headers: { get: (name: string) => (name === 'last-modified' ? lastModified : null) } };
    }
    return { ok: true, status: 200, arrayBuffer: async () => zipBuffer().buffer };
  });
}

describe('run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads and writes data on a fresh run with no cache', async () => {
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('"v1"');
    const cweJson = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8'));
    expect(Object.keys(cweJson.nodes)).toContain('79');
  });

  it('skips the download when the cached last-modified value matches', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const fetchSpy = fakeFetch({ lastModified: '"v1"' });
    const result = await run({ outDir: dir, fetchImpl: fetchSpy as unknown as typeof fetch });
    expect(result.updated).toBe(false);
    const getCalls = fetchSpy.mock.calls.filter(([, options]) => options?.method !== 'HEAD');
    expect(getCalls).toHaveLength(0);
  });

  it('re-downloads when the last-modified value has changed', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v2"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('"v2"');
  });

  it('reuses cached data when the source is unreachable and a cache exists', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const failingFetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await run({ outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch });
    expect(result.updated).toBe(false);
    expect(result.meta.lastModified).toBe('"v1"');
  });

  it('throws when the source is unreachable and there is no cache', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('network down');
    });
    await expect(
      run({ outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch })
    ).rejects.toThrow(/no cached data/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: FAIL — `run` is not exported yet.

- [ ] **Step 3: Implement readLocalMeta and run — append to scripts/prepare-data.ts**

```ts
const SOURCE_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

export async function readLocalMeta(outDir: string): Promise<CweMeta | null> {
  try {
    const raw = await fs.readFile(path.join(outDir, 'meta.json'), 'utf-8');
    return (JSON.parse(raw) as { meta: CweMeta }).meta;
  } catch {
    return null;
  }
}

interface RunOptions {
  sourceUrl?: string;
  outDir?: string;
  fetchImpl?: typeof fetch;
}

export async function run({
  sourceUrl = SOURCE_URL,
  outDir = path.join(process.cwd(), 'public', 'data'),
  fetchImpl = fetch,
}: RunOptions = {}): Promise<{ updated: boolean; meta: CweMeta }> {
  const localMeta = await readLocalMeta(outDir);

  let currentLastModified: string | null;
  try {
    const headResponse = await fetchImpl(sourceUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      throw new Error(`HTTP ${headResponse.status}`);
    }
    currentLastModified = headResponse.headers.get('last-modified');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (localMeta) {
      console.warn(`Could not reach CWE source (${message}); reusing cached data from ${localMeta.generatedAt}.`);
      return { updated: false, meta: localMeta };
    }
    throw new Error(`Could not reach CWE source and no cached data exists: ${message}`, { cause: err });
  }

  if (localMeta && currentLastModified && localMeta.lastModified === currentLastModified) {
    console.log(`CWE data already up to date (last-modified ${currentLastModified}). Skipping download.`);
    return { updated: false, meta: localMeta };
  }

  const getResponse = await fetchImpl(sourceUrl);
  if (!getResponse.ok) {
    throw new Error(`Failed to download CWE data (HTTP ${getResponse.status}): ${sourceUrl}`);
  }
  const zipBuffer = Buffer.from(await getResponse.arrayBuffer());
  const xmlText = extractXmlFromZip(zipBuffer);
  const data = parseCatalog(xmlText, currentLastModified ?? '');

  await writeOutput(outDir, data);
  console.log(`CWE data updated to version ${data.meta.cweVersion} (last-modified ${currentLastModified}).`);
  return { updated: true, meta: data.meta };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
```

This differs from a first-draft version in four small ways, all verified during real execution against this repo's actual tooling: `currentLastModified` has no initializer (`no-useless-assignment` — TypeScript's control-flow analysis still proves it's assigned by the time it's read, since every `catch` path returns or throws first); the "no cached data" error attaches `{ cause: err }` (`preserve-caught-error`); the CLI entrypoint sets `process.exitCode = 1` instead of calling `process.exit(1)` (`n/no-process-exit` — equivalent here, since nothing else is pending on the event loop); and the freshness check reads the `Last-Modified` response header instead of `ETag` — MITRE's zip download sends no `ETag` header at all (verified directly against the live endpoint during Task 8), only `Last-Modified`, which is why `CweMeta`'s field is `lastModified`, not `etag`, throughout this plan.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: PASS, all tests green (13 tests total across the file: 8 from Task 6 plus 5 new `run` tests).

- [ ] **Step 5: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/prepare-data.ts test/scripts/prepare-data.test.ts
git commit -m "feat: add fast-path etag check and offline fallback to prepare-data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the data pipeline into npm scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `run()` default export behavior from Task 7 (CLI entrypoint already calls it with defaults — `outDir` defaults to `public/data`).
- Produces: `npm run prepare-data`, and `predev`/`prebuild` npm lifecycle hooks that Vite's `dev`/`build` now trigger automatically.

- [ ] **Step 1: Add scripts to package.json**

```json
"prepare-data": "node scripts/prepare-data.ts",
"predev": "npm run prepare-data",
"prebuild": "npm run prepare-data"
```

- [ ] **Step 2: Gitignore the generated data directory**

Append to `.gitignore`:

```
public/data/
```

- [ ] **Step 3: Manual verification against the real MITRE source**

Run: `npm run prepare-data`
Expected: succeeds, network permitting; prints `CWE data updated to version <X> (last-modified "...").`; creates `public/data/cwe.json` and `public/data/meta.json`.

Run: `node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('public/data/cwe.json')).nodes).length)"`
Expected: a number in the high hundreds to low thousands (the real CWE corpus size) — confirms the end-to-end pipeline works against live data, not just the fixture.

Run: `npm run prepare-data` again immediately.
Expected: prints `CWE data already up to date ... Skipping download.` — confirms the fast path works against a real cached run.

- [ ] **Step 4: Run the full test suite once more**

Run: `npm test && npm run lint`
Expected: both pass (this task changed no application logic, only wiring).

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: wire prepare-data into dev/build npm lifecycle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: graph.ts — types, indices, ancestors, search

**Files:**
- Create: `src/lib/graph.ts`
- Create: `test/lib/graph.test.ts`

**Interfaces:**
- Consumes: nothing new (defines the shared shape of the JSON `prepare-data.ts` produces).
- Produces (consumed by Tasks 10–13):
  - `interface CweNode { id: string; name: string; abstraction: string; status: string; description: string; url: string }`
  - `interface CweEdge { from: string; to: string; type: string }`
  - `interface CweMeta { cweVersion: string; lastModified: string; generatedAt: string }`
  - `interface CweData { meta: CweMeta; nodes: Record<string, CweNode>; edges: CweEdge[] }`
  - `interface Graph { meta: CweMeta; nodes: Record<string, CweNode>; childrenOf: Map<string, string[]>; parentsOf: Map<string, string[]>; relatedTo: Map<string, CweEdge[]>; roots: string[]; all: CweNode[] }`
  - `buildGraph(data: CweData): Graph`
  - `ancestorsOf(graph: Graph, id: string): Set<string>`
  - `searchNodes(graph: Graph, query: string): CweNode[]`

- [ ] **Step 1: Write the failing tests — test/lib/graph.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildGraph, ancestorsOf, searchNodes, type CweData } from '../../src/lib/graph';

const sampleData: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'd74', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'd79', url: 'https://cwe.mitre.org/data/definitions/79.html' },
    '80': { id: '80', name: 'Improper Neutralization', abstraction: 'Base', status: 'Stable', description: 'd80', url: 'https://cwe.mitre.org/data/definitions/80.html' },
    '89': { id: '89', name: 'SQL Injection', abstraction: 'Base', status: 'Stable', description: 'd89', url: 'https://cwe.mitre.org/data/definitions/89.html' },
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '79', to: '80', type: 'PeerOf' },
    { from: '80', to: '74', type: 'ChildOf' },
    { from: '89', to: '74', type: 'ChildOf' },
    { from: '89', to: '20', type: 'CanFollow' },
  ],
};

describe('buildGraph', () => {
  const graph = buildGraph(sampleData);

  it('indexes children under their ChildOf parent', () => {
    expect(graph.childrenOf.get('74')?.slice().sort()).toEqual(['79', '80', '89']);
  });

  it('treats nodes with no parent edge as roots', () => {
    expect(graph.roots).toEqual(['74']);
  });

  it('groups non-hierarchy edges under relatedTo', () => {
    expect(graph.relatedTo.get('79')).toEqual([{ from: '79', to: '80', type: 'PeerOf' }]);
    expect(graph.relatedTo.get('89')).toEqual([{ from: '89', to: '20', type: 'CanFollow' }]);
  });

  it('does not put ChildOf edges in relatedTo', () => {
    expect(graph.relatedTo.get('80')).toEqual([]);
  });
});

describe('buildGraph ParentOf direction', () => {
  it('treats a ParentOf edge as establishing the same child relationship as ChildOf', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [{ from: '1', to: '2', type: 'ParentOf' }],
    };
    const graph = buildGraph(data);
    expect(graph.childrenOf.get('1')).toEqual(['2']);
    expect(graph.roots).toEqual(['1']);
  });
});

describe('ancestorsOf', () => {
  const graph = buildGraph(sampleData);

  it('returns every ancestor up to the root', () => {
    expect(ancestorsOf(graph, '79')).toEqual(new Set(['74']));
  });

  it('returns an empty set for a root node', () => {
    expect(ancestorsOf(graph, '74')).toEqual(new Set());
  });
});

describe('searchNodes', () => {
  const graph = buildGraph(sampleData);

  it('matches by id substring', () => {
    expect(searchNodes(graph, '89').map((n) => n.id)).toEqual(['89']);
  });

  it('matches by name substring, case-insensitively', () => {
    expect(searchNodes(graph, 'injection').map((n) => n.id).sort()).toEqual(['74', '89']);
  });

  it('returns an empty array for a blank query', () => {
    expect(searchNodes(graph, '   ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/lib/graph.test.ts`
Expected: FAIL — `src/lib/graph.ts` does not exist yet.

- [ ] **Step 3: Implement src/lib/graph.ts**

```ts
export interface CweNode {
  id: string;
  name: string;
  abstraction: string;
  status: string;
  description: string;
  url: string;
}

export interface CweEdge {
  from: string;
  to: string;
  type: string;
}

export interface CweMeta {
  cweVersion: string;
  lastModified: string;
  generatedAt: string;
}

export interface CweData {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  edges: CweEdge[];
}

export interface Graph {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  relatedTo: Map<string, CweEdge[]>;
  roots: string[];
  all: CweNode[];
}

function addUnique(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) {
    list.push(value);
  }
}

export function buildGraph(data: CweData): Graph {
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const relatedTo = new Map<string, CweEdge[]>();

  for (const id of Object.keys(data.nodes)) {
    childrenOf.set(id, []);
    parentsOf.set(id, []);
    relatedTo.set(id, []);
  }

  for (const edge of data.edges) {
    if (edge.type === 'ChildOf') {
      addUnique(childrenOf, edge.to, edge.from);
      addUnique(parentsOf, edge.from, edge.to);
    } else if (edge.type === 'ParentOf') {
      addUnique(childrenOf, edge.from, edge.to);
      addUnique(parentsOf, edge.to, edge.from);
    } else {
      relatedTo.get(edge.from)?.push(edge);
    }
  }

  const roots = Object.keys(data.nodes)
    .filter((id) => (parentsOf.get(id) ?? []).length === 0)
    .sort((a, b) => Number(a) - Number(b));

  const all = Object.values(data.nodes).sort((a, b) => Number(a.id) - Number(b.id));

  return { meta: data.meta, nodes: data.nodes, childrenOf, parentsOf, relatedTo, roots, all };
}

export function ancestorsOf(graph: Graph, id: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...(graph.parentsOf.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (ancestors.has(next)) continue;
    ancestors.add(next);
    queue.push(...(graph.parentsOf.get(next) ?? []));
  }
  return ancestors;
}

export function searchNodes(graph: Graph, query: string): CweNode[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [];
  return graph.all.filter(
    (node) => node.id.includes(trimmed) || node.name.toLowerCase().includes(trimmed)
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/lib/graph.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/graph.ts test/lib/graph.test.ts
git commit -m "feat: build parent/child indices and search over the CWE graph

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Tree.tsx

**Files:**
- Create: `src/components/Tree.tsx`
- Create: `test/components/Tree.test.tsx`

**Interfaces:**
- Consumes: `Graph`, `ancestorsOf` from `src/lib/graph.ts` (Task 9).
- Produces: `Tree({ graph: Graph; selectedId: string | null; onSelect: (id: string) => void }): JSX.Element` — used by Task 13's `App.tsx`.

- [ ] **Step 1: Write the failing tests — test/components/Tree.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from '../../src/components/Tree';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: '', url: '' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [{ from: '79', to: '74', type: 'ChildOf' }],
};

describe('Tree', () => {
  it('renders root nodes, collapsed by default', () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('CWE-74: Injection')).toBeInTheDocument();
    expect(screen.queryByText('CWE-79: Cross-site Scripting')).not.toBeInTheDocument();
  });

  it('expands to reveal children when the toggle is clicked', async () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
  });

  it('calls onSelect with the node id when a label is clicked', async () => {
    const graph = buildGraph(data);
    const onSelect = vi.fn();
    render(<Tree graph={graph} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('CWE-74: Injection'));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('auto-expands ancestors of the selected node', () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/Tree.test.tsx`
Expected: FAIL — `src/components/Tree.tsx` does not exist yet.

- [ ] **Step 3: Implement src/components/Tree.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Graph } from '../lib/graph';
import { ancestorsOf } from '../lib/graph';

interface TreeProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Tree({ graph, selectedId, onSelect }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const ancestor of ancestorsOf(graph, selectedId)) {
        next.add(ancestor);
      }
      return next;
    });
  }, [graph, selectedId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ul className="tree" role="tree">
      {graph.roots.map((id) => (
        <TreeNode
          key={id}
          id={id}
          graph={graph}
          expanded={expanded}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={onSelect}
          ancestry={new Set()}
        />
      ))}
    </ul>
  );
}

interface TreeNodeProps {
  id: string;
  graph: Graph;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  ancestry: Set<string>;
}

function TreeNode({ id, graph, expanded, selectedId, onToggle, onSelect, ancestry }: TreeNodeProps) {
  // Defends against a cycle in the source data (should not happen with real
  // CWE data, but a malformed Related_Weaknesses entry could otherwise
  // recurse forever).
  if (ancestry.has(id)) {
    return null;
  }

  const node = graph.nodes[id];
  const children = graph.childrenOf.get(id) ?? [];
  const isExpanded = expanded.has(id);
  const isSelected = selectedId === id;
  const childAncestry = new Set(ancestry);
  childAncestry.add(id);

  return (
    <li role="treeitem" aria-expanded={children.length > 0 ? isExpanded : undefined}>
      <div className={`tree-row${isSelected ? ' tree-row--selected' : ''}`}>
        {children.length > 0 ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => onToggle(id)}
            aria-label={isExpanded ? `Collapse CWE-${id}` : `Expand CWE-${id}`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button type="button" className="tree-label" onClick={() => onSelect(id)}>
          CWE-{id}: {node.name}
        </button>
      </div>
      {isExpanded && children.length > 0 && (
        <ul role="group">
          {children.map((childId) => (
            <TreeNode
              key={childId}
              id={childId}
              graph={graph}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              ancestry={childAncestry}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/components/Tree.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Tree.tsx test/components/Tree.test.tsx
git commit -m "feat: add collapsible Tree component with auto-expand to selection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: SearchBox.tsx

**Files:**
- Create: `src/components/SearchBox.tsx`
- Create: `test/components/SearchBox.test.tsx`

**Interfaces:**
- Consumes: `Graph`, `searchNodes` from `src/lib/graph.ts` (Task 9).
- Produces: `SearchBox({ graph: Graph; onSelect: (id: string) => void }): JSX.Element` — used by Task 13's `App.tsx`.

- [ ] **Step 1: Write the failing tests — test/components/SearchBox.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../../src/components/SearchBox';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '89': { id: '89', name: 'SQL Injection', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [],
};

describe('SearchBox', () => {
  it('shows no results list before typing', () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists matching nodes as the user types', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'injection');
    expect(screen.getByText('CWE-89: SQL Injection')).toBeInTheDocument();
  });

  it('shows a no-matches message for an unmatched query', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('calls onSelect and clears the query when a result is picked', async () => {
    const graph = buildGraph(data);
    const onSelect = vi.fn();
    render(<SearchBox graph={graph} onSelect={onSelect} />);
    const input = screen.getByLabelText('Search CWEs');
    await userEvent.type(input, 'SQL');
    await userEvent.click(screen.getByText('CWE-89: SQL Injection'));
    expect(onSelect).toHaveBeenCalledWith('89');
    expect(input).toHaveValue('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/SearchBox.test.tsx`
Expected: FAIL — `src/components/SearchBox.tsx` does not exist yet.

- [ ] **Step 3: Implement src/components/SearchBox.tsx**

```tsx
import { useState } from 'react';
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/graph';

interface SearchBoxProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

export function SearchBox({ graph, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const results = searchNodes(graph, query).slice(0, 20);

  return (
    <div className="search-box">
      <input
        type="search"
        placeholder="Search CWEs by ID or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search CWEs"
      />
      {query.trim() !== '' && (
        <ul className="search-results">
          {results.length === 0 ? (
            <li className="search-results__empty">No matches</li>
          ) : (
            results.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(node.id);
                    setQuery('');
                  }}
                >
                  CWE-{node.id}: {node.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/components/SearchBox.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchBox.tsx test/components/SearchBox.test.tsx
git commit -m "feat: add SearchBox component for jumping to a CWE by id or name

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: DetailPanel.tsx

**Files:**
- Create: `src/components/DetailPanel.tsx`
- Create: `test/components/DetailPanel.test.tsx`

**Interfaces:**
- Consumes: `Graph` from `src/lib/graph.ts` (Task 9).
- Produces: `DetailPanel({ graph: Graph; selectedId: string | null; onSelect: (id: string) => void }): JSX.Element` — used by Task 13's `App.tsx`.

- [ ] **Step 1: Write the failing tests — test/components/DetailPanel.test.tsx**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html' },
  },
  edges: [{ from: '79', to: '74', type: 'ChildOf' }],
};

describe('DetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Select a CWE to see its details.')).toBeInTheDocument();
  });

  it("renders the selected node's name, description and metadata", () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
    expect(screen.getByText('XSS description')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });

  it('does not render a related-weaknesses section for a node with none', () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId="74" onSelect={() => {}} />);
    expect(screen.queryByText('Related weaknesses')).not.toBeInTheDocument();
  });

  it('lists non-hierarchy relationships and jumps selection on click', async () => {
    const extended: CweData = {
      ...data,
      edges: [...data.edges, { from: '79', to: '80', type: 'PeerOf' }],
      nodes: {
        ...data.nodes,
        '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
      },
    };
    const graph = buildGraph(extended);
    const onSelect = vi.fn();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={onSelect} />);
    expect(screen.getByText('PeerOf')).toBeInTheDocument();
    await userEvent.click(screen.getByText('CWE-80: HTML Tag Neutralization'));
    expect(onSelect).toHaveBeenCalledWith('80');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/DetailPanel.test.tsx`
Expected: FAIL — `src/components/DetailPanel.tsx` does not exist yet.

- [ ] **Step 3: Implement src/components/DetailPanel.tsx**

```tsx
import type { Graph } from '../lib/graph';

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DetailPanel({ graph, selectedId, onSelect }: DetailPanelProps) {
  if (!selectedId) {
    return <div className="detail-panel detail-panel--empty">Select a CWE to see its details.</div>;
  }

  const node = graph.nodes[selectedId];
  if (!node) {
    return <div className="detail-panel detail-panel--empty">CWE-{selectedId} was not found.</div>;
  }

  const related = graph.relatedTo.get(selectedId) ?? [];

  return (
    <div className="detail-panel">
      <h2>
        CWE-{node.id}: {node.name}
      </h2>
      <dl>
        <dt>Abstraction</dt>
        <dd>{node.abstraction}</dd>
        <dt>Status</dt>
        <dd>{node.status}</dd>
      </dl>
      <p>{node.description}</p>
      <a href={node.url} target="_blank" rel="noreferrer">
        View on cwe.mitre.org
      </a>
      {related.length > 0 && (
        <>
          <h3>Related weaknesses</h3>
          <ul className="related-list">
            {related.map((edge) => (
              <li key={`${edge.type}-${edge.to}`}>
                <span className="related-list__type">{edge.type}</span>{' '}
                <button type="button" onClick={() => onSelect(edge.to)}>
                  CWE-{edge.to}
                  {graph.nodes[edge.to] ? `: ${graph.nodes[edge.to].name}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/components/DetailPanel.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and full suite**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailPanel.tsx test/components/DetailPanel.test.tsx
git commit -m "feat: add DetailPanel component for node metadata and non-hierarchy relations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: App.tsx — data loading, URL state, integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `test/App.test.tsx`

**Interfaces:**
- Consumes: `buildGraph`, `Graph`, `CweData` (Task 9); `Tree` (Task 10); `SearchBox` (Task 11); `DetailPanel` (Task 12).
- Produces: the assembled page; fetches `/data/cwe.json` at runtime (the static file `prepare-data.ts` wrote into `public/data/cwe.json`, served by Vite/Vercel from `public/` at the site root).

- [ ] **Step 1: Replace the failing tests — test/App.test.tsx**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App';

const sampleData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'd', url: '' },
  },
  edges: [],
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => sampleData }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state before data arrives', () => {
    render(<App />);
    expect(screen.getByText('Loading CWE data…')).toBeInTheDocument();
  });

  it('renders the header and tree once data has loaded', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('CWE-74: Injection')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Failed to load CWE data/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/App.test.tsx`
Expected: FAIL — the current `App.tsx` placeholder has no loading/error/data states.

- [ ] **Step 3: Implement src/App.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { buildGraph, type CweData, type Graph } from './lib/graph';
import { Tree } from './components/Tree';
import { SearchBox } from './components/SearchBox';
import { DetailPanel } from './components/DetailPanel';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

function readSelectedIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('cwe');
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl());

  useEffect(() => {
    let cancelled = false;
    fetch('/data/cwe.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CweData>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', graph: buildGraph(data) });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('cwe', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  if (state.status === 'loading') {
    return <div className="app-status">Loading CWE data…</div>;
  }
  if (state.status === 'error') {
    return <div className="app-status app-status--error">Failed to load CWE data: {state.message}</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CWE Visualizer</h1>
        <SearchBox graph={state.graph} onSelect={selectNode} />
      </header>
      <main className="app-main">
        <Tree graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
        <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/App.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint, full suite, and a real build**

Run: `npm run lint && npm test && npm run build`
Expected: all three pass (the build step runs `prebuild` → `prepare-data`, so it needs network access to MITRE, same as Task 8's manual check).

- [ ] **Step 6: Manual end-to-end check**

Run: `npm run preview -- --port 4173 &`, then `curl -s http://localhost:4173/data/meta.json`, then kill the preview server.
Expected: valid JSON with a `meta.lastModified` field — confirms `public/data/meta.json` is served at the path the update-data workflow (Task 15) will check.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx test/App.test.tsx
git commit -m "feat: wire App to fetch CWE data and sync selection to the URL

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: CI workflow (ci.yml)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint`, `npm test`, `npm run build` (all now real, from Tasks 3/4/13).
- Produces: a required status check named `build` — Task 16's branch protection rule references this exact job id.

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Validate the YAML syntax locally**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"`
Expected: prints `valid`. (There is no meaningful way to execute a GitHub Actions workflow locally without `act`; this workflow's real exercise happens on the first PR opened against the repo, once Task 16 makes PRs mandatory.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint/test/build workflow for pull requests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Update-data workflow (update-data.yml)

**Files:**
- Create: `.github/workflows/update-data.yml`

**Interfaces:**
- Consumes: MITRE's zip URL (`https://cwe.mitre.org/data/xml/cwec_latest.xml.zip`), the deployed site's `/data/meta.json` (written by `prepare-data.ts`'s `writeOutput`, Task 6), a `DEPLOYED_SITE_URL` repository variable and a `VERCEL_DEPLOY_HOOK_URL` repository secret (both created manually in Task 16).
- Produces: a POST to the Vercel deploy hook only when the upstream Last-Modified value and the deployed site's recorded Last-Modified value differ. Never commits or pushes anything.

- [ ] **Step 1: Create .github/workflows/update-data.yml**

```yaml
name: Update CWE Data

on:
  schedule:
    - cron: '17 4 * * *'
  workflow_dispatch:

jobs:
  check-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Compare upstream and deployed CWE data versions
        id: check
        run: |
          set -euo pipefail
          SOURCE_LAST_MODIFIED=$(curl -sI 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip' | tr -d '\r' | grep -i '^last-modified:' | sed -E 's/^[^:]*: *//')
          DEPLOYED_LAST_MODIFIED=$(curl -sf '${{ vars.DEPLOYED_SITE_URL }}/data/meta.json' | jq -r '.meta.lastModified')
          echo "Upstream Last-Modified: $SOURCE_LAST_MODIFIED"
          echo "Deployed Last-Modified: $DEPLOYED_LAST_MODIFIED"
          if [ "$SOURCE_LAST_MODIFIED" = "$DEPLOYED_LAST_MODIFIED" ]; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi
      - name: Trigger Vercel redeploy
        if: steps.check.outputs.changed == 'true'
        run: curl -sf -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

- [ ] **Step 2: Validate the YAML syntax locally**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/update-data.yml')); print('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update-data.yml
git commit -m "ci: add daily CWE data freshness check and deploy-hook trigger

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: Repo governance and deployment setup

**Files:**
- Create: `.github/ISSUE_TEMPLATE/change.md`
- Create: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–15 (this is the final task — it turns the built repo into a governed, deployed project).
- Produces: an issue template; a `README.md`; and (manual, outside git — see Steps 3–6) a live Vercel deployment, a `DEPLOYED_SITE_URL` repo variable, a `VERCEL_DEPLOY_HOOK_URL` repo secret, and branch protection on `main`.

- [ ] **Step 1: Create .github/ISSUE_TEMPLATE/change.md**

```markdown
---
name: Change request
about: Propose a change to the CWE Visualizer
title: ""
labels: []
---

## What

What should change?

## Why

Why is this needed? What problem does it solve, or what does it improve?

## Notes

Anything else relevant: related issues, screenshots, links.
```

- [ ] **Step 2: Create README.md**

```markdown
# CWE Visualizer

A visual explorer for the full [CWE](https://cwe.mitre.org/) (Common Weakness
Enumeration) corpus published by MITRE.

The design rationale lives in
[`docs/superpowers/specs/2026-08-23-cwe-visualizer-design.md`](docs/superpowers/specs/2026-08-23-cwe-visualizer-design.md).

## Running locally

```bash
npm install
npm run dev
```

`predev` downloads and parses the current CWE data into `public/data/`
before Vite starts (fast-pathing on repeat runs if the data hasn't changed
upstream). The app itself only ever reads that prebuilt JSON — it never
talks to MITRE at runtime.

## Scripts

- `npm run dev` — local dev server (Vite)
- `npm run build` — type-check, prepare data, and build for production
- `npm run preview` — serve the production build locally
- `npm run lint` — ESLint
- `npm test` — Vitest

## Contributing

Every change starts as a GitHub issue, then a branch and a PR that
references it (`Closes #N`). CI (lint, test, build) must pass, and the PR
needs a manual review before merge — `main` is a protected branch with no
bypass. See the design doc for the full rationale, including why the daily
data-freshness check (`.github/workflows/update-data.yml`) is exempt from
this flow: it never commits or pushes anything, so there's nothing for it
to bypass.
```

- [ ] **Step 4: Commit the tracked files**

```bash
git add .github/ISSUE_TEMPLATE/change.md README.md
git commit -m "docs: add issue template and README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**This is the end of Task 16's implementer work — commit and stop here.** Steps 5–8 below are post-merge, controller-run steps (not part of this task's dispatch): they need `main` to actually carry the merged CI workflow, and they're outward-facing/security-sensitive (a live Vercel deployment, a repo secret, branch protection), so the controller confirms with the user before running them, after `feat/cwe-visualizer` has been merged into `main` via `superpowers:finishing-a-development-branch`.

- [ ] **Step 5 (manual — Vercel dashboard): Create the Vercel project**

1. In the Vercel dashboard, import the `mureinik/cwe-visualizer` GitHub repo as a new project. Vercel auto-detects Vite; no `vercel.json` is needed.
2. Deploy once from `main` and note the resulting production domain (e.g. `https://cwe-visualizer.vercel.app`) — this is the `DEPLOYED_SITE_URL` value used below.
3. In the project's Settings → Git → Deploy Hooks, create a hook named e.g. `update-data` targeting the `main` branch, and copy its URL — this is the `VERCEL_DEPLOY_HOOK_URL` value used below.

- [ ] **Step 6 (manual — requires `gh` authenticated against this repo): Set the repo variable and secret**

```bash
gh variable set DEPLOYED_SITE_URL --body "https://<your-vercel-domain>"
gh secret set VERCEL_DEPLOY_HOOK_URL --body "<paste the deploy hook URL from Step 5.3>"
```

- [ ] **Step 7 (manual — requires `gh` authenticated against this repo): Enable branch protection on main**

```bash
cat > /tmp/branch-protection.json <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF

gh api repos/mureinik/cwe-visualizer/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input /tmp/branch-protection.json

rm /tmp/branch-protection.json
```

Expected: `main` now requires a passing `build` check and at least one approving review before merge, with no admin bypass. **From this point on, every change to this repo — including the CWE Categories/Views follow-up — goes through an issue, a branch, and a reviewed PR.**

- [ ] **Step 8: Verify the daily workflow end-to-end**

Run: `gh workflow run update-data.yml` then, after it completes, `gh run list --workflow=update-data.yml --limit 1`
Expected: the run succeeds; since the just-deployed site's `meta.json` last-modified value matches the upstream last-modified value (Step 5.2 deployed current data), it should log `changed=false` and skip the deploy-hook POST. Check the run's log (`gh run view --log`) to confirm.

---

## Self-Review Notes

- **Spec coverage:** full-corpus graph (Task 6/9), tree-first UI with search (Tasks 10/11), no runtime fetch/parse (Task 13 only fetches the prebuilt JSON), fast-path Last-Modified check (Task 7), zero-commit daily update check (Task 15), issue→PR→CI→review flow with branch protection (Task 16), pre-commit lint+test (Task 5), Categories/Views and automated review explicitly deferred (Global Constraints) — all covered.
- **Placeholder scan:** every step carries real, complete code or an exact command; no "TBD"/"add appropriate handling"/deferred-detail steps remain.
- **Type consistency:** `Graph`, `CweNode`, `CweEdge`, `CweMeta`, `CweData` are defined once in Task 9 (`src/lib/graph.ts`) and referenced identically (same field names and types) by Tasks 10–13. `scripts/prepare-data.ts` (Task 6) independently declares its own `CweNode`/`CweEdge`/`CweMeta`/`CweData` with the same shape — deliberate duplication, not an inconsistency: see Task 6's Interfaces note on why the two aren't imported from one shared file. `run()`'s option names (`sourceUrl`, `outDir`, `fetchImpl`) match between their Task 7 definition and Task 8's usage.
- **Claims checked against real behavior, not assumed**, in this environment, before writing the affected tasks: (1) downloaded MITRE's actual current CWE catalog and confirmed all 969 `Weakness/Description` elements are plain text with no child elements, which is why Task 6 no longer does markup-flattening (an earlier draft of this plan guessed, incorrectly, that it needed to); (2) ran a real multi-file TypeScript program through plain `node file.ts` — interfaces, `Buffer`/`fs`/`path` typings, real `adm-zip` + `fast-xml-parser` parsing — with zero flags and no transpile step, confirming Node 24's type-stripping is safe to build Task 6/7 on; (3) built the exact `eslint.config.js` from Task 3 (all four glob blocks, including `eslint-plugin-n`'s `flat/recommended-module` merged into the `scripts/**` block) against matching dummy files and confirmed `npx eslint .` exits clean and `n/no-missing-import` genuinely fires on a broken import.
