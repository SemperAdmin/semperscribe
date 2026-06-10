# Phase 2 — Conditional Logic and Validators (citation log)

Workflow rule: every behavior change carries a citation; every
validator rule gets a unit test with a citation comment.

## P2.1 — Single via unnumbered, 2+ vias numbered

Date: 2026-06-10. Files: `src/lib/naval-format-utils.ts`,
`src/lib/docx-generator.ts`, `src/components/pdf/NavalLetterPDF.tsx`,
`tests/naval-format-utils.test.ts`.

Rule: M-5216.5 — via addressees are numbered "(1)", "(2)" only when
two or more exist; a single via is unnumbered.

Found state: the PDF emitter already implemented the rule (both
fonts); the DOCX emitter ALWAYS numbered — a live cross-emitter
divergence on any single-via letter.

Change: `getViaSpacing(index, font, total)` gained the total
parameter and owns the numbering condition for both emitters (the
Times PDF keeps its flex-column local rendering but the condition now
has one home). DOCX call site passes the via count.

Golden diff: exactly one hunk — `Via:\t(1)\t` becomes `Via:\t` (the
fixture letter has one via). PDF golden unchanged (was already
correct).

Tests: 4 new — single-via unnumbered both fonts, 2+ numbered both
fonts. Suite 849/849 (sharded 833 + 16). Parity GREEN.

## P2.2 / P2.3 / P2.4 / P2.5 — validator module

Date: 2026-06-10. Files: `src/lib/letter-validators.ts` (new),
`tests/letter-validators.test.ts` (new, 19 tests).

Pure-function validators with a three-level severity contract:
`block` (export must refuse), `fail` (non-compliant), `warn`
(unverifiable or weak provenance).

| Validator | Rules | Citation |
| :--- | :--- | :--- |
| validateReferences | every listed ref cited; citations beyond the list; order of first citation equals listing order; multi-citation clauses ("refs (a) and (b)") parsed; (aa)+ letters past (z) | M-5216.5; audit lines 24, 147 |
| validateParagraphStructure | lone subdivision (an "a" needs a "b", every level, nested groups handled); never past level 8 | M-5216.5 Fig 7-8; audit lines 43, 148 |
| validateWindowEnvelope | HARD BLOCK: address >5 lines, any Via, classification (C/S SSIC prefix or explicit field) | M-5216.5 Fig 7-3; audit lines 29, 69 |
| validateActionAddressees | >4 action addressees without Distribution mode | M-5216.5 Ch 8; audit line 26 |

`getExportBlockers()` is the export gate: blocks only, per audit line
69 ("a hard validator, not a style toggle"). UI wiring lands with
P2.7.

PROVENANCE NOTE: NOTAL/undated annotations appear in
CORE_CONCEPTS_UPDATE_PLAN.md Phase 2 item 2 but NOT in the audit
text. Implemented as `warn` only, with the plan-only citation stated
in the issue itself. Sep-cover and per-addressee enclosure notations
are likewise absent from the audit text and are NOT implemented
pending a source; recorded here so Gate 2 sees the gap.

P2.3 note: the Distribution-replaces-To rendering already exists in
both emitters (toDistribution flag); the validator enforces its use
above 4 addressees.

## P2.6 — Date format enforcement by slot

Date: 2026-06-10. Files: `src/lib/letter-validators.ts`,
`tests/letter-validators.test.ts` (+4 tests).

`validateDateSlots`: naval-letter body text must use the standard
date (5 May 2015) — civilian-format dates (May 23, 2014) and
abbreviated dates (15 Feb 09, sender-symbol slot only) in paragraph
text each FAIL with the offending match quoted. Business/exec/DLA
letters are exempt (civilian format is their rule — audit line 48).
The sender-symbol slot was already correct: parseAndFormatDate emits
the abbreviated form, formatBusinessDate the civilian form, and the
emitters select by document type.

## P2.7 — Shared close, proofread integration, export gate, inline banner

Date: 2026-06-10. Files: `src/lib/naval-format-utils.ts`,
`src/lib/docx-generator.ts`, `src/components/pdf/NavalLetterPDF.tsx`,
`src/lib/proofread-checks.ts`, `src/app/page.tsx`,
`src/components/layout/LivePreview.tsx`,
`src/components/layout/ModernAppShell.tsx`.

1. `getComplimentaryClose()` — single source (MCO 5216.20B Sec 12):
   explicit close wins, VIP mode yields "Very respectfully", exactly
   one trailing comma. Rewired the business/exec close in BOTH
   emitters (previously duplicated 4x with inconsistent defaults).
   DLA sites untouched per the out-of-scope ruling. Salutation colon
   was already enforced by the schema transform (schemas.ts).
2. Proofread integration: runProofreadChecks now appends every
   letter-validator issue (block/fail -> fail, warn -> warn) with the
   citation in the reference field.
3. Export hard gate: generateDocument() in page.tsx refuses DOCX and
   PDF export while any `block` issue exists, listing rule, detail,
   and citation (audit line 69: "a hard validator, not a warning").
4. Inline preview banner: LivePreview shows a red EXPORT BLOCKED or
   amber Compliance strip with the first rules and a hover tooltip
   carrying full details; issues computed in page.tsx and passed
   through the shell.

Suite 875/875 (sharded 92 + 12 + 771). tsc clean. Parity GREEN.

## P2.8 — User-validation fixes (2026-06-10 hands-on findings)

1. FALSE POSITIVE: the window-envelope via blocker fired on via
   entries lingering in form state from a previously selected letter
   type. Business/exec letters render no Via line (MCO 5216.20B; the
   Fig 11-4 window variant has none) — the blocker now applies only
   to document types that render vias. Regression test added.
2. Banner deduplication: identical rule texts (two lone-subdivision
   hits) collapsed to one entry; the "+N more" count now counts
   distinct rules.
3. Closing split across the page break: "Sincerely," stranded on
   page 1, signature alone on page 2. PDF: the business/exec closing
   renders in a wrap={false} container. DOCX: separation blank, close,
   and the three signature blanks are keepNext-chained, the last body
   paragraph binds to the closing (including business level-1
   paragraphs, whose branch previously ignored keepNext), and
   widowControl extends to business paragraphs. Two regression tests.
   Sender symbols upper-left on continuation pages were verified
   CORRECT (audit line 48) — the split made them look orphaned.

Suite 878/878 (sharded 34 + 73 + 771). Parity GREEN.

# GATE 2 PACKAGE — Phase 2 complete, ready for review

All seven plan items landed. Open items for the Gate 2 ruling:
1. NOTAL/undated rules are plan-only provenance (warn severity).
2. Sep-cover / per-addressee enclosure notations: NOT implemented,
   no audit source located — needs a source or a ruling to drop.
3. Endorsement-chain numbering continuity: plan defers to its own
   phase after Gate 2; confirm whether to schedule it.
4. UI banner styling is functional-minimal; visual polish is the
   user's call after hands-on use.

## GATE 2 RULING (2026-06-10, Stephen)

1. Sep-cover / per-addressee enclosure notations: DROPPED from scope.
   No audit source located; an unsourced rule is not defensible.
   Re-opens only if a SECNAV M-5216.5 or MCO citation is supplied.
2. Endorsement-chain numbering continuity: scheduled as its OWN phase
   after the directives work (Phase 5, following Phase 4 Directives
   Pagination/SECNAV Variants in CORE_CONCEPTS_UPDATE_PLAN.md).
3. NOTAL/undated rules: remain warn-severity, plan-only provenance,
   as shipped.
4. Banner styling: functional-minimal accepted; polish deferred to
   user discretion after hands-on use.

Gate 2 CLOSED. Phase 3 (Directives Core) authorized.
