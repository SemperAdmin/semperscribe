/**
 * ThemeToggle: renders nothing on the server, the toggle on the client.
 * Phase A.2 replaced the mounted-flag effect with useHydrated.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// next-themes reads matchMedia on the client; jsdom has none.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  });
});
afterEach(cleanup);

describe('ThemeToggle', () => {
  it('renders nothing on the server', () => {
    const html = renderToString(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(html).not.toContain('<button');
  });

  it('renders the toggle on the client', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeInTheDocument();
  });
});
