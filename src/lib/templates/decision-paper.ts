import { DocumentTemplate } from './types';
import { DecisionPaperDefinition } from '@/lib/schemas';

export const DecisionPaperTemplate: DocumentTemplate = {
  id: 'decision-paper-default',
  typeId: 'decision-paper',
  name: 'Decision Paper',
  description: 'Requests a decision from a senior official on a specific issue.',
  definition: DecisionPaperDefinition,
  defaultData: {
    documentType: 'decision-paper',

    subj: 'REALIGNMENT OF BATTALION LANDING TEAM COMPOSITION FOR EXPEDITIONARY OPERATIONS',
    date: '10 Feb 26',
    classification: 'UNCLASSIFIED',

    // Drafter Info
    drafterName: 'Maj S. A. Rivera',
    drafterRank: 'Maj',
    drafterOfficeCode: 'G-3/5',
    drafterPhone: '555-4321',
    drafterService: 'USMC',
    drafterAgency: 'II MEF',

    // Approver Info
    approverName: 'Col D. W. Mitchell',
    approverRank: 'Col',
    approverOfficeCode: 'G-3',
    approverPhone: '555-8765',

    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'Request the Commanding General approve COA 2, which realigns BLT composition to include an organic unmanned systems platoon, increasing ISR capacity by 40% with minimal impact to current end strength.',
        title: 'BLUF'
      },
      {
        id: 2,
        level: 1,
        content: 'Current BLT composition does not account for the integration of unmanned aerial and ground systems that have become essential to expeditionary operations. Recent exercises and deployments have identified a critical gap in organic ISR capability at the BLT level.',
        title: 'Background'
      },
      {
        id: 3,
        level: 1,
        content: 'Three courses of action were developed and evaluated against the criteria of operational effectiveness, cost, and implementation timeline.',
        title: 'Discussion'
      },
      {
        id: 4,
        level: 2,
        content: 'COA 1: Establish a separate UAS company at the regimental level. Provides centralized capability but reduces BLT commander organic control.',
      },
      {
        id: 5,
        level: 2,
        content: 'COA 2: Integrate an unmanned systems platoon into each BLT by realigning billets from the weapons company. Provides organic capability to BLT commanders with minimal end-strength impact.',
      },
      {
        id: 6,
        level: 2,
        content: 'COA 3: Maintain status quo and rely on MEF-level UAS support. Lowest cost but perpetuates identified capability gap.',
      },
      {
        id: 7,
        level: 1,
        content: 'Approve COA 2 with implementation beginning Q1 FY27. This provides organic ISR capability to BLT commanders while leveraging existing billets and equipment procurement timelines.',
        title: 'Recommendation'
      }
    ],

    // Decision Grid
    decisionMode: 'MULTIPLE_CHOICE',
    decisionGrid: {
      recommenders: [
        {
          id: 'rec-1',
          role: 'AC/S G-3',
          options: ['COA 1', 'COA 2', 'COA 3']
        },
        {
          id: 'rec-2',
          role: 'AC/S G-1',
          options: ['COA 1', 'COA 2', 'COA 3']
        },
        {
          id: 'rec-3',
          role: 'AC/S G-8',
          options: ['COA 1', 'COA 2', 'COA 3']
        }
      ],
      finalDecision: {
        role: 'CG, II MEF',
        options: ['COA 1', 'COA 2', 'COA 3', 'Disapprove']
      },
      coas: ['COA 1: Regimental UAS Company', 'COA 2: Organic BLT Platoon', 'COA 3: Status Quo']
    },

    // Defaults
    ssic: '',
    originatorCode: '',
    from: '',
    to: '',
    sig: '',
    vias: [],
    references: [
      'MCO 3120.12A',
      'MCDP 1-0',
      'II MEF CG White Letter 1-26'
    ],
    enclosures: [
      'COA Comparison Matrix',
      'Billet Realignment Plan',
      'Equipment Procurement Timeline'
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
