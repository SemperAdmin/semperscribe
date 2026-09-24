import { DocumentTemplate } from './types';
import { VolumeDefinition } from '@/lib/schemas';
import { VolumeSchema, type VolumeDoc } from '@/lib/schemas/volume-schema';
// Single source of truth (Task 17, Part A): this JSON is ALSO the golden
// fixture consumed directly by tests/golden/volume/vol17-comparison.test.ts
// (and available to any other golden/volume test the way vol6.json/vol16.json
// are). Importing it here rather than re-typing the document as a TS object
// literal means there is exactly one authored copy of the Vol 17 content —
// the template and the test fixture can never drift out of sync with each
// other, only (deliberately, via a PR) with the source MCO.
import vol17Raw from '../../../tests/golden/volume/fixtures/vol17.json';

/** The real content is parsed once through the schema so a malformed fixture
 * fails fast (at import time, in every consumer) rather than silently
 * shipping bad data to either the app or the golden test. */
export const vol17VerificationDoc: VolumeDoc = VolumeSchema.parse(vol17Raw);

/**
 * A faithful, loadable reproduction of the real MCO 5800.16 Volume 17
 * (Judge Advocate Division Awards Program), so its rendered PDF can be
 * compared one-to-one against the published order to verify element
 * placement (Task 17). See volume.ts's asTemplateData comment for why
 * defaultData is cast rather than reshaped: Volume's data does not fit the
 * letter-shaped DocumentTemplate['defaultData'] type any other template in
 * this registry uses.
 */
function asTemplateData(doc: VolumeDoc): DocumentTemplate['defaultData'] {
  return doc as unknown as DocumentTemplate['defaultData'];
}

export function vol17VerificationTemplate(): DocumentTemplate {
  return {
    id: 'volume-vol17-verification',
    typeId: 'volume',
    name: 'MCO 5800.16 Volume 17 (Verification)',
    description: 'Judge Advocate Division Awards Program — a faithful transcription of the published Volume, for placement verification against the source PDF.',
    definition: VolumeDefinition,
    defaultData: asTemplateData(vol17VerificationDoc),
  };
}
