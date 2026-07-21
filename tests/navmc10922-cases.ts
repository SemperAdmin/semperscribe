/**
 * NAVMC 10922 validator cases - shared between the vitest suite
 * (tests/navmc10922-validators.test.ts, run in CI) and the sandbox
 * esbuild harness (vitest is unreliable on the sandbox mount).
 *
 * Each case: a FormData mutation on top of a passing baseline, the
 * issue id expected to appear, and the severity expected. `absent`
 * cases assert the id does NOT fire on the baseline.
 */

import { FormData } from '@/types';
import { createEmptyNavmc10922Data } from '@/types/navmc';

/** Frozen clock for the currency test - baseline dates stay valid forever. */
export const NOW = new Date(2026, 6, 20); // 2026-07-20

/** A complete, passing GAIN application - marriage, no priors. */
export function baseline(): FormData {
  return {
    ...createEmptyNavmc10922Data(),
    documentType: 'navmc10922',
    reason: 'gain',
    dateOfApplication: '2026-07-01',
    lifeEventDate: '2026-06-20',
    nameOfMarine: 'MARINE, ALONZO DEAN',
    edipi: '1234567890',
    grade: 'SGT',
    typeOfService: 'usmc',
    organizationStation: '1ST BN 6TH MARINES 2D MARDIV\nCAMP LEJEUNE NC 28547',
    unitRuc: '12160',
    marriageDate: '2026-06-20',
    marriagePlace: 'ONSLOW NC',
    marriageSpouseName: 'TONYA CAROL GRAY',
    memberPrevMarried: 'no',
    spousePrevMarried: 'no',
    courtOrderInEffect: 'no',
    naturalParentArmedForces: 'no',
    spouseArmedForces: 'no',
    attestingOfficerName: 'STEWART, THOMAS J',
    documentsViewed: 'MARRIAGE CERTIFICATE',
    dependents: [
      {
        name: 'TONYA CAROL MARINE',
        address: '123 FOURTH ST JACKSONVILLE NC 28540',
        relationship: 'SPOUSE',
        dateOfBirth: '1997-07-07',
        allowanceClaimedFrom: '2026-06-20',
      },
      ...Array.from({ length: 5 }, () => ({
        name: '', address: '', relationship: '' as const, dateOfBirth: '', allowanceClaimedFrom: '',
      })),
    ],
  };
}

export interface ValidatorCase {
  name: string;
  mutate: (d: FormData) => void;
  expectId: string;
  severity: 'block' | 'warn';
  /** true = the id must NOT appear after the mutation (or on baseline). */
  absent?: boolean;
}

export const CASES: ValidatorCase[] = [
  // --- baseline sanity ---
  { name: 'baseline has no blockers', mutate: () => {}, expectId: 'ANY-BLOCK', severity: 'block', absent: true },

  // --- blockers ---
  { name: 'missing reason blocks', mutate: (d) => { d.reason = ''; }, expectId: 'navmc10922-core-fields', severity: 'block' },
  { name: 'bad EDIPI blocks', mutate: (d) => { d.edipi = '12345'; }, expectId: 'navmc10922-core-fields', severity: 'block' },
  { name: 'no dependents blocks', mutate: (d) => { d.dependents = []; }, expectId: 'navmc10922-dependents-required', severity: 'block' },
  {
    name: 'self-attestation blocks even with reordered name',
    mutate: (d) => { d.attestingOfficerName = 'ALONZO DEAN MARINE'; },
    expectId: 'navmc10922-self-attestation', severity: 'block',
  },
  {
    name: 'out-of-vocabulary relationship blocks',
    mutate: (d) => { d.dependents[1] = { ...d.dependents[1], name: 'PAT MARINE', relationship: 'WARD' as never }; },
    expectId: 'navmc10922-relationship-2', severity: 'block',
  },
  {
    name: 'prev married yes with no count blocks',
    mutate: (d) => { d.memberPrevMarried = 'yes'; d.dissolutions[0] = { ...d.dissolutions[0], formerMarriageOf: 'self', spouseName: 'X', dateOfDissolution: '2020-01-01', placeOfDissolution: 'RENO NV', reason: 'divorce' }; },
    expectId: 'navmc10922-memberPrevMarriedTimes', severity: 'block',
  },
  {
    name: 'prev married yes with empty table blocks',
    mutate: (d) => { d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1'; },
    expectId: 'navmc10922-dissolution-required', severity: 'block',
  },
  {
    name: 'dissolution on/after marriage date blocks',
    mutate: (d) => {
      d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'PRIOR SPOUSE', dateOfDissolution: '2026-06-21', placeOfDissolution: 'RENO NV', reason: 'divorce' };
    },
    expectId: 'navmc10922-dissolution-date-1', severity: 'block',
  },
  {
    name: 'court order yes without detail blocks',
    mutate: (d) => { d.courtOrderInEffect = 'yes'; },
    expectId: 'navmc10922-court-order-detail', severity: 'block',
  },
  {
    name: 'section 5 yes without info blocks',
    mutate: (d) => { d.naturalParentArmedForces = 'yes'; },
    expectId: 'navmc10922-section5-detail', severity: 'block',
  },
  {
    name: 'section 6 yes with gaps blocks',
    mutate: (d) => { d.spouseArmedForces = 'yes'; d.spouseEdipi = '9999999999'; },
    expectId: 'navmc10922-section6-detail', severity: 'block',
  },
  {
    name: 'declared prior marriages beyond 4 rows block',
    mutate: (d) => { d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '3'; d.spousePrevMarried = 'yes'; d.spousePrevMarriedTimes = '2';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'A', dateOfDissolution: '2019-01-01', placeOfDissolution: 'RENO NV', reason: 'divorce' }; },
    expectId: 'navmc10922-capacity-dissolutions', severity: 'block',
  },
  {
    name: 'documents-viewed overflow blocks',
    mutate: (d) => { d.documentsViewed = 'X'.repeat(120); },
    expectId: 'navmc10922-docs-viewed-overflow', severity: 'block',
  },

  // --- warnings ---
  {
    name: 'blank attesting officer warns',
    mutate: (d) => { d.attestingOfficerName = ''; },
    expectId: 'navmc10922-attesting-unverified', severity: 'warn',
  },
  {
    name: 'loss with empty narrative warns',
    mutate: (d) => { d.reason = 'loss'; d.documentsViewed = ''; },
    expectId: 'navmc10922-loss-narrative', severity: 'warn',
  },
  {
    name: 'spouse evidence reminder fires',
    mutate: () => {},
    expectId: 'navmc10922-evidence-spouse', severity: 'warn',
  },
  {
    name: 'out-of-wedlock evidence cites FMR 3.2.1.3.3',
    mutate: (d) => { d.dependents[1] = { name: 'JUNIOR MARINE', address: 'SAME', relationship: 'CHILD BORN OUT OF WEDLOCK', dateOfBirth: '2026-06-01', allowanceClaimedFrom: '2026-06-01' }; },
    expectId: 'navmc10922-evidence-wedlock', severity: 'warn',
  },
  {
    name: 'foreign place of dissolution warns',
    mutate: (d) => {
      d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'B', dateOfDissolution: '2019-01-01', placeOfDissolution: 'NAHA, OKINAWA, JAPAN', reason: 'divorce' };
    },
    expectId: 'navmc10922-foreign-divorce-1', severity: 'warn',
  },
  {
    name: 'US place of dissolution stays quiet',
    mutate: (d) => {
      d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'B', dateOfDissolution: '2019-01-01', placeOfDissolution: 'WASHOE COUNTY NV', reason: 'divorce' };
    },
    expectId: 'navmc10922-foreign-divorce-1', severity: 'warn', absent: true,
  },
  {
    name: 'application beyond 30 days of life event warns',
    mutate: (d) => { d.lifeEventDate = '2026-05-01'; },
    expectId: 'navmc10922-30-day', severity: 'warn',
  },
  {
    name: 'claimed-from override warns with citation',
    mutate: (d) => { d.dependents[0] = { ...d.dependents[0], allowanceClaimedFrom: '2026-07-01' }; },
    expectId: 'navmc10922-claimed-from-1', severity: 'warn',
  },
  {
    name: 'flagged dependent without custodian warns',
    mutate: (d) => { d.dependents[0] = { ...d.dependents[0], livesOutsideHousehold: true }; },
    expectId: 'navmc10922-custodian-missing', severity: 'warn',
  },
  {
    name: 'custodian without flagged dependent warns',
    mutate: (d) => { d.custodian = { depNo: '1', name: 'JANE DOE', relationship: 'MOTHER', address: '1 MAIN ST RENO NV' }; },
    expectId: 'navmc10922-custodian-orphaned', severity: 'warn',
  },
  {
    name: 'stale CMC-routed application warns at 6 weeks',
    mutate: (d) => {
      d.dateOfApplication = '2026-01-05';
      d.lifeEventDate = '2026-01-01';
      d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'B', dateOfDissolution: '2019-01-01', placeOfDissolution: 'SEOUL KOREA', reason: 'divorce' };
      d.marriageDate = '2026-01-02';
      d.dependents[0] = { ...d.dependents[0], allowanceClaimedFrom: '2026-01-02' };
    },
    expectId: 'navmc10922-6-week', severity: 'warn',
  },
  {
    name: 'partial sworn date warns',
    mutate: (d) => { d.swornDay = '10'; },
    expectId: 'navmc10922-sworn-incomplete', severity: 'warn',
  },
  {
    name: 'other document types are untouched',
    mutate: (d) => { d.documentType = 'basic'; d.edipi = ''; },
    expectId: 'navmc10922-core-fields', severity: 'block', absent: true,
  },

  // --- reason derivation (previouslyApproved discriminator) ---
  {
    name: 'gain without previously-approved rows warns (reads as START)',
    mutate: () => {},
    expectId: 'navmc10922-reason-derivation', severity: 'warn',
  },
  {
    name: 'gain with a previously-approved row is consistent',
    mutate: (d) => { d.dependents[0] = { ...d.dependents[0], previouslyApproved: true }; },
    expectId: 'navmc10922-reason-derivation', severity: 'warn', absent: true,
  },
  {
    name: 'start with a previously-approved row warns (reads as GAIN)',
    mutate: (d) => { d.reason = 'start'; d.dependents[0] = { ...d.dependents[0], previouslyApproved: true }; },
    expectId: 'navmc10922-reason-derivation', severity: 'warn',
  },
  {
    name: 'previously-approved row skips the claimed-from override warn',
    mutate: (d) => { d.dependents[0] = { ...d.dependents[0], previouslyApproved: true, allowanceClaimedFrom: '2026-07-01' }; },
    expectId: 'navmc10922-claimed-from-1', severity: 'warn', absent: true,
  },

  // --- LOSS roster convention (remaining dependents only) ---
  {
    name: 'loss with empty roster and named lost dependent exports',
    mutate: (d) => {
      d.reason = 'loss'; d.dependents = [];
      d.lostDependentName = 'TONYA CAROL MARINE'; d.lostDependentRelationship = 'SPOUSE';
      d.lostEventType = 'divorce'; d.lostEffectiveDate = '2026-06-25';
      d.documentsViewed = 'FINAL DIVORCE DECREE, LOSS OF SPOUSE EFF 6/25/26';
    },
    expectId: 'navmc10922-dependents-required', severity: 'block', absent: true,
  },
  {
    name: 'loss with empty roster and empty panel still blocks',
    mutate: (d) => { d.reason = 'loss'; d.dependents = []; },
    expectId: 'navmc10922-dependents-required', severity: 'block',
  },
  {
    name: 'incomplete loss panel warns',
    mutate: (d) => { d.reason = 'loss'; d.lostDependentName = 'TONYA CAROL MARINE'; },
    expectId: 'navmc10922-loss-detail', severity: 'warn',
  },

  // --- marriage type routing (proxy marriages are common now) ---
  {
    name: 'proxy marriage routes to CMC',
    mutate: (d) => { d.marriageType = 'proxy-telephone'; },
    expectId: 'navmc10922-cmc-marriage', severity: 'warn',
  },
  {
    name: 'common-law marriage routes to CMC',
    mutate: (d) => { d.marriageType = 'common-law'; },
    expectId: 'navmc10922-cmc-marriage', severity: 'warn',
  },
  {
    name: 'US ceremonial marriage stays at command level',
    mutate: (d) => { d.marriageType = 'ceremonial-us'; },
    expectId: 'navmc10922-cmc-marriage', severity: 'warn', absent: true,
  },
  {
    name: 'previously approved spouse does not re-trigger routing',
    mutate: (d) => {
      d.marriageType = 'proxy-telephone';
      d.dependents[0] = { ...d.dependents[0], previouslyApproved: true };
    },
    expectId: 'navmc10922-cmc-marriage', severity: 'warn', absent: true,
  },
  {
    name: 'indian tribal marriage routes to CMC',
    mutate: (d) => { d.marriageType = 'indian-tribal'; },
    expectId: 'navmc10922-cmc-marriage', severity: 'warn',
  },
  {
    name: 'foreign-divorce flag warns regardless of US place text',
    mutate: (d) => {
      d.memberPrevMarried = 'yes'; d.memberPrevMarriedTimes = '1';
      d.dissolutions[0] = { formerMarriageOf: 'self', spouseName: 'B', dateOfDissolution: '2019-01-01', placeOfDissolution: 'SAN DIEGO CA', reason: 'divorce', foreignDivorce: true };
    },
    expectId: 'navmc10922-foreign-divorce-1', severity: 'warn',
  },
  {
    name: 'proxy marriage starts the 6-week CMC currency clock',
    mutate: (d) => { d.marriageType = 'proxy-telephone'; d.dateOfApplication = '2026-01-05'; d.lifeEventDate = '2026-01-02'; d.marriageDate = '2026-01-02'; d.dependents[0] = { ...d.dependents[0], allowanceClaimedFrom: '2026-01-02' }; },
    expectId: 'navmc10922-6-week', severity: 'warn',
  },
];
