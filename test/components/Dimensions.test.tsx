import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dimensions } from '../../src/components/Dimensions';
import type { CweDimension } from '../../src/lib/cwe-data';

const d = (type: string, value: string): CweDimension => ({ type, value });

// CWE-1037's dimensions, already in schema order as cwe.json stores them.
const CWE_1037 = [
  d('Behavior-Type', 'Optimization'),
  d('Behavior-Type', 'Removal or Modification'),
  d('Code-Type', 'Code'),
  d('Code-Property', 'Security-critical'),
  d('Technology', 'Processor'),
];

const disclosure = () => screen.getByText('Dimensions').closest('details') as HTMLDetailsElement;

describe('Dimensions', () => {
  it('is a closed disclosure titled Dimensions', () => {
    render(<Dimensions dimensions={CWE_1037} />);
    expect(disclosure()).not.toHaveAttribute('open');
    expect(disclosure().querySelector('summary')).toHaveTextContent('Dimensions');
  });

  it('opens to show the note and one term per type, in order', async () => {
    const { container } = render(<Dimensions dimensions={CWE_1037} />);
    await userEvent.click(screen.getByText('Dimensions'));
    expect(disclosure()).toHaveAttribute('open');
    expect(screen.getByText("The parts MITRE built this weakness's name from.")).toBeInTheDocument();
    const terms = Array.from(container.querySelectorAll('dt'), (dt) => dt.textContent);
    expect(terms).toEqual(['Behavior type', 'Code type', 'Code property', 'Technology']);
  });

  it("joins a type's values with semicolons", async () => {
    render(<Dimensions dimensions={CWE_1037} />);
    await userEvent.click(screen.getByText('Dimensions'));
    const term = screen.getByText('Behavior type');
    expect(term.nextElementSibling).toHaveTextContent('Optimization; Removal or Modification');
  });
});
