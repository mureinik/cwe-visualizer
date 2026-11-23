// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  KNOWN_LANGUAGES,
  LANGUAGE_CLASSES,
  readLanguages,
} from '../../scripts/languages.ts';

const named = (name: string) => ({ '@_Name': name, '@_Prevalence': 'Often' });
const classed = (cls: string) => ({
  '@_Class': cls,
  '@_Prevalence': 'Undetermined',
});

describe('readLanguages', () => {
  it('matches a language by name and through its classes', () => {
    const { languages } = readLanguages([
      { id: '1', languages: [named('C')] },
      { id: '2', languages: [classed('Memory-Unsafe')] },
      { id: '3', languages: [classed('Interpreted')] },
    ]);
    expect(languages.find((l) => l.name === 'C')).toEqual({
      name: 'C',
      classes: ['Memory-Unsafe', 'Compiled'],
      memberIds: ['1', '2'],
    });
    expect(languages.find((l) => l.name === 'C++')?.memberIds).toEqual(['2']);
    expect(languages.find((l) => l.name === 'Python')?.memberIds).toEqual([
      '3',
    ]);
  });

  it('lists Not Language-Specific weaknesses as agnostic, not as members', () => {
    const result = readLanguages([
      { id: '10', languages: [classed('Not Language-Specific')] },
      { id: '2', languages: [classed('Not Language-Specific')] },
      { id: '3', languages: [named('Java')] },
    ]);
    expect(result.languageAgnosticIds).toEqual(['2', '10']);
    expect(result.languages.flatMap((l) => l.memberIds)).toEqual(['3']);
  });

  it('offers only languages with members, sorted by name, never Other', () => {
    const { languages } = readLanguages([
      { id: '1', languages: [named('Other')] },
      { id: '2', languages: [named('SQL')] },
    ]);
    expect(languages).toEqual([{ name: 'SQL', classes: [], memberIds: ['2'] }]);
  });

  it('sorts names case-insensitively, so Perl comes before PHP', () => {
    const { languages } = readLanguages([
      {
        id: '1',
        languages: [
          named('PHP'),
          named('Perl'),
          named('VHDL'),
          named('Verilog'),
        ],
      },
    ]);
    expect(languages.map((l) => l.name)).toEqual([
      'Perl',
      'PHP',
      'Verilog',
      'VHDL',
    ]);
  });

  it('counts a weakness once per language', () => {
    const { languages } = readLanguages([
      { id: '1', languages: [named('C'), classed('Memory-Unsafe')] },
    ]);
    expect(languages.find((l) => l.name === 'C')?.memberIds).toEqual(['1']);
  });

  it('sorts member ids numerically', () => {
    const { languages } = readLanguages([
      { id: '100', languages: [named('Go')] },
      { id: '9', languages: [named('Go')] },
    ]);
    expect(languages[0].memberIds).toEqual(['9', '100']);
  });

  it('fails on an unknown language name', () => {
    expect(
      () => readLanguages([{ id: '1', languages: [named('Kotlin')] }]),
    ).toThrow(/CWE-1: unknown language "Kotlin"/);
  });

  it('fails on an unknown class', () => {
    expect(
      () => readLanguages([{ id: '1', languages: [classed('Functional')] }]),
    ).toThrow(/CWE-1: unknown language class "Functional"/);
  });

  it('fails on a Language with neither Name nor Class', () => {
    expect(
      () => readLanguages([{ id: '1', languages: [{ '@_Prevalence': 'Often' }] }]),
    ).toThrow(/CWE-1: a Language has no Name or Class/);
  });

  it('maps only to known languages', () => {
    for (const names of Object.values(LANGUAGE_CLASSES)) {
      for (const name of names) {
        expect(KNOWN_LANGUAGES.has(name)).toBe(true);
      }
    }
  });
});
