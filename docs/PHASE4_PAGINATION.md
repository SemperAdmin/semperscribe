# PHASE 4 — Directives Pagination + SECNAV Variants — citation log

Gate 3 closed 2026-06-10 (C5 = 2nd line below date; C9 = next line;
no size selector; dead code deleted).

## P4.4 — Revision suffix validators (audit line 151) — cafc966

USMC directives reject suffixes I, O, Q; SECNAV set (I, O) wired and
dormant until P4.3 types land. Two-letter suffixes fail with
new-point-number guidance. Handles "w/ ch" annotations, lowercase,
reserve-R and classified prefixes. 8 tests.

## P4.2 — Continuation stack at 1 inch (audit line 160) — 776f787

P3.4 placed the right content at the wrong height: the PDF band
began at PDF_MARGINS.top (44pt) and the DOCX stack at the 720-twip
header origin. PDF directive branch offsets to 72pt; DOCX inserts a
720-twip spacer ahead of the ID table. Geometry pinned in both
emitters (baseline inside the first line under 1in, date on the next
line, blocked-left flush-right at 540pt).

## P4.1 — Structural pages parity + roman cascade (para 48)

Scope per ruling: pin the existing PDF behavior, build DOCX parity;
chapter "1-1" / appendix "A-1" / "Enclosure (n)" page labels are
BLOCKED on a sectioned document model that does not exist (flat
paragraph model) — deferred with Gate 4 visibility, not silently
dropped.

PDF (pre-existing, now pinned): Locator Sheet / Record of Changes /
TOC pages after the promulgation document, roman footers i/ii/iii,
cascade renumbers when a page is disabled.

DOCX (built): one section per structural page (sectPr count 4 with
all three enabled), empty headers, static roman center footers with
the same cascade, content mirrored from the PDF: locator designation
+ date flush right, LOCATOR SHEET title, Subj line, Location blank,
instruction line; RECORD OF CHANGES 4-column bordered table padded
to 20 rows; TABLE OF CONTENTS with numbered level-1 titles
(fourDigitNumbering aware) and enclosure list.

Proof: tests/structural-pages.test.ts (7) — PDF cascade with and
without locator, DOCX section count, static roman footers, DOCX
cascade, locator content, TOC content, template-escape leak guard.

## P4.3 — SECNAV instruction/notice types + validators

Ruling 2026-06-10: both types ship user-selectable (Stephen, P4.3
scope question).

Source access: SECNAV M-5215.1 (Sep 2020) PDF at secnav.navy.mil is
WAF-blocked from the work environment. The notice self-cancel rule
was verbatim-verified via search excerpt of the manual ("indicated
in the upper right margin of the first page, on the second line
above the identification symbols"; "self-canceling on the 1 year
anniversary date unless the Canc date is for a longer period").
All other rules pin to POLICY_COMPLIANCE_AUDIT.md lines 78-106 and
matrix rows C5-C8, which were built from the full markdown
conversion. If the conversion file resurfaces, tighten citations.

Shipped:
- Types secnav-instruction / secnav-notice (schemas, registry,
  DocumentTypeSection cards, Sidebar, scaffolds). Notice carries a
  required cancellationDate; no contingent variant.
- Archetype lock live: Courier New 12 only, DON letterhead only
  (resolveHeaderType coerces; HeaderSettingsSection offers DON only).
  Audit row C1 / gap G7.
- Fixed 4-space ladder via isDirectiveType (audit row C8: M-5215.1
  delegates indent values to M-5216.5 fig 11-1 = 4-space steps; at
  the mandated Courier 12 this equals the USMC 576-twip ladder).
- Designation: SECNAVINST + full SSIC / SECNAVNOTE + bare SSIC
  (audit lines 82, 90); designation line spelled out, caps,
  underlined, 2nd line below date (C5 ruled at Gate 3). No To line
  (audit line 82). Signature stays 4th-line/3-blank (G5).
- Notice Canc line: 2nd line above ID symbols, month-end enforced,
  NO 12-month ceiling (longer period explicitly permitted — differs
  from MCBul).
- Paragraph order validators (audit line 83): Purpose first;
  instruction Cancellation second, Forms last; notice Cancellation
  last with Forms next-to-last. Missing titles warn (P3.5 precedent),
  order violations fail. Notice point-number check fails.
- 5-page text cap (audit lines 85, 115; row C7): severity "block" at
  export. The PDF engine is the shared paginator; its count is the
  verdict for both formats, and the counted blob is the downloaded
  PDF artifact.
- References overflow (audit line 85): warn past 8 refs. THRESHOLD
  IS AN IMPLEMENTATION HEURISTIC — the manual states the rule with
  no count. Flagged for SME at Gate 4.
- P4.4 SECNAV suffix set (I, O) now live; Q remains legal for SECNAV.
- validateDirectiveTypography (warn-only) extended to SECNAV types.

Proof: tests/secnav-directives.test.ts (18) — designation/title,
archetype lock, ladder membership, signature blanks, scaffold
cleanliness, order rules both types, point-number, Canc month-end +
past-1-year permit, refs threshold, suffix set, page-cap verdict,
DOCX emit (SECNAVINST stack, DON letterhead, To absent, Courier
coerced; SECNAVNOTE Canc line). tests/document-types.test.ts
exclusion list extended (SECNAV SSIC is directive free-text).

Gate 4 open items add: refs-overflow threshold (unsourced count);
SECNAV distribution line renders only the DoD 5230.24 statement —
the M-5215.1 Distribution-line format itself is summarized in the
audit without exhibit text, so no richer block was built.
