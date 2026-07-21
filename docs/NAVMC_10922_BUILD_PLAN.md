# NAVMC 10922 - Phased Build Plan

Companion to `docs/NAVMC_10922_SPEC.md` (the rule source). Plan date 2026-07-20.
Execution rule - no phase starts without Stephen's approval of the prior phase's output.
Scope per spec decision 9 - spouse and children only. Secondary dependent engine excluded.

**Status 2026-07-20.** All phases built and verified. Phase 5 executed as a PROGRAMMATIC
flattened renderer (Stephen-approved deviation): instead of Adobe-printed template pages,
`tools/aa-forms/extract_10922_layout.py` derives the full page layout - labels, cell
rectangles, radio option boxes, rotated section sidebars, master-page CUI artwork - from the
official blank's own template.xml, and `src/services/pdf/navmc10922Generator.ts` redraws it
with pdf-lib. Values come from `navmc10922Values()` - the same 102 positional selectors as
the XFA emitter, so both outputs always agree. Routing: plain GAIN/LOSS PDF exports produce
the official editable XFA form; START, signature-field, and enclosure exports plus the live
preview take the flattened redraw. Plan deviations recorded: Phase 2's four interleaved
DynamicForm instances (paper section order), Phase 1's missed `pdfPipelineService.ts`
registration (`Record<PdfPipeline, ...>`), and the live preview consuming `PIPELINE_MAP` on
a timer, which rules out throwing stubs.

## Architecture verdict

The 10274/118(11) pattern extends cleanly. Eight registration points, one new emitter
pattern, two custom UI components. No refactor of existing code required.

| Concern | Approach | Precedent |
|---|---|---|
| Form definition | `DocumentTypeDefinition` in `src/lib/schemas.ts`, registered in `DOCUMENT_TYPES` and the `DocumentSchema` union | `AAFormDefinition` schemas.ts:348-433 |
| UI rendering | `DynamicForm` for scalar sections, custom components for the three grids | `Page11RemarksSection.tsx` |
| Editable export | New positional datasets emitter in `xfa-form-fill.ts` | `buildNavmc10274Xml` - structure only, the name-keyed `tag()` helper is unusable (77 duplicate names) |
| START fallback | Flattened generator via `PIPELINE_MAP` | `navmc11811Generator.ts` + `boxes.json` |
| Validation | Pure functions returning `ValidationIssue[]`, folded into the export gate | `signature-validators.ts`, `getExportBlockers` |
| Tests | Positional round-trip against the real blank | `tests/xfa-form-fill.test.ts` |

## Phase 0 - assets and byte-level groundwork

No app code. Output is inspectable artifacts only.

1. Normalize `NAVMC 10922 (EF).pdf` with pikepdf (decrypt, rewrite xref - the raw file throws
   padding errors in pypdf) and commit as `public/forms/navmc-10922-blank.pdf`. Same treatment
   the 10274/118(11) blanks received per `tools/aa-forms/README.md`.
2. Extend `tools/aa-forms/` with a 10922 extraction script that dumps the 102-node datasets
   sequence and the template picture clauses. This is the machine-readable positional map -
   single source for the emitter, the generator, and the tests.
3. Sandbox verification - refill the normalized blank's datasets with 102 sentinel values,
   re-extract, assert order and count. Proves normalization did not disturb the XFA array.

Gate - Stephen reviews the normalized blank in Adobe (renders, fields editable) and the
extracted map.

Risk - low. All operations already proven in this session against the raw file.

## Phase 1 - data model and schema

1. `src/types/navmc.ts` - add `Navmc10922Data`. Semantic model, not positional - named fields
   grouped by form section, plus fixed-length arrays: `dependents[6]`, `custodian[1]`,
   `dissolutions[4]`. Include the app-side fields the paper form lacks:
   `attestingOfficerName` (spec decision 8), `reason: 'start' | 'gain' | 'loss'` (START is
   unbindable but the app must know it), `lifeEventDate` (drives the 30-day warning).
2. `src/lib/schemas.ts` - `Navmc10922Schema` (Zod), `Navmc10922Definition`
   (`id: 'navmc10922'`, `category: 'forms'`, `exportFormats: ['pdf']`,
   `showClassification: false`, `features.pdfPipeline: 'navmc10922'`), add to the
   `DocumentSchema` union at :2387, `DOCUMENT_TYPES` at :2419, and the `PdfPipeline` union
   at :48.
3. Relationship vocabulary - Zod enum restricted to the phase scope: SPOUSE, SON, DAUGHTER,
   STEPSON, STEPDAUGHTER, ADOPTED SON, ADOPTED DAUGHTER, CHILD BORN OUT OF WEDLOCK.
   Secondary values excluded, not hidden - selecting scope expansion later is a schema change,
   which is the honest representation of decision 9.
4. Date handling - store ISO internally, render `M/D/YY` at emit time per the template picture
   clauses (spec section 2 constraint 6). Date of application renders `MMM D, YYYY`.

Gate - typecheck passes, form appears in the dynamic-forms picker, scalar fields render via
`DynamicForm`. No export yet.

Risk - low. Pure registration work.

## Phase 2 - UI section components

`DynamicForm` handles scalars. Three grids need custom components, same pattern as
`Page11RemarksSection` (schema keeps fields for validation, component renders).

1. `Navmc10922DependentsGrid` - 6 fixed rows x 5 columns. Row 1 relationship drives the
   conditional machinery. No add-row control - capacity is a form fact, overflow is a
   validator error (decision 2).
2. `Navmc10922DissolutionGrid` - 4 fixed rows. Visible only when either prior-marriage
   answer is YES.
3. `Navmc10922CustodianRow` - single row, visible when any dependent is flagged as living
   outside the member's household.
4. Conditional logic per spec section 5 - Section 4 present-marriage block hidden when
   unmarried, Section 5 block requires a child row, Section 6 fields gated on the spouse
   service radio.
5. Effective-date assist - when relationship and trigger date (marriage, birth, adoption)
   are present, compute DATE ALLOWANCE CLAIMED FROM per FMR para 10.3 / Table 26-1 rule 5,
   pre-fill, and show the citation. User may override; an override gets a warning badge,
   never a block. Sourcing per spec section 10a.
6. Section 7 composer aid - plain textarea plus a live character-width meter against field
   93's real capacity (spec: multiline widget, one line tall, `vScrollPolicy="off"`,
   silent clip). Per decision 10 the user writes the text; the app only measures it.

Gate - Stephen drives the form through the four sample scenarios from the cancelled manual
(marriage no priors, marriage with priors, birth of child, stepchild) and signs off on flow.

Risk - medium. Conditional interplay between grids is the largest UI surface. Mitigated by
fixed-row design - no dynamic list state.

## Phase 3 - validators

`src/lib/navmc10922-validators.ts`, exporting `runNavmc10922Validators(data): ValidationIssue[]`,
wired into the `useDocumentExport` gate via `getExportBlockers`.

Blockers (severity `block`) - spec section 9 hard errors: attesting officer name equals member
name; any dissolution date on or after present marriage date; relationship outside the enum
(Zod catches this first, validator backstops); YES answers with empty dependent blocks
(# of times, dissolution rows, court order details, Section 5 info, Section 6 fields);
secondary-loss narrative missing (scoped per spec - primary loss downgraded to warn);
capacity overflow; Section 7 text exceeding field 93 width.

Warnings (severity `warn`) - CMC-routing relationships detected with attachment list;
foreign-divorce doubtful triggers (spec section 6, three patterns); application date more
than 30 days after `lifeEventDate`; effective-date override; custodian row populated with no
out-of-household dependent and the inverse.

Every issue carries `citation` - the MCO paragraph or FMR table, verbatim from the spec.

Gate - unit tests. One test per blocker and per warning, table-driven.

Risk - low. Pure functions, spec section 9 is the enumeration.

## Phase 4 - XFA editable export

1. `xfa-form-fill.ts` - `buildNavmc10922Xml(data: Navmc10922Data): string`. Positional
   emitter: a 102-entry ordered array of `(nodeName, valueSelector)` pairs generated from the
   Phase 0 map, serialized in sequence inside `XFA_WRAP`. Radio groups emit the mapped value
   strings from spec section 4; empty selections emit empty nodes. The 8 global-bind fields
   emit once, in the verified tail order.
2. `officialFormPath` - add `'navmc10922' → 'forms/navmc-10922-blank.pdf'`.
3. `exportOfficialForm` - branch for the new builder. `fillXfaDatasets` is reused unchanged.
4. `useDocumentExport.ts:70` - extend the XFA-route condition. Signature-field and
   enclosure exclusions apply as they do for 10274.
5. Reason handling - GAIN and LOSS emit through the bound radio (values 3 and 2). START
   cannot emit; the export toast states the box will be blank in Adobe and offers the
   flattened path (Phase 5).

Gate - export each Phase 2 scenario, open in Adobe, verify every field landed in the right
box and stays editable. Sandbox proxy: re-extract datasets from the produced bytes and diff
against expected node values (the Phase 0 harness).

Risk - medium. Positional emitters fail silently by off-by-one. Mitigation - the emitter and
the test derive from the same generated map, and the round-trip test asserts all 102 positions.

## Phase 5 - flattened fallback (START path)

1. Asset dependency, Stephen-supplied - the XFA blank has no drawable page (shell only), so
   flattened template pages cannot be extracted from it. Open the blank in Adobe, print to
   PDF, supply the 2-page flattened blank. It becomes
   `public/templates/navmc10922/page1.pdf`, `page2.pdf`.
2. `boxes.json` - coordinate map generated from the spec section 3 x/y/w/h table (mm to
   bottom-left points conversion), then hand-tuned against the printed pages.
3. `src/services/pdf/navmc10922Generator.ts` - `generateNavmc10922(data)` following
   `navmc11811Generator.ts`: embed template pages, `drawTextInBox` per box, check marks drawn
   as X glyphs at checkbox coordinates - including START, the whole point of this path.
4. `pdfPipelineService.ts` - `buildNavmc10922Data` + `PIPELINE_MAP` entry.
5. Routing - START applications and any export with signature fields or enclosures take this
   path automatically; GAIN and LOSS default to XFA with flattened available on request.

Gate - side-by-side of flattened output against an Adobe-filled reference for one scenario.
Print-parity, not pixel-parity.

Risk - highest of the plan. Coordinate tuning is iterative and depends on the Adobe-printed
asset's scaling. Contained - this phase touches nothing outside its own generator.

## Phase 6 - tests and verification

1. `tests/navmc10922-xfa.test.ts` - positional round-trip: fill the real blank, decode the
   datasets stream, assert all 102 nodes by index, assert `NeedsRendering`, assert the
   non-XFA-base throw. Mirrors `xfa-form-fill.test.ts`.
2. `tests/navmc10922-validators.test.ts` - the Phase 3 table.
3. Golden - flattened generator snapshot under `tests/golden/` with the mocked fonts.
4. Sandbox reality - vitest is unreliable here; CI runs it (`.github/workflows/test.yml`).
   Local sandbox verification uses the Phase 0 esbuild harness, consistent with the
   DONDOCS_PARITY_PLAN workaround.
5. Docs - spec cross-reference block, EXPORT_GUIDE.md entry, CUI-artwork export warning
   text review (spec constraint 5 - the marks are form artwork, the app adds nothing).

Gate - CI green, Stephen's final Adobe pass on both export paths.

## Sequencing and sizing

| Phase | Depends on | Size | New files | Modified files |
|---|---|---|---|---|
| 0 | - | S | 2 (blank, extraction script) | 0 |
| 1 | 0 | M | 0 | 2 (types, schemas) |
| 2 | 1 | L | 3 components | 1-2 |
| 3 | 1 | M | 1 | 1 (export hook) |
| 4 | 0, 1 | M | 0 | 2 (xfa-form-fill, export hook) |
| 5 | 0, 2, Stephen asset | L | 3 (generator, 2 templates) + boxes.json | 2 (pipeline service, schemas) |
| 6 | all | M | 2-3 tests | 0 |

Phases 3 and 4 are parallelizable after 1. Phase 5 is last and independently shippable -
the form is usable for GAIN and LOSS at the end of Phase 4.

## Standing constraints

- File writes through Write/Edit tools only - bash heredoc writes have NUL-corrupted mounted
  files before (render-pipeline memory).
- Section 8 approving-authority blocks render read-only and are never populated (spec
  section 5). Field indices 86-92 emit empty.
- No CUI markings added by the app. The blank's own artwork carries them; the export warning
  text mentions this and nothing else.
- Every rule surfaced to the user carries its citation, per the spec's source-labeling
  convention.

## Confidence

| Item | Score | Basis |
|---|---|---|
| Registration wiring | 0.95 | All 8 touch points verified by codebase exploration with line references |
| Positional emitter correctness | 0.92 | Order verified twice against shipped datasets; single generated map feeds emitter and test |
| Grid UI effort estimate | 0.75 | Page11RemarksSection precedent exists, but three interacting grids exceed anything current |
| Flattened coordinate accuracy | 0.65 | Depends on Adobe-printed asset scaling; iterative by design |
| Overall plan shape | 0.90 | Weakest items are contained in their own phases and block nothing upstream |

Awaiting approval to start Phase 0.
