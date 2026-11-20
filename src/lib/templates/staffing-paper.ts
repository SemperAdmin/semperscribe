import { DocumentTemplate } from './types';
import { PositionPaperDefinition, InformationPaperDefinition } from '@/lib/schemas';

export const PositionPaperTemplate: DocumentTemplate = {
  id: 'position-paper-default',
  typeId: 'position-paper',
  name: 'Position Paper',
  description: 'Used to advocate for a specific position or decision.',
  definition: PositionPaperDefinition,
  defaultData: {
    documentType: 'position-paper',

    subj: 'CONSOLIDATION OF ADMINISTRATIVE SUPPORT FUNCTIONS ACROSS I MEF MAJOR SUBORDINATE COMMANDS',
    date: '10 Feb 26',
    classification: 'UNCLASSIFIED',

    // Drafter Info
    drafterName: 'Capt J. M. Doe',
    drafterRank: 'Capt',
    drafterOfficeCode: 'G-3',
    drafterPhone: '555-1234',
    drafterService: 'USMC',
    drafterAgency: 'I MEF',

    // Approver Info (Required for Position Paper)
    approverName: 'Col I. M. Boss',
    approverRank: 'Col',
    approverOfficeCode: 'G-3',
    approverPhone: '555-5678',

    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'Recommend consolidating administrative support functions across I MEF major subordinate commands to reduce redundancy and improve efficiency. This consolidation will save an estimated $2.1M annually and free 45 billets for reallocation to operational units.',
        title: 'BLUF'
      },
      {
        id: 2,
        level: 1,
        content: 'Each MSC currently maintains independent administrative support sections performing overlapping functions including personnel administration, supply management, and financial processing.',
        title: 'Background'
      },
      {
        id: 3,
        level: 1,
        content: 'Three courses of action were evaluated against the criteria of cost savings, operational impact, and implementation feasibility.',
        title: 'Discussion'
      },
      {
        id: 4,
        level: 2,
        content: 'COA 1: Full consolidation into a single I MEF administrative center. Highest savings but greatest operational risk during transition.',
      },
      {
        id: 5,
        level: 2,
        content: 'COA 2: Partial consolidation of financial and supply functions while retaining distributed personnel administration. Moderate savings with lower risk.',
      },
      {
        id: 6,
        level: 3,
        content: 'Financial processing consolidation alone would save an estimated $800K annually.',
      },
      {
        id: 7,
        level: 3,
        content: 'Supply chain consolidation would reduce duplicate inventory by approximately 30%.',
      },
      {
        id: 8,
        level: 2,
        content: 'COA 3: Status quo with improved coordination mechanisms. Lowest risk but minimal savings.',
      },
      {
        id: 9,
        level: 1,
        content: 'Adopt COA 2 (partial consolidation) with a phased implementation beginning Q3 FY26. This balances cost savings against operational risk and can serve as a proof of concept for future full consolidation.',
        title: 'Recommendation'
      }
    ],

    // Decision Grid - fully populated with recommenders
    decisionMode: 'MULTIPLE_CHOICE',
    decisionGrid: {
        recommenders: [
          {
            id: 'rec-1',
            role: 'AC/S G-1',
            options: ['COA 1', 'COA 2', 'COA 3']
          },
          {
            id: 'rec-2',
            role: 'AC/S G-4',
            options: ['COA 1', 'COA 2', 'COA 3']
          },
          {
            id: 'rec-3',
            role: 'AC/S G-8',
            options: ['COA 1', 'COA 2', 'COA 3']
          }
        ],
        finalDecision: {
            role: 'CG, I MEF',
            options: ['COA 1', 'COA 2', 'COA 3', 'Disapprove']
        },
        coas: ['COA 1: Full Consolidation', 'COA 2: Partial Consolidation', 'COA 3: Status Quo']
    },

    // Defaults
    ssic: '',
    originatorCode: '',
    from: '',
    to: '',
    sig: '',
    vias: [],
    references: [
      'MCO 5311.1E',
      'I MEF CG White Letter 3-25',
      'GAO Report GAO-25-1234'
    ],
    enclosures: [
      'Cost-Benefit Analysis',
      'Implementation Timeline',
      'Risk Assessment Matrix'
    ],
    copyTos: [],
    line1: '',
    line2: '',
    line3: '',
    endorsementLevel: '',
    basicLetterReference: '',
    referenceWho: '',
    referenceType: '',
    referenceDate: '',
    startingReferenceLevel: '',
    startingEnclosureNumber: '',
    startingPageNumber: 1,
    previousPackagePageCount: 0,
    headerType: 'USMC',
    bodyFont: 'times',
    delegationText: '',
    accentColor: 'black'
  },
  formatting: {
    dateStyle: 'standard',
    subjectCase: 'uppercase',
    font: 'Times New Roman'
  }
};

export const InformationPaperTemplate: DocumentTemplate = {
    id: 'information-paper-default',
    typeId: 'information-paper',
    name: 'Information Paper',
    description: 'Provides factual information in concise terms.',
    definition: InformationPaperDefinition,
    defaultData: {
      documentType: 'information-paper',

      subj: 'FY26 SECOND QUARTER TRAINING READINESS STATUS FOR I MEF UNITS',
      date: '10 Feb 26',
      classification: 'UNCLASSIFIED',

      // Drafter Info
      drafterName: 'Maj R. L. Thompson',
      drafterRank: 'Maj',
      drafterOfficeCode: 'G-3/5',
      drafterPhone: '555-9876',
      drafterService: 'USMC',
      drafterAgency: 'I MEF',

      // Body
      paragraphs: [
        {
          id: 1,
          level: 1,
          content: 'To provide the Commanding General an overview of FY26 Q2 training readiness across I MEF major subordinate commands.',
          title: 'Purpose'
        },
        {
          id: 2,
          level: 1,
          content: '',
          title: 'Key Points'
        },
        {
          id: 3,
          level: 2,
          content: 'Overall training readiness stands at 91%, a 4% increase from Q1.',
        },
        {
          id: 4,
          level: 2,
          content: '1st Marine Division completed 12 of 14 scheduled battalion-level exercises.',
        },
        {
          id: 5,
          level: 3,
          content: 'Two exercises were postponed due to range conflicts with MCIWEST maintenance schedule.',
        },
        {
          id: 6,
          level: 2,
          content: '1st MLG achieved 95% readiness in logistics support operations.',
        },
        {
          id: 7,
          level: 2,
          content: 'Marksmanship requalification rate is at 78%, on track to meet the 100% target by end of FY26.',
        },
        {
          id: 8,
          level: 1,
          content: 'This paper was coordinated with G-3/5 Training, G-1, and all MSC S-3 sections.',
          title: 'Coordination'
        }
      ],

      // Defaults
      ssic: '',
      originatorCode: '',
      from: '',
      to: '',
      sig: '',
      vias: [],
      references: [
        'MCO 1553.3B',
        'I MEF FY26 Training Plan',
        'MCTIMS Training Readiness Report dtd 31 Jan 26'
      ],
      enclosures: [
        'Q2 Training Readiness Dashboard',
        'MSC Training Completion Summary'
      ],
      copyTos: [],
      line1: '',
      line2: '',
      line3: '',
      endorsementLevel: '',
      basicLetterReference: '',
      referenceWho: '',
      referenceType: '',
      referenceDate: '',
      startingReferenceLevel: '',
      startingEnclosureNumber: '',
      startingPageNumber: 1,
      previousPackagePageCount: 0,
      headerType: 'USMC',
      bodyFont: 'times',
      delegationText: '',
      accentColor: 'black'
    },
    formatting: {
      dateStyle: 'standard',
      subjectCase: 'uppercase',
      font: 'Times New Roman'
    }
  };
