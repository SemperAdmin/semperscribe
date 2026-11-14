/**
 * P3.3 (DONDOCS_PARITY_PLAN) - per-type guidance content.
 *
 * What each document type is, when to use it, when not to, and an
 * example subject. Grounded in SECNAV M-5216.5 (DON Correspondence
 * Manual), MCO 5216.20B, MCO 5215.1K, and for SECNAV directives SECNAV
 * M-5215.1 (rules as recorded in docs/POLICY_COMPLIANCE_AUDIT.md). Types
 * without an entry fall back to a note naming the type (GuidanceDialog).
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
    what: 'Forwards a basic letter through the chain of command, adding approval, disapproval, comment, or information at each level. It goes on the signature page of the letter it endorses when the whole endorsement fits there, and on a new page when it does not (9-1).',
    whenToUse: [
      'Routing a subordinate\'s request up the chain with your recommendation',
      'Returning correspondence down the chain with a decision',
      'Adding a short endorsement to the signature page of the letter below it, which 9-1 allows when it fits',
    ],
    whenNotToUse: [
      'Starting new correspondence - an endorsement always rides an existing basic letter',
      'Same-page placement for an endorsement long enough to run past the foot of the signature page',
    ],
    example: 'FIRST ENDORSEMENT on Sgt Smith ltr of 3 May 26, or FIRST ENDORSEMENT alone on a same-page endorsement which omits the identification (9-2.1.a)',
    citation: 'SECNAV M-5216.5, Ch. 9',
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
    citation: 'SECNAV M-5216.5, Ch. 10',
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
    citation: 'SECNAV M-5216.5, Ch. 10',
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
    citation: 'SECNAV M-5216.5, Ch. 11',
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
    type: 'change-transmittal',
    label: 'Change Transmittal',
    what: 'Transmits page changes to an existing Marine Corps Order: replacement or added pages, issued under the parent order\'s identity and a change number (for example MCO 1000.1 W/CH-1).',
    whenToUse: [
      'Amending part of an order while most of its pages stay current',
      'Inserting replacement or added pages (such as 4a and 4b) into the basic order',
    ],
    whenNotToUse: [
      'A change touching half or more of the order\'s pages - revise the order',
      'An order already carrying nine changes - revise it',
    ],
    example: 'MCO 1000.1 W/CH-1: new page inserts to the basic order',
    citation: 'MCO 5215.1K',
  },
  {
    type: 'secnav-instruction',
    label: 'SECNAV Instruction',
    what: 'A Secretary of the Navy directive with continuing effect, designated SECNAVINST with the SSIC and a consecutive number. It opens with Purpose, then Cancellation when it supersedes another directive.',
    whenToUse: [
      'Department of the Navy policy, responsibilities, or procedures meant to stay in force until cancelled',
    ],
    whenNotToUse: [
      'Direction of a temporary nature - use a SECNAV Notice',
      'Marine Corps policy issued by the Commandant - use a Marine Corps Order',
      'Text running past five pages including the signature block - move detail into enclosures',
      'A change touching more than 25 percent of an instruction\'s pages - issue a revision',
    ],
    example: 'DEPARTMENT OF THE NAVY RECORDS MANAGEMENT PROGRAM',
    citation: 'SECNAV M-5215.1',
  },
  {
    type: 'secnav-notice',
    label: 'SECNAV Notice',
    what: 'A Secretary of the Navy directive of temporary nature. It carries no consecutive number and is cited by SSIC and date. Without a cancellation paragraph it cancels itself after one year, shown as a "Canc:" date in the upper right.',
    whenToUse: [
      'One-time or time-limited direction across the Department of the Navy',
    ],
    whenNotToUse: [
      'Policy meant to last - use a SECNAV Instruction',
      'Marine Corps direction of a temporary nature - use a Marine Corps Bulletin',
    ],
    example: 'FISCAL YEAR 2027 DIRECTIVES REVIEW',
    citation: 'SECNAV M-5215.1',
  },
  {
    type: 'volume',
    label: 'Volume',
    what: 'One volume of a policy manual issued in volumes: chapters, sections and numbered paragraphs, chapter-page numbering (1-1, 1-2), appendices, and figures. The layout follows the published volumes of MCO 5800.16, the Legal Support and Administration Manual, which has no separate style guide.',
    whenToUse: [
      'Drafting or revising a volume of a manual issued in volumes, such as MCO 5800.16',
    ],
    whenNotToUse: [
      'A single order or bulletin - use the Marine Corps Order or Bulletin type',
      'Changing a few pages of an existing order - use a Change Transmittal',
    ],
    example: 'LEGAL SUPPORT AND ADMINISTRATION MANUAL',
    citation: 'MCO 5800.16 (published volumes)',
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
    type: 'aa-form',
    label: 'AA Form (NAVMC 10274)',
    what: 'The Administrative Action form: a Marine\'s personnel request routed through the chain of command for a decision, with each level\'s recommendation.',
    whenToUse: [
      'A personnel request needing a command or headquarters decision, such as an extension on station, a tour curtailment, or a BAH or PCS travel matter',
      'Requests the shipped AA templates cover - open Browse Templates to start from one',
    ],
    whenNotToUse: [
      'A service record entry - use Page 11',
      'Correspondence between commands - use a naval letter',
    ],
    example: 'REQUEST FOR 12-MONTH EXTENSION ON STATION',
    citation: 'NAVMC 10274',
  },
  {
    type: 'page11',
    label: 'Page 11 (NAVMC 118(11))',
    what: 'Administrative Remarks: entries in one Marine\'s service record. Entries fill the left column, then the right, then continuation pages. The name and DoD ID on the page say whose record it is.',
    whenToUse: [
      'Recording an entry an order or MARADMIN requires in the service record, such as an accommodation decision under MARADMIN 192/26',
    ],
    whenNotToUse: [
      'A request needing a decision - use the AA Form',
      'A leader\'s record of a counseling session - use the Counseling Worksheet',
    ],
    example: 'The entry text, for example a shaving accommodation entry',
    citation: 'NAVMC 118(11)',
  },
  {
    type: 'navmc10922',
    label: 'Dependency Application (NAVMC 10922)',
    what: 'Adds or removes a dependent in the Marine Corps pay system for BAH and travel and transportation entitlements, with the documents viewed and the attesting officer\'s certification.',
    whenToUse: [
      'Gaining a dependent by marriage, birth, adoption, or a stepchild',
      'Losing a dependent, for example by divorce',
    ],
    whenNotToUse: [
      'Overseas cost-of-living allowance - use NAVMC 11106',
    ],
    example: 'Marriage, with the marriage certificate viewed',
    citation: 'MCO 1751.3 W/CH-1',
  },
  {
    type: 'navmc10132',
    label: 'Unit Punishment Book (NAVMC 10132)',
    what: 'The record of nonjudicial punishment under Article 15, UCMJ: rights advisement, offenses and findings, punishment, suspension and vacation, appeal, and the unit diary entry. The NJP package documents are generated from its data.',
    whenToUse: [
      'Recording an NJP from rights advisement through appeal and the unit diary entry',
    ],
    whenNotToUse: [
      'Corrective action when no NJP is held - use counseling or a Page 11 entry as your order directs',
    ],
    example: 'UA from 0600, 10 Aug 26 to 1900, 12 Aug 26',
    citation: 'MCO 5800.16 Vol 14; MARADMIN 427/23',
  },
  {
    type: 'navmc11106',
    label: 'COLA Application (NAVMC 11106)',
    what: 'Application for overseas Cost-of-Living Allowance, filled onto the official form. Part D and both signature blocks stay open for the commander.',
    whenToUse: [
      'Starting or changing OCONUS COLA, for the member alone or with dependents',
    ],
    whenNotToUse: [
      'Adding or removing a dependent - use NAVMC 10922',
      'Temporary lodging on arrival or departure - use the TLA Packet',
    ],
    example: 'Member with dependents, installation approved',
    citation: 'MCTFS PRIUM par 80102; DoD FMR Vol 7A Ch 68',
  },
  {
    type: 'dd368',
    label: 'Conditional Release (DD 368)',
    what: 'A member of one Service or component asks to be released to enter another. The member and recruiter, the authorizing official, and the enlisting or appointing official each complete a section.',
    whenToUse: [
      'A member asks to leave the current Service or component to join another',
    ],
    whenNotToUse: [
      'A request handled inside the Marine Corps - use the AA Form',
    ],
    example: 'Release from the Marine Corps Reserve to enlist in the Navy',
    citation: 'DD Form 368',
  },
  {
    type: 'tla-packet',
    label: 'TLA Packet',
    what: 'A Temporary Lodging Allowance request: the facts finance needs to compute the claim, the housing search statement, the certifications the situation calls for, and a routing checklist. Finance sets the rates and computes the amount.',
    whenToUse: [
      'Requesting TLA for lodging while arriving at or departing an overseas station',
    ],
    whenNotToUse: [
      'Ongoing overseas cost of living - use NAVMC 11106',
      'In place of the command\'s NAVMC 11116 - the packet supports it',
    ],
    example: 'Arrival, Marine and spouse, 10 days of lodging',
    citation: 'DoD FMR Vol 7A Ch 68; FPM Vol 1 para 0703',
  },
  {
    type: 'counseling',
    label: 'Counseling Worksheet',
    what: 'A guided counseling session recorded for the senior and the Marine counseled: the occasion and timing, the six functional areas, targets for the coming period, and a record for two signers.',
    whenToUse: [
      'Preparing and recording a counseling session the order calls for',
    ],
    whenNotToUse: [
      'An entry in the service record - use Page 11',
    ],
    example: 'Initial counseling on joining the unit',
    citation: 'MCO 1500.61; NAVMC 2795',
  },
  {
    type: 'i-type',
    label: 'I-Type Publication',
    what: 'The cover and administrative pages of a Marine Corps technical publication (TM, SL-3, SL-4, LI, MI, SI, TI): short title, publication type, issuing entity, End Items table, distribution, destruction and supersedure notices, and Appendix A.',
    whenToUse: [
      'Issuing or updating the front matter of a technical manual, stocklist, or lubrication, modification, supply or technical instruction',
    ],
    whenNotToUse: [
      'Policy or direction to commands - use a Marine Corps Order or Bulletin',
      'Correspondence about a publication - use a naval letter',
    ],
    example: 'TECHNICAL MANUAL for the end items listed on the cover',
    citation: 'I-Type instruction sheet',
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
