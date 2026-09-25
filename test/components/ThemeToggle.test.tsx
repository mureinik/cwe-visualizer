import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { THEME_STORAGE_KEY } from '../../src/lib/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('exposes the theme it will switch to', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('flips the document theme and persists it when clicked', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});

describe('ThemeToggle and the OS preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('writes no data-theme for someone who has never chosen one', () => {
    render(<ThemeToggle />);
    // Writing the attribute is what disables the stylesheet's
    // prefers-color-scheme block, so an untouched app must not write it.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('writes it as soon as a choice is made', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: /Switch to (light|dark) theme/ }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(true);
  });
});
