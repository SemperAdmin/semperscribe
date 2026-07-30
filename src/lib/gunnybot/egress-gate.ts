/**
 * Egress consent gate.
 *
 * The pre-send scan flags high-confidence structured identifiers (SSN,
 * EDIPI) in text bound for a provider. Rather than blocking the send, the
 * gate asks the user to acknowledge the finding and choose. This matches
 * the app's disclosure model: the user owns responsibility for what they
 * type, and the app's duty is to make the risk visible before it leaves
 * the browser.
 *
 * The UI half is GunnyBotRuntime, mounted once at the app root. It
 * registers a handler here on mount and tears it down on unmount.
 *
 * Fail closed: with no handler registered there is no way to obtain
 * informed consent, so a flagged payload does not leave the browser.
 */

export type EgressAckHandler = (findings: string[]) => Promise<boolean>;

let ackHandler: EgressAckHandler | null = null;

export function registerEgressAckHandler(next: EgressAckHandler | null): void {
  ackHandler = next;
}

export function hasEgressAckHandler(): boolean {
  return ackHandler !== null;
}

/**
 * Resolves true when the send is cleared to proceed. An empty finding
 * list needs no consent. A populated list with no mounted handler
 * resolves false.
 */
export async function requestEgressAck(findings: string[]): Promise<boolean> {
  if (findings.length === 0) {
    return true;
  }
  if (ackHandler === null) {
    return false;
  }
  return ackHandler(findings);
}
