/**
 * Handoff N-02 (22 Oct 26 retest): the landing chip read "100% on-device -
 * no server" while GunnyBot, once given a key, sends typed text to
 * api.genai.mil. The chip may not claim an absolute the app breaks.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { LandingPage } from '@/components/layout/LandingPage';

afterEach(cleanup);

describe('landing page egress claim', () => {
  it('states on-device as the default and names the opt-in assistant', () => {
    const { container } = render(<LandingPage onSelectType={vi.fn()} />);
    expect(screen.getByText('On-device, AI assistant opt-in')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/100% on-device|no server/i);
  });
});
