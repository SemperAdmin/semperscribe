/**
 * P3.3 (DONDOCS_PARITY_PLAN) - per-type guidance content.
 *
 * What each document type is, when to use it, when not to, and an
 * example subject. Grounded in SECNAV M-5216.5 (DON Correspondence
 * Manual), MCO 5216.20B, and MCO 5215.1K. Types without an entry fall
 * back to a generic note in the dialog.
 */

export interface GuidanceEntry {
  /** DOCUMENT_TYPES key. */
  type: string;
  label: string;
  what: string;
  whenToUse: string[];
  whenNotToUse: string[];
  example: string;
  citation: string;
}

export const GUIDANCE: GuidanceEntry[] = [
  {
    type: 'basic',
    label: 'Standard Naval Letter',
    what: 'The workhorse of official DON correspondence: formal communication between DON activities, or with DoD commands and agencies aware of the format.',
    whenToUse: [
      'Official business between naval activities or up/down the chain of command',
      'Requests, reports, endorsement-bound packages, and taskers needing a permanent record',
    ],
    whenNotToUse: [
      'Correspondence with civilian businesses or the public - use a business letter',
      'Informal internal notes within one activity - use a memorandum or MFR',
    ],
    example: 'REQUEST FOR TEMPORARY ADDITIONAL DUTY FUNDING',
    citation: 'SECNAV M-5216.5, Ch. 7',
  },
  {
    type: 'endorsement',
    label: 'Endorsement',
    what: 'Forwards a basic letter through the chain of command, adding approval, disapproval, comment, or information at each level.',
    whenToUse: [
      'Routing a subordinate\'s request up the chain with your recommendation',
      'Returning correspondence down the chain with a decision',
    ],
    whenNotToUse: [
      'Starting new correspondence - an endorsement always rides an existing basic letter',
      'Same-page response when a separate-page format is required by the addressee',
    ],
    example: 'FIRST ENDORSEMENT on Sgt Smith ltr of 3 May 26',
    citation: 'SECNAV M-5216.5, Ch. 8',
  },
  {
    type: 'mfr',
    label: 'Memorandum for the Record',
    what: 'An internal record of information not otherwise documented: phone conversations, verbal decisions, meeting outcomes.',
    whenToUse: [
      'Documenting a verbal agreement, telephone call, or decision for the file',
      'Preserving context future readers of the file will need',
    ],
    whenNotToUse: [
      'Communicating to another activity - it stays in the file',
      'Anything requiring a signature or action from an addressee',
    ],
    example: 'TELEPHONE CONVERSATION WITH HQMC MANPOWER REGARDING PROMOTION STATUS',
    citation: 'SECNAV M-5216.5, Ch. 10',
  },
  {
    type: 'from-to-memo',
    label: 'From-To Memorandum',
    what: 'Informal communication between individuals or offices within the same activity.',
    whenToUse: [
      'Internal taskers, coordination, and requests inside one command',
      'Subordinate-to-senior or office-to-office notes not needing letterhead formality',
    ],
    whenNotToUse: [
      'Anything leaving the activity - use a standard letter',
      'Matters of permanent record significance - use a standard letter or MFR',
    ],
    example: 'REQUEST FOR ADMIN SUPPORT DURING FIELD EXERCISE',
    citation: 'SECNAV M-5216.5, Ch. 10',
  },
  {
    type: 'moa',
    label: 'Memorandum of Agreement',
    what: 'Documents mutual obligations between two or more parties, including resource or funding commitments.',
    whenToUse: [
      'Two activities commit resources, funds, personnel, or facilities to each other',
      'Support relationships needing signatures from both parties',
    ],
    whenNotToUse: [
      'Statements of intent with no binding commitments - use an MOU',
      'One-sided direction to a subordinate - use a directive or letter',
    ],
    example: 'AGREEMENT BETWEEN MCB QUANTICO AND FBI ACADEMY FOR RANGE FACILITY USE',
    citation: 'SECNAV M-5216.5, Ch. 11',
  },
  {
    type: 'mou',
    label: 'Memorandum of Understanding',
    what: 'Documents a mutual understanding or intent between parties without binding resource commitments.',
    whenToUse: [
      'Aligning intentions, policies, or general areas of cooperation',
      'Framework understandings preceding a detailed MOA',
    ],
    whenNotToUse: [
      'Any exchange of funds, personnel, or resources - use an MOA',
    ],
    example: 'UNDERSTANDING BETWEEN I MEF AND NAVAL HOSPITAL REGARDING MEDICAL TRAINING',
    citation: 'SECNAV M-5216.5, Ch. 11',
  },
  {
    type: 'business-letter',
    label: 'Business Letter',
    what: 'Correspondence with agencies, businesses, or individuals outside DoD unfamiliar with the naval letter format.',
    whenToUse: [
      'Writing to civilian companies, contractors, universities, or private citizens',
      'Congressional correspondence when a personal tone is appropriate',
    ],
    whenNotToUse: [
      'Communication between naval activities - use the standard letter',
    ],
    example: 'Response to a vendor inquiry regarding facility access procedures',
    citation: 'SECNAV M-5216.5, Ch. 9',
  },
  {
    type: 'mco',
    label: 'Marine Corps Order',
    what: 'A directive prescribing policy, responsibilities, or procedures with continuing applicability.',
    whenToUse: [
      'Establishing policy or procedure expected to remain in force over a year',
      'Assigning enduring responsibilities across a command',
    ],
    whenNotToUse: [
      'One-time or short-lived direction - use a bulletin',
      'Information without direction - use a letter or newsletter',
    ],
    example: 'COMMAND SPONSORSHIP AND ORIENTATION PROGRAM',
    citation: 'MCO 5215.1K',
  },
  {
    type: 'bulletin',
    label: 'Marine Corps Bulletin',
    what: 'A directive of temporary applicability - self-cancelling, twelve months or less.',
    whenToUse: [
      'One-time taskers, annual requirements, or interim guidance with an end date',
    ],
    whenNotToUse: [
      'Policy lasting past twelve months - use an Order',
    ],
    example: 'FISCAL YEAR 2027 ANNUAL TRAINING REQUIREMENTS SUBMISSION',
    citation: 'MCO 5215.1K',
  },
  {
    type: 'position-paper',
    label: 'Position Paper',
    what: 'A staffing paper arguing a command position on an issue for a decision-maker.',
    whenToUse: [
      'Advocating a course of action with supporting rationale',
    ],
    whenNotToUse: [
      'Neutral background - use an information paper',
      'Presenting options for decision - use a decision paper',
    ],
    example: 'CONSOLIDATION OF BATTALION ADMIN SECTIONS',
    citation: 'MCO 5216.20B',
  },
  {
    type: 'information-paper',
    label: 'Information Paper',
    what: 'A staffing paper providing neutral background on a subject, bullet format.',
    whenToUse: [
      'Briefing a senior on facts, status, or background without advocacy',
    ],
    whenNotToUse: [
      'Recommending action - use a position or decision paper',
    ],
    example: 'STATUS OF BARRACKS RENOVATION PROJECTS',
    citation: 'MCO 5216.20B',
  },
  {
    type: 'decision-paper',
    label: 'Decision Paper',
    what: 'A staffing paper framing a decision: issue, options, recommendation, and a decision block for the signer.',
    whenToUse: [
      'A senior must choose among courses of action and sign the choice',
    ],
    whenNotToUse: [
      'No decision required - use an information paper',
    ],
    example: 'SELECTION OF ANNUAL BALL VENUE',
    citation: 'MCO 5216.20B',
  },
  {
    type: 'executive-correspondence',
    label: 'Executive Correspondence',
    what: 'Correspondence prepared for flag-level or senior-executive signature, including White House and congressional replies.',
    whenToUse: [
      'Letters signed at the SECNAV, CMC, or general-officer level',
      'Congressional inquiry responses routed through executive channels',
    ],
    whenNotToUse: [
      'Routine command-level correspondence',
    ],
    example: 'Response to congressional inquiry on behalf of the Commandant',
    citation: 'SECNAV M-5216.5, Ch. 12',
  },
  {
    type: 'amhs',
    label: 'AMHS / Naval Message',
    what: 'Record message traffic through the Automated Message Handling System, for operational or time-sensitive direction.',
    whenToUse: [
      'Time-sensitive direction to many addressees with record traffic requirements',
      'GENADMIN announcements requiring command-wide dissemination',
    ],
    whenNotToUse: [
      'Routine correspondence a letter or e-mail covers',
    ],
    example: 'GENADMIN: FY27 ENLISTED RETENTION CAMPAIGN GUIDANCE',
    citation: 'NTP 3(J)',
  },
];

export function getGuidance(documentType: string): GuidanceEntry | undefined {
  return GUIDANCE.find((g) => g.type === documentType);
}
