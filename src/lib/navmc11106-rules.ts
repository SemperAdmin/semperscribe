/**
 * NAVMC 11106 rules. Pure functions, no UI or PDF imports.
 * Rule source: docs/NAVMC_11106_SPEC.md sections 3, 4, and 9.
 */
import type { FormData } from '@/types';
import {
  NAVMC_11106_EMPTY_DEPENDENT,
  type Navmc11106Dependent,
  type Navmc11106SponsorshipBasis,
} from '@/types/navmc';

const P = 'topmostSubform[0].Page1[0].';

export const NAVMC_11106_MAX_DEPENDENTS = 6;
export const NAVMC_11106_REMARKS_LIMIT = 720;

export type Navmc11106PartA = 'mem' | 'both' | 'dep';

export const NAVMC_11106_BASIS_INFO: Record<
  Navmc11106SponsorshipBasis,
  { label: string; hint: string; dated: boolean; counted: boolean }
> = {
  'installation-approval': {
    label: 'Approved by gaining installation',
    hint: 'Approval date from the installation G-1/S-1 message or orders endorsement (MCO 1300.8 Ch 6 par 4.b(4), 5).',
    dated: true,
    counted: true,
  },
  'cmc-conversion': {
    label: 'CMC approved tour conversion',
    hint: 'Date CMC approved the unaccompanied-to-accompanied conversion (MCO 1300.8 Ch 6 par 9.e(1)).',
    dated: true,
    counted: true,
  },
  'command-award': {
    label: 'Command awarded sponsorship',
    hint: 'Date the command awarded sponsorship to an acquired or formerly non-sponsored dependent, no tour conversion needed (MCO 1300.8 Ch 6 par 6.e, 7.c).',
    dated: true,
    counted: true,
  },
  birth: {
    label: 'Born during the tour',
    hint: 'Sponsored at birth during an accompanied tour, or to a female Marine on an unaccompanied or dependent-restricted tour. Uses the date of birth (MCO 1300.8 Ch 6 par 6.b).',
    dated: true,
    counted: true,
  },
  'adoption-placement': {
    label: 'Adoption placement',
    hint: 'Date placed in the home, including pre-adoptive placement (MCO 1300.8 Ch 6 par 6.d).',
    dated: true,
    counted: true,
  },
  'dual-mil-separation': {
    label: 'Spouse separated from service overseas',
    hint: 'Day after separation, if the remaining member serves the accompanied tour and the spouse did not travel to CONUS at Government expense (MCO 1300.8 Ch 6 par 5.c).',
    dated: true,
    counted: true,
  },
  'not-required': {
    label: 'Sponsorship not required (exception)',
    hint: 'An exception applies, such as marriage to a Service member on the PCS effective date. No date. The basis prints in Remarks (FMR Vol 7A Ch 68 par 2.2.3).',
    dated: false,
    counted: true,
  },
  'designated-place': {
    label: 'Unaccompanied, paid at dependent location',
    hint: 'Dependents at the old PDS or a designated place. No date. The basis prints in Remarks (FMR Vol 7A Ch 68 par 2.2.2).',
    dated: false,
    counted: true,
  },
  'not-sponsored': {
    label: 'Not command sponsored',
    hint: 'Not claimable, so this row will not print or count (FMR Vol 7A Ch 68 par 3.6).',
    dated: false,
    counted: false,
  },
  'active-duty-spouse': {
    label: 'Spouse is on active duty',
    hint: 'An active-duty spouse is not a dependent, so this row will not print or count (FMR Vol 7A Ch 68 par 2.2.1, Table 68-5).',
    dated: false,
    counted: false,
  },
};

const ALREADY_AT_PDS: ReadonlySet<string> = new Set(['birth', 'adoption-placement', 'dual-mil-separation']);

const str = (data: FormData, key: string): string => String(data[key] ?? '');

export function rowHasContent(row: Navmc11106Dependent): boolean {
  return Boolean(row.name.trim() || row.relationship.trim() || row.eventDate || row.sponsorshipBasis || row.sponsoredOn);
}

const isCounted = (row: Navmc11106Dependent): boolean =>
  rowHasContent(row) && (row.sponsorshipBasis === '' || NAVMC_11106_BASIS_INFO[row.sponsorshipBasis].counted);

export function spouseRow(data: FormData): Navmc11106Dependent {
  return { ...NAVMC_11106_EMPTY_DEPENDENT, ...(data.navmc11106Spouse ?? {}) };
}

export function dependentRows(data: FormData): Navmc11106Dependent[] {
  const rows: Navmc11106Dependent[] = Array.isArray(data.navmc11106Dependents) ? data.navmc11106Dependents : [];
  return rows.map((r) => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...r }));
}

export function countedSpouse(data: FormData): Navmc11106Dependent | null {
  const spouse = spouseRow(data);
  return isCounted(spouse) ? spouse : null;
}

export function countedChildren(data: FormData): Navmc11106Dependent[] {
  return dependentRows(data).filter(isCounted).slice(0, NAVMC_11106_MAX_DEPENDENTS);
}

export function countedDependents(data: FormData): Navmc11106Dependent[] {
  const spouse = countedSpouse(data);
  return [...(spouse ? [spouse] : []), ...countedChildren(data)];
}

export function partAValue(data: FormData): Navmc11106PartA {
  if (countedDependents(data).length === 0) return 'mem';
  return data.dependentsOnly === true ? 'dep' : 'both';
}

/** Spec section 4: the option must not return on its own when dependents come back. */
export function withDependentsOnlyReset<T extends FormData>(data: T): T {
  if (countedDependents(data).length > 0) return data;
  return { ...data, dependentsOnly: false, conusColaDependents: false, conusColaZip: '' } as T;
}

export function effectiveSponsoredOn(row: Navmc11106Dependent): string {
  if (row.sponsorshipBasis === '' || !NAVMC_11106_BASIS_INFO[row.sponsorshipBasis].dated) return '';
  return row.sponsorshipBasis === 'birth' ? row.eventDate : row.sponsoredOn;
}

/** ISO dates sort lexically, so max is a string comparison. */
const latest = (dates: string[]): string => dates.filter(Boolean).sort().pop() ?? '';

export function commandSponsoredDate(data: FormData): string {
  return latest(countedDependents(data).map(effectiveSponsoredOn));
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Spec section 9.1. A suggestion only: the commander decides D3. */
export function suggestedEffectiveDate(data: FormData): string {
  const part = partAValue(data);
  if (part === 'mem') {
    const arrival = str(data, 'dateOfArrival');
    if (!arrival) return '';
    return data.maltPlusOnReportingDay === true ? nextDay(arrival) : arrival;
  }
  const arrived = str(data, 'dependentsArrived');
  if (part === 'dep') return arrived;
  const c10 = commandSponsoredDate(data);
  if (arrived) return latest([arrived, c10]);
  const latestRow = countedDependents(data).find((r) => effectiveSponsoredOn(r) === c10);
  return c10 && latestRow && ALREADY_AT_PDS.has(latestRow.sponsorshipBasis) ? c10 : '';
}

/** Spec section 9.2. */
export function generatedRemarks(data: FormData): string[] {
  const lines: string[] = [];
  const c10 = commandSponsoredDate(data);
  for (const row of countedDependents(data)) {
    const date = effectiveSponsoredOn(row);
    if (date && date !== c10) lines.push(`C10: ${row.name} COMMAND SPONSORED ${date}.`);
    if (row.sponsorshipBasis === 'not-required') lines.push(`${row.name}: COMMAND SPONSORSHIP NOT REQUIRED.`);
    if (row.sponsorshipBasis === 'designated-place') lines.push(`${row.name}: PAID AT DEPENDENT LOCATION.`);
  }
  if (partAValue(data) === 'dep' && data.conusColaDependents === true) {
    lines.push(`CONUS COLA. ZIP ${str(data, 'conusColaZip')}.`);
  }
  return lines;
}

export function combinedRemarks(data: FormData): string {
  return [str(data, 'navmc11106Remarks').trim(), ...generatedRemarks(data)].filter(Boolean).join(' ');
}

export function navmc11106Values(data: FormData): Record<string, string> {
  const values: Record<string, string> = {
    [`${P}RadA1[0]`]: partAValue(data),
    [`${P}NameApplc[0]`]: str(data, 'nameOfMarine'),
    [`${P}GrdApplc[0]`]: str(data, 'grade'),
    [`${P}DateRnk[0]`]: str(data, 'dateOfRank'),
    [`${P}SocSecNoApplc[0]`]: str(data, 'edipi'),
    [`${P}DutyStatn[0]`]: str(data, 'dutyStation'),
    [`${P}DateOrdrs[0]`]: str(data, 'ordersEffectiveDate'),
    [`${P}DateArrvl[0]`]: str(data, 'dateOfArrival'),
    [`${P}DepLoc[0]`]: str(data, 'dependentLocation'),
    [`${P}DateDepArrv[0]`]: str(data, 'dependentsArrived'),
    [`${P}DateDepComnd[0]`]: commandSponsoredDate(data),
    [`${P}DateMemSigntr[0]`]: str(data, 'memberSignedDate'),
    [`${P}RadD1AvailNot[0]`]: str(data, 'd1Quarters'),
    [`${P}RadD1AssnNot[0]`]: str(data, 'd1Assignment'),
    [`${P}RadD1ToMemDep[0]`]: str(data, 'd1ToWhom'),
    [`${P}RadD2AvailNot[0]`]: str(data, 'd2Mess'),
    [`${P}RadD2Mem[0]`]: str(data, 'd2Who'),
    [`${P}RadD2B1[0]`]: str(data, 'd2b'),
    [`${P}DateApplcEffct[0]`]: str(data, 'effectiveDate'),
    [`${P}RemrkD3[0]`]: combinedRemarks(data).slice(0, NAVMC_11106_REMARKS_LIMIT),
    [`${P}DateCmndOffcr[0]`]: str(data, 'coDate'),
    [`${P}NameComndOffcr[0]`]: str(data, 'coNameGradeActivity'),
  };

  const spouse = countedSpouse(data);
  values[`${P}NameSps1[0]`] = spouse?.name ?? '';
  values[`${P}RelatnshpSps1[0]`] = spouse ? spouse.relationship || 'SPOUSE' : '';
  values[`${P}DateMarr[0]`] = spouse?.eventDate ?? '';

  const children = countedChildren(data);
  for (let i = 0; i < NAVMC_11106_MAX_DEPENDENTS; i += 1) {
    const n = i + 2;
    values[`${P}NameDep${n}[0]`] = children[i]?.name ?? '';
    values[`${P}RelatnshpDep${n}[0]`] = children[i]?.relationship ?? '';
    values[`${P}DateDepBrth${n}[0]`] = children[i]?.eventDate ?? '';
  }
  return values;
}

export const NAVMC_11106_LIMITS = {
  name: 70,
  grade: 20,
  dutyStation: 130,
  dependentLocation: 70,
  coNameGradeActivity: 65,
  rowName: 25,
  rowRelationship: 20,
} as const;

export interface Navmc11106FieldProblem {
  block: string;
  problem: 'too-long' | 'unprintable';
  detail: string;
}

/**
 * The form prints in a standard font encoded as Windows-1252. These are the
 * 0x80-0x9F characters it carries beyond Latin-1; the test proves the whole
 * set against pdf-lib so the two cannot drift apart.
 */
const WIN1252_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function unprintableChars(text: string, multiline: boolean): string[] {
  const found: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const ok =
      (cp >= 0x20 && cp <= 0x7e) ||
      (cp >= 0xa0 && cp <= 0xff) ||
      WIN1252_EXTRAS.includes(ch) ||
      (multiline && (ch === '\n' || ch === '\r'));
    if (!ok && !found.includes(ch)) found.push(ch);
  }
  return found;
}

/**
 * Every text value the form prints, checked against its block limit and the
 * form font. Nothing is substituted: a Marine's name is a record, so the
 * export refuses and the drafter enters the Latin spelling.
 */
export function navmc11106FieldProblems(data: FormData): Navmc11106FieldProblem[] {
  const out: Navmc11106FieldProblem[] = [];
  const check = (block: string, text: string, limit: number | null, multiline = false) => {
    if (limit !== null && text.length > limit) {
      out.push({ block, problem: 'too-long', detail: `${text.length} characters entered, ${limit} fit.` });
    }
    const bad = unprintableChars(text, multiline);
    if (bad.length > 0) out.push({ block, problem: 'unprintable', detail: bad.map((c) => `"${c}"`).join(' ') });
  };

  check('B1 Name', str(data, 'nameOfMarine'), NAVMC_11106_LIMITS.name);
  check('B2 Grade', str(data, 'grade'), NAVMC_11106_LIMITS.grade);
  check('B5 Duty Station', str(data, 'dutyStation'), NAVMC_11106_LIMITS.dutyStation, true);
  check("C8 Dependent's Location", str(data, 'dependentLocation'), NAVMC_11106_LIMITS.dependentLocation);
  check('CO Name, Grade, Activity', str(data, 'coNameGradeActivity'), NAVMC_11106_LIMITS.coNameGradeActivity);

  const rowChecks = (n: number, row: Navmc11106Dependent) => {
    check(`C${n}A Name`, row.name, NAVMC_11106_LIMITS.rowName);
    check(`C${n}B Relationship`, row.relationship, NAVMC_11106_LIMITS.rowRelationship);
  };
  const spouse = countedSpouse(data);
  if (spouse) rowChecks(1, spouse);
  countedChildren(data).forEach((row, i) => rowChecks(i + 2, row));

  check('Remarks', combinedRemarks(data), null, true);
  return out;
}
