'use client';

import { useEffect, useCallback } from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useSyncedState } from '@/hooks/useSyncedState';
import { consumeEdmsPrefill, clearEdmsHash, getEdmsPrefillFromHash, type EdmsPrefill } from '@/lib/edms-handoff';
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

/** What the page was opened with, read once from the URL. */
type InboundLink =
  | { kind: 'none' }
  | { kind: 'edms'; prefill: EdmsPrefill }
  | { kind: 'encrypted'; payload: string }
  | { kind: 'shared'; state: ShareableState };

const NO_LINK: InboundLink = { kind: 'none' };

/**
 * Pure read of the inbound link, in priority order: EDMS handoff, then
 * the encrypted fragment, then the legacy query param. Consuming the
 * URL (latching EDMS mode, clearing the hash or param) happens in the
 * effect and handlers below, never here.
 */
function readInboundLink(): InboundLink {
  const prefill = getEdmsPrefillFromHash();
  if (prefill) return { kind: 'edms', prefill };
  const payload = getEncryptedPayloadFromHash();
  if (payload) return { kind: 'encrypted', payload };
  const state = getStateFromUrl();
  if (state) return { kind: 'shared', state };
  return NO_LINK;
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
  // The URL is read on the first client render, never during the
  // static-export prerender (no window there) or the hydration render
  // (the markup has to match the export). useHydrated flips once.
  const hydrated = useHydrated();
  const [inbound] = useSyncedState(hydrated, (h): InboundLink => (h ? readInboundLink() : NO_LINK));

  // S2: routing slip arriving on a request-for-signature link
  const [routingRequest, setRoutingRequest] = useSyncedState(inbound, (): SignatureRouting | null => null);

  // P1.1: encrypted payload waiting for a password
  const [encryptedPayload, setEncryptedPayload] = useSyncedState(inbound, (link): string | null =>
    link.kind === 'encrypted' ? link.payload : null,
  );

  // Decoded `?share=` state waiting for the user's go-ahead
  const [pendingShared, setPendingShared] = useSyncedState(inbound, (link): ShareableState | null =>
    link.kind === 'shared' ? link.state : null,
  );

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

  // EDMS handoff. It latches EDMS mode, which gates GunnyBot egress in
  // lib/gunnybot/client.ts, so it runs as soon as the link is read and
  // before anything else can reach a provider. consumeEdmsPrefill() sets
  // the mode; the callback seeds the form. There is no document to
  // import. The hash is cleared so a reload does not re-run it.
  useEffect(() => {
    if (inbound.kind !== 'edms') return;
    consumeEdmsPrefill();
    onEdmsPrefill?.(inbound.prefill);
    clearEdmsHash();
    // Consumed once per inbound link; the callback is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbound]);

  /** User confirmed the plain share link: import it and consume the param. */
  const confirmShared = useCallback(() => {
    if (!pendingShared) return;
    applyImportedState(pendingShared);
    setPendingShared(null);
    clearShareParam();
  }, [pendingShared, applyImportedState, setPendingShared]);

  /** Discards a pending plain share link and opens the blank editor. */
  const dismissShared = useCallback(() => {
    setPendingShared(null);
    clearShareParam();
  }, [setPendingShared]);

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
  }, [encryptedPayload, applyImportedState, toast, setEncryptedPayload]);

  /** Discards a pending encrypted link and opens the blank editor. */
  const dismissEncrypted = useCallback(() => {
    setEncryptedPayload(null);
    clearShareHash();
  }, [setEncryptedPayload]);

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
