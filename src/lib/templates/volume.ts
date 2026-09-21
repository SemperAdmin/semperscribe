import { DocumentTemplate } from './types';
import { VolumeDefinition } from '@/lib/schemas';
import { blankVolume } from '@/store/volumeStore';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

/**
 * Volume starter templates.
 *
 * DocumentTemplate.defaultData is typed as `FormData & {...}` (letter
 * shape: vias/references/enclosures/copyTos as string[], paragraphs as
 * ParagraphData[]) because every other document type in this registry
 * is authored through the shared letter fields. Volume is authored
 * entirely through its own store (useVolumeStore) and its own schema
 * (VolumeDoc), which is structurally incompatible with that shape
 * (e.g. `references` is `{text, order}[]`, not `string[]`). Rather than
 * reshape the template type system for one document type, the cast
 * below is the documented escape hatch: `defaultData` for a Volume
 * template is a `VolumeDoc`, not letter FormData, and any consumer that
 * reads it as letter FormData (see lib/templates/publish.ts) is not
 * meant to run against Volume templates.
 */
function asTemplateData(doc: VolumeDoc): DocumentTemplate['defaultData'] {
  return doc as unknown as DocumentTemplate['defaultData'];
}

/** A single, empty chapter - the starting point for a new Volume. */
export function blankVolumeTemplate(): DocumentTemplate {
  return {
    id: 'volume-blank',
    typeId: 'volume',
    name: 'Volume (Blank)',
    description: 'A single empty chapter, ready to author.',
    definition: VolumeDefinition,
    defaultData: asTemplateData(blankVolume()),
  };
}

/**
 * A worked multi-chapter Volume, showing sections, paragraphs and
 * sub-paragraphs populated so a drafter can see the tree in use before
 * replacing the content.
 */
export function multiChapterVolumeTemplate(): DocumentTemplate {
  const doc: VolumeDoc = {
    documentType: 'volume',
    order: {
      designator: 'MCO 1000.1',
      policyTitle: 'SAMPLE POLICY VOLUME',
      sponsorCode: 'ARDB',
    },
    volume: {
      number: 1,
      title: 'Administration',
      originalPublicationDate: '10 Feb 26',
      lastUpdatedDate: '10 Feb 26',
      distribution: { kind: 'statementA' },
      submitChangesTo: 'CMC (JA)\n3000 Marine Corps Pentagon\nWashington, DC 20350-3000',
      sectionPeriod: false,
      pageBand: 'auto',
    },
    changeLog: [],
    references: [
      { text: 'SECNAV M-5210.1', order: 1 },
      { text: 'Title 44, United States Code', order: 2 },
    ],
    chapters: [
      {
        number: 1,
        title: 'General Provisions',
        changeLog: [],
        figures: [],
        sections: [
          {
            seq: 1,
            title: 'Purpose and Scope',
            paragraphs: [
              {
                seq: 1,
                title: 'Purpose',
                body: [{ runs: [{ text: 'This Volume establishes policy and assigns responsibilities for the program.' }] }],
                children: [
                  {
                    seq: 1,
                    style: 'upper',
                    title: '',
                    body: [{ runs: [{ text: 'This paragraph shows a sub-paragraph.' }] }],
                    children: [],
                  },
                ],
              },
              {
                seq: 2,
                title: 'Applicability',
                body: [{ runs: [{ text: 'This Volume applies to the Total Force.' }] }],
                children: [],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        title: 'Roles and Responsibilities',
        changeLog: [],
        figures: [],
        sections: [
          {
            seq: 1,
            title: 'Responsibilities',
            paragraphs: [
              {
                seq: 1,
                title: 'Sponsor',
                body: [{ runs: [{ text: 'The sponsor maintains this Volume and processes proposed changes.' }] }],
                children: [],
              },
            ],
          },
          {
            seq: 2,
            title: 'Coordinating Instructions',
            paragraphs: [
              {
                seq: 1,
                title: 'Point of Contact',
                body: [{ runs: [{ text: 'Direct questions concerning this Volume to the sponsor.' }] }],
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  return {
    id: 'volume-multi-chapter',
    typeId: 'volume',
    name: 'Volume (Multi-Chapter Starter)',
    description: 'A two-chapter worked example with sections, paragraphs, and a sub-paragraph.',
    definition: VolumeDefinition,
    defaultData: asTemplateData(doc),
  };
}
