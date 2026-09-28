// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
  engines: { node: string };
  devDependencies: Record<string, string>;
};

// The Node types must describe the oldest Node the project supports, or
// TypeScript accepts APIs that the minimum version lacks. Dependabot ignores
// @types/node, so this is what keeps the two in step.
describe('Node version pin', () => {
  it('pins @types/node to exactly the engines minimum', () => {
    const minimum = /^>=(\d+)\.(\d+)$/.exec(pkg.engines.node);
    expect(minimum, `engines.node should be ">=MAJOR.MINOR", got "${pkg.engines.node}"`).not.toBeNull();
    const [, major, minor] = minimum ?? [];
    expect(pkg.devDependencies['@types/node']).toBe(`${major}.${minor}.0`);
  });
});
