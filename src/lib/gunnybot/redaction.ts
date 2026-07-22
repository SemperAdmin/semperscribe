import { scanForSensitiveData } from '@/lib/security-utils';
import type { SecurityScanResult } from '@/lib/security-utils';

export interface RedactionVerdict {
  blocked: boolean;
  findings: string[];
  scan: SecurityScanResult;
}

/**
 * Pre-send gate. Reuses the app's existing sensitive-data scanner. When
 * SSN, EDIPI, or PHI markers appear in the outbound payload, the send
 * blocks until the user overrides through the egress consent gate.
 */
export function screenOutbound(payload: string): RedactionVerdict {
  const scan = scanForSensitiveData(payload);
  const findings = [...scan.piiMatches, ...scan.phiMatches];
  return {
    blocked: scan.hasPII || scan.hasPHI,
    findings,
    scan,
  };
}
