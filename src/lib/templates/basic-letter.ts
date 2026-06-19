import { DocumentTemplate } from './types';
import { BasicLetterDefinition } from '@/lib/schemas';

export const BasicLetterTemplate: DocumentTemplate = {
  id: 'basic-letter-default',
  typeId: 'basic',
  name: 'Standard Naval Letter',
  description: 'The standard format for correspondence within the Department of the Navy.',
  definition: BasicLetterDefinition,
  defaultData: {
    documentType: 'basic',
    // Header
    ssic: '1000',
    originatorCode: 'CODE',
    date: '10 Feb 26',
    from: 'Commanding Officer, Unit Name, City, State Zip',
    to: 'Commanding Officer, Destination Unit, City, State Zip',
    subj: 'STANDARD NAVAL LETTER TEMPLATE',
    
    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'This is the first paragraph. Paragraphs are numbered 1, 2, 3, etc.',
        isMandatory: true
      },
      {
        id: 2,
        level: 1,
        content: 'This is the second paragraph. It introduces sub-paragraphs.',
      },
      {
        id: 3,
        level: 2,
        content: 'This is a sub-paragraph (a). It is indented 0.25 inches.',
      },
      {
        id: 4,
        level: 3,
        content: 'This is a sub-sub-paragraph (1). It is indented 0.5 inches.',
      },
      {
        id: 5,
        level: 4,
        content: 'This is a sub-sub-sub-paragraph (a). It is indented 0.75 inches.',
      },
      {
        id: 6,
        level: 5,
        content: 'This is the fifth level <u>1</u>. It is underlined and indented 1.0 inch.',
      },
      {
        id: 7,
        level: 6,
        content: 'This is the sixth level <u>a</u>. It is underlined and indented 1.25 inches.',
      },
      {
        id: 8,
        level: 7,
        content: 'This is the seventh level (<u>1</u>). It is parenthesized, underlined, and indented 1.5 inches.',
      },
      {
        id: 9,
        level: 8,
        content: 'This is the eighth level (<u>a</u>). It is parenthesized, underlined, and indented 1.75 inches.',
      }
    ],

    // Footer
    sig: 'I. M. MARINE',
    delegationText: 'By direction',

    // Arrays
    vias: [
      'Commanding Officer, Intermediate Unit, Camp Pendleton, CA 92055'
    ],
    references: [
      '(a) MCO 5216.20B',
      '(b) SECNAVINST 5216.5E',
      '(c) CMC ltr 1000 CODE of 10 Jan 26'
    ],
    enclosures: [
      '(1) Supporting Document A',
      '(2) Supporting Document B'
    ],
    copyTos: [
      'Commanding General, I MEF',
      'Inspector General of the Marine Corps'
    ],

    // Defaults for other required fields (even if unused in this type)
    line1: '',
    line1b: '',
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
    accentColor: 'black'
  },
  formatting: {
    dateStyle: 'standard',
    subjectCase: 'uppercase',
    font: 'Times New Roman'
  }
};
