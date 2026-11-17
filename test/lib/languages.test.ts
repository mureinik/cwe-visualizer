import { describe, it, expect } from 'vitest';
import { languageNote } from '../../src/lib/languages';

const TAIL = " Which languages count as which is our call, not MITRE's.";

describe('languageNote', () => {
  it('names the language and one or two of its classes', () => {
    expect(languageNote({ name: 'C', classes: ['Memory-Unsafe', 'Compiled'], memberIds: [] })).toBe(
      `Weaknesses MITRE ties to C, or to memory-unsafe or compiled languages.${TAIL}`,
    );
  });

  it('joins three classes with commas and a final or', () => {
    expect(
      languageNote({ name: 'C++', classes: ['Memory-Unsafe', 'Compiled', 'Object-Oriented'], memberIds: [] }),
    ).toBe(`Weaknesses MITRE ties to C++, or to memory-unsafe, compiled or object-oriented languages.${TAIL}`);
  });

  it('drops the final word "language" from a class', () => {
    expect(languageNote({ name: 'Verilog', classes: ['Hardware Description Language'], memberIds: [] })).toBe(
      `Weaknesses MITRE ties to Verilog, or to hardware description languages.${TAIL}`,
    );
  });

  it('is only the language when it has no classes', () => {
    expect(languageNote({ name: 'SQL', classes: [], memberIds: [] })).toBe('Weaknesses MITRE ties to SQL.');
  });
});
