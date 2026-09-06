# SemperScribe roadmap-to-code audit, 2026-09-05

Roadmap reconciliation, 2026-09-05, against v0.4.8: every roadmap and plan document checked against the code. Findings feed docs/UX_POLICY_PLAN_2026-09.md.

Every claim below was checked against `src/`, `tests/`, and `CHANGELOG.md`, not taken from a doc's own status line.

## 1. Inventory

### USER_DRIVEN_ROADMAP.md, R1-R14

| Item | Status | Evidence | Stated value |
|---|---|---|---|
| R1 review mode | SHIPPED | `src/lib/review-comments.ts`, `src/components/review/ReviewPanel.tsx`, `ParagraphCommentButton.tsx`, wired in `src/app/page.tsx`, test `tests/review-comments.test.ts` | Closes the kickback loop inside the tool |
| R2 revision compare | SHIPPED | `src/lib/revision-diff.ts`, `src/components/RevisionCompareDialog.tsx` rendered at `src/app/page.tsx:1056`, `tests/revision-diff.test.ts` | Diff two saves, restore either |
| R3 autosave/recovery | SHIPPED | `src/lib/autosave.ts`, `src/hooks/useAutosave.ts`, `src/components/RecoveryDialog.tsx` | Survive a browser crash |
| R4 package assembly | SHIPPED | `src/lib/package-assembly.ts`, `src/hooks/usePackageAssembly.ts`, `src/components/PackageDialog.tsx` at `src/app/page.tsx:1062`, `tests/package-assembly.test.ts` | Automates endorsement-chain arithmetic |
| R5 autofix engine | SHIPPED | `src/lib/autofix.ts` (5 fixers), `tests/autofix.test.ts` | Validators correct, not just flag |
| R6 acronym checker | SHIPPED | `src/lib/acronym-validators.ts`, `tests/acronym-validators.test.ts` | First-use spellout compliance |
| R7 signature validator | SHIPPED | `src/lib/signature-validators.ts`, `tests/signature-validators.test.ts` | Catches initials/delegation errors |
| R8 command palette | SHIPPED | `src/components/CommandPalette.tsx` (Ctrl/Cmd+K, uses installed `cmdk`) | Keyboard-first navigation |
| R9 address book | NOT STARTED | No file/hook/storage key, grep for `addressBook`, `savedRecipient`, `routingBook` in `src/` is empty | Saved From/To/Via/Copy-to combos |
| R10 save-as-my-template | NOT STARTED | No `isTemplate` field in `src/lib/document-library.ts` or `src/types/index.ts`. The only "Templates" UI (`src/hooks/useTemplates.ts`, `public/templates/*/index.json`) is the pre-existing global/unit system, a different, already-DONE feature per `docs/ROADMAP.md` | Personal blanks-filled draft slot |
| R11 paste-to-import | NOT STARTED | `src/components/import/DocumentImportModal.tsx` Textareas only edit already-extracted fields, no path feeds raw pasted text into `correspondenceParser.ts` | Paste letter text from email |
| R12 dead preview buttons | SHIPPED | Print/Download wired per `docs/USER_DRIVEN_ROADMAP.md` Wave 1 record, confirmed in the live-preview/`ModernAppShell` path | Fixed a defect |
| R13 forms expansion pack | NOT STARTED (demand-gated by design) | No 1650/pros-cons/TAD/light-duty literal in `src/lib/schemas.ts` | New forms on 3-user-ask threshold |
| R14 AMHS depth | NOT STARTED (demand-gated by design) | No `OPREP`/`CASREP`/69-char audit in `src/services/amhs/` | MARADMIN depth |

### Deferred carry-overs

| Item | Status | Evidence |
|---|---|---|
| Attachment persistence + in-PDF hyperlinks | PARTIAL | Library persistence for enclosure files SHIPPED (`src/lib/document-library.ts` `enclosureFiles` store, `src/lib/enclosure-attachments.ts`). `.nldp` embedding and in-PDF link annotations NOT STARTED - no `GoTo`/link-annotation code in `src/lib/enclosure-attachments.ts` |
| Marking-aware import (P4.6) | NOT STARTED | No portion/banner detection in `src/services/import/` |
| Interactive walkthroughs | NOT STARTED | No `driver.js` in `package.json`, no spotlight component in `src/` |
| DOCX enclosure merge note | SHIPPED (as a documented boundary) | Panel copy in `src/components/letter/EnclosuresSection.tsx` states DOCX excludes merged files |
| Zustand state consolidation | NOT STARTED | `src/app/page.tsx` is 1,136 lines, still hook/useState-driven, only `src/store/formStore.ts` (NAVMC 10274-scoped), `iTypeStore.ts`, `gunnyStore.ts` exist |
| 508 AT pass (NVDA/axe) | NOT STARTED | No `axe-core` or AT script anywhere in `src/`, `tests/`, `package.json` |
| Track A (MIU/app.gov, PDF tagging, CAC-native) | Organizational (N/A) / PDF tagging MITIGATED not fixed | `@react-pdf/renderer` output still untagged, UI directs screen-reader users to DOCX per `docs/SECTION_508_FINDINGS.md` F1 |

### ROADMAP.md coverage table

All DONE rows spot-checked as real `documentType` literals in `src/lib/schemas.ts` (3,108 lines). The two TODO rows:

| Item | Status | Evidence |
|---|---|---|
| CMC Green Letter | NOT STARTED | No `green-letter` literal in `src/lib/schemas.ts` |
| CMC White Letter | NOT STARTED | No `white-letter` literal in `src/lib/schemas.ts` |

### DONDOCS_PARITY_PLAN.md phases

| Phase | Status | Evidence |
|---|---|---|
| P1.1 encrypted share links | SHIPPED | `src/lib/crypto-utils.ts`, `tests/crypto-utils.test.ts` |
| P1.2 document library | SHIPPED | `src/lib/document-library.ts`, `src/components/DocumentLibraryDialog.tsx` |
| P1.3 auto backup | SHIPPED | `src/lib/auto-backup.ts` |
| P1.4 offline PWA | SHIPPED | `public/manifest.webmanifest`, `public/sw.js` |
| P2 classification engine | SHIPPED | `src/lib/classification.ts`, `tests/classification.test.ts` |
| P3.1 find/replace | SHIPPED | `src/lib/find-replace.ts`, `src/components/FindReplaceDialog.tsx` |
| P3.2 undo/redo | SHIPPED, architecture deviation | `src/hooks/useUndoHistory.ts` is a snapshot-history hook, not the zustand+zundo store the plan specified (no `zundo` in `package.json`) - self-disclosed deviation, feature works |
| P3.3 guidance | PARTIAL | `src/lib/guidance-data.ts`, `src/components/GuidanceDialog.tsx` SHIPPED, driver.js walkthrough half NOT STARTED |
| P3.4 reference library | SHIPPED | `src/lib/reference-library.ts` |
| P3.5 clause library | SHIPPED then RULED OUT | `docs/USER_DRIVEN_ROADMAP.md` records removal 2026-07-15, confirmed gone - `src/lib/clause-library.ts`, `ClauseToolbar.tsx`, `tests/clause-library.test.ts` do not exist and no reference remains anywhere in `src/`/`tests/` |
| P3.6 enclosure attach/merge | SHIPPED, later rebuilt | `src/lib/enclosure-attachments.ts`, `src/lib/enclosure-rows.ts`, live preview now merges bound files (`src/hooks/useLivePreview.ts:69-75`) |
| P4.1 demo script | SHIPPED (doc) | `docs/DEMO_SCRIPT_MEETING_OF_THE_MINDS.md` |
| P4.2 508 audit | PARTIAL | F2-F6 fixed per `docs/SECTION_508_FINDINGS.md`, F1 mitigated not fixed, no AT/axe pass |
| P4.3 I-Type | SHIPPED | `src/lib/i-type/`, `src/lib/i-type-*.ts`, `tests/itype-cover.test.ts` |
| P4.4 import auto-detect | SHIPPED (pre-existed) | `src/services/import/docTypeDetector.ts` |
| P4.5 mobile preview | SHIPPED | Floating preview button below xl breakpoint |
| P4.6 marking-aware roundtrip | NOT STARTED | Same as carry-over above |

### DONDOCS_COMPARISON_2026-09-05-R2.md open risks

| Item | Status | Evidence |
|---|---|---|
| No container recipe / headless API | IN PROGRESS elsewhere | `companion/` exists but is empty at audit time (built by a concurrent agent, out of my scope). `CHANGELOG.md` 0.4.8 confirms only the precondition (`src/lib/assets.ts`) has landed |
| Full-resolution seal PNGs (2.8 MB) | NOT STARTED | No resize step in `next.config.ts` or `scripts/` |
| No mutation testing / no fidelity matrix at DonDocs scale | NOT STARTED, accepted | No Stryker-equivalent in `package.json` |
| No CSP | NOT STARTED, accepted | No CSP meta tag in `src/app/layout.tsx` |

### Other input docs

- `docs/SIGNATURE_COLLECTION_PLAN.md` (S1-S2f): all SHIPPED, verified - `src/lib/pdf-signature-field.ts`, `src/lib/signature-probe.ts` + test, `src/components/signature/SignatureCeremonyPanel.tsx`. No open items in the doc.
- `docs/CORE_CONCEPTS_UPDATE_PLAN.md`: unusually complete.

| Phase | Status | Evidence |
|---|---|---|
| Phase 0 parity harness | SHIPPED | `tests/golden/`, `tests/emitter-parity.test.ts`, `tests/mco-template-structure.test.ts` |
| Phase 1 (G1-G6) indent/spacing/margins/closing blocks | SHIPPED | `src/lib/indent-engine.ts` implements the described `RelativeIndentEngine`/`FixedLadderEngine` split, citing Fig 7-8 in its own header |
| Phase 2 conditional logic/validators | SHIPPED | `src/lib/letter-validators.ts`, `tests/salutation-parity.test.ts` |
| Phase 3 (G7) font policy, ladder, sig offset, ID block | SHIPPED | `src/lib/font-policy.ts` matches the archetype lock exactly, `secnav-instruction`/`secnav-notice` types at `src/lib/schemas.ts:763,784`, `tests/directive-ladder.test.ts`, `tests/directive-id-block.test.ts`, `tests/signature-offset.test.ts` |
| Phase 4 pagination/SECNAV variants | PARTIAL | `tests/structural-pages.test.ts`, `tests/reports-required.test.ts` exist, the plan's own two open rulings (notice designation-line position, MCO To-line spacing) were not re-verified against the manual here |
| Deferred (change transmittals, 200-page numbering, AMHS body renderer, Star stationery) | NOT STARTED, self-marked BLOCKED | No corresponding code, consistent with stated blockers (source material absent) |

- `docs/UI_MIGRATION_PLAN.md`: SHIPPED - `src/components/layout/ModernAppShell.tsx`, `Sidebar.tsx`, `LivePreview.tsx` all present and wired. "Move state to LetterContext" never done - superseded by `docs/PLAN.md` below.
- `docs/PLAN.md` (config-driven architecture, 7 phases):

| Phase | Status | Evidence |
|---|---|---|
| 1. DocumentFeatures | SHIPPED | `interface DocumentFeatures` at `src/lib/schemas.ts:74` |
| 2. DocumentLayout | SHIPPED | `src/components/document/DocumentLayout.tsx` plus the exact extracted sections named in the plan (`HeaderSettingsSection.tsx`, `EndorsementDetailsSection.tsx`, `SignatureFieldSection.tsx`) |
| 3. Wire hooks | SHIPPED | `src/app/page.tsx:24-60,198-284` imports/uses `useParagraphs`, `useVoiceInput`, `useImportExport`, `useDocumentExport` |
| 4. Zustand full state | NOT STARTED | `src/app/page.tsx` is 1,136 lines (target under 200), no `documentStore.ts`, `src/store/formStore.ts` still NAVMC-10274-only |
| 5. Config-driven export service | SHIPPED | `src/services/export/pdfPipelineService.ts`, `generatePdfForDocType` used across `useDocumentExport.ts`, `useBatchGenerate.ts`, `usePackageAssembly.ts`, `useSignatureWorkflow.ts` |
| 6. Data-driven sidebar | NOT STARTED | `src/components/layout/Sidebar.tsx` still has literal "Standard Letter Group"/"Memorandums Group" hardcoded blocks |
| 7. Split schemas.ts | NOT STARTED | `src/lib/schemas.ts` is 3,108 lines (grew, not split), only `src/lib/schemas/i-type-schema.ts` is separated |

- `docs/SECTION_508_FINDINGS.md`: covered above under P4.2.
- `docs/ENCLOSURE_UPLOAD_PLAN.md`: SHIPPED per its own Section 14, verified, its recorded known limits are still true - undo does not restore file bindings (`src/hooks/useUndoHistory.ts` has no row-binding history) and rotated source pages get a mis-rotated stamp (no rotation handling in `src/lib/enclosure-attachments.ts`).
- `docs/DOCUMENT_UPLOAD_PLAN.md`: all 6 build steps SHIPPED - `src/services/import/{documentTextExtractor,correspondenceParser,docTypeDetector,extractionTypes}.ts`, `src/hooks/useDocumentImport.ts`, `src/components/import/DocumentImportModal.tsx`. "Later phases" (endorsement/multi-address/directive import, OCR) NOT STARTED - `IMPORTABLE_TYPES` in `DocumentImportModal.tsx` still lists only the 5 v1 types, matching the stated scope.

## 2. Open items re-ranked, user value vs. build size

| Rank | Item | Value (persona reasoning) | Size | Premise still valid? |
|---|---|---|---|---|
| 1 | R11 paste-to-import | High for the admin corporal - pipeline already exists, only the entry point is missing | Low | Yes, confirmed reusable |
| 2 | R9 address book | High for corporal + S-1 chief | Low, mirrors the clause-library pattern | Caution: a near-identical "save my own snippet" feature (clause library) was built then ruled OUT for low real payoff. Same risk applies unless address data (structured fields) proves more durable than free-text clauses did |
| 3 | R10 save-as-my-template | Medium, weakened | Low | Weakened: P1.2's library duplicate/rename may already deliver most of the "blanks where the name goes" case - worth confirming with a user before building |
| 4 | .nldp enclosure embedding + PDF hyperlinks | Medium, SCIF/offline-handoff persona - a `.nldp`-transferred document currently loses bound files silently | Medium-high | Valid, better scoped now since the row/`fileId` binding model already exists |
| 5 | Marking-aware import (P4.6) | Medium, CUI persona | Medium | Weaker: compounds two partial features (classification is off by default, import covers only 5 types) |
| 6 | Zustand full-state consolidation | Low direct value now | High | Weakened by success: R2 and P3.2 shipped acceptable revision-compare and undo via lightweight snapshots, working around the "state sprawl blocks undo" premise that justified this rewrite |
| 7 | R13 forms expansion | Demand-gated by design | Varies | Valid, no premise change |
| 8 | R14 AMHS depth | Demand-gated by design | Medium | Valid, no premise change |
| 9 | Interactive walkthroughs | Low-medium, new-join persona | Medium | Valid, blocked on an unresolved license-policy check |
| 10 | 508 AT pass | High for the app.gov adoption gate, cheap to run | Low | Valid and underrated - directly unblocks the Track A story used to justify several SHIPPED features |
| 11 | Data-driven sidebar (PLAN.md P6) | Low, dev-experience only | Low | Valid, fold into any future doc-type PR |
| 12 | Zustand P4 + schemas.ts split (PLAN.md) | No direct user value | High | Same weakened premise as item 6 |

**Invalidated premise called out:** PLAN.md Phase 4 assumed "state sprawl blocks undo/history" and prescribed a full store rewrite. R2 (revision compare) and P3.2 (undo/redo) both shipped as standalone snapshot mechanisms reading `page.tsx` state directly, so that justification no longer holds with the urgency the plan assumed.

## 3. Cross-check

**Undocumented capabilities:** none found with zero coverage anywhere in `docs/`. Everything that looked undocumented against the seven assigned docs has its own plan file outside that set: the Node/headless asset seam (`src/lib/assets.ts`) is covered by `docs/HARDENING_PLAN_2026-09.md` Phase C.1, GunnyBot (`src/lib/gunnybot/`, `src/store/gunnyStore.ts`) by `docs/GUNNYBOT_PLAN.md`, I-Type, NJP, and NAVMC 10132/10922 by their own dedicated docs. The apparent gap is explained by the audit's input list being a subset of a 50+ file `docs/` directory, not by genuinely undocumented code.

**Stale doc claims:**

| Claim | Doc | Reality |
|---|---|---|
| P3.5 clause library "shipped" (Phase 3 body) | `docs/DONDOCS_PARITY_PLAN.md` | The same document's later section records it REMOVED (2026-07-15), code confirms removal. Self-correcting, but a reader stopping at Phase 3 is misled |
| "Headless use: None" for SemperScribe | `docs/DONDOCS_COMPARISON_2026-09-05-R2.md` line 61 | Accurate at audit time (`companion/` empty) but actively drifting stale as a concurrent build proceeds this session |

No other overstatement was found in the seven assigned docs once cross-checked, each carries its own "SHIPPED record" written against the real diff, which keeps them unusually accurate.

## 4. Recommended phases

**Phase A - Paste-to-import (R11).** Add a "Paste text" path beside the file picker, feed raw text straight into `correspondenceParser.ts`. Touch: `src/hooks/useDocumentImport.ts` (new `importFromText`), `src/components/import/DocumentImportModal.tsx`, one new test mirroring `tests/services/import/correspondenceParser.test.ts`. Size: small, 1-2 days.

**Phase B - 508 AT pass and PDF-tagging decision.** Run NVDA and axe-core against the built export (zero automated a11y test exists today), update `docs/SECTION_508_FINDINGS.md`, make the Track A tagging call explicit. Touch: add `@axe-core/playwright` to `tests/e2e/`, no app code unless findings surface. Size: small, mostly investigative, ~0.5 day.

**Phase C - Enclosure `.nldp` portability.** Extend `.nldp` export/import (`src/lib/nldp-format.ts`, `src/lib/nldp-utils.ts`) to carry enclosure file bytes alongside the existing `enclosureBindings`. Optionally add in-PDF hyperlinks from the enclosure list to each attached page in the same PR (`src/lib/enclosure-attachments.ts`, pdf-lib link annotations). Touch: `nldp-format.ts`, `document-library.ts`, `enclosure-attachments.ts`, new tests beside `tests/enclosure-attachments.test.ts`. Size: medium, 2-3 days.

**Phase D - Personal address book (R9), scoped small.** Given the clause-library lesson, ship one central "Address Book" dialog backed by the same IndexedDB pattern as `document-library.ts` - no per-section "save current" buttons. Touch: new `src/lib/address-book.ts` (mirrors `reference-library.ts`), one dialog component, wiring in `src/app/page.tsx`. Size: small, 1-2 days, treat as a validation experiment before further investment.

**Phase E - Sidebar and schema-file cleanup (PLAN.md Phases 6-7).** No user-facing change. Derive `src/components/layout/Sidebar.tsx` groups from `DocumentFeatures.category`, split `src/lib/schemas.ts` into per-type files under `src/lib/schemas/`, following the `i-type-schema.ts` precedent. Size: medium, mostly mechanical, 1-2 days, fold into whichever PR next adds a document type.

Excluded on purpose: R10 (fold into Phase D or drop, pending confirmation the library's duplicate feature already covers it), R13/R14 (correctly demand-gated), full Zustand consolidation (premise weakened, high cost, defer), CMC Green/White Letters (TODO by design, no demand signal recorded).
