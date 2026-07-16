'use client';

/**
 * P1.1 (DONDOCS_PARITY_PLAN) - share-link creation and unlock dialogs.
 *
 * Create: password is REQUIRED by default. An explicit opt-out produces
 * a legacy unprotected link with a visible warning. Optional expiry
 * rides inside the encrypted payload.
 *
 * Unlock: shown when the app loads with an #es= fragment. Wrong
 * password and corrupt payload are reported without distinguishing
 * detail beyond what the caller returns.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Link2, AlertTriangle, LockOpen } from 'lucide-react';

export interface ShareLinkOptions {
  /** Absent only when the user explicitly opted out of protection. */
  password?: string;
  /** Days until the link refuses to load. Absent = no expiry. */
  expiresDays?: number;
}

const MIN_PASSWORD_LENGTH = 8;

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Generates the link, copies it, and toasts. Resolves when done. */
  onCreate: (options: ShareLinkOptions) => Promise<void>;
}

export function ShareLinkDialog({ open, onOpenChange, onCreate }: ShareLinkDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [expiresDays, setExpiresDays] = useState<string>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setNoPassword(false);
    setExpiresDays('none');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    if (!noPassword) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }
    setBusy(true);
    try {
      await onCreate({
        password: noPassword ? undefined : password,
        expiresDays: expiresDays === 'none' ? undefined : Number(expiresDays),
      });
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Link2 className="w-4 h-4" /> Create Share Link
          </DialogTitle>
          <DialogDescription>
            The link contains the full document text. Protected links are
            encrypted in your browser - the password never travels with the link.
          </DialogDescription>
        </DialogHeader>

        {!noPassword && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-password">Link password</Label>
              <Input
                id="share-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-password-confirm">Confirm password</Label>
              <Input
                id="share-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-expiry">Link expires</Label>
              <Select value={expiresDays} onValueChange={setExpiresDays}>
                <SelectTrigger id="share-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Share the password through a separate channel from the link.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="share-no-password"
            checked={noPassword}
            onCheckedChange={(c) => setNoPassword(c === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="share-no-password" className="cursor-pointer">
              Create an unprotected link
            </Label>
            {noPassword && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                Anyone with the link reads the full document. Unprotected links
                also appear in server logs and browser history. Never use one
                for sensitive content.
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={busy}>
            {noPassword ? <LockOpen className="w-4 h-4 mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
            {busy ? 'Generating...' : 'Generate & Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UnlockShareDialogProps {
  open: boolean;
  /** Returns an error message to display, or null on success. */
  onUnlock: (password: string) => Promise<string | null>;
  /** Discards the pending encrypted payload and opens the blank editor. */
  onDismiss: () => void;
}

export function UnlockShareDialog({ open, onUnlock, onDismiss }: UnlockShareDialogProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    const result = await onUnlock(password);
    setBusy(false);
    if (result) {
      setError(result);
    } else {
      setPassword('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Lock className="w-4 h-4" /> Protected Document Link
          </DialogTitle>
          <DialogDescription>
            This link is password protected. Enter the password the sender
            gave you to open the document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="unlock-password">Password</Label>
          <Input
            id="unlock-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleUnlock(); }}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss} disabled={busy}>
            Discard Link
          </Button>
          <Button onClick={handleUnlock} disabled={busy || !password}>
            {busy ? 'Unlocking...' : 'Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
