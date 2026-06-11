/**
 * Archetype-locked font policy (Phase 3 P3.1, audit gap G7, matrix C1).
 *
 * USMC directives (MCO 5215.1K): Courier New, 10 or 12 point ONLY.
 * SECNAV directives (SECNAV M-5215.1): Courier New 12 ONLY. Reserved
 *   for Phase 4; no current document type maps to it yet.
 * Correspondence (SECNAV M-5216.5): Times New Roman 12 preferred,
 *   Courier New 12 permitted. User-selectable, unchanged.
 *
 * Free font choice on directives is a compliance defect (G7). The
 * resolver coerces at generation time so stale form state (a font
 * picked under a previously selected document type) can never leak
 * into a directive export — same defect class as the Phase 2 P2.8
 * via false positive.
 */

export type BodyFont = 'times' | 'courier';
export type FontArchetype =
  | 'correspondence'
  | 'usmc-directive'
  | 'secnav-directive';

/** USMC directive document types (MCO 5215.1K applies). */
const USMC_DIRECTIVE_TYPES = new Set<string>([
  'mco',
  'bulletin',
  'change-transmittal',
]);

/** SECNAV directive document types (none yet; Phase 4 adds them). */
const SECNAV_DIRECTIVE_TYPES = new Set<string>([]);

export function getFontArchetype(documentType: string): FontArchetype {
  if (USMC_DIRECTIVE_TYPES.has(documentType)) return 'usmc-directive';
  if (SECNAV_DIRECTIVE_TYPES.has(documentType)) return 'secnav-directive';
  return 'correspondence';
}

/** Fonts the UI may offer for a document type. Order = preference. */
export function getAllowedBodyFonts(documentType: string): BodyFont[] {
  switch (getFontArchetype(documentType)) {
    case 'usmc-directive':
    case 'secnav-directive':
      return ['courier'];
    case 'correspondence':
      return ['times', 'courier'];
  }
}

/** Point sizes permitted per archetype (P3.2 consumes this). */
export function getAllowedFontSizesPt(documentType: string): number[] {
  switch (getFontArchetype(documentType)) {
    case 'usmc-directive':
      return [10, 12]; // MCO 5215.1K
    case 'secnav-directive':
      return [12];
    case 'correspondence':
      return [12];
  }
}

/**
 * Coerce a requested body font to one the archetype permits.
 * Correspondence passes through (default times). Directives always
 * resolve to courier regardless of form state.
 */
export function resolveBodyFont(
  documentType: string,
  requested: string | undefined,
): BodyFont {
  const allowed = getAllowedBodyFonts(documentType);
  const req: BodyFont = requested === 'courier' ? 'courier' : 'times';
  return allowed.includes(req) ? req : allowed[0];
}

/**
 * Directive letterhead rule (user ruling 2026-06-10): USMC directives
 * carry Navy or Marine Corps letterhead only — never DLA. Coerced at
 * generation time alongside the font (stale form state defense).
 */
export function resolveHeaderType(
  documentType: string,
  requested: string | undefined,
): string {
  if (getFontArchetype(documentType) === 'usmc-directive' && requested === 'DLA') {
    return 'USMC';
  }
  return requested ?? 'USMC';
}
