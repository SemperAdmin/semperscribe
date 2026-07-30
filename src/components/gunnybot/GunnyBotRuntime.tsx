'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGunnyStore } from '@/store/gunnyStore';
import { hasKey } from '@/lib/gunnybot/keyring';
import { registerEgressAckHandler } from '@/lib/gunnybot/egress-gate';

/**
 * Always-mounted GunnyBot session runtime. Two jobs, both of which have
 * to survive a page reload and cannot live inside the Settings dialog:
 *
 * 1. Key presence. The keyring mirrors to sessionStorage, so a key
 *    survives a same-tab reload. The store mirror did not, so after F5
 *    keyPresent read false while the key was still usable, and every
 *    control gated on it (Draft, Rewrite, Review, Test connection)
 *    rendered permanently disabled behind a false "add your API key"
 *    hint. This effect re-syncs the mirror on mount and on provider
 *    change.
 *
 * 2. The egress consent gate. Registers the acknowledgment handler that
 *    lib/gunnybot/egress-gate calls when a pre-send scan flags a
 *    structured identifier, and renders the dialog the user answers.
 *
 * Mount once, next to GunnyBotPanel at the app root.
 */
export function GunnyBotRuntime() {
  const provider = useGunnyStore(s => s.provider);
  const setKeyPresent = useGunnyStore(s => s.setKeyPresent);

  const [findings, setFindings] = useState<string[] | null>(null);
  const resolveRef = useRef<((cleared: boolean) => void) | null>(null);

  useEffect(() => {
    setKeyPresent(hasKey(provider));
  }, [provider, setKeyPresent]);

  useEffect(() => {
    registerEgressAckHandler(
      next =>
        new Promise<boolean>(resolve => {
          resolveRef.current = resolve;
          setFindings(next);
        }),
    );
    return () => {
      registerEgressAckHandler(null);
      // A pending prompt cannot be answered once the handler is gone.
      const pending = resolveRef.current;
      resolveRef.current = null;
      if (pending) {
        pending(false);
      }
    };
  }, []);

  const settle = useCallback((cleared: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setFindings(null);
    if (resolve) {
      resolve(cleared);
    }
  }, []);

  const open = findings !== null;

  return (
    <AlertDialog open={open} onOpenChange={next => { if (!next) { settle(false); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sensitive identifier detected</AlertDialogTitle>
          <AlertDialogDescription>
            This text looks like it contains a personal identifier. Sending it to GunnyBot transmits it out of your
            browser to the provider you configured, under your key. You are responsible for what you submit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {findings !== null && findings.length > 0 && (
          <ul className="text-sm text-foreground list-disc pl-5 space-y-1">
            {findings.map((finding, i) => (
              <li key={i}>{finding}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Cancel to edit the text first. This check looks only for SSN and EDIPI patterns and does not certify the
          text is free of CUI, PII, or classified material.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel and edit</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>Send anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
