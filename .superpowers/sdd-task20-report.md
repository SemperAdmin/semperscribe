# Task 20 report: title-page/divider/header styling fidelity (Volume, MCO 5800.16)

## Status
Complete. All required checks pass: `npm run test -- tests/volume/ tests/golden/volume/` (103 tests, including the 32-test golden suite and 22-test real-PDF comparison suite), `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`.

## Measurements (evidence)

Tools used: `fontmap.py` (per-glyph BaseFont/size/position) and a new `colormap.py` (pdfplumber-based; groups runs by top/font/size/non_stroking_color, and lists `page.rects` for border/underline/shading geometry) against `MCO 5800.16 Vol.17.pdf`.

### Page 0 (title page)
- Running head (all 4 lines): `TimesNewRomanPS-BoldMT` 11pt, color black. One full-width rect (`x0=72 x1=539.5`) sits immediately under the row containing the left label ("Volume 17") and the right designator ("MCO 5800.16 – V17") — NOT under the center policy title or the date row. This reads visually as "left/right tokens underlined."
- `VOLUME 17`: Bold, no underline.
- Volume title ("JUDGE ADVOCATE DIVISION AWARDS PROGRAM"): Bold + underlined (a rect spans exactly its x-range).
- `SUMMARY OF VOLUME 17 CHANGES`: Bold.
- Legend: "Hyperlinks are denoted by " regular; "bold, italic, blue and underlined font" BoldItalic, color `(0.518, 0.588, 0.69)`, underlined (rect matches its color and x-range); trailing "." Bold (not italic), black.
- Boilerplate: every "blue font" occurrence is colored `(0.518, 0.588, 0.69)` (same muted blue as the legend). In VOLUME_CHANGE_POLICY_BOILERPLATE's 3rd sentence, "full revision" is additionally underlined (black rect over its exact x-range).
- `CANCELLATION`: Bold + underlined (rect ends exactly where "CANCELLATION" ends, before the colon); `: MCO 1650.62` regular, not underlined.
- Change table: header row Bold; data rows regular. A bordered box (rects at `top=85.5`..`325.6`, `x=72.7`..`539.4`) wraps the ENTIRE "VOLUME 17 .. CANCELLATION" text block, and its bottom border is the literal same rect as the table's own top border (`top=325.6`/`302.2` on the divider) — i.e. box and table share one line, no gap. Below the "ORIGINAL" row, exactly 3 blank rows follow, each ~28pt tall, with the ORIGINATION DATE column (only) filled `(0.851, 0.851, 0.851)` ≈ 0.85 gray.

### Page 3 (chapter divider, "SUMMARY OF SUBSTANTIVE CHANGES")
Same running-head rule, same box+table pattern (rects `top=87.4`..`445.9`), same legend styling. Divider heading lines ("VOLUME 17: CHAPTER 1" / chapter-title line / "SUMMARY OF SUBSTANTIVE CHANGES") are all Bold 11pt; the chapter-title line is additionally underlined. Table headers Bold. **Difference from the title page**: the divider's copy of "...will reset to black font upon a full revision of this Volume." colors "blue font" but does **not** underline "full revision" (no matching rect found) — a genuine per-page inconsistency in the source document (same sentence, different treatment), not a bug. No blank/shaded rows on the divider table in this sample.

### Page 4 (chapter title page + body, contains "0101. PURPOSE")
- Running head: same Bold 11pt rule.
- "CHAPTER 1" and "JUDGE ADVOCATE DIVISION AWARDS PROGRAM" (chapter title page): **Bold**, `TimesNewRomanPS-BoldMT` 11pt.
- **Section heading "0101. PURPOSE": `TimesNewRomanPSMT` — REGULAR, not bold.** This directly contradicts the task brief's suggestion that 2021-era body headings might have gone bold; the actual measurement says regular, matching the older Vol 1/6 sample. **No change was made to body-section-heading weight** (`layoutSection`'s `addDesignatedLines(..., BODY_SIZE_PT, 'heading')` call was already regular and is untouched).

## Implementation

### Schema (`src/lib/schemas/volume-schema.ts`)
Added optional `bold`, `italic`, `underline`, `color: 'blue'` fields to `RunSchema`/`Run`. All optional; real document content never sets them — they exist purely so layout.ts can express literal-phrase styling as `Run[]` instead of a parallel type.

### `src/lib/volume/measure.ts`
- `wrapRuns`: a segment now measures at bold widths when `run.bold` is set (not just `run.link && run.href`), so a bold synthetic run can't under-measure and overrun the right margin.
- `wrapPlainText`: added an optional `bold` param (threaded to `measureText`), used by table header-cell wrapping (see below).

### `src/lib/volume/layout.ts`
- New exports: `legendRuns()` (regular / bold-italic-blue-underline / bold-period runs whose concatenated text reproduces `LEGEND_TEXT` exactly), `styleBoilerplateRuns(text, { underlineFullRevision })` (styles "blue font" and, optionally, "full revision" via a literal-phrase regex splitter), `titlePageChangeRows(doc)` (shared ORIGINAL-row + 3-blank-shaded-rows logic, used by both PDF and DOCX generators so they can't drift), `tableHeaderHeight(cols, colWidths)` (shared header-height math, needed to size the box↔table gap — see bug below).
- New `centeredRuns`/`leftParagraphRuns` helpers (Run[]-based siblings of `centeredLine`/`leftParagraph`).
- New `PaintItem` kind `'box'` (`BoxItem`: x/yTop/yBottom/width, an unfilled bordered rectangle, pure overlay — doesn't consume cursor space) and `TableItem.rowShading?: (boolean[] | undefined)[]` (per-row/per-column gray-fill flags).
- `PageCursor` gained `currentY()` and `addBox()`.
- `addTable` accepts an optional `shading` param, threads it through pagination-chunking parallel to `rows`/`rowHeights`, and now wraps header cells at **bold** width (`wrapTableCell(..., true)`) since headers now paint bold.
- `layoutTitlePage`, `layoutChapterDivider`, `layoutChapterTitlePage`: headings/legend/boilerplate/CANCELLATION now use styled runs per the measurements above; both title-page and divider capture `boxTopY`/`boxBottomY` around their text block and emit an `addBox(...)` call.
- Body-section heading (`layoutSection`) and References/TOC headings: **unchanged** (regular weight, per the page-4 measurement above; not in this task's confirmed scope).

**Bug caught during verification and fixed**: my first attempt removed the `addGap()` between the last box-content line (e.g. `CANCELLATION`) and `addTable(...)` entirely, reasoning "the box and table should join directly." This caused a real overlap: the table painter's top border and header text paint *above* the `y` passed to `addTable`by `headerHeight - 3`, so with zero gap the header row visually collided with (drew ~5pt above, i.e. through) the CANCELLATION line. Fixed by computing the table's header height up front via the new `tableHeaderHeight` export and inserting `cursor.addGap(tableHeaderHeight(cols, colWidths) - 3)` before `addTable`, sized so the table's top border lands *exactly* at the captured `boxBottomY` — verified by direct calculation and by regenerating a throwaway PDF and confirming with `fontmap.py`/`colormap.py` that the header row now sits ~23pt below CANCELLATION with no overlap, and that the box's bottom border coincides with the table's top border (both computed as `545.1999999999998`).

### `src/services/pdf/volumeGenerator.ts`
- `RUNNING_HEAD_SIZE_PT = 11` (was 12pt regular); running head now paints with a new `fonts.bold` (StandardFonts.TimesRomanBold, newly embedded) instead of `fonts.regular`.
- `paintTemplate` draws one `page.drawLine` from `LEFT_X` to `RIGHT_EDGE_X` at `RUNNING_HEAD_LEFT_Y - 2`, i.e. under the left/right row only (not center, not date) — matches the single full-width rect measured on both page 0 and page 3.
- `Fonts` interface: `regular` / `bold` / `boldItalic` (renamed from `link`, now also used for any run flagged both `bold` and `italic`, e.g. the legend's styled phrase, which looks like a hyperlink but isn't one).
- New `pickFont`/`pickColor` helpers select font/color from a `Run`'s `bold`/`italic`/`color`/`link`/`changed` flags. `TITLE_BLUE = rgb(0.518, 0.588, 0.69)` — the measured muted blue, kept distinct from the existing pure `BLUE = rgb(0,0,1)` used for hyperlinks/change-tracking.
- The line/heading paint loop's link-only underline accumulator was generalized to any `run.underline`-flagged segment (still draws the link annotation rectangle only when the segment is an actual link).
- Table painter: header row (`r === 0`) now paints `fonts.bold`; a new pass fills `rowShading`-flagged cells with `rgb(0.85, 0.85, 0.85)` before the grid lines/text are drawn.
- New `'box'` PaintItem case: `page.drawRectangle({ borderColor: BLACK, borderWidth: 0.75 })`, no fill.

### `src/services/docx/volumeDocx.ts`
- `RUNNING_HEAD_SIZE` dropped from 24 (12pt) to 22 (11pt, half-points). Header paragraphs: center bold (not underlined), left/right-top bold **and** underlined (DOCX has no shared "row" the way the PDF's x-positioned text does — each paragraph is a separate line — so each is individually underlined instead of drawing one shared rule), right-date bold only.
- `runToChildren` generalized to also honor a plain run's `bold`/`italic`/`underline`/`color` hints (not just `changed`/`link`), and now takes an optional `size` param (front-matter headings pass `TITLE_SIZE`). New `runsToChildren`, `centeredRunsPara`, `leftParaRuns` wrap it for multi-run lines.
- `changeTable` takes an optional `shading` param and applies `{ fill: 'D9D9D9', type: ShadingType.CLEAR, color: 'auto' }` to flagged cells; row/shading data now comes from the shared `titlePageChangeRows` (same source as the PDF path).
- New `boxedBlock(children)`: **chosen approach for the bordered box** — a single-row, single-cell borderless-margin `Table` wrapping the title-block/divider paragraphs, immediately followed (no blank paragraph) by the actual change-log `Table`, so the two read as one attached grid the same way the PDF's box+table do. (Noted here per the task's "your call, note it": paragraph-level borders were considered but rejected — docx.js borders a paragraph individually, not a run of several paragraphs as one rectangle, so a table was the more faithful/simpler option.)
- `buildTitlePageChildren`/`buildChapterSection`: headings/legend/boilerplate/CANCELLATION mirror the PDF path's styled-run construction; chapter-title-page combined heading line now passes `bold: true` (overrides the `Heading1` style's `bold: false` default the same way direct run formatting always wins over paragraph style in OOXML — that default exists only so the `TableOfContents` field's heading-style-range still works, per the pre-existing Finding 4 comment).

### `tests/golden/volume/measure-pdf.py`
Added an **additive** `font` field (BaseFont, subset-tag-stripped) to each emitted row. All existing fields (`page`/`x`/`y`/`size`/`text`) and every existing consumer are unchanged.

### `tests/golden/volume/vol17-comparison.test.ts`
Added `isBoldFont`/`isItalicFont` helpers (case-insensitive substring match — works for both pdf-lib's `Times-Bold` naming and the real PDF's `TimesNewRomanPS-BoldMT` naming) and two new tests:
1. (render-only) our render paints "VOLUME 17", the legend's styled phrase (bold **and** italic), and the change-table header bold; ordinary body text (section 0101's opening line) stays regular.
2. (real-PDF comparison, `describe.skipIf(!existsSync(REAL_PDF))`) our render's bold/italic weighting on "VOLUME 17", the legend phrase, "CANCELLATION", the table header, and body text all match the real PDF's.

All 22 tests in this file pass, including against the real PDF at `C:\Users\barbc\Downloads\01_USMC_OFFICIAL\MCO_Orders\MCO 5800.16 Vol.17.pdf`.

## What was NOT changed (and why)
- Body-section heading weight (`BODY_SIZE_PT`, regular) — measured regular on the real Vol 17 page 4, contradicting the brief's hypothesis; left untouched per the task's own instruction to only change it if measurement said otherwise.
- `HEADING_SIZE_PT` (12pt) for title-page/divider/References/TOC headings — the real PDF measures these at 11pt, but the task's explicit "ground truth" list only specified weight/underline/color for these elements, not size, and only page 0/3/4 were measured (not References/TOC). Changed weight (bold) only; left size at 12pt to avoid unverified scope creep.
- Divider/chapter-title-page literal wording (e.g. our divider prints "VOLUME 17: CHAPTER 1" and a quoted title where the real PDF prints bare "VOLUME 17" and an unquoted title) — a content/structural difference, not styling, and explicitly out of this task's scope ("Do NOT change ... page bands, wrapping" plus the task's framing as a styling-fidelity pass). Bold/underline was applied to whatever text the layout already produces.
- Ladder geometry, page bands, coordinate tolerances in existing tests — untouched; no tolerance was loosened.

## Concerns
- The box's bottom edge is *not* pixel-flush with the last text line the way the real PDF's is (~3pt gap there vs. our engine's fixed one-`LEADING` (~12.6pt) line-stepping model) — I sized the gap to guarantee no overlap rather than to match the real ~3pt exactly, since the layout engine has no sub-line positioning primitive. This is a conscious, documented trade-off (see the code comment on `tableHeaderHeight - 3`), not an oversight.
- DOCX's box is a single-cell table, not a true overlay rectangle; Word will render it as a normal bordered table cell (correct visually, but its "attached to the table beneath" effect depends on there being no paragraph mark/spacing between the two tables — verified there is none).
- `titlePageChangeRows`'s 3-blank-shaded-row template only activates when `doc.changeLog` is empty (matching the real Vol 17's own "no changes yet" state, which is what was measured). The Vol 17 test fixture already carries one explicit `changeLog` entry, so that specific fixture's render does NOT exercise the blank-row/shading path — I verified it separately with a throwaway `blankVolume()` render (not committed) rather than adding a new fixture, since none of the required test files needed it.

## Commits
See git log on this branch: `fix(volume): title-page/divider/header styling fidelity (Task 20)`, covering the schema/layout/PDF/DOCX styling implementation and the measure-pdf.py/vol17-comparison.test.ts additions together.
