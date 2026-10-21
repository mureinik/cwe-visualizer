import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Attribution } from '../../src/components/Attribution';

describe('Attribution', () => {
  it("ends MITRE's copyright range at the catalog's release year", () => {
    render(<Attribution catalogDate="2027-03-04" />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Copyright © 2006–2027, The MITRE Corporation');
  });

  it('links to MITRE, its Terms of Use and the authoritative source', () => {
    render(<Attribution catalogDate="2027-03-04" />);
    expect(screen.getByRole('link', { name: 'The MITRE Corporation' })).toHaveAttribute('href', 'https://www.mitre.org/');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://cwe.mitre.org/about/termsofuse.html');
    expect(screen.getByRole('link', { name: 'cwe.mitre.org' })).toHaveAttribute('href', 'https://cwe.mitre.org/');
  });
});
