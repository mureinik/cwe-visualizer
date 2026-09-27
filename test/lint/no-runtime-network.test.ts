// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

// Lints snippets against the repo's real eslint.config.js as if they lived in
// src/, so this fails if the no-runtime-network restriction is ever dropped.
const eslint = new ESLint();

async function restrictedMessages(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'src/probe.ts' });
  return result.messages
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message);
}

describe('no runtime network access from src/', () => {
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
    const [result] = await eslint.lintText(
      "await fetch('https://cwe.mitre.org/data/xml/cwec_latest.xml.zip');",
      { filePath: 'scripts/probe.ts' }
    );
    expect(result.messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toEqual([]);
  });
});
