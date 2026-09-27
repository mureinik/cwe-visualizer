// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';

// Lints snippets against the repo's real eslint.config.js, so this fails if
// the no-runtime-network restriction is ever dropped. The snippets stand in
// for real files because type-aware linting only parses files in tsconfig.
const eslint = new ESLint();

async function restrictedMessages(code: string, filePath = 'src/main.tsx'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  expect(result.messages.filter((m) => m.fatal)).toEqual([]);
  return result.messages
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message);
}

describe('no runtime network access from src/', () => {
  // The first type-aware lint builds the TypeScript program, which can take
  // longer than the default test timeout, especially under coverage.
  beforeAll(async () => {
    await eslint.lintText('', { filePath: 'src/main.tsx' });
  }, 60_000);

  it.each([
    ["fetch('/data/cwe.json');"],
    ["fetch('/data/meta.json').then((r) => r.json());"],
  ])('allows %s', async (code) => {
    expect(await restrictedMessages(code)).toEqual([]);
  });

  it.each([
    ["fetch('https://cwe.mitre.org/data/xml/cwec_latest.xml.zip');"],
    ["fetch('/api/cwe');"],
    ['const url = "/data/cwe.json"; fetch(url);'],
    ['fetch(`/data/${"cwe"}.json`);'],
    ["window.fetch('https://example.com');"],
    ["globalThis.fetch('https://example.com');"],
    ['new XMLHttpRequest();'],
    ["new WebSocket('wss://example.com');"],
    ["new EventSource('https://example.com');"],
    ["navigator.sendBeacon('https://example.com', '');"],
  ])('rejects %s', async (code) => {
    const messages = await restrictedMessages(code);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/never contact MITRE at runtime/);
  });

  it('does not restrict scripts/, which fetches at build time', async () => {
    const messages = await restrictedMessages(
      "await fetch('https://cwe.mitre.org/data/xml/cwec_latest.xml.zip');",
      'scripts/prepare-data.ts'
    );
    expect(messages).toEqual([]);
  });
});
