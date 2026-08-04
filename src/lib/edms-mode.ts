/**
 * EDMS mode.
 *
 * Set when SemperScribe is launched from EDMS through the `#edms=`
 * fragment (see lib/edms-handoff.ts). While active, the app is drafting a
 * document bound for a DoD IL5 records system, so controls apply that do
 * not apply to ordinary use:
 *
 *   1. GunnyBot egress is restricted to GenAI.mil. Enforced at the single
 *      send choke point in lib/gunnybot/client.ts, NOT in the settings UI.
 *      A settings default is not a control.
 *   2. Share links are suppressed. A share URL carries the whole letter,
 *      and mailing one out of an EDMS context defeats the point of routing
 *      the package through the records system.
 *   3. Exports take the EDMS filename convention.
 *
 * State lives in sessionStorage, never localStorage. It has to die with
 * the tab. A stale EDMS context surviving into an unrelated draft would
 * mislabel that draft's export.
 *
 * Framework-free on purpose: lib/gunnybot/client.ts is not a React module
 * and reads this synchronously.
 */

const STORAGE_KEY = 'semperscribe.edms.v1';

/** The only provider cleared for egress while EDMS mode is active. */
export const EDMS_ALLOWED_PROVIDER = 'genaimil';

export interface EdmsContext {
  /**
   * EDMS request ID. Optional. Absent is the normal case when the drafter
   * starts from the New Request screen, where no request row exists yet.
   *
   * Correlation does NOT depend on this. What SemperScribe produces is an
   * attachment, and the EDMS attachment control uploads it against the
   * request it belongs to, so a file attached on the New Request screen
   * lands on the right request whatever it is named. The ID in the
   * filename is a guardrail for the Request Detail screen, where many
   * requests are in play and a Marine can attach to the wrong one.
   */
  requestId?: string;
  /** Unit RUC. Resolves letterhead through lib/units.ts. */
  ruc: string;
  /** Four or five digit SSIC. Resolves through lib/ssic.ts. */
  ssic: string;
  /** DOCUMENT_TYPES key from lib/schemas.ts. */
  docType: string;
  /** Reviewing section. Seeds the Via chain. Optional. */
  section?: string;
}

// undefined means "not read yet". null means "read, and not set".
let cached: EdmsContext | null | undefined;

export function setEdmsContext(ctx: EdmsContext): void {
  cached = ctx;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // Private mode or quota. The in-memory cache still holds for this
    // page's lifetime, which is the case the egress gate depends on.
  }
}

export function getEdmsContext(): EdmsContext | null {
  if (cached !== undefined) return cached;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as EdmsContext) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isEdmsMode(): boolean {
  return getEdmsContext() !== null;
}

export function clearEdmsContext(): void {
  cached = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do. The in-memory cache is already cleared.
  }
}

/** Test seam. Drops the in-memory cache without touching storage. */
export function resetEdmsCacheForTests(): void {
  cached = undefined;
}

/**
 * Filename both EDMS artifacts derive from.
 *
 * DRAFT is the unsigned export. SIGNED is what returns after the signer
 * applies a CAC signature in Acrobat. EDMS reads the suffix to set the
 * library Category column.
 */
export function edmsBaseFilename(
  ctx: EdmsContext,
  state: 'DRAFT' | 'SIGNED',
  now: Date = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const stamp = String(y) + m + d;

  // With a request ID, lead with it. EDMS tests the leading digits to warn
  // when a file is attached to a request whose ID does not match.
  //
  // Without one, lead with the literal SS, not the SSIC. An SSIC is four
  // or five digits, so an SSIC-led name would satisfy that same
  // leading-digits test and false-warn on every SemperScribe file. The two
  // prefixes have to be distinguishable, not merely different.
  const head = ctx.requestId ? ctx.requestId : 'SS';
  return head + '_' + ctx.ssic + '_' + stamp + '_' + ctx.docType + '_' + state;
}
