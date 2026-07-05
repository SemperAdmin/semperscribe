'use client';

import { useState, useEffect } from 'react';
import { getStateFromUrl, clearShareParam, SignatureRouting, ShareableState } from '@/lib/url-state';
import type { useToast } from '@/hooks/use-toast';

interface UseShareLinkLoaderArgs {
  handleImport: (state: ShareableState) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

/**
 * Loads shared state from a ?share= link on mount and surfaces the S2
 * routing slip when the link is a request for signature.
 */
export function useShareLinkLoader({ handleImport, toast }: UseShareLinkLoaderArgs) {
  // S2: routing slip arriving on a request-for-signature link
  const [routingRequest, setRoutingRequest] = useState<SignatureRouting | null>(null);

  // Load shared state from URL on mount
  useEffect(() => {
    const sharedState = getStateFromUrl();
    if (sharedState) {
      handleImport(sharedState);
      clearShareParam();
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
    }
    // Mount-only by design: the share param is consumed exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { routingRequest, setRoutingRequest };
}
