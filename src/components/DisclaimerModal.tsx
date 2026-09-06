'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DISCLAIMERS } from '@/lib/security-utils';
import { hasSeenDisclaimer, markDisclaimerSeen } from '@/lib/storage-utils';
import { useHydrated } from '@/hooks/useHydrated';
import { useSyncedState } from '@/hooks/useSyncedState';

/**
 * D.8 (UX_POLICY_PLAN_2026-09, UX audit finding 7): first run used to be
 * a scrollable catalogue of every warning the app emits, shown as
 * documentation before the app was visible. A brand-new join met the
 * warning system before the format.
 *
 * What the drafter consents to stays on screen and stays verbatim: the
 * responsibility statement and the no-warranty terms are the same
 * strings from src/lib/security-utils.ts, unedited. The catalogue of
 * contextual warnings moves behind "Read the full guidance", which
 * carries the same four sections in the same words.
 */
export function DisclaimerModal() {
  // Closed on the server and during hydration (localStorage is not there
  // yet), then derived from the stored flag on the first client render.
  // Still directly settable by the close handler and the reopen event.
  const hydrated = useHydrated();
  const [isOpen, setIsOpen] = useSyncedState(hydrated, h => h && !hasSeenDisclaimer());
  const [showFull, setShowFull] = useState(false);

  const handleClose = () => {
    markDisclaimerSeen();
    setIsOpen(false);
  };

  // Allow reopening via a custom event or prop if needed,
  // but for now it listens to the 'open-disclaimer' event for the footer link
  useEffect(() => {
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('open-disclaimer', handleOpenEvent);
    return () => window.removeEventListener('open-disclaimer', handleOpenEvent);
  }, [setIsOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto native-scroll">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Before you start</DialogTitle>
          <DialogDescription>
            Semper Scribe is a non-official proof of concept. Two points to confirm, then the app opens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm mt-2">
          <section>
            <h3 className="text-sm font-semibold mb-1">Unclassified work on an authorised device</h3>
            <p className="text-muted-foreground">{DISCLAIMERS.OPSEC.userResponsibility}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-1">No warranty</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">{DISCLAIMERS.LEGAL_WARRANTY}</p>
          </section>
        </div>

        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setShowFull(v => !v)}
            aria-expanded={showFull}
            aria-controls="disclaimer-full-guidance"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm min-h-11 sm:min-h-0"
          >
            {showFull ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Read the full guidance
          </button>

          <div
            id="disclaimer-full-guidance"
            hidden={!showFull}
            className="mt-3 max-h-[45vh] overflow-y-auto pr-4 border rounded-md p-4 bg-muted/50 native-scroll"
          >
            <div className="space-y-6 text-sm">
              <section>
                <h3 className="text-lg font-semibold mb-2">1. Privacy and Data Handling (PII/PHI)</h3>
                <div className="space-y-2">
                  <p><strong>Context:</strong> Displayed when the application detects Personally Identifiable Information (SSN, EDIPI) or Protected Health Information (Medical keywords) in a document.</p>
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded border-l-4 border-yellow-500">
                    <p className="font-bold text-yellow-800 dark:text-yellow-200">Sensitive Data Detected!</p>
                    <p className="text-yellow-800 dark:text-yellow-200">{DISCLAIMERS.PII_WARNING.message}</p>
                  </div>

                  <p className="mt-4"><strong>Context:</strong> Displayed at the bottom of administrative forms.</p>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200">
                    <p className="font-bold text-red-800 dark:text-red-300">{DISCLAIMERS.FOUO_FOOTER.line1}</p>
                    <p className="text-red-700 dark:text-red-300 mb-2">{DISCLAIMERS.FOUO_FOOTER.text1}</p>
                    <p className="font-bold text-red-800 dark:text-red-300">{DISCLAIMERS.FOUO_FOOTER.line2}</p>
                    <p className="text-red-700 dark:text-red-300">{DISCLAIMERS.FOUO_FOOTER.text2}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">2. Security and Classification</h3>
                <p><strong>Context:</strong> Displayed when a user selects a classification level other than &quot;Unclassified&quot;.</p>
                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded border-l-4 border-orange-500">
                  <p className="font-bold text-orange-800 dark:text-orange-200">{DISCLAIMERS.CLASSIFIED_WARNING.title}</p>
                  <p className="text-orange-800 dark:text-orange-200">{DISCLAIMERS.CLASSIFIED_WARNING.message}</p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">3. Legal and Warranty (MIT License)</h3>
                <p><strong>Context:</strong> General software license covering the application codebase.</p>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded font-mono text-xs">
                  <p className="font-bold mb-1">No Warranty</p>
                  <p>{DISCLAIMERS.LEGAL_WARRANTY}</p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-2">4. Operational Security (OPSEC)</h3>
                <p><strong>Context:</strong> Implicit in the design of the &quot;Local-First&quot; architecture.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Local Processing:</strong> {DISCLAIMERS.OPSEC.localProcessing}
                  </li>
                  <li>
                    <strong>User Responsibility:</strong> {DISCLAIMERS.OPSEC.userResponsibility}
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>I Understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
