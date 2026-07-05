'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DISCLAIMERS } from '@/lib/security-utils';
import { hasSeenDisclaimer, markDisclaimerSeen } from '@/lib/storage-utils';

export function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenDisclaimer()) {
      setIsOpen(true);
    }
  }, []);

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
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Application Disclaimers and Warnings</DialogTitle>
          <DialogDescription>
            Please review the following security, privacy, and legal information.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[50vh] pr-4 mt-4 border rounded-md p-4 bg-muted/50">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-lg font-semibold mb-2">1. Privacy & Data Handling (PII/PHI)</h3>
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
              <h3 className="text-lg font-semibold mb-2">2. Security & Classification</h3>
              <p><strong>Context:</strong> Displayed when a user selects a classification level other than "Unclassified".</p>
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded border-l-4 border-orange-500">
                <p className="font-bold text-orange-800 dark:text-orange-200">{DISCLAIMERS.CLASSIFIED_WARNING.title}</p>
                <p className="text-orange-800 dark:text-orange-200">{DISCLAIMERS.CLASSIFIED_WARNING.message}</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">3. Legal & Warranty (MIT License)</h3>
              <p><strong>Context:</strong> General software license covering the application codebase.</p>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded font-mono text-xs">
                <p className="font-bold mb-1">No Warranty</p>
                <p>{DISCLAIMERS.LEGAL_WARRANTY}</p>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">4. Operational Security (OPSEC)</h3>
              <p><strong>Context:</strong> Implicit in the design of the "Local-First" architecture.</p>
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
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose}>I Understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
