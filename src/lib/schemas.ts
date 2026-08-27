import { z } from 'zod';
import { ITypeDefinition } from '@/lib/i-type/definition';
import {
  NAVMC_10922_RELATIONSHIPS,
  NAVMC_10132_DEMAND,
  NAVMC_10132_APPEAL_INTENT,
  NAVMC_10132_VICTIM_STATUS,
  NAVMC_10132_VICTIM_SEX,
  NAVMC_10132_VICTIM_RACE,
  NAVMC_10132_VICTIM_ETHNICITY,
  NAVMC_10132_STAGE_VALUES,
} from '@/types/navmc';

// --- UI Schema Definitions ---

export type ControlType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'date-picker' // Calendar popover storing ISO (YYYY-MM-DD) - NAVMC 10922 dates
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'combobox'
  | 'autosuggest'
  | 'number'
  | 'hidden' // For fields that are present in data but not shown
  | 'decision-grid'; // Custom decision grid (rendered externally, not by DynamicForm)

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: ControlType;
  placeholder?: string;
  description?: string;
  options?: FieldOption[];
  defaultValue?: any;
  className?: string; // Layout hints (e.g., 'col-span-1', 'md:col-span-2')
  rows?: number; // For textareas
  required?: boolean;
  // Autosuggest only. Keeps dictionary suggestions in the source ALL
  // CAPS. Required on any field the schema validates as all-caps, or
  // selecting a suggestion writes a value that fails validation.
  preserveCase?: boolean;
  
  // Dynamic behavior
  condition?: (formData: any) => boolean; 
}

export interface SectionDefinition {
  id: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
  className?: string; // Optional override for the grid layout (e.g. "grid-cols-1")
}

export type PdfPipeline = 'standard' | 'navmc10274' | 'navmc11811' | 'navmc10922' | 'navmc10132' | 'amhs' | 'coordination-page';
export type ExportFormat = 'pdf' | 'docx' | 'amhs-text';
export type DocumentCategory =
  | 'standard-letter'
  | 'memorandums'
  | 'directives'
  | 'forms'
  | 'staffing-papers'
  | 'external-executive'
  | 'amhs'
  | 'dla-correspondence';

export interface DocumentFeatures {
  // Section visibility
  showHeaderSettings: boolean;
  showFontSelector: boolean;
  showUnitInfo: boolean;
  showEndorsementDetails: boolean;
  showDirectiveTitle: boolean;
  showVia: boolean;
  showReferences: boolean;
  showEnclosures: boolean;
  showDistribution: boolean;
  showReports: boolean;
  showParagraphs: boolean;
  showClosingBlock: boolean;
  showMOAForm: boolean;
  showSignature: boolean;
  showDecisionGrid: boolean;
  showCoordinationTable: boolean;
  /**
   * Classification markings. FALSE for the NAVMC forms (10274, 118(11)):
   * the official form carries no banner block, and its layout has no
   * room for one - the marking engine has nowhere to render.
   */
  showClassification: boolean;

  // Behavior
  isAMHS: boolean;
  isDirective: boolean;
  paragraphTemplate?: 'mco' | 'bulletin' | 'secnav-instruction' | 'secnav-notice' | 'moa' | 'staffing-paper' | 'information-paper' | 'default';
  showMultipleTo: boolean;
  showToDistribution: boolean;
  category: DocumentCategory;

  // Export capabilities
  exportFormats: ExportFormat[];
  pdfPipeline: PdfPipeline;
}

export interface DocumentTypeDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string; // Emoji or icon name
  sections: SectionDefinition[];
  schema: z.ZodObject<any>; // Zod validation schema
  features: DocumentFeatures;
}

// --- Validation Helpers ---

// Reusable inline validators for rich error messages while editing
const ssicFieldRequired = () => z.string().superRefine((val, ctx) => {
  if (!val) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC is required" });
    return;
  }
  if (!/^\d+$/.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC must contain only numbers" });
    return;
  }
  if (val.length < 4) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `SSIC must be 4-5 digits (currently ${val.length})` });
    return;
  }
  if (val.length > 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC too long (max 5 digits)" });
    return;
  }
});

const ssicFieldOptional = () => z.string().optional().superRefine((val, ctx) => {
  if (!val || val.length === 0) return;
  if (!/^\d+$/.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC must contain only numbers" });
    return;
  }
  if (val.length < 4) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `SSIC must be 4-5 digits (currently ${val.length})` });
    return;
  }
  if (val.length > 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC too long (max 5 digits)" });
    return;
  }
});

// Directive SSIC allows the full identifier: C5216R.3K w/ ch 1
// Must start with an optional classification prefix (C/S), then 4-5 digit SSIC,
// optional R (reserve), optional .# (point number), optional revision letter,
// optional "w/ ch #" (change indicator)
const ssicFieldDirective = () => z.string().superRefine((val, ctx) => {
  if (!val) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC is required" });
    return;
  }
  // Must contain a 4-5 digit SSIC code somewhere
  if (!/\d{4,5}/.test(val)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SSIC must contain a 4-5 digit code (e.g., 5216.3K)" });
    return;
  }
});

const subjFieldRequired = () => z.string()
  .min(1, "Subject is required")
  .refine(val => val === val.toUpperCase(), { message: "Subject must be in ALL CAPS" });

const subjFieldOptional = () => z.string().optional()
  .refine(val => !val || val === val.toUpperCase(), { message: "Subject must be in ALL CAPS" });

// DLA memo subjects use Title Case per DLA Corr Manual Ch.3 Para 8:
// "Capitalize the first letter of each word except articles, prepositions, and conjunctions."
const subjFieldDLAMemo = () => z.string().min(1, "Subject is required");

// --- Document Type Schemas ---

// 1. Basic Letter
export const BasicLetterSchema = z.object({
  ssic: ssicFieldRequired(),
  originatorCode: z.string().min(1, "Originator Code is required"),
  date: z.string().min(1, "Date is required"),
  from: z.string().min(1, "From line is required"),
  to: z.string().min(1, "To line is required"),
  subj: subjFieldRequired(),
  documentType: z.literal('basic'),
  line1: z.string(),
  line1b: z.string().optional(),
  line2: z.string(),
  line3: z.string(),
  sig: z.string(),
  delegationText: z.string().optional(),
  bodyFont: z.string().optional(),
  distribution: z.any().optional(),
});

// --- Default features for standard letter types ---
const STANDARD_LETTER_FEATURES: DocumentFeatures = {
  showHeaderSettings: true,
  showFontSelector: false,
  showUnitInfo: true,
  showEndorsementDetails: false,
  showDirectiveTitle: false,
  showVia: true,
  showReferences: true,
  showEnclosures: true,
  showDistribution: false,
  showReports: false,
  showParagraphs: true,
  showClosingBlock: true,
  showMOAForm: false,
  showSignature: true,
  showDecisionGrid: false,
  showCoordinationTable: false,
  showClassification: true,
  isAMHS: false,
  isDirective: false,
  showMultipleTo: false,
  showToDistribution: true,
  category: 'standard-letter',
  exportFormats: ['pdf', 'docx'],
  pdfPipeline: 'standard',
};

export const BasicLetterDefinition: DocumentTypeDefinition = {
  id: 'basic',
  name: 'Basic Letter',
  description: 'Standard format for routine correspondence and official communications.',
  icon: '📄',
  schema: BasicLetterSchema,
  features: { ...STANDARD_LETTER_FEATURES },
  sections: [
    {
      id: 'header',
      title: 'Header Information',
      fields: [
        {
          name: 'ssic',
          label: 'SSIC',
          type: 'combobox',
          placeholder: 'Search SSIC...',
          description: 'Standard Subject Identification Code (4-5 digit number from SECNAV M-5210.2)',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'originatorCode',
          label: 'Originator Code',
          type: 'text',
          placeholder: 'e.g., G-1',
          description: 'Office code of the drafting section (e.g., G-1, S-3, CO)',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'DD Mmm YY',
          description: 'Day Month Year format (e.g., 16 Feb 26)',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'from',
          label: 'From',
          type: 'autosuggest',
          placeholder: 'Commanding Officer...',
          description: 'Title of the signing authority (not the individual\'s name)',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'to',
          label: 'To',
          type: 'text',
          placeholder: 'Commanding Officer...',
          description: 'Title of the addressee or "Distribution List" for multiple recipients',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'subj',
          label: 'Subject',
          type: 'autosuggest',
          preserveCase: true,
          placeholder: 'SUBJECT LINE (ALL CAPS)',
          description: 'Brief topic in ALL CAPS — do not use abbreviations unless widely recognized',
          required: true,
          className: 'col-span-full'
        }
      ]
    }
  ]
};

// 2. Multiple-Address Letter
export const MultipleAddressLetterSchema = BasicLetterSchema.extend({
  documentType: z.literal('multiple-address'),
  to: z.string().optional(), // 'to' is optional because we use distribution.recipients
});

export const MultipleAddressLetterDefinition: DocumentTypeDefinition = {
  id: 'multiple-address',
  name: 'Multiple-Address Letter',
  description: 'Letter addressed to two or more commands/activities.',
  icon: '📨',
  schema: MultipleAddressLetterSchema,
  features: { ...STANDARD_LETTER_FEATURES, showMultipleTo: true, showVia: false },
  sections: [
    {
      id: 'header',
      title: 'Header Information',
      fields: [
        // Exclude 'to' because we handle it with MultipleToSection
        ...BasicLetterDefinition.sections[0].fields.filter(f => f.name !== 'to')
      ]
    }
  ]
};

// 3. Endorsement
export const EndorsementSchema = BasicLetterSchema.extend({
  documentType: z.literal('endorsement'),
  endorsementLevel: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', '']),
  basicLetterReference: z.string(),
  basicLetterSsic: z.string(),
  referenceWho: z.string(),
  referenceType: z.string(),
  referenceDate: z.string(),
  startingReferenceLevel: z.string().optional(),
  startingEnclosureNumber: z.string().optional(),
  startingPageNumber: z.number().optional(),
  previousPackagePageCount: z.number().optional(),
});

export const EndorsementDefinition: DocumentTypeDefinition = {
  id: 'endorsement',
  name: 'New-Page Endorsement',
  description: 'Forwards correspondence on a new page.',
  icon: '📝',
  schema: EndorsementSchema,
  features: { ...STANDARD_LETTER_FEATURES, showEndorsementDetails: true },
  sections: [
    // Endorsement-specific fields are handled in page.tsx custom section
    // Only include basic letter sections here
    ...BasicLetterDefinition.sections
  ]
};

// 4. AA Form (NAVMC 10274)
export const AAFormSchema = z.object({
  documentType: z.literal('aa-form'),
  ssic: ssicFieldOptional(),
  actionNo: z.string().optional(),
  orgStation: z.string().optional(),
  from: z.string().min(1, "From is required"),
  to: z.string().min(1, "To is required"),
  subj: subjFieldRequired(),
  date: z.string().min(1, "Date is required"),
});

export const AAFormDefinition: DocumentTypeDefinition = {
  id: 'aa-form',
  name: 'NAVMC 10274 (AA Form)',
  description: 'Administrative Action Form for personnel requests.',
  icon: '📋',
  schema: AAFormSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    // The official NAVMC 10274 has no banner block and no room for one.
    showClassification: false,
    category: 'forms',
    pdfPipeline: 'navmc10274',
    exportFormats: ['pdf'],
  },
  sections: [
    {
      id: 'aa-header',
      title: 'AA Form Details',
      fields: [
        {
          name: 'actionNo',
          label: 'Action No',
          type: 'text',
          placeholder: '12345',
          className: 'md:col-span-1'
        },
        {
          name: 'ssic',
          label: 'SSIC/File No.',
          type: 'combobox',
          placeholder: 'Search SSIC by code or name...',
          className: 'md:col-span-1'
        },
        {
          name: 'orgStation',
          label: 'Organization/Station',
          type: 'textarea',
          placeholder: 'Unit Name\nAddress...',
          className: 'md:col-span-1'
        },
        {
          name: 'from',
          label: 'From (Grade, Name, EDIPI, MOS)',
          type: 'text',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'to',
          label: 'To',
          type: 'textarea',
          required: true,
          placeholder: 'HEAD, MILITARY AWARDS BRANCH (MMPB-3)\nMANPOWER MANAGEMENT DIVISION HQ...',
          className: 'col-span-full'
        },
        {
          name: 'subj',
          label: 'Subject',
          type: 'text',
          required: true,
          className: 'col-span-full'
        },
         {
          name: 'date',
          label: 'Date',
          type: 'date',
          required: true,
          className: 'md:col-span-1'
        }
      ]
    }
  ]
};


// 5. Marine Corps Order (MCO)
export const MCOSchema = BasicLetterSchema.extend({
  documentType: z.literal('mco'),
  // Override SSIC to accept expanded directive format (e.g., C5216R.3K w/ ch 1)
  ssic: ssicFieldDirective(),
  // These fields are managed by UnitInfoSection / ClosingBlockSection, not DynamicForm.
  // Override as optional so zodResolver doesn't reject the form when they're absent.
  line1: z.string().optional(),
  line2: z.string().optional(),
  line3: z.string().optional(),
  sig: z.string().optional(),
  directiveTitle: z.string().optional(),
  // FOUO designation per MCO 5215.1K para 10
  fouoDesignation: z.enum(['', 'full', 'partial']).optional(),
  // 4-digit paragraph numbering per MCO 5215.1K para 34
  fourDigitNumbering: z.boolean().optional(),
  chapterNumber: z.number().min(1).max(9).optional(),
  // Structural pages per MCO 5215.1K para 48
  showStructuralPages: z.boolean().optional(),
  showLocatorSheet: z.boolean().optional(),
  showRecordOfChanges: z.boolean().optional(),
  recordOfChanges: z.array(z.object({
    changeNo: z.number(),
    date: z.string(),
    pagesAffected: z.string(),
    enteredBy: z.string(),
  })).optional(),
  reports: z.array(z.object({
    id: z.string(),
    title: z.string(),
    controlSymbol: z.string(),
    paragraphRef: z.string(),
    exempt: z.boolean().optional()
  })).optional(),
  adminSubsections: z.object({
    recordsManagement: z.object({ show: z.boolean(), content: z.string(), order: z.number() }),
    privacyAct: z.object({ show: z.boolean(), content: z.string(), order: z.number() }),
    reportsRequired: z.object({ show: z.boolean(), content: z.string(), order: z.number() })
  }).optional(),
  distribution: z.object({
    type: z.string().optional(),
    pcn: z.string().optional(),
    copyTo: z.array(z.object({
        code: z.string(),
        qty: z.number()
    })).optional(),
    // Distribution Statement fields (per DoD 5230.24)
    statementCode: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'X', '']).optional(),
    statementReason: z.string().optional(),
    statementDate: z.string().optional(),
    statementAuthority: z.string().optional(),
  }).optional(),
});

export const MCODefinition: DocumentTypeDefinition = {
  id: 'mco',
  name: 'Marine Corps Order',
  description: 'Permanent directives that establish policy or procedures.',
  icon: '📜',
  schema: MCOSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showVia: false,
    showDirectiveTitle: true,
    showDistribution: true,
    showReports: true,
    isDirective: true,
    paragraphTemplate: 'mco',
    category: 'directives',
  },
  sections: [
    {
      id: 'header',
      title: 'Order Information',
      fields: [
         // MCOs: "To" is always Distribution List (hidden), SSIC is free-text
         ...BasicLetterDefinition.sections[0].fields.map(f =>
           f.name === 'to' ? { ...f, type: 'hidden' as const, defaultValue: 'Distribution List' } :
           f.name === 'ssic' ? { ...f, type: 'text' as const, placeholder: 'e.g. C5216R.3K w/ ch 1', description: 'Full SSIC with optional classification prefix, R (reserve), point number, revision letter, and change (e.g., 5216.3K, C5216R.3K w/ ch 1)' } : f
         ),
         {
           name: 'directiveTitle',
           label: 'Designation Line',
           type: 'text',
           placeholder: 'e.g. MARINE CORPS ORDER 5215.1K',
           description: 'Full designation in ALL CAPS (e.g., MARINE CORPS ORDER 5215.1K). Appears below the date.',
           className: 'col-span-full'
         },
         {
           name: 'distribution.statementCode',
           label: 'Distribution Statement',
           type: 'select',
           options: [
             { label: 'A — Public release; unlimited', value: 'A' },
             { label: 'B — U.S. Gov agencies only', value: 'B' },
             { label: 'C — Gov agencies & contractors', value: 'C' },
             { label: 'D — DoD & DoD contractors only', value: 'D' },
             { label: 'E — DoD components only', value: 'E' },
             { label: 'F — Further dissemination as directed', value: 'F' },
             { label: 'X — Export-controlled', value: 'X' }
           ],
           defaultValue: 'A',
           className: 'md:col-span-1',
           description: 'Per DoD 5230.24. Shown at bottom of letterhead page.'
         }
      ]
    },
    {
      id: 'directive-options',
      title: 'Directive Options',
      description: 'Numbering and structural page options per MCO 5215.1K',
      fields: [
        // FOUO Designation retired from the form 2026-08-16. DoDI
        // 5200.48 (6 March 2020) cancelled DoDM 5200.01 Vol 4 and ended
        // FOUO on newly created documents; USMC implemented it in
        // MARADMIN 664/20. CUI replaces it, and this type already has
        // showClassification: true, so the marking engine covers it.
        // The schema field and both emitters still render a saved
        // fouoDesignation so a legacy document keeps its marking, and
        // validateRetiredFouo reports it.
        {
          name: 'fourDigitNumbering',
          label: '4-Digit Numbering',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 34 — for orders exceeding 200 pages (e.g., 1001., 1002.)'
        },
        {
          name: 'chapterNumber',
          label: 'Chapter Number',
          type: 'number',
          placeholder: '1',
          className: 'md:col-span-1',
          description: 'Chapter prefix for 4-digit numbering (1=1001, 2=2001, etc.)',
          condition: (formData: any) => !!formData.fourDigitNumbering
        },
        {
          name: 'showLocatorSheet',
          label: 'Locator Sheet',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Locator Sheet page'
        },
        {
          name: 'showRecordOfChanges',
          label: 'Record of Changes',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Record of Changes page'
        },
        {
          name: 'showStructuralPages',
          label: 'Table of Contents',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Table of Contents page'
        }
      ]
    }
  ]
};

// 6. Marine Corps Bulletin (MCBul)
export const BulletinSchema = BasicLetterSchema.extend({
  documentType: z.literal('bulletin'),
  // Override SSIC to accept expanded directive format
  ssic: ssicFieldDirective(),
  // These fields are managed by UnitInfoSection / ClosingBlockSection, not DynamicForm.
  line1: z.string().optional(),
  line2: z.string().optional(),
  line3: z.string().optional(),
  sig: z.string().optional(),
  directiveTitle: z.string().optional(),
  cancellationDate: z.string().min(1, "Cancellation Date is required"),
  cancellationType: z.enum(['fixed', 'contingent']).optional(),
  // Shared directive fields (same as MCO)
  reports: z.array(z.object({
    id: z.string(),
    title: z.string(),
    controlSymbol: z.string(),
    paragraphRef: z.string(),
    exempt: z.boolean().optional()
  })).optional(),
  distribution: z.object({
    type: z.string().optional(),
    pcn: z.string().optional(),
    copyTo: z.array(z.object({
        code: z.string(),
        qty: z.number()
    })).optional(),
    statementCode: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'X', '']).optional(),
    statementReason: z.string().optional(),
    statementDate: z.string().optional(),
    statementAuthority: z.string().optional(),
  }).optional(),
  // FOUO designation per MCO 5215.1K para 10
  fouoDesignation: z.enum(['', 'full', 'partial']).optional(),
});

export const BulletinDefinition: DocumentTypeDefinition = {
  id: 'bulletin',
  name: 'Marine Corps Bulletin',
  description: 'Directives of a temporary nature (expire after 12 months).',
  icon: '📢',
  schema: BulletinSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showVia: false,
    showDirectiveTitle: true,
    showDistribution: true,
    showReports: true,
    isDirective: true,
    paragraphTemplate: 'bulletin',
    category: 'directives',
  },
  sections: [
    {
      id: 'header',
      title: 'Bulletin Information',
      fields: [
        // Bulletins: "To" is always Distribution List (hidden), SSIC is free-text
        ...BasicLetterDefinition.sections[0].fields.map(f =>
            f.name === 'to' ? { ...f, type: 'hidden' as const, defaultValue: 'Distribution List' } :
            f.name === 'ssic' ? { ...f, type: 'text' as const, placeholder: 'e.g. 1500', description: 'Full SSIC with optional classification prefix, R (reserve), point number, and revision letter' } : f
        ),
        {
          name: 'directiveTitle',
          label: 'Designation Line',
          type: 'text',
          placeholder: 'e.g. MARINE CORPS BULLETIN 1500',
          description: 'Full designation in ALL CAPS (e.g., MARINE CORPS BULLETIN 1500). Appears below the date.',
          className: 'col-span-full'
        },
        {
          name: 'cancellationDate',
          label: 'Cancellation Date',
          type: 'date',
          required: true,
          className: 'md:col-span-1',
          description: 'Usually 12 months from issue date'
        },
        {
          name: 'cancellationType',
          label: 'Cancellation Type',
          type: 'select',
          options: [
            { label: 'Fixed Date', value: 'fixed' },
            { label: 'Contingent (Action Complete)', value: 'contingent' }
          ],
          defaultValue: 'fixed',
          className: 'md:col-span-1'
        },
        {
          name: 'distribution.statementCode',
          label: 'Distribution Statement',
          type: 'select',
          options: [
            { label: 'A — Public release; unlimited', value: 'A' },
            { label: 'B — U.S. Gov agencies only', value: 'B' },
            { label: 'C — Gov agencies & contractors', value: 'C' },
            { label: 'D — DoD & DoD contractors only', value: 'D' },
            { label: 'E — DoD components only', value: 'E' },
            { label: 'F — Further dissemination as directed', value: 'F' },
            { label: 'X — Export-controlled', value: 'X' }
          ],
          defaultValue: 'A',
          className: 'md:col-span-1',
          description: 'Per DoD 5230.24. Shown at bottom of letterhead page.'
        }
      ]
    },
    {
      id: 'directive-options',
      title: 'Directive Options',
      description: 'Structural page options per MCO 5215.1K',
      fields: [
        // FOUO Designation retired from the form 2026-08-16. DoDI
        // 5200.48 (6 March 2020) cancelled DoDM 5200.01 Vol 4 and ended
        // FOUO on newly created documents; USMC implemented it in
        // MARADMIN 664/20. CUI replaces it, and this type already has
        // showClassification: true, so the marking engine covers it.
        // The schema field and both emitters still render a saved
        // fouoDesignation so a legacy document keeps its marking, and
        // validateRetiredFouo reports it.
        {
          name: 'showLocatorSheet',
          label: 'Locator Sheet',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Locator Sheet page'
        },
        {
          name: 'showRecordOfChanges',
          label: 'Record of Changes',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Record of Changes page'
        },
        {
          name: 'showStructuralPages',
          label: 'Table of Contents',
          type: 'checkbox',
          className: 'md:col-span-1',
          description: 'Per MCO 5215.1K para 48 — adds Table of Contents page'
        }
      ]
    }
  ]
};

// 6a. SECNAV Instruction (P4.3 — SECNAV M-5215.1)
export const SecnavInstructionSchema = BasicLetterSchema.extend({
  documentType: z.literal('secnav-instruction'),
  // Directive SSIC format: SSIC + consecutive point number + revision
  // suffix (SECNAV M-5215.1; audit line 82), e.g. 5215.1F.
  ssic: ssicFieldDirective(),
  // Managed by UnitInfoSection / ClosingBlockSection, not DynamicForm.
  line1: z.string().optional(),
  line2: z.string().optional(),
  line3: z.string().optional(),
  sig: z.string().optional(),
  directiveTitle: z.string().optional(),
  distribution: z.object({
    statementCode: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'X', '']).optional(),
    statementReason: z.string().optional(),
    statementDate: z.string().optional(),
    statementAuthority: z.string().optional(),
  }).optional(),
});

// 6b. SECNAV Notice (P4.3 — SECNAV M-5215.1; self-canceling, no
// consecutive number, cited by SSIC + date — audit lines 86, 90)
export const SecnavNoticeSchema = BasicLetterSchema.extend({
  documentType: z.literal('secnav-notice'),
  ssic: ssicFieldDirective(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  line3: z.string().optional(),
  sig: z.string().optional(),
  directiveTitle: z.string().optional(),
  // "The cancellation date of each notice shall be indicated in the
  // upper right margin of the first page, on the second line above
  // the identification symbols" (SECNAV M-5215.1; audit line 86).
  cancellationDate: z.string().min(1, 'Cancellation Date is required'),
  distribution: z.object({
    statementCode: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'X', '']).optional(),
    statementReason: z.string().optional(),
    statementDate: z.string().optional(),
    statementAuthority: z.string().optional(),
  }).optional(),
});

const SECNAV_DISTRIBUTION_FIELD = {
  name: 'distribution.statementCode',
  label: 'Distribution Statement',
  type: 'select' as const,
  options: [
    { label: 'A — Public release; unlimited', value: 'A' },
    { label: 'B — U.S. Gov agencies only', value: 'B' },
    { label: 'C — Gov agencies & contractors', value: 'C' },
    { label: 'D — DoD & DoD contractors only', value: 'D' },
    { label: 'E — DoD components only', value: 'E' },
    { label: 'F — Further dissemination as directed', value: 'F' },
    { label: 'X — Export-controlled', value: 'X' }
  ],
  defaultValue: 'A',
  className: 'md:col-span-1',
  description: 'Per DoD 5230.24. Shown at bottom of letterhead page.'
};

export const SecnavInstructionDefinition: DocumentTypeDefinition = {
  id: 'secnav-instruction',
  name: 'SECNAV Instruction',
  description: 'DON-level directives with continuing authority (SECNAV M-5215.1).',
  icon: '⚓',
  schema: SecnavInstructionSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showVia: false,
    showDirectiveTitle: true,
    showDistribution: true,
    isDirective: true,
    paragraphTemplate: 'secnav-instruction',
    category: 'directives',
  },
  sections: [
    {
      id: 'header',
      title: 'Instruction Information',
      fields: [
        ...BasicLetterDefinition.sections[0].fields.map(f =>
          f.name === 'to' ? { ...f, type: 'hidden' as const, defaultValue: '' } :
          f.name === 'from' ? { ...f, placeholder: 'Secretary of the Navy', description: 'Title of the issuing authority (SECNAV M-5215.1)' } :
          f.name === 'ssic' ? { ...f, type: 'text' as const, placeholder: 'e.g. 5215.1F', description: 'SSIC + consecutive point number + revision suffix (suffixes skip I and O)' } : f
        ),
        {
          name: 'directiveTitle',
          label: 'Designation Line',
          type: 'text',
          placeholder: 'e.g. SECNAV INSTRUCTION 5215.1F',
          description: 'Full designation in ALL CAPS, underlined, on the 2nd line below the date.',
          className: 'col-span-full'
        },
        SECNAV_DISTRIBUTION_FIELD
      ]
    }
  ]
};

export const SecnavNoticeDefinition: DocumentTypeDefinition = {
  id: 'secnav-notice',
  name: 'SECNAV Notice',
  description: 'DON-level directives of brief duration; self-canceling (SECNAV M-5215.1).',
  icon: '🗓️',
  schema: SecnavNoticeSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showVia: false,
    showDirectiveTitle: true,
    showDistribution: true,
    isDirective: true,
    paragraphTemplate: 'secnav-notice',
    category: 'directives',
  },
  sections: [
    {
      id: 'header',
      title: 'Notice Information',
      fields: [
        ...BasicLetterDefinition.sections[0].fields.map(f =>
          f.name === 'to' ? { ...f, type: 'hidden' as const, defaultValue: '' } :
          f.name === 'from' ? { ...f, placeholder: 'Secretary of the Navy', description: 'Title of the issuing authority (SECNAV M-5215.1)' } :
          f.name === 'ssic' ? { ...f, type: 'text' as const, placeholder: 'e.g. 5215', description: 'SSIC only — notices carry no consecutive point number (SECNAV M-5215.1)' } : f
        ),
        {
          name: 'directiveTitle',
          label: 'Designation Line',
          type: 'text',
          placeholder: 'e.g. SECNAV NOTICE 5215',
          description: 'Full designation in ALL CAPS, underlined, on the 2nd line below the date.',
          className: 'col-span-full'
        },
        {
          name: 'cancellationDate',
          label: 'Cancellation Date',
          type: 'date',
          required: true,
          className: 'md:col-span-1',
          description: 'Always the last day of a month; self-cancels at 1 year unless a longer Canc date is set.'
        },
        SECNAV_DISTRIBUTION_FIELD
      ]
    }
  ]
};

// 7. Page 11 (NAVMC 118(11))
export const Page11Schema = z.object({
  documentType: z.literal('page11'),
  name: z.string().min(1, "Name is required"),
  edipi: z.string().min(1, "DOD ID / EDIPI is required"),
  date: z.string().optional(),
  remarksLeft: z.string().optional(),
  remarksRight: z.string().optional(),
});

export const Page11Definition: DocumentTypeDefinition = {
  id: 'page11',
  name: 'NAVMC 118(11) (Page 11)',
  description: 'Administrative Remarks for service record entries.',
  icon: '🗂️',
  schema: Page11Schema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showParagraphs: false,
    showClosingBlock: false,
    // The official NAVMC 118(11) has no banner block.
    showClassification: false,
    category: 'forms',
    pdfPipeline: 'navmc11811',
    exportFormats: ['pdf'],
  },
  sections: [
    {
      id: 'header',
      title: 'Page 11 Details',
      fields: [
        {
          name: 'name',
          label: 'Name (LAST, FIRST MI)',
          type: 'text',
          placeholder: 'DOE, JOHN A',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'edipi',
          label: 'DOD ID / EDIPI',
          type: 'text',
          placeholder: '1234567890',
          required: true,
          className: 'md:col-span-1'
        }
      ]
    },
    // PG11-1: the Remarks columns render through the custom
    // Page11RemarksSection (it carries the right-column template
    // insert), NOT the dynamic form. Fields stay in the schema for
    // validation and import; the section list omits them so they are
    // not drawn twice.
  ]
};

// 7b. NAVMC 10922 (Dependency Application)
// Rule source: docs/NAVMC_10922_SPEC.md. Zod stays permissive - it
// gives inline hints while editing. The hard export gate is the
// Phase 3 validator module (navmc10922-validators.ts), which carries
// the MCO/FMR citations.
const yesNo = () => z.enum(['', 'yes', 'no']).optional();

const Navmc10922DependentRow = z.object({
  name: z.string().optional().default(''),
  address: z.string().optional().default(''),
  relationship: z
    .union([z.literal(''), z.enum(NAVMC_10922_RELATIONSHIPS)])
    .optional()
    .default(''),
  dateOfBirth: z.string().optional().default(''),
  allowanceClaimedFrom: z.string().optional().default(''),
  livesOutsideHousehold: z.boolean().optional(),
  previouslyApproved: z.boolean().optional(),
});

const Navmc10922DissolutionRow = z.object({
  formerMarriageOf: z.enum(['', 'self', 'spouse']).optional().default(''),
  spouseName: z.string().optional().default(''),
  dateOfDissolution: z.string().optional().default(''),
  placeOfDissolution: z.string().optional().default(''),
  reason: z.enum(['', 'death', 'annulment', 'divorce']).optional().default(''),
  foreignDivorce: z.boolean().optional(),
});

export const Navmc10922Schema = z.object({
  documentType: z.literal('navmc10922'),
  reason: z.enum(['', 'start', 'gain', 'loss']).optional(),
  reasonMode: z.enum(['auto', 'manual']).optional(),
  lostDependentName: z.string().optional(),
  lostDependentRelationship: z.string().optional(),
  lostEventType: z.enum(['', 'divorce', 'annulment', 'death', 'other']).optional(),
  lostEffectiveDate: z.string().optional(),
  dateOfApplication: z.string().min(1, 'Date of application is required'),
  lifeEventDate: z.string().optional(),
  nameOfMarine: z.string().min(1, 'Name is required (Last, First, Middle)'),
  edipi: z
    .string()
    .min(1, 'EDIPI is required')
    .regex(/^\d{10}$/, 'EDIPI is the 10-digit DOD ID number'),
  grade: z.string().min(1, 'Grade is required'),
  typeOfService: z.enum(['', 'usmc', 'usmcr']).optional(),
  organizationStation: z.string().optional(),
  unitRuc: z.string().optional(),
  ecc: z.string().optional(),
  dateEnlistmentOrAd: z.string().optional(),
  dateLastDischarge: z.string().optional(),
  futureAddressEta: z.string().optional(),
  dependents: z.array(Navmc10922DependentRow).max(6).optional(),
  custodian: z
    .object({
      depNo: z.string().optional().default(''),
      name: z.string().optional().default(''),
      relationship: z.string().optional().default(''),
      address: z.string().optional().default(''),
    })
    .optional(),
  marriageDate: z.string().optional(),
  marriagePlace: z.string().optional(),
  marriageSpouseName: z.string().optional(),
  marriageType: z.enum(['', 'ceremonial-us', 'foreign', 'proxy-telephone', 'common-law', 'indian-tribal']).optional(),
  memberPrevMarried: yesNo(),
  memberPrevMarriedTimes: z.string().optional(),
  spousePrevMarried: yesNo(),
  spousePrevMarriedTimes: z.string().optional(),
  dissolutions: z.array(Navmc10922DissolutionRow).max(4).optional(),
  courtOrderInEffect: yesNo(),
  courtOrderDatePlace: z.string().optional(),
  naturalParentArmedForces: yesNo(),
  naturalParentInfo: z.string().optional(),
  spouseArmedForces: yesNo(),
  spouseEdipi: z.string().optional(),
  spouseGrade: z.string().optional(),
  spouseTypeOfService: z.enum(['', 'regular', 'reserve']).optional(),
  spouseBranch: z.string().optional(),
  spouseServiceDates: z.string().optional(),
  spouseBaq: z.enum(['', 'with', 'without']).optional(),
  documentsViewed: z.string().optional(),
  swornDay: z.string().optional(),
  swornMonth: z.string().optional(),
  swornYear2Digit: z.string().optional(),
  attestingOfficerName: z.string().optional(),
});

const YES_NO_OPTIONS: FieldOption[] = [
  { label: '—', value: '' },
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

export const Navmc10922Definition: DocumentTypeDefinition = {
  id: 'navmc10922',
  name: 'NAVMC 10922 (Dependency Application)',
  description:
    'Dependency Application for BAH and travel/transportation entitlements per MCO 1751.3 W/CH-1.',
  icon: '👪',
  schema: Navmc10922Schema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showParagraphs: false,
    showClosingBlock: false,
    // The official form carries its own CUI artwork; the app adds no
    // markings (spec section 2 constraint 5).
    showClassification: false,
    category: 'forms',
    pdfPipeline: 'navmc10922',
    exportFormats: ['pdf'],
  },
  sections: [
    {
      id: 'reason',
      title: 'Application Dates',
      // The REASON control renders through the custom ReasonSection in
      // Navmc10922Sections - it derives START/GAIN from the Section 2
      // previously-approved flags and writes formData.reason from
      // outside DynamicForm, so it must not live inside one.
      fields: [
        {
          name: 'dateOfApplication',
          label: 'Date of Application',
          type: 'date-picker',
          required: true,
          className: 'md:col-span-1',
        },
        {
          name: 'lifeEventDate',
          label: 'Date of Life Event',
          type: 'date-picker',
          description:
            'Marriage, birth, adoption, divorce, or death driving this application. Substantiating documents are due within 30 days of this date (MCO 1751.3 Ch 1 para 1.f). Not printed on the form.',
          className: 'md:col-span-1',
        },
      ],
    },
    {
      id: 'identification',
      title: 'Section 1 — Identification',
      fields: [
        {
          name: 'nameOfMarine',
          label: 'Name of Marine (Last, First, Middle)',
          type: 'text',
          required: true,
          placeholder: 'MARINE, ALONZO DEAN',
          className: 'md:col-span-1',
        },
        { name: 'edipi', label: 'EDIPI', type: 'text', required: true, placeholder: '1234567890', className: 'md:col-span-1' },
        { name: 'grade', label: 'Grade', type: 'text', required: true, placeholder: 'SGT', className: 'md:col-span-1' },
        {
          name: 'typeOfService',
          label: 'Type of Service',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'USMC', value: 'usmc' },
            { label: 'USMCR', value: 'usmcr' },
          ],
          className: 'md:col-span-1',
        },
        // organizationStation, unitRuc, and futureAddressEta render
        // through the custom unit-search block in Navmc10922Sections -
        // NOT here. A DynamicForm instance owning those keys would
        // clobber unit-search writes on its next debounced sync (RHF
        // state seeds once at mount). Zod keeps the keys.
        { name: 'ecc', label: 'ECC', type: 'date-picker', className: 'md:col-span-1' },
        {
          name: 'dateEnlistmentOrAd',
          label: 'Date of Current Enlistment/Appointment or Date Reporting for Active Duty (whichever is later)',
          type: 'date-picker',
          className: 'md:col-span-1',
        },
        {
          name: 'dateLastDischarge',
          label: 'Date of Last Discharge or Last Release to Inactive Duty',
          type: 'date-picker',
          description: 'Leave blank with no prior service.',
          className: 'md:col-span-1',
        },
      ],
    },
    // Section 2 (dependents grid), Section 3 (custodian), and the
    // Section 4 dissolution grid render through custom components in
    // Phase 2 - the schema keeps their fields for validation and
    // import, same pattern as Page11RemarksSection.
    {
      id: 'marital',
      title: 'Section 4 — Marital Status and Support/Paternity',
      fields: [
        {
          name: 'marriageDate',
          label: 'Present Marriage — Date',
          type: 'date-picker',
          description: 'Leave the present-marriage block blank when unmarried.',
          className: 'md:col-span-1',
        },
        { name: 'marriagePlace', label: 'Present Marriage — Place (County and State)', type: 'text', className: 'md:col-span-1' },
        { name: 'marriageSpouseName', label: 'Full Given Name of Spouse', type: 'text', className: 'md:col-span-1' },
        {
          name: 'marriageType',
          label: 'Type of Marriage',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'US Ceremonial (civil or religious)', value: 'ceremonial-us' },
            { label: 'Foreign', value: 'foreign' },
            { label: 'Proxy / Telephone', value: 'proxy-telephone' },
            { label: 'Common-Law', value: 'common-law' },
            { label: 'Indian Tribal', value: 'indian-tribal' },
          ],
          description:
            'Not printed on the form - drives the evidence checklist and approval routing. Proxy/telephone and common-law marriages route to CMC (MFP-1); the CO cannot approve them (MCO 1751.3 Ch 1 paras 3.a-3.b).',
          className: 'md:col-span-1',
        },
        { name: 'memberPrevMarried', label: 'Have You Been Previously Married?', type: 'select', options: YES_NO_OPTIONS, className: 'md:col-span-1' },
        {
          name: 'memberPrevMarriedTimes',
          label: 'Your Prior Marriages — No. of Times',
          type: 'number',
          condition: (d) => d.memberPrevMarried === 'yes',
          className: 'md:col-span-1',
        },
        { name: 'spousePrevMarried', label: 'Has Present Spouse Been Previously Married?', type: 'select', options: YES_NO_OPTIONS, className: 'md:col-span-1' },
        {
          name: 'spousePrevMarriedTimes',
          label: 'Spouse Prior Marriages — No. of Times',
          type: 'number',
          condition: (d) => d.spousePrevMarried === 'yes',
          className: 'md:col-span-1',
        },
      ],
    },
    // The dissolution grid renders between 'marital' and 'support' via
    // Navmc10922Sections - paper order is marriage info, prior-marriage
    // flags, dissolution table, then the court-order question.
    {
      id: 'support',
      title: 'Section 4 — Support/Paternity Court Order',
      fields: [
        {
          name: 'courtOrderInEffect',
          label: 'Court Order or Written Agreement in Effect Relative to Support/Maintenance/Paternity?',
          type: 'select',
          options: YES_NO_OPTIONS,
          className: 'md:col-span-1',
        },
        {
          name: 'courtOrderDatePlace',
          label: 'If Yes — Date and Place (County and State) Issued',
          type: 'text',
          description: 'Attach a copy of the order or agreement.',
          condition: (d) => d.courtOrderInEffect === 'yes',
          className: 'col-span-full',
        },
      ],
    },
    {
      id: 'natural-parent',
      title: 'Section 5 — Natural Parent of Child in Armed Forces',
      fields: [
        {
          name: 'naturalParentArmedForces',
          label: 'Has a Natural Parent Other Than Claimant of Any Child Listed Ever Been a Member of Any U.S. Armed Force?',
          type: 'select',
          options: YES_NO_OPTIONS,
          className: 'md:col-span-1',
        },
        {
          name: 'naturalParentInfo',
          label: 'If Yes — All Available Identifying Information',
          type: 'textarea',
          rows: 3,
          description: 'Full name of natural parent, EDIPI, grade, type of service, branch, inclusive dates of active service, and full name of child(ren).',
          condition: (d) => d.naturalParentArmedForces === 'yes',
          className: 'col-span-full',
        },
      ],
    },
    {
      id: 'spouse-service',
      title: 'Section 6 — Spouse in Armed Forces',
      fields: [
        {
          name: 'spouseArmedForces',
          label: 'Has Your Spouse Ever Been a Member of Any U.S. Armed Force?',
          type: 'select',
          options: YES_NO_OPTIONS,
          className: 'md:col-span-1',
        },
        { name: 'spouseEdipi', label: 'Spouse EDIPI', type: 'text', condition: (d) => d.spouseArmedForces === 'yes', className: 'md:col-span-1' },
        { name: 'spouseGrade', label: 'Spouse Grade', type: 'text', condition: (d) => d.spouseArmedForces === 'yes', className: 'md:col-span-1' },
        {
          name: 'spouseTypeOfService',
          label: 'Spouse Type of Service',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'Regular', value: 'regular' },
            { label: 'Reserve', value: 'reserve' },
          ],
          condition: (d) => d.spouseArmedForces === 'yes',
          className: 'md:col-span-1',
        },
        { name: 'spouseBranch', label: 'Branch of Service', type: 'text', condition: (d) => d.spouseArmedForces === 'yes', className: 'md:col-span-1' },
        { name: 'spouseServiceDates', label: 'Inclusive Dates of Active Service', type: 'text', condition: (d) => d.spouseArmedForces === 'yes', className: 'md:col-span-1' },
        {
          name: 'spouseBaq',
          label: 'BAQ (spouse housing allowance status)',
          type: 'select',
          options: [
            { label: '—', value: '' },
            { label: 'With Dependents', value: 'with' },
            { label: 'Without Dependents', value: 'without' },
          ],
          description: 'BAQ is the obsolete term still printed on the 7-21 form - it means the spouse\'s own housing allowance status.',
          condition: (d) => d.spouseArmedForces === 'yes',
          className: 'md:col-span-1',
        },
      ],
    },
    // Section 7 renders ENTIRELY through custom blocks in
    // Navmc10922Sections: SwornDateSection (date picker parsing into
    // day/month/2-digit year + attesting officer name) and
    // DocumentsViewedSection (claims-driven checklist + field-93 width
    // meter). Fields written from outside DynamicForm must not live
    // inside one - the debounced sync would clobber them. Zod keeps
    // documentsViewed, swornDay, swornMonth, swornYear2Digit, and
    // attestingOfficerName for validation and import.
  ],
};

// 7c. NAVMC 10132 (Unit Punishment Book)
// Rule source: docs/NAVMC_10132_SPEC.md. Zod stays permissive so it gives
// inline hints while editing. The hard export gate is the Phase 4 validator
// module (navmc10132-validators.ts), which carries the citations.
//
// Two vocabularies below are EXPORT values, not display text, and must stay
// byte-exact: item 2's demand strings and item 5's findings. The form displays
// "G" and "NG" for findings but stores "Guilty" and "Not Guilty", and its own
// item-6 script tests for "Guilty". Spec defect 3.3.

const Navmc10132OffenseRow = z.object({
  articleLabel: z.string().optional().default(''),
  mctfsCode: z.string().optional(),
  summary: z.string().optional().default(''),
  finding: z.enum(['', 'Guilty', 'Not Guilty']).optional().default(''),
});

const Navmc10132VictimRow = z.object({
  status: z.union([z.literal(''), z.enum(NAVMC_10132_VICTIM_STATUS)]).optional().default(''),
  sex: z.union([z.literal(''), z.enum(NAVMC_10132_VICTIM_SEX)]).optional().default(''),
  race: z.union([z.literal(''), z.enum(NAVMC_10132_VICTIM_RACE)]).optional().default(''),
  ethnicity: z
    .union([z.literal(''), z.enum(NAVMC_10132_VICTIM_ETHNICITY)])
    .optional()
    .default(''),
});

const Navmc10132PunishmentRow = z.object({
  code: z.string().min(1),
  days: z.string().optional(),
  limits: z.string().optional(),
  suspendedFromDuty: z.boolean().optional(),
  dollars: z.string().optional(),
  dollarsPerMonth: z.string().optional(),
  months: z.string().optional(),
  gradeReducedTo: z.string().optional(),
  oralOrWritten: z.enum(['', 'orally', 'in writing']).optional(),
});

const Navmc10132SuspensionRow = z.object({
  punishmentIndex: z.number(),
  months: z.string().optional(),
  days: z.string().optional(),
});

// Decision row D-60. Structured vacation records against item 7
// suspensions; see Navmc10132Vacation in src/types/navmc.ts for the full
// shape rationale, in particular why `status` is a four-state union rather
// than a boolean and why `noticeServedDate` is never treated as the JAGMAN
// 0118.c/0118.d "commencement of proceedings" date. `suspensionIndex` is
// required (not optional) for the same reason Navmc10132SuspensionRow's
// `punishmentIndex` above is required: an unset target is not a legal
// draft state for a record whose entire purpose is naming one.
// `article31RightsReadDate` is decision row D-54, JAGMAN 0118.d. See its own
// JSDoc on Navmc10132Vacation (src/types/navmc.ts) for why it lives here
// rather than on Figure 14-1 (D-48's rule against inventing figure content)
// and how it feeds W-18 (navmc10132-validators-punishment.ts).
// `offenceDate` is decision row D-49 (MCO 011201 / JAGMAN 0118.d's shared
// date window; see Navmc10132Vacation's own JSDoc) and `vacatingAuthorityGrade`
// is decision row D-56 (MCO 011201's "kind and amount" authority test; see
// Navmc10132Vacation's own JSDoc for why item 8A cannot supply it). Both feed
// navmc10132-validators-punishment.ts (V-29/W-21 and V-30/W-22 respectively).
const Navmc10132VacationRow = z.object({
  suspensionIndex: z.number(),
  noticeServedDate: z.string().optional().default(''),
  status: z.enum(['pending', 'vacated-full', 'vacated-part', 'not-vacated']),
  outcomeDate: z.string().optional(),
  vacatedDetail: z.string().optional(),
  article31RightsReadDate: z.string().optional(),
  offenceDate: z.string().optional(),
  vacatingAuthorityGrade: z.string().optional(),
});

const Navmc10132RemarkRow = z.object({
  date: z.string().optional().default(''),
  kind: z.enum([
    'additional-offenses',
    'forwarded',
    'suspension-vacated-njp',
    'appeal-stayed-restriction',
    'appeal-stayed-extra-duties',
    'appeal-denied',
    'appeal-granted',
    'suspension-vacated-appeal',
    'set-aside',
    'additional-victims',
  ]),
  detail: z.string().optional().default(''),
});

const edipiField = () =>
  z.string().regex(/^\d{10}$/, 'EDIPI is the 10-digit DOD ID number').or(z.literal(''));

// Built off NAVMC_10132_STAGE_VALUES (src/types/navmc.ts) rather than a
// second hardcoded literal list, so the two cannot drift. z.union needs a
// literal tuple, which a plain `.map` loses, hence the cast.
const Navmc10132StageSchema = z.union(
  NAVMC_10132_STAGE_VALUES.map((value) => z.literal(value)) as [
    z.ZodLiteral<(typeof NAVMC_10132_STAGE_VALUES)[number]>,
    z.ZodLiteral<(typeof NAVMC_10132_STAGE_VALUES)[number]>,
    ...z.ZodLiteral<(typeof NAVMC_10132_STAGE_VALUES)[number]>[],
  ],
);

export const Navmc10132Schema = z.object({
  documentType: z.literal('navmc10132'),

  // Which pass the document is at. APP STATE, never written to the
  // AcroForm; see `stage`'s JSDoc on Navmc10132Data (src/types/navmc.ts).
  stage: Navmc10132StageSchema.optional(),

  // Items 17 to 20
  unit: z.string().optional(),
  accusedName: z.string().min(1, 'Accused name is required (Last, First Middle)'),
  accusedService: z.enum(['USMC', 'USN']).optional(),
  /** Item 8A's picker only. 'USMC' selects the page 3 note's closed officer
   *  list; anything else takes the free-text abbreviation the note calls for
   *  on other services. Never printed on its own: item 8A prints the composed
   *  `njpAuthorityGrade`. */
  njpAuthorityService: z.string().optional(),

  // --- The NAVMC 118(11) entries this NJP produces ------------------------
  // Owned exclusively by Page11Section, so ABSENT from the section list
  // below by the clobber rule. IRAM 4006.2r requires a recommendation for
  // corrective action and the assistance available in the counseling entry,
  // and no field on the NAVMC 10132 carries either: they are the
  // commander's and the unit's, not the charge sheet's.
  /**
   * Item 6 exactly as an uploaded signed file states it.
   *
   * Set by the loader, never by a section. It is the fallback for a
   * punishment sentence this app could not read back into codes, so a signed
   * item 6 survives a load whether or not it parses. See
   * navmc10132-item6-parse.ts.
   */
  punishmentImposedFromFile: z.string().optional(),

  page11CorrectiveAction: z.string().optional(),
  page11AssistanceAvailable: z.string().optional(),
  /** '' | 'processing' | 'not-processing'. See SeparationIntent. */
  page11SeparationIntent: z.string().optional(),
  page11ProcessingDetail: z.string().optional(),
  accusedRankGrade: z.string().optional(),
  accusedEdipi: edipiField().optional(),
  accusedPayGrade: z.string().optional(),
  accusedYearsOfService: z.string().optional(),
  accusedSeaHardshipDutyPay: z.string().optional(),
  forfeitureBasisGrade: z.string().optional(),

  // Items 1 and 5
  offenses: z.array(Navmc10132OffenseRow).max(5).optional(),

  // Item 2
  vesselException: z.boolean().optional(),
  demand: z
    .enum(['', NAVMC_10132_DEMAND.ACCEPT, NAVMC_10132_DEMAND.REFUSE, NAVMC_10132_DEMAND.VESSEL])
    .optional(),
  counselOpportunity: z.enum(['', 'have', 'have not']).optional(),
  accusedRefusedToSign: z.boolean().optional(),
  electionDate: z.string().optional(),
  bookerStatement: z.string().optional(),

  // Item 3
  rightsAttestDate: z.string().optional(),

  // Item 4
  unauthorizedAbsences: z.string().optional(),

  // Items 6 and 7
  punishments: z.array(Navmc10132PunishmentRow).optional(),
  punishmentDate: z.string().optional(),
  punishmentImposed: z.string().optional(),
  punishmentOverflowToItem21: z.boolean().optional(),
  suspension: z.string().optional(),
  suspensions: z.array(Navmc10132SuspensionRow).optional(),
  suspensionOverflowToItem21: z.boolean().optional(),
  // Decision row D-60. Deliberately absent from Navmc10132Definition's
  // `sections` below, matching every other structured array on this form
  // (punishments, suspensions, remarks, victims): see the exclusion list
  // comment there. Zod keeps the field for validation and import even
  // though no DynamicForm field, and no custom component yet, writes it.
  vacations: z.array(Navmc10132VacationRow).optional(),

  // Item 8
  njpAuthorityName: z.string().optional(),
  njpAuthorityGrade: z.string().optional(),
  njpAuthorityEdipi: edipiField().optional(),
  njpAuthorityPayGrade: z.string().optional(),

  // Items 10 to 15
  dispositionNoticeDate: z.string().optional(),
  appealAdvisementDate: z.string().optional(),
  intendAppeal: z
    .enum([
      '',
      NAVMC_10132_APPEAL_INTENT.WILL_NOT,
      NAVMC_10132_APPEAL_INTENT.WILL,
      NAVMC_10132_APPEAL_INTENT.REFUSED,
    ])
    .optional(),
  appealIntentDate: z.string().optional(),
  notAppealed: z.boolean().optional(),
  appealDate: z.string().optional(),
  appealDecision: z.string().optional(),
  appealDecisionDate: z.string().optional(),
  appealDecisionNoticeDate: z.string().optional(),

  // Item 16
  finalAdminUd: z.string().optional(),
  finalAdminDtd: z.string().optional(),

  // Items 21 and 22
  remarks: z.array(Navmc10132RemarkRow).optional(),
  remarksFreeText: z.string().optional(),
  remarksComposed: z.string().optional(),
  victims: z.array(Navmc10132VictimRow).max(5).optional(),
});

const NAVMC_10132_APPEAL_INTENT_OPTIONS: FieldOption[] = [
  { label: '—', value: '' },
  { label: 'I do not intend to appeal.', value: NAVMC_10132_APPEAL_INTENT.WILL_NOT },
  { label: 'I do intend to appeal.', value: NAVMC_10132_APPEAL_INTENT.WILL },
  { label: 'The accused refuses to sign.', value: NAVMC_10132_APPEAL_INTENT.REFUSED },
];

export const Navmc10132Definition: DocumentTypeDefinition = {
  id: 'navmc10132',
  name: 'NAVMC 10132 (Unit Punishment Book)',
  description:
    'Unit Punishment Book recording nonjudicial punishment under Article 15, UCMJ, per MCO 5800.16 Vol 14 as amended by MARADMIN 427/23.',
  icon: '⚖️',
  schema: Navmc10132Schema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showParagraphs: false,
    showClosingBlock: false,
    // The official form carries its own CUI artwork. The app adds no
    // markings, consistent with the 10922 decision.
    showClassification: false,
    /**
     * NO SIGNATURE-FIELD PLACEMENT ON THIS FORM. Stephen, 2026-08-26:
     * "remove the Configure Signature Fields section".
     *
     * The section exists to place NEW CAC signature fields onto a generated
     * PDF, which is right for a naval letter the app authors from nothing.
     * The NAVMC 10132 already CARRIES its signature fields: seven of them,
     * `2 ACC ELECTION AND RIGHTS SIGNATURE` through `16 FINAL ADMIN INIT`,
     * built into the official AcroForm. Those are the fields a signer signs
     * and the ones navmc10132-pdf-read.ts reads back to decide the pass and
     * the locks. Placing a further field on top would produce a signature
     * no part of this app looks at, over a form whose own fields were left
     * empty.
     *
     * SCOPED TO THIS DOCUMENT TYPE, not removed from the app. Every other
     * type still inherits `showSignature: true` from
     * STANDARD_LETTER_FEATURES.
     */
    showSignature: false,
    category: 'forms',
    pdfPipeline: 'navmc10132',
    exportFormats: ['pdf'],
  },
  // PHASE 1 SCOPE. Only fields that no custom component will write from
  // OUTSIDE a DynamicForm appear here. RHF seeds defaults once at mount and
  // clobbers external writes on its next debounced sync, which bit the 10922
  // build twice.
  //
  // Deliberately absent, and owned by Phase 3 custom components:
  //   stage                   - NOBODY SETS THIS BY HAND any more. It comes
  //                             from the signatures on an uploaded file,
  //                             through navmc10132-pdf-to-form.ts, and a
  //                             document with no file behind it sits at the
  //                             seeded pass 1. It stays off this list for
  //                             the same clobber reason as everything else
  //                             on it: RHF would stomp the load's write on
  //                             its next sync if the field ever appeared in
  //                             `sections`.
  //   unit                    - UNITS search dialog writes it
  //   offenses[]              - OffensesSection grid
  //   demand, counselOpportunity, accusedRefusedToSign, electionDate,
  //   bookerStatement         - AccusedElectionSection, which also coerces
  //                             demand when the refusal box is checked
  //   accusedYearsOfService, accusedSeaHardshipDutyPay
  //                           - AccusedPayFactsSection, its own card
  //   punishments[], punishmentDate, punishmentImposed,
  //   dispositionNoticeDate, forfeitureBasisGrade
  //                           - PunishmentSection builder
  //   remarks[], remarksFreeText, remarksComposed,
  //   finalAdminUd, finalAdminDtd - RemarksSection composer
  //   victims[]               - VictimsSection grid
  //   vacations[]             - Decision row D-60. No custom component
  //                             exists yet (owner is away from his machine
  //                             and this codebase's working agreement is
  //                             that every UI phase is browser-tested
  //                             before it ships; the panel is a later
  //                             change). Listed here now, ahead of that
  //                             component, so nobody "fixes" the absence
  //                             by adding a plain field to `sections`
  //                             below and reintroduces the exact RHF
  //                             clobber this list exists to prevent.
  // Zod keeps every one of them for validation and import.
  sections: [
    {
      id: 'accused',
      title: 'Unit and Accused (Items 17-20)',
      // accusedRankGrade and accusedPayGrade were REMOVED from this section.
      // The form's page 3 RANK/GRADE note fixes a closed Marine list and
      // requires the rating abbreviation for Navy petty officers, so they are
      // built by AccusedRankSection.tsx as pickers. A text input here would
      // clobber them under the DynamicForm rule. Do not re-add them.
      //
      // `unit` IS here, contrary to the exclusion list above. That list
      // reserved it for a UNITS search dialog that was never built for this
      // form, so item 17 had NO writer anywhere in the app: the printed form
      // exported with the unit blank and the JAGMAN rights advisement stayed
      // permanently blocked on "the unit (item 17)". Nothing else writes the
      // field, so a plain input here carries no clobber risk. If a UNITS
      // picker is ever added for the 10132, remove this field in the same
      // change, never before.
      fields: [
        {
          name: 'unit',
          label: 'Unit (Item 17)',
          type: 'text',
          required: true,
          className: 'md:col-span-2',
          description:
            'As it prints on the form, e.g. CO B, 1ST BN, 6TH MARINES, 2D MARDIV.',
        },
        {
          name: 'accusedName',
          label: 'Accused (Last, First Middle)',
          type: 'text',
          required: true,
          className: 'md:col-span-2',
        },
                { name: 'accusedEdipi', label: 'EDIPI', type: 'text', placeholder: '1234567890' },
              ],
    },
    {
      id: 'rights',
      title: 'CO Rights Certification (Item 3)',
      description:
        'Must be dated on or before the date punishment is imposed. The certification precedes imposition.',
      fields: [
        {
          name: 'rightsAttestDate',
          label: 'Date certified',
          type: 'date-picker',
          className: 'md:col-span-1',
        },
      ],
    },
    {
      id: 'absence',
      title: 'Unauthorized Absence (Item 4)',
      description:
        'Complete only when the accused is receiving NJP for an Article 85 or Article 86 offense. Enter periods of absence over 24 hours and any marks of desertion.',
      fields: [
        {
          name: 'unauthorizedAbsences',
          label: 'Absences over 24 hours and marks of desertion',
          type: 'text',
          className: 'md:col-span-2',
        },
      ],
    },
    // Item 7's free-text section was REMOVED. It is now built by
    // SuspensionSection.tsx as a selection over the punishments in item 6,
    // because a punishment never imposed cannot be suspended. `suspension`
    // survives as the DERIVED string, written by renderSuspension exactly
    // as `punishmentImposed` is written by renderPunishment, so a text box
    // bound to it would be silently discarded at export. Do not re-add it.
    // ITEMS 8, 8A AND 8B ARE GONE FROM HERE, and must not come back.
    // NjpAuthoritySection.tsx owns them now, for the reason its own header
    // gives: this section carried TWO free-text grade fields with nothing
    // tying them together, `njpAuthorityGrade` printing in item 8A and
    // `njpAuthorityPayGrade` driving the punishment picker, the A-1-d
    // ceiling and V-20. A clerk could type "Capt, O3" in one and "O5" in the
    // other and every consequence split down the middle. One picker feeds
    // both now, and RHF would stomp its writes on the next debounced sync if
    // these fields ever reappeared in `sections`.
    {
      id: 'appeal',
      title: 'Appeal (Items 11-15)',
      fields: [
        {
          name: 'appealAdvisementDate',
          label: 'Item 11 - date accused advised of the right to appeal',
          type: 'date-picker',
          description: 'Normally the same date as item 6, and never before it.',
        },
        {
          name: 'intendAppeal',
          label: 'Item 12 - accused intention',
          type: 'select',
          options: NAVMC_10132_APPEAL_INTENT_OPTIONS,
        },
        { name: 'appealIntentDate', label: 'Item 12 - date', type: 'date-picker' },
        {
          name: 'notAppealed',
          label: 'Item 13 - not appealed',
          type: 'checkbox',
          description: 'Check this, or give a date of appeal. Never both, never neither.',
        },
        { name: 'appealDate', label: 'Item 13 - date of appeal, if any', type: 'date-picker' },
        {
          name: 'appealDecision',
          label: 'Item 14 - decision on appeal',
          type: 'text',
          className: 'md:col-span-2',
        },
        { name: 'appealDecisionDate', label: 'Item 14 - date', type: 'date-picker' },
        {
          name: 'appealDecisionNoticeDate',
          label: 'Item 15 - date accused notified of the decision',
          type: 'date-picker',
        },
      ],
    },
  ],
};

// 8. AMHS Message
export const AMHSSchema = z.object({
  documentType: z.literal('amhs'),
  amhsMessageType: z.enum(['GENADMIN', 'MARADMIN', 'ALMAR']),
  amhsClassification: z.enum(['UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET']),
  amhsPrecedence: z.enum(['ROUTINE', 'PRIORITY', 'IMMEDIATE', 'FLASH']),
  amhsDtg: z.string().optional(), // Auto-generated, handled separately
  amhsOfficeCode: z.string().optional(),
  originatorCode: z.string().min(1, "Originator (FROM) is required"), // Reusing originatorCode for "FROM" field
  subj: subjFieldRequired(),
  amhsPocs: z.array(z.string()).optional(),
  amhsReferences: z.array(z.object({
    id: z.string(),
    letter: z.string(),
    type: z.string(),
    docId: z.string(),
    title: z.string()
  })).optional(),
  date: z.string().optional()
});

export const AMHSDefinition: DocumentTypeDefinition = {
  id: 'amhs',
  name: 'AMHS Message',
  description: 'Automated Message Handling System (GENADMIN/MARADMIN)',
  icon: '📡',
  schema: AMHSSchema,
  features: {
    // AMHS classification rides amhsClassification, not the banner engine.
    showClassification: false,
    showHeaderSettings: false,
    showUnitInfo: false,
    showEndorsementDetails: false,
    showDirectiveTitle: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showDistribution: false,
    showReports: false,
    showParagraphs: false,
    showClosingBlock: false,
    showMOAForm: false,
    showSignature: false,
    showDecisionGrid: false,
    showCoordinationTable: false,
    isAMHS: true,
    isDirective: false,
    showFontSelector: false,
    showMultipleTo: false,
    showToDistribution: false,
    category: 'amhs',
    exportFormats: ['amhs-text'],
    pdfPipeline: 'amhs',
  },
  sections: [
    {
      id: 'classification',
      title: 'Message Type & Classification',
      fields: [
        {
          name: 'amhsMessageType',
          label: 'Message Type',
          type: 'select',
          options: [
            { label: 'GENADMIN', value: 'GENADMIN' },
            { label: 'MARADMIN', value: 'MARADMIN' },
            { label: 'ALMAR', value: 'ALMAR' }
          ],
          defaultValue: 'GENADMIN',
          className: 'md:col-span-1'
        },
        {
          name: 'amhsClassification',
          label: 'Classification',
          type: 'select',
          options: [
            { label: 'UNCLASSIFIED', value: 'UNCLASSIFIED' },
            { label: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
            { label: 'SECRET', value: 'SECRET' },
            { label: 'TOP SECRET', value: 'TOP SECRET' }
          ],
          defaultValue: 'UNCLASSIFIED',
          className: 'md:col-span-1'
        },
        {
          name: 'amhsPrecedence',
          label: 'Precedence',
          type: 'select',
          options: [
            { label: 'ROUTINE (R)', value: 'ROUTINE' },
            { label: 'PRIORITY (P)', value: 'PRIORITY' },
            { label: 'IMMEDIATE (O)', value: 'IMMEDIATE' },
            { label: 'FLASH (Z)', value: 'FLASH' }
          ],
          defaultValue: 'ROUTINE',
          className: 'md:col-span-1'
        }
      ]
    },
    {
      id: 'header',
      title: 'Message Header',
      fields: [
        {
          name: 'amhsOfficeCode',
          label: 'Office Code (Optional)',
          type: 'text',
          placeholder: 'MRA MM',
          className: 'md:col-span-1'
        },
        {
          name: 'originatorCode', // Mapped to "FROM"
          label: 'Originator (FROM)',
          type: 'text',
          placeholder: 'CMC WASHINGTON DC',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'subj',
          label: 'Subject (SUBJ)',
          type: 'text',
          placeholder: 'SUBJECT LINE (ALL CAPS)',
          required: true,
          className: 'col-span-full'
        }
      ]
    }
  ]
};

// 9. Memorandum for the Record (MFR)
export const MFRSchema = BasicLetterSchema.omit({ from: true, to: true, ssic: true, originatorCode: true }).extend({
  documentType: z.literal('mfr'),
  from: z.string().optional(),
  to: z.string().optional(),
  ssic: ssicFieldOptional(),
  originatorCode: z.string().optional(),
});

export const MFRDefinition: DocumentTypeDefinition = {
  id: 'mfr',
  name: 'Memorandum for the Record',
  description: 'Internal document to record events or decisions. No "To" line.',
  icon: '📝',
  schema: MFRSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showUnitInfo: false,
    showVia: false,
    category: 'memorandums',
  },
  sections: [
    {
      id: 'header',
      title: 'MFR Details',
      fields: [
        // Include basic fields but exclude From/To, SSIC, and Originator Code
        ...BasicLetterDefinition.sections[0].fields.filter(f => 
          f.name !== 'from' && f.name !== 'to' && f.name !== 'ssic' && f.name !== 'originatorCode'
        )
      ]
    }
  ]
};

// 10. From-To Memorandum
export const FromToMemoSchema = BasicLetterSchema.extend({
  documentType: z.literal('from-to-memo'),
  ssic: ssicFieldOptional(),
  originatorCode: z.string().optional(),
  to: z.string().optional(), // 'to' is optional because we use distribution.recipients
});

export const FromToMemoDefinition: DocumentTypeDefinition = {
  id: 'from-to-memo',
  name: 'From-To Memorandum',
  description: 'Informal internal correspondence on plain paper.',
  icon: '📨',
  schema: FromToMemoSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    showVia: false,
    showMultipleTo: true,
    showToDistribution: false,
    category: 'memorandums',
  },
  sections: [
    {
      id: 'header',
      title: 'Header Information',
      fields: [
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'DD Mmm YY',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'from',
          label: 'From',
          type: 'text',
          placeholder: 'Name (Grade, First MI Last)',
          required: true,
          className: 'col-span-full'
        },
        // 'to' excluded because we handle it with MultipleToSection
        {
          name: 'subj',
          label: 'Subject',
          type: 'text',
          placeholder: 'SUBJECT LINE (ALL CAPS)',
          required: true,
          className: 'col-span-full'
        }
      ]
    }
  ]
};

// 11. Letterhead Memorandum
export const LetterheadMemoSchema = BasicLetterSchema.extend({
  documentType: z.literal('letterhead-memo'),
});

export const LetterheadMemoDefinition: DocumentTypeDefinition = {
  id: 'letterhead-memo',
  name: 'Letterhead Memorandum',
  description: 'Formal memorandum used for correspondence within the activity or with other federal agencies.',
  icon: '🏛️',
  schema: LetterheadMemoSchema,
  features: { ...STANDARD_LETTER_FEATURES, showVia: false, category: 'memorandums' },
  sections: [
    ...BasicLetterDefinition.sections
  ]
};

// 12. Coordination Page (MCO 5216.20B, Fig 13-8)
export const CoordinationPageSchema = z.object({
  documentType: z.literal('coordination-page'),
  subj: subjFieldRequired(),
  coordinatingOffices: z.array(z.object({
    office: z.string().min(1, "Staff/External Agency is required."),
    concurrence: z.enum(['concur', 'concur-comment', 'nonconcur', 'nonconcur-comment', 'no-response', 'pending']).default('pending'),
    aoName: z.string().optional(),
    date: z.string().optional(),
    staffingComment: z.string().optional(),
    concurrenceCommentText: z.string().optional(),
    noResponseDate: z.string().optional(),
  })).optional(),
});

export const CoordinationPageDefinition: DocumentTypeDefinition = {
  id: 'coordination-page',
  name: 'Coordination Page',
  description: 'Mandatory staffing table for routing packages. Tracks concurrence/non-concurrence per MCO 5216.20B.',
  icon: '🔄',
  schema: CoordinationPageSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    pdfPipeline: 'coordination-page',
    showHeaderSettings: false,
    showFontSelector: true,
    showUnitInfo: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showParagraphs: false,
    showClosingBlock: false,
    showSignature: false,
    showCoordinationTable: true,
    category: 'staffing-papers',
    exportFormats: ['pdf'],
  },
  sections: [
    {
      id: 'action',
      title: 'Action Information',
      fields: [
        {
          name: 'subj',
          label: 'Subject',
          type: 'text',
          required: true,
          placeholder: 'SUBJECT OF THE ACTION BEING COORDINATED',
          className: 'col-span-full',
          description: 'Subject of the staffing action (ALL CAPS)'
        },
      ]
    },
  ]
};

// 13. Memorandum of Agreement (MOA)
export const MOASchema = z.object({
  documentType: z.literal('moa'),
  date: z.string().optional(),
  subj: subjFieldRequired(),
  moaData: z.object({
    activityA: z.string().min(1, "Senior Activity is required"),
    activityB: z.string().min(1, "Junior Activity is required"),
    activityAHeader: z.object({
        ssic: z.string().optional(),
        serial: z.string().optional(),
        date: z.string().optional(),
    }).optional(),
    activityBHeader: z.object({
        ssic: z.string().optional(),
        serial: z.string().optional(),
        date: z.string().optional(),
    }).optional(),
    seniorSigner: z.object({
      name: z.string().min(1, "Name is required"),
      title: z.string().min(1, "Title is required"),
      activity: z.string().min(1, "Activity is required"),
      date: z.string().optional(),
    }),
    juniorSigner: z.object({
      name: z.string().min(1, "Name is required"),
      title: z.string().min(1, "Title is required"),
      activity: z.string().min(1, "Activity is required"),
      date: z.string().optional(),
    }),
  }),
  ssic: z.string().optional(),
  originatorCode: z.string().optional(),
});

export const MOADefinition: DocumentTypeDefinition = {
  id: 'moa',
  name: 'Memorandum of Agreement',
  description: 'Agreement between two or more parties (Conditional).',
  icon: '🤝',
  schema: MOASchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showClosingBlock: false,
    showSignature: false,
    showMOAForm: true,
    paragraphTemplate: 'moa',
    category: 'memorandums',
  },
  sections: [
    {
      id: 'moa-header',
      title: 'Agreement Details',
      className: 'grid-cols-1',
      fields: [
        {
          name: 'subj',
          label: 'Subject (REGARDING)',
          type: 'textarea',
          rows: 3,
          required: true,
          className: 'col-span-1',
          placeholder: 'SUBJECT OF AGREEMENT'
        }
      ]
    }
  ]
};

// 14. Memorandum of Understanding (MOU)
export const MOUSchema = MOASchema.extend({
  documentType: z.literal('mou'),
});

export const MOUDefinition: DocumentTypeDefinition = {
  ...MOADefinition,
  id: 'mou',
  name: 'Memorandum of Understanding',
  description: 'General understanding between two or more parties (Non-binding).',
  schema: MOUSchema,
  features: { ...MOADefinition.features },
};

// 15. Staffing Papers (Position, Information, Decision Paper)
export const StaffingPaperSchema = z.object({
  documentType: z.enum(['position-paper', 'information-paper', 'decision-paper']),
  subj: subjFieldRequired(),
  date: z.string().min(1, "Date is required"),
  drafterName: z.string().min(1, "Drafter Name is required"),
  drafterRank: z.string().min(1, "Drafter Rank is required"),
  drafterOfficeCode: z.string().min(1, "Office Code is required"),
  drafterPhone: z.string().min(1, "Phone Extension is required"),
  drafterService: z.string().optional(),
  drafterAgency: z.string().optional(),
  classification: z.string().optional(),
  // Approver fields (Position/Decision Papers)
  approverName: z.string().optional(),
  approverRank: z.string().optional(),
  approverOfficeCode: z.string().optional(),
  approverPhone: z.string().optional(),
  // Decision Grid (Position/Decision Papers)
  decisionGrid: z.any().optional(),
  decisionMode: z.string().optional(),
});

const StaffingPaperFields: FieldDefinition[] = [
  // Decision Grid Fields (Position/Decision Papers)
  {
    name: 'decisionGrid',
    label: 'Decision Grid',
    type: 'decision-grid',
    required: false,
    className: 'col-span-full',
    description: 'Routing and decision options for Position/Decision Papers'
  },
  {
    name: 'classification',
    label: 'Classification',
    type: 'select',
    options: [
      { label: 'UNCLASSIFIED', value: 'UNCLASSIFIED' },
      { label: 'CUI', value: 'CUI' },
      { label: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
      { label: 'SECRET', value: 'SECRET' },
      { label: 'TOP SECRET', value: 'TOP SECRET' },
    ],
    defaultValue: 'UNCLASSIFIED',
    className: 'md:col-span-1',
    description: 'Required for Information Paper'
  },
  {
    name: 'subj',
    label: 'Subject',
    type: 'text',
    placeholder: 'SUBJECT (ALL CAPS)',
    required: true,
    className: 'col-span-full'
  },
  {
    name: 'date',
    label: 'Date',
    type: 'date',
    required: true,
    className: 'md:col-span-1'
  }
];

const DrafterFooterFields: FieldDefinition[] = [
  {
    name: 'drafterName',
    label: 'Drafter Name',
    type: 'text',
    placeholder: 'J. M. DOE',
    required: true,
    className: 'md:col-span-1'
  },
  {
    name: 'drafterRank',
    label: 'Drafter Rank',
    type: 'text',
    placeholder: 'LtCol',
    required: true,
    className: 'md:col-span-1'
  },
  {
    name: 'drafterService',
    label: 'Service/Branch',
    type: 'text',
    placeholder: 'USMC',
    className: 'md:col-span-1',
    description: 'Required for Information Paper',
    required: true
  },
  {
    name: 'drafterAgency',
    label: 'Agency',
    type: 'text',
    placeholder: 'HQMC',
    className: 'md:col-span-1',
    description: 'Required for Information Paper',
    required: true
  },
  {
    name: 'drafterOfficeCode',
    label: 'Office Code/Section',
    type: 'text',
    placeholder: 'G-1',
    required: true,
    className: 'md:col-span-1'
  },
  {
    name: 'drafterPhone',
    label: 'Phone Extension',
    type: 'text',
    placeholder: '555-1234',
    required: true,
    className: 'md:col-span-1'
  },
];

const StaffingPaperFooterFields: FieldDefinition[] = [
  ...DrafterFooterFields,
  // Approver Fields (Position/Decision Papers only)
  {
    name: 'approverName',
    label: 'Approver Name',
    type: 'text',
    placeholder: 'Col I. M. Boss',
    className: 'md:col-span-1',
    description: 'Required for Position/Decision Papers'
  },
  {
    name: 'approverRank',
    label: 'Approver Rank',
    type: 'text',
    placeholder: 'Col',
    className: 'md:col-span-1',
    description: 'Required for Position/Decision Papers'
  },
  {
    name: 'approverOfficeCode',
    label: 'Approver Office',
    type: 'text',
    placeholder: 'G-3',
    className: 'md:col-span-1',
    description: 'Required for Position/Decision Papers'
  },
  {
    name: 'approverPhone',
    label: 'Approver Phone',
    type: 'text',
    placeholder: '555-5678',
    className: 'md:col-span-1',
    description: 'Required for Position/Decision Papers'
  }
];

const STAFFING_PAPER_FEATURES: DocumentFeatures = {
  ...STANDARD_LETTER_FEATURES,
  showHeaderSettings: false,
  showFontSelector: true,
  showUnitInfo: false,
  showVia: false,
  showEnclosures: false,
  showClosingBlock: false,
  showSignature: false,
  category: 'staffing-papers',
  exportFormats: ['pdf'],
  paragraphTemplate: 'staffing-paper',
};

export const PositionPaperDefinition: DocumentTypeDefinition = {
  id: 'position-paper',
  name: 'Position Paper',
  description: 'Advocates a specific position or solution.',
  icon: '📍',
  schema: StaffingPaperSchema,
  features: { ...STAFFING_PAPER_FEATURES, showDecisionGrid: true },
  sections: [
    { id: 'header', title: 'Paper Details', fields: StaffingPaperFields },
    { id: 'footer', title: 'Identification Footer', fields: StaffingPaperFooterFields }
  ]
};

export const InformationPaperDefinition: DocumentTypeDefinition = {
  id: 'information-paper',
  name: 'Information Paper',
  description: 'Provides factual information in concise terms.',
  icon: 'ℹ️',
  schema: StaffingPaperSchema,
  features: { ...STAFFING_PAPER_FEATURES, paragraphTemplate: 'information-paper' as const },
  sections: [
    { id: 'header', title: 'Paper Details', fields: StaffingPaperFields },
    { id: 'footer', title: 'Identification Footer', fields: DrafterFooterFields }
  ]
};

export const DecisionPaperDefinition: DocumentTypeDefinition = {
  id: 'decision-paper',
  name: 'Decision Paper',
  description: 'Requests a decision from a senior official.',
  icon: '❓',
  schema: StaffingPaperSchema,
  features: { ...STAFFING_PAPER_FEATURES, showDecisionGrid: true },
  sections: [
    { id: 'header', title: 'Paper Details', fields: StaffingPaperFields },
    { id: 'footer', title: 'Identification Footer', fields: StaffingPaperFooterFields }
  ]
};

// 16. Business Letter
export const BusinessLetterSchema = z.object({
  documentType: z.literal('business-letter'),
  ssic: ssicFieldRequired(),
  originatorCode: z.string().min(1, "Originator Code is required"),
  date: z.string().min(1, "Date is required"),
  recipientName: z.string().min(1, "Recipient Name is required"),
  recipientTitle: z.string().optional(),
  businessName: z.string().optional(),
  senderAddress: z.string().optional(),
  recipientAddress: z.string().min(1, "Recipient Address is required"),
  attentionLine: z.string().optional(),
  salutation: z.string().min(1, "Salutation is required").transform(val => {
    const trimmed = val.trim();
    if (trimmed && !trimmed.endsWith(':')) {
      return `${trimmed}:`;
    }
    return trimmed;
  }),
  subj: subjFieldOptional(), // Optional, unlike basic letter
  complimentaryClose: z.string().default("Sincerely,"),
  sig: z.string().min(1, "Signer Name is required"),
  signerRank: z.string().optional(),
  signerTitle: z.string().optional(),
  isWindowEnvelope: z.boolean().optional(),
  isShortLetter: z.boolean().optional(),
  isVipMode: z.boolean().optional(),
});

export const BusinessLetterDefinition: DocumentTypeDefinition = {
  id: 'business-letter',
  name: 'Business Letter',
  description: 'Correspondence with non-DoD entities or personal approach.',
  icon: '💼',
  schema: BusinessLetterSchema,
  features: { ...STANDARD_LETTER_FEATURES, category: 'external-executive' },
  sections: [
    {
      id: 'header',
      title: 'Identification',
      fields: [
        {
          name: 'ssic',
          label: 'SSIC',
          type: 'combobox',
          placeholder: 'Search SSIC...',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'originatorCode',
          label: 'Originator Code',
          type: 'text',
          placeholder: 'e.g., G-1',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'DD Mmm YY',
          required: true,
          className: 'md:col-span-1'
        }
      ]
    },
    {
      id: 'formatting',
      title: 'Formatting Options',
      fields: [
        {
          name: 'isWindowEnvelope',
          label: 'Window Envelope',
          type: 'checkbox',
          description: 'Aligns address block for #10 window envelopes',
          className: 'md:col-span-1'
        },
        {
          name: 'isShortLetter',
          label: 'Short Letter (<8 lines)',
          type: 'checkbox',
          description: 'Applies double spacing and wider margins',
          className: 'md:col-span-1'
        },
        {
          name: 'isVipMode',
          label: 'VIP Mode',
          type: 'checkbox',
          description: 'Changes close to "Very respectfully,"',
          className: 'md:col-span-1'
        }
      ]
    },
    {
      id: 'recipient',
      title: 'Inside Address',
      fields: [
        {
          name: 'recipientName',
          label: 'Recipient Name',
          type: 'text',
          placeholder: 'Mr. John Doe',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'recipientTitle',
          label: 'Title',
          type: 'text',
          placeholder: 'Vice President',
          className: 'md:col-span-1'
        },
        {
          name: 'businessName',
          label: 'Business Name',
          type: 'text',
          placeholder: 'Acme Corp',
          className: 'md:col-span-1'
        },
        {
          name: 'recipientAddress',
          label: 'Address',
          type: 'textarea',
          placeholder: '123 Main St\nCity, State Zip',
          required: true,
          className: 'col-span-full',
          rows: 3
        }
      ]
    },
    {
      id: 'details',
      title: 'Letter Details',
      fields: [
        {
          name: 'attentionLine',
          label: 'Attention Line (Optional)',
          type: 'text',
          placeholder: 'Attention: Human Resources',
          className: 'col-span-full'
        },
        {
          name: 'salutation',
          label: 'Salutation',
          type: 'text',
          placeholder: 'Dear Mr. Doe:',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'subj',
          label: 'Subject Line (Optional)',
          type: 'text',
          placeholder: 'SUBJECT LINE (ALL CAPS)',
          className: 'col-span-full'
        },
        {
          name: 'complimentaryClose',
          label: 'Complimentary Close',
          type: 'text',
          defaultValue: 'Sincerely,',
          required: true,
          className: 'md:col-span-1'
        }
      ]
    },
    {
      id: 'signature',
      title: 'Signature Block',
      fields: [
        {
          name: 'sig',
          label: 'Signer Name',
          type: 'text',
          placeholder: 'I. M. MARINE',
          required: true,
          className: 'md:col-span-1',
          description: 'ALL CAPS'
        },
        {
          name: 'signerRank',
          label: 'Military Grade',
          type: 'text',
          placeholder: 'Colonel',
          className: 'md:col-span-1',
          description: 'Spelled out (e.g. Colonel)'
        },
        {
          name: 'signerTitle',
          label: 'Functional Title',
          type: 'text',
          placeholder: 'Director, Personnel',
          className: 'col-span-full'
        }
      ]
    }
  ]
};

// 17. Executive Correspondence
export const ExecutiveCorrespondenceSchema = z.object({
  documentType: z.literal('executive-correspondence'),
  ssic: ssicFieldOptional(),
  originatorCode: z.string().optional(),
  date: z.string().optional(), // May be left blank per Ch 12-3 para 3
  recipientName: z.string().min(1, "Recipient Name is required"),
  recipientTitle: z.string().optional(),
  organizationName: z.string().optional(),
  recipientAddress: z.string().optional(),
  salutation: z.string().min(1, "Salutation is required").transform(val => {
    const trimmed = val.trim();
    if (trimmed && !trimmed.endsWith(':') && !trimmed.endsWith(',')) {
      return `${trimmed}:`;
    }
    return trimmed;
  }),
  subj: subjFieldOptional(),
  complimentaryClose: z.string().default("Sincerely,"),
  sig: z.string().optional(), // May be omitted for SecDef/DepSecDef/SECNAV/UNSECNAV
  signerTitle: z.string().optional(),
  execFormat: z.enum(['letter', 'standard-memo', 'action-memo', 'info-memo']).default('letter'),
  memoFor: z.string().optional(), // "MEMORANDUM FOR" addressee(s)
  memoFrom: z.string().optional(), // "FROM:" line for info memos
  isCongressional: z.boolean().optional(),
  courtesyCopyTo: z.string().optional(), // Ranking minority member
  omitSignatureBlock: z.boolean().optional(), // For SecDef/DepSecDef signature
  omitDate: z.boolean().optional(), // Date added after signing
  preparedBy: z.string().optional(), // "Prepared by:" line
  preparedByPhone: z.string().optional(),
});

export const ExecutiveCorrespondenceDefinition: DocumentTypeDefinition = {
  id: 'executive-correspondence',
  name: 'Executive Correspondence',
  description: 'Letters and memorandums for HqDON, Congress, OSD, and senior officials.',
  icon: '🏛️',
  schema: ExecutiveCorrespondenceSchema,
  features: { ...STANDARD_LETTER_FEATURES, category: 'external-executive' },
  sections: [
    {
      id: 'format',
      title: 'Format & Options',
      fields: [
        {
          name: 'execFormat',
          label: 'Format',
          type: 'select',
          options: [
            { value: 'letter', label: 'Executive Letter' },
            { value: 'standard-memo', label: 'Standard Memorandum' },
            { value: 'action-memo', label: 'Action Memorandum' },
            { value: 'info-memo', label: 'Information Memorandum' },
          ],
          required: true,
          className: 'md:col-span-1',
          description: 'Per SECNAV M-5216.5, Ch 12'
        },
        {
          name: 'isCongressional',
          label: 'Congressional Response',
          type: 'checkbox',
          description: 'Adds courtesy copy to ranking minority member',
          className: 'md:col-span-1'
        },
        {
          name: 'omitDate',
          label: 'Omit Date (Added After Signing)',
          type: 'checkbox',
          description: 'Per Ch 12-3 para 3: date added by Admin after signature',
          className: 'md:col-span-1'
        },
        {
          name: 'omitSignatureBlock',
          label: 'Omit Signature Block',
          type: 'checkbox',
          description: 'For SecDef/DepSecDef/SECNAV/UNSECNAV signature',
          className: 'md:col-span-1'
        },
      ]
    },
    {
      id: 'header',
      title: 'Identification',
      fields: [
        {
          name: 'ssic',
          label: 'SSIC',
          type: 'combobox',
          placeholder: 'Search SSIC...',
          className: 'md:col-span-1'
        },
        {
          name: 'originatorCode',
          label: 'Originator Code',
          type: 'text',
          placeholder: 'e.g., DNS',
          className: 'md:col-span-1'
        },
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'DD Mmm YY',
          className: 'md:col-span-1',
          description: 'Leave blank if date added after signing'
        }
      ]
    },
    {
      id: 'recipient',
      title: 'Addressee',
      fields: [
        {
          name: 'recipientName',
          label: 'Recipient Name / Title',
          type: 'text',
          placeholder: 'The Honorable John Smith',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'recipientTitle',
          label: 'Position / Committee',
          type: 'text',
          placeholder: 'Chairman, Committee on Armed Services',
          className: 'col-span-full'
        },
        {
          name: 'organizationName',
          label: 'Organization',
          type: 'text',
          placeholder: 'U.S. House of Representatives',
          className: 'col-span-full'
        },
        {
          name: 'recipientAddress',
          label: 'Address',
          type: 'textarea',
          placeholder: 'Washington, DC 20515',
          className: 'col-span-full',
          rows: 2
        },
        {
          name: 'memoFor',
          label: 'MEMORANDUM FOR (Memo formats)',
          type: 'text',
          placeholder: 'SECRETARY OF DEFENSE',
          className: 'col-span-full',
          description: 'Used for memo formats only'
        },
        {
          name: 'memoFrom',
          label: 'FROM (Info/Action Memo)',
          type: 'text',
          placeholder: 'Thomas Harker, ASN (FM&C)',
          className: 'col-span-full',
          description: 'Used for info/action memo formats'
        }
      ]
    },
    {
      id: 'details',
      title: 'Letter Details',
      fields: [
        {
          name: 'salutation',
          label: 'Salutation',
          type: 'text',
          placeholder: 'Dear Mr. Chairman:',
          required: true,
          className: 'col-span-full',
          description: 'Must be formal per Ch 12-3'
        },
        {
          name: 'subj',
          label: 'Subject (Optional)',
          type: 'text',
          placeholder: 'Subject line',
          className: 'col-span-full'
        },
        {
          name: 'complimentaryClose',
          label: 'Complimentary Close',
          type: 'text',
          defaultValue: 'Sincerely,',
          required: true,
          className: 'md:col-span-1',
          description: 'Sincerely, / Respectfully, / Very respectfully, / Warm regards'
        },
        {
          name: 'courtesyCopyTo',
          label: 'Courtesy Copy (Congressional)',
          type: 'text',
          placeholder: 'The Honorable Jane Doe, Ranking Minority Member',
          className: 'col-span-full',
          description: 'Required for Committee/Subcommittee Chairperson letters'
        }
      ]
    },
    {
      id: 'signature',
      title: 'Signature Block',
      fields: [
        {
          name: 'sig',
          label: 'Signer Name',
          type: 'text',
          placeholder: 'CARLOS DEL TORO',
          className: 'md:col-span-1',
          description: 'Leave blank if omitting signature block'
        },
        {
          name: 'signerTitle',
          label: 'Official Title',
          type: 'text',
          placeholder: 'Secretary of the Navy',
          className: 'md:col-span-1'
        },
        {
          name: 'preparedBy',
          label: 'Prepared By',
          type: 'text',
          placeholder: 'Name, Organization',
          className: 'md:col-span-1',
          description: 'For action/info memos'
        },
        {
          name: 'preparedByPhone',
          label: 'Phone',
          type: 'text',
          placeholder: '(703) 555-1234',
          className: 'md:col-span-1'
        }
      ]
    }
  ]
};

// 18. Change Transmittal (MCO 5215.1K para 40-44)
export const ChangeTransmittalSchema = BasicLetterSchema.extend({
  documentType: z.literal('change-transmittal'),
  // Override SSIC to accept expanded directive format
  ssic: ssicFieldDirective(),
  // The parent directive being changed
  parentDirectiveTitle: z.string().min(1, "Parent directive title is required (e.g., MCO 5215.1K)"),
  // Change number (Ch 1, Ch 2, etc.)
  changeNumber: z.number().min(1, "Change number is required"),
  // FOUO designation
  fouoDesignation: z.enum(['', 'full', 'partial']).optional(),
  // Distribution statement
  distribution: z.object({
    type: z.string().optional(),
    pcn: z.string().optional(),
    copyTo: z.array(z.object({
        code: z.string(),
        qty: z.number()
    })).optional(),
    statementCode: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'X', '']).optional(),
    statementReason: z.string().optional(),
    statementDate: z.string().optional(),
    statementAuthority: z.string().optional(),
  }).optional(),
});

export const ChangeTransmittalDefinition: DocumentTypeDefinition = {
  id: 'change-transmittal',
  name: 'Change Transmittal',
  description: 'Transmits amendments (page replacements) to an existing order per MCO 5215.1K para 40-44.',
  icon: '📝',
  schema: ChangeTransmittalSchema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showVia: false,
    isDirective: true,
    category: 'directives',
  },
  sections: [
    {
      id: 'header',
      title: 'Change Transmittal Information',
      fields: [
        // Change Transmittals: "To" is always Distribution List (hidden)
        ...BasicLetterDefinition.sections[0].fields.map(f =>
          f.name === 'to' ? { ...f, type: 'hidden' as const, defaultValue: 'Distribution List' } : f
        ),
      ]
    },
    {
      id: 'change-details',
      title: 'Change Details',
      description: 'Identifies the parent directive and change number',
      fields: [
        {
          name: 'parentDirectiveTitle',
          label: 'Parent Directive',
          type: 'text',
          placeholder: 'e.g., MCO 5215.1K',
          required: true,
          className: 'md:col-span-1',
          description: 'The directive being amended (e.g., MCO 5215.1K)'
        },
        {
          name: 'changeNumber',
          label: 'Change Number',
          type: 'number',
          placeholder: '1',
          required: true,
          className: 'md:col-span-1',
          description: 'Sequential change number (Ch 1, Ch 2, etc.)'
        },
        // FOUO Designation retired from the form 2026-08-16. DoDI
        // 5200.48 (6 March 2020) cancelled DoDM 5200.01 Vol 4 and ended
        // FOUO on newly created documents; USMC implemented it in
        // MARADMIN 664/20. CUI replaces it, and this type already has
        // showClassification: true, so the marking engine covers it.
        // The schema field and both emitters still render a saved
        // fouoDesignation so a legacy document keeps its marking, and
        // validateRetiredFouo reports it.
      ]
    }
  ]
};

// --- DLA Correspondence Schemas (DLA Correspondence Manual, 2011) ---

const DLA_CORRESPONDENCE_FEATURES: DocumentFeatures = {
  // DLA correspondence keeps the marking engine (FOUO/CUI headers).
  showClassification: true,
  showHeaderSettings: true,
  showFontSelector: false,
  showUnitInfo: true,
  showEndorsementDetails: false,
  showDirectiveTitle: false,
  showVia: false,           // DLA uses THROUGH, not Via
  showReferences: true,
  showEnclosures: true,
  showDistribution: false,
  showReports: false,
  showParagraphs: true,
  showClosingBlock: true,
  showMOAForm: false,
  showSignature: true,
  showDecisionGrid: false,
  showCoordinationTable: false,
  isAMHS: false,
  isDirective: false,
  showMultipleTo: false,
  showToDistribution: false,
  category: 'dla-correspondence',
  exportFormats: ['pdf', 'docx'],
  pdfPipeline: 'standard',
};

// DLA Standard Memorandum
export const DLAMemorandumSchema = z.object({
  documentType: z.literal('dla-memorandum'),
  date: z.string().min(1, "Date is required"),
  suspenseDate: z.string().optional(),  // "S: November 01, 2011" — two lines above date
  memorandumFor: z.string().min(1, "MEMORANDUM FOR addressee is required"),
  through: z.string().optional(),  // THROUGH routing (optional)
  subj: subjFieldDLAMemo(),  // Title Case per DLA Corr Manual Ch.3 Para 8
  signerFullName: z.string().optional(),
  signerRank: z.string().optional(),     // e.g., "Lieutenant General, USAF"
  signerTitle: z.string().optional(),    // e.g., "Director" or "Title or Position"
  delegationText: z.string().optional(),
  fouoDesignation: z.string().optional(),  // FOUO marking per DLA Ch.1 Para 15
  line1: z.string(),
  line2: z.string(),
  line3: z.string(),
  bodyFont: z.string().optional(),
});

export const DLAMemorandumDefinition: DocumentTypeDefinition = {
  id: 'dla-memorandum',
  name: 'Standard Memorandum (DLA)',
  description: 'Standard memorandum format per DLA Correspondence Manual. Uses MEMORANDUM FOR instead of From/To.',
  icon: '🏢',
  schema: DLAMemorandumSchema,
  features: { ...DLA_CORRESPONDENCE_FEATURES },
  sections: [
    {
      id: 'header',
      title: 'Memorandum Details',
      fields: [
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'Month DD, YYYY',
          description: 'DLA uses civilian date format (e.g., March 21, 2011)',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'suspenseDate',
          label: 'Suspense Date',
          type: 'date',
          placeholder: 'Month DD, YYYY (optional)',
          description: 'Action required by this date. Placed two lines above document date.',
          className: 'md:col-span-1'
        },
        {
          name: 'memorandumFor',
          label: 'MEMORANDUM FOR',
          type: 'text',
          placeholder: 'Director, Defense Logistics Agency',
          description: 'The addressee for this memorandum',
          required: true,
          className: 'col-span-full'
        },
        {
          name: 'through',
          label: 'THROUGH',
          type: 'text',
          placeholder: 'Deputy Director, DLA (optional)',
          description: 'Optional routing through an intermediary',
          className: 'col-span-full'
        },
        {
          name: 'subj',
          label: 'SUBJECT',
          type: 'text',
          placeholder: 'Preparing a Memorandum',
          description: 'Title Case: capitalize first letter of each word except articles, prepositions, and conjunctions.',
          required: true,
          className: 'col-span-full'
        }
      ]
    },
    {
      id: 'signature',
      title: 'Signature Block',
      fields: [
        {
          name: 'signerFullName',
          label: 'Signer Full Name',
          type: 'text',
          placeholder: 'JOHN M. HANCOCK',
          description: 'Full name in ALL CAPS (DLA format)',
          className: 'md:col-span-1'
        },
        {
          name: 'signerRank',
          label: 'Rank / Service',
          type: 'text',
          placeholder: 'Lieutenant General, USAF',
          description: 'Military grade and service branch',
          className: 'md:col-span-1'
        },
        {
          name: 'signerTitle',
          label: 'Title / Position',
          type: 'text',
          placeholder: 'Director',
          description: 'Official title or position',
          className: 'md:col-span-1'
        },
        {
          name: 'delegationText',
          label: 'Delegation Text',
          type: 'text',
          placeholder: 'e.g., By direction',
          className: 'md:col-span-1'
        },
        // FOUO Designation retired from the form 2026-08-16. DoDI
        // 5200.48 (6 March 2020) cancelled DoDM 5200.01 Vol 4 and ended
        // FOUO on newly created documents; USMC implemented it in
        // MARADMIN 664/20. CUI replaces it, and this type already has
        // showClassification: true, so the marking engine covers it.
        // The schema field and both emitters still render a saved
        // fouoDesignation so a legacy document keeps its marking, and
        // validateRetiredFouo reports it.
      ]
    }
  ]
};

// DLA Business Letter
export const DLABusinessLetterSchema = z.object({
  documentType: z.literal('dla-business-letter'),
  date: z.string().min(1, "Date is required"),
  suspenseDate: z.string().optional(),  // "S: November 01, 2011" — two lines above date
  recipientName: z.string().optional(),
  recipientTitle: z.string().optional(),
  businessName: z.string().optional(),
  recipientAddress: z.string().optional(),
  salutation: z.string().optional(),
  subj: subjFieldRequired(),
  signerFullName: z.string().optional(),
  delegationText: z.string().optional(),
  fouoDesignation: z.string().optional(),  // FOUO marking per DLA Ch.1 Para 15
  complimentaryClose: z.string().optional(),
  line1: z.string(),
  line2: z.string(),
  line3: z.string(),
  bodyFont: z.string().optional(),
});

export const DLABusinessLetterDefinition: DocumentTypeDefinition = {
  id: 'dla-business-letter',
  name: 'Business Letter (DLA)',
  description: 'DLA business letter for correspondence with non-DoD entities.',
  icon: '💼',
  schema: DLABusinessLetterSchema,
  features: { ...DLA_CORRESPONDENCE_FEATURES },
  sections: [
    {
      id: 'header',
      title: 'Letter Details',
      fields: [
        {
          name: 'date',
          label: 'Date',
          type: 'date',
          placeholder: 'Month DD, YYYY',
          description: 'DLA uses civilian date format',
          required: true,
          className: 'md:col-span-1'
        },
        {
          name: 'suspenseDate',
          label: 'Suspense Date',
          type: 'date',
          placeholder: 'Month DD, YYYY (optional)',
          description: 'Action required by this date. Placed two lines above document date.',
          className: 'md:col-span-1'
        },
        {
          name: 'subj',
          label: 'SUBJECT',
          type: 'text',
          placeholder: 'SUBJECT LINE (ALL CAPS)',
          required: true,
          className: 'col-span-full'
        }
      ]
    },
    {
      id: 'recipient',
      title: 'Inside Address',
      fields: [
        {
          name: 'recipientName',
          label: 'Recipient Name',
          type: 'text',
          placeholder: 'Mr. John Doe',
          className: 'col-span-full'
        },
        {
          name: 'recipientTitle',
          label: 'Title',
          type: 'text',
          placeholder: 'Vice President',
          className: 'md:col-span-1'
        },
        {
          name: 'businessName',
          label: 'Business Name',
          type: 'text',
          placeholder: 'Acme Corp',
          className: 'md:col-span-1'
        },
        {
          name: 'recipientAddress',
          label: 'Address',
          type: 'textarea',
          placeholder: '123 Main St\nCity, State Zip',
          className: 'col-span-full',
          rows: 3
        },
        {
          name: 'salutation',
          label: 'Salutation',
          type: 'text',
          placeholder: 'Dear Mr. Doe:',
          className: 'col-span-full'
        }
      ]
    },
    {
      id: 'signature',
      title: 'Signature Block',
      fields: [
        {
          name: 'complimentaryClose',
          label: 'Complimentary Close',
          type: 'text',
          placeholder: 'Sincerely,',
          className: 'md:col-span-1'
        },
        {
          name: 'signerFullName',
          label: 'Signer Full Name',
          type: 'text',
          placeholder: 'JOHN M. HANCOCK',
          description: 'Full name in ALL CAPS (DLA format)',
          className: 'md:col-span-1'
        },
        {
          name: 'delegationText',
          label: 'Delegation Text',
          type: 'text',
          placeholder: 'e.g., By direction',
          className: 'md:col-span-1'
        },
        // FOUO Designation retired from the form 2026-08-16. DoDI
        // 5200.48 (6 March 2020) cancelled DoDM 5200.01 Vol 4 and ended
        // FOUO on newly created documents; USMC implemented it in
        // MARADMIN 664/20. CUI replaces it, and this type already has
        // showClassification: true, so the marking engine covers it.
        // The schema field and both emitters still render a saved
        // fouoDesignation so a legacy document keeps its marking, and
        // validateRetiredFouo reports it.
      ]
    }
  ]
};

// Create a union of all schemas for type inference
export const DocumentSchema = z.union([
  BasicLetterSchema,
  MultipleAddressLetterSchema,
  EndorsementSchema,
  AAFormSchema,
  MCOSchema,
  BulletinSchema,
  SecnavInstructionSchema,
  SecnavNoticeSchema,
  ChangeTransmittalSchema,
  Page11Schema,
  Navmc10922Schema,
  Navmc10132Schema,
  AMHSSchema,
  MFRSchema,
  FromToMemoSchema,
  LetterheadMemoSchema,
  CoordinationPageSchema,
  MOASchema,
  MOUSchema,
  StaffingPaperSchema,
  BusinessLetterSchema,
  ExecutiveCorrespondenceSchema,
  DLAMemorandumSchema,
  DLABusinessLetterSchema,
]);

// Infer the FormData type from the union schema
export type LetterFormData = z.infer<typeof DocumentSchema>;

// A generic document type that can be one of any of the specific document types
export type GenericDocument = z.infer<typeof DocumentSchema>;

// Registry of all document types
export const DOCUMENT_TYPES: Record<string, DocumentTypeDefinition> = {
  basic: BasicLetterDefinition,
  'multiple-address': MultipleAddressLetterDefinition,
  endorsement: EndorsementDefinition,
  'aa-form': AAFormDefinition,
  mco: MCODefinition,
  bulletin: BulletinDefinition,
  'secnav-instruction': SecnavInstructionDefinition,
  'secnav-notice': SecnavNoticeDefinition,
  'change-transmittal': ChangeTransmittalDefinition,
  page11: Page11Definition,
  navmc10922: Navmc10922Definition,
  navmc10132: Navmc10132Definition,
  mfr: MFRDefinition,
  'from-to-memo': FromToMemoDefinition,
  'letterhead-memo': LetterheadMemoDefinition,
  amhs: AMHSDefinition,
  moa: MOADefinition,
  mou: MOUDefinition,
  'information-paper': InformationPaperDefinition,
  'position-paper': PositionPaperDefinition,
  'decision-paper': DecisionPaperDefinition,
  'coordination-page': CoordinationPageDefinition,
  'business-letter': BusinessLetterDefinition,
  'executive-correspondence': ExecutiveCorrespondenceDefinition,
  'dla-memorandum': DLAMemorandumDefinition,
  'dla-business-letter': DLABusinessLetterDefinition,
  'i-type': ITypeDefinition,
};
