import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlternateTerms } from '../../src/components/AlternateTerms';
import type { CweAlternateTerm } from '../../src/lib/cwe-data';

const para = (text: string) => ({ kind: 'paragraph' as const, lines: [[{ text }]] });

// CWE-79's first terms, as cwe.json stores them.
const TERMS: CweAlternateTerm[] = [
  { term: 'Cross-site Scripting' },
  { term: 'XSS', description: [para('A common abbreviation/acronym for Cross-Site Scripting.')] },
  { term: 'HTML Injection', description: [para('First paragraph.'), para('Second paragraph.')] },
];

describe('AlternateTerms', () => {
  it('is a closed disclosure counting the terms', () => {
    render(<AlternateTerms terms={TERMS} />);
    const details = screen.getByText('Alternate terms (3)').closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it("lists the terms in MITRE's order", () => {
    const { container } = render(<AlternateTerms terms={TERMS} />);
    const terms = [...container.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(terms).toEqual(['Cross-site Scripting', 'XSS', 'HTML Injection']);
  });

  it('gives a term without a description no dd', () => {
    const { container } = render(<AlternateTerms terms={TERMS} />);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
  });

  it('renders each paragraph of a description', () => {
    render(<AlternateTerms terms={TERMS} />);
    const dd = screen.getByText('First paragraph.').closest('dd') as HTMLElement;
    expect(dd.querySelectorAll('p')).toHaveLength(2);
  });
});
