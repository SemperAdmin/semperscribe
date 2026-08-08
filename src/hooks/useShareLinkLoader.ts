'use client';

import { useState, useEffect, useCallback } from 'react';
import { consumeEdmsPrefill, clearEdmsHash, type EdmsPrefill } from '@/lib/edms-handoff';
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
  /**
   * EDMS handoff. Receives the scalar prefill from a `#edms=` link and
   * seeds the form. This is NOT an import: there is no document in the
   * payload, only RUC, SSIC, document type, and section.
   */
  onEdmsPrefill?: (prefill: EdmsPrefill) => void;
}

/**
 * Loads shared state from a share link on mount and surfaces the S2
 * routing slip when the link is a request for signature.
 *
 * Two inbound formats (P1.1, DONDOCS_PARITY_PLAN):
 * - Legacy `?share=` query param: plain lz-string, held until the user
 *   confirms through the ConfirmShareDialog, then imported. The link is
 *   attacker-constructable (no password, no integrity), so nothing from
 *   it may load silently — a fabricated letter with a routing slip would
 *   otherwise render an authentic-looking signature request unprompted.
 * - Encrypted `#es=` fragment: held until the user supplies the
 *   password through the UnlockShareDialog, then imported. Entering the
 *   password IS the consent step for this format.
 */
export function useShareLinkLoader({ handleImport, toast, onComments, onEdmsPrefill }: UseShareLinkLoaderArgs) {
  // S2: routing slip arriving on a request-for-signature link
  const [routingRequest, setRoutingRequest] = useState<SignatureRouting | null>(null);

  // P1.1: encrypted payload waiting for a password
  const [encryptedPayload, setEncryptedPayload] = useState<string | null>(null);

  // Decoded `?share=` state waiting for the user's go-ahead
  const [pendingShared, setPendingShared] = useState<ShareableState | null>(null);

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
    // EDMS handoff first. It latches EDMS mode, which gates GunnyBot
    // egress in lib/gunnybot/client.ts, so it has to run before anything
    // else can reach a provider. consumeEdmsPrefill() sets the mode; the
    // callback seeds the form. There is no document to import.
    const prefill = consumeEdmsPrefill();
    if (prefill) {
      onEdmsPrefill?.(prefill);
      clearEdmsHash();
      return;
    }

    // Encrypted fragment takes priority over the legacy query param.
    const payload = getEncryptedPayloadFromHash();
    if (payload) {
      setEncryptedPayload(payload);
      return;
    }

    const sharedState = getStateFromUrl();
    if (sharedState) {
      // Held, not imported: the user confirms first (ConfirmShareDialog).
      setPendingShared(sharedState);
    }
    // Mount-only by design: the share param is consumed exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** User confirmed the plain share link: import it and consume the param. */
  const confirmShared = useCallback(() => {
    if (!pendingShared) return;
    applyImportedState(pendingShared);
    setPendingShared(null);
    clearShareParam();
  }, [pendingShared, applyImportedState]);

  /** Discards a pending plain share link and opens the blank editor. */
  const dismissShared = useCallback(() => {
    setPendingShared(null);
    clearShareParam();
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
    /** Pending plain `?share=` link awaiting user confirmation. */
    sharedPending: pendingShared === null ? null : {
      subject: pendingShared.formData?.subj || undefined,
      requestsSignature: Boolean(pendingShared.routing),
    },
    confirmShared,
    dismissShared,
  };
}
