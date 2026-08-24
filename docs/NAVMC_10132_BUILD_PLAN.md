# NAVMC 10132 - Phased Build Plan

Companion to `docs/NAVMC_10132_SPEC.md` (the rule source). Plan date 2026-08-23.
Execution rule - no phase starts without Stephen's approval of the prior phase's output.
Scope per spec decisions locked 2026-08-23: enlisted only, AcroForm fill, capture-and-export,
full 167-offense picker with minor-offense warnings.

Status: not started. Awaiting approval to begin Phase 0.

## Architecture verdict

The 10922 pattern extends, but the export half does NOT. NAVMC 10132 is a plain AcroForm, so
`xfa-form-fill.ts` is unusable and a new generic filler is required. That filler is an asset,
not a cost: DD 137 in the 10922 backlog is also a plain AcroForm and reuses it unchanged.

The distinctive risk on this form is not layout. It is that three pieces of legally
consequential behavior live in PDF JavaScript the app cannot execute, and each produces a
silently wrong document if reimplemented carelessly. Phase 2 exists to isolate that behavior
into pure functions before any UI or emitter touches it.

| Concern | Approach | Precedent |
|---|---|---|
| Form definition | `DocumentTypeDefinition` in `src/lib/schemas.ts`, registered in `DOCUMENT_TYPES` and the `PdfPipeline` union | `Navmc10922Definition` |
| Derived legal text | Pure functions in `navmc10132-utils.ts`, tested against the decoded PDF scripts | none, new pattern |
| Code tables | Static data modules with a generated-map diff test | `navmc10922-map.json` |
| UI rendering | `DynamicForm` for scalar sections, custom components for offenses, victims, punishment, remarks | `Navmc10922Sections.tsx` |
| Editable export | NEW generic `acroform-fill.ts` over pdf-lib's form API | none. `xfa-form-fill.ts` for routing shape only |
| Validation | Pure functions returning `ValidationIssue[]`, folded into the export gate | `navmc10922-validators.ts` |
| Unit-diary handoff | Copyable text or CSV block | `edms-handoff.ts` |
| Tests | Named round-trip against the real blank | `tests/navmc10922-xfa.test.ts` |

---

## Phase 0 - assets, byte-level groundwork, and three probes

No app code. Output is inspectable artifacts and three answered questions. Two of the three
probes can change the shape of later phases, which is why they run first.

1. Commit the blank as `public/forms/navmc-10132-blank.pdf`. Unlike the XFA blanks this file
   needs no pikepdf normalization: it loaded cleanly in both pypdf and pdf-lib during the
   audit. Commit it byte-identical to the supplied file and record its SHA-256, so a future
   form revision is detectable rather than assumed.
2. `tools/aa-forms/extract_10132_map.py`, mirroring `extract_10922_map.py`. Emits
   `navmc10132-map.json`: field name, type, page, rect, `/Ff`, `/Opt` export AND display
   values as separate columns, `/MaxLen`, and computed character capacity. The export/display
   split is not cosmetic - spec defect 3.3 is exactly this distinction.
3. **Probe A, decision D-2.** Render the audit's filled output through the app's real pdfjs
   preview component and look at it. Widgets paint, or they do not. A negative answer adds
   Phase 5b and roughly the 10922 Phase 5 effort.
4. **Probe B, the UR3 question.** Fill the blank twice: once leaving `/Root /Perms /UR3` in
   place, once deleting it. Open both in Acrobat and in Reader. Compare what each shows. An
   invalid signature warning reads as tampering. No signature at all reads as an ordinary
   form. Pick the less alarming honest state. This is a new decision, D-12.
5. **Probe C, decision D-5.** Write a long value to `21 REMARKS`, save, reopen in Acrobat, and
   confirm the RichText flag does not suppress the `/V` text. If it does, clear bit 26 on write.
6. Sentinel round-trip harness, promoted from the audit script to a committed tool: fill all
   63 fillable fields plus the 4 unlocked read-only fields, re-extract, assert 67 of 74 by name
   and value, assert the 7 signature widgets untouched.

Gate - Stephen reviews the extracted map and the two Acrobat renders from Probe B, and answers
D-2, D-5, and D-12.

Risk - low. Every operation was executed during the audit. The probes are the deliverable.

Parallel, non-blocking: draft `docs/NAVMC_10132_DEFECT_REPORT.md` (spec D-6). Four findings -
victim-status vocabulary split, repealed 10 U.S.C. 486 reference, dead MCO 011402.G detention
trigger, Art. 78 and 109A dropdown gaps. Routed to CMC (JA) through the MARADMIN 427/23 POCs.
This blocks no code and should not wait on the build.

---

## Phase 1 - data model, code tables, schema

1. `src/types/navmc.ts` - `Navmc10132Data`. Semantic model, not positional. Fixed-length
   arrays `offenses[5]` and `victims[5]`, each row carrying both the form label and the
   resolved MCTFS code. App-side fields the paper lacks: `punishments[]` as structured code
   plus parameters, `remarkEntries[]` as structured composer rows, `accusedPayGrade`
   (drives W-08), `authorityPayGrade` (drives W-05), and `overflowToItem21` flags.
2. `src/lib/navmc10132-articles.ts` - 167 rows of
   `{ formLabel, mctfsCode, articleNumber, minorOffenseRisk }`. Generated from the Phase 0 map
   plus the MCTFSPRIUM article table, committed as reviewed data, not computed at runtime.
3. `src/lib/navmc10132-punishments.ts` - N01 through N17 with
   `{ code, description, statute, appliesTo, ceiling, parameters[], renderTemplate }`.
   N01, N02, N03 marked officer-only. N05 marked withheld pending D-10.
4. `src/lib/schemas.ts` - `Navmc10132Schema`, `Navmc10132Definition`
   (`id: 'navmc10132'`, `category: 'forms'`, `exportFormats: ['pdf']`,
   `showClassification: false`, `features.pdfPipeline: 'navmc10132'`), plus the `PdfPipeline`
   union, the `DocumentSchema` union, and `DOCUMENT_TYPES`.
5. `pdfPipelineService.ts` gets its `PIPELINE_MAP` key in this phase, not later.
   `Record<PdfPipeline, ...>` demands it, and the 10922 build learned that a throwing stub
   crashes the live preview, which consumes the map on a timer. Ship a working stub that
   returns a notice page.
6. Dates - store ISO internally, emit `yyyy-mm-dd` for all nine date fields, matching the
   form's own `AFDate_FormatEx` scripts. Use the existing `date-picker` ControlType and its
   ISO local-date conversion. Never `new Date('YYYY-MM-DD')`.

Gate - typecheck passes, the form appears in the dynamic-forms picker, scalar fields render.
Article crosswalk test green: every one of the 167 form labels resolves to exactly one code,
the two sexual-harassment labels resolve to 92.1 and 134.110.

Risk - low. Registration plus reviewed static data.

---

## Phase 2 - the derivation engine

`src/lib/navmc10132-utils.ts`. Pure functions, no React, no pdf-lib. This phase exists because
three behaviors on this form are generated by PDF JavaScript that neither pdf-lib nor the app
will ever run, and each one produces a plausible-looking wrong document when done by hand.
Isolating them here means they get tested against the decoded scripts before anything consumes
them.

1. `bookerStatement(demand, counselOpp, refused): string` - the five-branch decision from spec
   defect 3.2, evaluated in the script's own order: vessel exception, refusal to sign, refusal
   of NJP, no counsel opportunity, acceptance. Returns the exact strings, including the
   `United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980)` citation in the vessel branch.
2. `coerceDemand(demand, refused): string` - reproduces the script's forced coupling. When
   refusal is checked and demand still reads "do not demand trial," demand becomes "I demand
   trial and refuse non-judicial punishment."
3. `renderPunishment(punishments[]): string` - structured N codes plus parameters to the
   prescribed abbreviated string, using the eleven authorized abbreviations. Must produce the
   MCO's worked examples verbatim from structured input. Returns the rendered string and its
   measured length so the caller can act on overflow.
4. `composeRemarks(entries[]): string` - the ten prescribed `YYYY-MM-DD ITEM n:` formats from
   spec 5.4, chronologically ordered. The two ITEM 13 stay-of-punishment lines are literal
   strings, not parameterized.
5. `capacityOf(fieldName): number` and `fits(fieldName, value): boolean`, reading the Phase 0
   map. One source for the meters, the validators, and the emitter.
6. `resolveArticle(formLabel)` and `resolvePunishmentAuthority(code, authorityPayGrade)`.

Gate - unit tests only, no UI. Table-driven, one case per Booker branch, one per coercion
path, and every MCO worked example round-tripping through `renderPunishment` to its exact
published string. That last assertion is the phase's real gate: if structured input cannot
reproduce the order's own examples, the punishment model is wrong and Phase 3 must not start.

Risk - medium. The Booker branches are transcribed from decoded scripts and are verifiable.
The punishment renderer is the uncertain part, because the MCO's examples vary in phrasing and
some of that variation may not be derivable from a code plus parameters. Contained: if a form
of words resists templating, that punishment falls back to a free-text parameter and the phase
still ships.

---

## Phase 3 - UI section components

Nine sections per spec 5. `DynamicForm` handles four of them. Five need custom components.

1. `OffensesSection` - five rows, collapse-and-add, each row carrying a searchable article
   combobox over 167 options grouped by article number, an 85-character summary meter, and the
   finding select. Finding disabled until the row has an article. Rows F and beyond route to
   the remark composer.
2. `AccusedElectionSection` - the three item-2 controls plus a live read-only Booker preview
   underneath, naming the branch that produced it. Watching the statement change when the
   refusal box is checked is the point of building this in an app rather than handing someone
   the PDF.
3. `PunishmentSection` - add punishment codes from the enlisted-legal set, per-code parameter
   inputs, live ceiling check, live authority-grade check against item 8A, and a 123-character
   meter on the rendered string with a "See Supplemental Page" fallback control.
4. `VictimsSection` - five rows, collapse-and-add. Row A writes to the form. Rows B through E
   write to the remark composer per spec defect 3.1, with an inline note explaining why the
   printed rows stay blank.
5. `RemarksSection` - the structured composer plus free text, assembling a read-only printed
   value, same pattern as the 10922 documents-viewed line.

Standing rule, learned twice on 10922: any field written from outside a `DynamicForm` must be
REMOVED from that form's sections. RHF seeds defaults at mount and clobbers external writes on
its next debounced sync. On this form that covers the unit search, the Booker engine, the
punishment builder, and the remark composer.

Gate - Stephen drives four scenarios end to end: a clean acceptance with one offense, a refusal
to sign, a vessel-exception case, and a multi-victim case with a combination punishment that
overflows item 6.

Risk - medium-high. Five custom components, and the punishment builder has no precedent in the
repo. The offense combobox over 167 grouped entries is the second-largest unknown.

---

## Phase 4 - validators

`src/lib/navmc10132-validators.ts`, exporting `runNavmc10132Validators(data): ValidationIssue[]`,
folded into `runLetterValidators` so `getExportBlockers` gates automatically. Same wiring as
10922, including the type-only back-import that avoids the module cycle.

Sixteen blockers, V-01 through V-16, and sixteen warnings, W-01 through W-16, enumerated in
spec section 6. Notable ones that only work because of earlier phases:

- V-13 reproduces the form's own item-6 script: punishment requires at least one `Guilty`
  finding unless item 6 begins with `none`.
- V-15 depends on Phase 2's renderer producing a measurable string.
- V-16 depends on Phase 1's structured punishment model. It blocks an item 14 appeal decision
  that increases punishment, per MCM Part V para 1.f.(2).
- W-05 and W-06 read the ceiling and the required authority grade off the selected N code, so
  no text parser is involved. A parser survives only on the import path.

Every issue carries `citation`. Per spec 1.4, Part V citations are paraphrased with a paragraph
reference and never quoted verbatim until a Marine Corps network copy of the 2024 edition is
checked.

Gate - table-driven tests, one per blocker and per warning, in `tests/navmc10132-cases.ts` so
the same table feeds vitest in CI and the esbuild sandbox harness.

Risk - low. Pure functions over an enumerated spec section.

---

## Phase 5 - AcroForm export - COMPLETE 2026-08-24

Gate met. Evidence, in order of strength:

- `tools/aa-forms/verify_10132_app_fill.mjs` runs the app's OWN `navmc10132Values` and
  `fillAcroFormWithReport` against the real blank outside the browser, through jiti. Not a
  re-implementation. `tools/aa-forms/verify_10132_roundtrip.py` then reads the output with
  pypdf, so pdf-lib never grades its own work. VERIFY: PASS - 74 fields intact, 54 valued,
  7 signature widgets empty, `/Root/Perms` absent, `1A FINDING` holds the EXPORT value
  `Guilty` rather than the display `G`, and item 6 carries the concurrency clause.
- All 167 article `formLabel` values in `navmc10132-articles.ts` are exact members of the
  form's 168-entry `1A ARTICLE` `/Opt`. The only unmatched option is the empty string. This
  was the highest silent-loss path available and it is clean.
- Every date field, `_af_date` suffixed or not, carries `AFDate_FormatEx("yyyy-mm-dd")` in
  the blank's own scripts, and the app writes exactly that. No Acrobat-versus-preview
  display divergence.
- Live in Chrome: the preview renders the official three-page form with its own artwork,
  values painted into the widgets.

One design change from the plan below. NAVMC 10132 got NO separate branch in
`useDocumentExport.ts`. It is a plain AcroForm, so `PIPELINE_MAP.navmc10132` already returns
the official blank filled and still editable, unlike the XFA forms where the pipeline returns
a flattened redraw and the official form is fetched on a separate path. Routing it through
the standard path keeps the signature-field pass and the enclosure merge, both safe on an
AcroForm. Only the toast is new.


1. `src/lib/acroform-fill.ts` - generic, not 10132-specific.
   `fillAcroForm(baseBytes, values, opts?: { unlockReadOnly?: string[] })`.
   Loads with `ignoreEncryption: true`, dispatches on field class, selects dropdowns by EXPORT
   value only, temporarily clears the read-only flag for named fields, never touches signature
   widgets, calls `updateFieldAppearances()`, saves with `useObjectStreams: false`.
2. `src/lib/navmc10132-acroform.ts` - the 74-entry name-to-selector table. Phase 2 derivations
   run BEFORE the table is evaluated, so `2 BOOKER` and the coerced `2 DEMAND` carry computed
   values. `unlockReadOnly` is `2 BOOKER`, `23 ACCUSED FULL NAME`, `24 ACCUSED RANK/GRADE`,
   `25 ACCUSED EDIPI`.
3. `xfa-form-fill.ts` - `officialFormPath` returns the 10132 blank, and `exportOfficialForm`
   branches to the AcroForm path. The module keeps its name. Renaming it is a separate cleanup.
4. `useDocumentExport.ts` - official-form route and the export toast. The toast says two
   things and nothing else: signature widgets are left open for CAC signing, and whatever
   Probe B decided about the usage-rights signature.
5. Per D-12, either strip `/Root /Perms` on write or leave it. Decided in Phase 0.

Gate - export all four Phase 3 scenarios, open in Acrobat, confirm every value landed in the
right widget, the seven signature widgets are signable, and page 2 carries the accused
identity. Sandbox proxy: re-extract by field name and diff against expected values.

Risk - medium. Named filling does not fail by off-by-one the way the 10922 positional emitter
did, which removes the single largest failure mode of that build. The residual risk is the
read-only unlock and restore, and the export-value discipline on 33 dropdowns. Both are
covered by the Phase 0 round-trip harness.

### Phase 5b - flattened generator - CANCELLED 2026-08-24

Probe A came back positive, so decision D-2 is closed and this phase will never exist.

The pdfjs preview DOES paint generated widget appearances. Verified in Chrome against the
running app: typing into item 7 put "SUSP 30 DAYS EXTRA DUTY" onto the rendered form, and
selecting an article put its label into item 1A and the display value "G" into item 5A. The
contingency was a size-L redraw of the entire form. It is now dead work.

---

## Phase 6 - unit-diary handoff, decision D-9 - COMPLETE 2026-08-24

Built as `src/lib/navmc10132-unit-diary.ts` plus
`src/components/letter/navmc10132/UnitDiarySection.tsx`, registered last in
`Navmc10132Sections.tsx`. Verified live in Chrome and by 35 assertions in
`tools/aa-forms/tmp_check_unit_diary.mjs`, which needs promoting into `tests/` in Phase 7.

Three rulings made during the build, none of them in the plan below.

1. **Only a `Guilty` finding is reportable.** A `Not Guilty` finding produces no MCTFS
   punishment entry and a blank finding means the case is not adjudicated. Listing either
   as an article code invites a clerk to report a conviction that never happened, the worst
   outcome this phase can cause. Every non-Guilty row is routed to a visible NOT REPORTED
   section so the omission reads as deliberate. When no row is Guilty the block says there
   is no entry to make rather than emitting an empty template.
2. **Item 16 IS the unit diary entry**, per spec section on item 16: it "requires unit diary
   entries per MCTFSPRIUM and records the UD number and date". So the handoff is a round
   trip. The block goes out, the UD number comes back into `finalAdminUd`. When item 16
   already carries a number, the panel leads with a destructive-styled warning that entering
   it again creates a DUPLICATE unit diary entry. The Copy button still is not disabled, a
   clerk correcting a bad entry has a legitimate reason to copy it again.
3. **Three classes of absent data, not one.** `missing` is only for data the form COULD
   still carry, such as EDIPI. RUC has no field on `Navmc10132Data` at all and no amount of
   form-filling produces it, so it emits a fixed marker and is never `missing`. The UD number
   does not exist until after the clerk acts, same class as RUC. Appeal intent is a fourth
   case: the appeal window opens AFTER imposition, so a same-day transcription legitimately
   has no election, and it reads "not yet elected" rather than raising a false warning.

The emitter resolves the MCTFS code from `articleLabel` through `resolveArticle` on every
call. `Navmc10132Offense.mctfsCode` is a stored denormalization and is never read, because
it can go stale against the article table.

Open decision **D-13**, Stephen owns it. The copied block carries a name, an EDIPI, and NJP
detail, and it is app-generated text with no form artwork to carry a marking. The standing
rule that the app adds no CUI markings was written about the PDF, where the blank marks
itself. Nothing is stamped into the copied text today. The panel states the handling
expectation in the UI only.

Independently shippable. The form is complete and usable at the end of Phase 5.

`src/lib/navmc10132-unit-diary.ts` emits a copyable block for the IPAC: accused EDIPI, unit
RUC, NJP date, article codes with findings, punishment codes with parameters, suspension terms,
and appeal status. Reuses the `edms-handoff.ts` presentation pattern.

The app has no MCTFS connectivity and must not imply otherwise. This is a transcription aid
for a human doing unit diary entry, and the UI says so.

Gate - Stephen checks one emitted block against a real unit diary entry.

Risk - low, and fully contained.

---

## Phase 7 - tests, templates, docs, and the picker gate - COMPLETE 2026-08-24

**How the tests were actually run.** vitest cannot run on the device VM, and the reason is
not the mount. `node_modules` was installed on Windows, so `rolldown` resolves to a Windows
`.node` binding and dies on Linux with MODULE_NOT_FOUND. Any package with a native binding
fails the same way. The suite therefore ran in a Linux container against a staged copy of
the NAVMC 10132 import closure with a fresh `npm i vitest zod pdf-lib`, same `@` alias.
Baseline check first: the two pre-existing suites passed there unchanged, 99 tests, which is
what makes the harness trustworthy rather than merely green. Final state, 5 files and 217
tests passing:

| File | Tests |
|---|---|
| `navmc10132-utils.test.ts` | 92, pre-existing |
| `navmc10132-articles.test.ts` | 11, pre-existing |
| `navmc10132-validators.test.ts` | 87, new |
| `navmc10132-acroform.test.ts` | 16, new |
| `navmc10132-unit-diary.test.ts` | 16, new |

The validator suite covers all 32 labeled rules, 16 V and 16 W, each with a trips case AND a
does-not-trip case, because a rule with only a positive case proves something fires, not that
the rule is scoped correctly. It also asserts every emitted issue carries a citation, and
that the aggregate entry point is a no-op for every other document type.

The AcroForm suite asserts the blank SHA as a tripwire, that the read-only flag is RESTORED
rather than inferred, and that every choice field stores the EXPORT value and not the display
value. That last one matters: a test asserting the display value would pass while the form
was wrong.

**The plan sent the templates to a directory nothing reads.** `public/templates/navmc10132/`
was the instruction here and it was wrong. `src/hooks/useTemplates.ts` fetches exactly two
indexes, `templates/global/index.json` and `templates/unit/index.json`. Every other form in
the app, all six NAVMC 10922 templates included, lives in `public/templates/global/*.nldp`
and is registered in that index. There is no per-form directory convention. The four
templates now live in `global/` and the index went from 65 to 69 entries, additively, with
the original 65 verified byte-identical. Confirmed in the running app: the Templates dialog
shows all four under Standard Templates, and loading the combined-punishment one fills the
form and clears the export-blocked banner outright.

**Picker gate, all seven touch points.** Four are observable and were checked in the running
app rather than by reading code:

- `Sidebar.tsx` Forms accordion - the form is selectable from it.
- Templates gallery - four entries shown, one loaded end to end.
- `HeaderActions.tsx` DOCX exclusion - the Export menu offers PDF only.
- `naval-format-utils.ts` `getExportFilename` - captured live off the download anchor as
  `NAVMC 10132 - MARTINEZ LUIS A.pdf`, a real form-specific name rather than a fallback.

Three are internal predicates with no distinct user-visible surface, confirmed by line
reference with the guarding condition read in context:

- `DocumentTypeSection.tsx` line 537 card grid, line 568 settings exclusion.
- `indent-engine.ts` line 65 - in the `isCorrespondenceType` exclusion list.
- `proofread-checks.ts` line 57 `isForm`, gating the letterhead check at line 77.

Behavioral corroboration for the last two: with this document type the compliance banner
carries only NAVMC 10132 rules, where an Executive Correspondence document in the same
session raised letter-format complaints about salutation and recipient schema.

**One comment corrected in `acroform-fill.ts`.** It claimed pdf-lib refuses a direct write to
a read-only field. The AcroForm test disproved that with a probe. pdf-lib does not refuse.
The unlock exists so the SHIPPED document still reports those fields read-only, and the
comment now says so. A false rationale in a comment invites someone to delete code they
think is dead.

**Scratch files left behind, for Stephen to remove.** The mount blocks delete.

- `tools/aa-forms/tmp_check_unit_diary.mjs`
- `tools/aa-forms/tmp_check_templates.mjs`
- `public/templates/navmc10132/` - five dead files, superseded by the `global/` entries


1. `tests/navmc10132-acroform.test.ts` - map-diff guard via JSON import from `tools/`, full
   74-field named round-trip on the real blank, read-only unlock and restore, signature
   widgets untouched, export-value assertions on all 33 dropdowns, blank-SHA assertion.
2. `tests/navmc10132-utils.test.ts` - the Phase 2 tables, promoted from that phase's gate.
3. `tests/navmc10132-validators.test.ts` - the Phase 4 table.
4. `public/templates/navmc10132/` plus `index.json` - four templates matching the Phase 3
   scenarios, fictional data only, following the 10922 convention of a coherent fake identity
   and "Sample data - replace before use." No real EDIPIs, no real names, no victim data.
5. **The picker gate.** Registering in `DOCUMENT_TYPES` does NOT surface a form in the UI.
   Verify each of these in the running app, not by reading code:
   `DocumentTypeSection.tsx` card grid AND its settings-exclusion condition, `Sidebar.tsx`
   Forms accordion, `HeaderActions.tsx` DOCX menu exclusion, `indent-engine.ts`
   `isCorrespondenceType`, `proofread-checks.ts` `isForm`, `naval-format-utils.ts`
   `getExportFilename`, `templates/index.ts` placeholder. This list cost the 10922 build a
   missed gate. It is a checklist here, not a note.
6. `EXPORT_GUIDE.md` - AcroForm section, distinct from the existing XFA section.

Gate - CI green, Stephen's final Acrobat pass, and the form reachable from every picker.

---

## Sequencing and sizing

| Phase | Depends on | Size | New files | Modified files |
|---|---|---|---|---|
| 0 | - | S | 3 (blank, extractor, map) | 0 |
| 1 | 0 | M | 2 (article table, punishment table) | 3 (types, schemas, pipeline service) |
| 2 | 0, 1 | M | 1 | 0 |
| 3 | 1, 2 | L | 1 sections file with 5 components | 1-2 |
| 4 | 1, 2 | M | 1 | 1 (letter-validators) |
| 5 | 0, 1, 2 | M | 3 (generic filler, selector table, export) | 3 (xfa-form-fill, export hook, pipeline) | DONE |
| 5b | - | - | CANCELLED, D-2 closed positive | - |
| 6 | 1, 5 | S | 2 (emitter, panel) | 1 | DONE |
| 7 | all | M | 3 tests + 4 templates | 3 docs | DONE |

Phase 2 is the pivot. Phases 3, 4, and 5 all consume it and are parallelizable after it.
Phase 5b was contingent and is now cancelled. Phase 6 is optional and independently shippable.

Shortest path to a usable form: 0, 1, 2, 3, 5. Phase 4 is required before anyone trusts the
output, and Phase 7 before anyone else can reach it.

---

## Standing constraints

- File writes through Write/Edit tools only. Bash heredoc writes have NUL-corrupted mounted
  files before.
- The mount blocks delete and rename. Git writes happen on Stephen's machine.
- Full `tsc` is unrunnable on the mount. Copy `src` plus `zod` to `/tmp` and run the mount's
  `tsc.js` against the local tree with `@/*` paths. Components verify via
  `esbuild --packages=external`. CI is the authoritative typecheck.
- vitest dies on the mount. PDF probes run in the cloud container, which has Node 22, pdf-lib,
  pypdf, and poppler.
- No CUI markings added by the app. The blank's own artwork carries them.
- Signature widgets are never populated. Items 9 and 16 are CAC-signed in Acrobat.
- Every rule surfaced to the user carries its citation. MCM Part V is paraphrased with a
  paragraph reference until spec D-7 fully closes.
- The app must not print "enlisted only" anywhere. The paper form now serves officers too.

---

## Confidence

| Item | Score | Basis |
|---|---|---|
| AcroForm fill correctness | 0.94 | Executed end to end during the audit: 63 of 74 filled, appearances generated, page 1 rendered and visually verified |
| Registration wiring | 0.92 | All touch points located with line references, and the 10922 gate miss is a known-and-listed hazard rather than a surprise |
| Booker engine fidelity | 0.90 | Transcribed from decoded scripts, five branches, directly testable. Residual doubt is only whether Acrobat evaluates blur order differently than read |
| Article crosswalk | 0.88 | Computed, total in the form-to-code direction, 0 unmapped form options. Held below 0.9 because MCTFSPRIUM itself was not readable |
| Punishment renderer | 0.70 | The weakest link. Structured input must reproduce the MCO's published phrasings, and some variation may not be derivable from code plus parameters |
| Preview path | 1.00 | CLOSED. Probe A answered positive in the running app. pdfjs paints generated widget appearances, Phase 5b cancelled |
| Overall plan shape | 0.88 | The two soft items are each contained in one phase, and neither blocks the shortest path to a usable form |

Phase 2's punishment renderer at 0.70 is the item to watch. Its gate is deliberately harsh -
reproduce the MCO's own examples exactly or the model is wrong - so a failure surfaces before
Phase 3 builds a UI on top of it.

Awaiting approval to start Phase 0.
