/**
 * useHydrated: false on the server render, true on the client.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { render, screen, cleanup } from '@testing-library/react';
import { useHydrated } from '@/hooks/useHydrated';

afterEach(cleanup);

function Probe() {
  const hydrated = useHydrated();
  return <span data-testid="h">{String(hydrated)}</span>;
}

describe('useHydrated', () => {
  it('reports false when rendered on the server', () => {
    expect(renderToString(<Probe />)).toContain('false');
  });

  it('reports true on the client', () => {
    render(<Probe />);
    expect(screen.getByTestId('h')).toHaveTextContent('true');
  });
});
