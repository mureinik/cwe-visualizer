// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readAlternateTerms, readPreviousNames } from '../../scripts/names.ts';

const p = (text: string): string => `<xhtml:p>${text}</xhtml:p>`;

describe('readAlternateTerms', () => {
  it('reads CWE-79-like terms in order', () => {
    const raw = {
      Alternate_Term: [
        { Term: 'XSS', Role: ['Primary', 'Secondary'] },
        { Term: 'HTML Injection', Description: p('Used for stored XSS.') },
        { Term: 'CSS', Description: p('First.') + p('Second.') },
      ],
    };
    const terms = readAlternateTerms(raw, 'CWE-79');
    expect(terms.map((t) => t.term)).toEqual(['XSS', 'HTML Injection', 'CSS']);
    expect(terms[0]).not.toHaveProperty('description');
    expect(terms[1].description).toHaveLength(1);
    expect(terms[2].description).toHaveLength(2);
  });

  it('reads a single term given as an object', () => {
    expect(readAlternateTerms({ Alternate_Term: { Term: 'XSS' } }, 'CWE-79')).toEqual([{ term: 'XSS' }]);
  });

  it('collapses whitespace in a term', () => {
    expect(readAlternateTerms({ Alternate_Term: { Term: '  Cross-site\n\t Scripting ' } }, 'CWE-79')).toEqual([{ term: 'Cross-site Scripting' }]);
  });

  it('gives [] for no Alternate_Terms', () => {
    expect(readAlternateTerms(undefined, 'CWE-79')).toEqual([]);
  });

  it('omits a description that converts to no blocks', () => {
    expect(readAlternateTerms({ Alternate_Term: { Term: 'XSS', Description: '  ' } }, 'CWE-79')).toEqual([{ term: 'XSS' }]);
  });

  // xs:string allows an empty Term, so this is real-world even though no
  // release of 5.0 or 4.21 has one.
  it('rejects an empty Term', () => {
    expect(() => readAlternateTerms({ Alternate_Term: { Term: '' } }, 'CWE-79')).toThrow('CWE-79: empty Alternate_Term');
  });

  // MITRE's schema forbids these.
  describe('input the schema forbids', { tags: ['theoretical'] }, () => {
    it('rejects a missing Term', () => {
      expect(() => readAlternateTerms({ Alternate_Term: { Role: 'Primary' } }, 'CWE-79')).toThrow('CWE-79: Alternate_Term has no Term');
      expect(() => readAlternateTerms({ Alternate_Term: '' }, 'CWE-79')).toThrow('CWE-79: Alternate_Term has no Term');
    });

    it('rejects two Alternate_Terms', () => {
      expect(() => readAlternateTerms([{ Alternate_Term: { Term: 'a' } }, { Alternate_Term: { Term: 'b' } }], 'CWE-79')).toThrow(
        'CWE-79: more than one Alternate_Terms element',
      );
    });

    it('rejects Alternate_Terms without Alternate_Term', () => {
      expect(() => readAlternateTerms({}, 'CWE-79')).toThrow('CWE-79: Alternate_Terms has no Alternate_Term');
      expect(() => readAlternateTerms('', 'CWE-79')).toThrow('CWE-79: Alternate_Terms has no Alternate_Term');
    });
  });
});

describe('readPreviousNames', () => {
  it('reads former names oldest first, without a version', () => {
    const raw = {
      Previous_Entry_Name: [
        { '#text': 'Old Name', '@_Date': '2008-04-11' },
        { '#text': 'Older Name', '@_Date': '2010-06-21', '@_Version': '1.9' },
        { '#text': 'Newer\n Name', '@_Date': '2012-05-11' },
      ],
    };
    expect(readPreviousNames(raw, 'CWE-79')).toEqual([
      { name: 'Old Name', date: '2008-04-11' },
      { name: 'Older Name', date: '2010-06-21' },
      { name: 'Newer Name', date: '2012-05-11' },
    ]);
  });

  it('reads a single name given as an object', () => {
    expect(readPreviousNames({ Previous_Entry_Name: { '#text': 'A', '@_Date': '2008-04-11' } }, 'View 1000')).toEqual([{ name: 'A', date: '2008-04-11' }]);
  });

  it('gives [] without Previous_Entry_Name', () => {
    expect(readPreviousNames({ Submission: {} }, 'CWE-79')).toEqual([]);
    expect(readPreviousNames(undefined, 'CWE-79')).toEqual([]);
  });

  // xs:string and xs:date allow these, so they are real-world although 5.0
  // and 4.21 have none.
  it('rejects an empty name', () => {
    expect(() => readPreviousNames({ Previous_Entry_Name: { '@_Date': '2008-04-11' } }, 'CWE-79')).toThrow('CWE-79: empty Previous_Entry_Name');
  });

  it('rejects a Date with a time zone', () => {
    expect(() => readPreviousNames({ Previous_Entry_Name: { '#text': 'A', '@_Date': '2008-04-11Z' } }, 'View 1000')).toThrow(
      'View 1000: Previous_Entry_Name Date is not YYYY-MM-DD: "2008-04-11Z"',
    );
  });

  // MITRE's schema forbids a missing Date.
  describe('input the schema forbids', { tags: ['theoretical'] }, () => {
    it('rejects a missing Date', () => {
      expect(() => readPreviousNames({ Previous_Entry_Name: { '#text': 'A' } }, 'CWE-79')).toThrow('CWE-79: Previous_Entry_Name has no Date');
      expect(() => readPreviousNames({ Previous_Entry_Name: 'A' }, 'CWE-79')).toThrow('CWE-79: Previous_Entry_Name has no Date');
    });
  });
});
