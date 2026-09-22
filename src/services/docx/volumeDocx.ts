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
  ShadingType,
  WidthType,
  VerticalAlign,
  TabStopType,
  type ISectionOptions,
} from 'docx';
import type {
  Appendix,
  Block,
  Chapter,
  Figure,
  GlossaryEntry,
  Paragraph as VolParagraph,
  Run,
  Section,
  SubPara,
  VolumeDoc,
} from '@/lib/schemas/volume-schema';
import {
  correspondenceDesignator,
  paragraphDesignator,
  referenceDesignator,
  sectionDesignator,
  subParaDesignator,
} from '@/lib/volume/designators';
import {
  CHAPTER_CHANGE_POLICY_BOILERPLATE,
  dividerChangeRows,
  footerScheme,
  legendRuns,
  REFERENCES_SUMMARY_BOILERPLATE,
  runningHeadParts,
  styleBoilerplateRuns,
  titlePageChangeRows,
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
// Task 20: measured bold, 11pt on every page (title page, chapter divider,
// body pages alike) - supersedes the previous regular-12pt running head
// (task-20-report.md; mirrors volumeGenerator.ts's identical PDF fix).
const RUNNING_HEAD_SIZE = 22; // 11pt
const FOOTER_SIZE = 23; // 11.5pt
const TITLE_SIZE = 24; // 12pt, used for divider/title headings

// 36pt ladder steps, converted to twips (36pt * 20 = 720 twips per step).
const LADDER_STEP = 720;
type Level = 1 | 2 | 3 | 4;
function ladderIndent(level: Level): number {
  return (level - 1) * LADDER_STEP;
}

const BLUE = '0000FF';
// Task 20: the real Vol 17 PDF's "blue" literal text (the legend's styled
// hyperlink-description phrase, and the boilerplate's "blue font" phrase)
// paints a muted blue-gray, not the vivid pure blue used for change-tracked
// ("changed") text and real hyperlink runs - measured directly off the
// source PDF's non-stroking color (task-20-report.md; mirrors
// volumeGenerator.ts's TITLE_BLUE).
const TITLE_BLUE = '8496B0';
// Task 20: ~0.85 gray, matching the real title page's 3 blank change-table
// rows' shaded ORIGINATION DATE cells (task-20-report.md).
const SHADE_GRAY = 'D9D9D9';
// Task 21 finding 1: the real Vol 17 PDF underlines the running head's
// left-label/right-designator row with ONE 1.08pt-thick full-width rule, not
// two separate per-token underlines (re-measured directly against the PDF
// content stream: `re [72.024, 730.92, 467.5, 1.08] f*`, identical on every
// sampled page - see HEADER_RULE_THICKNESS_PT in volumeGenerator.ts for the
// PDF-side fix). DOCX has no direct equivalent of an overlay rule spanning
// two differently-aligned paragraphs, so `buildHeader` below combines the
// left label and the right-top designator into ONE paragraph (a left run,
// a tab, a right-tab-stopped run) and gives that single paragraph a bottom
// border instead - closer in spirit to the source's one shared rule than
// underlining each run separately. `size` is in eighths of a point per
// OOXML (`1.08pt * 8 ≈ 8.64`, rounded to the nearest achievable integer).
const HEADER_RULE_BORDER_SIZE = 9;
// The paragraph's own printable width (PAGE_WIDTH minus both margins) -
// the position of the header row's right tab stop, so the right-aligned
// designator lands flush with the right margin like the PDF's RIGHT_EDGE_X.
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

type ParaChild = TextRun | ExternalHyperlink;
type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

// ---------------------------------------------------------------------------
// Run / block helpers
// ---------------------------------------------------------------------------
/**
 * Task 20: generalized to also paint a plain (non-hyperlink) run's own
 * `bold`/`italic`/`underline`/`color` style hints (see the RunSchema doc
 * comment in lib/schemas/volume-schema.ts) - not just body content's
 * `changed`/`link` flags - so the same styled-run builders the PDF path
 * uses (legendRuns/styleBoilerplateRuns, lib/volume/layout.ts) can be
 * reused here verbatim instead of a parallel DOCX-only styling scheme.
 * `size` defaults to BODY_SIZE but front-matter headings pass TITLE_SIZE.
 */
function runToChildren(run: Run, size = BODY_SIZE): ParaChild[] {
  if (run.link && run.href) {
    return [
      new ExternalHyperlink({
        link: run.href,
        children: [
          new TextRun({
            text: run.text,
            font: FONT,
            size,
            color: BLUE,
            bold: true,
            italics: true,
            underline: {},
          }),
        ],
      }),
    ];
  }
  const color = run.changed ? BLUE : run.color === 'blue' ? TITLE_BLUE : undefined;
  return [
    new TextRun({
      text: run.text,
      font: FONT,
      size,
      color,
      bold: run.bold || undefined,
      italics: run.italic || undefined,
      // Task 24: the PDF path paints a thicker underline rule under BOLD
      // furniture text (title-page/divider headings, "CANCELLATION") than a
      // regular-weight underline - see volumeGenerator.ts's `ulBold`
      // handling for the measured provenance. DOCX has no equivalent knob:
      // `underline: {}` requests Word's default single-underline style, and
      // its actual stroke weight is rendered by Word itself (driven by the
      // font/size, not a value docx.js can set per-run) - there is nothing
      // to make heavier here. Left as the plain default for every run,
      // bold or not.
      underline: run.underline ? {} : undefined,
    }),
  ];
}

function runsToChildren(runs: Run[], size = BODY_SIZE): ParaChild[] {
  return runs.flatMap(r => runToChildren(r, size));
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
/**
 * Task 20: like `centered`, but for a line built from several styled
 * `Run`s (e.g. a bold/underlined heading, or the hyperlink legend's
 * regular/bold-italic/bold segments) via the same `runToChildren` that
 * `blocksToChildren` uses for body content.
 *
 * Task 23 fix 2: `indentTwips` narrows the paragraph's own left/right
 * indent, shrinking the box Word centers the text within - the DOCX mirror
 * of the PDF path's `centeredParagraphRuns(..., inset)` (lib/volume/
 * layout.ts). See `TITLE_BOILERPLATE_INSET_TWIPS`'s doc comment for the
 * measurement. Defaults to 0 (unindented, the prior behavior) for every
 * other caller.
 */
function centeredRunsPara(runs: Run[], size = BODY_SIZE, heading?: HeadingValue, indentTwips = 0): Paragraph {
  return new Paragraph({
    ...(heading ? { heading } : {}),
    alignment: AlignmentType.CENTER,
    ...(indentTwips ? { indent: { left: indentTwips, right: indentTwips } } : {}),
    children: runsToChildren(runs, size),
  });
}

/**
 * Task 23 fix 2: DOCX mirror of the PDF path's `TITLE_BOILERPLATE_INSET`
 * (lib/volume/layout.ts) - 11.7pt converted to twips (Word's indent unit,
 * 1/20pt): 11.7 * 20 = 234. Word centers a paragraph's text within its own
 * left/right-indented box, so indenting each side by this amount narrows the
 * wrap width the same way the PDF path's `wrapRuns` call does, keeping the
 * two renderers' word-wrap decisions in sync for the title page's centered
 * boilerplate/CANCELLATION paragraphs.
 */
const TITLE_BOILERPLATE_INSET_TWIPS = 234;
/**
 * Task 25 fix 5: DOCX mirror of the PDF path's `DIVIDER_BOILERPLATE_INSET`
 * (lib/volume/layout.ts) - 32.0pt converted to twips (32.0 * 20 = 640). See
 * that constant's doc comment for the measured provenance; the divider's
 * boilerplate text wraps narrower than the title page's own boilerplate.
 */
const DIVIDER_BOILERPLATE_INSET_TWIPS = 640;
function leftPara(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, font: FONT, size: BODY_SIZE })] });
}
function blankLine(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '', font: FONT, size: BODY_SIZE })] });
}
function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

/**
 * Task 20: boxes a run of paragraphs in one outer rectangle, mirroring the
 * real Vol 17 PDF's title-page/chapter-divider layout (the whole "VOLUME
 * {n} .. CANCELLATION" text block sits inside a bordered box - see BoxItem's
 * doc comment in lib/volume/layout.ts and task-20-report.md). DOCX has no
 * direct equivalent of an overlay rectangle spanning several paragraphs, so
 * this uses the standard Word technique of a single borderless-margin,
 * single-cell Table as the box - the caller follows it immediately with the
 * actual change-log Table (no blank paragraph between) so the two appear
 * as one attached grid, same as the PDF.
 */
function boxedBlock(children: Paragraph[]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border },
    rows: [
      new TableRow({
        children: [new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children })],
      }),
    ],
  });
}

function changeTable(headers: string[], rows: string[][], shading?: boolean[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
  // Task 21 finding 5 / Task 25 fix 1: real Vol 17 header cells are centered
  // per column, and data cells are centered too - INCLUDING column 0 (the
  // version/label column, e.g. "ORIGINAL VOLUME"): its measured x=79.9 was
  // originally read as left-hugging against an assumed 90pt-wide column, but
  // re-measured against the real grid-line rects, that column is only
  // 66.48pt wide and x=79.9 is exactly its centered position - see
  // volumeGenerator.ts's identical PDF fix for the full measurement.
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          borders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: h, bold: true, font: FONT, size: BODY_SIZE })],
            }),
          ],
        }),
    ),
  });
  const dataRows = rows.map(
    (row, ri) =>
      new TableRow({
        children: row.map(
          (cell, ci) =>
            new TableCell({
              borders,
              // Task 20: the 3 blank rows below the real title page's
              // ORIGINAL row shade their ORIGINATION DATE cell light gray
              // (see titlePageChangeRows, lib/volume/layout.ts).
              shading: shading?.[ri]?.[ci] ? { fill: SHADE_GRAY, type: ShadingType.CLEAR, color: 'auto' } : undefined,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: cell, font: FONT, size: BODY_SIZE })],
                }),
              ],
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
// so this generator uses one conservative box rather than measuring the
// image. UNLIKE the PDF path (which computes a scale from the image's real
// dimensions to fit this box while preserving aspect ratio - see
// volumeGenerator.ts's `paintItem`'s 'figure' case), docx's `ImageRun`
// transformation stretches the image to fill `FIGURE_BOX` exactly: an
// image whose aspect ratio doesn't match 450:300 (3:2) DISTORTS. Fixing
// that would need the same image-dimension-probing this comment says isn't
// available; this is a known, out-of-scope limitation of this wave (see
// task-19-report.md), not an oversight.
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
function isCorrespondence(block: Block): boolean {
  return block.ladder === 'correspondence';
}

/**
 * Finding 8: mirrors layout.ts's identical fix (see its doc comment on
 * layoutBodyBlocks for the full rationale). A Block flagged
 * `ladder: 'correspondence'` was accepted by the schema but had no
 * consumer, so an embedded verbatim document (format spec §2's
 * "Embedded-content ladder") rendered as plain, undesignated text merged
 * into the surrounding paragraph. Here, a contiguous run of correspondence
 * blocks gets its own depth-0 a./b./c.-designated Paragraph, one indent
 * level deeper than `level`; ordinary blocks are still merged together
 * into one plain Paragraph exactly as before.
 */
function bodyBlockParagraphs(blocks: Block[], level: Level): Paragraph[] {
  const out: Paragraph[] = [];
  let correspondenceSeq = 0;
  let plain: Block[] = [];
  const flushPlain = () => {
    if (plain.length === 0) return;
    out.push(new Paragraph({ indent: { left: 0, firstLine: 0 }, children: blocksToChildren(plain) }));
    plain = [];
  };
  for (const block of blocks) {
    if (isCorrespondence(block)) {
      flushPlain();
      correspondenceSeq += 1;
      const corrLevel = Math.min(level + 1, 4) as Level;
      out.push(designatedParagraph(correspondenceDesignator(0, correspondenceSeq), corrLevel, undefined, [block]));
    } else {
      correspondenceSeq = 0;
      plain.push(block);
    }
  }
  flushPlain();
  return out;
}

function subParaParagraphs(sub: SubPara, level: Level): Paragraph[] {
  const designator = subParaDesignator(sub.style, sub.seq);
  const firstBlock = sub.body[0];
  // Finding 8: a correspondence-ladder first block must NOT be merged onto
  // the sub-paragraph's own designator/title line - it gets its own
  // a./b./c. designator via bodyBlockParagraphs below.
  const mergeFirst = firstBlock !== undefined && !isCorrespondence(firstBlock);
  const firstBody = mergeFirst ? [firstBlock] : [];
  const restBlocks = mergeFirst ? sub.body.slice(1) : sub.body;
  const out: Paragraph[] = [
    designatedParagraph(designator, level, sub.title, firstBody),
    ...bodyBlockParagraphs(restBlocks, level),
  ];
  for (const child of sub.children) {
    const childLevel = Math.min(level + 1, 4) as Level;
    out.push(...subParaParagraphs(child, childLevel));
  }
  return out;
}

function paragraphParagraphs(chapterNumber: number, sectionSeq: number, para: VolParagraph): Paragraph[] {
  const designator = paragraphDesignator(chapterNumber, sectionSeq, para.seq);
  const firstBlock = para.body[0];
  // Finding 8: see subParaParagraphs's identical comment.
  const mergeFirst = firstBlock !== undefined && !isCorrespondence(firstBlock);
  const firstBody = mergeFirst ? [firstBlock] : [];
  const restBlocks = mergeFirst ? para.body.slice(1) : para.body;
  const out: Paragraph[] = [
    designatedParagraph(designator, 2, para.title, firstBody),
    ...bodyBlockParagraphs(restBlocks, 2),
  ];
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
    // Finding 8: honors any `correspondence`-ladder blocks in the section body.
    out.push(...bodyBlockParagraphs(section.body, 1));
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

function buildHeader(doc: VolumeDoc, band: LaidOutPage['band'], chapter?: number, appendix?: string): Header {
  const parts = runningHeadParts(doc, band, chapter, appendix);
  // Task 20: the whole running head is bold at 11pt (RUNNING_HEAD_SIZE -
  // see its doc comment). The center policy title and the date line are
  // bold but NOT underlined/ruled.
  //
  // Task 21 finding 1: the left label and the right-top designator now
  // share ONE paragraph (a left-aligned run, a tab, a right-tab-stopped
  // run) with a single bottom border on that paragraph, replacing the old
  // per-run underlines on two separately-aligned paragraphs - see
  // HEADER_RULE_BORDER_SIZE's doc comment for the measured provenance.
  return new Header({
    children: [
      centeredRunsPara([{ text: parts.center, bold: true }], RUNNING_HEAD_SIZE),
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: HEADER_RULE_BORDER_SIZE, color: '000000', space: 1 },
        },
        children: [
          new TextRun({ text: parts.left, font: FONT, size: RUNNING_HEAD_SIZE, bold: true }),
          new TextRun({ text: `\t${parts.rightTop}`, font: FONT, size: RUNNING_HEAD_SIZE, bold: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: parts.rightDate, font: FONT, size: RUNNING_HEAD_SIZE, bold: true })],
      }),
    ],
  });
}

function buildFooter(
  band: LaidOutPage['band'],
  opts: { chapter?: number; useChapterPage?: boolean; appendix?: string } = {},
): Footer {
  const scheme = footerScheme(band, opts);
  const children: TextRun[] = [];
  if (scheme.prefix) children.push(new TextRun({ text: scheme.prefix, font: FONT, size: FOOTER_SIZE }));
  children.push(new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: FOOTER_SIZE }));
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children })] });
}

// ---------------------------------------------------------------------------
// Front matter: title page, TOC field, references - each its OWN Word
// section (Finding 3), because each carries a different running-head left
// label and a different page-number band (roman front matter, roman
// continuing for the TOC, then "REF-{n}" references - mirroring
// lib/volume/layout.ts's layoutVolume: title+verso are roman i/ii, the TOC
// continues the same roman count right after them, and References are
// their OWN independent "REF-{n}" band placed after the TOC). Before this
// fix, ALL of front matter was one Word section with NO headers/footers at
// all.
//
// Task 24: reordered to TOC-then-References (was References-then-TOC) to
// match the real Vol 17 PDF's own front-matter order (fontmap.py: page
// index 0 = title/"i", index 1 = TOC/"ii", index 2 = References/"REF-1") -
// see layoutVolume's identical Task 24 comment for the full measurement.
// This also fixes the TOC section's roman-numeral continuation: since it no
// longer follows a section that restarts its OWN page-number counter at 1
// (References), the TOC's un-`start`ed `pageNumbers` now genuinely continues
// the physical page count from the title+verso section directly before it.
// ---------------------------------------------------------------------------
function buildTitlePageChildren(doc: VolumeDoc): (Paragraph | Table)[] {
  const v = doc.volume;
  const children: (Paragraph | Table)[] = [];

  // Task 20: the "VOLUME {n} .. CANCELLATION" block boxes together and
  // joins directly into the change table below it (see boxedBlock's doc
  // comment) - collected into its own array instead of pushed straight
  // onto `children`.
  const boxChildren: Paragraph[] = [];
  boxChildren.push(centeredRunsPara([{ text: `VOLUME ${v.number}`, bold: true }], TITLE_SIZE));
  boxChildren.push(blankLine());
  const titleText = v.titleQuoted !== false ? `"${v.title}"` : v.title;
  boxChildren.push(centeredRunsPara([{ text: titleText, bold: true, underline: true }], TITLE_SIZE));
  boxChildren.push(blankLine());
  boxChildren.push(centeredRunsPara([{ text: `SUMMARY OF VOLUME ${v.number} CHANGES`, bold: true }], TITLE_SIZE));
  boxChildren.push(blankLine());

  boxChildren.push(centeredRunsPara(legendRuns()));
  boxChildren.push(blankLine());

  // Task 21 finding 4: the real PDF centers every boilerplate paragraph
  // (Word centers each wrapped line on its own automatically via
  // `AlignmentType.CENTER`, so `centeredRunsPara` - already used for the
  // headings/legend above - is reused here instead of `leftParaRuns`). Only
  // the THIRD paragraph's "full revision" is underlined in the source - see
  // layout.ts's identical fix in layoutTitlePage for the measured evidence.
  VOLUME_CHANGE_POLICY_BOILERPLATE.forEach((line, i) => {
    if (i > 0) boxChildren.push(blankLine());
    const underlineFullRevision = i === VOLUME_CHANGE_POLICY_BOILERPLATE.length - 1;
    boxChildren.push(
      centeredRunsPara(styleBoilerplateRuns(line, { underlineFullRevision }), BODY_SIZE, undefined, TITLE_BOILERPLATE_INSET_TWIPS),
    );
  });

  if (v.cancellation) {
    boxChildren.push(blankLine());
    // Task 21 finding 4: measured centered (x=226.4, not the left margin) -
    // part of the same centered block as the boilerplate above it.
    boxChildren.push(
      centeredRunsPara(
        [{ text: 'CANCELLATION', bold: true, underline: true }, { text: `: ${v.cancellation}` }],
        BODY_SIZE,
        undefined,
        TITLE_BOILERPLATE_INSET_TWIPS,
      ),
    );
  }
  children.push(boxedBlock(boxChildren));

  // Finding 3 / Task 20: rows (dates formatted through the shared
  // formatDate, lib/volume/layout.ts) and gray-shading flags now come from
  // the shared titlePageChangeRows (also used by layout.ts's
  // layoutTitlePage), so the two generators can't drift.
  const { rows: changeRows, shading } = titlePageChangeRows(doc);
  children.push(
    changeTable(['VOLUME VERSION', 'SUMMARY OF CHANGE', 'ORIGINATION DATE', 'DATE OF CHANGES'], changeRows, shading),
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
  // Task 24: one blank line before the address block - see layout.ts's
  // identical fix in layoutTitlePage for the measured evidence (real Vol 17
  // PDF, page index 0: "Submit recommended changes..." to "CMC (JA)" is a
  // 25.3pt gap, one blank line; every subsequent address line steps by the
  // bare LEADING with no extra gap).
  children.push(blankLine());
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
  // Task 25 fix 2: bold - measured directly against the real Vol 17 PDF
  // (page index 2, y=691.4): "REFERENCES" extracts with a
  // `/TimesNewRomanPS-BoldMT` BaseFont - see layout.ts's identical PDF fix
  // in layoutReferences for the full measurement.
  children.push(centeredRunsPara([{ text: 'REFERENCES', bold: true }], TITLE_SIZE));
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
    // Task 21 finding 6: both title lines paint bold in the real PDF, and
    // "TABLE OF CONTENTS" is additionally underlined (measured at page
    // index 1, y=694.3/669.0) - previously plain here.
    centeredRunsPara([{ text: `VOLUME ${v.number}: ${v.title.toUpperCase()}`, bold: true }], TITLE_SIZE),
    // Task 24: one blank line between the two title lines - re-measured
    // directly against the real Vol 17 TOC page (fontmap.py, page index 1):
    // "VOLUME 17: ..." at y=694.3 down to "TABLE OF CONTENTS" at y=669.0 is
    // a 25.3pt gap (one blank line). See layout.ts's identical fix in
    // layoutToc for the PDF path's copy of this same measurement.
    blankLine(),
    centeredRunsPara([{ text: 'TABLE OF CONTENTS', bold: true, underline: true }], TITLE_SIZE),
    // Task 24: NO blank line here (was `blankLine()`, moved above) - the
    // real PDF's first entry ("REFERENCES") sits directly under "TABLE OF
    // CONTENTS" at only the ordinary single-line step (y=669.0 -> 656.4, a
    // 12.6pt gap), not a full blank line. The `TableOfContents` field below
    // is Word's own native field (its per-entry spacing comes from Word's
    // built-in TOC1/TOC2 paragraph styles, outside docx.js's control), so
    // this can only fix the gap ABOVE the field, not literally the field's
    // own first generated entry.
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

  const tocSection: ISectionOptions = {
    properties: {
      page: {
        ...pageGeometry,
        // Roman numerals CONTINUING the title/verso count - no `start`,
        // since OOXML page numbering continues from the previous section
        // unless a section explicitly restarts it. Task 24: this section now
        // directly follows `titleSection` (was preceded by `referencesSection`
        // restarting its own counter), so the continuation is genuinely from
        // the title+verso page count, not from whatever count References'
        // own restart left behind.
        pageNumbers: { formatType: docxNumberFormat(footerScheme('front').format) },
      },
    },
    headers: { default: buildHeader(doc, 'front') },
    footers: { default: buildFooter('front') },
    children: buildTocChildren(doc),
  };

  const referencesSection: ISectionOptions = {
    properties: {
      page: {
        ...pageGeometry,
        // "REF-{n}" band, its own independent counter restarting at 1.
        pageNumbers: { start: 1, formatType: docxNumberFormat(footerScheme('ref').format) },
      },
    },
    headers: { default: buildHeader(doc, 'ref') },
    footers: { default: buildFooter('ref') },
    children: buildReferencesChildren(doc),
  };

  // Task 24: TOC placed immediately after the title/verso section,
  // References placed after the TOC - see the ordering note above.
  return [titleSection, tocSection, referencesSection];
}

// ---------------------------------------------------------------------------
// Divider ("Summary of Substantive Changes") - shared by a chapter section
// and (Task 22) an appendix section. Mirrors lib/volume/layout.ts's
// layoutDivider refactor: the two differ only in the heading/title text,
// the title's quoting, and which changeLog feeds the table below.
// ---------------------------------------------------------------------------
type DocxDividerContext =
  | { kind: 'chapter'; chapter: Chapter }
  | { kind: 'appendix'; appendix: Appendix };

function buildDividerChildren(doc: VolumeDoc, ctx: DocxDividerContext): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  // Task 22: the appendix divider's heading prints TWO spaces after the
  // colon ("VOLUME 17:  APPENDIX A" - measured verbatim against the real
  // PDF, see layoutDivider's identical comment).
  //
  // Task 25 fix 3: quoting follows `doc.volume.titleQuoted` - the same flag
  // the title page uses - instead of hardcoding quotes on for the chapter
  // divider and off for the appendix divider. See layoutDivider's identical
  // fix in lib/volume/layout.ts for the measured provenance (Vol 17's real
  // chapter divider prints its title with no quote glyphs at all). Both
  // titles stay bold+underlined regardless of quoting.
  const quoted = doc.volume.titleQuoted !== false;
  const headingText = ctx.kind === 'chapter'
    ? `VOLUME ${doc.volume.number}: CHAPTER ${ctx.chapter.number}`
    : `VOLUME ${doc.volume.number}:  APPENDIX ${ctx.appendix.letter}`;
  const rawTitle = ctx.kind === 'chapter' ? ctx.chapter.title : ctx.appendix.title;
  const titleText = quoted ? `"${rawTitle.toUpperCase()}"` : rawTitle.toUpperCase();
  const changeLog = ctx.kind === 'chapter' ? ctx.chapter.changeLog : ctx.appendix.changeLog;

  // "Summary of Substantive Changes" box + change table. Task 20: same
  // bordered-box-then-table treatment as the title page (measured on the
  // real Vol 17 chapter divider page too - task-20-report.md) - see
  // boxedBlock's doc comment.
  const boxChildren: Paragraph[] = [];
  boxChildren.push(centeredRunsPara([{ text: headingText, bold: true }], TITLE_SIZE));
  boxChildren.push(blankLine());
  boxChildren.push(centeredRunsPara([{ text: titleText, bold: true, underline: true }], TITLE_SIZE));
  boxChildren.push(blankLine());
  boxChildren.push(centeredRunsPara([{ text: 'SUMMARY OF SUBSTANTIVE CHANGES', bold: true }], TITLE_SIZE));
  boxChildren.push(blankLine());
  boxChildren.push(centeredRunsPara(legendRuns()));
  boxChildren.push(blankLine());
  // Task 21 finding 4: centered, like the title page's boilerplate (see its
  // identical comment above) - measured on the divider too (x=112.9/104.7).
  // Underline scope unchanged: measured against the real PDF, the divider's
  // copy of the "...full revision..." sentence is NOT underlined, unlike
  // the title page's third paragraph (re-confirmed on the appendix divider
  // too - no underline rect near either boilerplate line).
  // Task 25 fix 5: wraps at `DIVIDER_BOILERPLATE_INSET_TWIPS` (narrower than
  // the title page's own `TITLE_BOILERPLATE_INSET_TWIPS`) - see that
  // constant's doc comment for the measured provenance.
  CHAPTER_CHANGE_POLICY_BOILERPLATE.forEach((line, i) => {
    if (i > 0) boxChildren.push(blankLine());
    boxChildren.push(
      centeredRunsPara(styleBoilerplateRuns(line, { underlineFullRevision: false }), BODY_SIZE, undefined, DIVIDER_BOILERPLATE_INSET_TWIPS),
    );
  });
  children.push(boxedBlock(boxChildren));
  children.push(
    changeTable(
      // Finding 15 (T10): format spec §4.6 verbatim header, with spaces
      // around the slash.
      ['CHAPTER VERSION', 'PAGE / PARAGRAPH', 'SUMMARY OF SUBSTANTIVE CHANGES', 'DATE OF CHANGE'],
      // Task 25 fix 4: 4 blank, unshaded template rows below whatever real
      // changeLog rows exist - see `dividerChangeRows`'s doc comment
      // (lib/volume/layout.ts) for the measured provenance.
      dividerChangeRows(changeLog),
    ),
  );

  return children;
}

/**
 * Task 22: a borderless two-column table for an appendix's glossary
 * (term/definition rows) - the DOCX structural equivalent of layout.ts's
 * `addGlossaryEntry` two-column line items. Word wraps each cell's own
 * text; no fixed x-coordinates are needed here the way the PDF path needs
 * GLOSSARY_TERM_X/GLOSSARY_DEF_X.
 */
function glossaryTable(entries: GlossaryEntry[]): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const borders = {
    top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
    insideHorizontal: noBorder, insideVertical: noBorder,
  };
  const rows = entries.map(
    (entry) =>
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: entry.term, font: FONT, size: BODY_SIZE })] })],
          }),
          new TableCell({
            borders,
            width: { size: 80, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: entry.definition, font: FONT, size: BODY_SIZE })] })],
          }),
        ],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows });
}

// ---------------------------------------------------------------------------
// Chapter section: divider, chapter title, body, own headers/footers.
// ---------------------------------------------------------------------------
function buildChapterSection(doc: VolumeDoc, chapter: Chapter, useChapterPage: boolean): ISectionOptions {
  const children: (Paragraph | Table)[] = [];

  children.push(...buildDividerChildren(doc, { kind: 'chapter', chapter }));

  // Chapter title page. Combined into ONE heading paragraph carrying
  // HeadingLevel.HEADING_1 (Finding 4) so Word's TOC field (buildTocChildren
  // above) finds a chapter entry - previously two plain centered lines with
  // no heading style at all. Task 20: measured bold on the real chapter
  // title page (task-20-report.md) - the run's own `bold: true` overrides
  // the Heading1 style's `bold: false` default (set below in
  // generateVolumeDocx, for the TOC field's sake) the same way direct
  // formatting always wins over paragraph style in OOXML.
  children.push(pageBreak());
  children.push(
    centeredRunsPara(
      [{ text: `CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}`, bold: true }],
      TITLE_SIZE,
      HeadingLevel.HEADING_1,
    ),
  );
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
// Appendix section: divider (shared buildDividerChildren), "APPENDIX {L}" +
// title, body blocks and/or glossary, own headers/footers on its own
// letter-prefixed page-number band ("A-1", "A-2", ...).
// ---------------------------------------------------------------------------
function buildAppendixSection(doc: VolumeDoc, appendix: Appendix): ISectionOptions {
  const children: (Paragraph | Table)[] = [];

  children.push(...buildDividerChildren(doc, { kind: 'appendix', appendix }));

  // Content: "APPENDIX {L}" (bold, no underline - matches a chapter title
  // page's "CHAPTER {m}") then the title. Task 22: measured against the
  // real Vol 17 Appendix A content page, the title prints REGULAR weight
  // (not bold, unlike the divider's title) with an underline - it carries
  // Heading1 so Word's TableOfContents field (headingStyleRange '1-2',
  // buildTocChildren) picks it up as a top-level entry, same as a chapter's
  // combined "CHAPTER N: TITLE" line.
  children.push(pageBreak());
  children.push(centeredRunsPara([{ text: `APPENDIX ${appendix.letter}`, bold: true }], TITLE_SIZE));
  children.push(
    centeredRunsPara(
      [{ text: appendix.title.toUpperCase(), underline: true }],
      BODY_SIZE,
      HeadingLevel.HEADING_1,
    ),
  );
  children.push(blankLine());

  if (appendix.blocks.length > 0) {
    children.push(...bodyBlockParagraphs(appendix.blocks, 1));
    children.push(blankLine());
  }
  if (appendix.glossary && appendix.glossary.length > 0) {
    children.push(glossaryTable(appendix.glossary));
  }

  return {
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        // "{L}-1", "{L}-2", ... restarts at 1 for each appendix section,
        // mirroring the PDF's per-appendix page counter (lib/volume/
        // page-bands.ts appendixPageLabel).
        pageNumbers: { start: 1 },
      },
    },
    headers: { default: buildHeader(doc, 'appendix', undefined, appendix.letter) },
    footers: { default: buildFooter('appendix', { appendix: appendix.letter }) },
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
  const appendixSections = doc.appendices.map((appendix) => buildAppendixSection(doc, appendix));

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
    sections: [...frontSections, ...chapterSections, ...appendixSections],
  });

  return Packer.toBlob(document);
}
