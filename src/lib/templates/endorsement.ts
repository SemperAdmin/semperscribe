import { DocumentTemplate } from './types';
import { EndorsementDefinition } from '@/lib/schemas';

export const EndorsementTemplate: DocumentTemplate = {
  id: 'endorsement-default',
  typeId: 'endorsement',
  name: 'New-Page Endorsement',
  description: 'Used to forward a basic letter with comments, recommendations, or new information.',
  definition: EndorsementDefinition,
  defaultData: {
    documentType: 'endorsement',
    
    // Endorsement Specifics
    endorsementLevel: 'FIRST',
    basicLetterReference: 'C 400', // Reference to the basic letter's SSIC
    basicLetterSsic: '1000',
    
    // Header
    ssic: '1000',
    originatorCode: 'CODE',
    date: '10 Feb 26',
    from: 'Commanding Officer, Endorsing Unit',
    to: 'Commanding Officer, Destination Unit',
    subj: 'ENDORSEMENT TEMPLATE',
    
    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'Forwarded, recommending approval.',
        isMandatory: true
      },
      {
        id: 2,
        level: 1,
        content: 'Additional comments can be added here.',
      },
      {
        id: 3,
        level: 2,
        content: 'Sub-paragraph level (a).',
      },
      {
        id: 4,
        level: 3,
        content: 'Sub-sub-paragraph level (1).',
      }
    ],

    // Footer
    sig: 'I. M. MARINE',
    delegationText: 'By direction',

    // Arrays
    vias: [
      'Commanding Officer, Intermediate Command'
    ],
    references: [
      '(a) MCO 5216.20B',
      '(b) SECNAVINST 5216.5E'
    ],
    enclosures: [
      '(1) Original Request Package'
    ],
    copyTos: [
      'Commanding General, Higher Headquarters'
    ],

    // Defaults
    line1: '',
    line1b: '',
    line2: '',
    line3: '',
    referenceWho: 'CO, Originating Unit',
    referenceType: 'ltr',
    referenceDate: '5 Jan 26',
    startingReferenceLevel: 'c',
    startingEnclosureNumber: '2',
    startingPageNumber: 2, // Usually starts after the basic letter
    previousPackagePageCount: 1,
    headerType: 'USMC',
    bodyFont: 'times',
    accentColor: 'black'
  },
  formatting: {
    dateStyle: 'standard',
    subjectCase: 'uppercase',
    font: 'Times New Roman'
  }
};
