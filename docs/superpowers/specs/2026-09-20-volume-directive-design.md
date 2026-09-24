# Volume (Formatted Directive) — Design Spec

**Date:** 2026-09-20
**Status:** Approved design, pre-implementation.
**Type:** Architectural (new document type + new render pipeline + tree authoring UI).

## 1. Purpose & framing

Add a new **Volume** document type to Semper Scribe: a paginated, multi-chapter
directive format that policies (MCOs and similar) are migrating to. It is a
*generic house format*, not tied to any one order — MCO 5800.16 (the LSAM) was
only the reverse-engineered exemplar we measured.

The canonical layout standard is
[`docs/engineering/LSAM_VOLUME_FORMAT_SPEC.md`](../../engineering/LSAM_VOLUME_FORMAT_SPEC.md)
(v0.2, geometry measured per-glyph). This spec references it for all placement,
geometry, and numbering rules rather than repeating them.

**Confirmed scope decisions:**
- Full multi-chapter authoring **and** rendering in the first release.
- Output: **PDF and DOCX**.
- **Full fidelity**: numbering, headings, indentation, running heads, footers,
  auto-TOC, change-log tables, references, **blue change-font tracking**, and
  **figures** (image upload).
- **One document = one Volume**; sibling volumes are linked by shared order
  metadata (the policy identity).
- Picker: a new **"Volume"** entry under the **Directives** group (sibling to
  Marine Corps Order, Bulletin, SECNAV Instruction, SECNAV Notice), type id
  `volume`.

**Non-goals (first release):** native org-chart editor (figures are uploaded
images); importing/parsing existing volume PDFs; OCR of scanned sources.

## 2. Data model

Type id: `volume`. Content is a **tree**, not the flat `paragraphs[]` used by
letters. New model `VolumeDoc`:

```
VolumeDoc {
  documentType: 'volume'

  order: {                       // shared policy identity (links sibling volumes)
    designator,                  // any: "MCO 5800.16", "MCO 1500.59", ...
    policyTitle,
    sponsorCode
  }

  volume: {
    number, title, titleQuoted?,
    originalPublicationDate,      // right header (immutable)
    lastUpdatedDate,             // left header (blue)
    distribution: { kind: 'statementA' | 'pcn', value? },
    submitChangesTo: string,     // address block, editable (default CMC (JA) …)
    cancellation?, reportRequired?,
    sectionPeriod: boolean,      // 0103 vs 1703.  (default false)
    pageBand: 'auto' | 'chapter-page' | 'sequential'   // default 'auto'
  }

  changeLog: [ { version, summary, originationDate, dateOfChanges } ]
  references: NLDPReference[]     // reuse existing model; (a)(b)… generated

  chapters: [ Chapter {
    number, title,
    changeLog: [ { version, pageParagraph, summary, dateOfChange } ],
    sections: [ Section {
      seq, title,                // ALL CAPS; designator CCSS derived
      body?: Block[],            // a section may carry text directly
      paragraphs: [ Paragraph {
        seq, title, body: Block[],          // Title Case; CCSSPP. derived
        children: [ SubPara {               // A. -> 1. -> …
          seq, style: 'upper' | 'arabic', title?, body: Block[], children[]
        } ]
      } ]
    } ],
    figures: [ Figure { number, caption, image: AssetRef, legend?: string[], anchor } ]
  } ]
}

Block = { runs: Run[], ladder?: 'structural' | 'correspondence' }
Run   = { text, changed?: boolean, link?: boolean, href?: string }
```

Rules:
- **Designators are derived from position** (`CC` from chapter, `SS`/`PP`/letter/
  arabic from index). Stored only for round-trip determinism, mirroring
  `NLDPParagraph.designator`.
- **Page numbers are computed at layout time, never stored.**
- `Run.changed` → blue text; `Run.link` → hyperlink style (bold+italic+blue+
  underline) with `href`.
- `Block.ladder` switches a block between the structural 36 pt ladder and the
  embedded correspondence ladder (`a.` → `(1)` → `(a)`) for reproduced
  sub-documents (scripts, checklists).
- Validation via a Zod schema (`src/lib/schemas/volume-schema.ts`), registered
  like the other type schemas.

## 3. Type registration & placement

- Add `VolumeDefinition: DocumentTypeDefinition` and register it in
  `DOCUMENT_TYPES` (schemas.ts) under `category: 'directives'`.
- `features`: `isDirective: true`; letterhead pieces off (`showVia`,
  `showEnclosures`, `showMultipleTo`, `showClosingBlock` = false);
  `showReferences: true`; new flags `showVolumeTree`, `showChangeLog`,
  `showFigures = true`; `pdfPipeline: 'volume'`;
  `exportFormats: ['pdf', 'docx']`.
- Extend the `PdfPipeline` union with `'volume'` and add the entry to
  `PIPELINE_MAP` in `pdfPipelineService.ts`.
- DOCX: add a `volume` branch in `generateDocxBlob` that delegates to the new
  `volumeDocx` module.
- Picker: because `pickerOptions()` iterates `DOCUMENT_TYPES` in registry order,
  placing `volume` between `bulletin` and the SECNAV entries yields the desired
  sidebar order. Confirm order in schemas.ts registry literal.
- Templates (`src/lib/templates/`): add a **blank single-chapter** volume and a
  **multi-chapter starter** template under `typeId: 'volume'`.

## 4. Numbering & indentation engine

New module `src/lib/volume-indent.ts` (or a third mode in `indent-engine.ts`):

- **Fixed 36 pt (0.5") ladder.** Designator columns 72 / 108 / 144 / 180 pt for
  L1–L4; text begins 36 pt right of its designator (paragraph level's wide
  `CCSSPP.` token pushes text to ≈150 pt).
- **Run-over returns to the left margin (x = 72).** Not a hanging indent —
  matches measured behavior and the correspondence run-over rule.
- Section body with no numbered child is flush left, no first-line indent.
- Designator generation: structural (`CCSS`, `CCSSPP.`, `A.`, `1.`) honoring the
  `sectionPeriod` flag; reuse `citation.ts` for `Block.ladder='correspondence'`
  (`a.`/`(1)`/`(a)`) and for References `(a)(b)…(aa)`.
- Widths come from `font-metrics.ts` (Liberation/TNR metric-compatible) so PDF
  and DOCX land designators identically.

Heading typography (per format spec §8): **regular weight, no bold, no
underline**; distinction is case + indent only. Add a `volume` entry to
`heading-policy.ts` — do **not** reuse the `mco` letter entry (which bolds and
underlines).

## 5. PDF generator (two-pass)

New `src/services/pdf/volumeGenerator.ts`, registered as the `'volume'` pipeline.
Uses pdf-lib and the serif metric tables. Letter page 612×792, 1" margins, body
11 pt / running head 12 pt / footer 11.5 pt, ~12.6 pt leading (format spec §3.1).

- **Pass 1 — layout & pagination.** Flow the tree into wrapped lines using
  measured widths; break into pages; assign page numbers per band (front matter
  lower-roman, References `REF-n`, body `M-page` or sequential per `pageBand`).
  Emit blank versos to keep each chapter starting recto. Record TOC entries
  (section titles, chapter titles, figures) with their resolved page numbers, and
  figure anchor positions.
- **Pass 2 — paint.** For every page draw the **page template**: running head
  (center `<policy long title>`, left `Volume N` / `Volume N, Chapter M`, right
  `<order designator> · V{N}` + date), footer page number. Then paint, in order:
  Volume Title Page (Summary of Volume Changes + change table + submit block +
  distribution), blank verso, References list + summary, TOC (dotted leaders +
  real page numbers), then per chapter: divider (Summary of Substantive Changes +
  chapter change table), `CHAPTER M` + title, body via the ladder engine,
  figures (embedded image + `Figure k` caption + legend). Apply **blue** to
  `changed` runs and hyperlink styling to `link` runs.
- Two-pass is required because the TOC and any cross-references depend on final
  pagination.

## 6. DOCX generator

New `src/services/docx/volumeDocx.ts`, invoked from the `volume` branch of
`generateDocxBlob`. Uses the `docx` library.

- **One Word section per chapter** (plus a front-matter section) so each carries
  its own running header/footer matching the page bands; page-number field in the
  footer; different first page where needed.
- Paragraph styles/indents mirror the 36 pt ladder (twips); designators rendered
  by the same generator as PDF.
- **TOC field** (`TOC \o` / `TOC \h`) so Word rebuilds it with correct page
  numbers on open; change-log tables as Word tables; figures as embedded images
  with captions; blue runs via run color, hyperlinks via hyperlink runs.
- Goal: structural fidelity (Word owns exact pagination); PDF is the
  pixel-faithful output.

## 7. Persistence, export/import, assets

- **Store:** add a `volume` slice/branch to the document store holding the
  `VolumeDoc` tree, kept separate from the flat letter `formData`/`paragraphs`
  so the letter path is untouched.
- **Figures:** stored as asset refs (base64 data URL or blob) inside the doc;
  embedded at export. Enforce a per-image size cap and total-document cap
  (respect existing Pages/bundle budgets).
- **Export/import:** extend the `.nldp` format to **v1.2, additive** — a new
  optional `volume` payload alongside the existing letter payload; a 1.1 reader
  still parses (ignores the new field), a 1.2 reader still reads 1.0/1.1. No new
  file extension. Update `nldp-format.ts` (the spec module) and derive the guide.

## 8. Testing

- **Fixtures:** rebuild **Vol 6** (single-chapter) and **Vol 16** (17-chapter,
  `sectionPeriod`, sequential band) as `VolumeDoc` JSON — the two structural
  extremes.
- **Engine unit tests:** designator generation (all 4 levels + section-period +
  embedded ladder + References `(aa)`); indent stops (72/108/144/180, text +36,
  run-over → 72).
- **PDF golden tests:** render fixtures, extract per-glyph coordinates (pypdf
  visitor, as used to measure the source), assert against the measured geometry —
  margins 72, ladder columns, header/footer baselines, page-band numbering,
  regular-weight headings.
- **DOCX structural tests:** correct section count, header/footer presence per
  section, TOC field present, figure images embedded, blue runs colored.
- **Regression:** existing letter/MCO PDF+DOCX snapshots unchanged (the new type
  must not touch the standard pipeline).

## 9. Module inventory (new/changed)

New:
- `src/lib/schemas/volume-schema.ts` — Zod model.
- `src/lib/volume-indent.ts` — 36 pt ladder + run-over engine.
- `src/services/pdf/volumeGenerator.ts` — two-pass PDF.
- `src/services/docx/volumeDocx.ts` — DOCX builder.
- `src/components/volume/VolumeEditor.tsx` (+ child panels) — tree authoring UI.
- `src/lib/templates/volume.ts` — starter templates.
- Test fixtures + specs under `tests/`.

Changed:
- `src/lib/schemas.ts` — register `VolumeDefinition`, `PdfPipeline` union.
- `src/services/export/pdfPipelineService.ts` — `PIPELINE_MAP.volume`.
- `src/lib/docx-generator.ts` — `volume` branch.
- `src/lib/heading-policy.ts` — `volume` heading entry (no bold/underline).
- `src/lib/nldp-format.ts` — v1.2 `volume` payload.
- `src/store/*` — volume slice.
- Document layout/section wiring to mount `VolumeEditor` for `documentType==='volume'`.

## 10. Sequencing (for the implementation plan)

1. Schema + type registration + picker entry (visible, empty).
2. Numbering/indent engine + unit tests.
3. Minimal `VolumeEditor` (meta + one chapter/section/paragraph) → store.
4. PDF two-pass: body + page template + footer bands (no front matter yet).
5. Front matter: title page, TOC, references, chapter dividers, change tables.
6. Figures (upload + embed + TOC) and blue change-font/hyperlinks.
7. DOCX generator.
8. Persistence (.nldp v1.2) + full editor (multi-chapter, reorder, run toggles).
9. Fixtures + golden/coordinate tests; regression pass.

Each step is independently testable on the running dev server.
