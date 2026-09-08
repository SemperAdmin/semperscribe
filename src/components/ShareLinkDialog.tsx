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
import { useHydrated } from '@/hooks/useHydrated';
import { useSyncedState } from '@/hooks/useSyncedState';
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
import { Lock, Link2, AlertTriangle, LockOpen, Wand2, Copy, Check, PenLine } from 'lucide-react';
import { isEdmsMode } from '@/lib/edms-mode';
import { copyToClipboard } from '@/lib/url-state';

export interface ShareLinkOptions {
  /** Absent only when the user explicitly opted out of protection. */
  password?: string;
  /** Days until the link refuses to load. Absent = no expiry. */
  expiresDays?: number;
}

/**
 * P3-2. The password is the only thing standing between the link and the
 * document, and PBKDF2 at 600k iterations does not rescue an 8-character
 * password from an offline guess. Twelve is the floor; the generator
 * below produces four words from the list under it, so meeting the floor
 * costs one click.
 */
export const MIN_SHARE_PASSWORD_LENGTH = 12;

// Short, common, unambiguous English words, 385 of them. Six words
// drawn uniformly give log2(385^6), about 51.5 bits. Paired with the
// 600k-round PBKDF2-SHA-256 in crypto-utils.ts, an offline search at an
// estimated 1e4 derivations per second per GPU runs into thousands of
// GPU-years, orders of magnitude past the four-word default this
// replaced (about 34 bits, days of single-GPU time). The figure is a
// floor, not a ceiling: the user types anything longer. Editing the
// list does not affect existing links, since words never travel, only
// the password the user typed or accepted.
const PASSPHRASE_WORD_COUNT = 6;
const PASSPHRASE_WORDS = [
  'acorn', 'actor', 'adobe', 'alarm', 'album', 'alley', 'alpine', 'amber', 'anchor', 'ankle',
  'anvil', 'apple', 'apron', 'arena', 'armor', 'arrow', 'aspen', 'atlas', 'attic', 'aurora',
  'autumn', 'avenue', 'badge', 'bagel', 'baker', 'balcony', 'bamboo', 'banana', 'banjo', 'banner',
  'barley', 'barn', 'basil', 'basin', 'basket', 'beacon', 'beach', 'beaver', 'bell', 'berry',
  'birch', 'bison', 'blade', 'blanket', 'blaze', 'blossom', 'board', 'boulder', 'bramble', 'brass',
  'bread', 'breeze', 'brick', 'bridge', 'broom', 'brook', 'brush', 'bucket', 'budget', 'buffalo',
  'bugle', 'bundle', 'burrow', 'butter', 'button', 'cabin', 'cable', 'cactus', 'camel', 'camera',
  'canal', 'candle', 'canoe', 'canvas', 'canyon', 'carbon', 'cargo', 'carrot', 'castle', 'cedar',
  'cellar', 'chair', 'chalk', 'channel', 'chapel', 'charm', 'cherry', 'chess', 'chimney', 'cider',
  'cinder', 'circle', 'citrus', 'clay', 'cliff', 'clock', 'cloud', 'clover', 'coast', 'cobalt',
  'cobweb', 'cocoa', 'coffee', 'comet', 'compass', 'copper', 'coral', 'corner', 'cotton', 'cousin',
  'cradle', 'crane', 'crater', 'crayon', 'creek', 'crest', 'cricket', 'crown', 'crystal', 'cycle',
  'daisy', 'dancer', 'dawn', 'decade', 'delta', 'desert', 'diamond', 'dinner', 'dolphin', 'domino',
  'donkey', 'dragon', 'drawer', 'drum', 'dune', 'eagle', 'earth', 'echo', 'eclipse', 'ember',
  'emerald', 'empire', 'engine', 'envoy', 'estate', 'fable', 'falcon', 'farmer', 'feather', 'fence',
  'fennel', 'ferry', 'fiddle', 'field', 'finch', 'flame', 'flint', 'flock', 'flute', 'forest',
  'fossil', 'fountain', 'fox', 'frost', 'galaxy', 'garden', 'garlic', 'gauge', 'gazelle', 'geyser',
  'ginger', 'glacier', 'glass', 'globe', 'goose', 'gourd', 'grain', 'granite', 'grape', 'gravel',
  'grove', 'guitar', 'hammer', 'hamlet', 'harbor', 'harvest', 'hazel', 'heron', 'hickory', 'hollow',
  'honey', 'horizon', 'hummus', 'igloo', 'indigo', 'ingot', 'inlet', 'iris', 'island', 'ivory',
  'jacket', 'jaguar', 'jasmine', 'jasper', 'jelly', 'jigsaw', 'jungle', 'juniper', 'kayak', 'kernel',
  'kettle', 'kiosk', 'kitten', 'koala', 'ladder', 'lagoon', 'lantern', 'lattice', 'lava', 'lemon',
  'lentil', 'lilac', 'linen', 'lizard', 'lobster', 'locket', 'lotus', 'lumber', 'lunar', 'magnet',
  'magnolia', 'mango', 'mantle', 'maple', 'marble', 'marsh', 'meadow', 'melon', 'mesa', 'meteor',
  'mint', 'mirror', 'mitten', 'monsoon', 'mosaic', 'moss', 'motor', 'mountain', 'mural', 'mustard',
  'napkin', 'nectar', 'needle', 'nickel', 'noodle', 'north', 'nutmeg', 'oasis', 'ocean', 'olive',
  'onion', 'orange', 'orbit', 'orchard', 'orchid', 'otter', 'oyster', 'paddle', 'pagoda', 'palace',
  'panda', 'panther', 'paper', 'parrot', 'pasta', 'pebble', 'pelican', 'penguin', 'pepper', 'piano',
  'pickle', 'pillar', 'pilot', 'pine', 'planet', 'plaza', 'plum', 'polar', 'poppy', 'porch',
  'prairie', 'prism', 'puddle', 'pulse', 'pumpkin', 'puzzle', 'quail', 'quarry', 'quartz', 'quill',
  'quilt', 'radar', 'radish', 'raft', 'rainbow', 'raisin', 'raven', 'reef', 'ribbon', 'ridge',
  'river', 'robin', 'rocket', 'rubble', 'ruby', 'rudder', 'saddle', 'saffron', 'sailor', 'salmon',
  'sandal', 'satin', 'scarf', 'scooter', 'shadow', 'shell', 'shovel', 'silver', 'sketch', 'slate',
  'sonar', 'spark', 'sparrow', 'spider', 'spinach', 'spruce', 'squirrel', 'stone', 'summit', 'sunset',
  'swallow', 'tango', 'tapir', 'teapot', 'thistle', 'thunder', 'tiger', 'timber', 'toast', 'tomato',
  'topaz', 'torch', 'tractor', 'trail', 'trumpet', 'tulip', 'tundra', 'tunnel', 'turtle', 'umbrella',
  'valley', 'velvet', 'vessel', 'village', 'vinyl', 'violet', 'volcano', 'voyage', 'waffle', 'wagon',
  'walnut', 'walrus', 'water', 'willow', 'window', 'winter', 'wizard', 'wolf', 'yarrow', 'yogurt',
  'zebra', 'zenith', 'zephyr', 'zinc', 'zipper',
];

/** Six random words from the built-in list, space separated. */
export function generatePassphrase(): string {
  const idx = new Uint32Array(PASSPHRASE_WORD_COUNT);
  crypto.getRandomValues(idx);
  return Array.from(idx, n => PASSPHRASE_WORDS[n % PASSPHRASE_WORDS.length]).join(' ');
}

/**
 * Distinct-character floor. A length-only check passes a run of one
 * character (`aaaaaaaaaaaa`), which meets twelve characters at about
 * 5 bits. Requiring six distinct characters rejects that class without
 * a dictionary. The generated six-word passphrase clears it every time.
 */
const MIN_DISTINCT_CHARS = 6;

/** Validation shared by the share dialog and the signature-request path. */
export function sharePasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_SHARE_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_SHARE_PASSWORD_LENGTH} characters.`;
  }
  if (new Set(password).size < MIN_DISTINCT_CHARS) {
    return `Password must use at least ${MIN_DISTINCT_CHARS} different characters. Use the generated passphrase or a longer phrase.`;
  }
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export type ShareLinkDialogMode = 'share' | 'signature-request';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Generates the link, copies it, and toasts. Resolves when done. */
  onCreate: (options: ShareLinkOptions) => Promise<void>;
  /**
   * 'signature-request' (P2-1): the link carries a routing slip asking
   * someone to sign. It is always password-protected, so the opt-out is
   * not offered in this mode.
   */
  mode?: ShareLinkDialogMode;
}

export function ShareLinkDialog({ open, onOpenChange, onCreate, mode = 'share' }: ShareLinkDialogProps) {
  // EDMS mode: encrypted links only. sessionStorage is absent during the
  // static-export prerender, so the flag derives from the hydration state:
  // false on the server and first client render, then read once.
  const hydrated = useHydrated();
  const [edmsLocked] = useSyncedState(hydrated, h => h && isEdmsMode());
  const signatureRequest = mode === 'signature-request';
  const passwordRequired = edmsLocked || signatureRequest;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [expiresDays, setExpiresDays] = useState<string>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown once, in this dialog only. Cleared on reset so a reopened
  // dialog never shows a passphrase which already left with a link.
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setNoPassword(false);
    setExpiresDays('none');
    setError(null);
    setGenerated(null);
    setCopied(false);
  };

  const handleGenerate = () => {
    const phrase = generatePassphrase();
    setGenerated(phrase);
    setPassword(phrase);
    setConfirm(phrase);
    setCopied(false);
    setError(null);
  };

  const handleCopyGenerated = async () => {
    if (generated === null) return;
    setCopied(await copyToClipboard(generated));
  };

  const handleCreate = async () => {
    setError(null);
    const unprotected = noPassword && !passwordRequired;
    if (!unprotected) {
      const problem = sharePasswordProblem(password, confirm);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    try {
      await onCreate({
        password: unprotected ? undefined : password,
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
            {signatureRequest
              ? <><PenLine className="w-4 h-4" /> Create Signature Request Link</>
              : <><Link2 className="w-4 h-4" /> Create Share Link</>}
          </DialogTitle>
          <DialogDescription>
            {signatureRequest
              ? 'The link carries the full letter and asks the signer to sign and return it. It is encrypted in your browser with the password below - the password never travels with the link.'
              : 'The link contains the full document text. Protected links are encrypted in your browser - the password never travels with the link.'}
          </DialogDescription>
        </DialogHeader>

        {(!noPassword || passwordRequired) && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-password">Link password</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={handleGenerate}>
                  <Wand2 className="w-3 h-3 mr-1" /> Generate passphrase
                </Button>
              </div>
              <Input
                id="share-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setGenerated(null); }}
                placeholder={`At least ${MIN_SHARE_PASSWORD_LENGTH} characters`}
              />
            </div>
            {generated !== null && (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <Input
                    data-testid="generated-passphrase"
                    readOnly
                    value={generated}
                    aria-label="Generated passphrase"
                    className="font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyGenerated()} aria-label="Copy passphrase">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown once. Copy it now and send it separately from the link.
                </p>
              </div>
            )}
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

        {edmsLocked && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary pl-2">
            EDMS draft. Only password-protected links are available: the
            encrypted payload rides in the URL fragment, which browsers never
            send to a server. An unprotected link puts the whole letter in a
            query string and therefore in server logs.
          </p>
        )}

        <div className={`flex items-start gap-2 pt-1${passwordRequired ? ' hidden' : ''}`}>
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
            {/* CORRECTED 2026-08-26 rather than added to. This warning said
                unprotected links "appear in server logs", which was true while
                the payload rode the query string and stopped being true when
                it moved to the fragment (url-state.ts). A warning naming a
                risk the code no longer has teaches a user to discount the ones
                it does have. What survives the move is the bigger half: the
                document is IN the link. */}
            {noPassword && !passwordRequired && (
              <p className="text-xs text-destructive flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                Anyone with the link reads the full document. The document travels
                inside the link itself, so it goes wherever the link goes: email,
                chat, browser history, a screenshot of the address bar. Never use
                one for sensitive content.
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
            {noPassword && !passwordRequired ? <LockOpen className="w-4 h-4 mr-1.5" /> : <Lock className="w-4 h-4 mr-1.5" />}
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

interface ConfirmShareDialogProps {
  /** Preview of the pending link, or null when nothing is pending. */
  pending: { subject?: string; requestsSignature: boolean } | null;
  /** Imports the pending document into the editor. */
  onConfirm: () => void;
  /** Discards the pending link and opens the blank editor. */
  onDismiss: () => void;
}

/**
 * Consent gate for legacy unprotected `?share=` links. These links are
 * constructable by anyone (no password, no integrity), so the document —
 * and especially a signature-request routing slip — must never load
 * without the user seeing where it came from and agreeing.
 */
export function ConfirmShareDialog({ pending, onConfirm, onDismiss }: ConfirmShareDialogProps) {
  return (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <LockOpen className="w-4 h-4" /> Load shared document?
          </DialogTitle>
          <DialogDescription>
            This link carries a document written by whoever created the link.
            Only load it if you were expecting it and trust the sender.
          </DialogDescription>
        </DialogHeader>
        {pending?.subject && (
          <p className="text-sm text-foreground">
            <span className="font-semibold">Subj:</span> {pending.subject}
          </p>
        )}
        {pending?.requestsSignature && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This link asks you to sign the document and send it back.
              Anyone can construct such a request — verify the sender before
              signing anything.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>Discard Link</Button>
          <Button onClick={onConfirm}>Load Document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
