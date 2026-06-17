// DOCX rendering for the I-Type Appendix A / Enclosure (1) pages.
// The appendix is a free-form paragraph editor with optional inline tables.
// Reads appendixParagraphs from the form data so the DOCX, PDF, and preview
// stay in parity.

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  TabStopType,
  type ISectionOptions,
} from 'docx';
import { APPENDIX_LABEL, ENCLOSURE_LABEL, appendixRunningHeader } from '@/lib/i-type/appendix-spec';
import {
  appendixCitation,
  COLUMN_LABEL,
  type AppendixInlineTable,
  type AppendixParagraph,
} from '@/lib/i-type/appendix-paragraphs';

const FONT = 'Arial';
const SIZE = 22; // 11pt in half-points
const PER_LEVEL_INDENT = 360; // 0.25in per outline level, in twips
const MARKER_GAP = 432; // ~0.3in from the marker to the title, in twips
const TABLE_WIDTH = 9360; // 6.5in at 1in side margins

// Borderless, matching the cover table (placeholder grid, no rules).
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const cellBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const run = (text: string, opts: { bold?: boolean; underline?: boolean } = {}) =>
  new TextRun({
    text,
    bold: opts.bold,
    underline: opts.underline ? {} : undefined,
    font: FONT,
    size: SIZE,
  });

const date = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
};

const columnWidths = (count: number): number[] => {
  if (count >= 5) return [1200, 2760, 2160, 2160, 1080];
  if (count === 4) return [3744, 2340, 2340, 936];
  return [4680, 2340, 2340];
};

const cell = (text: string, width: number) =>
  new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({ children: [run(text)] })],
  });

// Header row plus the entered rows. Borderless.
const inlineTable = (table: AppendixInlineTable, indent: number): Table => {
  const widths = columnWidths(table.columns.length);
  const rows: TableRow[] = [
    new TableRow({
      children: table.columns.map((c, i) => cell(COLUMN_LABEL[c], widths[i])),
    }),
  ];
  for (const row of table.rows) {
    rows.push(
      new TableRow({
        children: table.columns.map((c, i) => cell((row?.[c] ?? '').toString(), widths[i])),
      })
    );
  }
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    indent: indent ? { size: indent, type: WidthType.DXA } : undefined,
    rows,
  });
};

const buildAppendixChildren = (formData: Record<string, any>): (Paragraph | Table)[] => {
  const paragraphs = (formData?.appendixParagraphs as AppendixParagraph[]) ?? [];

  const children: (Paragraph | Table)[] = [];
  children.push(new Paragraph({ children: [run(APPENDIX_LABEL)] }));
  children.push(new Paragraph({ children: [run(ENCLOSURE_LABEL)] }));
  children.push(new Paragraph({ children: [run('')] }));

  paragraphs.forEach((p, i) => {
    const citation = appendixCitation(paragraphs, i);
    const indent = Math.max(0, (p.level - 1) * PER_LEVEL_INDENT);
    const hasContent = !!(p.content && p.content.trim());
    const textStart = indent + MARKER_GAP;
    // Marker, then a tab to the title position, so titles align with extra
    // space. Period after the title only when the paragraph has content.
    const lineRuns: TextRun[] = [run(citation, { bold: true }), run('\t')];
    if (p.title) {
      lineRuns.push(run(`${p.title}${hasContent ? '.' : ''}`, { bold: true, underline: true }));
      if (hasContent) lineRuns.push(run(`  ${p.content}`));
    } else if (hasContent) {
      lineRuns.push(run(p.content));
    }
    children.push(
      new Paragraph({
        indent: { left: textStart, hanging: MARKER_GAP },
        tabStops: [{ type: TabStopType.LEFT, position: textStart }],
        children: lineRuns,
      })
    );
    if (p.table) children.push(inlineTable(p.table, indent));
  });

  return children;
};

// The appendix as its own DOCX section: running header, page number restarting
// at 1, 1in left/right margins to match the page-3 letter.
export const appendixSection = (formData: Record<string, any>): ISectionOptions => ({
  properties: {
    page: {
      margin: { top: 720, right: 1440, bottom: 720, left: 1440 },
      pageNumbers: { start: 1 },
    },
  },
  headers: {
    default: new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [run(appendixRunningHeader(formData.shortTitle, date(formData.date)))],
        }),
      ],
    }),
  },
  footers: {
    default: new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE })],
        }),
      ],
    }),
  },
  children: buildAppendixChildren(formData),
});
