# Phase 1 Golden-File Diff Justifications

Workflow rule: every golden snapshot diff hunk carries a citation.
This log covers each S-step of Phase 1 as it lands.

## S1 — Indent engine split (G1)

Date: 2026-06-09. Files: `src/lib/indent-engine.ts` (new),
`src/lib/font-metrics.ts` (generated, new),
`scripts/generate-font-metrics.mjs` (new),
`src/lib/paragraph-formatter.ts`, `src/lib/docx-generator.ts`,
`src/components/pdf/NavalLetterPDF.tsx`.

### What changed in the DOCX golden file

Every hunk falls into exactly two classes, both confined to body
paragraph `pPr`/run elements. No heading, margin, signature, or
spacing hunks are present in the S1 diff.

| Hunk class | Before | After | Authority |
| :--- | :--- | :--- | :--- |
| Indent model | `w:tabs` + `w:ind w:left/w:hanging` (fixed 0.25-inch cascade: 360/720/1080/...) | `w:ind w:firstLine` at measured position (0, 0, 300, 587, 926, 1212, 1553, 1839, 2179 twips for the 8-level fixture chain) | SECNAV M-5216.5 Fig 7-8: each subdivision aligns under the first letter of the parent paragraph's text. Content-relative, computed from TNR advance widths (audit line 66). Runover lines return to the left margin — hence firstLine, not hanging (M-5216.5 7-2.13; audit line 43) |
| Designator gap | Tab character to next tab stop | Two non-breaking spaces after period designators, one after parenthesized | M-5216.5 typewriter model carried to proportional type; mirrors pre-existing Courier-path rule, now uniform |

Spot verification of measured positions (TNR 12pt, 20 twips per point):
"1." + 2 spaces = 6+3+6 = 15pt = 300 twips, so level 2 starts at 300.
Level 3 starts at 300 + ("a." = 8.33pt) + 6pt = 586.5 → 587 twips.
Courier correspondence reproduces the typewriter 4-column ladder for
single-digit designators (0/4/8/12 chars) and correctly shifts to 5
columns under "10." — the fixed ladder cannot do this.

### What changed in the PDF golden file

Identical geometry expressed in points: level-2 designator at
margin+15pt (x=87.0), level 3 at x=101.3, level 4 at x=118.3, level 5
at x=134.6 — each equal to its parent's text start. DOCX and PDF agree
to within 0.05pt at every level (Liberation metrics are TNR
metric-compatible).

Implementation note: react-pdf applies `textIndent` only when the
first Text child is a non-empty string. Levels 5-8 lead with a nested
underlined Text, so the renderer emits a zero-width space (U+200B)
first. Verified by extraction test: no width consumed, no artifact in
the PDF text layer.

### What did NOT change

Heading block (From/To/Via/Subj/Ref/Encl), letterhead, SSIC block,
date, signature block, margins, page size, fonts. Directive paths
(mco, bulletin, change-transmittal) are untouched and keep the
pre-Phase-1 behavior via fallback until Phase 3 (`FIXED_LADDER`,
preserved verbatim in indent-engine.ts with a unit test pinning the
legacy values).

### Parity status after S1

Page-fill pagination parity: GREEN. Full suite 818/818.

## S2 — Blank-line spacing model (G2)

Date: 2026-06-09. Files: `src/lib/docx-generator.ts`,
`src/lib/doc-settings.ts`, `tests/docx-spacing.test.ts` (new).

### What changed in the DOCX golden file

One hunk class, 190 lines: every bare `<w:p/>` empty paragraph becomes
an empty paragraph whose paragraph mark carries an explicit Times New
Roman 12pt run (`w:sz 24`).

| Hunk class | Before | After | Authority |
| :--- | :--- | :--- | :--- |
| Blank-line height | `<w:p/>` — height falls to Word's default style, not body size | Empty paragraph with explicit body font/size run — exactly one 12pt line | M-5216.5 7-2.13: next paragraph "begins on the second line below"; the separating blank line is one full line of body type |

Root cause: `createEmptyLine(font, size)` accepted both arguments and
ignored them. Observed symptom in Word: cursor on a blank line showed
the template default font, not TNR 12.

Also: `DOC_SETTINGS.spacing.after = 120` (6pt) removed from
doc-settings.ts. Verified dead code — no call site consumed it; the
audit's G2 citation pointed at this line.

### Deliberately NOT changed (scope rulings)

MOA/MOU header stack (6pt gaps), staffing-paper decision grids,
Reports Required list, and directive DISTRIBUTION/PCN blocks keep
their 6pt after-spacing: the PDF emitter uses the same 6pt
(`marginBottom: 6`) for these elements, so the emitters already agree
and the audit names no rule for these internal stacks. The directive
distribution block falls under Phase 3 item 6 regardless.

### What changed in the PDF golden file

Nothing. S2 is a DOCX-only correction; the PDF pipeline already used
the full-line model for body paragraphs.

### Parity status after S2 (see S3 below for later state)

Page-fill pagination parity: GREEN (DOCX blank lines grew to full
height and both pipelines still break at the same paragraph).
Full suite 820/820, including two new spacing tests asserting no
6pt after-spacing and full-height blank lines in the fixture letter.

## S3 — Continuation-page header geometry (G3 companion)

Date: 2026-06-09. Files: `src/lib/docx-generator.ts`,
`src/components/pdf/NavalLetterPDF.tsx`,
`tests/continuation-header.test.ts` (new).

### Rule implemented

M-5216.5 (audit line 46): continuation pages repeat the Subj line
starting on the 6th line from the page top; body text resumes on the
2nd line below. On the 6-lines-per-inch grid: Subj top = 5/6 inch
(60pt / 1200 twips from the page edge), body top = 7/6 inch (84pt /
1680 twips). The implementation model is the audit's own (line 62):
the Subj lives in the page header, `titlePg` suppresses it on page 1.

### DOCX changes

| Hunk | Before | After | Authority |
| :--- | :--- | :--- | :--- |
| `w:header` 708 → 720 (single golden hunk) | Word default 0.49in header origin | 0.5in origin so header lines land on the 6-per-inch grid | M-5216.5 7-2.14; audit 46/62 |
| Continuation header content (header part, outside document.xml golden) | Subj at the header origin (~line 4), body resumed at ~0.83in | Two 12pt spacer lines, Subj on line 6, one trailing blank line; Word pushes body to line 8 (1.166in) | same |

The 1-inch continuation margin lands de facto: body ink on pages 2+
begins at 1.166in, below the 1-inch floor, via header push. The
literal `w:pgMar w:top` stays 720 because the section margin also
governs page 1, where the letterhead zone legitimately starts at
0.5in (M-5216.5 2-2.12b). Moving the letterhead into the first-page
header to permit a literal 1440 top margin is a larger restructure
affecting every document type; flagged for a Gate 1 ruling.

### PDF changes

Naval continuation header nudged from 44pt to 60pt from the page top
(CONTINUATION_SUBJ_OFFSET); body spacer retuned so text resumes at
84pt (CONTINUATION_SPACER_NAVAL = 40). Directive and civilian
continuation headers keep their legacy geometry untouched (Phase 3-4
scope). Page-1 PDF golden file: byte-identical, no change.

### Verification

`tests/continuation-header.test.ts`: PDF page-2 extraction asserts
Subj top distance within line 6 (60-72pt) and first body line within
line 8 (84-96pt); DOCX header part asserts exactly two 12pt spacers
before Subj, one blank after, `w:header="720"`. Parity GREEN.
Full suite 822/822.

## S3.1 — Pagination parity bias and signature offset (user-reported)

Date: 2026-06-09. Trigger: user observed (a) a letter rendering one
page in Word but two in PDF, and (b) one extra blank line above the
signature. Files: `src/lib/pdf-settings.ts`, `src/lib/docx-generator.ts`,
`src/components/pdf/NavalLetterPDF.tsx`, `tests/signature-offset.test.ts` (new).

### Defect 1 — systematic PDF/DOCX page-capacity bias

Two sources, both PDF-side, quantified:

| Source | Before | After | Authority |
| :--- | :--- | :--- | :--- |
| PDF top margin | 44pt (arbitrary) | 36pt = 0.5in, equal to the DOCX 720-twip top margin; letterhead first line on the 4th line from the page top | M-5216.5 2-2.12b; pagination parity (G8) |
| PDF gap heights | 14pt per blank line/paragraph gap | 13.8pt = the natural TNR line at 12pt ((1825+443+87)/2048 x 12), identical to what Word uses for the DOCX blank lines | font-metric parity (G2/G8) |

Continuation constants now derive from PDF_MARGINS.top, so the S3
6th-line/8th-line geometry is unchanged (tests still assert 60/84pt
absolutes and pass).

### Defect 2 — signature on the 5th line below text

The body loop emitted a trailing blank-line spacer after EVERY
paragraph including the last; the signature block adds three blank
lines; total four. M-5216.5 7-2.16: three blank lines, signature on
the 4th. Fix in both emitters, correspondence only:

- DOCX: trailing spacer suppressed after the last body paragraph
  (standard and DLA branches). Civilian/DLA closing blocks gained
  their own leading blank line, preserving "close on 2nd line below".
- PDF: last ParagraphItem's marginBottom suppressed via isLast prop;
  bodySection's bottom gap suppressed when the naval signature block
  follows. Civilian closings keep the bodySection gap (their 2nd-line
  rule was already satisfied by it).
- Directives intentionally keep the trailing spacer: MCO signature
  belongs on the 5th line (MCO 5215.1K para 37) until the Phase 3
  sigOffsetLines parameter formalizes it.

### Golden diffs

PDF: all 93 layout lines shift vertically (top margin + gap change);
x-columns verified byte-identical (0 differences). DOCX: one fewer
trailing empty paragraph before the signature block.

### Verification

`tests/signature-offset.test.ts`: DOCX asserts exactly three blank
paragraphs between the last body text and the signature, text on the
4th; PDF asserts the signature baseline sits 4 x 13.8pt below the last
body baseline. Parity GREEN. Full suite 824/824.

## S3.2 — DOCX letterhead position (user-reported)

Date: 2026-06-10. Trigger: after S3.1, the PDF letterhead sat at 0.5in
while Word's sat ~0.17in lower. Files: `src/lib/docx-generator.ts`.

### Root cause

The first-page header held the seal's anchor paragraph. The seal image
floats page-relative, but its anchor paragraph still occupies one line
in the header zone, and Word pushes the body below header content -
so the letterhead title started at ~0.67in, not 0.5in. The old PDF top
margin (44pt) coincidentally matched the defect; the S3.1 margin
correction exposed it. M-5216.5 2-2.12b requires the first letterhead
line on the 4th line from the page top = 0.5in, so the DOCX moves up
to the PDF, not the PDF down.

### Change

Seal ImageRun anchor relocated from the first-page header to the first
letterhead body paragraph. Identical page-relative float position
(458700 EMU = 0.5in both axes). First-page header is now empty (or
FOUO banner only, for DLA - banner-above-letterhead is intentional
there). Golden diff: one hunk, the drawing element appearing in the
first body paragraph.

### Verification

Full suite 824/824, parity GREEN. Word and PDF letterhead first lines
both start at 0.5in from the page top.

## S3.3 — DEFERRED: letterhead at spec position (USER RULING 2026-06-10)

Status: S3.2 REVERTED and PDF top margin restored to 44pt by user
ruling. Both emitters now render the letterhead at the long-validated
visual position (~0.61-0.67in from the page top) so Word and PDF match
each other. This matches neither M-5216.5 2-2.12b (first letterhead
line centered on the 4th line from the page top = 0.5in) nor audit
line 40 (seal 1in diameter at 0.5in top-left, title on 4th line).

Open items parked here for a future ruling:

1. Letterhead vertical position: spec is 0.5in for the title's first
   line. The compliant implementation exists in git history (S3.2 -
   seal anchor in the first body paragraph, PDF top 36pt) and was
   reverted intact; reapplying is mechanical.
2. DOCX seal anchor offset is 458700 EMU = 0.5016in; exact 0.5in is
   457200 EMU. Sub-visible (0.1pt). True up when item 1 is reapplied.
3. LibreOffice anomaly discovered during measurement: with an empty
   first-page header, soffice renders the first body line at ~7pt from
   the page top (Word does not). Constrains the parity harness: page-1
   vertical positions from soffice are not trustworthy for header
   variants; Word remains the authoritative check for page-1 geometry.
4. Pagination note: restoring top 44pt reintroduces ~8pt of page-1
   capacity bias versus Word (PDF fits one line less in edge cases).
   The dominant divergence sources (signature extra line, 14pt vs
   13.8pt gaps) remain fixed, so flips should be rare. If a letter
   paginates differently again, this is the first suspect.

## S4 — Business/exec/DLA closing blocks start at page center (G4)

Date: 2026-06-10. Files: `src/lib/docx-generator.ts`,
`src/components/pdf/NavalLetterPDF.tsx`, `tests/closing-blocks.test.ts` (new).

### DOCX changes

| Hunk class | Before | After | Authority |
| :--- | :--- | :--- | :--- |
| 11 closing paragraphs (DLA memo name/rank/title/delegation; DLA business close/name/delegation; business-exec close/sig/rank/title) | `AlignmentType.CENTER` — text centered on the page | `indent: { left: 4680 }` — block begins at page center, left-aligned ("Begin at the center of the page, but do not center") | M-5216.5 11-2.8/11-2.9; MCO 5216.20B Sec 12 2.f; audit G4 |
| Close-to-signature gap (DLA business + business/exec) | 2 blank lines (signature on 3rd line below close) | 3 blank lines (signature on 4th line below close) | M-5216.5 11-2.9; MCO 5216.20B Sec 12 2.f |

Untouched: MOA witness-table cell centering (MOA layout, separate
rules); DLA memo's 4 blank lines before the name (DLA Ch.3-2 16-17
count kept; only the alignment changed); from-to-memo PDF signature
text uses textAlign center — parked, not in the G4 list, flag for S6
or a ruling.

### PDF changes

Closing blocks already began at 234pt (3.25in) left-aligned — already
compliant on G4's core. Only the close-to-signature gap changed:
sectionGap x2 to x3 in the two close blocks (DLA business,
business/exec), matching the DOCX 4th-line rule.

### Verification

`tests/closing-blocks.test.ts` (4 tests): asserts no `w:jc center` and
`w:ind left=4680` on close and signature paragraphs for business
letter, DLA memorandum, DLA business letter; asserts exactly 3 blank
paragraphs between close and signature. Golden files unchanged (the
basic-letter fixture has no civilian closing). Parity GREEN.
Full suite 828/828.

USER RULING 2026-06-10: all DLA-specific work is out of scope going
forward. Existing DLA tests stay as regression cover; no new DLA
features or corrections.

## S5 — Level 5-8 designator underlines verified, both emitters (G6)

Date: 2026-06-10. Files: `tests/underline-verification.test.ts` (new).
ZERO production-code changes — verification found both emitters
already correct; the gap (G6) was the absence of proof, and the proof
now exists as output-byte assertions.

### DOCX evidence

For a clean 8-level chain (no <u> markup in content), document.xml
shows for each of levels 5-8 exactly ONE underlined run containing
only the designator character; sibling runs holding the period or
parentheses carry no `w:u`; levels 1-4 contain no underline anywhere.

### PDF evidence

react-pdf draws each underline as a vector path. The content stream
contains exactly four zero-height horizontal paths (after excluding
the seal image's bounding box), with widths equal to the glyph
advances at 12pt: 6.0pt (digit "1", levels 5/7) and 5.33pt ("a",
levels 6/8). Width-matching proves only the character is underlined —
a period under the line would widen it by 3pt, a parenthesis by 4pt.

### Verification

3 tests, all green on first run against unmodified production code.
Full suite 831/831 (run sharded; the suite now exceeds one sandbox
call's 45s budget). Parity GREEN.

### S5.1 — Courier opening parenthesis (user-reported)

Date: 2026-06-10. File: `src/components/pdf/NavalLetterPDF.tsx`.
The PDF Courier branch's underline JSX emitted the inner character
and the closing parenthesis but never the opening one — levels 7-8
rendered "1)" / "a)" instead of "(1)" / "(a)". Times branches carried
the `citation.includes('(') && '('` guard; Courier lacked it.
Pre-existing defect; the S5 verification ran Times only, which is how
it survived S5. Fix mirrors the Times guard. DOCX was correct (shared
citationRuns include the paren run). New regression test renders the
Courier chain and asserts the level 7/8 lines begin "(1)" and "(a)" —
red before the fix ("1) Level sev"), green after. Suite 832/832.

## S6 — keepNext / widow-orphan and the signature two-line rule

Date: 2026-06-10. Files: `src/lib/paragraph-formatter.ts`,
`src/lib/docx-generator.ts`, `src/components/pdf/NavalLetterPDF.tsx`,
`tests/keep-rules.test.ts` (new).

### DOCX

| Hunk class | Change | Authority |
| :--- | :--- | :--- |
| Every correspondence body paragraph | explicit `w:widowControl` (no 1-line fragments at page edges) | M-5216.5 7-2.16 two-line discipline |
| Last body paragraph (naval-signature letters) | `w:keepNext` — binds its last line to the signature block; with widow control the signature page carries at least two text lines | M-5216.5 7-2.16 |
| Three signature blanks | `w:keepNext` — the blank-blank-blank-signature stack can never split | same |

Signature line itself is NOT keepNext (nothing follows it to bind to).
Golden diff: 19 lines, three classes above, nothing else.

### PDF

Signature blocks render with `wrap={false}` (block never splits);
correspondence body Texts carry `orphans={2} widows={2}`.
LIMITATION, recorded honestly: react-pdf has no primitive equal to
Word's keepNext-plus-widow interaction, so "at least two body lines on
the signature page" is approximated by wrap={false} + the 2-line
orphan floor. A letter whose last paragraph ends exactly at the page
boundary can still put only the signature block on the final PDF page.
Closing the gap fully needs a measure-and-insert-break pass at render
time; defer unless observed in practice.

### Verification

`tests/keep-rules.test.ts`: last body paragraph keepNext+widowControl,
earlier paragraphs not keepNext, three blanks keepNext, signature line
not. Suite 834/834 (sharded). Parity GREEN.

## S7 — Heading colon-space counts (USER RULING: font-split)

Date: 2026-06-10. Files: `tests/heading-spacing.test.ts` (new).
ZERO production-code changes.

### Courier (typewriter model) — asserted literally

From 2, To 4, Via 3, Subj 2, Ref 3, Encl 2 spaces after the colon;
every first-entry caption is exactly 7 characters, so all heading
content shares one column; continuation entries land at column 7.
Matches the manual's monospace figures.

### Times (proportional) — audit counts asserted by measurement

The audit's counts (From 2, To 6, Via 5, Subj 3, Ref 4, Encl 3 —
audit line 42) exist to land proportional heading content at a common
column. Measured at TNR 12: five of six counts cluster within 1.34pt
(under half a space); the implemented column — DOCX tab stop at 720
twips, PDF 36pt label width — sits within half a space of the cluster
mean. Tests pin the counts, the cluster, and the implementation's
conformance. The exact uniform column is retained rather than
replacing it with the space-approximation it encodes.

### AUDIT ANOMALY DISCOVERED AND PINNED — flag for SME (joins C5/C9)

"Ref:" and "Via:" have identical caption widths (20.66pt at TNR 12),
yet audit line 42 assigns Via 5 spaces and Ref 4. Equal captions
cannot need different counts for a common column; Ref+4 measures
32.66pt, 2.3pt short of the cluster. A dedicated test documents the
inconsistency and will flip deliberately if the audit is corrected.
The implementation keeps Ref at the same 36pt column as every other
heading.

### Verification

11 tests. Suite 845/845 (sharded: 16 + 829). Parity GREEN.

# GATE 1 PACKAGE — Phase 1 complete, ready for review

Scope delivered: S1 indent engine split (G1), S2 blank-line spacing
(G2), S3 continuation header geometry (G3 companion), S3.1 pagination
bias + signature 4th-line (user-reported), S4 closing blocks (G4),
S5/S5.1 underline verification + Courier paren fix (G6), S6 keep
rules (two-line discipline), S7 colon-space assertions. G5
(sigOffsetLines parameter) is Phase 3 by design — directives retain
5th-line behavior via the preserved trailing spacer.

State: 845 tests green, pagination parity GREEN, every golden diff
hunk justified above with citations, zero unexplained diffs.

Open items for the Gate 1 ruling:
1. S3.3 deferral — letterhead at 0.5in spec position (currently at
   the user-preferred matched visual position; reapply is mechanical).
2. Audit Ref-count anomaly (S7) — SME confirmation, joins C5/C9.
3. From/To address runover alignment under the first word (audit line
   42 tail) — not yet implemented in either emitter; propose for
   Phase 2 alongside the heading validators.
4. react-pdf two-line signature limitation (S6) — approximation
   documented; close fully only if observed in practice.
5. DLA: all DLA work out of scope per user ruling 2026-06-10.
