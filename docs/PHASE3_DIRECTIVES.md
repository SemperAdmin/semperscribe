# PHASE 3 — Directives Core (MCO/MCBul) — citation log

Plan: CORE_CONCEPTS_UPDATE_PLAN.md Phase 3. Gate 2 closed 2026-06-10.
Each section records what changed, the authority, and the proof.

## P3.1 — Archetype font policy (G7, audit matrix C1)

Landed as ddd62f6. src/lib/font-policy.ts: USMC directives (mco,
bulletin, change-transmittal) lock to Courier New (10 or 12 pt per
MCO 5215.1K); SECNAV directive archetype reserved for Phase 4;
correspondence unchanged. Both emitters coerce bodyFont at generation
time — stale form state cannot leak Times into a directive (defect
class proven by P2.8). Selector constrained with lock notice.
Proof: tests/font-policy.test.ts (13), incl. generator-level
coercion: MCO with bodyFont='times' emits Courier New only.

## P3.2 — Fixed 4-space ladder retune (MCO 5215.1K para 33)

FIXED_LADDER redefined in character columns: designator at
(level-1)*4, text at level*4. Twips derive from the Courier advance:
576/level at 12 pt (144 twips/char), 480 at 10 pt. FixedLadderEngine
honors fontSizePt and clamps out-of-range levels (the legacy path
crashed on level-0 template paragraphs — NAVAL_TAB_STOPS[0]
undefined; engine wiring fixed it, regression test pinned).
Directive paths in both emitters now take specs from
fixedLadderEngine (previously an implicit fallback in the Courier
render branch). Spacing: two spaces after period designators, one
after parenthesized (spacesAfterCitation). Runover lines return to
the LEFT MARGIN — directive paragraphs emit no hanging indent.
Sentence spacing (two spaces after sentence periods, directives
only) is a WARN validator, not a text transformation — the tool
never rewrites user text (user-responsibility posture):
validateDirectiveTypography, conservative regex sparing "U.S.",
"e.g.", initialisms.
Proof: tests/directive-ladder.test.ts — DOCX character columns
0/4/8/12 + 2/1 spacing + no <w:ind>; PDF extraction asserts line
starts at x = 72 + column*7.2pt and wrapped runover at x = 72.
tests/indent-engine.test.ts pins 576/480 twip steps.

## P3.3 — Signature offset (G5, MCO 5215.1K para 37)

getSignatureBlankLines(documentType) in naval-format-utils: 4 blanks
(5th line) for mco/bulletin/change-transmittal, 3 blanks (4th line,
M-5216.5 7-2.16) for everything else. Both emitters parametric; the
DOCX keepNext chain extends across all four directive blanks. The
pre-P3.2 directive output reached the 5th line only by accident (a
trailing body spacer the correspondence path suppresses); the offset
is now explicit and the trailing-spacer suppression is uniform.
Proof: tests/directive-ladder.test.ts — MCO sig at lastBody+5, all
gap paragraphs blank; correspondence 4th-line regression held.

## P3.4 — Identification block (MCO 5215.1K para 38)

Designation line unified: getDirectiveDesignation = abbreviation +
SSIC ("MCO 5215.1K", "MCBul 1500"; audit line 138). Previously the
PDF showed the BARE SSIC in the ID stack and the DOCX showed the
prefixed form only when orderPrefix was set (never for bulletins) —
emitter divergence, now closed. formatDirectiveSSICBlock is dead
code, retained pending a deletion ruling.

DOCX continuation header: directives previously repeated the
correspondence "Subj:" header on pages 2+. Replaced with the ID
stack flush right — designation + date, originator code OMITTED
(audit lines 98/126/160), via the same right-anchored borderless
table as page 1. PDF already complied.

Bulletin Canc line: was approximated with fixed left indents
(DOCX 7020/6300 twips, PDF marginLeft 351/315). Now right-aligned
per audit lines 144/170, one blank above the SSIC position
(spacing preserved).

DOCX designation title line now falls back to prefix+SSIC when
directiveTitle is empty (parity with PDF); caps + underline held.

Geometry already compliant and left untouched: page-1 right-anchored
blocked-left stack in both emitters (PDF fixture math: left edge
475.2 = 540 - 9 chars x 7.2pt), dd Mmm yy date via
parseAndFormatDate, title 2nd line below date.

Proof: tests/directive-id-block.test.ts (6) — DOCX stack content and
right anchoring, underlined title fallback, continuation header
content (no ARDB, no Subj), Canc alignment, PDF flush-right edge at
540pt +/- rounding, page-2 designation without code.

## P3.5 — Mandatory paragraph schemas (MCO 5215.1K; audit 139-140)

validateDirectiveSchema (fail severity): MCO requires Situation,
Mission, Execution, Administration and Logistics, Command and Signal
as level-1 titles in that relative order; Cancellation, when present,
must be second. MCBul requires Purpose first; Cancellation
Contingency, when present, must be last. validateBulletinCancellation
(fail): cancellation date present, last day of its month, within the
12-month ceiling measured from the bulletin date.
NOT automated (manual proofread items): Signal paragraph
effectiveness sentence ("This Order is effective the date signed."),
Execution sub-paragraph structure (CI/CONOPS, SEM, Coordinating
Instructions) — title matching below level 1 is too brittle to fail
a document on.
The existing scaffolds (getMCOParagraphs, getMCBulParagraphs) pass
the validators as generated.
Proof: 14 validator tests incl. order violations, slot rules,
month-end and ceiling boundaries.

## P3.6 — Distribution statements: verbatim + placement

VERBATIM VERIFIED against the primary source: MCO 5215.1K W/ ADMIN
CH-2 (10 May 2007), encl (1) statements block (pages 1-8/1-9),
fetched 2026-06-10 from
https://www.mcieast.marines.mil/Portals/33/MCO%205215_1K%20W%20ADMIN%20CH-2_1.pdf
All seven statements (A-F, X) in constants.ts match character for
character. tests/distribution-statements.test.ts embeds the source
transcription as a verbatim guard. The same source page also
confirms the P3.1 font policy verbatim ("Use Courier or Courier New
typeface; 10 or 12 point") and the 1in/0.5in margin-footer rule.

Placement (audit lines 149/172): the DOCX previously emitted the
statement IN THE BODY FLOW after the signature — wrong page, wrong
anchor. Now a margin-anchored text frame (framePr, yAlign bottom)
whose flow anchor sits directly after the letterhead, so it lands at
the bottom of page 1. The PDF already rendered a fixed page-1-only
bottom footer and is unchanged. Fill-in resolution unified in
resolveDistributionStatement (shared by both emitters; the PDF and
DOCX previously carried duplicate copies of the replace logic).
DISTRIBUTION line: caps, PCN carried, one blank below the signature
block. "Copy to" colon alignment has NO located source — left
as-is, flagged for SME (same standard as the Gate 2 sep-cover drop).

## P3.7 — Reports Required (MCO 5216.20B par. 29b/29c; audit 142)

The PDF was already the reference implementation (heading-block list
for up to 4 reports with Report Control Symbol composition, referral
line plus dedicated page for 5+). The DOCX lagged on both counts: it
listed reports BETWEEN the body and the signature regardless of
count and had no 5+ page. Now mirrored: heading-block list after the
Encl line (singular/plural label, Roman numerals when plural,
EXEMPT handling), referral line for 5+, and a page-break-delimited
Reports Required page after the signature with REPORT TITLE /
REPORT CONTROL SYMBOL / PARAGRAPH columns at 5040/7920 twip tabs.
Proof: tests/reports-required.test.ts (4) — DOCX placement before
paragraph 1, singular label, 5+ referral + page with all rows; PDF
page-after-signature with full row content.

## P3.8 — MCO example data rebuild + citation count fix (user ruling 2026-06-10)

Ruling: Execution carries a. Commander's Intent / b. Concept of
Operations / c. Tasks (unit taskings as (1), (2)) / d. Coordinating
Instructions; ALL MCO example data rebuilt so designators are
generated from levels, never typed into content.

Changes. getMCOParagraphs scaffold restructured (CI&CONOPS/SEM rows
replaced per ruling). Records-management template and both
assumption-of-command sources converted from embedded-designator
level-0/legacy style to structured title+level data. Change
transmittal template untouched (deferred scope).

Defects surfaced and fixed in the same pass:
1. generateCitation in paragraph-formatter.ts skipped title-only
   paragraphs when counting siblings, so anything after a title-only
   row numbered one short (Coordinating Instructions rendered c.
   instead of d., A&L 4. instead of 5.). The PDF's copy already
   counted titles — emitter divergence closed by matching it.
   Affects all document types; goldens stayed byte-stable.
2. FixedLadderEngine level-0 spec leaked spacesAfter=2, shifting
   verbatim lines off the left margin. Level<1 now yields an explicit
   verbatim spec (no citation, no spacing, margin zero).
3. P3.5 severity adjustment: missing-mandatory-title checks
   downgraded fail->warn because MCO 5215.1K Fig 1-1 sanctions
   reduced formats (assumption-of-command has only
   Situation/Cancellation/Execution). Order and slot rules stay fail.

Proof: tests/mco-template-structure.test.ts (8) — no embedded
designators in any MCO example data, scaffold sequence per ruling,
level-0 verbatim spec, full 17-row designator-sequence assertion on
the rendered records template including post-title-only numbering.

## P3.9 — Directive letterhead rule + P3.1 UI gap (user report 2026-06-10)

User ruling: directives carry Navy or Marine Corps letterhead only —
no DLA option. HeaderSettingsSection offered all three for every
type; directives now offer USMC/DON only, with resolveHeaderType
coercing stale DLA form state to USMC in both emitters (same defense
pattern as the font lock).

P3.1 gap closed in the same component: DocumentLayout renders
HeaderSettingsSection (not FontSelectorSection) when
showHeaderSettings is set — the directive-facing screen. Its Body
Font dropdown was unconstrained, so the UI still offered Times for
MCOs even though generation coerced to Courier. Both selectors now
enforce the archetype lock.

Proof: 3 new font-policy tests incl. DOCX letterhead-text assertion
under stale DLA state.

## Open items for Gate 3

1. C5/C9 rulings (plan "OPEN RULINGS"): notice designation-line
   position; MCO To-line spacing. Plan assumptions in effect.
2. P3.4-P3.7 pending: ID block, paragraph schemas, distribution
   verbatim check, Reports Required page.
3. Font size selector (10 vs 12) not exposed in UI; policy map
   carries both, emitters fixed at 12. Decide at Gate 3 whether a
   selector is wanted (functional addition needing approval).

Suite after P3.9: 950 green (897 + 6 golden/components), tsc clean,
parity green, goldens byte-stable (correspondence untouched).
