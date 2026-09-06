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
import { registerExportAckHandler } from '@/lib/export-gate';

/**
 * Pre-export consent dialog. Registers the acknowledgment handler that
 * lib/export-gate calls when the pre-download scan flags a personal
 * identifier, and renders the dialog the user answers.
 *
 * Mount once at the app root, next to GunnyBotRuntime.
 */
export function ExportScanGate() {
  const [findings, setFindings] = useState<string[] | null>(null);
  const resolveRef = useRef<((cleared: boolean) => void) | null>(null);

  useEffect(() => {
    registerExportAckHandler(
      next =>
        new Promise<boolean>(resolve => {
          resolveRef.current = resolve;
          setFindings(next);
        }),
    );
    return () => {
      registerExportAckHandler(null);
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
          <AlertDialogTitle>Sensitive data detected</AlertDialogTitle>
          <AlertDialogDescription>
            This document looks like it contains personal or health information. Once exported, the file is
            outside the app and subject to your command&apos;s handling rules for PII and PHI.
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
          Cancel to edit the document first. This check looks for SSN and EDIPI patterns and clusters of
          medical keywords. It does not certify the document is free of CUI, PII, or classified material.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel and edit</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>Export anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
