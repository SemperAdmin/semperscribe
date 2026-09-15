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
  description: 'A complete worked Order: front matter, five-paragraph body to the fourth level, reports and enclosures.',
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
    // Courier is the directive face (MCO 5215.1K para 18b) and the
    // generator coerces to it anyway; naming it here keeps the template
    // honest about what the reader will get.
    bodyFont: 'courier',

    // Front matter per MCO 5215.1K para 48.  On by default because the
    // point of this template is to show the whole anatomy of an Order;
    // a drafter turns off what a short Order does not need under
    // Directive Options.
    showLocatorSheet: true,
    showRecordOfChanges: true,
    showStructuralPages: true,

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
        paragraphRef: '4.c.(3)(b)',
        exempt: false
      },
      {
        id: 'rpt-2',
        title: 'Records Disposition Schedule Update',
        controlSymbol: 'MCO 5210.11G-02',
        paragraphRef: '4.c.(1)',
        exempt: false
      }
    ],

    // Admin Subsections. mergeAdminSubsections inserts these as
    // subparagraphs of Administration and Logistics at export.
    adminSubsections: {
      recordsManagement: {
        show: true,
        content: 'Records created as a result of this Order shall be managed per reference (b) and disposed of per the approved disposition schedule.',
        order: 1
      },
      privacyAct: {
        show: true,
        content: 'Any misuse or unauthorized disclosure of personally identifiable information may result in both civil and criminal penalties.',
        order: 2
      },
      reportsRequired: {
        show: true,
        content: 'The reports required by this Order are listed in enclosure (3).',
        order: 3
      }
    },

    // Structured paragraphs (user ruling 2026-06-10): designators are
    // generated from levels, never typed into content.  The ladder runs
    // to the fourth level, 1. / a. / (1) / (a), which is as deep as
    // MCO 5215.1K para 33 goes before the underlined restart.
    paragraphs: [
      { id: 1, level: 1, title: 'Situation', content: 'Federal law requires every Marine Corps command to create, maintain, and dispose of its records under an approved schedule.  Reference (a) establishes the statutory basis and reference (b) implements it for the Department of the Navy.' },
      { id: 2, level: 2, content: 'The program established by Marine Corps Order (MCO) 5210.11F predates the electronic recordkeeping requirements imposed by references (c) and (d).' },
      { id: 3, level: 2, content: 'Inspections conducted during FY25 found inconsistent appointment of command Records Managers and incomplete disposition schedules across the Total Force.' },

      { id: 4, level: 1, title: 'Cancellation', content: 'MCO 5210.11F.' },

      { id: 5, level: 1, title: 'Mission', content: 'Establish policy, assign responsibilities, and prescribe procedures for the Marine Corps Records Management Program.' },

      { id: 6, level: 1, title: 'Execution', content: '' },
      { id: 7, level: 2, title: 'Commander\'s Intent', content: 'Every Marine Corps command treats its records as Federal assets and manages them from creation through final disposition.  The end state is a Total Force in which any record can be located, produced, and lawfully disposed of on demand.' },
      { id: 8, level: 2, title: 'Concept of Operations', content: 'The program operates through a Records Manager designated at each level of command, supported by a single disposition schedule and an annual self-assessment.' },
      { id: 9, level: 3, content: 'CMC (AR) sets policy, maintains the schedule, and reports Marine Corps compliance to the Department of the Navy.' },
      { id: 10, level: 3, content: 'Commands execute the program locally and assess their own compliance each fiscal year.' },
      { id: 11, level: 2, title: 'Tasks', content: '' },
      { id: 12, level: 3, content: 'CMC (AR) will serve as the Marine Corps Records Manager, publish the disposition schedule, and provide program oversight.' },
      { id: 13, level: 3, content: 'Commander, Marine Corps Systems Command will ensure Marine Corps information systems support the electronic recordkeeping requirements of reference (c).' },
      { id: 14, level: 3, content: 'Commanding Generals and Commanding Officers will:' },
      { id: 15, level: 4, content: 'Appoint a command Records Manager in writing within 60 days of assuming command.' },
      { id: 16, level: 4, content: 'Conduct an annual records management assessment and report the results to CMC (AR) no later than 31 October.' },
      { id: 17, level: 2, title: 'Coordinating Instructions', content: '' },
      { id: 18, level: 3, content: 'Commands will complete an initial compliance review within 180 days of the effective date of this Order.' },
      { id: 19, level: 3, content: 'Questions concerning this Order will be directed to CMC (AR).' },

      { id: 20, level: 1, title: 'Administration and Logistics', content: 'Records management training is coordinated through Training and Education Command (TECOM) and delivered through MarineNet.' },

      { id: 21, level: 1, title: 'Command and Signal', content: '' },
      { id: 22, level: 2, title: 'Command', content: 'This Order is applicable to the Marine Corps Total Force.' },
      { id: 23, level: 2, title: 'Signal', content: 'This Order is effective the date signed.' }
    ],
    sig: 'I. M. MARINE',
    delegationText: 'By direction',

    // Arrays
    vias: [],
    // The renderer generates the reference letter and the enclosure
    // number - the form labels the field "Reference (a)" and its
    // placeholder carries no letter.  A template that spells the
    // designator into the string prints it twice: "Ref:  (a) (a) Title
    // 44". Store the reference itself and nothing else.
    references: [
      'Title 44, United States Code',
      'SECNAV M-5210.1',
      'DoD Directive 5015.2',
      'SECNAVINST 5210.8E'
    ],
    enclosures: [
      'Definitions',
      'Records Retention Schedule',
      'Required Reports'
    ],
    copyTos: [],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', accentColor: 'black'
  }
};

/**
 * Marine Corps Order - Format Guide.
 *
 * The same skeleton as MCOTemplate, with every field and paragraph
 * carrying instructions about what belongs there instead of worked
 * content.  This is the read-then-type-over template, in the spirit of
 * the sample formats in MCO 5215.1K; nothing in it is usable prose and
 * none of it should survive into a real Order.
 *
 * It is a separate template rather than a mode of the one above because
 * the two answer different questions.  A drafter who knows the format
 * wants the worked Order to adapt; a drafter meeting an Order for the
 * first time wants to be told what paragraph 4.c is for.
 */
export const MCOFormatGuideTemplate: DocumentTemplate = {
  id: 'mco-format-guide',
  typeId: 'mco',
  name: 'Marine Corps Order (Format Guide)',
  description: 'The Order format explained in place: every paragraph says what belongs in it, per MCO 5215.1K. Type over it.',
  definition: MCODefinition,
  defaultData: {
    documentType: 'mco',
    ssic: '5215.1',
    originatorCode: 'ARDE',
    date: '10 Feb 26',
    from: 'Commandant of the Marine Corps',
    to: 'Distribution List',
    subj: 'SUBJECT IN ALL CAPITALS, ACRONYMS SPELLED OUT',

    orderPrefix: 'MCO',
    directiveTitle: 'MARINE CORPS ORDER 5215.1K',
    bodyFont: 'courier',

    showLocatorSheet: true,
    showRecordOfChanges: true,
    showStructuralPages: true,

    distribution: {
      type: 'pcn-with-copy',
      pcn: '10200000000',
      statementCode: 'A',
      statementReason: 'administrative/operational use',
      statementDate: '10 Feb 26',
      statementAuthority: 'CMC (ARDE)',
      copyTo: [
        { code: '0000000', qty: 1 }
      ]
    },

    reports: [
      {
        id: 'rpt-1',
        title: 'Name the report exactly as the tasking paragraph names it',
        controlSymbol: 'MCO 5215.1K-01',
        paragraphRef: '4.c.(2)',
        exempt: false
      }
    ],

    adminSubsections: {
      recordsManagement: {
        show: true,
        content: 'State how records created by this Order are managed and disposed of.  Cite the records manual as a reference rather than restating it.',
        order: 1
      },
      privacyAct: {
        show: true,
        content: 'Include this subparagraph only when the Order causes personally identifiable information to be collected, used, or maintained.',
        order: 2
      },
      reportsRequired: {
        show: true,
        content: 'Point to where the reports are listed.  Every report named here must also appear in the Reports Required section and in the paragraph that tasks it.',
        order: 3
      }
    },

    paragraphs: [
      { id: 1, level: 1, title: 'Situation', content: 'State the problem, the background, or the authority that makes this Order necessary.  Cite the governing law or higher directive as reference (a).  Give the reader only what is needed to understand why the Order exists.' },
      { id: 2, level: 2, content: 'Subdivide when the background carries more than one idea.  Never subdivide a paragraph into fewer than two parts: if there is an a., there is a b.' },
      { id: 3, level: 2, content: 'Each subdivision aligns under the first letter of the paragraph above it, four spaces per level, and never past the fourth (MCO 5215.1K para 33).' },

      { id: 4, level: 1, title: 'Cancellation', content: 'Name the directive this Order cancels, by designation only, in the form used by reference (b).  Cancellation is always the second paragraph.  Delete this paragraph if the Order cancels nothing.' },

      { id: 5, level: 1, title: 'Mission', content: 'State in one sentence, in the active voice, what this Order directs.  If the Mission needs subparagraphs, the Order is doing too much.' },

      { id: 6, level: 1, title: 'Execution', content: '' },
      { id: 7, level: 2, title: 'Commander\'s Intent', content: 'State the purpose and the end state in the commander\'s own words.  Describe the condition that exists when the Order has worked, not the steps taken to get there.' },
      { id: 8, level: 2, title: 'Concept of Operations', content: 'Describe in broad terms how the Order is carried out: who runs the program, through what structure, on what cycle.  Detail belongs under Tasks.' },
      { id: 9, level: 3, content: 'Use subparagraphs to separate phases, echelons, or lines of effort.' },
      { id: 10, level: 3, content: 'Keep the concept short enough that a reader can hold it in mind while reading the tasks.' },
      { id: 11, level: 2, title: 'Tasks', content: '' },
      { id: 12, level: 3, content: 'One subparagraph per tasked organization, named exactly as the distribution names it.  Start with the staff agency that owns the program.' },
      { id: 13, level: 3, content: 'Every task is a directive verb the addressee can act on: appoint, submit, publish, review.  Avoid "ensure" where a concrete act is meant.' },
      { id: 14, level: 3, content: 'When one organization carries several tasks, list them:' },
      { id: 15, level: 4, content: 'The fourth level, (a), is as deep as the ladder goes before the underlined restart.  If an Order needs more depth than this, restructure it.' },
      { id: 16, level: 4, content: 'Any task that produces a recurring report must also be listed in Reports Required with a control symbol.' },
      { id: 17, level: 2, title: 'Coordinating Instructions', content: '' },
      { id: 18, level: 3, content: 'Put here what applies to two or more of the tasked organizations: suspense dates, compliance windows, reporting channels.  A reference cited only inside an enclosure is listed there, not here, as reference (c) notes.' },
      { id: 19, level: 3, content: 'Name the point of contact for questions, by staff code rather than by person.' },

      { id: 20, level: 1, title: 'Administration and Logistics', content: 'Cover funding, training, and support that the Order requires.  The Records Management, Privacy Act, and Reports Required subparagraphs are added here automatically from the Reports and Admin sections of the form.' },

      { id: 21, level: 1, title: 'Command and Signal', content: '' },
      { id: 22, level: 2, title: 'Command', content: 'State who the Order applies to: the Total Force, the active component, a specific command.' },
      { id: 23, level: 2, title: 'Signal', content: 'State when the Order takes effect. "This Order is effective the date signed" is the usual form.' }
    ],
    sig: 'I. M. MARINE',
    delegationText: 'By direction',

    vias: [],
    // The renderer generates the reference letter and the enclosure
    // number - the form labels the field "Reference (a)" and its
    // placeholder carries no letter.  A template that spells the
    // designator into the string prints it twice: "Ref:  (a) (a) Title
    // 44". Store the reference itself and nothing else.
    references: [
      'List references in the order they are first cited in the text',
      'Cite by designation and date, never by title alone',
      'A reference cited only in an enclosure is listed in that enclosure'
    ],
    enclosures: [
      'List enclosures in the order they are first cited',
      'An enclosure carries its own page numbering',
      'Required Reports'
    ],
    copyTos: [],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', accentColor: 'black'
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
