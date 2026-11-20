import { DocumentTemplate } from './types';
import { MFRDefinition } from '@/lib/schemas';

export const MFRTemplate: DocumentTemplate = {
  id: 'mfr-default',
  typeId: 'mfr',
  name: 'Memorandum for the Record',
  description: 'Internal document used to record events, decisions, or conversations.',
  definition: MFRDefinition,
  defaultData: {
    documentType: 'mfr',
    
    // Header (Simplified)
    date: '10 Feb 26',
    ssic: '1000', // Optional but common
    originatorCode: 'CODE', // Optional
    subj: 'MEMORANDUM FOR THE RECORD TEMPLATE',
    
    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'Purpose. To record the events and decisions of the quarterly training review meeting held on 8 Feb 26 at Building 1234, Camp Pendleton, CA.',
        isMandatory: true
      },
      {
        id: 2,
        level: 1,
        content: 'Attendees. LtCol J. Smith (G-3), Maj R. Jones (G-3 Ops), Capt M. Davis (S-3), GySgt T. Wilson (Training Chief).'
      },
      {
        id: 3,
        level: 1,
        content: 'Discussion. The following points were discussed during the meeting.'
      },
      {
        id: 4,
        level: 2,
        content: 'Current training readiness stands at 87% across all units.'
      },
      {
        id: 5,
        level: 2,
        content: 'Range availability for Q2 has been confirmed with Range Control.'
      },
      {
        id: 6,
        level: 3,
        content: 'Known Distances range is available 1-15 Mar 26.'
      },
      {
        id: 7,
        level: 1,
        content: 'Action Items. The following actions were assigned.'
      },
      {
        id: 8,
        level: 2,
        content: 'S-3 to submit range request NLT 20 Feb 26.'
      }
    ],

    // Footer
    sig: 'I. M. MARINE',

    // Unused/Defaults
    from: '',
    to: '',
    vias: [],
    references: [
      'MCO 1553.3B',
      'Quarterly Training Plan dtd 1 Jan 26'
    ],
    enclosures: [
      'Meeting Agenda',
      'Training Readiness Slides'
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
