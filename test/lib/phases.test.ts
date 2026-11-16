import { describe, it, expect } from 'vitest';
import { phaseKey, phaseLabel } from '../../src/lib/phases';

describe('phaseKey', () => {
  it('is the name for a standard phase', () => {
    expect(phaseKey({ name: 'Implementation' })).toBe('Implementation');
  });

  it('prefixes the domain for a custom phase', () => {
    expect(phaseKey({ name: 'Training', domain: 'AI' })).toBe('AI:Training');
  });
});

describe('phaseLabel', () => {
  it('is the name for a standard phase', () => {
    expect(phaseLabel({ name: 'Implementation' })).toBe('Implementation');
  });

  it('adds the domain in parentheses for a custom phase', () => {
    expect(phaseLabel({ name: 'Training', domain: 'AI' })).toBe('Training (AI)');
  });
});
