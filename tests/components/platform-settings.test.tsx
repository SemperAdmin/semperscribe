/**
 * PlatformSettings: install and standalone state read from the browser
 * on the first client render. Phase A.2 replaced the mount effect's
 * synchronous setState calls with hydration-gated derivations; the async
 * backup-status load stays in its effect.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const installPrompt = vi.hoisted(() => ({ canPrompt: false, standalone: false }));

vi.mock('@/lib/install-prompt', () => ({
  canPromptInstall: () => installPrompt.canPrompt,
  isStandalone: () => installPrompt.standalone,
  promptInstall: vi.fn(async () => 'dismissed' as const),
}));

vi.mock('@/lib/auto-backup', () => ({
  isBackupSupported: () => false,
  getBackupStatus: vi.fn(async () => ({ state: 'unsupported' })),
  enableAutoBackup: vi.fn(),
  disableAutoBackup: vi.fn(),
  reauthorizeBackup: vi.fn(),
  backupAll: vi.fn(),
}));

import { PlatformSettings } from '@/components/PlatformSettings';

afterEach(() => {
  cleanup();
  installPrompt.canPrompt = false;
  installPrompt.standalone = false;
});

describe('PlatformSettings install section', () => {
  it('offers manual install instructions when no prompt is parked', async () => {
    render(<PlatformSettings />);
    expect(screen.getByText(/In Edge or Chrome: browser menu/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install/ })).toBeNull();
    await waitFor(() => expect(screen.getByText('Install App')).toBeInTheDocument());
  });

  it('shows the Install button when the browser parked a prompt', () => {
    installPrompt.canPrompt = true;
    render(<PlatformSettings />);
    expect(screen.getByRole('button', { name: /Install/ })).toBeInTheDocument();
  });

  it('reports the installed state when running standalone', () => {
    installPrompt.standalone = true;
    render(<PlatformSettings />);
    expect(screen.getByText(/running as an installed app/)).toBeInTheDocument();
  });
});
