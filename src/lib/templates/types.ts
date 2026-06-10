import { FormData, ParagraphData } from '@/types';
import { DocumentTypeDefinition } from '@/lib/schemas';

/**
 * Represents a comprehensive template for a specific document type.
 * Includes data structure, validation rules (via schema), and default values.
 */
export interface DocumentTemplate {
  /** Unique identifier for the template */
  id: string;
  
  /** The document type this template belongs to */
  typeId: FormData['documentType'];
  
  /** Human-readable name of the template */
  name: string;
  
  /** Description of the template's purpose */
  description: string;
  
  /** 
   * The Document Definition which includes:
   * - Schema (Zod) for validation
   * - UI Sections for rendering
   */
  definition: DocumentTypeDefinition;
  
  /**
   * The fully populated default data for this template.
   * This serves as the "Golden Master" or "Reference Implementation".
   */
  defaultData: FormData & {
    vias: string[];
    references: string[];
    enclosures: string[];
    copyTos: string[];
    paragraphs: ParagraphData[];
  };

  /**
   * Formatting guidelines for this template.
   */
  formatting?: {
    dateStyle?: 'standard' | 'military' | 'civilian'; // e.g. "10 Feb 26", "20260210", "February 10, 2026"
    subjectCase?: 'uppercase' | 'titlecase';
    font?: 'Times New Roman' | 'Courier New' | 'Arial';
  };
}
