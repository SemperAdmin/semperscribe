'use client';

/**
 * P1.3 + P1.4 (DONDOCS_PARITY_PLAN) - Settings sections for automatic
 * local-folder backup and app installation. Self-contained: owns its
 * state and talks to the auto-backup and install-prompt libs directly.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FolderDown, MonitorDown, RefreshCcw, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BackupStatus,
  isBackupSupported,
  getBackupStatus,
  enableAutoBackup,
  disableAutoBackup,
  reauthorizeBackup,
  backupAll,
} from '@/lib/auto-backup';
import { canPromptInstall, promptInstall, isStandalone } from '@/lib/install-prompt';

export function PlatformSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<BackupStatus>({ state: isBackupSupported() ? 'off' : 'unsupported' });
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBackupStatus().then((s) => { if (!cancelled) setStatus(s); });
    setInstallable(canPromptInstall());
    setStandalone(isStandalone());
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => setStatus(await getBackupStatus());

  const handleEnable = async () => {
    setBusy(true);
    try {
      const folder = await enableAutoBackup();
      await refresh();
      toast({ title: 'Auto Backup On', description: `Every save now writes a portable copy into "${folder}".` });
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        toast({ title: 'Backup Setup Failed', description: (error as Error).message, variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    await disableAutoBackup();
    await refresh();
    toast({ title: 'Auto Backup Off', description: 'Saves stay in the browser library only.' });
  };

  const handleReauthorize = async () => {
    setBusy(true);
    try {
      const ok = await reauthorizeBackup();
      await refresh();
      if (!ok) toast({ title: 'Permission Denied', description: 'The browser refused folder access. Pick the folder again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleBackupAll = async () => {
    setBusy(true);
    try {
      const count = await backupAll();
      toast({ title: 'Backup Complete', description: `${count} document${count === 1 ? '' : 's'} written to the backup folder.` });
    } catch (error) {
      toast({ title: 'Backup Failed', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast({ title: 'App Installed', description: 'SemperScribe now opens from your desktop and works offline.' });
      setStandalone(true);
    }
    setInstallable(canPromptInstall());
  };

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Automatic Backup</h3>
        <div className="rounded-md border border-border p-3 space-y-2">
          {status.state === 'unsupported' && (
            <p className="text-xs text-muted-foreground">
              Folder backup needs the File System Access API (Edge or Chrome).
              Use File, Export Data Package for manual backups in this browser.
            </p>
          )}
          {status.state === 'off' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Auto backup is off</p>
                <p className="text-xs text-muted-foreground">Pick a folder and every save writes a portable .nldp copy to disk.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleEnable} disabled={busy}>
                <FolderDown className="w-3 h-3 mr-1" /> Choose Folder
              </Button>
            </div>
          )}
          {status.state === 'on' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Backing up to &quot;{status.folderName}&quot;</p>
                  <p className="text-xs text-muted-foreground">Every save writes a timestamped .nldp file. Survives cleared browser data.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleBackupAll} disabled={busy}>
                  <RefreshCcw className="w-3 h-3 mr-1" /> Back Up All Now
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleEnable} disabled={busy}>Change Folder</Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDisable} disabled={busy}>
                  <XCircle className="w-3 h-3 mr-1" /> Turn Off
                </Button>
              </div>
            </div>
          )}
          {status.state === 'permission-needed' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Folder &quot;{status.folderName}&quot; needs re-authorization</p>
                <p className="text-xs text-muted-foreground">The browser dropped folder access after a restart.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReauthorize} disabled={busy}>Re-authorize</Button>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Install App</h3>
        <div className="rounded-md border border-border p-3">
          {standalone ? (
            <p className="text-sm text-foreground">SemperScribe is running as an installed app. It works fully offline.</p>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Install SemperScribe on this computer</p>
                <p className="text-xs text-muted-foreground">
                  {installable
                    ? 'Runs in its own window and works fully offline - suitable for disconnected spaces.'
                    : 'In Edge or Chrome: browser menu, Apps, "Install SemperScribe". Works fully offline afterward.'}
                </p>
              </div>
              {installable && (
                <Button variant="outline" size="sm" onClick={handleInstall}>
                  <MonitorDown className="w-3 h-3 mr-1" /> Install
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
