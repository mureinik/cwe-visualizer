import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Five lines of notice took about 118px of a phone's screen, from a graph
// left too short for its labels (issue #298).
describe('Attribution on a narrow screen', () => {
  const narrow = () =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );

  it('shows one line naming MITRE as the copyright holder', () => {
    narrow();
    render(<Attribution catalogDate="2027-03-04" />);
    const summary = screen.getByText('CWE content © 2006–2027 The MITRE Corporation');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.closest('details')).not.toHaveAttribute('open');
  });

  it('opens to the full notice, links included', async () => {
    narrow();
    render(<Attribution catalogDate="2027-03-04" />);
    await userEvent.click(screen.getByText('CWE content © 2006–2027 The MITRE Corporation'));
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Copyright © 2006–2027, The MITRE Corporation');
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://cwe.mitre.org/about/termsofuse.html');
    expect(screen.getByRole('link', { name: 'cwe.mitre.org' })).toHaveAttribute('href', 'https://cwe.mitre.org/');
  });
});

describe('Attribution on a wide screen', () => {
  it('shows the full notice without a toggle', () => {
    const { container } = render(<Attribution catalogDate="2027-03-04" />);
    expect(container.querySelector('details')).toBeNull();
  });
});
