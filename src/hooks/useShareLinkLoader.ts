'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getStateFromUrl,
  clearShareParam,
  getEncryptedPayloadFromHash,
  decryptSharedState,
  clearShareHash,
  SignatureRouting,
  ShareableState,
} from '@/lib/url-state';
import type { useToast } from '@/hooks/use-toast';

interface UseShareLinkLoaderArgs {
  handleImport: (state: ShareableState) => void;
  toast: ReturnType<typeof useToast>['toast'];
  /** R1: receives comments arriving on a shared link. */
  onComments?: (comments: import('@/lib/review-comments').ReviewComment[]) => void;
}

/**
 * Loads shared state from a share link on mount and surfaces the S2
 * routing slip when the link is a request for signature.
 *
 * Two inbound formats (P1.1, DONDOCS_PARITY_PLAN):
 * - Legacy `?share=` query param: plain lz-string, imported directly.
 * - Encrypted `#es=` fragment: held until the user supplies the
 *   password through the UnlockShareDialog, then imported.
 */
export function useShareLinkLoader({ handleImport, toast, onComments }: UseShareLinkLoaderArgs) {
  // S2: routing slip arriving on a request-for-signature link
  const [routingRequest, setRoutingRequest] = useState<SignatureRouting | null>(null);

  // P1.1: encrypted payload waiting for a password
  const [encryptedPayload, setEncryptedPayload] = useState<string | null>(null);

  const applyImportedState = useCallback((sharedState: ShareableState) => {
    handleImport(sharedState);
    // R1: comments arriving with the document.
    if (sharedState.comments?.length) onComments?.(sharedState.comments);
    if (sharedState.routing) {
      // S2c follow-up (Stephen 2026-06-10): no toast — the ceremony
      // panel at the top of the page is the whole message.
      setRoutingRequest(sharedState.routing);
    } else {
      toast({
        title: "Document Loaded",
        description: "Shared document has been loaded. You can view and edit it.",
      });
    }
    // handleImport and toast are stable enough for the lifetime of the
    // page; mount-consumed links never re-fire (same posture as before).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load shared state from URL on mount
  useEffect(() => {
    // Encrypted fragment takes priority - it is the current format.
    const payload = getEncryptedPayloadFromHash();
    if (payload) {
      setEncryptedPayload(payload);
      return;
    }

    const sharedState = getStateFromUrl();
    if (sharedState) {
      applyImportedState(sharedState);
      clearShareParam();
    }
    // Mount-only by design: the share param is consumed exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Attempts to unlock the pending encrypted payload.
   * Returns an error message for the dialog, or null when the dialog
   * should close (success, or a terminal state already toasted).
   */
  const unlockEncrypted = useCallback(async (password: string): Promise<string | null> => {
    if (!encryptedPayload) return 'No pending link.';
    const result = await decryptSharedState(encryptedPayload, password);
    switch (result.status) {
      case 'ok':
        applyImportedState(result.state);
        setEncryptedPayload(null);
        clearShareHash();
        return null;
      case 'wrong-password':
        return 'Wrong password. Check with the sender and try again.';
      case 'expired':
        setEncryptedPayload(null);
        clearShareHash();
        toast({
          title: 'Link Expired',
          description: `This link expired on ${new Date(result.expiredAt).toLocaleDateString()}. Ask the sender for a fresh one.`,
          variant: 'destructive',
        });
        return null;
      case 'corrupt':
        return 'This link is damaged or incomplete. Ask the sender to copy it again.';
    }
  }, [encryptedPayload, applyImportedState, toast]);

  /** Discards a pending encrypted link and opens the blank editor. */
  const dismissEncrypted = useCallback(() => {
    setEncryptedPayload(null);
    clearShareHash();
  }, []);

  return {
    routingRequest,
    setRoutingRequest,
    hasEncryptedPending: encryptedPayload !== null,
    unlockEncrypted,
    dismissEncrypted,
  };
}
