# SemperScribe policy audit, 2026-09-05

Policy audit, 2026-09-05, against v0.4.8. Layout figures were measured by rendering the emitters through the repository's own PDF text-layout helper. Findings feed docs/UX_POLICY_PLAN_2026-09.md.

Read-only forensic pass over `/home/user/semperscribe`. Every finding below was checked against the policy text in `docs/SecNav5216/` and against the code. Layout claims marked "measured" were produced by rendering the real emitters through the repo's own `extractPdfTextLayout` helper in a scratch harness outside the tree, so the point positions are the ones a drafter actually gets.

## Summary

| Severity | Meaning | Count |
| :--- | :--- | ---: |
| A. App renders wrong output | The exported file departs from policy. Kickback is guaranteed. | 12 |
| B. App does not warn | Output can be wrong and nothing tells the drafter. | 9 |
| C. Guidance or gating missing | Rule exists in code but is unreachable, unwired, or unexplained. | 5 |

Two findings are emitter divergences: the PDF preview and the DOCX export disagree, and the PDF is the wrong one.

### Top 10 by drafter frequency

| # | Rule | Citation | Current behaviour | File:line | Test? |
| ---: | :--- | :--- | :--- | :--- | :--- |
| 1 | "Type 'Copy to:' at the left margin on the second line below the signature line." | M-5216.5 7-2.15.b | PDF prints it on the FIRST line below. Measured: sig 273.2pt, Copy to 287.0pt, one 13.8pt line. DOCX inserts the blank line, so preview and export differ. | `src/components/pdf/NavalLetterPDF.tsx:237` (`copyToSection` marginTop 0) vs `src/lib/docx-generator.ts:2005` | No |
| 2 | Endorsement references "continu[e] the sequence of letters from the basic letter." | M-5216.5 9-2.3 | The renderer honours `startingReferenceLevel`, the validator does not. A correct FIRST endorsement starting at ref (c) draws five spurious `fail` issues in the compliance dialog (measured). | `src/lib/letter-validators.ts:50` (no offset) vs `src/components/pdf/NavalLetterPDF.tsx:738` | No |
| 3 | Business letter ID symbols go "in the upper left corner, blocked one below the other." | M-5216.5 11-2.1, Fig 11-2 | PDF renders SSIC/code/date flush RIGHT (measured x=473pt). DOCX renders them flush LEFT. Emitter divergence, PDF wrong. | `src/components/pdf/NavalLetterPDF.tsx:961` | No |
| 4 | "Signer's name in all capital letters." | M-5216.5 11-2.9.a(1) | PDF prints the business/executive signature as typed ("j. q. public"). The naval path uppercases; the civilian path does not. DOCX uppercases. Divergence, PDF wrong. | `src/components/pdf/NavalLetterPDF.tsx:1773` vs `:1707` | No |
| 5 | "Indent main paragraphs four spaces (or set margin at half inch)"; exec: "Each paragraph must be indented 1/2 inch." | M-5216.5 11-2.6; 12-3.2.c(2) | PDF renders business and executive body paragraphs at x=72.0pt, no indent at all (react-pdf ignores `textIndent` on a `View`). The constant is also wrong: 18pt = 0.25in where policy says 4 spaces or 0.5in. DOCX writes `firstLine="360"` (0.25in), also short of the exec 0.5in. | `src/components/pdf/NavalLetterPDF.tsx:409` | No |
| 6 | "Start the complimentary close ... on the second line below the text"; "Type the name ... on [the] fourth line below the ... complimentary close." | M-5216.5 11-2.8, 11-2.9.a; 12-3.4, 12-3.2.e(3)(a) | Measured: close 3 lines below the last body line, name 6 lines below the close. Should be 2 and 4. | `src/components/pdf/NavalLetterPDF.tsx:1761` and `:1770` | No |
| 7 | "In correspondence, do not use acronyms in the subject line." | M-5216.5 7-2.9.a; exec 12-3.2.c(4) | Silent. `validateAcronyms` deliberately scans "paragraph CONTENT only", excluding subjects. Nothing else checks the subject. | `src/lib/acronym-validators.ts:17` and `:92` | No |
| 8 | Subject is "a sentence fragment ... ALL LETTERS CAPITALIZED AND NO PUNCTUATION." | M-5216.5 7-2.9.a, Fig 7-1 | All-caps IS enforced (schema refine + render uppercase). Punctuation and sentence-fragment are unchecked; nothing in `src/lib` greps for subject punctuation. | `src/lib/schemas.ts:176`; no punctuation rule anywhere | Caps only |
| 9 | Directive continuation page: designation and date at the top, body resuming below them. | MCO 5215.1K para 38 (via audit line 160) | Measured page 2: designation baseline 82.0pt, date 95.6pt, first body line 102.0pt. The body's first line box starts at ~92.6pt, inside the date line. Overlap on every multi-page directive. `CONTINUATION_HEADER_HEIGHT` is a legacy 48pt spacer never retuned. | `src/components/pdf/NavalLetterPDF.tsx:34` and `:872` | Header pinned, overlap not |
| 10 | "Do not start a paragraph at the bottom of the page unless at least two lines of text will remain ... and at least two lines will carry over." | M-5216.5 Fig 7-1 para 3.a | `orphans={2} widows={2}` is set only on the correspondence (`spec`) branch. The Courier branch returns first and carries neither, so every Courier letter and every directive paginates without the two-line floor. | `src/components/pdf/NavalLetterPDF.tsx:500` (courier) vs `:539` (spec) | DOCX side only (`tests/keep-rules.test.ts`) |

---

## Full findings by document type

### Standard letter (M-5216.5 Ch 7) - hit by every drafter

| Rule and citation | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 7-2.15.b "Copy to:" on the second line below the signature | One line below in PDF, two in DOCX | `NavalLetterPDF.tsx:237`, `docx-generator.ts:2005` | A | No |
| 7-2.1 "Allow 1-inch top ... margins on each page" | `PDF_MARGINS.top = 44` (0.61in). The in-file comment records this as a 2026-06-10 user ruling to match Word, and names 36pt as the spec value. Knowing deviation, but the proofread check below asserts the opposite. | `src/lib/pdf-settings.ts:25` | A (documented) | No |
| 2-19.b(2) "Are the margins 1 inch?" | The proofread panel hardcodes `status: 'pass'` with the detail "Margins are controlled by the PDF generator (1\" all sides)". That is false for the top margin, and false for Short Letter mode which forces 144pt sides. | `src/lib/proofread-checks.ts:98-108` | B (false pass) | No |
| 2-19.b(3),(5),(6) page numbers, alignment, numbering | Three more hardcoded `pass` checks with no measurement behind them | `proofread-checks.ts:110-172` | B | No |
| 7-2.17 page numbers centred 1/2in from the bottom | `footer` at `bottom: 36`, centred, suppressed on page 1 (`displayPage > 1`) | `NavalLetterPDF.tsx:254`, `:1932` | Correct | Golden |
| 7-2.14.a(2) signature on the 4th line below the text, at page centre | Measured 4 lines exactly; `PDF_INDENTS.signature = 234` + 72pt padding = 306pt = page centre | `naval-format-utils.ts:703`, `pdf-settings.ts:65` | Correct | `tests/keep-rules.test.ts` |
| 7-2.14.b signature line forms are Name / Name+Title / Acting / By direction. No rank. | `formData.sig` is free text; a drafter who types "MAJ J. SMITH" gets it rendered in caps and nothing warns. `validateSignature` checks only initials-vs-full-first-name and the delegation phrase. | `src/lib/signature-validators.ts:52-93` | B | Partly (`letter-validators.test.ts` has no rank case) |
| 7-2.16 continuation pages repeat Subj on the 6th line, text on the 8th | Implemented via absolute constants 60/84pt | `NavalLetterPDF.tsx:32-33` | Correct | `tests/continuation-header.test.ts` |
| 7-2.10.a references "listed in the order they appear in the text"; "Always mention cited references in the text" | Enforced, three ways (listed-not-cited, cited-not-listed, order) | `letter-validators.ts:50-137` | Correct | `letter-validators.test.ts:30-72` |
| 7-2.11.a enclosures "listed in the enclosure line in the order they appear in the text" | Only a count cross-check exists (listed vs referenced). No order rule, no per-enclosure "listed but never cited". | `proofread-checks.ts:172-215` | B | No |
| 7-2.10.c reference letters a-z | `String.fromCharCode(startRefChar + i)` produces `{`, `|` past 26 refs; the validator's `indexToRefLetter` produces `aa`. Disagreement, low frequency. | `NavalLetterPDF.tsx:1405` vs `letter-validators.ts:35` | A (rare) | Validator side tested |
| 7-2.13 subparagraph "a (1) must have a (2)"; never past level 8 | Enforced | `letter-validators.ts:145-203` | Correct | `letter-validators.test.ts:73-101` |
| Fig 7-8 designators align under the parent's first letter of text; runover returns to the left margin | `RelativeIndentEngine` measures designator widths from generated font metrics | `src/lib/indent-engine.ts:92-151` | Correct | `tests/indent-engine.test.ts` |
| Fig 7-1 3.a two-line orphan/widow floor | Courier and directive render paths carry no `orphans`/`widows` | `NavalLetterPDF.tsx:500` | A | DOCX only |
| Fig 7-3 window envelope: no "From:" line, address block in its place, no Via, unclassified, address <= 5 lines | The three constraints are validated at `block` severity, but the `isWindowEnvelope` control is only offered on the Business Letter form, and no emitter implements Fig 7-3 for a standard letter (the From line is never suppressed, the address block is never substituted). The rule is real; the format is not built. | `letter-validators.ts:205-259`; `schemas.ts:2298` (only business letter) ; `NavalLetterPDF.tsx:981` (business-letter-only offset) | C | Validator tested, format untested because absent |
| 2-12.b(2) "DEPARTMENT OF THE NAVY centered on the fourth line from the top" | Measured letterhead baseline 52.9pt, about one line below the 4th-line position | `pdf-settings.ts:25` | A (documented deviation) | No |
| 2-12.b(2) "Do not use abbreviations or punctuation in the address" | No validation of the letterhead lines at all | none | B | No |

### Multiple-address letter (Ch 8)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 8-2.1/8-2.2 four or fewer use "To:" only; more than four use "Distribution:" only | Enforced at `fail` severity | `letter-validators.ts:265-283` | Correct | `letter-validators.test.ts:149-167` |
| Fig 8-1 recipients stack under a single "To:" label | Measured correct (To at 149.0, then 162.8, 176.6, all x=108) | `NavalLetterPDF.tsx:1323-1338` | Correct | Golden |
| 7-2.8.c "Number 'Via' addressees if two or more are listed" | Measured "(1)"/"(2)" for two vias, bare text for one | `NavalLetterPDF.tsx:1364-1370`, `naval-format-utils.ts:40` | Correct | `naval-format-utils.test.ts` |
| 8-2.3 group title in "To:" plus members in "Distribution:" | Supported by the `toDistribution` toggle | `NavalLetterPDF.tsx:1312`, `:1864` | Correct | No |

### Endorsements (Ch 9)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 9-2.3 added references continue the basic letter's lettering | Rendered correctly, validated incorrectly. See top-10 #2: five false `fail`s on a correct endorsement. | `letter-validators.ts:50`; `NavalLetterPDF.tsx:738` | A/B | No |
| 9-2.4 added enclosures continue the numbering | `startingEnclosureNumber` honoured in both emitters. No validator, so a drafter who leaves it at 1 gets a duplicate enclosure number with no warning. | `NavalLetterPDF.tsx:742`, `docx-generator.ts:1095` | B | No |
| 9-1 same-page endorsement when it fits on the signature page of the basic letter | Not implemented. No `samePage` concept exists anywhere in `src/`. Only the new-page endorsement is buildable. | absent | C | No |
| 9-2.1.a same-page endorsements may omit the SSIC, subject and the basic letter's identification | Unreachable, follows from the above | absent | C | No |
| Fig 9-1 new-page endorsements repeat the SSIC, identify the basic letter, reuse the subject; number pages continuing the previous sequence | Implemented: letterhead retained, `FIRST ENDORSEMENT on ...` line between date and From, `startPage` offsets the footer | `NavalLetterPDF.tsx:1129-1136`, `:1933` | Correct | `tests/package-assembly.test.ts` covers the ladder |
| 9-2.5 significant endorsements copy every prior endorser and the originator, and carry forward the basic letter's copy-to list | Silent. No occurrence of "significant" in `src/lib` or `src/components/letter`. | absent | B | No |
| Package: endorsement levels ascend without gaps, page and letter sequences continue | Enforced | `src/lib/package-assembly.ts:117-160` | Correct | `tests/package-assembly.test.ts` |

### Memorandums (Ch 10)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 10-2.1 MFR has no To line and needs no identification symbols | Measured: date only, "MEMORANDUM FOR THE RECORD", Subj, body, signature. From/To suppressed. | `NavalLetterPDF.tsx:1148`, `:1292` | Correct | No |
| 10-2.1 the MFR "should ... show the organizational position of the signer" (Fig 10-1 shows "N11") | The signer code field exists (`Code 123` placeholder) but the MFR renders `delegationText` ("By direction") in that slot when set, which is not an MFR form | `ClosingBlockSection.tsx:93`; `NavalLetterPDF.tsx:1708` | B | No |
| Fig 10-1 MFR date is flush left | Rendered flush right (measured x=492) | `NavalLetterPDF.tsx:961` | A (minor) | No |
| 10-2.3.b plain-paper memo: date on the sixth line flush right, Subj ABOVE the date (Fig 10-3) | No plain-paper memo type exists; `DOCUMENT_TYPES` offers `mfr`, `from-to-memo`, `letterhead-memo` only | `src/lib/schemas.ts:3092-3094` | C | No |
| 10-2.4 letterhead memo needs no full signature line, types "MEMORANDUM" | `letterhead-memo` renders the MEMORANDUM line | `NavalLetterPDF.tsx:1166` | Correct | No |
| 10-2.6.d MOA/MOU: senior official's signature line at the RIGHT, over-scored | Two columns, junior left and senior right, both centred in their column | `NavalLetterPDF.tsx:1814-1834` | Correct | No |
| 10-2.5 decision memorandum block two lines below the signature | No decision block in the memo paths (`decision-paper` is a different, staffing-paper type) | absent | C | No |

### Business letter (Ch 11)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 11-2.1 ID symbols upper LEFT | PDF right, DOCX left | `NavalLetterPDF.tsx:961` | A | No |
| 11-2.9.a(1) name in all capitals | PDF as typed, DOCX uppercased | `NavalLetterPDF.tsx:1773` | A | No |
| 11-2.6 main paragraphs indented four spaces or half an inch, not numbered | Not numbered (correct). Indent renders as zero (measured x=72.0); the constant is 18pt and its comment cites "8 spaces", which is the SUBDIVISION rule from Fig 11-1, not the main-paragraph rule. | `NavalLetterPDF.tsx:409` | A | No |
| 11-2.8 close on the second line below the text | Three lines below (measured) | `NavalLetterPDF.tsx:1761` | A | No |
| 11-2.9.a name on the fourth line below "Sincerely" | Six lines below (measured) | `NavalLetterPDF.tsx:1770` | A | No |
| 11-2.10.a "Type 'Enclosure' on the second line below the signature line, number and describe them briefly" | Placement correct (measured 2 lines). Enclosures are printed unnumbered. | `NavalLetterPDF.tsx:1780-1790` | A (minor) | No |
| 11-2.12 "Copy to:" on the second line below the enclosure line | Measured correct | `NavalLetterPDF.tsx:1793` | Correct | No |
| 11-2.7 "Refer to previous communications and enclosures in the body ... without calling them references or enclosures" | Reference list suppressed in both emitters and a `warn` explains why | `schema-validators.ts:150-176`, `docx-generator.ts:1023` | Correct | `tests/salutation-parity.test.ts` |
| 11-2.4 salutation required, colon after a courtesy title | Required by schema and by a cited validator; the schema transform appends the colon | `schemas.ts:2238`, `schema-validators.ts:178-195` | Correct | `tests/salutation-parity.test.ts` |
| 11-2.2 inside address two to eight lines below the date, ZIP+4, one space before the ZIP | Rendered, but no validation of ZIP+4 or of the single-space rule anywhere | `NavalLetterPDF.tsx:979-990` | B | No |
| Appendices A and B models of address and salutations | No models-of-address data exists in `src/` (grep finds the phrase only in unrelated I-Type components). The drafter gets a free-text field and no guidance. | absent | C | No |

### Executive correspondence (Ch 12)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| 12-3.2.c(2) "Each paragraph must be indented 1/2 inch. Do not number the paragraphs." | Not numbered (correct); indent renders as zero (measured x=72.0). Shares the broken business-letter branch. | `NavalLetterPDF.tsx:409` | A | No |
| 12-3.4 close on the second line below the text; 12-3.2.e(3)(a) name on the fourth line below the close | 3 and 6 lines (measured) | `NavalLetterPDF.tsx:1761`, `:1770` | A | No |
| 12-3.3 "Do not type the date on correspondence to be signed" | `omitDate` honoured, and the duplicate-date bug is already fixed with a comment | `NavalLetterPDF.tsx:973`, `:1025` | Correct | No |
| 12-3.2.e(1) omit the signature block on memos for SecDef/SECNAV signature | `omitSignatureBlock` implemented | `NavalLetterPDF.tsx:1768` | Correct | No |
| 12-3.2.f "Copy to" at the bottom left, two lines after the signature line | Measured 2 lines | `NavalLetterPDF.tsx:1793` | Correct | No |
| 12-3.2.c(4) an acronym may be used after it is spelled out, "except in the subject line or title" | Silent, same gap as 7-2.9.a | `acronym-validators.ts:17` | B | No |
| 12-3.2.c(3) "Limit response to one page whenever possible" | No page-count advisory for executive letters (the 5-page cap validator is SECNAV-directive only) | `letter-validators.ts:770-790` | C | Directive cap tested |

### Directives (MCO 5215.1K, SECNAV M-5215.1)

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| Continuation-page ID block above the body | Body first line overlaps the date line (measured 92.6pt vs a date line ending near 99.6pt) | `NavalLetterPDF.tsx:34`, `:872` | A | Header only |
| Fixed 4-space ladder, 0/4/8/12/16/20/24/28 | Implemented in character columns and scaled by the Courier advance | `indent-engine.ts:175-227` | Correct | `tests/directive-ladder.test.ts` |
| Signature on the 5th line for USMC directives, 4th for naval and SECNAV | Implemented | `naval-format-utils.ts:703-706` | Correct | Yes |
| SMEAC mandatory paragraphs and order; bulletin Purpose first; Cancellation second | Enforced | `letter-validators.ts:368-460` | Correct | `letter-validators.test.ts:217-272` |
| Bulletin cancellation date: required, month-end, within 12 months | Enforced | `letter-validators.ts:471-530` | Correct | `letter-validators.test.ts:274-305` |
| Revision suffix skips I, O, Q; past Z needs a new point number | Enforced | `letter-validators.ts:537-575` | Correct | `letter-validators.test.ts:307-334` |
| SECNAV 5-page cap; Purpose first; Forms last | Enforced | `letter-validators.ts:581-790` | Correct | `tests/secnav-directives.test.ts` |
| Two spaces after a sentence period | Warn-only, conservative | `letter-validators.ts:332-366` | Correct | `letter-validators.test.ts:194-215` |
| Orphan/widow floor on directive bodies | Absent (Courier branch) | `NavalLetterPDF.tsx:500` | A | No |

### Cross-cutting

| Rule | Behaviour | File:line | Class | Test |
| :--- | :--- | :--- | :--- | :--- |
| `block` severity is documented as "export must refuse" | `getExportBlockers` is called from exactly one place, the signature-ceremony PDF builder. The ordinary PDF and DOCX download paths and the batch generator run only the sensitive-data scan. A window-envelope violation exports without complaint. | `letter-validators.ts:836`; `useSignatureWorkflow.ts:102`; `useDocumentExport.ts:61`; `useBatchGenerate.ts:82` | C | `tests/export-gate.test.ts` covers the PII scan only |
| `runLetterValidators` from the proofread panel is passed `[]` for vias | Every via-dependent rule (window envelope) is silently inert in that surface | `proofread-checks.ts:43` | C | No |
| `startingReferenceLevel` / `startingEnclosureNumber` scoping | DOCX applies them to every document type; PDF applies them only when `documentType === 'endorsement'`. A stale value from a saved draft or a shared link letters refs (c),(d) in Word and (a),(b) in the preview. | `docx-generator.ts:1025`, `:1095` vs `NavalLetterPDF.tsx:738-744` | A | No |
| 2-13.a enclosure marking "Enclosure (n)" in the lower right corner | Implemented, stamped on every page, with a recorded ruling for the all-pages choice | `src/lib/enclosure-attachments.ts:44-60` | Correct | `tests/enclosure-attachments.test.ts` |
| 2-16 three date formats by slot | Enforced: civilian dates rejected in naval body text, abbreviated dates rejected in body text, civilian allowed on business letters | `letter-validators.ts:287-330` | Correct | `letter-validators.test.ts:169-192` |
| 2-17.c spell out an acronym at first use | Enforced, warn severity, content only | `acronym-validators.ts:86-128` | Correct | `tests/acronym-validators.test.ts` |

Classification markings are out of scope per the task and are not assessed. The FOUO-retirement rule at `schema-validators.ts:120-146` is noted only as present and cited.

---

## Verified correct AND pinned by a test - do not touch

- Continuation-page geometry for the standard letter, Subj on line 6 and body on line 8 (`NavalLetterPDF.tsx:32`, `tests/continuation-header.test.ts`).
- Signature offsets, 4th line naval and SECNAV, 5th line USMC directive (`naval-format-utils.ts:703`, `tests/keep-rules.test.ts`).
- DOCX keepNext and widowControl chain for the two-line signature-page rule (`tests/keep-rules.test.ts`).
- Reference cross-check and first-citation ordering for non-endorsements (`letter-validators.ts:50`, `letter-validators.test.ts:30`).
- Lone-subdivision and level-8 cap (`letter-validators.ts:145`, `letter-validators.test.ts:73`).
- More-than-four-addressees to Distribution (`letter-validators.ts:265`, `letter-validators.test.ts:149`).
- Date-format-by-slot (`letter-validators.ts:287`, `letter-validators.test.ts:169`).
- Fig 7-8 relative indent engine and the MCO fixed ladder (`indent-engine.ts`, `tests/indent-engine.test.ts`, `tests/directive-ladder.test.ts`).
- All MCO and SECNAV directive paragraph-schema, cancellation-date and revision-suffix rules (`letter-validators.ts:368-790`, `letter-validators.test.ts:217-334`, `tests/secnav-directives.test.ts`).
- Directive page-1 and continuation ID block placement (`tests/directive-id-block.test.ts`) - the block itself is right; only its clearance over the body is not.
- Business-letter reference suppression and salutation parity (`tests/salutation-parity.test.ts`, `tests/emitter-parity.test.ts`).
- Enclosure marking and merge (`tests/enclosure-attachments.test.ts`, `tests/enclosure-rows.test.ts`).

---

## Recommended fix phases

Each phase is independently shippable and ends with tests that pin the rule it fixes.

### Phase 1 - Standard-letter output correctness (highest value, lowest risk)
Fixes the two things every standard-letter drafter hits.
- Add the blank line before "Copy to:" in the PDF so it lands on the second line below the signature (7-2.15.b), matching the DOCX.
- Give the Courier and directive paragraph branches the same `orphans={2} widows={2}` the correspondence branch has (Fig 7-1 3.a).
- Add a golden PDF-layout assertion for both, in the style of `tests/continuation-header.test.ts`.

Files: `src/components/pdf/NavalLetterPDF.tsx`, one new or extended test. Size: 2 files. Risk: low, both are additive layout changes with measurable assertions.

### Phase 2 - Endorsement correctness
The endorsement path currently produces five false compliance failures on a correct document, which trains drafters to ignore the dialog.
- Thread the endorsement reference offset into `validateReferences` (a `startLetter` parameter defaulting to `'a'`), and into `runLetterValidators` from `formData.startingReferenceLevel` when `documentType === 'endorsement'`.
- Add the matching enclosure-continuation rule: warn when an endorsement's `startingEnclosureNumber` is 1 while a basic letter is referenced.
- Align `startRefChar` scoping between the emitters: the PDF gates on `isEndorsement`, the DOCX does not. Pick the PDF's rule and apply it in `docx-generator.ts`.
- Make `indexToRefLetter` the single source for reference letters in both emitters so past-(z) behaviour agrees.

Files: `src/lib/letter-validators.ts`, `src/lib/docx-generator.ts`, `src/components/pdf/NavalLetterPDF.tsx`, `tests/letter-validators.test.ts`. Size: 4 files. Risk: medium, touches a shared validator, but it is pure and already well covered.

### Phase 3 - Civilian letter layout (business and executive)
Five geometry departures in one render branch, plus one emitter divergence each way.
- Move the business-letter ID block to the upper left (11-2.1) and leave the naval and directive right-anchored blocks alone.
- Uppercase the civilian signature name (11-2.9.a(1)).
- Replace the `View`-level `textIndent` with a `Text`-level first-line indent, and set it to 36pt (half inch) for both business (11-2.6, "or set margin at half inch") and executive (12-3.2.c(2), "must be indented 1/2 inch"). Match `firstLine` in the DOCX.
- Retune the close to 2 lines below the text and the name to 4 lines below the close (11-2.8, 11-2.9.a, 12-3.4, 12-3.2.e(3)(a)).
- Number the business-letter enclosure entries (11-2.10.a).
- Extend `tests/emitter-parity.test.ts` with a business-letter case asserting ID-block x-position, uppercase name, and the two line offsets.

Files: `src/components/pdf/NavalLetterPDF.tsx`, `src/lib/docx-generator.ts`, `tests/emitter-parity.test.ts`. Size: 3 files. Risk: medium, the civilian branch is shared by business, executive and DLA types, so the DLA path needs an explicit no-change assertion.

### Phase 4 - Make the validators tell the truth
Nothing here changes output; it changes what the drafter is told.
- Delete or replace the four hardcoded `pass` proofread checks (margins, page numbers, alignment, numbering) with either a real assertion or an honest "not automatically verifiable" status. The margin claim is currently false.
- Add a subject-line rule set: no acronyms (7-2.9.a, 12-3.2.c(4)), no terminal punctuation (Fig 7-1).
- Add an enclosure-order rule mirroring the reference-order rule (7-2.11.a).
- Warn when a naval signature line carries a rank (7-2.14.b lists no rank form).
- Warn on the endorsement copy-to rule for significant endorsements (9-2.5).
- Pass the real `vias` array into `runLetterValidators` from `proofread-checks.ts`.

Files: `src/lib/proofread-checks.ts`, `src/lib/letter-validators.ts`, `src/lib/signature-validators.ts`, `tests/letter-validators.test.ts`. Size: 4 files. Risk: low, all additive warnings, but expect noise complaints on the subject-acronym rule; ship it at `warn`.

### Phase 5 - Unbuilt formats and unwired gating
Largest and last, because each item is a new surface rather than a correction.
- Wire `getExportBlockers` into `useDocumentExport` and `useBatchGenerate` so the documented "export must refuse" contract holds on the download paths, not only in the signature ceremony.
- Build the standard-letter window-envelope format (Fig 7-3): expose `isWindowEnvelope` on the basic-letter form, suppress the "From:" line, substitute the address block, and keep the existing block validators.
- Build the same-page endorsement (9-1, 9-2.1.a): a mode that omits the letterhead, SSIC and subject and appends the endorsement below a rule on the previous signature page.
- Build the plain-paper memorandum (10-2.3) and the decision-memorandum block (10-2.5).
- Seed models of address from Appendices A and B behind the recipient fields.

Files: `src/hooks/useDocumentExport.ts`, `src/hooks/useBatchGenerate.ts`, `src/lib/schemas.ts`, `src/components/pdf/NavalLetterPDF.tsx`, `src/lib/docx-generator.ts`, new data module, new tests. Size: 7 or more files. Risk: high; split into one PR per format if the window-envelope work lands first, since it is the one with validators already written and waiting.
