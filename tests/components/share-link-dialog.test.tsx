/**
 * ShareLinkDialog: the EDMS lock. Outside EDMS the unprotected-link
 * opt-out is offered; inside EDMS it is hidden and the notice shows.
 * Phase A.3 derives the lock from hydration state instead of an effect.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } from '@/lib/edms-mode';

beforeEach(() => {
  window.sessionStorage.clear();
  resetEdmsCacheForTests();
});
afterEach(() => {
  cleanup();
  clearEdmsContext();
  resetEdmsCacheForTests();
});

const optOut = () => screen.getByLabelText('Create an unprotected link');

describe('ShareLinkDialog', () => {
  it('offers the unprotected-link opt-out outside EDMS mode', () => {
    render(<ShareLinkDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />);
    expect(optOut().closest('div.hidden')).toBeNull();
    expect(screen.queryByText(/EDMS draft/)).toBeNull();
  });

  it('hides the opt-out and shows the notice in EDMS mode', () => {
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    render(<ShareLinkDialog open onOpenChange={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText(/EDMS draft/)).toBeInTheDocument();
    expect(optOut().closest('.hidden')).not.toBeNull();
  });
});
