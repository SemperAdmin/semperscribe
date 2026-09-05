/**
 * useLatestRef: the ref holds the value from the latest commit, and its
 * identity never changes, so an effect listing it runs on its own
 * schedule while reading current props.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React, { useEffect } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useLatestRef } from '@/hooks/useLatestRef';

afterEach(cleanup);

interface ProbeProps {
  label: string;
  onSeen: (s: string) => void;
  onEffect: (ref: object) => void;
}

function Probe({ label, onSeen, onEffect }: ProbeProps) {
  const latest = useLatestRef({ label, onSeen });
  useEffect(() => {
    onEffect(latest);
    // Scheduled on the ref alone, which is the point under test.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);
  return <button onClick={() => latest.current.onSeen(latest.current.label)}>read</button>;
}

describe('useLatestRef', () => {
  it('keeps one identity across renders and reads the latest props', () => {
    const seen: string[] = [];
    const effectRefs: object[] = [];
    const onEffect = (ref: object) => effectRefs.push(ref);
    const { rerender } = render(<Probe label="one" onSeen={s => seen.push(`a:${s}`)} onEffect={onEffect} />);
    rerender(<Probe label="two" onSeen={s => seen.push(`b:${s}`)} onEffect={onEffect} />);
    rerender(<Probe label="three" onSeen={s => seen.push(`c:${s}`)} onEffect={onEffect} />);
    expect(effectRefs).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(seen).toEqual(['c:three']);
  });
});
