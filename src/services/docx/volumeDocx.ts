import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  ImageRun,
  Header,
  Footer,
  HeadingLevel,
  NumberFormat,
  PageNumber,
  PageBreak,
  TableOfContents,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  VerticalAlign,
  type ISectionOptions,
} from 'docx';
import type {
  Block,
  Chapter,
  Figure,
  Paragraph as VolParagraph,
  Run,
  Section,
  SubPara,
  VolumeDoc,
} from '@/lib/schemas/volume-schema';
import {
  paragraphDesignator,
  referenceDesignator,
  sectionDesignator,
  subParaDesignator,
} from '@/lib/volume/designators';
import {
  CHAPTER_CHANGE_POLICY_BOILERPLATE,
  formatDate,
  footerScheme,
  LEGEND_TEXT,
  REFERENCES_SUMMARY_BOILERPLATE,
  runningHeadParts,
  VOLUME_CHANGE_POLICY_BOILERPLATE,
  type FooterScheme,
  type Page as LaidOutPage,
} from '@/lib/volume/layout';

// ---------------------------------------------------------------------------
// Page geometry (US Letter, 1" margins) and type sizes. DOCX is the
// structural-fidelity output — Word owns pagination and line wrapping, so
// this generator does not attempt per-page layout parity with the PDF
// (src/services/pdf/volumeGenerator.ts); it mirrors structure, designators,
// the indent ladder, and the section/header/footer/TOC scaffolding.
// ---------------------------------------------------------------------------
const FONT = 'Times New Roman';
const PAGE_WIDTH = 12240; // Letter, twips
const PAGE_HEIGHT = 15840;
const MARGIN = 1440; // 1"

const BODY_SIZE = 22; // 11pt, half-points
const RUNNING_HEAD_SIZE = 24; // 12pt
const FOOTER_SIZE = 23; // 11.5pt
const TITLE_SIZE = 24; // 12pt, used for divider/title headings

// 36pt ladder steps, converted to twips (36pt * 20 = 720 twips per step).
const LADDER_STEP = 720;
type Level = 1 | 2 | 3 | 4;
function ladderIndent(level: Level): number {
  return (level - 1) * LADDER_STEP;
}

const BLUE = '0000FF';

type ParaChild = TextRun | ExternalHyperlink;
type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

// ---------------------------------------------------------------------------
// Run / block helpers
// ---------------------------------------------------------------------------
function runToChildren(run: Run): ParaChild[] {
  if (run.link && run.href) {
    return [
      new ExternalHyperlink({
        link: run.href,
        children: [
          new TextRun({
            text: run.text,
            font: FONT,
            size: BODY_SIZE,
            color: BLUE,
            bold: true,
            italics: true,
            underline: {},
          }),
        ],
      }),
    ];
  }
  return [
    new TextRun({
      text: run.text,
      font: FONT,
      size: BODY_SIZE,
      color: run.changed ? BLUE : undefined,
    }),
  ];
}

function blocksToChildren(blocks: Block[]): ParaChild[] {
  const out: ParaChild[] = [];
  for (const block of blocks) {
    for (const run of block.runs) out.push(...runToChildren(run));
  }
  return out;
}

/**
 * A designator + body paragraph on the fixed ladder: the designator and the
 * start of the body text share the paragraph's first line, indented to the
 * level's stop (`indent.firstLine`); any wrapped continuation returns to the
 * left margin (`indent.left: 0`), mirroring the PDF's
 * designatorX/textStartX/RUNOVER_X geometry (src/lib/volume/volume-indent.ts)
 * without reproducing its manual line-wrapping — Word wraps the paragraph.
 */
function designatedParagraph(
  designator: string,
  level: Level,
  title: string | undefined,
  body: Block[],
  heading?: HeadingValue,
): Paragraph {
  const children: ParaChild[] = [new TextRun({ text: `${designator}  `, font: FONT, size: BODY_SIZE })];
  if (title) children.push(new TextRun({ text: `${title}.  `, font: FONT, size: BODY_SIZE }));
  children.push(...blocksToChildren(body));
  return new Paragraph({
    ...(heading ? { heading } : {}),
    indent: { left: 0, firstLine: ladderIndent(level) },
    children,
  });
}

function textBlock(text: string): Block[] {
  return [{ runs: [{ text }] }];
}

// ---------------------------------------------------------------------------
// Small paragraph builders shared by front matter and chapter dividers.
// ---------------------------------------------------------------------------
function centered(text: string, size = BODY_SIZE, heading?: HeadingValue): Paragraph {
  return new Paragraph({
    ...(heading ? { heading } : {}),
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: FONT, size })],
  });
}
function leftPara(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, font: FONT, size: BODY_SIZE })] });
}
function blankLine(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: BODY_SIZE })] });
}
function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function changeTable(headers: string[], rows: string[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          borders,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: FONT, size: BODY_SIZE })] })],
        }),
    ),
  });
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders,
              children: [new Paragraph({ children: [new TextRun({ text: cell, font: FONT, size: BODY_SIZE })] })],
            }),
        ),
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [headerRow, ...dataRows] });
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------
function decodeDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported figure image encoding (expected a base64 data URL)');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Fixed box (pixels, ~4.7in x 3.1in at 96dpi). Real pixel dimensions of an
// arbitrary data-URL image aren't known without an image-decoding library,
// so (like the PDF path centers into a fixed box preserving aspect ratio)
// this generator uses one conservative box rather than measuring the image.
const FIGURE_BOX = { width: 450, height: 300 };

function figureParagraphs(figure: Figure): Paragraph[] {
  const out: Paragraph[] = [];
  try {
    const bytes = decodeDataUrl(figure.image);
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: bytes, transformation: FIGURE_BOX })],
      }),
    );
  } catch (error) {
    console.error(`Volume DOCX: figure ${figure.number} could not be embedded:`, error);
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `Figure ${figure.number}: image could not be embedded`, font: FONT, size: BODY_SIZE }),
        ],
      }),
    );
  }
  out.push(centered(`Figure ${figure.number}`));
  for (const line of figure.legend ?? []) out.push(centered(line));
  return out;
}

// ---------------------------------------------------------------------------
// Sections / paragraphs / sub-paragraphs
// ---------------------------------------------------------------------------
function subParaParagraphs(sub: SubPara, level: Level): Paragraph[] {
  const designator = subParaDesignator(sub.style, sub.seq);
  const out: Paragraph[] = [designatedParagraph(designator, level, sub.title, sub.body)];
  for (const child of sub.children) {
    const childLevel = Math.min(level + 1, 4) as Level;
    out.push(...subParaParagraphs(child, childLevel));
  }
  return out;
}

function paragraphParagraphs(chapterNumber: number, sectionSeq: number, para: VolParagraph): Paragraph[] {
  const designator = paragraphDesignator(chapterNumber, sectionSeq, para.seq);
  const out: Paragraph[] = [designatedParagraph(designator, 2, para.title, para.body)];
  for (const sub of para.children) out.push(...subParaParagraphs(sub, 3));
  return out;
}

function sectionParagraphs(chapterNumber: number, section: Section, sectionPeriod: boolean): (Paragraph | Table)[] {
  const designator = sectionDesignator(chapterNumber, section.seq, sectionPeriod);
  // Finding 4: a section heading carries HeadingLevel.HEADING_2 so Word's
  // TableOfContents field (headingStyleRange '1-2', in
  // buildTocChildren below) actually finds something to list - previously
  // NO paragraph in the whole document carried a heading style, so the TOC
  // field rebuilt empty. Heading2 is restyled in the Document's default
  // styles (generateVolumeDocx below) to plain Times New Roman 11pt, not
  // bold, so this doesn't disturb the format standard's typography (§8).
  const out: (Paragraph | Table)[] = [
    designatedParagraph(designator, 1, undefined, textBlock(section.title.toUpperCase()), HeadingLevel.HEADING_2),
  ];
  // Finding 1: mirrors layout.ts - body and paragraphs are not mutually
  // exclusive in the schema, so both render (body first, flush left, then
  // numbered paragraphs) instead of an if/else that dropped one of them.
  if (section.body && section.body.length > 0) {
    for (const block of section.body) {
      out.push(new Paragraph({ indent: { left: 0, firstLine: 0 }, children: blocksToChildren([block]) }));
    }
  }
  for (const para of section.paragraphs) out.push(...paragraphParagraphs(chapterNumber, section.seq, para));
  return out;
}

// ---------------------------------------------------------------------------
// Shared running-head / footer builders (Finding 3).
//
// Both bands' furniture is now composed from the same runningHeadParts/
// footerScheme (lib/volume/layout.ts) the PDF generator uses, instead of
// each generator (and, before this fix, each of DOCX's own front-matter vs.
// chapter sections) carrying its own copy of the left-label rule and date
// formatting.
// ---------------------------------------------------------------------------
function docxNumberFormat(format: FooterScheme['format']): (typeof NumberFormat)[keyof typeof NumberFormat] {
  return format === 'lowerRoman' ? NumberFormat.LOWER_ROMAN : NumberFormat.DECIMAL;
}

function buildHeader(doc: VolumeDoc, band: LaidOutPage['band'], chapter?: number): Header {
  const parts = runningHeadParts(doc, band, chapter);
  return new Header({
    children: [
      centered(parts.center, RUNNING_HEAD_SIZE),
      new Paragraph({ children: [new TextRun({ text: parts.left, font: FONT, size: RUNNING_HEAD_SIZE })] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: parts.rightTop, font: FONT, size: RUNNING_HEAD_SIZE })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: parts.rightDate, font: FONT, size: RUNNING_HEAD_SIZE })],
      }),
    ],
  });
}

function buildFooter(band: LaidOutPage['band'], opts: { chapter?: number; useChapterPage?: boolean } = {}): Footer {
  const scheme = footerScheme(band, opts);
  const children: TextRun[] = [];
  if (scheme.prefix) children.push(new TextRun({ text: scheme.prefix, font: FONT, size: FOOTER_SIZE }));
  children.push(new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FOOTER_SIZE }));
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children })] });
}

// ---------------------------------------------------------------------------
// Front matter: title page, references, TOC field - each its OWN Word
// section (Finding 3), because each carries a different running-head left
// label and a different page-number band (roman front matter, "REF-n"
// references, roman again for the TOC, continuing the same roman count -
// mirroring lib/volume/layout.ts's layoutVolume: title+verso are roman i/ii,
// references are their own independent REF-{n} band, and the TOC continues
// the same roman count after them). Before this fix, ALL of front matter
// was one Word section with NO headers/footers at all.
// ---------------------------------------------------------------------------
function buildTitlePageChildren(doc: VolumeDoc): (Paragraph | Table)[] {
  const v = doc.volume;
  const children: (Paragraph | Table)[] = [];

  children.push(centered(`VOLUME ${v.number}`, TITLE_SIZE));
  const titleText = v.titleQuoted !== false ? `"${v.title}"` : v.title;
  children.push(centered(titleText, TITLE_SIZE));
  children.push(centered(`SUMMARY OF VOLUME ${v.number} CHANGES`, TITLE_SIZE));
  children.push(blankLine());

  children.push(centered(LEGEND_TEXT));
  children.push(blankLine());

  for (const line of VOLUME_CHANGE_POLICY_BOILERPLATE) children.push(leftPara(line));

  if (v.cancellation) {
    children.push(blankLine());
    children.push(leftPara(`CANCELLATION: ${v.cancellation}`));
  }

  children.push(blankLine());
  // Finding 3: dates format through the same shared formatDate
  // (lib/volume/layout.ts) the PDF path uses, instead of printing the raw
  // ISO string (e.g. "2018-02-20" instead of "20 Feb 2018").
  const seedRow = ['ORIGINAL VOLUME', 'N/A', formatDate(v.originalPublicationDate), 'N/A'];
  const changeRows =
    doc.changeLog.length > 0
      ? doc.changeLog.map((r) => [r.version, r.summary, r.originationDate, r.dateOfChanges])
      : [seedRow];
  children.push(
    changeTable(['VOLUME VERSION', 'SUMMARY OF CHANGE', 'ORIGINATION DATE', 'DATE OF CHANGES'], changeRows),
  );

  if (v.reportRequired) {
    children.push(blankLine());
    // Finding 3: the real Vol 17 PDF prints exactly "Report Required:" with
    // nothing appended (see layout.ts's layoutTitlePage for the same fix
    // and provenance) - "See Volume text for details." was invented text
    // with no backing field in the schema (reportRequired is a plain
    // boolean).
    children.push(leftPara('Report Required:'));
  }

  children.push(blankLine());
  children.push(leftPara('Submit recommended changes to this Volume, via the proper channels, to:'));
  for (const line of v.submitChangesTo.split('\n')) children.push(leftPara(line));

  children.push(blankLine());
  const distText =
    v.distribution.kind === 'pcn'
      ? `DISTRIBUTION: PCN ${v.distribution.value ?? ''}`
      : 'DISTRIBUTION STATEMENT A: Approved for public release; distribution is unlimited.';
  children.push(leftPara(distText));

  return children;
}

function buildReferencesChildren(doc: VolumeDoc): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  children.push(centered('REFERENCES', TITLE_SIZE));
  doc.references.forEach((ref, i) => {
    children.push(designatedParagraph(referenceDesignator(i), 1, undefined, textBlock(ref.text)));
  });

  children.push(pageBreak());
  children.push(centered('"REFERENCES"', TITLE_SIZE));
  children.push(blankLine());
  for (const line of REFERENCES_SUMMARY_BOILERPLATE) children.push(leftPara(line));

  return children;
}

function buildTocChildren(doc: VolumeDoc): (Paragraph | Table)[] {
  const v = doc.volume;
  return [
    centered(`VOLUME ${v.number}: ${v.title.toUpperCase()}`, TITLE_SIZE),
    centered('TABLE OF CONTENTS', TITLE_SIZE),
    blankLine(),
    // Finding 4: TableOfContents rebuilds from paragraphs styled Heading1/
    // Heading2 (headingStyleRange '1-2') - see the chapter title (Heading1)
    // and section heading (Heading2, sectionParagraphs above) paragraphs
    // this now relies on. Previously NO paragraph anywhere in the document
    // carried a heading style, so this field rebuilt empty in Word.
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  ];
}

function buildFrontMatterSections(doc: VolumeDoc): ISectionOptions[] {
  const pageGeometry = {
    size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  };

  const titleSection: ISectionOptions = {
    properties: {
      page: {
        ...pageGeometry,
        // Roman numerals starting at i (title + verso band).
        pageNumbers: { start: 1, formatType: docxNumberFormat(footerScheme('front').format) },
      },
    },
    headers: { default: buildHeader(doc, 'front') },
    footers: { default: buildFooter('front') },
    children: buildTitlePageChildren(doc),
  };

  const referencesSection: ISectionOptions = {
    properties: {
      page: {
        ...pageGeometry,
        // "REF-n" band, its own independent counter restarting at 1.
        pageNumbers: { start: 1, formatType: docxNumberFormat(footerScheme('ref').format) },
      },
    },
    headers: { default: buildHeader(doc, 'ref') },
    footers: { default: buildFooter('ref') },
    children: buildReferencesChildren(doc),
  };

  const tocSection: ISectionOptions = {
    properties: {
      page: {
        ...pageGeometry,
        // Roman numerals CONTINUING the title/verso count - no `start`,
        // since OOXML page numbering continues from the previous section
        // unless a section explicitly restarts it.
        pageNumbers: { formatType: docxNumberFormat(footerScheme('front').format) },
      },
    },
    headers: { default: buildHeader(doc, 'front') },
    footers: { default: buildFooter('front') },
    children: buildTocChildren(doc),
  };

  return [titleSection, referencesSection, tocSection];
}

// ---------------------------------------------------------------------------
// Chapter section: divider, chapter title, body, own headers/footers.
// ---------------------------------------------------------------------------
function buildChapterSection(doc: VolumeDoc, chapter: Chapter, useChapterPage: boolean): ISectionOptions {
  const children: (Paragraph | Table)[] = [];

  // Divider: "Summary of Substantive Changes" + chapter change table.
  children.push(centered(`VOLUME ${doc.volume.number}: CHAPTER ${chapter.number}`, TITLE_SIZE));
  children.push(centered(`"${chapter.title.toUpperCase()}"`, TITLE_SIZE));
  children.push(centered('SUMMARY OF SUBSTANTIVE CHANGES', TITLE_SIZE));
  children.push(blankLine());
  children.push(centered(LEGEND_TEXT));
  children.push(blankLine());
  for (const line of CHAPTER_CHANGE_POLICY_BOILERPLATE) children.push(leftPara(line));
  children.push(blankLine());
  children.push(
    changeTable(
      // Finding 15 (T10): format spec §4.6 verbatim header, with spaces
      // around the slash.
      ['CHAPTER VERSION', 'PAGE / PARAGRAPH', 'SUMMARY OF SUBSTANTIVE CHANGES', 'DATE OF CHANGE'],
      chapter.changeLog.map((r) => [r.version, r.pageParagraph, r.summary, r.dateOfChange]),
    ),
  );

  // Chapter title page. Combined into ONE heading paragraph carrying
  // HeadingLevel.HEADING_1 (Finding 4) so Word's TOC field (buildTocChildren
  // above) finds a chapter entry - previously two plain centered lines with
  // no heading style at all.
  children.push(pageBreak());
  children.push(centered(`CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}`, TITLE_SIZE, HeadingLevel.HEADING_1));
  children.push(blankLine());

  for (const section of chapter.sections) {
    children.push(...sectionParagraphs(chapter.number, section, doc.volume.sectionPeriod));
    children.push(blankLine());
  }
  for (const figure of chapter.figures) {
    children.push(...figureParagraphs(figure));
    children.push(blankLine());
  }

  return {
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        // Chapter-page numbering ("m-1", "m-2", ...) restarts at 1 for each
        // chapter section, mirroring the PDF's per-chapter page counter
        // (src/lib/volume/page-bands.ts bodyPageLabel). Sequential numbering
        // continues across chapter sections instead.
        pageNumbers: useChapterPage ? { start: 1 } : undefined,
      },
    },
    // Finding 3: both header and footer are now built from the same
    // runningHeadParts/footerScheme the PDF generator uses (via buildHeader/
    // buildFooter above), so a single-chapter volume's chapter header no
    // longer always prints ", Chapter N" and its date is formatted the same
    // way as the PDF's running head.
    headers: { default: buildHeader(doc, 'body', chapter.number) },
    footers: { default: buildFooter('body', { chapter: chapter.number, useChapterPage }) },
    children,
  };
}

// ---------------------------------------------------------------------------
// generateVolumeDocx
// ---------------------------------------------------------------------------
export async function generateVolumeDocx(doc: VolumeDoc): Promise<Blob> {
  const multiChapter = doc.chapters.length > 1;
  const band = doc.volume.pageBand;
  const useChapterPage = band === 'chapter-page' || (band === 'auto' && multiChapter);

  const frontSections = buildFrontMatterSections(doc);
  const chapterSections = doc.chapters.map((chapter) => buildChapterSection(doc, chapter, useChapterPage));

  const document = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_SIZE } },
        // Finding 4: Heading1/Heading2 are restyled to plain Times New
        // Roman 11pt, not bold, with no extra paragraph spacing - so using
        // them purely to drive the TableOfContents field (buildTocChildren)
        // doesn't disturb the format standard's plain-text typography (§8).
        heading1: {
          run: { font: FONT, size: BODY_SIZE, bold: false, color: '000000' },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
        heading2: {
          run: { font: FONT, size: BODY_SIZE, bold: false, color: '000000' },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [...frontSections, ...chapterSections],
  });

  return Packer.toBlob(document);
}
