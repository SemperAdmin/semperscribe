import { scanForSensitiveData } from '@/lib/security-utils';
import type { SecurityScanResult } from '@/lib/security-utils';
import { requestEgressAck } from './egress-gate';

export interface RedactionVerdict {
  /** True when the payload carries a structured identifier needing consent. */
  requiresAck: boolean;
  findings: string[];
  scan: SecurityScanResult;
}

/**
 * Pre-send scan for every GunnyBot egress path.
 *
 * Scope is deliberately narrow: high-confidence structured identifiers
 * only, meaning the SSN digit pattern and the 10-digit EDIPI. The PHI
 * keyword list in security-utils is NOT consulted here. It matches bare
 * substrings with no word boundaries, so ordinary correspondence
 * vocabulary (Branch Health Clinic, Naval Hospital, medical readiness,
 * hospitality, outpatient) tripped it constantly. Keyword matching is a
 * poor control and a worse user experience, and the app's disclosure
 * model already places responsibility for input on the user.
 *
 * A finding no longer blocks. It routes through the egress consent gate.
 */
export function screenOutbound(payload: string): RedactionVerdict {
  const scan = scanForSensitiveData(payload);
  return {
    requiresAck: scan.hasPII,
    findings: scan.piiMatches,
    scan,
  };
}

/**
 * Scan, and when something is flagged, ask the user. Resolves true when
 * the caller is cleared to send. Every GunnyBot egress path awaits this
 * before calling streamChat.
 */
export async function clearedForEgress(payload: string): Promise<boolean> {
  const verdict = screenOutbound(payload);
  if (!verdict.requiresAck) {
    return true;
  }
  return requestEgressAck(verdict.findings);
}
