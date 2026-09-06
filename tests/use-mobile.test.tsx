/**
 * useIsMobile: reads the viewport width during render through a
 * matchMedia subscription. jsdom has no matchMedia, so a minimal one is
 * installed per test and the change event is dispatched by hand.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

type Listener = () => void;
let listeners: Listener[] = [];

beforeEach(() => {
  listeners = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({
      matches: window.innerWidth < 768,
      addEventListener: (_: string, cb: Listener) => { listeners.push(cb); },
      removeEventListener: (_: string, cb: Listener) => { listeners = listeners.filter(l => l !== cb); },
    }),
  });
});

afterEach(cleanup);

function setWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
}

function Probe() {
  return <span data-testid="m">{String(useIsMobile())}</span>;
}

describe('useIsMobile', () => {
  it('is false at desktop width and true below the breakpoint', () => {
    setWidth(1024);
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('m')).toHaveTextContent('false');
    unmount();
    setWidth(500);
    render(<Probe />);
    expect(screen.getByTestId('m')).toHaveTextContent('true');
  });

  it('follows a media query change and unsubscribes on unmount', () => {
    setWidth(1024);
    const { unmount } = render(<Probe />);
    expect(listeners).toHaveLength(1);
    setWidth(600);
    act(() => { listeners.forEach(l => l()); });
    expect(screen.getByTestId('m')).toHaveTextContent('true');
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
