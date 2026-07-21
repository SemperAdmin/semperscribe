/**
 * NAVMC 10922 positional datasets emitter - Phase 4 of
 * docs/NAVMC_10922_BUILD_PLAN.md.
 *
 * The 7-21 form's datasets nodes are non-unique: 77 of 102 are named
 * ParticipantName and 17 RadioButtonList, so Adobe binds by POSITION,
 * not name. This module emits all 102 nodes in the exact order the
 * form ships them - no-bind template fields in document order, then
 * the 8 global-bind fields. The order was derived from template.xml
 * and verified against the shipped datasets stream twice (Phase 0
 * sentinel round-trip, 102/102). tools/aa-forms/navmc10922-map.json is
 * the generated reference; the test suite diffs NAVMC10922_NODE_SEQUENCE
 * against it so drift fails loudly.
 *
 * Value contracts (docs/NAVMC_10922_SPEC.md sections 3-4):
 * - Radio groups emit the mapped digit string, or empty when unset.
 *   START is UNBINDABLE (no name, no bind) - a START application
 *   leaves index 1 empty and prints via the flattened path (Phase 5).
 * - Dates emit in the template's own picture formats: MMM D, YYYY for
 *   index 0, M/D/YY everywhere else.
 * - Section 8 approving-authority and unit-diary nodes (86-92) and all
 *   signature widgets emit EMPTY - the app never populates them.
 * - Section 7 EDIPI/Grade (96/97) repeat the Section 1 values.
 */

import { FormData } from '@/types';
import { Navmc10922Dependent, Navmc10922Dissolution } from '@/types/navmc';
import { formatMDYY, formatMMMDYYYY } from '@/lib/navmc10922-utils';

// Local copy of xfa-form-fill's escaping (importing it would cycle:
// xfa-form-fill imports this module). CR entity is XFA's line break.
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\n/g, '&#xD;');
}

function node(name: string, value: string): string {
  const v = value.trim();
  return v ? `<${name}>${esc(v)}</${name}>` : `<${name}/>`;
}

type Selector = (d: FormData) => string;
type Entry = [name: string, select: Selector];

const P = 'ParticipantName';
const R = 'RadioButtonList';

const s = (key: string): Selector => (d) => String(d[key] ?? '');
const mdyy = (key: string): Selector => (d) => formatMDYY(String(d[key] ?? ''));
const empty: Selector = () => '';
const radio = (key: string, map: Record<string, string>): Selector => (d) =>
  map[String(d[key] ?? '')] ?? '';

function deps(d: FormData): Navmc10922Dependent[] {
  return Array.isArray(d.dependents) ? d.dependents : [];
}
function diss(d: FormData): Navmc10922Dissolution[] {
  return Array.isArray(d.dissolutions) ? d.dissolutions : [];
}

const depField = (row: number, key: keyof Navmc10922Dependent, date = false): Selector => (d) => {
  const v = String(deps(d)[row]?.[key] ?? '');
  return date ? formatMDYY(v) : v;
};
const disField = (row: number, key: keyof Navmc10922Dissolution, date = false): Selector => (d) => {
  const v = String(diss(d)[row]?.[key] ?? '');
  return date ? formatMDYY(v) : v;
};
const disRadio = (row: number, key: keyof Navmc10922Dissolution, map: Record<string, string>): Selector => (d) =>
  map[String(diss(d)[row]?.[key] ?? '')] ?? '';

// Value maps verified against the template's <items> elements and
// column geometry (spec section 4; audit PASS-2, max deviation 0.64mm).
const REASON = { gain: '3', loss: '2' }; // START unbindable -> empty
const SERVICE = { usmc: '2', usmcr: '1' };
const YESNO = { yes: '1', no: '2' };
const FORMER_OF = { self: '2', spouse: '1' };
const DISS_REASON = { death: '1', annulment: '2', divorce: '3' };
const SPOUSE_SERVICE = { regular: '2', reserve: '1' };
const BAQ = { with: '2', without: '1' };

function dependentRow(row: number): Entry[] {
  return [
    [P, depField(row, 'name')],
    [P, depField(row, 'address')],
    [P, depField(row, 'relationship')],
    [P, depField(row, 'dateOfBirth', true)],
    [P, depField(row, 'allowanceClaimedFrom', true)],
  ];
}

function dissolutionRow(row: number): Entry[] {
  return [
    [R, disRadio(row, 'formerMarriageOf', FORMER_OF)],
    [R, disRadio(row, 'reason', DISS_REASON)],
    [P, disField(row, 'spouseName')],
    [P, disField(row, 'placeOfDissolution')],
    [P, disField(row, 'dateOfDissolution', true)],
  ];
}

/** All 102 datasets nodes in shipped order. Index comments are the
 *  map indices from tools/aa-forms/navmc10922-map.json. */
const ENTRIES: Entry[] = [
  /* 0 */ [P, (d) => formatMMMDYYYY(String(d.dateOfApplication ?? ''))],
  /* 1 */ [R, radio('reason', REASON)],
  /* 2 */ [P, s('edipi')],
  /* 3 */ [P, s('organizationStation')],
  /* 4 */ [P, s('futureAddressEta')],
  /* 5 */ [P, s('grade')],
  /* 6 */ [P, s('unitRuc')],
  /* 7 */ [P, mdyy('ecc')],
  /* 8 */ [P, mdyy('dateEnlistmentOrAd')],
  /* 9 */ [P, mdyy('dateLastDischarge')],
  /* 10 */ [R, radio('typeOfService', SERVICE)],
  /* 11-40: Section 2, six rows x five cells */
  ...dependentRow(0), ...dependentRow(1), ...dependentRow(2),
  ...dependentRow(3), ...dependentRow(4), ...dependentRow(5),
  /* 41-44: Section 3 custodian - dep no, name, ADDRESS, RELATIONSHIP
     (template document order puts address before relationship) */
  [P, (d) => String(d.custodian?.depNo ?? '')],
  [P, (d) => String(d.custodian?.name ?? '')],
  [P, (d) => String(d.custodian?.address ?? '')],
  [P, (d) => String(d.custodian?.relationship ?? '')],
  /* 45-51: Section 4 - spouse flag/count precede member flag/count */
  [R, radio('spousePrevMarried', YESNO)],
  [P, s('spousePrevMarriedTimes')],
  [R, radio('memberPrevMarried', YESNO)],
  [P, s('memberPrevMarriedTimes')],
  [P, s('marriageSpouseName')],
  [P, s('marriagePlace')],
  [P, mdyy('marriageDate')],
  /* 52-71: dissolution table, four rows x five cells */
  ...dissolutionRow(0), ...dissolutionRow(1), ...dissolutionRow(2), ...dissolutionRow(3),
  /* 72-73: court order */
  [R, radio('courtOrderInEffect', YESNO)],
  [P, s('courtOrderDatePlace')],
  /* 74-75: Section 5 - the info block PRECEDES its radio in the stream */
  [P, s('naturalParentInfo')],
  [R, radio('naturalParentArmedForces', YESNO)],
  /* 76-82: Section 6 */
  [R, radio('spouseArmedForces', YESNO)],
  [P, s('spouseEdipi')],
  [P, s('spouseGrade')],
  [R, radio('spouseTypeOfService', SPOUSE_SERVICE)],
  [P, s('spouseBranch')],
  [R, radio('spouseBaq', BAQ)],
  [P, s('spouseServiceDates')],
  /* 83-85: sworn month (choiceList full name), 2-digit year, day */
  [P, s('swornMonth')],
  [P, s('swornYear2Digit')],
  [P, s('swornDay')],
  /* 86-92: Section 8 approving authority and unit diary - NEVER
     populated by the app (spec section 5) */
  [P, empty], [P, empty], [P, empty], [P, empty], [P, empty], [P, empty], [P, empty],
  /* 93: Section 7 documents viewed */
  [P, s('documentsViewed')],
  /* 94-101: global-bind tail in verified order */
  ['NameOfMarine', s('nameOfMarine')],
  ['SignatureofMarine', empty],
  ['EDIPI', s('edipi')],
  ['Grade', s('grade')],
  ['SignatureandTitleofAttestingOfficer', empty],
  ['UnitDesignation', empty],
  ['TypedNameandGradeofCommandingOfficer', empty],
  ['SignatureofCommandingOfficer', empty],
];

/** Node-name sequence for tests to diff against navmc10922-map.json. */
export const NAVMC10922_NODE_SEQUENCE: readonly string[] = ENTRIES.map(([name]) => name);

/**
 * All 102 values in map order - the SINGLE selector source shared by
 * the XFA emitter and the flattened renderer, so both outputs always
 * carry identical content at identical positions.
 */
export function navmc10922Values(formData: FormData): string[] {
  return ENTRIES.map(([, select]) => select(formData));
}

/** Builds the full datasets XML for fillXfaDatasets. */
export function buildNavmc10922Xml(formData: FormData): string {
  const values = navmc10922Values(formData);
  const inner = ENTRIES.map(([name], i) => node(name, values[i])).join('');
  return (
    '<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/">' +
    `<xfa:data><form1>${inner}</form1></xfa:data></xfa:datasets>`
  );
}
