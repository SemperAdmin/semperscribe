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
    setProxyUrl('genaimil', 'https://gw.example/base');
    render(<GunnyBotSettings />);

    expect(screen.getByText('https://gw.example/base')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /clear proxy/i }));
    expect(getProxyUrl('genaimil')).toBeNull();
    expect(screen.getByText(/will not work until you set a proxy URL/i)).toBeTruthy();
  });
});
