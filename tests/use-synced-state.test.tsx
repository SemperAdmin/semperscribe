/**
 * useSyncedState: state which re-derives from a source on identity change
 * and is otherwise freely settable. Pins the semantics the A.1 refactor
 * relies on, including the two differences from the effect it replaces:
 * the derived value is present on the first render, and the
 * re-derivation lands in the same render as the source change.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useSyncedState, anyNonBlank } from '@/hooks/useSyncedState';

afterEach(cleanup);

function Flag({ list, onRender }: { list: string[]; onRender?: () => void }) {
  onRender?.();
  const [show, setShow] = useSyncedState(list, l => anyNonBlank(l));
  return (
    <>
      <span data-testid="show">{String(show)}</span>
      <button type="button" onClick={() => setShow(true)}>force open</button>
    </>
  );
}

function Rows({ lastActive }: { lastActive: number }) {
  const [visible, setVisible] = useSyncedState<number, number>(lastActive, (la, prev) => Math.max(prev ?? 1, la + 1, 1));
  return (
    <>
      <span data-testid="visible">{visible}</span>
      <button type="button" onClick={() => setVisible(v => v + 1)}>add row</button>
    </>
  );
}

describe('useSyncedState', () => {
  it('derives on the first render, with no second commit', () => {
    let renders = 0;
    render(<Flag list={['text']} onRender={() => { renders += 1; }} />);
    expect(screen.getByTestId('show')).toHaveTextContent('true');
    expect(renders).toBe(1);
  });

  it('re-derives when the source identity changes', () => {
    const { rerender } = render(<Flag list={['']} />);
    expect(screen.getByTestId('show')).toHaveTextContent('false');
    rerender(<Flag list={['text']} />);
    expect(screen.getByTestId('show')).toHaveTextContent('true');
    rerender(<Flag list={['']} />);
    expect(screen.getByTestId('show')).toHaveTextContent('false');
  });

  it('keeps a direct set until the source next changes', () => {
    const list = [''];
    const { rerender } = render(<Flag list={list} />);
    fireEvent.click(screen.getByText('force open'));
    expect(screen.getByTestId('show')).toHaveTextContent('true');
    // Same identity: the manual value survives a parent re-render.
    rerender(<Flag list={list} />);
    expect(screen.getByTestId('show')).toHaveTextContent('true');
    // New identity with the same content: re-derived, so it closes.
    rerender(<Flag list={['']} />);
    expect(screen.getByTestId('show')).toHaveTextContent('false');
  });

  it('feeds the previous state into the reconciler', () => {
    const { rerender } = render(<Rows lastActive={-1} />);
    expect(screen.getByTestId('visible')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('add row'));
    fireEvent.click(screen.getByText('add row'));
    expect(screen.getByTestId('visible')).toHaveTextContent('3');
    // Source grows past the manual count: follow it.
    rerender(<Rows lastActive={4} />);
    expect(screen.getByTestId('visible')).toHaveTextContent('5');
    // Source shrinks: the manual count is kept.
    rerender(<Rows lastActive={0} />);
    expect(screen.getByTestId('visible')).toHaveTextContent('5');
  });
});

describe('anyNonBlank', () => {
  it('ignores whitespace-only entries', () => {
    expect(anyNonBlank([])).toBe(false);
    expect(anyNonBlank(['', '   '])).toBe(false);
    expect(anyNonBlank(['', 'x'])).toBe(true);
  });
});
