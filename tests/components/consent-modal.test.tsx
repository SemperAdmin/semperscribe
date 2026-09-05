/**
 * D.8 (UX audit finding 7) - first run is a short consent modal.
 *
 * The catalogue of contextual warnings used to be the whole first
 * screen. It now sits behind "Read the full guidance". What the drafter
 * consents to stays visible, and stays word for word the strings in
 * src/lib/security-utils.ts.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { DISCLAIMERS } from '@/lib/security-utils';

beforeEach(() => { window.localStorage.clear(); });
afterEach(cleanup);

describe('DisclaimerModal, short consent', () => {
  it('shows the consent text verbatim and hides the warning catalogue', async () => {
    render(<DisclaimerModal />);
    await screen.findByRole('button', { name: 'I Understand' });

    // The two things "I Understand" acknowledges, unedited. Each also
    // appears inside the collapsed guidance, so the assertion is that
    // the visible copy exists, not that it is the only copy.
    expect(screen.getAllByText(DISCLAIMERS.OPSEC.userResponsibility).length).toBeGreaterThan(0);
    expect(screen.getAllByText(DISCLAIMERS.LEGAL_WARRANTY).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'No warranty' })).toBeInTheDocument();

    // The catalogue is in the DOM but hidden, so nothing about it is
    // announced or scrolled past before the app opens.
    const guidance = document.getElementById('disclaimer-full-guidance');
    expect(guidance).not.toBeNull();
    expect(guidance).toHaveAttribute('hidden');
    expect(screen.queryByRole('heading', { name: /Privacy and Data Handling/ })).toBeNull();
  });

  it('expands the full guidance on request', async () => {
    render(<DisclaimerModal />);
    const toggle = await screen.findByRole('button', { name: 'Read the full guidance' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'disclaimer-full-guidance');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('disclaimer-full-guidance')).not.toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { name: /Privacy and Data Handling/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Operational Security/ })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMERS.PII_WARNING.message)).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMERS.CLASSIFIED_WARNING.message)).toBeInTheDocument();
    expect(screen.getAllByText(DISCLAIMERS.LEGAL_WARRANTY)).toHaveLength(2);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
