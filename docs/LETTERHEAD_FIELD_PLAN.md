# Letterhead Spelled-Out Field - Implementation Plan

Status: awaiting approval. No code edited.
Date: 2026-07-23
Trigger: MWCS-28 (RUC 00207, MCC 1PB) requested a spelled-out letterhead.

## Objective

Render a spelled-out command heading for a selected unit while preserving abbreviation search. Store the spelled-out lines on the unit record. Keep unitName abbreviated as the search key.

## Chosen approach

Add one optional field to the Unit record. unitName stays abbreviated. The new field holds the spelled-out heading lines. Selection and both renderers read the new field when present and fall back to current behavior when absent.

## Corrected content for MWCS-28

The block handed to the unit carried two word errors. Correct titles:

- MARINE WING COMMUNICATIONS SQUADRON 28
- MARINE AIR CONTROL GROUP 28  (not "Wing Control Group")
- 2D MARINE AIRCRAFT WING  (not "Marine Air Wing")
- PSC BOX 8071
- CHERRY POINT, NC 28533-0071

## Verified current behavior

- Unit shape: ruc, mcc, uic, unitName, streetAddress, cityState, zip. All required strings. units.ts lines 1-9.
- Records load lazily through a cached dynamic import. reference-data.ts loadUnits, useReferenceData useUnits.
- Selecting a unit copies unitName into letterhead line1, blanks line1b, maps streetAddress to line2, and cityState plus zip to line3. UnitInfoSection.tsx lines 38-51.
- Search filters on unitName, ruc, and mcc only. UnitInfoSection.tsx lines 66-72.
- PDF heading prints line1, then line1b, then line2, then line3. line1b prints only for basic, multiple-address, and endorsement. NavalLetterPDF.tsx lines 887-890. A second header block prints line1, line2, line3 with no line1b. NavalLetterPDF.tsx lines 876-878.
- DOCX heading builds [line1, line1b, line2, line3] for the standard-letter family and [line1, line2, line3] otherwise. docx-generator.ts lines 179-184.
- FormData is a permissive key bag, so a new key serializes into saved letters and autosave with no type change. types/index.ts lines 6-9.

## Root constraint

A spelled-out MWCS-28 heading needs three lines: squadron, group, wing. The form exposes two heading slots, line1 and line1b, and line1b prints on only three document types. Three spelled-out echelons do not fit two slots, and the second slot hides on memos and other types.

## Design (recommended: multi-line heading)

Data:

- Add `letterhead?: string[]` to the Unit interface. Ordered heading lines. Absent on every current row.
- MWCS-28 record gains letterhead: ["MARINE WING COMMUNICATIONS SQUADRON 28", "MARINE AIR CONTROL GROUP 28", "2D MARINE AIRCRAFT WING"]. unitName stays "MWCS-28 MACG-28 2D MAW".

Form:

- Introduce `headingLines?: string[]` on formData as the canonical heading source. Selection sets headingLines from unit.letterhead when present. When absent, selection keeps the current line1 and line1b path untouched.

Render:

- Both PDF header blocks and the DOCX header prefer headingLines when present and print each entry as a header line on every document type, followed by line2 and line3. When headingLines is absent, all three render paths keep today's exact logic.

Search:

- Unchanged. unitName keeps the abbreviation, so a search for "MWCS-28" still matches.

## Alternative (lighter, letter-family only)

- Reuse line1 and line1b. Set line1 to the squadron and line1b to "MARINE AIR CONTROL GROUP 28, 2D MARINE AIRCRAFT WING".
- Cost: two files instead of four.
- Defect: line1b prints only on basic, multiple-address, and endorsement, so the group and wing vanish on memos and other types. Acceptable only if this unit issues those three types.

Recommendation: the multi-line design. It renders correctly on every document type and matches the DoD-readiness target.

## Phases

Phase 1 - Data and read path

- Add `letterhead?: string[]` to Unit. units.ts lines 1-9.
- Add the letterhead array to the MWCS-28 record. units.ts line 2478.
- Map unit.letterhead to formData.headingLines in handleUnitSelect. UnitInfoSection.tsx lines 38-51.
- Update both PDF header blocks and the DOCX header to render headingLines when present, on all document types. NavalLetterPDF.tsx lines 876-878 and 887-890, docx-generator.ts lines 179-184.
- Acceptance: selecting MWCS-28 renders three spelled-out heading lines plus the two address lines in PDF and DOCX across basic letter, memo, and endorsement. Selecting any other unit renders byte-identical output to the baseline.

Phase 2 - Manual entry and persistence

- Extend the manual-entry panel to show and edit heading lines when headingLines is set. UnitInfoSection.tsx lines 181-216.
- Confirm headingLines survives save, autosave, document library, and share-link encoding. Check url-state.ts for key whitelisting. Add headingLines to the encoder if it drops unknown keys.
- Acceptance: a saved and reloaded MWCS-28 letter keeps the spelled-out heading. A share link reproduces it.

Phase 3 - Tests

- Unit test: handleUnitSelect maps letterhead to headingLines and leaves legacy units on the line1 path.
- Render test: sandbox verify via esbuild plus soffice per the I-Type pipeline. Confirm three heading lines on memo output.
- Regression test: a legacy unit produces unchanged headers.

Phase 4 - Verify and document

- Render MWCS-28 in every affected document type, screenshot, and inspect.
- Update README unit-data notes if they describe the Unit shape.

## Regressions guarded

- Search by abbreviation: preserved, unitName unchanged.
- Legacy units: every render path falls back when headingLines and letterhead are absent, so existing output does not shift.
- Saved letters: permissive FormData carries the new key with no migration.

## Open item to confirm before Phase 1

- Multi-line design across all document types, or the lighter letter-family-only design. Recommendation is multi-line.

## Rollback

- Remove the letterhead array from the record and the headingLines branches. No schema migration, since the field is optional and additive.
