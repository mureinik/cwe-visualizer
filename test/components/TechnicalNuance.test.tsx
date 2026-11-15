import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TechnicalNuance } from '../../src/components/TechnicalNuance';
import type { NuanceBlock } from '../../src/lib/cwe-data';

const blocks: NuanceBlock[] = [
  { kind: 'paragraph', lines: [[{ text: 'First ' }, { text: 'bold', bold: true }], [{ text: 'Second line' }]] },
  { kind: 'list', items: [[[{ text: 'one' }]], [[{ text: 'two' }]]] },
];

const disclosure = () => screen.getByText('Technical nuance').closest('details') as HTMLDetailsElement;

describe('TechnicalNuance', () => {
  it('is a closed disclosure titled Technical nuance', () => {
    render(<TechnicalNuance blocks={blocks} />);
    const details = disclosure();
    expect(details).not.toHaveAttribute('open');
    expect(details.querySelector('summary')).toHaveTextContent('Technical nuance');
  });

  it('opens to show paragraphs, lists and bold', async () => {
    const { container } = render(<TechnicalNuance blocks={blocks} />);
    await userEvent.click(screen.getByText('Technical nuance'));
    expect(disclosure()).toHaveAttribute('open');
    expect(container.querySelector('p')).toHaveTextContent('First bold');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
  });

  it('puts each line of a block on its own line', () => {
    const { container } = render(<TechnicalNuance blocks={blocks} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('p .technical-nuance__line')).toHaveLength(2);
  });

  it('shows markup in the text as text', () => {
    const markup = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <TechnicalNuance blocks={[{ kind: 'paragraph', lines: [[{ text: markup }]] }]} />,
    );
    expect(screen.getByText(markup)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
