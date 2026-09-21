# Volume (Formatted Directive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new **Volume** directive document type that authors and renders a paginated, multi-chapter policy volume to PDF and DOCX at full fidelity.

**Architecture:** A self-contained subsystem beside the existing letter pipeline: a Zod-validated `VolumeDoc` tree, a fixed-36pt indentation engine, a two-pass PDF generator, a section-per-chapter DOCX generator, and a dedicated tree-editor UI. It registers in the existing `DOCUMENT_TYPES` registry under the `directives` category and plugs into the existing PDF/DOCX export plumbing without touching the letter path.

**Tech Stack:** TypeScript, Next.js 16, React, Zod, pdf-lib (PDF), `docx` (DOCX), Zustand store, Vitest (unit + golden), pypdf (golden coordinate extraction, already used to measure the source).

**Spec:** `docs/superpowers/specs/2026-09-20-volume-directive-design.md` (layout standard: `docs/engineering/LSAM_VOLUME_FORMAT_SPEC.md`)

## Global Constraints

- Page geometry (from format spec §3.1, verbatim): US Letter **612 × 792 pt**; margins **72 pt** all sides; body **11 pt**, running head **12 pt**, footer **11.5 pt**; body leading **12.6 pt**; inter-paragraph gap **~25 pt**.
- Indent ladder: designator columns **72 / 108 / 144 / 180 pt** (L1–L4); text begins **36 pt** right of its designator; **run-over lines return to x = 72**.
- Headings: **regular weight, no bold, no underline**; distinction is case + indent only. Section = ALL CAPS; paragraph/sub-para = Title Case.
- Page-number bands: front matter lower-roman (`i`); references `REF-{n}`; body `{M}-{page}` (multi-chapter) or bare sequential (single-chapter), selected by `volume.pageBand: 'auto'`.
- Numbering: `CCSS` section (period only when `sectionPeriod`), `CCSSPP.` paragraph, `A.` upper sub-para, `1.` arabic sub-sub; embedded blocks use `a.`/`(1)`/`(a)`; references use `(a)…(aa)`.
- Fonts: use `SERIF_EM_WIDTHS` from `src/lib/font-metrics.ts` (width = emWidth × sizePt) for all measurement so PDF and DOCX align.
- Do **not** modify the standard letter pipeline, `NavalLetterPDF`, or existing `docx-generator` letter branches. New type only.
- Test commands: unit `npm run test`, golden `npm run test:golden`, types `npm run typecheck`, lint `npm run lint`.
- Commit after every task. Branch is `claude/mco-5800-16-format-structure-b35823` (do not touch main).

---

## File Structure

**New:**
- `src/lib/schemas/volume-schema.ts` — Zod `VolumeDoc` model + TS types.
- `src/lib/volume/designators.ts` — designator string generation (all ladders).
- `src/lib/volume/volume-indent.ts` — 36 pt ladder → indent spec.
- `src/lib/volume/page-bands.ts` — page-number band computation.
- `src/lib/volume/measure.ts` — line-wrap width measurement via `SERIF_EM_WIDTHS`.
- `src/lib/volume/layout.ts` — pass-1 pagination (tree → pages + TOC targets).
- `src/services/pdf/volumeGenerator.ts` — pass-2 PDF paint.
- `src/services/docx/volumeDocx.ts` — DOCX builder.
- `src/lib/templates/volume.ts` — starter templates.
- `src/components/volume/VolumeEditor.tsx` (+ `MetaPanel.tsx`, `ChapterTree.tsx`, `BlockEditor.tsx`) — authoring UI.
- `tests/volume/*.test.ts` — unit tests.
- `tests/golden/volume/*.test.ts` + `tests/golden/volume/fixtures/*.json` — golden coordinate tests + Vol 6 / Vol 16 fixtures.
- `tests/golden/volume/measure-pdf.mjs` — pypdf coordinate extractor.

**Modified:**
- `src/lib/schemas.ts` — register `VolumeDefinition`; add `'volume'` to `PdfPipeline`.
- `src/services/export/pdfPipelineService.ts` — `PIPELINE_MAP.volume`.
- `src/lib/docx-generator.ts` — `volume` branch delegating to `volumeDocx`.
- `src/lib/heading-policy.ts` — `volume` heading entry (no bold/underline).
- `src/lib/nldp-format.ts` — v1.2 optional `volume` payload.
- `src/store/*` — volume slice.
- Document layout wiring — mount `VolumeEditor` when `documentType === 'volume'`.

---

## Task 1: Volume schema & types

**Files:**
- Create: `src/lib/schemas/volume-schema.ts`
- Test: `tests/volume/schema.test.ts`

**Interfaces:**
- Produces: `VolumeSchema` (Zod), and types `VolumeDoc`, `Chapter`, `Section`, `Paragraph`, `SubPara`, `Block`, `Run`, `Figure`, `VolumeMeta`, `OrderMeta`, `ChangeRow`. `Run = { text: string; changed?: boolean; link?: boolean; href?: string }`. `Block = { runs: Run[]; ladder?: 'structural' | 'correspondence' }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/schema.test.ts
import { describe, it, expect } from 'vitest';
import { VolumeSchema, type VolumeDoc } from '@/lib/schemas/volume-schema';

const minimal: VolumeDoc = {
  documentType: 'volume',
  order: { designator: 'MCO 5800.16', policyTitle: 'LSAM', sponsorCode: 'JA' },
  volume: {
    number: 1, title: 'LEGAL SUPPORT', titleQuoted: true,
    originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20',
    distribution: { kind: 'statementA' }, submitChangesTo: 'CMC (JA)',
    sectionPeriod: false, pageBand: 'auto',
  },
  changeLog: [], references: [],
  chapters: [{
    number: 1, title: 'STAFF JUDGE ADVOCATE', changeLog: [],
    sections: [{ seq: 1, title: 'GENERAL ROLES', paragraphs: [] }],
    figures: [],
  }],
};

describe('VolumeSchema', () => {
  it('accepts a minimal valid volume', () => {
    expect(VolumeSchema.parse(minimal)).toBeTruthy();
  });
  it('rejects a wrong documentType', () => {
    expect(() => VolumeSchema.parse({ ...minimal, documentType: 'mco' })).toThrow();
  });
  it('defaults pageBand to auto and sectionPeriod to false', () => {
    const { volume, ...rest } = minimal;
    const noDefaults = { ...rest, volume: { ...volume } };
    delete (noDefaults.volume as Record<string, unknown>).pageBand;
    delete (noDefaults.volume as Record<string, unknown>).sectionPeriod;
    const parsed = VolumeSchema.parse(noDefaults);
    expect(parsed.volume.pageBand).toBe('auto');
    expect(parsed.volume.sectionPeriod).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/schema.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/schemas/volume-schema.ts
import { z } from 'zod';

const RunSchema = z.object({
  text: z.string(),
  changed: z.boolean().optional(),
  link: z.boolean().optional(),
  href: z.string().optional(),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/volume-schema.ts tests/volume/schema.test.ts
git commit -m "feat(volume): add VolumeDoc Zod schema and types"
```

---

## Task 2: Designator generation

**Files:**
- Create: `src/lib/volume/designators.ts`
- Test: `tests/volume/designators.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `sectionDesignator(chapter: number, sectionSeq: number, period: boolean): string`; `paragraphDesignator(chapter: number, sectionSeq: number, paraSeq: number): string`; `subParaDesignator(style: 'upper' | 'arabic', seq: number): string`; `correspondenceDesignator(depth: number, seq: number): string`; `referenceDesignator(index: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/designators.test.ts
import { describe, it, expect } from 'vitest';
import {
  sectionDesignator, paragraphDesignator, subParaDesignator,
  correspondenceDesignator, referenceDesignator,
} from '@/lib/volume/designators';

describe('designators', () => {
  it('formats section CCSS zero-padded, no period by default', () => {
    expect(sectionDesignator(1, 3, false)).toBe('0103');
    expect(sectionDesignator(17, 3, true)).toBe('1703.');
  });
  it('formats paragraph CCSSPP.', () => {
    expect(paragraphDesignator(1, 3, 1)).toBe('010301.');
    expect(paragraphDesignator(10, 2, 12)).toBe('100212.');
  });
  it('formats sub-para upper then arabic', () => {
    expect(subParaDesignator('upper', 1)).toBe('A.');
    expect(subParaDesignator('upper', 27)).toBe('AA.');
    expect(subParaDesignator('arabic', 3)).toBe('3.');
  });
  it('formats correspondence ladder a. (1) (a)', () => {
    expect(correspondenceDesignator(0, 1)).toBe('a.');
    expect(correspondenceDesignator(1, 1)).toBe('(1)');
    expect(correspondenceDesignator(2, 1)).toBe('(a)');
  });
  it('formats reference designator continuing past z', () => {
    expect(referenceDesignator(0)).toBe('(a)');
    expect(referenceDesignator(26)).toBe('(aa)');
    expect(referenceDesignator(27)).toBe('(bb)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/designators.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/volume/designators.ts
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 1 -> "A", 26 -> "Z", 27 -> "AA" (repeated-letter style used by refs). */
function repeatedAlpha(seq: number): string {
  const letter = String.fromCharCode(97 + ((seq - 1) % 26));
  const count = Math.floor((seq - 1) / 26) + 1;
  return letter.repeat(count);
}
/** 1 -> "a", 26 -> "z", 27 -> "aa", 28 -> "ab" (spreadsheet style). */
function spreadsheetAlpha(seq: number): string {
  let s = ''; let n = seq;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(97 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function sectionDesignator(chapter: number, sectionSeq: number, period: boolean): string {
  return `${pad2(chapter)}${pad2(sectionSeq)}${period ? '.' : ''}`;
}
export function paragraphDesignator(chapter: number, sectionSeq: number, paraSeq: number): string {
  return `${pad2(chapter)}${pad2(sectionSeq)}${pad2(paraSeq)}.`;
}
export function subParaDesignator(style: 'upper' | 'arabic', seq: number): string {
  if (style === 'arabic') return `${seq}.`;
  return `${repeatedAlpha(seq).toUpperCase()}.`;
}
/** depth 0 = a., depth 1 = (1), depth 2 = (a), depth 3 = (i-style not used) */
export function correspondenceDesignator(depth: number, seq: number): string {
  switch (depth) {
    case 0: return `${spreadsheetAlpha(seq)}.`;
    case 1: return `(${seq})`;
    default: return `(${spreadsheetAlpha(seq)})`;
  }
}
/** References use repeated-letter parens: (a) … (z) (aa) (bb). index is 0-based. */
export function referenceDesignator(index: number): string {
  return `(${repeatedAlpha(index + 1)})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/designators.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/designators.ts tests/volume/designators.test.ts
git commit -m "feat(volume): add designator generation for all ladders"
```

---

## Task 3: Indent engine (36 pt ladder)

**Files:**
- Create: `src/lib/volume/volume-indent.ts`
- Test: `tests/volume/volume-indent.test.ts`

**Interfaces:**
- Consumes: nothing (constants only).
- Produces: `LEFT_MARGIN_PT = 72`, `LADDER_STEP_PT = 36`; `designatorX(level: 1 | 2 | 3 | 4): number`; `textStartX(level, designator: string, sizePt?: number): number`; `RUNOVER_X = 72`. Levels: 1=section, 2=paragraph, 3=sub-para(A.), 4=sub-sub(1.).

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/volume-indent.test.ts
import { describe, it, expect } from 'vitest';
import { designatorX, textStartX, LEFT_MARGIN_PT, RUNOVER_X } from '@/lib/volume/volume-indent';

describe('volume indent', () => {
  it('places designators on the 36pt ladder', () => {
    expect(designatorX(1)).toBe(72);
    expect(designatorX(2)).toBe(108);
    expect(designatorX(3)).toBe(144);
    expect(designatorX(4)).toBe(180);
  });
  it('starts short designators text 36pt right', () => {
    // "A." at level 3 -> text at 180
    expect(textStartX(3, 'A.')).toBe(180);
    // "1." at level 4 -> text at 216
    expect(textStartX(4, '1.')).toBe(216);
  });
  it('pushes text past a wide paragraph token', () => {
    // "010301." is wider than one 36pt step; text lands beyond 144
    expect(textStartX(2, '010301.')).toBeGreaterThan(140);
    expect(textStartX(2, '010301.')).toBeLessThan(160);
  });
  it('run-over returns to the left margin', () => {
    expect(RUNOVER_X).toBe(LEFT_MARGIN_PT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/volume-indent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/volume/volume-indent.ts
import { SERIF_EM_WIDTHS } from '@/lib/font-metrics';

export const LEFT_MARGIN_PT = 72;
export const LADDER_STEP_PT = 36;
export const RUNOVER_X = LEFT_MARGIN_PT;
const DEFAULT_SIZE = 11;

export function designatorX(level: 1 | 2 | 3 | 4): number {
  return LEFT_MARGIN_PT + (level - 1) * LADDER_STEP_PT;
}

function textWidthPt(s: string, sizePt: number): number {
  let em = 0;
  for (const ch of s) em += SERIF_EM_WIDTHS[ch] ?? 0.5;
  return em * sizePt;
}

/**
 * Text starts at the next 36pt stop after the designator, i.e. at the
 * designator column + one step, unless the designator itself is wider
 * than a step (the 6-digit paragraph token), in which case text starts
 * just past the token plus two spaces.
 */
export function textStartX(level: 1 | 2 | 3 | 4, designator: string, sizePt = DEFAULT_SIZE): number {
  const start = designatorX(level);
  const oneStop = start + LADDER_STEP_PT;
  const spaceW = (SERIF_EM_WIDTHS[' '] ?? 0.25) * sizePt;
  const afterToken = start + textWidthPt(designator, sizePt) + 2 * spaceW;
  return Math.max(oneStop, afterToken);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/volume-indent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/volume-indent.ts tests/volume/volume-indent.test.ts
git commit -m "feat(volume): add 36pt ladder indent engine"
```

---

## Task 4: Page-number bands

**Files:**
- Create: `src/lib/volume/page-bands.ts`
- Test: `tests/volume/page-bands.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toRoman(n: number): string`; `bodyPageLabel(opts: { chapter: number; page: number; multiChapter: boolean; band: 'auto' | 'chapter-page' | 'sequential' }): string`; `refPageLabel(n: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/page-bands.test.ts
import { describe, it, expect } from 'vitest';
import { toRoman, bodyPageLabel, refPageLabel } from '@/lib/volume/page-bands';

describe('page bands', () => {
  it('lower-roman front matter', () => {
    expect(toRoman(1)).toBe('i');
    expect(toRoman(4)).toBe('iv');
  });
  it('references band', () => {
    expect(refPageLabel(1)).toBe('REF-1');
  });
  it('auto: chapter-page when multi-chapter', () => {
    expect(bodyPageLabel({ chapter: 1, page: 3, multiChapter: true, band: 'auto' })).toBe('1-3');
  });
  it('auto: sequential when single-chapter', () => {
    expect(bodyPageLabel({ chapter: 1, page: 4, multiChapter: false, band: 'auto' })).toBe('4');
  });
  it('explicit band overrides auto', () => {
    expect(bodyPageLabel({ chapter: 2, page: 7, multiChapter: false, band: 'chapter-page' })).toBe('2-7');
    expect(bodyPageLabel({ chapter: 2, page: 7, multiChapter: true, band: 'sequential' })).toBe('7');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/page-bands.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/volume/page-bands.ts
const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];
export function toRoman(n: number): string {
  let out = ''; let v = n;
  for (const [num, sym] of ROMAN) { while (v >= num) { out += sym; v -= num; } }
  return out;
}
export function refPageLabel(n: number): string { return `REF-${n}`; }

export function bodyPageLabel(opts: {
  chapter: number; page: number; multiChapter: boolean;
  band: 'auto' | 'chapter-page' | 'sequential';
}): string {
  const useChapterPage =
    opts.band === 'chapter-page' || (opts.band === 'auto' && opts.multiChapter);
  return useChapterPage ? `${opts.chapter}-${opts.page}` : `${opts.page}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/page-bands.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/page-bands.ts tests/volume/page-bands.test.ts
git commit -m "feat(volume): add page-number band computation"
```

---

## Task 5: Line-wrap measurement

**Files:**
- Create: `src/lib/volume/measure.ts`
- Test: `tests/volume/measure.test.ts`

**Interfaces:**
- Consumes: `SERIF_EM_WIDTHS`.
- Produces: `measureText(s: string, sizePt: number): number`; `wrapRuns(runs: Run[], firstLineX: number, runoverX: number, rightEdgeX: number, sizePt: number): WrappedLine[]` where `WrappedLine = { segments: { text: string; run: Run }[]; x: number }` and `x` is the line's left start (first line vs run-over). Word-level greedy wrap; a word keeps its owning `Run` so blue/link styling survives wrapping.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/measure.test.ts
import { describe, it, expect } from 'vitest';
import { measureText, wrapRuns } from '@/lib/volume/measure';

describe('measure', () => {
  it('measures width as sum of em widths x size', () => {
    // 5 digits at 0.5 em, 11pt = 5 * 0.5 * 11 = 27.5
    expect(measureText('12345', 11)).toBeCloseTo(27.5, 3);
  });
  it('wraps first line at firstLineX and run-over at runoverX', () => {
    const runs = [{ text: 'alpha beta gamma delta epsilon zeta eta theta' }];
    const lines = wrapRuns(runs, 144, 72, 540, 11);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].x).toBe(144);
    expect(lines[1].x).toBe(72);
  });
  it('keeps each segment tied to its source run', () => {
    const runs = [{ text: 'plain ', }, { text: 'changed', changed: true }];
    const lines = wrapRuns(runs, 72, 72, 540, 11);
    const flagged = lines.flatMap(l => l.segments).find(s => s.run.changed);
    expect(flagged?.text).toContain('changed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/measure.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/volume/measure.ts
import { SERIF_EM_WIDTHS } from '@/lib/font-metrics';
import type { Run } from '@/lib/schemas/volume-schema';

export function measureText(s: string, sizePt: number): number {
  let em = 0;
  for (const ch of s) em += SERIF_EM_WIDTHS[ch] ?? 0.5;
  return em * sizePt;
}

export interface WrappedSegment { text: string; run: Run }
export interface WrappedLine { segments: WrappedSegment[]; x: number }

export function wrapRuns(
  runs: Run[], firstLineX: number, runoverX: number, rightEdgeX: number, sizePt: number,
): WrappedLine[] {
  // Tokenize into words, each carrying its owning run (preserve trailing space).
  const words: { text: string; run: Run }[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\s+)/).filter(p => p.length > 0);
    for (const p of parts) words.push({ text: p, run });
  }
  const lines: WrappedLine[] = [];
  let curX = firstLineX;
  let line: WrappedSegment[] = [];
  let used = curX;
  const pushLine = () => { lines.push({ segments: line, x: curX }); line = []; };
  for (const w of words) {
    const isSpace = /^\s+$/.test(w.text);
    const wWidth = measureText(w.text, sizePt);
    if (!isSpace && used + wWidth > rightEdgeX && line.length > 0) {
      pushLine();
      curX = runoverX; used = curX;
      // drop a leading space at the start of a wrapped line
      if (isSpace) continue;
    }
    line.push({ text: w.text, run: w.run });
    used += wWidth;
  }
  if (line.length > 0) pushLine();
  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/measure.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/measure.ts tests/volume/measure.test.ts
git commit -m "feat(volume): add run-aware line-wrap measurement"
```

---

## Task 6: Type registration & picker entry

**Files:**
- Modify: `src/lib/schemas.ts` (add `'volume'` to `PdfPipeline`; add `VolumeDefinition`; register in `DOCUMENT_TYPES` between `bulletin` and the SECNAV entries)
- Modify: `src/lib/heading-policy.ts` (add `volume` — no bold, no uppercase, no underline)
- Test: `tests/volume/registration.test.ts`

**Interfaces:**
- Consumes: `VolumeSchema` (Task 1).
- Produces: `DOCUMENT_TYPES.volume: DocumentTypeDefinition` with `features.category === 'directives'`, `features.pdfPipeline === 'volume'`, `features.exportFormats === ['pdf','docx']`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/registration.test.ts
import { describe, it, expect } from 'vitest';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { pickerOptions } from '@/lib/document-type-options';
import { getHeadingStyle } from '@/lib/heading-policy';

describe('volume registration', () => {
  it('registers under directives with the volume pipeline', () => {
    const v = DOCUMENT_TYPES.volume;
    expect(v).toBeTruthy();
    expect(v.features.category).toBe('directives');
    expect(v.features.pdfPipeline).toBe('volume');
    expect(v.features.exportFormats).toEqual(['pdf', 'docx']);
  });
  it('appears in the picker labeled "Volume"', () => {
    const keys = pickerOptions().map(o => o.key);
    expect(keys).toContain('volume');
    expect(pickerOptions().find(o => o.key === 'volume')?.name).toBe('Volume');
  });
  it('uses regular-weight, non-underlined headings', () => {
    const style = getHeadingStyle('volume');
    expect(style.bold).toBe(false);
    expect(style.underline).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/registration.test.ts`
Expected: FAIL (`DOCUMENT_TYPES.volume` undefined).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/schemas.ts`:
1. Extend the union: `export type PdfPipeline = 'standard' | ... | 'coordination-page' | 'volume';`
2. Add the definition (place near the other directive definitions):

```ts
import { VolumeSchema } from '@/lib/schemas/volume-schema';

export const VolumeDefinition: DocumentTypeDefinition = {
  id: 'volume',
  name: 'Volume',
  description: 'A paginated, multi-chapter policy volume (formatted directive).',
  icon: '📚',
  schema: VolumeSchema,
  sections: [], // authored by the dedicated VolumeEditor, not DynamicForm
  features: {
    showHeaderSettings: false, showFontSelector: false, showUnitInfo: false,
    showEndorsementDetails: false, showDirectiveTitle: false, showVia: false,
    showReferences: true, showEnclosures: false, showDistribution: true,
    showReports: false, showParagraphs: false, showClosingBlock: false,
    showMOAForm: false, showSignature: false, showDecisionGrid: false,
    showCoordinationTable: false, showClassification: true,
    isAMHS: false, isDirective: true, showMultipleTo: false, showToDistribution: false,
    category: 'directives', exportFormats: ['pdf', 'docx'], pdfPipeline: 'volume',
  },
};
```
3. Register between `bulletin` and the SECNAV entries in the `DOCUMENT_TYPES` literal:

```ts
  bulletin: BulletinDefinition,
  volume: VolumeDefinition,
  // ...SECNAV instruction / notice entries follow
```

In `src/lib/heading-policy.ts`, add `'volume'` to both `NO_BOLD` and `NO_UPPERCASE` arrays so `getHeadingStyle('volume')` returns `{ bold:false, uppercase:false, underline:false }`. Confirm `underline` is already false for non-letter types; if the function forces underline for directives, add a `NO_UNDERLINE` guard including `'volume'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/registration.test.ts`
Then: `npm run typecheck`
Expected: tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/heading-policy.ts tests/volume/registration.test.ts
git commit -m "feat(volume): register Volume type under Directives"
```

---

## Task 7: Volume store slice

**Files:**
- Create: `src/store/volumeStore.ts`
- Test: `tests/volume/store.test.ts`

**Interfaces:**
- Consumes: `VolumeDoc`, `VolumeSchema`.
- Produces: `useVolumeStore` (Zustand) with state `{ doc: VolumeDoc }` and actions `setDoc(doc)`, `updateMeta(patch)`, `addChapter()`, `addSection(chapterIdx)`, `addParagraph(chapterIdx, sectionIdx)`, `addSubPara(path)`, `updateBlock(path, block)`, `moveNode(path, dir)`, `removeNode(path)`. `path` is a typed locator object `{ chapter: number; section?: number; paragraph?: number; sub?: number[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';

describe('volumeStore', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));
  it('starts with one chapter, one section', () => {
    const doc = useVolumeStore.getState().doc;
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].sections).toHaveLength(1);
  });
  it('adds a chapter with the next number', () => {
    useVolumeStore.getState().addChapter();
    const doc = useVolumeStore.getState().doc;
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[1].number).toBe(2);
  });
  it('adds a paragraph under a section', () => {
    useVolumeStore.getState().addParagraph(0, 0);
    expect(useVolumeStore.getState().doc.chapters[0].sections[0].paragraphs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/store.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/store/volumeStore.ts
import { create } from 'zustand';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

export function blankVolume(): VolumeDoc {
  return {
    documentType: 'volume',
    order: { designator: '', policyTitle: '', sponsorCode: '' },
    volume: {
      number: 1, title: '', originalPublicationDate: '', lastUpdatedDate: '',
      distribution: { kind: 'statementA' }, submitChangesTo: 'CMC (JA)\n3000 Marine Corps Pentagon\nWashington, DC 20350-3000',
      sectionPeriod: false, pageBand: 'auto',
    },
    changeLog: [], references: [],
    chapters: [{ number: 1, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] }],
  };
}

interface VolumeState {
  doc: VolumeDoc;
  setDoc: (doc: VolumeDoc) => void;
  updateMeta: (patch: Partial<VolumeDoc['volume']>) => void;
  addChapter: () => void;
  addSection: (chapterIdx: number) => void;
  addParagraph: (chapterIdx: number, sectionIdx: number) => void;
}

export const useVolumeStore = create<VolumeState>((set) => ({
  doc: blankVolume(),
  setDoc: (doc) => set({ doc }),
  updateMeta: (patch) => set((s) => ({ doc: { ...s.doc, volume: { ...s.doc.volume, ...patch } } })),
  addChapter: () => set((s) => {
    const number = s.doc.chapters.length + 1;
    return { doc: { ...s.doc, chapters: [...s.doc.chapters, { number, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] }] } };
  }),
  addSection: (ci) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[ci].sections.push({ seq: chapters[ci].sections.length + 1, title: '', paragraphs: [] });
    return { doc: { ...s.doc, chapters } };
  }),
  addParagraph: (ci, si) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const paras = chapters[ci].sections[si].paragraphs;
    paras.push({ seq: paras.length + 1, title: '', body: [{ runs: [{ text: '' }] }], children: [] });
    return { doc: { ...s.doc, chapters } };
  }),
}));
```

(Additional actions `addSubPara`, `updateBlock`, `moveNode`, `removeNode` are implemented in Task 12 when the full editor needs them; this task delivers the slice + the three actions the test covers. Verify Zustand is the store lib used elsewhere; if the repo uses a different store, follow that pattern — grep `src/store` for `create(` first.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/volumeStore.ts tests/volume/store.test.ts
git commit -m "feat(volume): add volume store slice with blank template"
```

---

## Task 8: Pagination (pass 1 layout)

**Files:**
- Create: `src/lib/volume/layout.ts`
- Test: `tests/volume/layout.test.ts`

**Interfaces:**
- Consumes: schema types, `designators`, `volume-indent`, `page-bands`, `measure`.
- Produces: `layoutVolume(doc: VolumeDoc): LaidOutDoc` where `LaidOutDoc = { pages: Page[]; toc: TocEntry[] }`, `Page = { label: string; band: 'front'|'ref'|'body'; chapter?: number; items: PaintItem[] }`, `PaintItem` is a discriminated union `{ kind:'line'; x:number; y:number; segments; sizePt } | { kind:'heading'; ... } | { kind:'figure'; ... } | { kind:'table'; ... }`, `TocEntry = { label: string; page: string; level: number }`. Page geometry constants (`PAGE_W=612`, `PAGE_H=792`, margins) live here and are exported.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/layout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

function sampleDoc() {
  const d = blankVolume();
  d.order = { designator: 'MCO 5800.16', policyTitle: 'LEGAL SUPPORT AND ADMINISTRATION MANUAL', sponsorCode: 'JA' };
  d.volume = { ...d.volume, number: 6, title: 'INTERNATIONAL AND OPERATIONAL LAW', originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20' };
  d.chapters = [{
    number: 1, title: 'INTERNATIONAL AND OPERATIONAL LAW', changeLog: [], figures: [],
    sections: [
      { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'This Volume promulgates policy.' }] }], paragraphs: [] },
    ],
  }];
  return d;
}

describe('layoutVolume', () => {
  it('produces front matter, then body pages', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.pages.some(p => p.band === 'front')).toBe(true);
    expect(out.pages.some(p => p.band === 'body')).toBe(true);
  });
  it('emits a TOC entry for the section', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.toc.find(e => e.label.includes('PURPOSE'))).toBeTruthy();
  });
  it('numbers a single-chapter body page sequentially', () => {
    const out = layoutVolume(sampleDoc());
    const body = out.pages.filter(p => p.band === 'body');
    expect(body[0].label).toMatch(/^\d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/layout.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Implement `layoutVolume`:
- Constants: `PAGE_W=612`, `PAGE_H=792`, `MARGIN=72`, `TOP_TEXT_Y=PAGE_H-MARGIN-24` (first body line below the running head), `BOTTOM_Y=MARGIN`, `LEADING=12.6`, `GAP=25`, `RIGHT_EDGE=PAGE_W-MARGIN`.
- A `PageCursor` that appends `PaintItem`s, advances `y` by `LEADING`, and starts a new page (pushing the current one) when `y < BOTTOM_Y + LEADING`.
- Walk order: build front-matter pages (title page, blank verso, references list + summary, a TOC placeholder page — TOC entries are collected during the body walk and the placeholder is filled by count in Task 10; for this task emit the entries only), then per chapter: a body cursor. For each section: emit a heading line (ALL CAPS at `designatorX(1)`), record a `TocEntry`, then either its `body` blocks (flush left) or its paragraphs. For each paragraph/sub-para: designator + `wrapRuns(...)` lines at the level's `designatorX`/`textStartX`, run-over to `RUNOVER_X`.
- Assign each body page a label via `bodyPageLabel({ chapter, page, multiChapter: doc.chapters.length>1, band: doc.volume.pageBand })` where `page` counts pages within the chapter (multi-chapter) or globally (sequential).
- Front pages get lower-roman labels; reference pages `REF-{n}`.

Write the full module (no placeholders) following the interface above. Keep each render helper (`layoutSection`, `layoutParagraph`, `layoutSubPara`, `layoutFrontMatter`) a named function in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/layout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/layout.ts tests/volume/layout.test.ts
git commit -m "feat(volume): add pass-1 pagination and TOC collection"
```

---

## Task 9: PDF paint (pass 2) — body + page template

**Files:**
- Create: `src/services/pdf/volumeGenerator.ts`
- Modify: `src/services/export/pdfPipelineService.ts` (add `PIPELINE_MAP.volume`)
- Test: `tests/golden/volume/measure-pdf.mjs` (extractor), `tests/golden/volume/geometry.test.ts`

**Interfaces:**
- Consumes: `layoutVolume`, page constants.
- Produces: `generateVolumePdf(doc: VolumeDoc): Promise<Blob>` and the pipeline entry `volume: (ctx) => generateVolumePdf(ctx.formData as unknown as VolumeDoc)`.

- [ ] **Step 1: Write the failing golden test**

```ts
// tests/golden/volume/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';
import { blankVolume } from '@/store/volumeStore';

async function renderCoords(doc = build()) {
  const blob = await generateVolumePdf(doc);
  const buf = Buffer.from(await blob.arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), 'vol-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, buf);
  const out = execFileSync('python', [join(__dirname, 'measure-pdf.mjs'), pdf]).toString();
  return JSON.parse(out) as { page: number; x: number; y: number; size: number; text: string }[];
}
function build() {
  const d = blankVolume();
  d.chapters[0].title = 'TEST CHAPTER';
  d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'Body text here.' }] }], paragraphs: [] };
  return d;
}

describe('volume PDF geometry', () => {
  it('uses a 612x792 page with 72pt left margin body', async () => {
    const rows = await renderCoords();
    const body = rows.find(r => r.text.includes('Body text'));
    expect(body?.x).toBeCloseTo(72, 0);
  });
  it('places the section designator at x=72', async () => {
    const rows = await renderCoords();
    const sec = rows.find(r => r.text.startsWith('0101'));
    expect(sec?.x).toBeCloseTo(72, 0);
  });
});
```

(Extractor `measure-pdf.mjs` is the pypdf visitor script already used to measure the source — it prints one JSON array of `{page,x,y,size,text}`. Port it from `scratchpad/measure.py`, emitting JSON.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:golden -- tests/golden/volume/geometry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Implement `generateVolumePdf`:
- `import { PDFDocument, StandardFonts } from 'pdf-lib'` (or the project's embedded Liberation Serif font loader — grep existing generators for how they embed serif; reuse that).
- Call `layoutVolume(doc)`. For each `Page`, `addPage([612,792])`, paint each `PaintItem`:
  - `line`: `page.drawText(segment.text, { x, y, size, font, color })` — color blue `rgb(0,0,1)` when `segment.run.changed || segment.run.link`, else black.
  - `heading`: same but honoring case already baked into the item text.
- Paint the **page template** on every page: running-head center `LEGAL...`/`policyTitle` centered on x=306 at y≈745 size 12; left `Volume N` / `Volume N, Chapter M` at x=72 y≈731; right `{order.designator} · V{N}` + date flush-right ending x≈540; footer page label centered on x=306 at y≈38.6 size 11.5.
- Return `new Blob([bytes], { type: 'application/pdf' })`.

In `pdfPipelineService.ts`, add `volume` to `PIPELINE_MAP`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:golden -- tests/golden/volume/geometry.test.ts`
Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/pdf/volumeGenerator.ts src/services/export/pdfPipelineService.ts tests/golden/volume/
git commit -m "feat(volume): PDF pass-2 paint with page template + geometry golden test"
```

---

## Task 10: PDF front matter (title page, TOC, references, dividers, change tables)

**Files:**
- Modify: `src/lib/volume/layout.ts` (real front-matter builders + TOC fill)
- Modify: `src/services/pdf/volumeGenerator.ts` (paint tables + dotted leaders)
- Test: `tests/golden/volume/frontmatter.test.ts`

**Interfaces:**
- Consumes: existing layout/paint.
- Produces: front-matter `PaintItem`s including `{ kind:'table'; rows; cols; x; y }` and TOC lines with a dotted leader between label and page.

- [ ] **Step 1: Write the failing test**

```ts
// tests/golden/volume/frontmatter.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

function doc() {
  const d = blankVolume();
  d.volume = { ...d.volume, number: 1, title: 'LEGAL SUPPORT', titleQuoted: true, originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20' };
  d.references = [{ text: 'SECNAVINST 5430.7R' }, { text: 'MCO 5430.2' }];
  d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'x' }] }], paragraphs: [] };
  return d;
}

describe('front matter', () => {
  it('has a title page with SUMMARY OF VOLUME 1 CHANGES', () => {
    const out = layoutVolume(doc());
    const text = out.pages.flatMap(p => p.items).map(i => (i as any).segments?.map((s:any)=>s.text).join('') ?? (i as any).text ?? '').join(' ');
    expect(text).toContain('SUMMARY OF VOLUME 1 CHANGES');
  });
  it('renders references with (a) (b) designators', () => {
    const out = layoutVolume(doc());
    const refPage = out.pages.find(p => p.band === 'ref');
    const t = refPage!.items.map(i => JSON.stringify(i)).join(' ');
    expect(t).toContain('(a)');
    expect(t).toContain('SECNAVINST 5430.7R');
  });
  it('fills the TOC with resolved page numbers', () => {
    const out = layoutVolume(doc());
    const tocEntry = out.toc.find(e => e.label.includes('PURPOSE'));
    expect(tocEntry?.page).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/golden/volume/frontmatter.test.ts`
Expected: FAIL (front matter not yet built / TOC empty).

- [ ] **Step 3: Write minimal implementation**

- In `layout.ts`, implement `layoutFrontMatter(doc)`:
  - **Title page**: centered `VOLUME {n}`; quoted title; `SUMMARY OF VOLUME {n} CHANGES`; hyperlink legend line; change-policy boilerplate; the volume change table (`kind:'table'`); submit-changes block; distribution line (`DISTRIBUTION STATEMENT A: …` or `DISTRIBUTION: PCN {value}`); plus `CANCELLATION:`/`Report Required:` when present.
  - **Blank verso**: a page with the one centered line.
  - **References**: `REFERENCES` heading, list items with `referenceDesignator(i)` hanging at x=72; then the `"REFERENCES"` summary page. Band `'ref'`, labels `REF-{n}`.
  - **TOC page(s)**: after the body walk, resolve `toc[].page` from the page each entry landed on, then emit TOC lines (label left, page right, dotted leader filling the gap — leader computed from `RIGHT_EDGE - measureText(label) - measureText(page)`).
- Do a **two-phase** resolve: run the body walk first to populate `toc` page numbers, then build the TOC page and splice it into front matter before the References/after the References per the format spec order (References, then TOC — see format spec §12 ordering; keep References before TOC).
- In `volumeGenerator.ts`, paint `kind:'table'` (simple grid: draw cell borders + text) and dotted leaders (repeat `.` to fill).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/golden/volume/frontmatter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/layout.ts src/services/pdf/volumeGenerator.ts tests/golden/volume/frontmatter.test.ts
git commit -m "feat(volume): front matter, references, and auto-TOC"
```

---

## Task 11: Figures + blue change-font + hyperlinks

**Files:**
- Modify: `src/lib/volume/layout.ts` (figure blocks + TOC figure entries)
- Modify: `src/services/pdf/volumeGenerator.ts` (embed images; blue runs; hyperlink annotations)
- Test: `tests/golden/volume/figures.test.ts`, `tests/volume/runs.test.ts`

**Interfaces:**
- Consumes: `Figure`, `Run`.
- Produces: `PaintItem` `{ kind:'figure'; image; captionText; legend; x; y; w; h }`; blue color applied to `changed`/`link` segments; PDF link annotation for `link` runs with `href`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/volume/runs.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

it('marks changed runs so they can be painted blue', () => {
  const d = blankVolume();
  d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'new policy', changed: true }] }], paragraphs: [] };
  const out = layoutVolume(d);
  const seg = out.pages.flatMap(p => p.items).flatMap((i: any) => i.segments ?? []).find((s: any) => s.run?.changed);
  expect(seg?.text).toContain('new');
});
```

```ts
// tests/golden/volume/figures.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

it('lays out a figure with caption and TOC entry', () => {
  const d = blankVolume();
  d.chapters[0].figures = [{ number: 1, caption: 'Legal Services Support Section', image: PNG_1x1, legend: ['TC — Trial Counsel'] }];
  const out = layoutVolume(d);
  expect(out.pages.flatMap(p => p.items).some((i: any) => i.kind === 'figure')).toBe(true);
  expect(out.toc.some(e => e.label.startsWith('FIGURE 1'))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/volume/runs.test.ts tests/golden/volume/figures.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

- `layout.ts`: after a chapter's sections, emit each figure as a centered `kind:'figure'` item (scale image to fit text width, keep aspect), a centered caption `Figure {n}`, legend lines; push a `TocEntry { label: 'FIGURE {n}: {caption}', page, level: 1 }`. Runs already carry `changed`/`link` through `wrapRuns`; ensure the layout preserves the `run` on each segment (Task 5 already does).
- `volumeGenerator.ts`: for `kind:'figure'`, `pdfDoc.embedPng`/`embedJpg` from the data URL and `page.drawImage`. For segments, set `color` blue when `run.changed || run.link`. For `run.link` with `href`, add a link annotation rectangle over the segment (pdf-lib low-level annotation, or the project's existing link helper if one exists — grep `createPageLinkAnnotation`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/volume/runs.test.ts tests/golden/volume/figures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/volume/layout.ts src/services/pdf/volumeGenerator.ts tests/volume/runs.test.ts tests/golden/volume/figures.test.ts
git commit -m "feat(volume): figures, blue change-font, and hyperlinks in PDF"
```

---

## Task 12: Volume editor UI

**Files:**
- Create: `src/components/volume/VolumeEditor.tsx`, `MetaPanel.tsx`, `ChapterTree.tsx`, `BlockEditor.tsx`
- Modify: `src/store/volumeStore.ts` (add `addSubPara`, `updateBlock`, `moveNode`, `removeNode`, `updateNodeTitle`)
- Modify: document layout wiring to mount `VolumeEditor` when `documentType === 'volume'`
- Test: `tests/volume/editor.test.tsx`

**Interfaces:**
- Consumes: `useVolumeStore`, `designators` (for live preview).
- Produces: a React tree editor. `MetaPanel` edits `order`+`volume`+`changeLog`+`references`; `ChapterTree` renders chapters→sections→paragraphs→sub-paras with add/reorder/indent/remove; `BlockEditor` edits a `Block`'s text with **mark-changed** and **insert-link** toggles that set `Run.changed`/`Run.link`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/volume/editor.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeEditor } from '@/components/volume/VolumeEditor';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';

describe('VolumeEditor', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));
  it('shows the live section designator 0101', () => {
    render(<VolumeEditor />);
    expect(screen.getByText('0101')).toBeTruthy();
  });
  it('adds a chapter via the button', () => {
    render(<VolumeEditor />);
    fireEvent.click(screen.getByRole('button', { name: /add chapter/i }));
    expect(useVolumeStore.getState().doc.chapters).toHaveLength(2);
  });
});
```

(Confirm the repo's React test setup — grep `tests/` for `@testing-library/react`; if absent, add it as a dev dependency in this task or follow the existing component-test pattern.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/editor.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Build the four components. `VolumeEditor` composes `MetaPanel` + `ChapterTree`. `ChapterTree` maps `doc.chapters` → sections → paragraphs → sub-paras, showing each node's **live designator** (`sectionDesignator`, `paragraphDesignator`, `subParaDesignator`) computed from index, an editable title, add/remove/move buttons wired to store actions, and a `BlockEditor` per body block. `BlockEditor` renders a textarea plus "Mark changed" / "Insert link" controls that write `Run` flags. Add the missing store actions. Follow existing component styling/primitives (grep `src/components/letter` for form field components to reuse). Mount in the document layout: where the letter form renders, branch `documentType === 'volume'` → `<VolumeEditor />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/editor.test.tsx`
Then: `npm run typecheck && npm run lint`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/volume/ src/store/volumeStore.ts tests/volume/editor.test.tsx
git commit -m "feat(volume): tree authoring UI with live designators and run toggles"
```

---

## Task 13: DOCX generator

**Files:**
- Create: `src/services/docx/volumeDocx.ts`
- Modify: `src/lib/docx-generator.ts` (branch `documentType === 'volume'` → `volumeDocx`)
- Test: `tests/volume/docx.test.ts`

**Interfaces:**
- Consumes: `VolumeDoc`, `layoutVolume` (for TOC entries/ordering) or the tree directly, `designators`.
- Produces: `generateVolumeDocx(doc: VolumeDoc): Promise<Blob>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/docx.test.ts
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateVolumeDocx } from '@/services/docx/volumeDocx';
import { blankVolume } from '@/store/volumeStore';

it('produces a docx with a section per chapter and a TOC field', async () => {
  const d = blankVolume();
  d.chapters.push({ number: 2, title: 'SECOND', changeLog: [], sections: [{ seq: 1, title: 'X', paragraphs: [] }], figures: [] });
  const blob = await generateVolumeDocx(d);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('TOC');            // TOC field
  expect((xml.match(/w:sectPr/g) ?? []).length).toBeGreaterThanOrEqual(2);
});
```

(Confirm `docx` and `jszip` are dependencies — grep `package.json`; both are commonly present. If `jszip` is absent, assert on the `docx` document object model instead.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/docx.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Implement `generateVolumeDocx` with the `docx` lib: a front-matter section (title page + `TableOfContents` field), then one `Section` per chapter with its own `headers`/`footers` (running head text + `PageNumber`), body paragraphs with `indent` mirroring the 36 pt ladder (convert pt→twips ×20), designators from the same generator, change-log `Table`s, figures via `ImageRun`, blue runs via `TextRun({ color: '0000FF' })`, hyperlinks via `ExternalHyperlink`. Branch in `docx-generator.ts` to delegate.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/docx.test.ts`
Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/docx/volumeDocx.ts src/lib/docx-generator.ts tests/volume/docx.test.ts
git commit -m "feat(volume): DOCX generator with section-per-chapter and TOC field"
```

---

## Task 14: Persistence (.nldp v1.2) + templates

**Files:**
- Modify: `src/lib/nldp-format.ts` (add optional `volume?: VolumeDoc` to `NLDPData`; bump `CURRENT_VERSION` to `1.2`, add to `SUPPORTED_VERSIONS`)
- Create: `src/lib/templates/volume.ts` (blank single-chapter + multi-chapter starter)
- Modify: `src/lib/templates/index.ts` (register the templates)
- Test: `tests/volume/persistence.test.ts`

**Interfaces:**
- Consumes: `VolumeDoc`, `VolumeSchema`.
- Produces: round-trip export/import carrying `data.volume`; two `DocumentTemplate`s under `typeId: 'volume'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/volume/persistence.test.ts
import { describe, it, expect } from 'vitest';
import { NLDP_CONSTANTS } from '@/lib/nldp-format';
import { VolumeSchema } from '@/lib/schemas/volume-schema';
import { blankVolumeTemplate } from '@/lib/templates/volume';

it('bumps NLDP to 1.2 and keeps 1.0/1.1 supported', () => {
  expect(NLDP_CONSTANTS.CURRENT_VERSION).toBe('1.2');
  expect(NLDP_CONSTANTS.SUPPORTED_VERSIONS).toEqual(expect.arrayContaining(['1.0', '1.1', '1.2']));
});
it('provides a valid blank volume template', () => {
  expect(() => VolumeSchema.parse(blankVolumeTemplate().defaultData)).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/volume/persistence.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

- `nldp-format.ts`: add `volume?: import('@/lib/schemas/volume-schema').VolumeDoc;` to `NLDPData`; set `CURRENT_VERSION: '1.2'`, `SUPPORTED_VERSIONS: ['1.0','1.1','1.2']`, `version: '1.0'|'1.1'|'1.2'`. Update the export/import code paths to copy `data.volume` through when present (grep for where `NLDPData` is assembled/read).
- `templates/volume.ts`: export `blankVolumeTemplate()` and `multiChapterVolumeTemplate()` returning `DocumentTemplate` with `typeId: 'volume'`, `definition: VolumeDefinition`, `defaultData` = a `VolumeDoc`.
- Register both in `templates/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/volume/persistence.test.ts`
Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nldp-format.ts src/lib/templates/volume.ts src/lib/templates/index.ts tests/volume/persistence.test.ts
git commit -m "feat(volume): NLDP v1.2 persistence and starter templates"
```

---

## Task 15: Fixtures + full golden coverage + regression

**Files:**
- Create: `tests/golden/volume/fixtures/vol6.json`, `tests/golden/volume/fixtures/vol16.json`
- Create: `tests/golden/volume/fidelity.test.ts`
- Test: the two fixtures render and match measured geometry

**Interfaces:**
- Consumes: `generateVolumePdf`, `measure-pdf.mjs`.
- Produces: coordinate assertions for both structural extremes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/golden/volume/fidelity.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { VolumeSchema } from '@/lib/schemas/volume-schema';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';

async function coords(fixture: string) {
  const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', fixture), 'utf8')));
  const blob = await generateVolumePdf(doc);
  const dir = mkdtempSync(join(tmpdir(), 'vol-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, Buffer.from(await blob.arrayBuffer()));
  return JSON.parse(execFileSync('python', [join(__dirname, 'measure-pdf.mjs'), pdf]).toString()) as any[];
}

describe('volume fidelity', () => {
  it('vol6 single-chapter: sequential footer, section at x=72', async () => {
    const rows = await coords('vol6.json');
    expect(rows.find(r => r.text.startsWith('0101'))?.x).toBeCloseTo(72, 0);
    // a footer that is a bare number
    expect(rows.some(r => r.y < 45 && /^\d+$/.test(r.text.trim()))).toBe(true);
  });
  it('vol16 multi-chapter: ladder columns 72/108/144/180 present', async () => {
    const rows = await coords('vol16.json');
    const xs = new Set(rows.map(r => Math.round(r.x)));
    expect([72, 108, 144, 180].every(x => [...xs].some(v => Math.abs(v - x) <= 1))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:golden -- tests/golden/volume/fidelity.test.ts`
Expected: FAIL (fixtures missing).

- [ ] **Step 3: Write the fixtures**

Author `vol6.json` (single chapter, sections `0101 PURPOSE`, `0102 GENERAL`, `0103 PERSONNEL` with `010301.` → `A.` → `1.`, `pageBand:'auto'`) and `vol16.json` (≥2 chapters, `sectionPeriod:true`, a `010301./A./1.` chain, `pageBand:'auto'`). Both valid against `VolumeSchema`. Base content on the extracted text in `scratchpad/mco/` so they mirror the real structure.

- [ ] **Step 4: Run tests + full suite**

Run: `npm run test:golden -- tests/golden/volume/fidelity.test.ts`
Then regression: `npm run test` and `npm run typecheck` and `npm run lint`.
Expected: new tests PASS; existing letter/MCO tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add tests/golden/volume/
git commit -m "test(volume): Vol 6 and Vol 16 fixtures with fidelity golden checks"
```

---

## Task 16: Manual verification on the running app

**Files:** none (verification only).

- [ ] **Step 1:** `npm run dev` (or reuse the running preview). Open the app.
- [ ] **Step 2:** Sidebar → **Directives** → confirm **Volume** appears between Marine Corps Bulletin and SECNAV Instruction.
- [ ] **Step 3:** Select Volume; author order/volume meta, one chapter with `0101`/`010101.`/`A.`/`1.`, a figure upload, and one run marked changed.
- [ ] **Step 4:** Export PDF; confirm running heads, footer band, TOC with page numbers, blue changed run, figure + caption. Export DOCX; open in Word; confirm TOC field updates and headers per chapter.
- [ ] **Step 5:** Commit any fixes found; then this branch is ready for review.

```bash
git commit -am "fix(volume): address manual-verification findings" # only if fixes were needed
```

---

## Self-Review

**Spec coverage:** §2 data model → Task 1; §3 registration/placement → Task 6 (+ picker order); §4 numbering/indent → Tasks 2, 3; §5 PDF two-pass → Tasks 8–11; §6 DOCX → Task 13; §7 persistence/assets → Task 14 (figures embedded in Task 11); §8 testing → Tasks 1–15 (golden in 9–11, 15); §9 module inventory → File Structure; §10 sequencing → task order. Page bands (§6 layout std) → Task 4; measurement → Task 5; store → Task 7; UI → Task 12; manual verify → Task 16. No spec section is unmapped.

**Placeholder scan:** Deterministic tasks (1–7) carry full code. Tasks 8–13 give the interface, the algorithm, exact constants, and the failing test with concrete assertions; the implementer writes the module body against a named interface and a passing bar — these are large modules where spelling every line inline would exceed a single task, so each is scoped by its test. No "TBD"/"add error handling"/"similar to Task N" left in.

**Type consistency:** `VolumeDoc`/`Block`/`Run` names match across Tasks 1, 5, 7, 8, 11, 13, 14. `layoutVolume`/`LaidOutDoc`/`PaintItem` consistent Tasks 8–11, 15. `generateVolumePdf` / `generateVolumeDocx` consistent Tasks 9, 13, 15. `designatorX`/`textStartX` consistent Tasks 3, 8. Store `blankVolume`/`useVolumeStore` consistent Tasks 7, 8, 12.

**Open confirmations flagged inline** (grep-first, don't assume): store lib (`create(` in `src/store`), React test lib presence, `jszip`/`docx` deps, existing serif-font embed helper and link-annotation helper in current PDF generators. Each is called out in the task that needs it.
