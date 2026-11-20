import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormerNames } from '../../src/components/FormerNames';

describe('FormerNames', () => {
  const names = [
    { name: 'SQL Injection', date: '2008-04-11' },
    { name: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')", date: '2026-10-28' },
  ];

  it('is a closed disclosure counting the names', () => {
    render(<FormerNames names={names} />);
    const details = screen.getByText('Former names (2)').closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it('lists the newest name first, with the date it stopped being used', () => {
    const { container } = render(<FormerNames names={names} />);
    const items = [...container.querySelectorAll('li')];
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Improper Neutralization of Special Elements');
    expect(items[0]).toHaveTextContent('until 2026-10-28');
    expect(items[1]).toHaveTextContent('SQL Injection');
    expect(items[1]).toHaveTextContent('until 2008-04-11');
  });

  it('separates the name from its date in the text', () => {
    const { container } = render(<FormerNames names={names} />);
    expect(container.querySelectorAll('li')[1].textContent).toBe('SQL Injection until 2008-04-11');
  });

  it("reverses MITRE's order on a tie", () => {
    const tied = [
      { name: 'First', date: '2010-06-21' },
      { name: 'Second', date: '2010-06-21' },
    ];
    const { container } = render(<FormerNames names={tied} />);
    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(items[0]).toContain('Second');
    expect(items[1]).toContain('First');
  });
});
