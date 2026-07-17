# User-Driven Roadmap (2026-07-15, plan only)

Method: five personas walked through their real day with the current app, and every point of friction became a candidate. Candidates are ranked by user value against build cost, not by novelty. Deferred items from the parity program are folded in so this is the single backlog.

Personas: (1) the admin corporal drafting the same three letters every week, (2) the S-1 chief who reviews and kicks back drafts, (3) the brand-new join who has never opened SECNAV M-5216.5, (4) the XO/CO who signs, (5) the SCIF user working disconnected.

## Tier 1 - The kickback killers (highest user value)

The tool's reason to exist is ending the format-kickback cycle. These four attack the cycle itself, not just formatting.

### R1. Review mode with paragraph comments
The chief opens a shared link, flips a "review" toggle, attaches comments to specific paragraphs and fields, and sends back an annotated link (same encrypted-fragment transport, comments ride the payload). The drafter sees comment pins beside each paragraph, resolves them, and the resolved state travels on the next share. No server, no accounts - the link IS the routing.
Why first: every kickback today happens in email prose ("fix para 2b, wrong ref"). This closes the loop inside the tool. Effort: medium-high (comment model on ShareableState, pin UI, resolve flow).

### R2. Revision compare
Two saves of the same document render as a side-by-side or inline diff - what changed between the draft the chief saw and the one on their desk now. The library already stores full snapshots; this is a diff view over them, plus a "restore this version" action.
Effort: medium. Text diffing per field/paragraph, one dialog.

### R3. Autosave with crash recovery
Save is manual today; undo protects a session, a browser crash eats it. Debounced autosave to the library under a working-copy slot, and on next launch: "Recovered working copy from 14:32 - restore or discard." The library and undo snapshots already exist; this connects them.
Effort: low. Highest payoff-per-line in this document.

### R4. Package assembly (basic letter + endorsement chain)
Endorsements are drafted standalone today. A package view links a basic letter and its endorsement chain, keeps page numbering continuous (startingPageNumber exists but is hand-set), carries reference/enclosure sequences forward automatically, and exports the chain as one PDF.
Why: the endorsement continuation fields (starting ref letter, starting encl number, starting page) are exactly the fields users get wrong. Effort: high, but it automates the most error-prone manual arithmetic in the workflow.

## Tier 2 - Make the machine fix it (differentiation)

### R5. One-click autofix on validation issues
Validators currently say what is wrong; mechanical issues should offer "Fix." Re-letter references into first-citation order, renumber enclosures, uppercase the subject, correct date formats, insert the missing blank line the window-envelope rule wants. Each validator gains an optional fixer; issues with fixers render a button. One undo step reverses any fix.
Why: DonDocs renders format. This EDITS toward compliance - a category neither tool has. Effort: medium, incremental per rule (ship three fixers, grow).

### R6. Acronym first-use checker
SECNAV requires spelling out an acronym at first use. The military dictionary already exists for spellcheck; add a validator that finds acronyms used before definition and (with R5) offers to insert the spelled-out form. Effort: low-medium. Very visible compliance win.

### R7. Signature block validator + rank/name formatting
First-initial conventions, delegation-line rules ("By direction"), grade abbreviation correctness. Data exists in reference files; rules are well-defined. Effort: low.

## Tier 3 - Daily-driver ergonomics

### R8. Command palette (Ctrl+K)
Jump to any section, insert a clause, switch document type, export, open library - keyboard-first. The cmdk dependency is ALREADY installed and unused for this. Effort: low. Modern feel, power users adopt instantly.

### R9. Personal address book
Saved From/To/Via/Copy-to combinations ("my CO block", "HQMC ARD routing"), insertable like clauses. Profile covers the sender; nothing covers frequent recipients. Effort: low (mirror the clause-library pattern).

### R10. Save-as-my-template
Drafts and unit templates exist; a personal template slot ("my leave-request letter, blanks where the name goes") is distinct from both. Library entries flagged as templates, listed in the template picker. Effort: low.

### R11. Paste-to-import
Import handles files; users often hold letter TEXT in an email. A paste box that runs the same extraction pipeline on raw text. Effort: low (documentTextExtractor already separates extraction from file reading).

### R12. Wire the dead preview buttons
The preview pane's Print and Download icon buttons currently have no click handlers - found during the 508 sweep. Print opens the browser print dialog on the PDF; Download saves it. Effort: trivial. This is a defect wearing a feature costume.

## Tier 4 - Coverage growth (demand-driven)

### R13. Forms expansion pack
NAVMC 10274 and Page 11 exist. Candidates by traffic: award recommendation (1650), pros/cons worksheet, TAD request, light-duty/chit formats. Rule: add a form when three users ask, not before - each form is a bespoke generator with real maintenance weight.

### R14. AMHS depth
MARADMIN-specific validation, 69-character line enforcement audit, OPREP/CASREP skeletons. Scope after the next round of user feedback from the message-drafting community.

## Deferred carry-overs (already on the books)

1. Attachment persistence (library + .nldp embedding) and in-PDF enclosure hyperlinks.
2. Marking-aware import (P4.6) - detect portion prefixes and banners on imported documents.
3. Interactive walkthroughs - driver.js pending the LICENSES.md policy check, or build a 100-line in-house spotlight and skip the dependency question.
4. DOCX enclosure merge note, zustand state consolidation (unlocks per-keystroke undo granularity), 508 AT pass (NVDA + axe on the live build).
5. Track A standing items: MIU/marines.dev/app.gov, PDF tagging strategy (F1), CAC-native signing (requires middleware no browser app gets for free - keep sign-ready PDF + Adobe/DoD signing tools as the honest answer).

## What I ruled OUT, and why

- Real-time co-editing: requires a server and an accounts model - both violate the no-backend trust posture that is currently the app's strongest differentiator. R1's link-based review delivers 80% of the value at 0% of the infrastructure.
- Cloud sync of the library: same violation. Auto backup to a folder the user controls (OneDrive/shared drive) already achieves cross-machine portability on the user's terms.
- AI drafting/rewriting: policy exposure for official correspondence, network dependency, and the CDRM posture all argue against. The clause/template/example system delivers assisted drafting without generated content.
- Multi-tab editing: heavy state work for a niche gain; the library's fast switch covers it.

## Recommended sequence

Wave 1 (one session): R3 autosave, R12 dead buttons, R8 command palette, R7 signature validator - four small, immediately felt wins.
Wave 2 (one session): R5 autofix (first three fixers) + R6 acronym checker - the differentiation wave.
Wave 3 (one to two sessions): R2 revision compare, then R1 review mode - the collaboration wave, R1 informed by real link-sharing behavior.
Wave 4: R4 package assembly - biggest single feature, scoped after Wave 3 teaches how users actually chain endorsements.
Continuous: R9/R10/R11 slot into any wave as fillers; R13/R14 strictly on demand.

## Wave 1 - SHIPPED (2026-07-15)

Delivered the four quick wins, full verification discipline, tsc + eslint clean.

- R12 preview buttons: LivePreview Print drives the same-origin blob iframe's print dialog; Download saves the preview PDF under the export filename (via getExportFilename through ModernAppShell). Both disable while loading or when no preview exists. This closed a real defect - the buttons had no handlers, found during the 508 sweep.
- R7 signature validator: src/lib/signature-validators.ts - warns on a spelled-out first name where naval format wants initials, and on a delegation line that is not a recognized authority phrase (By direction / Acting / Deputy). All WARN severity by design. False-positive-bounded: surname-only, surname-first "SMITH, J. A.", and name particles (de la, van) do not trigger. Wired into runLetterValidators. tests/signature-validators.test.ts; 10/10 node-verified.
- R3 autosave + crash recovery: src/lib/autosave.ts (working-copy slot in the P1.3 settings store), src/hooks/useAutosave.ts (1.5s debounce, gated on a ready flag so profile defaults never clobber a recoverable copy), src/components/RecoveryDialog.tsx (restore/discard on launch). Cleared on explicit Save Draft and Clear Form. isRecoverable requires a doc type plus real content. 8/8 node-verified on fake-indexeddb.
- R8 command palette: src/components/CommandPalette.tsx - Ctrl/Cmd+K launcher over existing handlers (save, export PDF/DOCX, share, find, clear, library, guide, settings, insert clause, new document of any of the 25 types). Owns no business logic - invokes only parent handlers, so it cannot drift from the buttons. Uses the pre-existing cmdk-backed command primitive (zero new dependency).

Owed locally (Stephen): npm test (signature-validators.test.ts is new), npm run build, and manual QA - Ctrl+K opens the palette and each action fires; type in a letter, kill the tab, relaunch and Restore; Print/Download from the preview pane; enter "JOHN A. SMITH" as the signer and see the initials warning.

## Wave 2 next: R5 autofix (first three fixers) + R6 acronym checker - the differentiation wave.

## Wave 2 - SHIPPED (2026-07-15) - the differentiation wave

The category move: validators stop merely flagging and start correcting. tsc + eslint clean, 37/37 node checks.

### R5 autofix engine (src/lib/autofix.ts)
Fixer registry keyed to validator issue ids. Every fixer is a PURE function over document slices; the caller applies results through the normal setters, so ONE FIX = ONE UNDO STEP. Three standing rules, written into the file: only mechanical/unambiguous corrections, never touch content outside the rule's scope, and fixing must be idempotent.

Five fixers shipped (the roadmap asked for three):
1. `ref-citation-order` - the crown jewel. Reorders the reference list into first-citation order AND remaps the in-text citation letters so they keep pointing at the same reference. The remap runs ONLY inside reference clauses (reusing the validator's own regex), so a paragraph designator like "(a)" is never rewritten - explicitly tested.
2. `date-civilian-in-text` - "May 23, 2014" to "23 May 2014".
3. `date-abbreviated-in-text` - "5 May 15" to "5 May 2015", expanding the month. Two-digit years read as 20YY (documented: the abbreviated form belongs to current correspondence, so 19xx is not a live case).
4. `ref-notal-format-*` - bare NOTAL to (NOTAL). Prefix-matched.
5. `signature-initials` - "JOHN A. SMITH" to "J. A. SMITH" (pairs with the R7 validator).

Verified: each fixer idempotent, the ref fixer's output satisfies the validator that flagged it, scope containment proven, fixAll applies each fixer at most once. tests/autofix.test.ts.

### R6 acronym first-use checker (src/lib/acronym-validators.ts)
Finds acronyms used in body CONTENT without ever being spelled out with the acronym in parentheses. Suggests the expansion by inverting the military dictionary (1,131 acronym-to-expansion pairs available); flags ambiguity when the dictionary offers several readings.

NO AUTOFIX by deliberate choice - picking the right expansion and its casing for running text is judgment, and rule 1 says judgment stays advisory. All warn severity. Noise control: scans content only (subjects and directive titles are all-caps by format), plus a tight stoplist (roman numerals, emphasis words, universally-known organizations, format tokens). tests/acronym-validators.test.ts.

### ComplianceDialog (new surface) - and a real gap it closed
The Fix buttons needed a home, and building it exposed a defect: the live-preview banner truncated to two rules and pointed overflow at "see Proofread" - but Proofread runs a DIFFERENT check system (proofread-checks.ts) that never listed validator issues. Those issues had NO full surface anywhere. ComplianceDialog is now their home: grouped by severity, citations shown, Fix button per fixable issue, "Fix all N" action. Reachable from the tools menu, Ctrl+K, and a "Review & fix" button that replaced the misleading banner pointer.

Owed locally (Stephen): npm test (autofix.test.ts and acronym-validators.test.ts are new), npm run build, and the manual pass that matters - write a letter citing ref (b) before ref (a), open Compliance Issues, hit Reorder references, confirm the list AND the in-text citations both move, then Ctrl+Z once and watch it all revert.

## Wave 3 next: R2 revision compare, then R1 review mode - the collaboration wave.

## Wave 3 - SHIPPED (2026-07-15) - the collaboration wave

Closes the kickback loop inside the tool. tsc + eslint clean, 32/32 node checks, 2 new test files.

### R2 revision compare (src/lib/revision-diff.ts, RevisionCompareDialog)
Pure diff between two library snapshots - no new storage, it reads what the library already keeps. Two levels: document (which header fields, paragraphs, and list entries changed, classified added/removed/changed) and word (an LCS walk inside changed text, no dependency - inputs are paragraph-sized so the O(n*m) table is cheap). Dialog picks any two saves (defaulting to the two most recent), highlights word-level moves in green/red, and restores either revision. Reachable from the tools menu.

Verified: identical snapshots report clean, added/removed/changed classified correctly, paragraph and list entries diffed positionally, whitespace-only edits ignored, and the word diff RECONSTRUCTS BOTH SIDES LOSSLESSLY (the property that proves it never invents or drops text).

### R1 review mode (src/lib/review-comments.ts, ReviewPanel, ParagraphCommentButton)
The kickback loop, closed. Comments ATTACH to a paragraph, a field, or the document - and ride the SAME encrypted share payload, so they inherit the AES-256 crypto with zero new transport, zero server, zero accounts. The link IS the routing, exactly as the roadmap argued against real-time co-editing.

Flow: a reviewer opens a shared link, hits Start review, pins comments to specific paragraphs, and shares back. The drafter's link arrives with a toast naming the open-comment count, a ReviewPanel listing every comment open-first, and a pin on each commented paragraph showing its count. Resolve/reopen/delete all round trip.

Orphan handling: comments anchored to a deleted paragraph are pruned on add, so a stranded note can never hide from the drafter.

Verified: the round trip through generateEncryptedShareUrl/decryptSharedState carries anchors, authors, text, and resolved flags intact; documents without comments omit the field entirely (payload stays lean); orphan pruning keeps document-level comments while dropping dead paragraph anchors.

Owed locally (Stephen): npm test (revision-diff.test.ts and review-comments.test.ts are new), npm run build, and the manual pass that proves the wave - save a draft, edit it, save again, Compare Revisions and watch the word-level highlighting; then create an encrypted share link with a paragraph comment on it, open it in a private window, unlock, and confirm the comment arrives pinned to the right paragraph.

## Wave 4 next: R4 package assembly - the endorsement chain. Biggest single feature; Wave 3's link behavior now informs it.

## Wave 4 - SHIPPED (2026-07-15) - package assembly

The roadmap's biggest single feature, and the one that automates the arithmetic users most often get wrong. tsc + eslint clean, 39/39 node checks (35 sequence math + 4 chained render), new test file.

### The rule it automates
An endorsement must continue what came before it: pages run continuously across the package, references keep lettering (a, b, c...), enclosures keep numbering (1, 2, 3...). Today those three fields (startingPageNumber, startingReferenceLevel, startingEnclosureNumber) are hand-set, and hand-set means wrong.

### src/lib/package-assembly.ts (pure)
computeSequences walks the chain accumulating pages/refs/enclosures and emits each member's continuation fields. The basic letter always originates the sequences (page 1, ref a, enclosure 1); each endorsement continues from the running totals. Reference lettering rolls past z to aa (tested). validatePackage adds chain-integrity checks no single document can see: a package must begin with the basic letter, only endorsements may follow, endorsement levels must ascend without gaps or repeats, and unmeasured page counts warn that the math is provisional.

### src/hooks/usePackageAssembly.ts + PackageDialog
Build the chain from library documents, reorder, remove. "Measure pages" renders each member through the REAL PDF engine sequentially - the only honest source for a page count - because member N's starting page depends on the measured length of everything before it. "Export package PDF" re-renders each member with its computed sequence applied and merges the chain into one PDF via pdf-lib. Export is blocked while any chain-integrity failure stands.

### Verified end to end (the proof that matters)
A real 2-page basic letter (refs a, b; enclosure 1) chained to a FIRST endorsement, rendered through NavalLetterPDF and merged: the merged PDF's footers read 1, 2, 3, 4 CONTINUOUSLY - the endorsement's pages numbered 3 and 4, not restarting at 1 - with reference (c) and enclosure (2) correctly continuing the basic letter's sequences. Page 1 carries no number, per the standing rule.

Owed locally (Stephen): npm test (package-assembly.test.ts is new), npm run build, and the manual pass - save a basic letter and an endorsement, Assemble Package, add both, Measure pages, confirm the endorsement's "Starts: page N, ref (x), encl (n)" line matches expectation, then Export package PDF and check the footers run continuously.

### Roadmap status after Wave 4
Tier 1 (kickback killers): R1, R2, R3, R4 all SHIPPED.
Tier 2 (differentiation): R5, R6, R7 all SHIPPED.
Tier 3: R8 and R12 SHIPPED. R9 (address book), R10 (my templates), R11 (paste-to-import) remain as fillers.
Tier 4: R13/R14 stay demand-driven, by design.

## Post-wave defect fixes (Stephen's local run, 2026-07-15)

Two failures, both mine, different in kind:

1. R5 autofix test expectation was WRONG, implementation correct. tests/autofix.test.ts asserted the reference list came back in its input order. Ground truth: listed a='REF BEE', b='REF AY'; the text cites (b) first, so 'REF AY' must move to the front and become reference (a). The node harness had the right expectation - I contradicted myself between the two suites and the vitest file lost. Expectation corrected with the reasoning written beside it.

2. R7 signature validator had a REAL false positive. "J.A. SMITH" - initials run together without a space - was flagged as a spelled-out first name, exactly the failure class I claimed to have bounded. The old predicate only accepted a single letter with an optional period. looksLikeInitial now accepts a bare letter, one initial, and a RUN of initials ("J.A.", "J.A.B.", "J.A"), and is exported so fixSignatureInitials shares it - the fixer and the rule that triggers it can no longer disagree about what counts as initials. Regression tests added for the exact string, plus direct predicate coverage.

Lesson recorded: my node harnesses tested "J. A. SMITH" but never "J.A. SMITH". The vitest suites I wrote afterward found what the harness missed. Both layers earn their keep.

Remaining local failure: SOFFICE_PATH points at a LibreOffice install that does not exist on the machine (C:\Program Files\LibreOffice\program\soffice.exe). Environmental, not code - install LibreOffice there or repoint the variable.

## P3.5 clause library REMOVED (Stephen's ruling, 2026-07-15)

Removed at the user's direction. It was DonDocs-parity work: Cpl Chiofalo demoed canned clauses plus "save last paragraph as clause," and the Phase 0 audit confirmed the gap. In use it did not earn its place in the Body Paragraphs header - the presets saved seconds on one-line boilerplate, and the custom save reached only the LAST paragraph and never left the machine (localStorage, not carried by .nldp or share links).

Stripped: ClauseToolbar from the ParagraphSection header (header reverted to the plain title), the "Insert clause" group from the Ctrl+K palette, onInsertClause/handleInsertClause wiring through page.tsx -> DocumentLayout -> ParagraphSection, and the customClauses key from storage-utils STORAGE_KEYS.

Three files are now orphaned and MUST be deleted (the sandbox mount blocks file deletion, so this is a local step):
- src/lib/clause-library.ts
- src/components/letter/ClauseToolbar.tsx
- tests/clause-library.test.ts

Until they are deleted the build FAILS: clause-library.ts still references STORAGE_KEYS.customClauses, which no longer exists (verified: 3 x TS2339).

User-saved clauses already in a browser's localStorage under `semperscribe-custom-clauses` are now unreachable dead data. Harmless, self-clearing on any browser-data clear. No migration written, by decision - the feature is gone and the data has nowhere to go.
