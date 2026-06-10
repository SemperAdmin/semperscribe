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
import { MCOTemplate, BulletinTemplate, ChangeTransmittalTemplate, AssumptionOfCommandTemplate } from './orders';
import { DLAMemorandumTemplate } from './dla-memorandum';
import { DLABusinessLetterTemplate } from './dla-business-letter';
import { ITypeTemplate } from '@/lib/i-type/template';

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
export * from './dla-memorandum';
export * from './dla-business-letter';

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
  'amhs': { ...BasicLetterTemplate, id: 'amhs-default', typeId: 'amhs', name: 'AMHS Message' }, // Placeholder

  // DLA Correspondence
  'dla-memorandum': DLAMemorandumTemplate,
  'dla-business-letter': DLABusinessLetterTemplate,

  // I-Type
  'i-type': ITypeTemplate,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { definition, ...staticData } = template;
    return staticData;
}
