# UX and policy plan, 2026-09-05

Three audits ran on 2026-09-05 against v0.4.8 on main: a policy audit of every rule the app renders or checks against SECNAV M-5216.5, MCO 5216.20B and MCO 5215.1K, a user-experience walkthrough of the built export by five personas, and a reconciliation of every roadmap document against the code. This plan merges their findings into PR-sized phases ordered by user value, with the policy citation each phase serves. The audits themselves are in `docs/audits/2026-09-05/`.

The owner's standard for this program: every function traces to policy, and the measure of a phase is whether it stops a kickback or removes a step from a drafter's day.

## What the audits agreed on

- The rendered output is right for the standard naval letter body, continuation pages, signature offsets, directive ladders, endorsement page numbering, and every directive paragraph rule. Those are pinned by tests and stay untouched.
- The rendered output is wrong in a small number of places every drafter hits: the PDF prints "Copy to:" one line below the signature instead of two (M-5216.5 7-2.15.b), the Courier and directive branches paginate without the two-line orphan and widow floor (Fig 7-1 3.a), and the civilian letter branch (business, executive) has no first-line indent, mis-spaces the close and the name, puts the identification symbols on the wrong side, and prints the signer's name as typed.
- The validators lie in two directions. An endorsement which correctly continues the basic letter's reference lettering draws five false failures because `validateReferences` always starts at (a). Four proofread checks are hardcoded to pass, one of them asserting a margin the generator does not produce.
- The editor is not usable without a mouse: the paragraph body is a plain div until clicked, so the primary input fails WCAG 2.1.1. The compliance banner exists only above 1280 px, so a laptop or phone drafter validates nothing. The header save indicator is dead code and reads "Draft" forever.
- Validation messages name code, not rules ("SSIC fails its document schema", cited to a TypeScript path). The spell checker flags six ordinary words in a 48-word paragraph and no real error. The template picker shows one of 69 templates with no visible filter.
- Every roadmap item R1 to R8 and R12 shipped and is real. R9 (address book), R10 (personal templates) and R11 (paste-to-import) are not started. The 508 assistive-technology pass has never run.

## Phases

Each phase is one PR, independently shippable, with tests which pin the rule it fixes. Versions are assigned at PR time.

### D.1 Standard-letter output correctness

Every standard letter with a copy-to list and every Courier or directive document.

- "Copy to:" on the second line below the signature line in the PDF (M-5216.5 7-2.15.b), matching the DOCX, which already inserts the blank line. `src/components/pdf/NavalLetterPDF.tsx` copyToSection.
- `orphans={2} widows={2}` on the Courier and directive paragraph branches, as the correspondence branch already has (Fig 7-1 3.a two-line rule). `NavalLetterPDF.tsx` around line 500.
- Golden layout assertions for both, in the style of `tests/continuation-header.test.ts`. The basic-letter golden snapshot moves by one line below the signature; the diff is the fix and is recorded in the PR.

Size: 2 files. Risk: low.

### D.2 Editor usable at every width, and honest about saving

- The paragraph body accepts keyboard focus and input without a mouse click: mount the textarea always, or give the read view `tabIndex`, `role="textbox"` and Enter to edit, with an accessible name carrying the paragraph number. `src/components/letter/ParagraphItem.tsx`.
- The compliance banner renders at every viewport width: lift it out of the `xl`-only preview aside in `src/components/layout/ModernAppShell.tsx` and `LivePreview.tsx`, and pass `issues` into `PreviewModal`.
- The header save indicator receives `isDirty` and `lastSavedAt` from `src/app/page.tsx`; it currently receives nothing.
- Component tests for the three, plus a smoke-test step which tabs from Subject into the body.

Size: 5 files. Risk: low to medium (ParagraphItem is the most-used component).

### D.3 Endorsement correctness

- `validateReferences` takes a starting letter, and `runLetterValidators` supplies `formData.startingReferenceLevel` for endorsements (M-5216.5 9-2.3). A correct FIRST endorsement citing (c) and (d) reports nothing.
- Warn when an endorsement's starting enclosure number is still 1 (9-2.4).
- One source for reference letters past (z) in both emitters (`indexToRefLetter`), and the same scoping rule for `startingReferenceLevel` in the DOCX as in the PDF.
- Tests in `tests/letter-validators.test.ts` and an emitter-parity case.

Size: 4 files. Risk: medium, shared validator, well covered.

### D.4 Messages that teach the rule, and gates that hold

- Schema-validator messages state the requirement and cite the manual paragraph, never a source path. `src/lib/schema-validators.ts`.
- The four hardcoded pass checks in `src/lib/proofread-checks.ts` either measure or say "not checked automatically". The margin check currently claims 1 inch on all sides while the top margin is 44 pt by a recorded ruling.
- Subject line rules at warn severity: no acronyms (7-2.9.a, 12-3.2.c(4)), no terminal punctuation (Fig 7-1).
- Enclosure order mirrors the reference order rule (7-2.11.a). Rank in a naval signature line warns (7-2.14.b lists no rank form).
- `proofread-checks.ts` passes the real vias to `runLetterValidators`.
- `getExportBlockers` gates the PDF and DOCX download paths and the batch generator, not only the signature ceremony, and the native `alert()` in `useDocumentExport` becomes the compliance dialog with a jump-to-field action.

Size: 6 files. Risk: low, additive.

### D.5 Civilian letter layout

Business and executive correspondence share one render branch.

- Identification symbols upper left for the business letter (11-2.1); signer's name in capitals (11-2.9.a(1)); first-line indent of half an inch on a Text node, not a View (11-2.6, 12-3.2.c(2)), matched in the DOCX; close two lines below the text and name four lines below the close (11-2.8, 11-2.9.a, 12-3.4, 12-3.2.e(3)(a)); numbered enclosure entries (11-2.10.a).
- An emitter-parity case for the business letter, and a no-change assertion for the DLA path which shares the branch.

Size: 3 files. Risk: medium.

### D.6 Spell check stops crying wolf

- English spelling goes to the platform (`spellcheck` on the textarea). The custom pass keeps military terms and acronym first-use (2-17.c), which carry policy weight.
- `SpellCheckBar` reports only what the custom pass owns.

Size: 2 files. Risk: low.

### D.7 Reuse for the daily driver

- Template picker shows every template with a "matches this document type" chip, and labels the active filter. `src/hooks/useTemplates.ts` and the picker.
- The library empty state offers to save the current document. A Ctrl+K hint in the header.
- Paste-to-import (roadmap R11): a text box beside the file picker feeding `correspondenceParser.ts`.

Size: 5 files. Risk: low.

### D.8 First run and accessibility close-out

- Short consent modal linking to the full text; a "start from a filled example" card on the landing page sourcing the shipped `.nldp` example; an empty state in the preview naming the six required fields.
- Section headers become heading elements; the SSIC and auto-suggest pickers get combobox ARIA and arrow keys; touch targets at 390 px reviewed.
- An axe pass in the e2e suite (`@axe-core/playwright`) with a recorded baseline. Delete the orphaned `ModernParagraphEditor.tsx` and `SimpleCombobox.tsx`.

Size: 8 files. Risk: medium.

### Later, each its own plan entry

- Standard-letter window envelope format (Fig 7-3): validators exist, the format does not.
- Same-page endorsement (9-1, 9-2.1.a). Plain-paper memorandum (10-2.3) and the decision block (10-2.5).
- Models of address from Appendices A and B behind the recipient fields.
- `.nldp` enclosure portability and in-PDF enclosure links.
- Personal address book (R9), scoped small, as a validation experiment.
- zod: held at 4.4.3 since 0.5.7 because 4.5.x adds 83 KB to the initial load (`docs/audits/2026-09-05/bundle-attribution.md`). Lift it with a `zod/mini` migration or a slimmer release.

## Not in this plan

- The 44 pt top margin. It departs from 7-2.1 by a recorded 2026-06-10 ruling to match Word output; D.4 makes the proofread panel stop claiming otherwise.
- Classification and CUI marking. Out of scope by project policy.
- Zustand consolidation and the schemas.ts split. Their premise (state sprawl blocks undo) was overtaken when undo and revision compare shipped on snapshots.
- B.2 seal downscaling stays last per the owner.

## Order and sizing

| Phase | Files | Risk | Serves |
|---|---|---|---|
| D.1 | 2 | low | every standard letter |
| D.2 | 5 | low-medium | every drafter, keyboard and laptop users |
| D.3 | 4 | medium | every endorsement |
| D.4 | 6 | low | trust in the validators |
| D.5 | 3 | medium | business and executive letters |
| D.6 | 2 | low | every paragraph typed |
| D.7 | 5 | low | the weekly drafter |
| D.8 | 8 | medium | new joins, assistive technology |
