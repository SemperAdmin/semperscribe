# LSAM Volume Format Specification (MCO 5800.16)

**Status:** Draft v0.2 — reverse-engineered from the published volumes; geometry
and heading weight now measured per-glyph, all 16 supplied volumes scanned for
conformance (see §14). Corrections from v0.1 flagged inline.
**Purpose:** Define, element by element, the structure, placement, numbering,
and typography of a MCO 5800.16 (Legal Support and Administration Manual, "LSAM")
volume, so the app can render one dynamically the way it renders naval-letter
directives today.

There is **no published style guide** for this format. Every rule below is
derived by inspection of the official PDFs (Volumes 1, 2, 3, 6, 17 read in
full or in part; the remaining volumes conform to the same skeleton). Where the
volumes disagree with each other, the discrepancy is called out and a
**canonical** choice is recommended so rendering stays deterministic.

Related engines already in the codebase — reuse these, do not fork them:
- `src/lib/heading-policy.ts` — heading bold/underline/case per document type.
- `src/lib/indent-engine.ts` — designator placement (fixed ladder vs. content-aligned).
- `src/lib/citation.ts` — designator string generation.
- `src/lib/nldp-format.ts` — the `NLDPParagraph { level, designator, title, content }` model.

---

## 1. Mental model: this is a *manual in volumes*, not a letter

A naval-letter directive (the current `mco` type) is **one flat body** of
numbered paragraphs (`1.` / `a.` / `(1)`) with a letterhead, references,
enclosures, and a signature block. The LSAM is a different genus:

- The parent artifact is the **Order** (`MCO 5800.16`).
- The Order is split into **Volumes** (1–17+), each published as its own PDF.
- A Volume contains **front matter**, then one or more **Chapters**.
- A Chapter contains **Sections** (`0101`), which contain **Paragraphs**
  (`010101.`), which contain **Sub-paragraphs** (`A.`).
- Every page carries a **running header** and a **footer page number**.

So the render unit is a **Volume**. The data model must describe a paginated,
multi-level document with repeating page furniture — not a single letter body.

---

## 2. Document hierarchy (element inventory)

```
Order: MCO 5800.16  (Legal Support and Administration Manual)
└── Volume N
    ├── FRONT MATTER
    │   ├── Volume Title Page              (Summary of Volume Changes)
    │   ├── "This page intentionally left blank"   (verso)
    │   ├── Table of Contents
    │   ├── References                     (list + References summary page)
    │   └── [per Chapter] Chapter Divider  (Summary of Substantive Changes)
    └── BODY
        └── Chapter M
            ├── Chapter Title Page         (CHAPTER M + title)
            └── Section CCSS  (e.g. 0101)          ── ALL CAPS section heading
                ├── [body text直接]  OR
                └── Paragraph CCSSPP. (e.g. 010101.)  ── Title Case heading
                    ├── body text
                    └── Sub-paragraph A. / B. / C.     ── Title Case heading
                        └── body text
        └── Figures / Tables               (numbered, TOC-listed)
```

**Depth observed in the wild:** section → paragraph → sub-paragraph (3 levels).
Deeper levels `(1)` and `(a)` are *reserved by the numbering grammar* (§5) but
none of the read volumes use them in body text; `(a)(b)(c)` appears **only** as
the References-list designator. Render support should allow the deeper levels
but not require them.

---

## 3. Page geometry & furniture (repeats on every page)

| Element | Placement | Content | Notes |
|---|---|---|---|
| Running head — top center | Centered, top margin | `LEGAL SUPPORT AND ADMINISTRATION MANUAL` | Constant on every page of every volume. |
| Running head — top left | Flush left, below center line | Front matter/body: `Volume N` or `Volume N, Chapter M`; References: `References` | Identifies where you are. |
| Running head — top right (line 1) | Flush right | `MCO 5800.16 – V{N}` | The separator between the order number and the volume token is an **en dash** (`–`, U+2013), not a middot. It renders as `�` in naive text extraction because it's a Type0/Identity-H glyph the extractor's substitute font can't encode — confirmed by decoding the real PDF's content stream directly: the glyph's raw CID resolves via its embedded ToUnicode CMap to `<2013>` (en dash), not `<00B7>` (middot). Right header = **original publication date's identity**, never changes except on full revision. |
| Running head — top right (line 2) | Flush right, under line 1 | Effective date, e.g. `20 FEB 2018` | This is the **last-updated date** of the volume/chapter (blue font — see §7). |
| Running head — rule | Full-width, margin to margin (x≈72–540), under the left-label/right-designator row only | — | A single filled bar, **1.08 pt thick**, vertically centered ≈1.7 pt below that row's baseline — measured directly from the real PDF's content stream (`re [72.024, 730.92, 467.5, 1.08] f*`, identical on every sampled page). Not drawn under the center policy title or the date line below it. |
| Footer — bottom center | Centered, bottom margin | Page number | Numbering scheme per §6. |

**Margins / type:** single serif face throughout (Times New Roman family;
Liberation Serif is the metric-compatible substitute already used by the PDF
pipeline). Body is single-spaced with a blank line between paragraphs. Do not
mix fonts — the running head, body, and headings are all the same face, varying
only by **case and indent** (see §8 — the sampled native volumes use *no* bold
and *no* underline on body headings).

### 3.1 Measured geometry (native PDF, Volumes 1 & 6 — identical)

Measured directly from the digital source with per-glyph coordinates. Units are
PostScript points (1 pt = 1/72"). Origin is bottom-left.

| Quantity | Value | In inches |
|---|---|---|
| Page size | 612 × 792 pt | 8.5 × 11 (US Letter, portrait) |
| Left margin (body & section designator) | x = 72.0 | 1.0" |
| Right margin (text wrap edge) | x ≈ 540 (612 − 72) | 1.0"; text width 468 pt (6.5") |
| Running-head center line baseline | y ≈ 745 | 0.65" from top |
| Running-head left/right line baseline | y ≈ 731 | 0.84" from top |
| Running-head date baseline | y ≈ 718 | 1.03" from top |
| Footer page-number baseline | y ≈ 38.6 | 0.54" from bottom |
| Body font | Times New Roman, **11.0 pt**, regular | — |
| Running-head font | Times New Roman, **12.0 pt**, regular | — |
| Footer font | Times New Roman, 11.5 pt | — |
| Body leading (line-to-line) | ≈ 12.6 pt | — |
| Inter-paragraph gap | ≈ 25 pt (one blank line) | — |
| Running head — center text | centered on page center (x≈306) | `LEGAL SUPPORT AND ADMINISTRATION MANUAL` |
| Running head — left text | flush left, x = 72 | `Volume N` / `Volume N, Chapter M` |
| Running head — right text | flush right, ends x≈540 | `MCO 5800.16 – V{N}` (en dash, U+2013) + date below |
| Footer page number | centered on page center (x≈306) | — |

**Date-format variance (flag):** volumes are inconsistent —
`20 FEB 2018` (all caps) vs. `10 Feb 2021` (title case). **Canonical: `DD Mon YYYY`**
(e.g. `10 Feb 2021`); accept and normalize the all-caps form on import.

---

## 4. Front-matter elements (placement & required order)

Front matter appears once per volume, in this order. Each item begins on a new
page.

### 4.1 Volume Title Page ("Summary of Volume Changes")
Centered stack:
1. `VOLUME {N}` (all caps, centered)
2. Volume title in **quotation marks**, centered — e.g. `"LEGAL SUPPORT WITHIN THE MARINE CORPS"`
   (Some volumes drop the quotes and use plain caps — e.g. Vol 17
   `JUDGE ADVOCATE DIVISION AWARDS PROGRAM`. **Canonical: quoted**; accept unquoted.)
3. `SUMMARY OF VOLUME {N} CHANGES` (centered heading)
4. Legend line: `Hyperlinks are denoted by bold, italic, blue and underlined font.`
5. Boilerplate change-policy paragraphs (right-header-date vs. blue-left-date rules).
6. **Optional** `CANCELLATION: {directive}` line (Vol 17 cancels MCO 1650.62).
7. **Change table** (see §4.6).
8. **Optional** `Report Required:` line (Vol 17).
9. Submit-changes block (left-aligned):
   ```
   Submit recommended changes to this Volume, via the proper channels, to:
   CMC (JA)
   3000 Marine Corps Pentagon
   Washington, DC 20350-3000
   ```
10. Distribution line — **two variants**:
    - `DISTRIBUTION STATEMENT A: Approved for public release; distribution is unlimited.`
    - `DISTRIBUTION: PCN {number}` (Vol 17).
    Model both; pick per volume.

### 4.2 Blank verso
A page containing only, centered: `(This page intentionally left blank)`.
Emitted to keep each major division starting on a recto (odd) page. Renderer
should insert these on the same rule the source uses: after the title page, and
before each chapter/first body page as needed for pagination parity.

### 4.3 Table of Contents
- Title block: `VOLUME {N}: {TITLE}` then `TABLE OF CONTENTS` (centered).
- Entries: left = label, right = page number, joined by a **dotted leader**.
  - `REFERENCES ...... REF-1`
  - `CHAPTER {M}: {TITLE} ...... {M}-{page}`
  - `{CCSS} {SECTION TITLE} ...... {M}-{page}` (all caps)
  - `FIGURE {k}: {CAPTION} ...... {M}-{page}`
- **Wrapped entries** indent the continuation line to align under the title text
  (see Vol 17 §0107, §0109), not back to the margin.

### 4.4 References
- Heading `REFERENCES` (centered).
- List with **lower-alpha parenthetical designators** in a hanging indent:
  `(a) SECNAVINST 5430.7R`, `(b) …`, continuing `(aa)`, `(bb)` past `(z)`.
- After the list, a **"REFERENCES" summary page**: heading `"REFERENCES"`
  (quoted, centered) + boilerplate stating the list updates as the volume changes
  and each change must be annotated.
- Page numbers use the **REF band** (§6).
- This maps cleanly onto the existing `NLDPReference` model (`text`, `order`,
  `cited`). The `(a)` designator is generated, not stored.

### 4.5 Chapter Divider ("Summary of Substantive Changes")
One per chapter, immediately before that chapter's body. Centered stack:
1. `VOLUME {N}: CHAPTER {M}`
2. Chapter title in quotes, centered.
3. `SUMMARY OF SUBSTANTIVE CHANGES`
4. Hyperlink legend line (same as §4.1.4).
5. Change-policy boilerplate.
6. **Change table** (§4.6, chapter variant).

### 4.6 Change tables (two shapes)
**Volume-level** (title page) columns:
`VOLUME VERSION | SUMMARY OF CHANGE | ORIGINATION DATE | DATE OF CHANGES`
Seed row: `ORIGINAL VOLUME | N/A | {DD Mon YYYY} | N/A`.

**Chapter-level** (chapter divider) columns:
`CHAPTER VERSION | PAGE / PARAGRAPH | SUMMARY OF SUBSTANTIVE CHANGES | DATE OF CHANGE`
(empty until a change is logged).

Both are **append-only change logs**; each row is one revision event.

**Volume-level table's trailing blank rows:** the real Vol 17 PDF always
prints exactly 3 blank rows below whatever change rows are already recorded
(even below its own single "ORIGINAL VOLUME" seed row), each with its
ORIGINATION DATE cell shaded light gray (~0.85 gray) — a fixed template
reserved for future entries to be filled in by hand. This is unconditional:
it does not stop once the log has real entries.

---

## 5. Numbering grammar (the core rule)

The body designator system is a fixed 6-digit-plus-letter grammar. This is
**distinct** from the naval-letter `1./a./(1)` ladder and must not be routed
through the same generator without a mode switch.

**Primary (structural) ladder** — verified by measurement (§9), 4 levels deep in
the wild:

```
L1  Section        CCSS         4 digits, no period (period in V16)  e.g. 0101 / 1703.
L2  Paragraph      CCSSPP.      6 digits + period                    e.g. 010101.
L3  Sub-paragraph  X.           UPPERCASE letter + period            e.g. A.
L4  Sub-sub-para   n.           arabic + period                      e.g. 1.
(reserved deeper — see embedded-content ladder below)
```

> **Correction to v0.1:** the `1.` / `2.` arabic level (L4) *is* used in body
> text (measured in Vol 6 §010301, x=180 pt). The earlier draft called `(1)`
> "reserved and unused" — that was a grep artifact (it searched for the
> parenthesized form). The body uses **period** forms `A.` then `1.`, not parens.

Where:
- `CC` = chapter number, 2 digits, zero-padded (`01`…`17` observed; V16 reaches 17).
- `SS` = section number within the chapter, 2 digits (`01`, `02`, …).
- `PP` = paragraph number within the section, 2 digits (`01`, `02`, …).
- The **section number is the first 4 digits of its paragraphs' designators**
  — `0103` owns `010301.`, `010302.`, … This invariant lets the renderer derive
  section membership from the paragraph designator alone.

**Section-designator period (variance):** most volumes print the section number
with **no trailing period** (`0103 PERSONNEL`). Volume 16 prints it **with** a
period (`1703. PREPARATION…`). Model a `sectionPeriod` boolean per volume;
**canonical: no period** (majority), normalize on import.

**Embedded-content ladder (secondary):** verbatim documents reproduced inside a
volume — advisement scripts, checklists, sample forms (e.g. Vol 5 §2125+, Vol 15)
— use the **naval-letter correspondence ladder** instead of the structural one:
`a.` (lower-alpha + period) → `(1)` (arabic in parens) → `(a)` (lower-alpha in
parens). This is the same ladder the existing `mco`/letter pipeline already
generates, so embedded samples can reuse it. Tag such a block so the renderer
switches ladders.

**References-list ladder:** the References section uses `(a) (b) … (aa) (bb)`
(lower-alpha in parens, continuing past `z`) — designator generated, not stored.

**Continuity across the volume:** section numbers run continuously through a
chapter (`0101`…`0109`) and restart per chapter (`0201`…). In a single-chapter
volume everything is `01xx`.

**A section may contain body text directly** (no `CCSSPP.` child) — e.g. Vol 6
`0101 PURPOSE` is followed immediately by a body paragraph. Or it may contain
only numbered paragraphs. The model must allow section-level body content.

---

## 6. Page-numbering scheme (footer)

| Band | Pages | Format | Example |
|---|---|---|---|
| Front matter | title page → TOC | lower-case roman | `i`, `ii`, `iii` |
| References | references list + summary | `REF-{n}` | `REF-1`, `REF-2` |
| Body | chapters | `{M}-{page}` (chapter-hyphen-page) | `1-3`, `2-7` |

**Discrepancy (flag):** the source volumes are internally inconsistent for
single-chapter volumes — Vol 6 prints a **bare sequential number** (`1`, `2`,
`3`) while Vol 17 prints the `{M}-{page}` form (`1-1`…`1-4`). **Canonical
(as implemented):** the page band is a per-volume parameter (`pageBand`);
`auto` selects `{M}-{page}` for multi-chapter volumes and bare sequential for
single-chapter ones, and either form can be forced explicitly
(`chapter-page` / `sequential`). Footer and TOC always agree because both read
the same resolved label. A volume reproducing a specific source (e.g. Vol 17)
sets the band explicitly to match it.

The References band uses `REF-{n}` in most volumes but `REF {n}` (space) in
Vol 17. **Canonical: `REF-{n}`.**

---

## 7. Change-tracking semantics (the "blue font" system)

The LSAM tracks amendments **in-line by color**, not by change transmittal:

- **Right-header date** = original publication date. Immutable until a *full
  revision* of the whole MCO.
- **Left-header date (blue)** = date this volume/chapter was last updated.
- **Blue body text** = content added or changed since original publication.
- **Hyperlinks** = bold + italic + blue + underlined (distinguished from change-
  blue by the bold/italic/underline combination).
- On a **full revision**, all blue resets to black.

**Rendering requirement:** the model needs a per-run change flag (was-changed /
is-hyperlink) so the renderer can apply blue. This is a *character-run*
attribute, richer than the current plain-string `content`. Minimum viable
approach: store `content` as an array of runs `{ text, changed?, link?, href? }`,
or keep plain text plus a `changedSinceOriginal` boolean at paragraph
granularity for a first pass.

---

## 8. Headings & typography per level

**Measured reality (corrects v0.1):** in the native volumes, **every heading is
regular-weight Times New Roman 11 pt — no bold, no underline.** Section,
paragraph, sub-paragraph, and sub-sub headings all render in the *same font as
body text* (`/TimesNewRomanPSMT`, verified per-glyph in Vol 6). The only things
that distinguish a heading are **letter case, indent level, and standing on its
own line with the designator.** This differs from the SECNAV/MCO 5216 letter
rule in `heading-policy.ts` (bold + underline) — **do not reuse the `mco` letter
entry.** Add a distinct heading-policy entry for the manual type.

| Level | Case | Weight | Underline | Position | Trailing punct |
|---|---|---|---|---|---|
| Running head (center) | ALL CAPS | regular | no | top center | — |
| Running head (L/R) | mixed | regular | no | flush L / flush R | — |
| Volume/Chapter title (front matter) | ALL CAPS, quoted | regular | no | centered | — |
| `CHAPTER {M}` label (chapter open) | ALL CAPS | regular | no | centered | — |
| Section `CCSS` heading | ALL CAPS | regular | no | flush left (x=72) | none (period in V16) |
| Paragraph `CCSSPP.` heading | Title Case | regular | no | designator x=108 | period after number |
| Sub-para `A.` heading | Title Case | regular | no | designator x=144 | period after letter |
| Sub-sub `1.` heading | Title Case | regular | no | designator x=180 | period after number |
| Body text | sentence case | regular | no | see §9 | — |

**Caveat:** measured against Vol 1 and Vol 6 (both native, `20 FEB 2018`
printing). Later-amended volumes *could* introduce bold on changed headings;
confirm before locking if targeting a specific volume. Blue change-font (§7) is
orthogonal to weight.

---

## 9. Indentation ladder (designator & text placement)

This is a **fixed 0.5" (36 pt) ladder** with **run-over returning to the left
margin** — measured exactly, not estimated. Designator start advances one 36 pt
step per level; the following text begins at the next 36 pt stop.

| Level | Designator start x | = margin + | First-line text x | Wrapped/run-over lines |
|---|---|---|---|---|
| Section `CCSS` | 72 pt (margin) | 0.0" | title at 108 pt; body at 72 pt | 72 pt (margin) |
| Paragraph `CCSSPP.` | 108 pt | 0.5" | ≈150 pt (after the wide 6-digit token) | 72 pt (margin) |
| Sub-para `A.` | 144 pt | 1.0" | 180 pt | 72 pt (margin) |
| Sub-sub `1.` | 180 pt | 1.5" | 216 pt | 72 pt (margin) |

**Exact measured facts (Vol 6, page index 8):**
- Designator columns are **72 / 108 / 144 / 180 pt** — a clean 36 pt (0.5") step.
- Text starts **36 pt right of its designator** (`A.`@144 → `General`@180;
  `1.`@180 → text@216), except the paragraph level whose token `010301.` is wide,
  pushing text to ≈150 pt.
- **Every wrapped line — heading or body — returns to the 1" left margin (x=72).**
  This is the correspondence "run-over to margin" behavior (M-5216.5 7-2.13),
  **not** a hanging indent. Example: `010301.` heading wraps its title to x=72;
  the `A. General` body first line is at x=144 and its second line at x=72.
- Section body with **no** numbered child is **flush left at 72 pt, no first-line
  indent** (Vol 6 `0101`/`0102`).

**Engine mapping:** this is neither the pure `FixedLadderEngine` (4-space Courier)
nor the content-aligned letter engine. It is a **fixed 36 pt ladder for
designator/first-line, margin for run-over.** Add a third indent engine (or
parameterize the fixed ladder with step=36 pt and runover=margin) rather than
bending an existing one.

---

## 10. Figures & tables

- Figures are **centered graphics** (org charts in Vol 1) with a centered caption
  `Figure {k}` beneath, plus an optional legend/key block.
- Listed in the TOC as `FIGURE {k}: {CAPTION} ...... {M}-{page}` (all caps).
- Figure numbering appears **continuous within a chapter/volume** (`Figure 1`).
- For dynamic render, treat a figure as an inline block element with:
  `{ kind: 'figure', number, caption, asset, legend?[] }`, anchored at its
  paragraph position and emitted to the TOC.

---

## 11. Proposed data model (fits the existing declarative pattern)

Two layers, mirroring how the app already separates the **type definition**
(`DocumentTypeDefinition` in `i-type/definition.ts`) from the **content model**
(`NLDPParagraph` in `nldp-format.ts`).

### 11.1 Type definition (form/features)
Add a new document type `lsam-volume` with `isDirective: true`, its own feature
flags (no letterhead `From/To/Via`; yes running header, TOC, references,
change-log, figures), and form sections for the volume-level metadata:

```
order:        "MCO 5800.16" (fixed)
volumeNumber: N
volumeTitle:  string
originalPublicationDate:  date   → right header (immutable)
lastUpdatedDate:          date   → left header (blue)
cancellation:             string?         (optional)
distribution:             { kind: 'statementA' | 'pcn', value?: string }
reportRequired:           boolean
submitChangesAddress:     block (default CMC (JA) …)
```

### 11.2 Content model (the tree)
Extend the paragraph model into a **volume tree** rather than a flat list:

```jsonc
Volume {
  meta: { volumeNumber, volumeTitle, originalPublicationDate, lastUpdatedDate,
          cancellation?, distribution, reportRequired },
  changeLog: [ { version, summary, originationDate, dateOfChanges } ],
  references: [ NLDPReference ],           // designator (a),(b)… generated
  chapters: [
    Chapter {
      number: M,
      title: string,
      changeLog: [ { version, pageParagraph, summary, dateOfChange } ],
      sections: [
        Section {
          designator: "0103",              // CCSS
          title: "PERSONNEL",              // ALL CAPS
          body?: [ Block ],                // section-level body text (optional)
          paragraphs: [
            Paragraph {
              designator: "010301.",       // CCSSPP.
              title: "Roles and Responsibilities…",   // Title Case
              body: [ Block ],
              children: [
                SubParagraph {
                  designator: "A.",
                  title: "General",
                  body: [ Block ],
                  children: [ … ]          // reserved (1)/(a) levels
                }
              ]
            }
          ]
        }
      ],
      figures: [ Figure { number, caption, asset, legend? } ]
    }
  ]
}

Block  = Paragraph of runs: [ { text, changed?, link?, href? } ]   // §7
```

- **Designators are derived, not authored** where possible: `CC` from the
  chapter, `SS`/`PP` from position. Store them explicitly only to survive edits
  and to keep round-trip export deterministic (same reasoning as
  `NLDPParagraph.designator`).
- The `changed`/`link` run flags drive the blue-font rendering (§7).
- Page numbers (`i`, `REF-1`, `1-3`) are **computed at layout time**, never
  stored — they follow the bands in §6.

---

## 12. Rendering rules — order of operations

1. Emit **Volume Title Page** (§4.1) → roman `i`.
2. Emit blank verso if parity requires → `ii`.
3. Emit **References** list + summary (§4.4) → `REF-{n}`.
4. Emit **Table of Contents** (§4.3) — generated last-pass once page numbers are
   known (two-pass layout, or reserve-and-fill).
5. For each chapter M:
   a. Emit **Chapter Divider** (§4.5).
   b. Emit blank verso if needed.
   c. Emit **`CHAPTER {M}` + title** page.
   d. Walk sections → paragraphs → sub-paragraphs, applying §8 headings and §9
      indentation; number footer pages `{M}-{page}`.
   e. Emit figures at their anchors; register them with the TOC.
6. Running header/footer (§3, §6) painted on every page by the page template,
   driven by current `{Volume, Chapter, band}` context.
7. Apply blue to changed runs and hyperlinks (§7).

Because the TOC and cross-references depend on final pagination, the renderer
must be **two-pass** (or use deferred page-number tokens) — this is the main
structural difference from the single-pass letter pipeline.

---

## 13. Open items — status

| # | Item | Status |
|---|---|---|
| 1 | Exact margins & indent stops (§3.1, §9) | **CLOSED** — measured: Letter page, 1" margins, 36 pt ladder, run-over to margin. |
| 2 | Heading bold/underline (§8) | **CLOSED** — native volumes use regular Times, no bold, no underline. (Re-confirm on a heavily-amended volume if targeting one.) |
| 3 | Blank-verso insertion rule (§4.2) | **Partly open** — behaves as recto-start; exact trigger not formally proven. Recommend: insert to force each chapter to a recto. |
| 4 | Footer scheme for single-chapter volumes (§6) | **CLOSED** — source truly prints a bare sequential number (Vol 6 → `4`) while the TOC cites `1-{n}`. Canonical render = `{M}-{page}`; import normalizes. |
| 5 | Deeper numbering levels (§5) | **CLOSED** — body uses `A.` then `1.`; embedded samples use `a.`→`(1)`→`(a)`; References use `(a)`. |
| 6 | Change-log table borders/column widths (§4.6) | **Open** — low priority; measure only when the table renderer is built. |

---

## 14. Conformance coverage (all supplied volumes)

Extracted and structurally scanned: Volumes **1, 2, 3, 5, 6, 7, 8, 9, 10, 11,
12, 14, 15, 16, 17** (Volume 4 was not supplied). Every one carries the same
skeleton — title page, "Summary of … Changes", hyperlink legend, TOC, References,
chapter divider(s), and the `CCSS` / `CCSSPP.` numbering grammar — with only the
parameterized variances already modeled (distribution kind, date format, chapter
count, section-period, page-number band).

**Two exceptions to note:**

- **Volume 13 — not machine-readable.** The supplied PDF has **no text layer**
  (0 embedded fonts, 5 bytes extracted): it is a **scanned image**. Its structure
  could not be verified and it cannot be imported without **OCR** first. Flag to
  the user: obtain a native Vol 13 or OCR it.
- **Volume 16 — large-volume variant (still conformant).** 17 internal chapters,
  315+ numbered paragraphs, Records-of-Trial content. It exercises three
  parameterized variances at once: (a) chapter numbers reach **17** (`17xx`),
  (b) section designators carry a **trailing period** (`1703.`), and (c) footer
  uses **plain sequential** page numbers, with the TOC citing them plainly too.
  No new grammar — just the outer edges of the existing one. Good stress-test
  fixture for the renderer.

**Accepted canonical deltas vs. Vol 17 (user-ratified 2026-09-21):** the
renderer prints `REF-1` (hyphen; Vol 17's `REF 1` is the outlier), lists the
`CHAPTER {M}:` line in the TOC even for single-chapter volumes (Vol 1 does;
Vol 17's omission is a source quirk), and prints the section designator in the
TOC with the same trailing period as the body (`0101.`; Vol 17's own TOC and
body disagree with each other on this).

**Variance dimensions confirmed across the set (all must be parameters, not
hard-codes):**

1. Distribution: `DISTRIBUTION STATEMENT A` (most) vs `DISTRIBUTION: PCN {n}` (Vol 17).
2. Date format: `20 FEB 2018` (caps) vs `10 Feb 2021` / `8 MAR 2021` (title/mixed). Canonical `DD Mon YYYY`.
3. Section-designator period: absent (most) vs present (Vol 16).
4. Chapter count: 1 (Vol 6, 17) … 17 (Vol 16).
5. Volume title quoted vs unquoted.
6. `CANCELLATION:` / `Report Required:` lines present or absent (Vol 17).
7. Page-number band: `{M}-{page}` (multi-chapter) vs bare sequential (single-chapter / Vol 16).

---

*Derived from: MCO 5800.16 Volumes 1–3, 5–12, 14–17 (Vol 4 not supplied; Vol 13
scan-only). Geometry (§3.1, §9) and heading weight (§8) measured per-glyph from
the native Volumes 1 and 6. Remaining open items are listed in §13.*
