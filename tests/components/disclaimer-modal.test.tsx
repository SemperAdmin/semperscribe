/**
 * DisclaimerModal: opens on first visit, stays closed once acknowledged,
 * and reopens on the footer's custom event. Phase A.2 moved the
 * first-visit decision from an effect to a hydration-gated derivation.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { DisclaimerModal } from '@/components/DisclaimerModal';

beforeEach(() => { window.localStorage.clear(); });
afterEach(cleanup);

describe('DisclaimerModal', () => {
  it('opens on a first visit and closes on I Understand, recording the acknowledgement', async () => {
    render(<DisclaimerModal />);
    const button = await screen.findByRole('button', { name: 'I Understand' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'I Understand' })).toBeNull());
    expect(window.localStorage.getItem('hasSeenDisclaimer')).toBe('true');
  });

  it('stays closed once acknowledged', () => {
    window.localStorage.setItem('hasSeenDisclaimer', 'true');
    render(<DisclaimerModal />);
    expect(screen.queryByRole('button', { name: 'I Understand' })).toBeNull();
  });

  it('reopens on the open-disclaimer event', async () => {
    window.localStorage.setItem('hasSeenDisclaimer', 'true');
    render(<DisclaimerModal />);
    act(() => { window.dispatchEvent(new Event('open-disclaimer')); });
    expect(await screen.findByRole('button', { name: 'I Understand' })).toBeInTheDocument();
  });
});
