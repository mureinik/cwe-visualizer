// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { engines, devDependencies } from '../package.json' with { type: 'json' };

// The Node types must describe the oldest Node the project supports, or
// TypeScript accepts APIs that the minimum version lacks. Dependabot ignores
// @types/node, so this is what keeps the two in step.
describe('Node version pin', () => {
  it('pins @types/node to exactly the engines minimum', () => {
    const minimum = /^>=(\d+)\.(\d+)$/.exec(engines.node);
    expect(minimum, `engines.node should be ">=MAJOR.MINOR", got "${engines.node}"`).not.toBeNull();
    const [, major, minor] = minimum ?? [];
    expect(devDependencies['@types/node']).toBe(`${major}.${minor}.0`);
  });
});
