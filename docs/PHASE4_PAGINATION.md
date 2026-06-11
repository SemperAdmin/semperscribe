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
