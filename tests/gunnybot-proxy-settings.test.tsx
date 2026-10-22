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

  it('surfaces a planted remote proxy as refused and lets it be cleared', () => {
    // No current build writes a remote value. One planted by hand, or by a
    // build before the ruling, is shown with the refusal and a way out.
    window.localStorage.setItem('gunnybot.proxy.v1', JSON.stringify({ genaimil: 'https://gw.example/base' }));
    render(<GunnyBotSettings />);

    expect(screen.getByText('https://gw.example/base')).toBeTruthy();
    expect(screen.getByText(/gw\.example \(remote\)\. The send path refuses this proxy/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear proxy/i }));
    expect(getProxyUrl('genaimil')).toBeNull();
    expect(screen.getByText(/will not work until you set a proxy URL/i)).toBeTruthy();
  });
});

describe('GunnyBotSettings remote proxy refusal (P2-2)', () => {
  it('refuses a remote host, names it, and stores nothing', () => {
    render(<GunnyBotSettings />);
    const field = screen.getByPlaceholderText('http://127.0.0.1:8443');
    fireEvent.change(field, { target: { value: 'https://example.org:8443/gw' } });

    expect(screen.getByText(/example\.org:8443 is not on this machine/i)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
    expect(getProxyUrl('genaimil')).toBeNull();
    expect(window.localStorage.getItem('gunnybot.proxy.v1') ?? '{}').not.toMatch(/example\.org/);
  });

  it('saves a loopback host with no warning shown', () => {
    render(<GunnyBotSettings />);
    fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8443'), { target: { value: 'http://localhost:9000' } });
    expect(screen.queryByText(/is not on this machine/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /save proxy/i }));
    expect(getProxyUrl('genaimil')).toBe('http://localhost:9000');
    expect(screen.getByText(/this machine \(loopback\)/i)).toBeTruthy();
  });

  it('refuses the remote host in EDMS mode the same way', async () => {
    const { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } = await import('@/lib/edms-mode');
    resetEdmsCacheForTests();
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    try {
      render(<GunnyBotSettings />);
      fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8443'), { target: { value: 'https://example.org/gw' } });
      expect(screen.getByText(/example\.org is not on this machine/i)).toBeTruthy();
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
    setProxyUrl('genaimil', 'http://127.0.0.1:8443');
    useGunnyStore.setState({ provider: 'gemini', model: 'gemini-2.5-flash', keyPresent: false });
    try {
      render(<GunnyBotSettings />);
      expect(useGunnyStore.getState().provider).toBe('genaimil');
      expect(screen.getByText('http://127.0.0.1:8443')).toBeTruthy();
      expect(screen.queryByText(/will not work until you set a proxy URL/i)).toBeNull();
    } finally {
      clearEdmsContext();
      resetEdmsCacheForTests();
    }
  });
});
