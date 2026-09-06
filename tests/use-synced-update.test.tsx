/**
 * useSyncedUpdate: runs its callback during the render in which the
 * source changes identity, once on mount, and never otherwise.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useSyncedUpdate } from '@/hooks/useSyncedState';

afterEach(cleanup);

function Probe({ source }: { source: string }) {
  const [log, setLog] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  useSyncedUpdate(source, (next, prev) => {
    setLog(l => [...l, `${prev ?? 'init'}->${next}`]);
  });
  return (
    <div>
      <span data-testid="log">{log.join(',')}</span>
      <button onClick={() => setTick(tick + 1)}>rerender {tick}</button>
    </div>
  );
}

describe('useSyncedUpdate', () => {
  it('runs once on mount with an undefined previous value', () => {
    render(<Probe source="a" />);
    expect(screen.getByTestId('log')).toHaveTextContent('init->a');
  });

  it('runs on each source change with the previous source, and not on unrelated renders', () => {
    const { rerender } = render(<Probe source="a" />);
    fireEvent.click(screen.getByRole('button'));
    rerender(<Probe source="a" />);
    expect(screen.getByTestId('log')).toHaveTextContent(/^init->a$/);
    rerender(<Probe source="b" />);
    rerender(<Probe source="c" />);
    expect(screen.getByTestId('log')).toHaveTextContent(/^init->a,a->b,b->c$/);
  });
});
