import { DocumentTemplate } from './types';
import { AAFormDefinition } from '@/lib/schemas';

export const AAFormTemplate: DocumentTemplate = {
  id: 'aa-form-default',
  typeId: 'aa-form',
  name: 'NAVMC 10274 (AA Form)',
  description: 'Administrative Action Form used for personnel requests.',
  definition: AAFormDefinition,
  defaultData: {
    documentType: 'aa-form',
    
    // AA Form Specifics
    actionNo: '001-26',
    orgStation: 'Training Demo Command\nSample Installation\nSample City, ST 00000-0000',

    // Standard Fields
    from: 'Cpl Marine A. Sample, 1234567890/0311, USMC',
    to: 'Commanding Officer, Training Demo Command',
    subj: 'REQUEST FOR SPECIAL LIBERTY',
    date: '10 Feb 26',

    // Body (Block 12)
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'It is requested that special liberty be granted from 14 Feb 26 to 17 Feb 26 in order to attend a family event in San Diego, CA.',
        isMandatory: true
      },
      {
        id: 2,
        level: 1,
        content: 'Contact information during the liberty period: (555) 123-4567.',
      }
    ],

    // Footer
    sig: 'M. A. SAMPLE',

    // Arrays
    vias: [
      'Company Commander, Alpha Company'
    ],
    references: [
      '(a) MCO 1050.3J'
    ],
    enclosures: [
      '(1) Leave and Liberty Request Form'
    ],
    copyTos: [],
    
    // Defaults
    ssic: '5216', // Default SSIC for AA forms often used
    originatorCode: '',
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
