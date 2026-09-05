/**
 * Pre-export consent gate.
 *
 * Every download path (PDF, DOCX, official-form PDF, batch ZIP) runs the
 * document through scanForSensitiveData before the file leaves the
 * browser. A hit does not block the export. It asks the user to look at
 * the finding and choose, the same disclosure model the GunnyBot egress
 * gate uses: the user owns what they type, and the app's duty is to make
 * the risk visible before the file exists on disk.
 *
 * Findings are kept to high-confidence signals so the dialog does not
 * fire on every routine letter:
 * - SSN and EDIPI patterns always report.
 * - PHI keywords report only when two or more distinct keywords hit.
 *   One "medical" in a billet title is not a health record.
 *
 * The UI half is ExportScanGate, mounted once at the app root. It
 * registers a handler here on mount and tears it down on unmount. With
 * no handler mounted the gate falls back to window.confirm so the check
 * still runs on any route the dialog is not mounted on.
 */

import { scanForSensitiveData } from '@/lib/security-utils';

export type ExportAckHandler = (findings: string[]) => Promise<boolean>;

let ackHandler: ExportAckHandler | null = null;

export function registerExportAckHandler(next: ExportAckHandler | null): void {
  ackHandler = next;
}

export function hasExportAckHandler(): boolean {
  return ackHandler !== null;
}

/**
 * Runs the scan and returns the human-readable findings the dialog
 * shows. Empty means the export proceeds without a prompt.
 */
export function exportFindings(data: unknown): string[] {
  const scan = scanForSensitiveData(data);
  const findings = [...scan.piiMatches];
  if (scan.phiMatches.length >= 2) {
    findings.push(`Possible PHI keywords: ${scan.phiMatches.join(', ')}`);
  }
  return findings;
}

/**
 * Resolves true when the export is cleared to proceed. An empty finding
 * list needs no consent.
 */
export async function requestExportAck(findings: string[]): Promise<boolean> {
  if (findings.length === 0) {
    return true;
  }
  if (ackHandler !== null) {
    return ackHandler(findings);
  }
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(
      'Sensitive data detected in this document:\n\n- ' +
        findings.join('\n- ') +
        '\n\nReview the document before exporting. Export anyway?',
    );
  }
  return false;
}

/** Scan plus prompt in one call. The single entry point export paths use. */
export async function clearedForExport(data: unknown): Promise<boolean> {
  return requestExportAck(exportFindings(data));
}
