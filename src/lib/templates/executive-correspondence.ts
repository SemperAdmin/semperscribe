import { DocumentTemplate } from './types';
import { ExecutiveCorrespondenceDefinition } from '@/lib/schemas';

export const ExecutiveCorrespondenceTemplate: DocumentTemplate = {
  id: 'executive-correspondence-default',
  typeId: 'executive-correspondence',
  name: 'Executive Correspondence (Letter)',
  description: 'Congressional response letter per SECNAV M-5216.5, Ch 12.',
  definition: ExecutiveCorrespondenceDefinition,
  defaultData: {
    documentType: 'executive-correspondence',
    execFormat: 'letter',

    // Header
    ssic: '5000',
    originatorCode: 'DNS',
    date: '', // Left blank — date added after signing

    // Addressee
    recipientName: 'The Honorable Jack Reed',
    recipientTitle: 'Chairman',
    organizationName: 'Committee on Armed Services\nUnited States Senate',
    recipientAddress: 'Washington, DC 20510',

    // Letter Details
    salutation: 'Dear Mr. Chairman:',
    subj: '',
    complimentaryClose: 'Sincerely,',
    isCongressional: true,
    courtesyCopyTo: 'The Honorable Roger Wicker',
    omitDate: true,
    omitSignatureBlock: false,

    // Signature
    sig: 'CARLOS DEL TORO',
    signerTitle: 'Secretary of the Navy',

    // Memo fields (not used in letter format)
    memoFor: '',
    memoFrom: '',
    preparedBy: '',
    preparedByPhone: '',

    // Body
    paragraphs: [
      {
        id: 1,
        level: 1,
        content: 'Thank you for your letter of July 31, 2025, concerning Navy shipbuilding readiness. I am responding on behalf of the Department of the Navy.',
        isMandatory: true
      },
      {
        id: 2,
        level: 1,
        content: 'The Department remains committed to ensuring our naval forces maintain the highest level of readiness. We have taken several steps to address the concerns you raised in your letter regarding maintenance backlogs at our public shipyards.',
      },
      {
        id: 3,
        level: 1,
        content: 'I appreciate you taking the time to share your thoughts on this issue. If I may be of any further assistance, please let me know.',
      },
    ],

    // Unused defaults
    from: '',
    to: '',
    vias: [],
    references: [],
    enclosures: [
      'Navy Shipyard Modernization Plan'
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
    headerType: 'DON',
    bodyFont: 'times',
    delegationText: '',
    accentColor: 'black'
  },
  formatting: {
    dateStyle: 'civilian',
    subjectCase: 'titlecase',
    font: 'Times New Roman'
  }
};
