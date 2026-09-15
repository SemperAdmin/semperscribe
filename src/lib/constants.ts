/**
 * Application constants for Naval Letter Generator
 */

/**
 * Reference type options for naval correspondence
 * Used in reference input dropdowns
 */
export const REFERENCE_TYPES = [
  { value: 'ltr', label: 'Letter (ltr)' },
  { value: 'msg', label: 'Message (msg)' },
  { value: 'memo', label: 'Memorandum (memo)' },
  { value: 'AA Form', label: 'Administrative Action Form (AA Form)' },
  { value: 'request', label: 'Request' },
  { value: 'report', label: 'Report' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'notice', label: 'Notice' },
  { value: 'order', label: 'Order' },
  { value: 'directive', label: 'Directive' },
  { value: 'endorsement', label: 'Endorsement' }
];

/**
 * Common originators ("who") for reference autocomplete/suggestions
 * Used in structured reference input
 */
export const COMMON_ORIGINATORS = [
  'CO',
  'XO',
  'CMC',
  'S-1',
  '1stSgt',
  'CNO',
  'SECNAV',
  'LCpl Semper Admin'
];

/**
 * Distribution Statements for Marine Corps Directives
 * Source: SECNAVINST 5510.36
 */
export const DISTRIBUTION_STATEMENTS = {
  A: {
    code: 'A',
    text: 'DISTRIBUTION STATEMENT A: Approved for public release; distribution is unlimited.',
    requiresFillIns: false,
    description: 'Unclassified, no restrictions',
  },
  B: {
    code: 'B',
    text: 'DISTRIBUTION STATEMENT B: Distribution authorized to U.S. Government agencies only; (fill in reason) (date of determination). Other requests for this document will be referred to (insert originating command).',
    requiresFillIns: true,
    fillInFields: ['reason', 'dateOfDetermination', 'originatingCommand'],
    description: 'Restricted to US Gov agencies',
  },
  C: {
    code: 'C',
    text: 'DISTRIBUTION STATEMENT C: Distribution authorized to U.S. Government agencies and their contractors; (fill in reason) (date of determination). Other requests for this document will be referred to (insert originating command).',
    requiresFillIns: true,
    fillInFields: ['reason', 'dateOfDetermination', 'originatingCommand'],
    description: 'Extends to gov contractors',
  },
  D: {
    code: 'D',
    text: 'DISTRIBUTION STATEMENT D: Distribution authorized to DOD and DOD contractors only; (fill in reason) (date of determination). Other U.S. requests shall be referred to (insert originating command).',
    requiresFillIns: true,
    fillInFields: ['reason', 'dateOfDetermination', 'originatingCommand'],
    description: 'Limited to DoD & contractors',
  },
  E: {
    code: 'E',
    text: 'DISTRIBUTION STATEMENT E: Distribution authorized to DOD components only; (fill in reason) (date of determination). Other requests must be referred to (insert originating command).',
    requiresFillIns: true,
    fillInFields: ['reason', 'dateOfDetermination', 'originatingCommand'],
    description: 'Most restrictive unclassified',
  },
  F: {
    code: 'F',
    text: 'DISTRIBUTION STATEMENT F: Further dissemination only as directed by (insert originating command) (date of determination) or higher DOD authority.',
    requiresFillIns: true,
    fillInFields: ['originatingCommand', 'dateOfDetermination'],
    description: 'Highly controlled',
  },
  X: {
    code: 'X',
    text: 'DISTRIBUTION STATEMENT X: Distribution authorized to U.S. Government agencies and private individuals or enterprises eligible to obtain export-controlled technical data in accordance with OPNAVINST 5510.161; (date of determination). Other requests shall be referred to (originating command).',
    requiresFillIns: true,
    fillInFields: ['dateOfDetermination', 'originatingCommand'],
    description: 'Export-controlled data',
  }
};

export const COMMON_RESTRICTION_REASONS = [
  'administrative/operational use',
  'contractor performance evaluation',
  'premature dissemination',
  'proprietary information',
  'test and evaluation',
  'vulnerability analysis',
  'critical technology',
  'operational security'
];

/**
 * The Administration and Logistics subsections a directive starts with.
 *
 * A function, not a frozen object: each document needs its own copy, and
 * a shared literal would let one document's edits reach another.
 *
 * This lives here because the shape used to be spelled out in the page's
 * initial useState and NOWHERE else - blankFormData, which every draft,
 * template, .nldp and share-link load runs through, left the key
 * undefined. The reports sync then read
 * `prev.adminSubsections!.reportsRequired` through a non-null assertion
 * that was not true, and loading any directive template with reports
 * enabled threw a TypeError.
 */
export const defaultAdminSubsections = (): import('@/types').AdminSubsections => ({
  recordsManagement: { show: false, content: '', order: 0 },
  privacyAct: { show: false, content: '', order: 0 },
  reportsRequired: { show: false, content: 'None.', order: 0 },
});
