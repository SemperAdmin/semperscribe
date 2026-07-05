# SemperScribe Core Concepts Update Plan — Naval Letter First, Directives Second

**Date:** 2026-06-09
**Basis:** POLICY_COMPLIANCE_AUDIT.md (four-instrument audit) diffed against the current codebase.
**Workflow rule:** no functional change ships without explicit approval. Each phase ends at an approval gate. Phases are sized to be independently testable and revertible.

---

## VERIFIED CODE-LEVEL GAPS (evidence, not speculation)

Each item below was confirmed by direct read of the source file, not inferred.

| # | File | Current value | Required value | Authority |
| :- | :--- | :--- | :--- | :--- |
| G1 | `src/lib/paragraph-formatter.ts:55` `NAVAL_TAB_STOPS` | Fixed 0.25-inch cascade (360 twips per level, citation 0/360/720/1080...) | Naval letter: each subdivision aligns under the first letter of the parent paragraph (content-relative). USMC directives: fixed 4-space ladder, Courier 12 = 576 twips per level (0/576/1152/1728...) | M-5216.5 Fig 7-8; MCO 5215.1K para 33 |
| G2 | `src/lib/doc-settings.ts:13` `spacing.after: 120` (6pt) | Full blank line between paragraphs ("begins on the second line below") = 240 twips at 12pt, or explicit empty paragraph matching the PDF model | M-5216.5 7-2.13 |
| G3 | `src/lib/doc-settings.ts:7` `top: 720` (0.5 inch) | 1-inch margins each page. First page letterhead zone is a legitimate exception (DON line on 4th line from page top), but continuation pages must carry a 1-inch top margin. Needs page-1 vs page-2+ differentiation, currently a single value | M-5216.5 7-2.1, 2-2.12b |
| G4 | `src/lib/docx-generator.ts:1497-1559` business/exec/DLA closing and signature | `AlignmentType.CENTER` (text centered) | Block STARTS at page center, left-aligned ("Begin at the center of the page, but do not center") — same indent model the naval path already uses at 4680 twips | M-5216.5 11-2.8/11-2.9; MCO 5216.20B Sec 12 2.f |
| G5 | `src/lib/docx-generator.ts:1581-1583` naval signature | 3 empty lines (4th-line rule) applied universally | Correct for naval letter and SECNAV directives. WRONG for MCO orders, which require the 5th line (4 empty lines). Needs `sigOffsetLines` parameter keyed to archetype | MCO 5215.1K para 37 (verified quote, line 1466 of source) |
| G6 | `src/lib/paragraph-formatter.ts:115-119` levels 5-8 | Citation strings correct; underline of designators at levels 5-6 unverified in render paths | Levels 5/6 designators are underlined per Fig 7-8 | M-5216.5 Fig 7-8 |
| G7 | Font policy (all generators) | User-selectable Times/Courier on any document type | Archetype-locked: correspondence TNR 12 preferred; SECNAV directives Courier New 12 ONLY; USMC directives Courier 10 or 12. Free choice is a compliance defect on directives | Audit matrix C1 |
| G8 | No CI, no snapshot tests (vitest unit tests only) | Page-break parity and golden-file regression are prerequisites for safely changing geometry constants | Project target: DoD-adoption readiness |

Verified-correct items (do not touch): signature indent 4680 twips = page center for 8.5-inch sheet; 1440-twip side margins; levels 1-8 citation string generation; reference letter generation past (z) via `numberToLetter`; DISTRIBUTION_STATEMENTS table exists (verify text verbatim in Phase 3); Liberation Serif/Mono in PDF preview is metrically compatible with TNR/Courier New and is a defensible parity strategy — keep, but DOCX must continue declaring the true font names.

---

## PHASE 0 — Parity Harness (prerequisite, no user-visible change)

Goal: make geometry changes provable before making them.

1. Golden-file tests: serialize generated DOCX document XML and PDF text-layout extraction for a fixed fixture letter. Commit as snapshots.
2. Page-fill parity test: a fixture sized to fill page 1 exactly; assert PDF and DOCX break to page 2 at the same paragraph.
3. Enable CI (vitest already configured, `.github/workflows` has CodeQL and deploy only).

Acceptance: snapshots green on baseline, parity test red or green honestly recorded.
**GATE 0: approve before any Phase 1 work.**

---

## PHASE 1 — Naval Letter Geometry Corrections (G1-G6 for correspondence)

1. **Indent engine split.** Introduce `IndentEngine` interface with two implementations: `RelativeIndentEngine` (correspondence — designator-width-measured, align-under-parent per Fig 7-8) and `FixedLadderEngine` (kept at current behavior until Phase 3 retunes it for directives). Wire correspondence types to the relative engine. NAVAL_TAB_STOPS becomes engine-internal, not a shared constant.
2. **Paragraph spacing.** Replace 6pt spacing-after with full-blank-line model in DOCX, matching the PDF pipeline. One model, both emitters.
3. **Margins.** Differentiate first page (letterhead accommodation) from continuation pages (strict 1 inch). Verify continuation header: subject repeated, text resumes 2nd line below, start at 6th line from page top.
4. **Business/exec closing blocks.** Replace CENTER alignment with start-at-center indent (4680 twips), close on 2nd line below text, signature 4th line below close.
5. **Level 5-6 underlines.** Verify and fix in both emitters.
6. **Two-line rules.** `keepNext`/widow-orphan enforcement: signature page carries ≥2 text lines; no paragraph orphaned at page bottom.

Acceptance: golden files updated with cited justification per diff hunk; parity test green; heading colon-space counts (From 2, To 6, Via 5, Subj 3, Ref 4, Encl 3) asserted in unit tests.
**GATE 1: review diff against audit citations, approve before merge.**

---

## PHASE 2 — Naval Letter Conditional Logic and Validators

1. Via numbering only when 2+ vias; unnumbered single via.
2. Reference rules: every ref cited in text (validator), order-of-first-citation, (aa)+ past 26, NOTAL and undated annotations, sep-cover and per-addressee encl notations.
3. More than 4 action addressees → Distribution line replaces To line.
4. Window-envelope validator: reject when address >5 lines, any Via present, or classification set. Hard block, not a warning.
5. Structural validators: if 1a exists then 1b must (every level); subdivision requires ≥2 children; never subdivide past level 8.
6. Date format enforcement by slot: abbreviated (15 Feb 09) in sender symbols, standard (5 May 2015) in text, civilian (May 23, 2014) for business letters.
7. Salutation/close computation per MCO 5216.20B: colon vs comma, Sincerely vs Very respectfully — single shared function feeding all three emitters.

Acceptance: validator unit tests per rule with citation comments; preview shows validation errors inline.
**GATE 2.**

---

## PHASE 3 — Directives Core (MCO and MCBul first)

1. **Archetype font policy (G7).** `fontPolicy` map: USMC directive = Courier/Courier New 10 or 12; SECNAV directive = Courier New 12 only; correspondence unchanged. Font selector constrained by document type.
2. **Fixed 4-space ladder retune.** FixedLadderEngine: 576 twips per level at Courier 12 (480 at 10pt), continuation lines return to left margin (no hanging indent), two spaces after `1.`/`a.` designators, one after `(1)`/`(a)`. Two spaces after sentence periods, one after parentheses (directives only).
3. **Signature offset parameter (G5).** `sigOffsetLines`: 5 for MCO/MCBul, 4 for naval letter and SECNAV directives.
4. **ID block.** Flush-right stack (designation / sponsor code / date dd Mmm yy(yy)), longest line flush with right margin; designation line caps + underline on 2nd line below date.
5. **Mandatory paragraph schemas.** MCO: Situation, Cancellation (second when present), Mission, Execution (Commander's Intent and Concept of Operations / Subordinate Element Missions / Coordinating Instructions), Administration and Logistics, Command and Signal. MCBul: Purpose-first ladder plus "Canc:" / "Canc frp:" line in upper right, 2nd line above SSIC position, last-day-of-month validator, 12-month ceiling.
6. **Distribution.** Verify DISTRIBUTION_STATEMENTS text verbatim against MCO 5215.1K Ch 1 para 19; DISTRIBUTION 2nd line below signature, caps, left margin; Copy to colons aligned; PCN field.
7. **Reports Required.** ≤4 on promulgation page; ≥5 generates a Reports Required page immediately after the signature page.

Acceptance: fixture MCO and MCBul render byte-stable in all three pipelines; designator column positions asserted at 0/4/8/12 chars in PDF text extraction.
**GATE 3.**

---

## PHASE 4 — Directives Pagination and SECNAV Variants

1. Section-variant page numbering: front matter roman (with renumber cascade when Locator Sheet or Record of Changes absent), chapters 1-1, appendix A-1 with "Appendix A" flush right in the same footer line, enclosure pages footed "Enclosure (n)" bottom right.
2. Running header: ID block 1 inch from top right on continuation pages, date on next line; SECNAV variant omits originator code after page 1.
3. SECNAV instruction/notice: 5-page text cap validator (hard block on export), notice Canc line and self-cancel ladder, mandatory Purpose / Cancellation / Forms-last ordering, references-overflow-to-enclosure rule.
4. Revision suffix validators: skip I and O (SECNAV), skip I, O, Q (USMC); suffix after Z requires new point number.

Acceptance: page-label assertion tests per section type in DOCX (`sectPr` inspection) and PDF (text extraction).
**GATE 4.**

---

## DEFERRED (out of scope until separately approved)

- Change transmittals (CH-n page stacking, 4a/4b page labels) — high DOCX divergence risk, audit recommends PDF-first if ever built.
- 200-page four-digit paragraph numbering system (MCO 5215.1K para 34).
- AMHS message body renderer — BLOCKED: format source (NTP-3/DMS) absent from document set.
- Star stationery and HQMC executive templates — BLOCKED: Figs 13-1 to 13-21 lost in conversion; need signed PDF originals.
- Endorsement chain numbering continuity — needs schema for multi-document chains; propose as its own phase after Gate 2.

## OPEN RULINGS REQUIRED FROM YOU (audit conflicts C5, C9)

1. Notice designation-line position: 2nd line below date (Exhibit 1) vs 5 lines below letterhead address (Exhibit 5). Plan assumes 2nd-line-below-date.
2. MCO To-line spacing: next line below From (Ch 2) vs second line below From (Ch 3). Plan assumes next-line, matching the naval letter.

Both assumptions are reversible one-line constants. Confirm or override at Gate 3.
