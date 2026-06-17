// Appendix A paragraph model. The appendix is a free-form paragraph editor like
// the Marine Corps Order body, with optional inline tables. One source of truth
// for the preview, PDF, and DOCX so all three stay in parity.

export type AppendixColumnKey = 'figItem' | 'item' | 'nomenclature' | 'nsn' | 'pn' | 'qty';

export const COLUMN_LABEL: Record<AppendixColumnKey, string> = {
  figItem: 'Fig. Item',
  item: 'Item',
  nomenclature: 'Nomenclature',
  nsn: 'NSN',
  pn: 'PN',
  qty: 'Qty',
};

// The two base table shapes Insert Table offers.
export const THREE_COL: AppendixColumnKey[] = ['nomenclature', 'nsn', 'pn'];
export const FOUR_COL: AppendixColumnKey[] = ['nomenclature', 'nsn', 'pn', 'qty'];

// Optional leading reference column, per the template (Materiel Retained uses
// "Fig. Item", Bulk and Consumable uses "Item").
export type AppendixLead = 'none' | 'item' | 'figItem';
export const LEAD_KEYS: AppendixColumnKey[] = ['item', 'figItem'];

export interface AppendixInlineTable {
  // Column keys in render order. Three-col omits qty.
  columns: AppendixColumnKey[];
  // Entered rows. Empty array renders the header with no body rows.
  rows: Array<Record<string, string>>;
}

export interface AppendixParagraph {
  id: number;
  level: number;
  content: string;
  // Optional bold-underlined heading shown before the content, e.g. "Purpose.".
  title?: string;
  // Optional inline table attached under the paragraph.
  table?: AppendixInlineTable;
}

// A fresh appendix is seeded with the 13 standard Appendix A paragraphs, like
// the MCO body comes pre-populated. Items 7, 8a-d, and 9a-b carry empty tables.
// Headings that precede a table or sub-items take no trailing period.
export const defaultAppendixParagraphs = (): AppendixParagraph[] => {
  let id = 0;
  const p = (
    level: number,
    title: string,
    opts?: { content?: string; table?: AppendixInlineTable }
  ): AppendixParagraph => ({
    id: ++id,
    level,
    title,
    content: opts?.content ?? '',
    ...(opts?.table ? { table: opts.table } : {}),
  });
  const t3 = (): AppendixInlineTable => ({ columns: [...THREE_COL], rows: [] });
  const t4 = (): AppendixInlineTable => ({ columns: [...FOUR_COL], rows: [] });

  // Titles are stored without trailing periods. The render adds a period only
  // when the paragraph has content, matching the Marine Corps Bulletin rule.
  return [
    p(1, 'Purpose'),
    p(1, 'Administrative Instructions'),
    p(1, 'Applicability'),
    p(1, 'Time Compliance Period'),
    p(1, 'Information'),
    p(1, 'Technical Manuals Affected'),
    p(1, 'Components Affected', { table: t3() }),
    p(1, 'Materiel'),
    p(2, 'Materiel Required', { table: t4() }),
    p(2, 'Materiel Discarded', {
      content: 'Dispose of discarded materiel in accordance with (IAW) current Marine Corps directives.',
      table: t4(),
    }),
    p(2, 'Materiel Retained', { table: t4() }),
    p(2, 'Bulk and Consumable Materiel', { table: t4() }),
    p(1, 'Special Tools, Jigs, and Fixtures Required'),
    p(2, 'Special Tools', { table: t4() }),
    p(2, 'Jigs and Fixtures', { table: t4() }),
    p(1, 'Special Instructions'),
    p(1, 'Supply Action'),
    p(1, 'Skill and Time Required'),
    p(1, 'Procedures'),
  ];
};

function numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

// Directive-style citation, matching useParagraphs: L1 "1.", L2 "a", L3 "(1)",
// L4 "(a)", and so on. Kept standalone so the appendix does not depend on the
// MCO hook.
export function appendixCitation(paragraphs: Array<{ level: number }>, index: number): string {
  const level = paragraphs[index]?.level ?? 1;
  // Count siblings at this level since the last lower-level paragraph, so
  // sub-paragraphs reset to a, b, c under each parent, with no "8a" prefix.
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (paragraphs[i].level < level) {
      start = i + 1;
      break;
    }
  }
  let count = 0;
  for (let i = start; i <= index; i++) {
    if (paragraphs[i].level === level) count++;
  }
  switch (level) {
    case 1:
      return `${count}.`;
    case 2:
      return `${numberToLetter(count)}.`;
    case 3:
      return `(${count})`;
    case 4:
      return `(${numberToLetter(count)})`;
    case 5:
      return `${count}.`;
    case 6:
      return `${numberToLetter(count)}.`;
    case 7:
      return `(${count})`;
    case 8:
      return `(${numberToLetter(count)})`;
    default:
      return '';
  }
}
