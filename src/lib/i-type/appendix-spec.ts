// Shared specification for the I-Type Appendix A / Enclosure (1) pages.
// One source of truth so the preview, PDF, and DOCX render the same outline,
// headings, tables, and placeholder text. Structure only in this pass: the
// tables describe their columns and which data field they bind to later, but
// no data is read here and no data-entry UI is implied.
//
// Mirrors the single-source pattern of page3-derivations.ts.
//
// Heading punctuation rule, measured from the template:
//   - A heading followed by a table or sub-items takes no trailing period
//     (items 7, 8, 8a, 8c, 8d, 9, 9a, 9b).
//   - A standalone heading takes a trailing period (items 1-6, 10-13).
//   - Item 8b heading takes a period because a fixed note follows inline.

import type { ITypeFormData } from '@/lib/schemas/i-type-schema';

// Data arrays on ITypeFormData an appendix table binds to once data binding is
// added. componentsAffected has no qty column. The six material and tool arrays
// each carry { nomenclature, nsn, pn, qty }.
export type AppendixDataField =
  | 'appendixComponents'
  | 'materialRequired'
  | 'materialDiscarded'
  | 'materialRetained'
  | 'bulkMaterial'
  | 'specialTools'
  | 'jigsFixtures';

// Object keys a table column reads from a row.
export type AppendixColumnKey = 'nomenclature' | 'nsn' | 'pn' | 'qty';

export interface AppendixTableSpec {
  // Source array on the form data. Used only when data binding gets added.
  dataField: AppendixDataField;
  // Column header labels, in render order.
  headers: string[];
  // Row object keys, aligned one-to-one with headers.
  keys: AppendixColumnKey[];
}

export interface AppendixSubItem {
  // Outline label, e.g. "a", "b", "c", "d".
  label: string;
  // Heading text, render bold and underlined.
  heading: string;
  // Fixed body line shown inline after the heading, normal weight. Optional.
  note?: string;
  // Placeholder table for this sub-item. Optional.
  table?: AppendixTableSpec;
}

export interface AppendixItem {
  // Outline number, 1 through 13.
  number: number;
  // Heading text, render bold and underlined.
  heading: string;
  // Item-level placeholder table, used by item 7 only. Optional.
  table?: AppendixTableSpec;
  // Lettered sub-items, used by items 8 and 9. Optional.
  subItems?: AppendixSubItem[];
  // Marks an item whose body format is deferred to a later pass. Item 13's
  // MIL-STD-38784 procedure layout is not built yet.
  deferredFormat?: string;
}

// Top-of-section labels, rendered once at the start of the appendix.
export const APPENDIX_LABEL = 'Appendix A:';
export const ENCLOSURE_LABEL = 'Enclosure (1):';

// Red placeholder shown in every empty table cell in this structure-first pass.
export const APPENDIX_PLACEHOLDER_TEXT = '(Select Item)';

// How many placeholder rows each empty table renders.
export const APPENDIX_PLACEHOLDER_ROWS = 1;

// Centered running header at the top of each appendix page. The template shows
// the short title bare and the date in parentheses, e.g.
//   "MI-#####X-##/#  (16 Jun 2026)".
// Falls back to the literal tokens "SHORT TITLE" and "DATE" when absent so the
// blank template still reads correctly.
export const appendixRunningHeader = (shortTitle?: string, date?: string) =>
  `${shortTitle || 'SHORT TITLE'} (${date || 'DATE'})`;

// Three-column table shape: Nomenclature, NSN, PN. Item 7 only.
const NOMEN_NSN_PN: Pick<AppendixTableSpec, 'headers' | 'keys'> = {
  headers: ['Nomenclature', 'NSN', 'PN'],
  keys: ['nomenclature', 'nsn', 'pn'],
};

// Four-column table shape: Nomenclature, NSN, PN, Qty. Items 8 and 9.
const NOMEN_NSN_PN_QTY: Pick<AppendixTableSpec, 'headers' | 'keys'> = {
  headers: ['Nomenclature', 'NSN', 'PN', 'Qty'],
  keys: ['nomenclature', 'nsn', 'pn', 'qty'],
};

// The Appendix A outline, measured from the template and the owner's list. This
// array is the only place the outline structure is defined. All three render
// targets read it so headings, ordering, and table columns stay in parity.
export const APPENDIX_A_OUTLINE: AppendixItem[] = [
  { number: 1, heading: 'Purpose.' },
  { number: 2, heading: 'Administrative Instructions.' },
  { number: 3, heading: 'Applicability.' },
  { number: 4, heading: 'Time Compliance Period.' },
  { number: 5, heading: 'Information.' },
  { number: 6, heading: 'Technical Manuals Affected.' },
  {
    number: 7,
    heading: 'Components Affected',
    table: { dataField: 'appendixComponents', ...NOMEN_NSN_PN },
  },
  {
    number: 8,
    heading: 'Materiel',
    subItems: [
      {
        label: 'a',
        heading: 'Materiel Required',
        table: { dataField: 'materialRequired', ...NOMEN_NSN_PN_QTY },
      },
      {
        label: 'b',
        heading: 'Materiel Discarded.',
        note: 'Dispose of discarded materiel in accordance with (IAW) current Marine Corps directives.',
        table: { dataField: 'materialDiscarded', ...NOMEN_NSN_PN_QTY },
      },
      {
        label: 'c',
        heading: 'Materiel Retained',
        table: { dataField: 'materialRetained', ...NOMEN_NSN_PN_QTY },
      },
      {
        label: 'd',
        heading: 'Bulk and Consumable Materiel',
        table: { dataField: 'bulkMaterial', ...NOMEN_NSN_PN_QTY },
      },
    ],
  },
  {
    number: 9,
    heading: 'Special Tools, Jigs, and Fixtures Required',
    subItems: [
      {
        label: 'a',
        heading: 'Special Tools',
        table: { dataField: 'specialTools', ...NOMEN_NSN_PN_QTY },
      },
      {
        label: 'b',
        heading: 'Jigs and Fixtures',
        table: { dataField: 'jigsFixtures', ...NOMEN_NSN_PN_QTY },
      },
    ],
  },
  { number: 10, heading: 'Special Instructions.' },
  { number: 11, heading: 'Supply Action.' },
  { number: 12, heading: 'Skill and Time Required.' },
  { number: 13, heading: 'Procedures.', deferredFormat: 'MIL-STD-38784' },
];

// Every table spec in the outline, top to bottom, for callers that precompute
// column widths once. Order follows the outline.
export const appendixTableSpecs = (): AppendixTableSpec[] => {
  const specs: AppendixTableSpec[] = [];
  for (const item of APPENDIX_A_OUTLINE) {
    if (item.table) specs.push(item.table);
    for (const sub of item.subItems ?? []) {
      if (sub.table) specs.push(sub.table);
    }
  }
  return specs;
};

// Returns the bound rows for a table spec, or an empty array. Structure-first
// callers ignore this and render placeholder rows instead.
export const appendixRows = (data: ITypeFormData, spec: AppendixTableSpec) =>
  (data[spec.dataField] ?? []) as Array<Record<AppendixColumnKey, string | number>>;
