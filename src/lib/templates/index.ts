import { DocumentTemplate } from './types';
import { BasicLetterTemplate } from './basic-letter';
import { BusinessLetterTemplate } from './business-letter';
import { EndorsementTemplate } from './endorsement';
import { MFRTemplate } from './mfr';
import { AAFormTemplate } from './aa-form';
import { PositionPaperTemplate, InformationPaperTemplate } from './staffing-paper';
import { DecisionPaperTemplate } from './decision-paper';
import { CoordinationPageTemplate } from './coordination-page';
import { ExecutiveCorrespondenceTemplate } from './executive-correspondence';
import { FromToMemoTemplate, LetterheadMemoTemplate, MOATemplate, MOUTemplate } from './memo';
import { MCOTemplate, MCOFormatGuideTemplate, BulletinTemplate, ChangeTransmittalTemplate, AssumptionOfCommandTemplate } from './orders';
import { DLAMemorandumTemplate } from './dla-memorandum';
import { DLABusinessLetterTemplate } from './dla-business-letter';
import { ITypeTemplate } from '@/lib/i-type/template';
import { blankVolumeTemplate, multiChapterVolumeTemplate } from './volume';
import { vol17VerificationTemplate } from './vol17-verification';

// Re-export all templates
export * from './types';
export * from './basic-letter';
export * from './business-letter';
export * from './executive-correspondence';
export * from './endorsement';
export * from './mfr';
export * from './aa-form';
export * from './staffing-paper';
export * from './decision-paper';
export * from './coordination-page';
export * from './memo';
export * from './orders';
export * from './publish';
export * from './dla-memorandum';
export * from './dla-business-letter';
export * from './volume';
export * from './vol17-verification';

// Master Registry
export const DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
  'basic': BasicLetterTemplate,
  'business-letter': BusinessLetterTemplate,
  'endorsement': EndorsementTemplate,
  'mfr': MFRTemplate,
  'aa-form': AAFormTemplate,
  'position-paper': PositionPaperTemplate,
  'information-paper': InformationPaperTemplate,
  'decision-paper': DecisionPaperTemplate,
  'from-to-memo': FromToMemoTemplate,
  'letterhead-memo': LetterheadMemoTemplate,
  'moa': MOATemplate,
  'mou': MOUTemplate,
  'mco': MCOTemplate,
  'bulletin': BulletinTemplate,
  'change-transmittal': ChangeTransmittalTemplate,
  'assumption-of-command': AssumptionOfCommandTemplate,
  
  'coordination-page': CoordinationPageTemplate,
  'executive-correspondence': ExecutiveCorrespondenceTemplate,

  // Aliases or Additional Placeholders (Mapped to Basic if not implemented)
  'multiple-address': { ...BasicLetterTemplate, id: 'multiple-address-default', typeId: 'multiple-address', name: 'Multiple-Address Letter' },
  'page11': { ...BasicLetterTemplate, id: 'page11-default', typeId: 'page11', name: 'Page 11' }, // Placeholder
  'navmc10922': { ...BasicLetterTemplate, id: 'navmc10922-default', typeId: 'navmc10922', name: 'NAVMC 10922 (Dependency Application)' }, // Placeholder
  'navmc10132': { ...BasicLetterTemplate, id: 'navmc10132-default', typeId: 'navmc10132', name: 'NAVMC 10132 (Unit Punishment Book)' }, // Placeholder
  'amhs': { ...BasicLetterTemplate, id: 'amhs-default', typeId: 'amhs', name: 'AMHS Message' }, // Placeholder

  // DLA Correspondence
  'dla-memorandum': DLAMemorandumTemplate,
  'dla-business-letter': DLABusinessLetterTemplate,

  // I-Type
  'i-type': ITypeTemplate,

  // Volume: the default a drafter gets when picking the type is the
  // blank starter; the worked multi-chapter example is available via
  // DOCUMENT_TEMPLATES lookups but is not itself keyed by typeId since
  // this record holds one entry per type.
  'volume': blankVolumeTemplate(),
};

/**
 * The Volume type's worked, multi-chapter starter. Not entered into
 * DOCUMENT_TEMPLATES (that record holds exactly one - the blank
 * default - per type; see AssumptionOfCommandTemplate/MCOTemplate for
 * the same "worked example is a second, separately-named template"
 * pattern used for Orders) or PUBLISHED_TEMPLATES (that record's
 * createTemplatePackage() assumes letter-shaped defaultData - see the
 * NOTE ON THE SHAPE comment in publish.ts - which a VolumeDoc is not).
 */
export const VolumeMultiChapterTemplate: DocumentTemplate = multiChapterVolumeTemplate();

/**
 * The templates published to `public/templates/global` as .nldp files
 * and listed in Browse Templates, keyed by the FILENAME each is
 * published under.
 *
 * Separate from DOCUMENT_TEMPLATES because that record is keyed by
 * document TYPE and holds exactly one entry per type - the default a
 * drafter gets when picking the type in the sidebar. A type may publish
 * more than one template to the library: the Order ships both a worked
 * example and a format guide.
 *
 * scripts/generate-templates.ts reads this, and
 * tests/published-templates.test.ts asserts the files on disk still
 * match it. They had drifted: orders.ts was rebuilt in P3.8 and the
 * .nldp the picker actually serves was never regenerated, so users were
 * handed the original skeleton with designators typed into the content
 * for seven months.
 */
export const PUBLISHED_TEMPLATES: Record<string, DocumentTemplate> = {
  'usmc-basic-letter': BasicLetterTemplate,
  'business-letter': BusinessLetterTemplate,
  'endorsement': EndorsementTemplate,
  'memorandum-for-record': MFRTemplate,
  'aa-form': AAFormTemplate,
  'position-paper': PositionPaperTemplate,
  'information-paper': InformationPaperTemplate,
  'from-to-memo': FromToMemoTemplate,
  'letterhead-memo': LetterheadMemoTemplate,
  'memorandum-of-agreement': MOATemplate,
  'memorandum-of-understanding': MOUTemplate,
  'marine-corps-order': MCOTemplate,
  'marine-corps-order-format-guide': MCOFormatGuideTemplate,
  'marine-corps-bulletin': BulletinTemplate,

  // Task 17: the Vol 17 verification template, published like any other
  // template (see createTemplatePackage's typeId === 'volume' branch in
  // publish.ts) so it is reachable from the same Templates picker every
  // other document type uses, not a Volume-only side door.
  'mco-5800-16-volume-17-verification': vol17VerificationTemplate(),
};

/**
 * Retrieves the template for a given document type ID.
 * Falls back to Basic Letter if not found.
 */
export function getTemplateForType(typeId: string): DocumentTemplate {
  return DOCUMENT_TEMPLATES[typeId] || BasicLetterTemplate;
}

/**
 * Returns a JSON-safe version of the template (stripping validation functions).
 * Useful for exporting or saving as a static file.
 */
export function getStaticTemplate(typeId: string): Omit<DocumentTemplate, 'definition'> {
    const template = getTemplateForType(typeId);
     
    const { definition, ...staticData } = template;
    return staticData;
}
