/**
 * Complete DD 1561 samples, one per FSA type, for the export tests and the
 * render check. Fictional people; EDIPIs are ten digits, never an SSN.
 */
import type { FormData } from '@/types';
import { createDd1561Defaults } from '@/types/dd1561';

const base = {
  ...createDd1561Defaults(),
  dd1561MemberName: 'MARINE, TEST A',
  dd1561Grade: 'SGT',
  dd1561Edipi: '1234567890',
  dd1561BranchOrganization: 'USMC, 1ST BN, 5TH MAR, CAMP PENDLETON CA',
  dd1561DependentAddresses: '123 MAIN ST, OCEANSIDE CA 92054\n45 ELM AVE, SAN DIEGO CA 92101',
  dd1561MaritalStatus: 'married',
  dd1561HasChildren: true,
  dd1561ChildCustody: 'member',
  dd1561DependentOnActiveDuty: false,
  dd1561SoleDependentInstitutionalized: false,
  dd1561AllDependentsNear: false,
  dd1561LastTdyWithin30: 'was-not',
  dd1561MemberSignedDate: '2026-11-20',
  dd1561OrdersAuthority: 'CG 1ST MARDIV TAD ORDERS 0456-26',
  dd1561OrdersDate: '2026-01-02',
  dd1561BahWithDependentsConfirmed: true,
};

export const DD1561_SAMPLE_T = {
  ...base,
  dd1561FsaType: 'T',
  dd1561FsaTRows: [
    { location: 'MCAGCC TWENTYNINE PALMS CA', from: '2026-01-05', to: '2026-01-31' },
    { location: 'MCMWTC BRIDGEPORT CA', from: '2026-02-01', to: '2026-02-20' },
    { location: 'FORT IRWIN CA', from: '2026-02-21', to: '2026-03-10' },
  ],
} as unknown as FormData;

/** FSA-T with five legs: rows 4 and 5 go on the continuation page. */
export const DD1561_SAMPLE_T5 = {
  ...DD1561_SAMPLE_T,
  dd1561FsaTRows: [
    ...(DD1561_SAMPLE_T.dd1561FsaTRows as unknown[]),
    { location: 'MCB CAMP LEJEUNE NC', from: '2026-03-11', to: '2026-03-30' },
    { location: 'MCAS BEAUFORT SC', from: '2026-03-31', to: '2026-04-15' },
  ],
} as unknown as FormData;

export const DD1561_SAMPLE_R = {
  ...base,
  dd1561FsaType: 'R',
  dd1561DualMilitary: true,
  dd1561SpouseEdipi: '2345678901',
  dd1561SpouseBranchComponent: 'USN ACTIVE',
  dd1561SpouseResidingTogether: 'was',
  dd1561LastTdyWithin30: '',
  dd1561FsaRLastPds: 'MCB CAMP PENDLETON CA',
  dd1561FsaRDetachDate: '2026-06-01',
  dd1561FsaRLeaveFrom: '2026-06-02',
  dd1561FsaRLeaveTo: '2026-06-11',
  dd1561FsaRProceedFrom: '2026-06-12',
  dd1561FsaRProceedTo: '2026-06-15',
  dd1561FsaRNewPds: 'MCB CAMP BUTLER OKINAWA JA',
  dd1561FsaRReportDate: '2026-06-17',
  dd1561CertifierName: 'J. A. SMITH',
  dd1561CertifierTitle: 'ADJUTANT',
  dd1561CertifierOrganization: '1ST BN, 5TH MAR',
  dd1561CertifiedDate: '2026-11-21',
} as unknown as FormData;

export const DD1561_SAMPLE_S = {
  ...base,
  dd1561FsaType: 'S',
  dd1561LastTdyWithin30: 'was',
  dd1561PriorPeriodType: 'S',
  dd1561PriorPeriodFrom: '2026-01-01',
  dd1561PriorPeriodTo: '2026-02-20',
  dd1561FsaSSegments: [{ status: 'away', from: '2026-03-01', to: '2026-05-15', shipUnit: 'USS AMERICA (LHA 6)' }],
  dd1561FsaSShipUnit: 'USS AMERICA (LHA 6) / 31ST MEU',
  dd1561FsaSHomeport: 'SASEBO JA',
} as unknown as FormData;
