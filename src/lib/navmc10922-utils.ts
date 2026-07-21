/**
 * NAVMC 10922 shared helpers - used by the Phase 2 section components
 * and the Phase 3 validators so both sides agree on every number.
 * Rule source: docs/NAVMC_10922_SPEC.md.
 */

import { Navmc10922Dependent } from '@/types/navmc';

/**
 * Field 93 (Section 7 documents-viewed) capacity in characters.
 *
 * Derivation from the XFA template: width 152.4mm minus 1.0008mm
 * insets each side = 150.4mm = 426.4pt, Times New Roman with no
 * declared size (XFA default 10pt), average glyph ~5pt mixed case.
 * 426 / 5 = ~85. ALL-CAPS entries run ~6.5pt average and fit ~65.
 * The widget is multiLine with vScrollPolicy="off" in a one-line box,
 * so overflow CLIPS SILENTLY in Adobe - this cap is load-bearing.
 */
export const NAVMC10922_DOCS_VIEWED_CAPACITY = 85;

/** Loose date parse: native date-input ISO first, Date.parse fallback. */
export function parseDateLoose(value: string | undefined | null): Date | null {
  if (!value || !value.trim()) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** M/D/YY - the template's picture clause for every grid date. */
export function formatMDYY(value: string): string {
  const d = parseDateLoose(value);
  if (!d) return value;
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** MMM D, YYYY - the picture clause on DATE OF APPLICATION (index 0). */
export function formatMMMDYYYY(value: string): string {
  const d = parseDateLoose(value);
  if (!d) return value;
  return `${MMM[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export interface ClaimedFromSuggestion {
  /** ISO date to place in DATE ALLOWANCE CLAIMED FROM. */
  date: string;
  /** Which acquisition event supplied it. */
  basis: 'marriage' | 'birth';
  /** Citation shown to the user. */
  citation: string;
}

const RULE5 = 'FMR Vol 7A Ch 26 (May 2025) para 10.3, Table 26-1 rule 5';

/**
 * Effective-date assist per spec section 10a. Computes only where the
 * acquisition date is unambiguous from captured data:
 *   SPOUSE / STEPSON / STEPDAUGHTER -> present marriage date
 *   SON / DAUGHTER                  -> the row's date of birth
 * ADOPTED and OUT OF WEDLOCK return null - the acquisition event
 * (adoption decree date, support commencement) is not a captured
 * field, so the app prompts instead of guessing.
 */
export function suggestAllowanceClaimedFrom(
  row: Pick<Navmc10922Dependent, 'relationship' | 'dateOfBirth'>,
  marriageDate: string | undefined
): ClaimedFromSuggestion | null {
  switch (row.relationship) {
    case 'SPOUSE':
    case 'STEPSON':
    case 'STEPDAUGHTER': {
      const d = parseDateLoose(marriageDate);
      if (!d) return null;
      return { date: toIsoDate(d), basis: 'marriage', citation: RULE5 };
    }
    case 'SON':
    case 'DAUGHTER': {
      const d = parseDateLoose(row.dateOfBirth);
      if (!d) return null;
      return { date: toIsoDate(d), basis: 'birth', citation: RULE5 };
    }
    default:
      return null;
  }
}

/** Hint text for relationships the assist deliberately does not compute. */
export function claimedFromHint(relationship: string): string | null {
  switch (relationship) {
    case 'ADOPTED SON':
    case 'ADOPTED DAUGHTER':
      return 'Enter the date of adoption (FMR May 2025 para 10.3 - date the dependent is acquired).';
    case 'CHILD BORN OUT OF WEDLOCK':
      return 'No computed date - enter the acquisition date and attach the para 3.2.1.3.3 parentage evidence.';
    default:
      return null;
  }
}

/** True when two date strings resolve to the same calendar day. */
export function sameDay(a: string, b: string): boolean {
  const da = parseDateLoose(a);
  const db = parseDateLoose(b);
  if (!da || !db) return false;
  return toIsoDate(da) === toIsoDate(db);
}

export interface SuggestedDocument {
  /** Item text as it lands in the Section 7 line. */
  label: string;
  /** Rule the requirement comes from. */
  citation: string;
}

/** First word of a dependent name for compact per-person item labels. */
function shortName(name: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? ` (${first.replace(/,+$/, '')})` : '';
}

/**
 * Section 7 documents-viewed checklist, derived from what the
 * application actually claims (docs/NAVMC_10922_SPEC.md sections 6-7).
 * Each item is one comma-separated entry on the printed line; the
 * component adds custom items on top.
 */
// The `& Record<string, unknown>` intersections below are load-bearing:
// these parameter shapes are all-optional ("weak types"), and the app's
// loose FormData bag ({ documentType } + index signature) shares no
// declared property with them - TypeScript's weak-type check then
// REJECTS the call outright (broke the Next build 2026-07-21). The
// intersection keeps the shape documentation while accepting FormData.
export function suggestedDocuments(formData: {
  reason?: string;
  dependents?: Array<Partial<Navmc10922Dependent>>;
  dissolutions?: Array<{ reason?: string }>;
  courtOrderInEffect?: string;
  lostDependentName?: string;
  lostEventType?: string;
  marriageType?: string;
} & Record<string, unknown>): SuggestedDocument[] {
  const out: SuggestedDocument[] = [];
  const seen = new Set<string>();
  const add = (label: string, citation: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    out.push({ label, citation });
  };

  // Previously approved dependents were substantiated on the earlier
  // application - the cancelled checklist's own convention was to note
  // "documents previously viewed" rather than re-attach. Only NEW
  // dependents drive the evidence list.
  const deps = (formData.dependents ?? []).filter(
    (r) => (r.name?.trim() || r.relationship) && !r.previouslyApproved
  );
  for (const r of deps) {
    switch (r.relationship) {
      case 'SPOUSE':
        // Evidence branches by marriage type (MCO 1751.3 Ch 1 para 3).
        // The type tag prints on the Section 7 line - the reviewer at
        // CMC (MFP-1) sees the marriage type on the form itself, since
        // the paper carries no marriage-type field of its own.
        switch (formData.marriageType) {
          case 'foreign':
            add('ORIGINAL MARRIAGE CERTIFICATE (FOREIGN)', 'MCO 1751.3 Ch 1 para 3.g - viewed by the attesting officer');
            add('CERTIFIED ENGLISH TRANSLATION', 'MCO 1751.3 Ch 1 para 3.g - full translation of the marriage certificate by a certified translator');
            break;
          case 'proxy-telephone':
            add('CERTIFIED TRUE COPY OF MARRIAGE LICENSE AND CERTIFICATE (PROXY)', 'MCO 1751.3 Ch 1 para 3.b - from the state the marriage was contracted in; forwarded to CMC (MFP-1) with supporting documentation');
            break;
          case 'common-law':
            add('DECLARATION AND REGISTRATION OF INFORMAL MARRIAGE (COMMON-LAW)', 'MCO 1751.3 Ch 1 para 3.a - certified true copies from the contracting state; forwarded to CMC (MFP-1)');
            break;
          case 'indian-tribal':
            add('MARRIAGE CERTIFICATE (INDIAN TRIBAL)', 'MCO 1751.3 Ch 1 para 3.e - considered doubtful in all cases; forward with supporting documentation to CMC (MFP-1). Valid only when both parties were tribe members living as part of the tribe or on a reservation');
            break;
          default:
            add('MARRIAGE CERTIFICATE', 'MCO 1751.3 Ch 1 para 3.f - viewed by the CO');
        }
        break;
      case 'SON':
      case 'DAUGHTER':
        add(`BIRTH CERTIFICATE${shortName(r.name ?? '')}`, 'MCO 1751.3 Ch 1 para 5 - birth certificate viewed at command level');
        break;
      case 'STEPSON':
      case 'STEPDAUGHTER':
        add('MARRIAGE CERTIFICATE', 'MCO 1751.3 Fig 1-1 (Step-Children item 2)');
        add(`BIRTH CERTIFICATE${shortName(r.name ?? '')}`, 'MCO 1751.3 Fig 1-1 (Step-Children item 3) - shows the spouse is the child\'s parent');
        break;
      case 'ADOPTED SON':
      case 'ADOPTED DAUGHTER':
        add(`ADOPTION DECREE${shortName(r.name ?? '')}`, 'MCO 1751.3 Fig 1-1 (Adopted Children item 2)');
        break;
      case 'CHILD BORN OUT OF WEDLOCK':
        add(`BIRTH CERTIFICATE NAMING MEMBER${shortName(r.name ?? '')}`, 'FMR Vol 7A Ch 26 (May 2025) para 3.2.1.3.3 - or a court order, or a signed notarized affidavit of parentage');
        break;
    }
  }

  for (const d of formData.dissolutions ?? []) {
    switch (d.reason) {
      case 'divorce':
        if ((d as { foreignDivorce?: boolean }).foreignDivorce) {
          // Ch 1 para 4.b - the order's heaviest evidence set. Labels
          // stay compact for field 93; citations carry the full text.
          add('FOREIGN DIVORCE DECREE & MARRIAGE CERT W/TRANSLATIONS', 'MCO 1751.3 Ch 1 para 4.b - certified true copies of the original marriage certificate and original divorce decree, with English translations of both; forwarded to CMC (MFP-1). Request legal review first (para 4.b note)');
          add('PROOF OF RESIDENCY', 'MCO 1751.3 Ch 1 para 4.b - residence/domicile of the parties at the time the foreign divorce action commenced decides validity');
        } else {
          add('ORIGINAL DIVORCE DECREE', 'MCO 1751.3 Ch 1 para 4.a - the ORIGINAL decree from a US court with jurisdiction; the CO may request other supporting documentation');
        }
        break;
      case 'annulment':
        add('PETITION AND DECREE OF ANNULMENT', 'MCO 1751.3 Ch 1 para 3.d - BOTH the petition and the decree, submitted to CMC (MFP-1) for determination');
        break;
      case 'death':
        add('DEATH CERTIFICATE (FORMER SPOUSE)', 'NAVMC 10922 Section 4 dissolution evidence');
        break;
    }
  }

  // Fig 1-1 items 4-5: contribution proof for any NEW dependent living
  // outside the member's household. The trigger is the flag the
  // Section 2 rows already carry.
  if (deps.some((r) => (r as { livesOutsideHousehold?: boolean }).livesOutsideHousehold)) {
    add('PROOF OF MONTHLY SUPPORT CONTRIBUTION', 'MCO 1751.3 Fig 1-1 items 4-5 / Fig 1-2 note - money orders, cancelled checks, transfers, allotments, or billing+bank statements. CASH PAYMENTS ARE NEVER ACCEPTABLE proof of support');
  }

  if (formData.courtOrderInEffect === 'yes') {
    add('COPY OF COURT ORDER/AGREEMENT', 'NAVMC 10922 Section 4 - "IF YES ... ATTACH A COPY"');
  }

  // LOSS evidence keys off the loss event, not the roster - the lost
  // dependent has no Section 2 row.
  if (formData.reason === 'loss') {
    switch (formData.lostEventType) {
      case 'divorce':
        add('ORIGINAL DIVORCE DECREE', 'MCO 1751.3 Ch 1 para 4.a - the ORIGINAL decree; foreign nation divorces route to CMC (MFP-1) with the para 4.b evidence set');
        break;
      case 'annulment':
        add('PETITION AND DECREE OF ANNULMENT', 'MCO 1751.3 Ch 1 para 3.d - BOTH the petition and the decree, to CMC (MFP-1)');
        break;
      case 'death':
        add(`DEATH CERTIFICATE${shortName(formData.lostDependentName ?? '')}`, 'NAVMC 10922 loss evidence');
        break;
    }
  }

  return out;
}

/**
 * Suggested Section 7 loss narrative from the LOSS panel. The user
 * adopts it explicitly (spec decision 10 - the app suggests, the user
 * composes); null while the panel is incomplete.
 */
export function lossNarrative(formData: {
  lostDependentName?: string;
  lostDependentRelationship?: string;
  lostEffectiveDate?: string;
} & Record<string, unknown>): string | null {
  const name = (formData.lostDependentName ?? '').trim().toUpperCase();
  const rel = (formData.lostDependentRelationship ?? '').trim().toUpperCase();
  const date = parseDateLoose(formData.lostEffectiveDate ?? '');
  if (!name || !rel || !date) return null;
  return `LOSS OF ${rel} ${name} EFF ${formatMDYY(toIsoDate(date))}`;
}

// Section 7 sworn date: the form wants three separate elements - day,
// full month name (the XFA choiceList at index 83), and a 2-digit year
// after the pre-printed "20". One picker feeds all three.
export const NAVMC10922_SWORN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export interface SwornDateParts {
  swornDay: string;
  swornMonth: string;
  swornYear2Digit: string;
}

/** Date -> the three form elements. */
export function swornPartsFromDate(d: Date): SwornDateParts {
  return {
    swornDay: String(d.getDate()),
    swornMonth: NAVMC10922_SWORN_MONTHS[d.getMonth()],
    swornYear2Digit: String(d.getFullYear() % 100).padStart(2, '0'),
  };
}

/** The three form elements -> Date, null when incomplete or invalid.
 *  The printed "20" century prefix pins years to 20xx. */
export function swornPartsToDate(parts: Partial<SwornDateParts>): Date | null {
  const day = Number(String(parts.swornDay ?? '').trim());
  const monthIndex = NAVMC10922_SWORN_MONTHS.indexOf(
    (String(parts.swornMonth ?? '').trim()) as (typeof NAVMC10922_SWORN_MONTHS)[number]
  );
  const yy = String(parts.swornYear2Digit ?? '').trim();
  if (!Number.isInteger(day) || day < 1 || day > 31 || monthIndex < 0 || !/^\d{1,2}$/.test(yy)) {
    return null;
  }
  const d = new Date(2000 + Number(yy), monthIndex, day);
  return d.getMonth() === monthIndex && d.getDate() === day ? d : null;
}

/**
 * Machine-generated (managed) checklist labels. When the scenario
 * changes - marriage type switched, relationship removed, court order
 * answered NO - a managed item that is no longer suggested is STALE and
 * the checklist removes it from the printed line automatically. User
 * custom items and the LOSS narrative never match these patterns and
 * are never touched.
 */
const MANAGED_DOC_PATTERNS: RegExp[] = [
  /^MARRIAGE CERTIFICATE$/,
  /^MARRIAGE CERTIFICATE \(INDIAN TRIBAL\)$/,
  /^ORIGINAL MARRIAGE CERTIFICATE \(FOREIGN\)$/,
  /^CERTIFIED ENGLISH TRANSLATION$/,
  /^CERTIFIED TRUE COPY OF MARRIAGE LICENSE AND CERTIFICATE \(PROXY\)$/,
  /^DECLARATION AND REGISTRATION OF INFORMAL MARRIAGE \(COMMON-LAW\)$/,
  /^BIRTH CERTIFICATE( NAMING MEMBER)?( \(.+\))?$/,
  /^ADOPTION DECREE( \(.+\))?$/,
  /^FINAL DIVORCE DECREE$/, // legacy label - stays managed so old lines migrate
  /^ORIGINAL DIVORCE DECREE$/,
  /^FOREIGN DIVORCE DECREE & MARRIAGE CERT W\/TRANSLATIONS$/,
  /^PROOF OF RESIDENCY$/,
  /^ANNULMENT DECREE$/, // legacy label
  /^PETITION AND DECREE OF ANNULMENT$/,
  /^DEATH CERTIFICATE \(.+\)$/,
  /^COPY OF COURT ORDER\/AGREEMENT$/,
  /^PROOF OF MONTHLY SUPPORT CONTRIBUTION$/,
];

export function isManagedDocLabel(label: string): boolean {
  return MANAGED_DOC_PATTERNS.some((re) => re.test(label));
}

/** Comma-separated Section 7 line <-> item list. */
export function parseDocItems(line: string): string[] {
  return (line ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function joinDocItems(items: string[]): string {
  return items.join(', ');
}
