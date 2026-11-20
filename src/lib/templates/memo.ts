import { DocumentTemplate } from './types';
import {
  FromToMemoDefinition,
  LetterheadMemoDefinition,
  MOADefinition,
  MOUDefinition
} from '@/lib/schemas';

export const FromToMemoTemplate: DocumentTemplate = {
  id: 'from-to-memo-default',
  typeId: 'from-to-memo',
  name: 'From-To Memorandum',
  description: 'Informal internal correspondence.',
  definition: FromToMemoDefinition,
  defaultData: {
    documentType: 'from-to-memo',
    date: '10 Feb 26',
    from: 'Capt J. M. Smith',
    to: 'Maj R. L. Jones, Operations Officer',
    subj: 'UPDATED TRAINING SCHEDULE FOR MARCH 2026',
    paragraphs: [
      { id: 1, level: 1, content: 'The training schedule for March 2026 has been revised to incorporate the new range allocation from Range Control.' },
      { id: 2, level: 1, content: 'Key changes include the following.' },
      { id: 3, level: 2, content: 'Live-fire exercise moved from 10-12 Mar to 17-19 Mar.' },
      { id: 4, level: 2, content: 'Field exercise extended by two days to accommodate additional objectives.' },
      { id: 5, level: 3, content: 'Night operations added on 24 Mar.' },
      { id: 6, level: 1, content: 'Request acknowledgement of receipt and any conflicts NLT 20 Feb 26.' }
    ],
    // Defaults
    ssic: '1500', originatorCode: 'S-3', sig: 'J. M. SMITH',
    vias: [],
    references: [
      'Battalion Training Plan dtd 15 Jan 26'
    ],
    enclosures: [
      'Revised Training Schedule'
    ],
    copyTos: [
      'S-3A'
    ],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', bodyFont: 'times', delegationText: '', accentColor: 'black'
  }
};

export const LetterheadMemoTemplate: DocumentTemplate = {
  id: 'letterhead-memo-default',
  typeId: 'letterhead-memo',
  name: 'Letterhead Memorandum',
  description: 'Formal memorandum on command letterhead.',
  definition: LetterheadMemoDefinition,
  defaultData: {
    documentType: 'letterhead-memo',
    ssic: '1500',
    originatorCode: 'G-3',
    date: '10 Feb 26',
    from: 'Commanding General, 1st Marine Division',
    to: 'Distribution List',
    subj: 'ANNUAL TRAINING GUIDANCE FOR FISCAL YEAR 2026',
    paragraphs: [
      { id: 1, level: 1, content: 'This memorandum provides training guidance for all units assigned to 1st Marine Division during FY26.' },
      { id: 2, level: 1, content: 'Commander\'s Intent. Focus training efforts on combined arms integration and expeditionary operations.' },
      { id: 3, level: 2, content: 'All infantry battalions will complete at least one battalion-level field exercise per quarter.' },
      { id: 4, level: 2, content: 'Supporting units will integrate with supported maneuver elements during all major exercises.' },
      { id: 5, level: 3, content: 'Artillery batteries will conduct a minimum of two live-fire exercises per quarter.' },
      { id: 6, level: 3, content: 'Combat engineer units will support breaching operations during each infantry field exercise.' },
      { id: 7, level: 1, content: 'Report training readiness status monthly per reference (a).' }
    ],
    sig: 'I. M. MARINE',
    delegationText: 'By direction',
    vias: [],
    references: [
      'MCO 1553.3B',
      'MCRP 3-0A'
    ],
    enclosures: [
      'FY26 Training Calendar',
      'Range Allocation Matrix'
    ],
    copyTos: [
      'Commanding General, I MEF',
      'Inspector General'
    ],
    line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
    referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
    startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
    headerType: 'USMC', bodyFont: 'times', accentColor: 'black'
  }
};

export const MOATemplate: DocumentTemplate = {
    id: 'moa-default',
    typeId: 'moa',
    name: 'Memorandum of Agreement',
    description: 'Agreement between parties (Conditional).',
    definition: MOADefinition,
    defaultData: {
      documentType: 'moa',
      subj: 'MEMORANDUM OF AGREEMENT BETWEEN MARINE CORPS INSTALLATIONS WEST AND 1ST MARINE LOGISTICS GROUP FOR SHARED USE OF TRAINING FACILITIES',
      date: '10 Feb 26',
      moaData: {
          activityA: 'Marine Corps Installations West',
          activityB: '1st Marine Logistics Group',
          activityAHeader: {
            ssic: '11000',
            serial: '001',
            date: '10 Feb 26'
          },
          activityBHeader: {
            ssic: '11000',
            serial: '045',
            date: '10 Feb 26'
          },
          seniorSigner: {
            name: 'R. T. COMMANDER',
            title: 'Commanding General',
            activity: 'Marine Corps Installations West',
            activitySymbol: 'MCIWEST',
            date: '10 Feb 26'
          },
          juniorSigner: {
            name: 'J. P. LEADER',
            title: 'Commanding General',
            activity: '1st Marine Logistics Group',
            activitySymbol: '1st MLG',
            date: '10 Feb 26'
          }
      },
      paragraphs: [
        { id: 1, level: 1, content: 'Purpose. This Memorandum of Agreement establishes the terms and conditions for shared use of training facilities between MCIWEST and 1st MLG.' },
        { id: 2, level: 1, content: 'Problem. Training facility availability has been constrained due to increased operational tempo and concurrent maintenance requirements.' },
        { id: 3, level: 1, content: 'Scope. This agreement applies to all training areas and ranges within MCB Camp Pendleton.' },
        { id: 4, level: 1, content: 'Agreement. Both parties agree to the following conditions.' },
        { id: 5, level: 2, content: '1st MLG will have priority access to the Logistics Operations Training Facility on Tuesdays and Thursdays.' },
        { id: 6, level: 2, content: 'MCIWEST will provide maintenance support for shared facilities per a quarterly maintenance schedule.' },
        { id: 7, level: 1, content: 'Effective Date. This agreement is effective upon signature by both parties and remains in effect for 24 months.' },
      ],
      // Defaults
      ssic: '11000', originatorCode: '', from: '', to: '', sig: '',
      vias: [],
      references: [
        'MCO 11000.25A',
        'MCIWEST Policy Letter 3-25'
      ],
      enclosures: [
        'Facility Usage Schedule',
        'Maintenance Responsibility Matrix'
      ],
      copyTos: [],
      line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
      referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
      startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
      headerType: 'USMC', bodyFont: 'times', delegationText: '', accentColor: 'black'
    }
  };

  export const MOUTemplate: DocumentTemplate = {
    id: 'mou-default',
    typeId: 'mou',
    name: 'Memorandum of Understanding',
    description: 'General understanding between parties (Non-binding).',
    definition: MOUDefinition,
    defaultData: {
      documentType: 'mou',
      subj: 'MEMORANDUM OF UNDERSTANDING BETWEEN MARINE CORPS BASE QUANTICO AND PRINCE WILLIAM COUNTY FOR EMERGENCY MUTUAL AID',
      date: '10 Feb 26',
      moaData: {
          activityA: 'Marine Corps Base Quantico',
          activityB: 'Prince William County Emergency Services',
          activityAHeader: {
            ssic: '3440',
            serial: '012',
            date: '10 Feb 26'
          },
          activityBHeader: {
            ssic: '3440',
            serial: '088',
            date: '10 Feb 26'
          },
          seniorSigner: {
            name: 'D. W. GARRISON',
            title: 'Commanding Officer',
            activity: 'Marine Corps Base Quantico',
            activitySymbol: 'MCBQ',
            date: '10 Feb 26'
          },
          juniorSigner: {
            name: 'S. M. COUNTY',
            title: 'Director, Emergency Services',
            activity: 'Prince William County',
            activitySymbol: 'PWC-ES',
            date: '10 Feb 26'
          }
      },
      paragraphs: [
        { id: 1, level: 1, content: 'Purpose. This Memorandum of Understanding establishes a mutual aid framework for emergency response between MCB Quantico and Prince William County Emergency Services.' },
        { id: 2, level: 1, content: 'Problem. Both organizations require supplemental emergency response capabilities during large-scale incidents that exceed organic capacity.' },
        { id: 3, level: 1, content: 'Scope. This MOU covers fire, rescue, and hazardous materials response within the geographic boundaries of both organizations.' },
        { id: 4, level: 1, content: 'Understanding. Both parties understand and acknowledge the following.' },
        { id: 5, level: 2, content: 'Mutual aid will be provided on an as-available basis without degrading primary mission capabilities.' },
        { id: 6, level: 2, content: 'Each party will bear its own costs incurred during mutual aid operations.' },
        { id: 7, level: 1, content: 'Effective Date. This MOU is effective upon signature and may be terminated by either party with 30 days written notice.' },
      ],
      // Defaults
      ssic: '3440', originatorCode: '', from: '', to: '', sig: '',
      vias: [],
      references: [
        'DoD Directive 3025.18',
        'MCO 3440.7B'
      ],
      enclosures: [
        'Emergency Contact Roster',
        'Resource Inventory List'
      ],
      copyTos: [],
      line1: '', line2: '', line3: '', endorsementLevel: '', basicLetterReference: '',
      referenceWho: '', referenceType: '', referenceDate: '', startingReferenceLevel: '',
      startingEnclosureNumber: '', startingPageNumber: 1, previousPackagePageCount: 0,
      headerType: 'USMC', bodyFont: 'times', delegationText: '', accentColor: 'black'
    }
  };
