import { z } from 'zod';

const RunSchema = z.object({
  text: z.string(),
  changed: z.boolean().optional(),
  link: z.boolean().optional(),
  href: z.string().optional(),
  // Task 20: style hints for synthetic front-matter/divider runs (title-page
  // headings, the hyperlink legend, and the fixed boilerplate's literal
  // styled phrases - see lib/volume/layout.ts's legendRuns/
  // styleBoilerplateRuns) - measured directly against the real Vol 17 PDF
  // (task-20-report.md). Real document content never sets these; they exist
  // so layout.ts/volumeDocx.ts can express "this literal run is bold/
  // italic/underlined/blue" without inventing a parallel run type.
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z.enum(['blue']).optional(),
});
const BlockSchema = z.object({
  runs: z.array(RunSchema),
  ladder: z.enum(['structural', 'correspondence']).optional(),
});
const SubParaSchema: z.ZodType<SubPara> = z.lazy(() =>
  z.object({
    seq: z.number().int().positive(),
    style: z.enum(['upper', 'arabic']),
    title: z.string().optional(),
    body: z.array(BlockSchema),
    children: z.array(SubParaSchema).default([]),
  }),
);
const ParagraphSchema = z.object({
  seq: z.number().int().positive(),
  title: z.string(),
  body: z.array(BlockSchema),
  children: z.array(SubParaSchema).default([]),
});
const SectionSchema = z.object({
  seq: z.number().int().positive(),
  title: z.string(),
  body: z.array(BlockSchema).optional(),
  paragraphs: z.array(ParagraphSchema).default([]),
});
const FigureSchema = z.object({
  number: z.number().int().positive(),
  caption: z.string(),
  image: z.string(),               // data URL / asset ref
  legend: z.array(z.string()).optional(),
  anchor: z.string().optional(),
});
const ChapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  changeLog: z.array(z.object({
    version: z.string(), pageParagraph: z.string(),
    summary: z.string(), dateOfChange: z.string(),
  })).default([]),
  sections: z.array(SectionSchema).default([]),
  figures: z.array(FigureSchema).default([]),
});
const GlossaryEntrySchema = z.object({ term: z.string(), definition: z.string() });
/**
 * Task 22: an appendix (e.g. Vol 17's Appendix A, "GLOSSARY OF ACRONYMS AND
 * ABBREVIATIONS") - its own divider ("Summary of Substantive Changes", same
 * shape as a chapter's) plus content page(s). Content is either/both plain
 * body `blocks` (flush-left, no CCSSPP designators - an appendix isn't part
 * of the volume's structural numbering) and/or a two-column `glossary`
 * (term/definition rows) - Vol 17's own Appendix A is glossary-only, but the
 * schema doesn't force that shape on every future appendix.
 */
const AppendixSchema = z.object({
  letter: z.string(),
  title: z.string(),
  changeLog: z.array(z.object({
    version: z.string(), pageParagraph: z.string(),
    summary: z.string(), dateOfChange: z.string(),
  })).default([]),
  blocks: z.array(BlockSchema).default([]),
  glossary: z.array(GlossaryEntrySchema).optional(),
});

export const VolumeSchema = z.object({
  documentType: z.literal('volume'),
  order: z.object({
    designator: z.string(),
    policyTitle: z.string(),
    sponsorCode: z.string(),
  }),
  volume: z.object({
    number: z.number().int().positive(),
    title: z.string(),
    titleQuoted: z.boolean().optional(),
    originalPublicationDate: z.string(),
    lastUpdatedDate: z.string(),
    distribution: z.object({
      kind: z.enum(['statementA', 'pcn']),
      value: z.string().optional(),
    }),
    submitChangesTo: z.string(),
    cancellation: z.string().optional(),
    reportRequired: z.boolean().optional(),
    sectionPeriod: z.boolean().default(false),
    pageBand: z.enum(['auto', 'chapter-page', 'sequential']).default('auto'),
    // Task 26: the second "REFERENCES" page (quoted heading + boilerplate
    // about annotating changes) after the reference list is opt-in per
    // volume - the real Vol 1 PDF has it, the real Vol 17 PDF does not (only
    // the list). Default true = Vol 1's canonical shape, so existing docs
    // (and any doc built without this field) render exactly as before.
    // User ruling 2026-09-21: flag-controlled, opt-in.
    referencesSummaryPage: z.boolean().default(true),
  }),
  changeLog: z.array(z.object({
    version: z.string(), summary: z.string(),
    originationDate: z.string(), dateOfChanges: z.string(),
  })).default([]),
  references: z.array(z.object({ text: z.string(), order: z.number().optional() })).default([]),
  chapters: z.array(ChapterSchema).default([]),
  appendices: z.array(AppendixSchema).default([]),
});

export type Run = z.infer<typeof RunSchema>;
export type Block = z.infer<typeof BlockSchema>;
export interface SubPara {
  seq: number; style: 'upper' | 'arabic';
  title?: string; body: Block[]; children: SubPara[];
}
export type Paragraph = z.infer<typeof ParagraphSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Figure = z.infer<typeof FigureSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
export type Appendix = z.infer<typeof AppendixSchema>;
export type VolumeDoc = z.infer<typeof VolumeSchema>;
export type OrderMeta = VolumeDoc['order'];
export type VolumeMeta = VolumeDoc['volume'];
export type ChangeRow = VolumeDoc['changeLog'][number];
