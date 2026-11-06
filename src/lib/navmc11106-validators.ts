/**
 * NAVMC 11106 validators. Pure functions, folded into runLetterValidators.
 * Rule source: docs/NAVMC_11106_SPEC.md section 10. Only core-fields blocks.
 */
import type { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime.
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  NAVMC_11106_BASIS_INFO,
  NAVMC_11106_REMARKS_LIMIT,
  combinedRemarks,
  countedDependents,
  countedSpouse,
  dependentRows,
  NAVMC_11106_LIMITS,
  effectiveSponsoredOn,
  navmc11106FieldProblems,
  partAValue,
  rowHasContent,
  spouseRow,
  suggestedEffectiveDate,
} from '@/lib/navmc11106-rules';

const issue = (
  slug: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string,
): ValidationIssue => ({ id: `navmc11106-${slug}`, severity, rule, citation, detail });

const str = (data: FormData, key: string): string => String(data[key] ?? '').trim();

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function runNavmc11106Validators(data: FormData, now: Date = new Date()): ValidationIssue[] {
  if (data.documentType !== 'navmc11106') return [];
  const out: ValidationIssue[] = [];

  const missing: string[] = [];
  if (!str(data, 'nameOfMarine')) missing.push('Name');
  if (!str(data, 'grade')) missing.push('Grade');
  if (!str(data, 'dutyStation')) missing.push('Current permanent duty station');
  if (!/^\d{10}$/.test(str(data, 'edipi'))) missing.push('EDIPI (10-digit DoD ID)');
  if (missing.length > 0) {
    out.push(issue('core-fields', 'block', 'Required member fields are incomplete', 'NAVMC 11106 Part B', `Missing: ${missing.join('; ')}.`));
  }

  const spouse = spouseRow(data);
  const children = dependentRows(data);
  const allFilled = [spouse, ...children].filter(rowHasContent);
  const counted = countedDependents(data);
  const part = partAValue(data);

  // The spouse row leads `counted` when it is counted. Its relationship
  // defaults to SPOUSE at fill time, so only the other rows must state one.
  const spouseIsFirst = countedSpouse(data) !== null;
  const incomplete = counted.find((row, i) =>
    !row.name.trim() || !row.eventDate || (!(spouseIsFirst && i === 0) && !row.relationship.trim()));
  if (incomplete) {
    out.push(issue('row-incomplete', 'fail', 'A dependent row is incomplete', 'NAVMC 11106 Part C', `${incomplete.name || 'A row'} needs a name, relationship, and date.`));
  }
  if (allFilled.some((r) => r.sponsorshipBasis === '')) {
    out.push(issue('basis-missing', 'fail', 'A dependent has no sponsorship basis', 'MCO 1300.8 Ch 6 par 5', 'Choose how each dependent came to be command sponsored, or mark the row as not sponsored.'));
  }
  if (counted.some((r) => r.sponsorshipBasis !== '' && NAVMC_11106_BASIS_INFO[r.sponsorshipBasis].dated && !effectiveSponsoredOn(r))) {
    out.push(issue('sponsored-date-missing', 'fail', 'A sponsorship date is missing', 'MCO 1300.8 Ch 6 par 4-6', 'The basis chosen for this dependent needs a date.'));
  }

  const hasNotSponsored = allFilled.some((r) => r.sponsorshipBasis === 'not-sponsored');
  if (hasNotSponsored) {
    out.push(issue('not-sponsored-excluded', 'warn', 'A non-command-sponsored dependent will not print', 'FMR Vol 7A Ch 68 par 3.6', 'With-dependent COLA is not authorized for a non-command-sponsored dependent.'));
    if (data.d1Quarters === 'y') {
      out.push(issue('reduced-rate', 'warn', 'Reduced COLA rate applies', 'FMR Vol 7A Ch 68 Table 68-4 rule 13', 'With quarters available and non-sponsored dependents near the PDS, the Marine rates only the reduced rate.'));
    }
  }
  if (allFilled.some((r) => r.sponsorshipBasis === 'active-duty-spouse')) {
    out.push(issue('active-duty-spouse-excluded', 'warn', 'An active-duty spouse will not print', 'FMR Vol 7A Ch 68 par 2.2.1, Table 68-5', 'An active-duty spouse is not a dependent. See the joint-household rule in Table 68-5.'));
  }
  if (part === 'mem' && data.d1Quarters === 'y' && data.d2Mess === 'y') {
    out.push(issue('barracks-no-form', 'warn', 'This looks like barracks COLA', 'PRIUM 80102 par 3; FMR Vol 7A Ch 68 Table 68-4 rule 11', 'With quarters and mess both available, barracks COLA is reported on the unit diary with no application.'));
  }

  const isConus = data.conusColaDependents === true;
  if (part === 'dep' && (isConus ? !str(data, 'conusColaZip') : !str(data, 'dependentLocation'))) {
    out.push(issue('dep-only-no-location', 'fail', 'Dependents only needs the dependents location', 'PRIUM 80102 par 4 Note 2; PRIUM 80101 par 3.a(5)', isConus ? 'Enter the ZIP code for CONUS COLA.' : 'Complete block C8.'));
  }
  if (part === 'both' && str(data, 'dependentLocation')) {
    out.push(issue('member-dep-with-location', 'warn', 'Dependents listed at another location', 'PRIUM 80102 par 3.a(1)(c)', 'Dependents away from the PDS usually mean a dependents-only application.'));
  }

  if (part === 'both' && counted.some((r) => r.sponsorshipBasis === 'designated-place')) {
    out.push(issue('designated-place-box-2', 'warn', 'Dependents paid at their own location usually mean a dependents-only application', 'PRIUM 80102 par 3.a(1)(c); FMR Vol 7A Ch 68 par 2.2.2', 'A designated-place dependent is paid at the dependent location. Check whether this is a dependents-only application.'));
  }

  const arrived = str(data, 'dependentsArrived');
  if (arrived && counted.some((r) => r.sponsorshipBasis === 'installation-approval' && r.sponsoredOn > arrived)) {
    out.push(issue('c10-before-travel', 'warn', 'Sponsorship approved after dependents arrived', 'JTR par 050803', 'Sponsorship is generally required before Government-funded dependent travel starts.'));
  }

  const effective = str(data, 'effectiveDate');
  const suggested = suggestedEffectiveDate(data);
  if (effective && suggested && effective !== suggested) {
    out.push(issue('effective-date-differs', 'warn', 'Effective date differs from the computed date', 'FMR Vol 7A Ch 68 par 2.1.5, 2.3.4, 3.2.1, 3.3', `The rules suggest ${suggested}. The commander decides.`));
  }
  if (effective && effective > localIso(now)) {
    out.push(issue('effective-date-future', 'warn', 'Effective date is in the future', 'PRIUM 80102 par 12.h', 'TTC 014 rejects a future effective date.'));
  }

  if (part === 'both' && data.d2b) {
    out.push(issue('mess-ignored-with-deps', 'warn', 'Mess availability does not affect with-dependent COLA', 'FMR Vol 7A Ch 68 par 3.3', 'Block D2B has no effect on this rate.'));
  }
  if (data.d2b === 'n' && !str(data, 'navmc11106Remarks')) {
    out.push(issue('impractical-needs-statement', 'warn', 'Impractical needs a stated basis', 'FMR Vol 7A Ch 68 Table 68-4 rule 3, note 1', 'State the mission or operational need in Remarks. Personal convenience is not a basis.'));
  }

  if (combinedRemarks(data).length > NAVMC_11106_REMARKS_LIMIT) {
    out.push(issue('remarks-too-long', 'fail', 'Remarks exceed the form limit', 'NAVMC 11106 Remarks', `Remarks, including generated lines, must fit in ${NAVMC_11106_REMARKS_LIMIT} characters. The export cuts anything longer.`));
  }
  const fieldProblems = navmc11106FieldProblems(data);
  if (fieldProblems.some((p) => p.problem === 'too-long')) {
    out.push(issue('field-too-long', 'fail', 'An entry is too long for the form', 'NAVMC 11106 Part B and C', `Limits: name ${NAVMC_11106_LIMITS.name}, grade ${NAVMC_11106_LIMITS.grade}, duty station ${NAVMC_11106_LIMITS.dutyStation}, C8 location ${NAVMC_11106_LIMITS.dependentLocation}, CO line ${NAVMC_11106_LIMITS.coNameGradeActivity}, row names ${NAVMC_11106_LIMITS.rowName}, row relationships ${NAVMC_11106_LIMITS.rowRelationship}. Too long: ${fieldProblems.filter((p) => p.problem === 'too-long').map((p) => p.block).join(', ')}.`));
  }
  const unprintable = fieldProblems.filter((p) => p.problem === 'unprintable');
  if (unprintable.length > 0) {
    out.push(issue('field-unprintable', 'fail', 'An entry has a character the form cannot print', 'NAVMC 11106 form font', `${unprintable.map((p) => `${p.block} ${p.detail}`).join('; ')}. Enter the Latin spelling.`));
  }
  return out;
}
