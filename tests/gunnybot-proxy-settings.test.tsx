/**
 * GunnyBotSettings: the proxy control for providers that refuse direct
 * browser calls.
 *
 * GenAI.mil is one of them, measured on a government workstation
 * 2026-08-11 (docs/GENAI_MIL_CORS_DEFECT_REPORT.md). Before this control
 * existed, selecting it produced a bare "Failed to fetch" with nothing
 * for the user to act on. These cases pin the visible behaviour: the
 * warning appears, Test connection is unavailable, and saving a URL
 * clears both.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GunnyBotSettings } from '@/components/gunnybot/GunnyBotSettings';
import { useGunnyStore } from '@/store/gunnyStore';
import * as keyring from '@/lib/gunnybot/keyring';
import { clearAllProxyUrls, setProxyUrl, getProxyUrl } from '@/lib/gunnybot/proxy-config';

beforeEach(() => {
  keyring.clearAllKeys();
  clearAllProxyUrls();
  window.sessionStorage.clear();
  useGunnyStore.setState({ provider: 'genaimil', model: 'gemini-2.5-flash', keyPresent: false });
});

afterEach(() => {
  cleanup();
  keyring.clearAllKeys();
  clearAllProxyUrls();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('GunnyBotSettings proxy control', () => {
  it('warns and disables Test connection when GenAI.mil has no proxy', () => {
    keyring.setKey('genaimil', 'STARK_TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    render(<GunnyBotSettings />);

    expect(screen.getByText(/will not work until you set a proxy URL/i)).toBeTruthy();
    const test = screen.getByRole('button', { name: /test connection/i }) as HTMLButtonElement;
    expect(test.disabled).toBe(true);
  });

  it('drops the warning and re-arms Test connection once a proxy is saved', () => {
    keyring.setKey('genaimil', 'STARK_TESTKEY0123456789');
    useGunnyStore.setState({ keyPresent: true });
    render(<GunnyBotSettings />);

    const field = screen.getByPlaceholderText('http://127.0.0.1:8443');
    fireEvent.change(field, { target: { value: 'http://127.0.0.1:8443/' } });
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));

    expect(getProxyUrl('genaimil')).toBe('http://127.0.0.1:8443');
    expect(screen.queryByText(/will not work until you set a proxy URL/i)).toBeNull();
    const test = screen.getByRole('button', { name: /test connection/i }) as HTMLButtonElement;
    expect(test.disabled).toBe(false);
  });

  it('shows no proxy section at all for a browser-direct provider', () => {
    useGunnyStore.setState({ provider: 'gemini' });
    render(<GunnyBotSettings />);
    expect(screen.queryByText(/Provider proxy/i)).toBeNull();
  });

  it('surfaces the saved proxy and lets it be cleared', () => {
    setProxyUrl('genaimil', 'https://gw.example/base', { allowRemote: true });
    render(<GunnyBotSettings />);

    expect(screen.getByText('https://gw.example/base')).toBeTruthy();
    expect(screen.getByText(/gw\.example \(remote\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear proxy/i }));
    expect(getProxyUrl('genaimil')).toBeNull();
    expect(screen.getByText(/will not work until you set a proxy URL/i)).toBeTruthy();
  });
});

describe('GunnyBotSettings remote proxy acknowledgement (P2-2)', () => {
  it('refuses a remote host until the acknowledgement naming it is ticked', () => {
    render(<GunnyBotSettings />);
    const field = screen.getByPlaceholderText('http://127.0.0.1:8443');
    fireEvent.change(field, { target: { value: 'https://example.org:8443/gw' } });

    const ack = screen.getByLabelText(/example\.org:8443 is not on this machine/i);
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
    expect(getProxyUrl('genaimil')).toBeNull();

    fireEvent.click(ack);
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
    expect(getProxyUrl('genaimil')).toBe('https://example.org:8443/gw');
  });

  it('saves a loopback host with no acknowledgement shown', () => {
    render(<GunnyBotSettings />);
    fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8443'), { target: { value: 'http://localhost:9000' } });
    expect(screen.queryByLabelText(/is not on this machine/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
    expect(getProxyUrl('genaimil')).toBe('http://localhost:9000');
    expect(screen.getByText(/this machine \(loopback\)/i)).toBeTruthy();
  });

  it('offers no acknowledgement in EDMS mode and refuses the remote host', async () => {
    const { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } = await import('@/lib/edms-mode');
    resetEdmsCacheForTests();
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    try {
      render(<GunnyBotSettings />);
      fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8443'), { target: { value: 'https://example.org/gw' } });
      expect(screen.queryByLabelText(/is not on this machine/i)).toBeNull();
      expect(screen.getByText(/EDMS mode only permits a loopback proxy/i)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
      expect(getProxyUrl('genaimil')).toBeNull();
    } finally {
      clearEdmsContext();
      resetEdmsCacheForTests();
    }
  });
});

describe('GunnyBotSettings in EDMS mode', () => {
  it('locks the provider to GenAI.mil and reads its proxy on the first client render', async () => {
    const { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } = await import('@/lib/edms-mode');
    resetEdmsCacheForTests();
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    setProxyUrl('genaimil', 'https://gw.example/edms', { allowRemote: true });
    useGunnyStore.setState({ provider: 'gemini', model: 'gemini-2.5-flash', keyPresent: false });
    try {
      render(<GunnyBotSettings />);
      expect(useGunnyStore.getState().provider).toBe('genaimil');
      expect(screen.getByText('https://gw.example/edms')).toBeTruthy();
      expect(screen.queryByText(/will not work until you set a proxy URL/i)).toBeNull();
    } finally {
      clearEdmsContext();
      resetEdmsCacheForTests();
    }
  });
});
