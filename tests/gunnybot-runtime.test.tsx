/**
 * GunnyBotRuntime: key-presence sync and the egress consent gate.
 *
 * The keyring is memory-only — keys deliberately do not survive a
 * reload — but the store mirror `keyPresent` can still drift from it
 * (provider change, stale store state). Every control gated on it
 * (Draft, Rewrite, Review, Test connection) renders disabled on a
 * false negative, or enabled without a key on a false positive, so
 * the runtime must re-sync the mirror on mount and provider change.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { GunnyBotRuntime } from '@/components/gunnybot/GunnyBotRuntime';
import { useGunnyStore } from '@/store/gunnyStore';
import * as keyring from '@/lib/gunnybot/keyring';
import { clearedForEgress } from '@/lib/gunnybot/redaction';
import { hasEgressAckHandler } from '@/lib/gunnybot/egress-gate';

beforeEach(() => {
  keyring.clearAllKeys();
  window.sessionStorage.clear();
  useGunnyStore.setState({ provider: 'anthropic', keyPresent: false });
});

afterEach(() => {
  cleanup();
  keyring.clearAllKeys();
  window.sessionStorage.clear();
});

describe('GunnyBotRuntime: key presence syncs with the keyring', () => {
  it('syncs keyPresent from the in-memory keyring on mount', async () => {
    keyring.setKey('anthropic', 'sk-ant-TESTKEY0123456789');
    expect(useGunnyStore.getState().keyPresent).toBe(false);

    render(<GunnyBotRuntime />);

    await waitFor(() => {
      expect(useGunnyStore.getState().keyPresent).toBe(true);
    });
  });

  it('reports no key after a reload, even if the old sessionStorage mirror lingers', async () => {
    // Post-reload state: in-memory map empty. A stale entry from the
    // retired sessionStorage mirror must NOT rehydrate — keys are
    // memory-only now and a reload forgets them by design.
    window.sessionStorage.setItem('gunnybot-key-anthropic', 'sk-ant-TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    render(<GunnyBotRuntime />);
    await waitFor(() => {
      expect(useGunnyStore.getState().keyPresent).toBe(false);
    });
  });

  it('re-syncs when the provider changes to one with no key', async () => {
    keyring.setKey('anthropic', 'sk-ant-TESTKEY0123456789');
    render(<GunnyBotRuntime />);
    await waitFor(() => expect(useGunnyStore.getState().keyPresent).toBe(true));

    useGunnyStore.setState({ provider: 'gemini' });
    await waitFor(() => expect(useGunnyStore.getState().keyPresent).toBe(false));
  });
});

describe('GunnyBotRuntime: egress consent gate', () => {
  it('registers a handler on mount and tears it down on unmount', () => {
    const view = render(<GunnyBotRuntime />);
    expect(hasEgressAckHandler()).toBe(true);
    view.unmount();
    expect(hasEgressAckHandler()).toBe(false);
  });

  it('shows the finding and resolves true on Send anyway', async () => {
    render(<GunnyBotRuntime />);

    const pending = clearedForEgress('member EDIPI 1234567890 attached');
    const action = await screen.findByRole('button', { name: /send anyway/i });
    expect(screen.getByText(/Possible EDIPI detected/i)).toBeTruthy();

    fireEvent.click(action);
    await expect(pending).resolves.toBe(true);
  });

  it('resolves false on Cancel and edit', async () => {
    render(<GunnyBotRuntime />);

    const pending = clearedForEgress('SSN 123-45-6789 on file');
    const cancel = await screen.findByRole('button', { name: /cancel and edit/i });

    fireEvent.click(cancel);
    await expect(pending).resolves.toBe(false);
  });

  it('never prompts for clean text', async () => {
    render(<GunnyBotRuntime />);
    await expect(clearedForEgress('a clean unclassified paragraph')).resolves.toBe(true);
    expect(screen.queryByRole('button', { name: /send anyway/i })).toBeNull();
  });

  it('resolves a pending prompt as cancelled when the gate unmounts', async () => {
    const view = render(<GunnyBotRuntime />);
    const pending = clearedForEgress('EDIPI 1234567890');
    await screen.findByRole('button', { name: /send anyway/i });
    view.unmount();
    await expect(pending).resolves.toBe(false);
  });
});
