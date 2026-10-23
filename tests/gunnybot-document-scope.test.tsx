/**
 * Handoff of 22 Oct 26, D-10: what GunnyBot does with counseling content.
 *
 * The panel states what leaves the browser from it, and the proofread
 * review is closed on a Counseling Worksheet so paragraphs left over
 * from a letter cannot go out under the counseling label.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { GunnyBotPanel } from '@/components/gunnybot/GunnyBotPanel';
import { GunnyBotReviewSection } from '@/components/gunnybot/GunnyBotReviewSection';
import { ProofreadModal } from '@/components/ProofreadModal';
import { panelScopeNote, reviewUnavailableReason } from '@/lib/gunnybot/document-scope';
import { useGunnyStore } from '@/store/gunnyStore';
import * as keyring from '@/lib/gunnybot/keyring';
import * as client from '@/lib/gunnybot/client';
import type { FormData } from '@/types';

beforeEach(() => {
  keyring.clearAllKeys();
  useGunnyStore.setState({ provider: 'genaimil', model: 'gemini-2.5-flash', keyPresent: false, panelOpen: false, messages: [] });
});

afterEach(() => {
  cleanup();
  keyring.clearAllKeys();
  vi.restoreAllMocks();
});

describe('document scope wording', () => {
  it('names the worksheet on a counseling draft and the open document elsewhere', () => {
    expect(panelScopeNote('counseling')).toMatch(/Counseling Worksheet is not sent/);
    expect(panelScopeNote('basic')).toMatch(/open document is not sent/);
    expect(panelScopeNote(undefined)).toMatch(/open document is not sent/);
    // Every variant says what does leave and that the scan runs first.
    for (const t of ['counseling', 'basic', undefined]) {
      expect(panelScopeNote(t)).toMatch(/Only the text you type/);
      expect(panelScopeNote(t)).toMatch(/SSN and EDIPI scan/);
    }
  });

  it('closes the review on a counseling worksheet only', () => {
    expect(reviewUnavailableReason('counseling')).toMatch(/none of its fields are sent/);
    expect(reviewUnavailableReason('basic')).toBeNull();
    expect(reviewUnavailableReason('mco')).toBeNull();
    expect(reviewUnavailableReason(undefined)).toBeNull();
  });
});

describe('GunnyBotPanel scope line', () => {
  it('shows the counseling line when the open document is a worksheet', () => {
    useGunnyStore.setState({ panelOpen: true });
    render(<GunnyBotPanel documentType="counseling" />);
    expect(screen.getByTestId('gunnybot-scope').textContent).toBe(panelScopeNote('counseling'));
  });

  it('shows the general line for a letter and with no type given', () => {
    useGunnyStore.setState({ panelOpen: true });
    const { unmount } = render(<GunnyBotPanel documentType="basic" />);
    expect(screen.getByTestId('gunnybot-scope').textContent).toBe(panelScopeNote('basic'));
    unmount();
    render(<GunnyBotPanel />);
    expect(screen.getByTestId('gunnybot-scope').textContent).toBe(panelScopeNote(undefined));
  });
});

describe('GunnyBotReviewSection closed state', () => {
  it('renders the reason and no Run button when closed, even with a key present', () => {
    keyring.setKey('genaimil', 'STARK_TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    render(
      <GunnyBotReviewSection documentType="counseling" subject="" body="stale letter text" unavailableReason={reviewUnavailableReason('counseling')} />,
    );
    expect(screen.getByTestId('gunnybot-review-closed').textContent).toMatch(/Counseling Worksheet has none/);
    expect(screen.queryByRole('button', { name: /run gunnybot review/i })).toBeNull();
  });

  it('keeps the Run button when open', () => {
    keyring.setKey('genaimil', 'STARK_TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    render(<GunnyBotReviewSection documentType="basic" subject="TEST" body="Body." />);
    expect(screen.queryByTestId('gunnybot-review-closed')).toBeNull();
    expect(screen.getByRole('button', { name: /run gunnybot review/i })).toBeTruthy();
  });
});

describe('ProofreadModal on a counseling worksheet', () => {
  it('offers no GunnyBot run path and builds no request, even with letter paragraphs left in state', () => {
    keyring.setKey('genaimil', 'STARK_TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    const stream = vi.spyOn(client, 'streamChat').mockResolvedValue(undefined);
    const formData = {
      documentType: 'counseling',
      date: '22 Oct 26',
      counselingOccasion: 'initial',
      counselingMarineLastName: 'PLACEHOLDER',
      counselingMarineEdipi: '1234567890',
    } as FormData;
    render(
      <ProofreadModal
        open
        onOpenChange={() => undefined}
        formData={formData}
        paragraphs={[{ id: 1, level: 1, content: 'A paragraph left over from a letter.', acronymError: '' }]}
        enclosures={[]}
        references={[]}
        vias={[]}
      />,
    );
    expect(screen.getByTestId('gunnybot-review-closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /run gunnybot review/i })).toBeNull();
    expect(stream).not.toHaveBeenCalled();
  });

  it('keeps the review open on a letter', () => {
    const formData = { documentType: 'basic', subj: 'TEST SUBJECT', date: '22 Oct 26' } as FormData;
    render(
      <ProofreadModal
        open
        onOpenChange={() => undefined}
        formData={formData}
        paragraphs={[{ id: 1, level: 1, content: 'Body.', acronymError: '' }]}
        enclosures={[]}
        references={[]}
        vias={[]}
      />,
    );
    expect(screen.queryByTestId('gunnybot-review-closed')).toBeNull();
    expect(screen.getByRole('button', { name: /run gunnybot review/i })).toBeTruthy();
  });
});
