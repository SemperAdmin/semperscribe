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
  }),
  changeLog: z.array(z.object({
    version: z.string(), summary: z.string(),
    originationDate: z.string(), dateOfChanges: z.string(),
  })).default([]),
  references: z.array(z.object({ text: z.string(), order: z.number().optional() })).default([]),
  chapters: z.array(ChapterSchema).default([]),
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
export type VolumeDoc = z.infer<typeof VolumeSchema>;
export type OrderMeta = VolumeDoc['order'];
export type VolumeMeta = VolumeDoc['volume'];
export type ChangeRow = VolumeDoc['changeLog'][number];
