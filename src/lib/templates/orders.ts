import { DocumentTemplate } from './types';
import { MCODefinition, BulletinDefinition, ChangeTransmittalDefinition } from '@/lib/schemas';

/**
 * Assumption of Command Order Template
 * Per MCO 5215.1K, Chapter 1, Figure 1-1
 * Uses SSIC 1301 and follows the standard MCO format
 */
export const AssumptionOfCommandTemplate: DocumentTemplate = {
  id: 'assumption-of-command',
  typeId: 'mco',
  name: 'Assumption of Command',
  description: 'Order publishing an assumption of command per MCO 5215.1K, Figure 1-1.',
  definition: MCODefinition,
  defaultData: {
    documentType: 'mco',
    ssic: '1301',
    originatorCode: '',
    date: '',
    from: 'Commanding General',
    to: 'Distribution List',
    subj: 'ASSUMPTION OF COMMAND',

    // MCO Specifics
    orderPrefix: 'DivO',
    directiveTitle: '',

    distribution: {
      type: 'standard',
      statementCode: 'A',
    },

    paragraphs: [
      { id: 1, level: 1, title: 'Situation', content: 'To publish an assumption of command as required by reference (a).' },
      { id: 2, level: 1, title: 'Cancellation', content: '[Predecessor\'s assumption of command order].' },
      { id: 3, level: 1, title: 'Execution', content: 'I have assumed duties as Commanding General, [Unit Designation], this date as directed by reference (b). All effective orders and directives issued by my predecessors remain in effect.' },
    ],
    sig: '',

    // Arrays
    vias: [],
    references: [
      '(a) U.S. Navy Regulations, 1990, Article 0703',
      '(b) [Appropriate reference directing assumption of command]'
    ],
    enclosures: [],
    copyTos: [
      'Seniors in chain-of-command',
      'Subordinate units'
    ],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', bodyFont: 'times', accentColor: 'black'
  }
};

export const MCOTemplate: DocumentTemplate = {
  id: 'mco-default',
  typeId: 'mco',
  name: 'Marine Corps Order',
  description: 'Permanent directive establishing policy.',
  definition: MCODefinition,
  defaultData: {
    documentType: 'mco',
    ssic: '5210',
    originatorCode: 'AR',
    date: '10 Feb 26',
    from: 'Commandant of the Marine Corps',
    to: 'Distribution List',
    subj: 'MARINE CORPS RECORDS MANAGEMENT PROGRAM',

    // MCO Specifics
    orderPrefix: 'MCO',
    directiveTitle: 'MARINE CORPS ORDER 5210.11G',
    distribution: {
        type: 'pcn-with-copy',
        pcn: '10200150000',
        statementCode: 'A',
        statementReason: 'administrative/operational use',
        statementDate: '10 Feb 26',
        statementAuthority: 'CMC (AR)',
        copyTo: [
          { code: '8145001', qty: 1 },
          { code: '0320001', qty: 2 }
        ]
    },

    // Reports
    reports: [
      {
        id: 'rpt-1',
        title: 'Annual Records Management Assessment',
        controlSymbol: 'MCO 5210.11G-01',
        paragraphRef: '4.b.(2)',
        exempt: false
      },
      {
        id: 'rpt-2',
        title: 'Records Disposition Schedule Update',
        controlSymbol: 'MCO 5210.11G-02',
        paragraphRef: '4.c.',
        exempt: false
      }
    ],

    // Admin Subsections
    adminSubsections: {
      recordsManagement: {
        show: true,
        content: 'Records created by this Order shall be managed per SECNAV M-5210.1 and disposed of per reference (b).',
        order: 1
      },
      privacyAct: {
        show: true,
        content: 'Any misuse or unauthorized disclosure of PII may result in criminal and civil penalties.',
        order: 2
      },
      reportsRequired: {
        show: true,
        content: 'Reports required by this Order are listed in enclosure (3).',
        order: 3
      }
    },

    // Structured paragraphs (user ruling 2026-06-10): designators are
    // generated from levels, never typed into content. Execution:
    // a. Commander's Intent / b. Concept of Operations / c. Tasks
    // (unit taskings as (1), (2)) / d. Coordinating Instructions.
    paragraphs: [
      { id: 1, level: 1, title: 'Situation', content: 'The Marine Corps requires a comprehensive records management program to ensure compliance with federal law and DoD policy.' },
      { id: 2, level: 2, content: 'The current records management program requires updating to align with recent changes in federal regulations and DoD directives.' },
      { id: 3, level: 2, content: 'This Order cancels MCO 5210.11F.' },
      { id: 4, level: 1, title: 'Cancellation', content: 'MCO 5210.11F.' },
      { id: 5, level: 1, title: 'Mission', content: 'Establish policy and procedures for the Marine Corps Records Management Program.' },
      { id: 6, level: 1, title: 'Execution', content: '' },
      { id: 7, level: 2, title: 'Commander\'s Intent', content: 'Ensure all Marine Corps organizations maintain records in accordance with federal law and DoD policy.' },
      { id: 8, level: 2, title: 'Concept of Operations', content: 'Commands at all levels will designate a Records Manager responsible for program implementation.' },
      { id: 9, level: 3, content: 'Each command will conduct an annual records management assessment.' },
      { id: 10, level: 3, content: 'Results will be reported to CMC (AR) NLT 31 October annually.' },
      { id: 11, level: 2, title: 'Tasks', content: '' },
      { id: 12, level: 3, content: 'CMC (AR) will serve as the Marine Corps Records Manager and provide program oversight.' },
      { id: 13, level: 3, content: 'Commanding Generals and Commanding Officers will appoint command Records Managers in writing.' },
      { id: 14, level: 2, title: 'Coordinating Instructions', content: 'All commands will complete initial compliance review within 180 days of the effective date of this Order.' },
      { id: 15, level: 1, title: 'Administration and Logistics', content: '' },
      { id: 16, level: 2, content: 'Training requirements will be coordinated through TECOM.' },
      { id: 17, level: 1, title: 'Command and Signal', content: 'This Order is applicable to the Marine Corps Total Force.' }
    ],
    sig: 'I. M. MARINE',
    delegationText: 'By direction',

    // Arrays
    vias: [],
    references: [
      '(a) Title 44, United States Code',
      '(b) SECNAV M-5210.1',
      '(c) DoD Directive 5015.2',
      '(d) SECNAVINST 5210.8E'
    ],
    enclosures: [
      '(1) Definitions',
      '(2) Records Retention Schedule',
      '(3) Required Reports'
    ],
    copyTos: [],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', bodyFont: 'times', accentColor: 'black'
  }
};

export const BulletinTemplate: DocumentTemplate = {
    id: 'bulletin-default',
    typeId: 'bulletin',
    name: 'Marine Corps Bulletin',
    description: 'Directive of duration less than 12 months.',
    definition: BulletinDefinition,
    defaultData: {
      documentType: 'bulletin',
      ssic: '1500',
      originatorCode: 'TRNG',
      date: '10 Feb 26',
      from: 'Commandant of the Marine Corps',
      to: 'Distribution List',
      subj: 'ANNUAL RIFLE AND PISTOL MARKSMANSHIP REQUALIFICATION REQUIREMENTS FOR FISCAL YEAR 2026',

      // Bulletin Specifics
      orderPrefix: 'MCBul',
      directiveTitle: 'MARINE CORPS BULLETIN 1500',
      cancellationDate: '31 Dec 26',
      cancellationType: 'fixed',
      cancellationContingency: 'This bulletin is cancelled upon completion of the FY26 requalification cycle or 31 Dec 26, whichever occurs first.',
      distribution: {
          type: 'pcn',
          pcn: '10200220000',
          statementCode: 'A',
          statementReason: 'administrative/operational use',
          statementDate: '10 Feb 26',
          statementAuthority: 'CMC (TRNG)'
      },

      // Reports
      reports: [
        {
          id: 'rpt-1',
          title: 'Quarterly Marksmanship Requalification Progress Report',
          controlSymbol: 'MCBul 1500-01',
          paragraphRef: '3.b.',
          exempt: false
        }
      ],

      // Admin Subsections
      adminSubsections: {
        recordsManagement: {
          show: true,
          content: 'Records created by this Bulletin shall be managed per SECNAV M-5210.1.',
          order: 1
        },
        privacyAct: {
          show: false,
          content: '',
          order: 2
        },
        reportsRequired: {
          show: true,
          content: 'Quarterly progress reports are required per paragraph 3.b.',
          order: 3
        }
      },

      paragraphs: [
        { id: 1, level: 1, content: 'Purpose. To establish the annual requalification requirements and timeline for rifle and pistol marksmanship for FY26.' },
        { id: 2, level: 1, content: 'Background. Per reference (a), all Marines are required to maintain marksmanship proficiency through annual requalification.' },
        { id: 3, level: 1, content: 'Action. Commanding Officers will ensure the following actions are completed.' },
        { id: 4, level: 2, content: 'All Marines will complete rifle requalification NLT 30 Sep 26.' },
        { id: 5, level: 2, content: 'Marines in designated billets will complete pistol requalification NLT 30 Sep 26.' },
        { id: 6, level: 3, content: 'Pistol qualification is mandatory for officers, SNCOs, and Marines in designated MOSs per reference (b).' },
        { id: 7, level: 1, content: 'Reserve Applicability. This Bulletin applies to all Reserve component Marines. Reserve units will coordinate range time through their respective I-I staffs.' },
        { id: 8, level: 1, content: 'Cancellation Contingency. This Bulletin is cancelled upon completion of the FY26 requalification cycle or 31 Dec 26, whichever occurs first.' }
      ],
      sig: 'I. M. MARINE',
      delegationText: 'By direction',

      // Arrays
      vias: [],
      references: [
        '(a) MCO 3574.2L',
        '(b) MCO 8010.13A',
        '(c) MARADMIN 045/26'
      ],
      enclosures: [
        '(1) FY26 Requalification Timeline',
        '(2) Range Scheduling POC List'
      ],
      copyTos: [],
      line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
      referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
      startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
      headerType: 'USMC', bodyFont: 'times', accentColor: 'black'
    }
  };

export const ChangeTransmittalTemplate: DocumentTemplate = {
  id: 'change-transmittal-default',
  typeId: 'change-transmittal',
  name: 'Change Transmittal',
  description: 'Transmits amendments to an existing order per MCO 5215.1K para 40-44.',
  definition: ChangeTransmittalDefinition,
  defaultData: {
    documentType: 'change-transmittal',
    ssic: '1000',
    originatorCode: 'ARDB',
    date: '10 Feb 26',
    from: 'Commandant of the Marine Corps',
    to: 'Distribution List',
    subj: 'FORMAT OF A CHANGE TRANSMITTAL',

    // Change Transmittal Specifics
    parentDirectiveTitle: 'MCO 1000.1',
    changeNumber: 1,
    orderPrefix: 'MCO',
    directiveTitle: 'MCO 1000.1 Ch 1',

    distribution: {
      type: 'pcn-with-copy',
      pcn: '10207570000',
      statementCode: 'A',
      statementReason: 'administrative/operational use',
      statementDate: '10 Feb 26',
      statementAuthority: 'CMC (ARDB)',
      copyTo: [
        { code: '8145001', qty: 2 },
        { code: '7000260', qty: 1 }
      ]
    },

    paragraphs: [
      { id: 1, level: 0, content: '1. Situation. To transmit new page inserts to the basic order.' },
      { id: 2, level: 0, content: '2. Mission. This change transmits updated policy and procedural guidance.' },
      { id: 3, level: 0, content: '3. Execution.' },
      { id: 4, level: 1, content: 'a. Remove the letterhead page and page 2, and replace with corresponding pages in the enclosure.' },
      { id: 5, level: 1, content: 'b. Remove Table of Contents and replace with corresponding Table of Contents contained in the enclosure.' },
      { id: 6, level: 1, content: 'c. Insert new pages 2, 4a, 4b, and 4c in the basic order.' },
      { id: 7, level: 0, content: '4. Summary of Change. This change updates references and incorporates revised procedural guidance.' },
      { id: 8, level: 0, content: '5. Filing Instructions. File the change transmittal page in front of the basic order.' }
    ],
    sig: 'I. M. COMMANDANT',

    // Arrays
    vias: [],
    references: [],
    enclosures: [
      '(1) New page inserts to MCO 1000.1'
    ],
    copyTos: [],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', bodyFont: 'times', accentColor: 'black'
  }
};
