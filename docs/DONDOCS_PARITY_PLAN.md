# DonDocs Parity and Surpass Plan

Date: 2026-07-15
Source: Meeting of the Minds transcript (2026-07-15) plus a code audit of this repository.
Owner: Stephen (MSgt Shorter)
Status: DRAFT - awaiting phase-by-phase approval. No implementation begins without explicit sign-off per project workflow rules.

## Rulings recorded 2026-07-15

1. Full classification marking engine approved. This reverses the prior no-CUI-markings design rule. The PoC disclaimer banner stays until an accreditation path exists (Track A).
2. Scope is parity plus surpass. Close all confirmed gaps, then extend past DonDocs.
3. Build order is trust features first.

## Verified gap summary

Confirmed gaps (DonDocs has, SemperScribe lacks):

1. Encrypted, password-protected share links
2. Document library UX (search, sort, rename, per-document delete, higher cap)
3. Auto backup to local disk
4. Installable offline app (PWA)
5. Classification marking engine (CUI block, portion markings)
6. In-app guidance (when-to-use content, interactive walkthroughs)
7. Find and replace
8. Undo / back navigation
9. Reference library

Partial gaps (verify in Phase 0): PDF enclosure attachment with merge and in-PDF links, user-saved custom clauses, mobile responsiveness.

Not gaps - already in this codebase, absent from the last demo: batch generation with CSV import and ZIP bundling (useBatchGenerate.ts, JSZip), DOCX export (useDocumentExport.ts, docx dependency), dark mode (ThemeProvider, next-themes), user profiles (useUserProfile.ts), NAVMC 10274 and 11811 templates (public/templates), Word/PDF import with reformat (documentTextExtractor.ts), military spell check (military-dictionary.ts). His batch demo failed live. Ours bundles a ZIP. Demo these next meeting.

## Phase 0 - Baseline audit (no functional changes)

- P0.1 Confirm enclosure pipeline capability: does export merge attached PDFs, and do exported PDFs carry link annotations. Inspect DocumentLayout.tsx, NavalLetterPDF.tsx, pdf-lib usage.
- P0.2 Confirm SavedLetter shape (timestamps, naming) in types and storage-utils.ts. Current cap is MAX_SAVED_LETTERS = 10 in localStorage.
- P0.3 Mobile audit: render primary flows at 390x844, record defects.
- P0.4 Record current share-link format (?share= query param, lz-string compression, no encryption) as the legacy format for backward compatibility.
- Exit criteria: gap list re-scored with 0.95+ confidence per item.

## Phase 1 - Trust core

Counters his strongest demo points. Highest value for SCIF and CUI-adjacent users.

### P1.1 Encrypted share links
- WebCrypto AES-256-GCM. Key derived from a user password via PBKDF2-SHA-256 at 600k iterations. Random salt and IV embedded in the payload.
- Password required by default. Plain link allowed only through an explicit opt-out with a warning.
- Carry the payload in the URL fragment (#) instead of the query string so it never reaches server logs. Keep decoding legacy ?share= links.
- Surpass DonDocs: optional expiry stamp inside the encrypted payload, refused on load after the date.
- Files: src/lib/url-state.ts, src/hooks/useShareLinkLoader.ts, share dialog in HeaderActions.tsx. New src/lib/crypto-utils.ts with unit-testable pure functions.

### P1.2 Document library
- Move saved documents from localStorage to IndexedDB. Remove the 10-document cap (soft warning at quota).
- Add per-document name, created and updated timestamps, document type badge.
- Library panel: search by name, sort by recent or alphabetical, rename, per-document delete, duplicate.
- Migration: read existing navalLetters key once, import, leave the key untouched for rollback.
- Files: src/lib/storage-utils.ts (new idb layer), new DocumentLibraryPanel component, wiring in page.tsx.

### P1.3 Auto backup to disk
- File System Access API: user picks a backup folder once, handle persists in IndexedDB, every save writes a timestamped file.
- Fallback for denied permission: manual export reminder toast.
- Surpass DonDocs: backup files use the existing .nldp portable format so they re-import cleanly.

### P1.4 Offline PWA
- Web manifest plus service worker precaching the static export (fonts, templates, pdf.worker.min.mjs).
- Both deploy targets need distinct scopes: /semperscribe on GitHub Pages, root on cloud.gov. Drive from DEPLOY_TARGET in next.config.ts.
- Install instructions dialog matching the DonDocs install-app flow.
- Exit criteria: full letter authored and exported with network disabled, on both targets.

## Phase 2 - Classification marking engine

- P2.1 CUI designation indicator block per DoDI 5200.48: Controlled by, CUI Category, Distribution/LDC, POC. Renders on page one of PDF and DOCX output.
- P2.2 Banner marking top and bottom of every page, driven by highest marking present.
- P2.3 Portion markings per paragraph and heading: (U), (CUI), custom levels behind a settings toggle mirroring his teach-mode gate.
- P2.4 Surpass DonDocs: marking consistency validation. Banner must equal or exceed the highest portion marking. He renders markings without validating them.
- P2.5 The PoC disclaimer banner remains. Marking output is formatting, not data handling. No storage posture changes.
- Files: new src/lib/classification.ts, ParagraphSection.tsx, NavalLetterPDF.tsx, ITypePDF.tsx, DOCX export path.
- Reference: docs/SecNav5216 material in-repo plus DoDI 5200.48 for block layout.

## Phase 3 - Workflow parity

- P3.1 Find and replace across subject, body paragraphs, references, and address fields. Scoped modal, replace-one and replace-all.
- P3.2 Undo/redo. Risk: page.tsx state sprawl. Prerequisite refactor consolidating document state into a zustand store, then history middleware (zundo). This is the largest hidden cost in the plan.
- P3.3 Guidance system: per-type when-to-use content sourced from SECNAV M-5216.5, rendered in a side panel. Interactive walkthroughs via driver.js (MIT - confirm against LICENSES.md policy before adding).
- P3.4 Reference library: curated dataset of common references wired into AutoSuggestInput on the references section.
- P3.5 User-saved custom clauses persisted through the storage-utils envelope.
- P3.6 Enclosure upgrades pending P0.1 findings: attach PDFs, merge on export via pdf-lib, auto-numbered enclosure list, cover pages, drag reorder, PDF link annotations jumping to each enclosure.

## Phase 4 - Surpass

- P4.1 Demo script: batch ZIP, DOCX export, dark mode, profiles, import-reformat. Zero code, closes four perceived gaps.
- P4.2 Section 508 accessibility audit and fixes. Required for app.gov, likely unaddressed by DonDocs, and a hard adoption gate he has not cleared.
- P4.3 I-Type publication support completion (current branch work). He covers correspondence and two forms only.
- P4.4 Import auto-detect: classify an imported Word/PDF into the right document type automatically.
- P4.5 Mobile responsive fixes from P0.3.
- P4.6 Marking-aware DOCX roundtrip: import a marked document, preserve markings.

## Track A - Accreditation (parallel, organizational, non-code)

- Contact MIU regarding hosting or co-sponsorship. Cpl Chiofalo (Marine Innovation Unit) offered open communication in the meeting.
- Evaluate marines.dev onboarding requirements and the app.gov path he referenced.
- Existing collateral: docs/RMF_READINESS.md, docs/PRIVACY_POSTURE.md, SECURITY.md, SBOM via cyclonedx. These shorten the review cycle.
- Decision point: compete, merge efforts, or co-exist with divided coverage. Feature work above proceeds regardless.

## Verification protocol (every phase)

1. Build passes (next build, both DEPLOY_TARGET values).
2. Sandbox render verification via esbuild plus soffice pipeline (vitest is unreliable in the sandbox - full test suite runs locally by Stephen).
3. Golden-diff PDF comparison against docs/PHASE1_GOLDEN_DIFFS.md conventions where output changes.
4. No functional change merges without Stephen's approval.

## Sequencing and rough effort

- Phase 0: 1 session
- Phase 1: 4-6 sessions (P1.1 and P1.2 independent, parallelizable)
- Phase 2: 3-4 sessions
- Phase 3: 5-7 sessions (P3.2 refactor dominates)
- Phase 4: 2-4 sessions plus ongoing Track A

## Phase 0 findings (completed 2026-07-15)

### P0.1 Enclosure pipeline - gap CONFIRMED (0.95)
- Enclosures are text strings only (types/index.ts line 62: enclosures: string[]). No file attachment, no PDF merge, no link annotations, no cover pages.
- pdf-lib usage today: page counting (pdf-generator.ts), signature fields (pdf-signature-field.ts), and standalone form generators (services/pdf/*). The merge capability P3.6 needs is present as a dependency, unused for enclosures.
- Custom clauses - gap CONFIRMED (0.95). ClosingBlockSection.tsx has no clause presets and no save mechanism. DonDocs ships canned clauses plus user-saved ones. P3.5 scope grows: build the preset clause set AND the save-custom mechanism.

### P0.2 SavedLetter - gap details CONFIRMED (0.95)
- Shape: FormData plus id and savedAt timestamp (types/index.ts line 57). No user-assigned name field.
- Storage: localStorage, cap 10, newest-first. At the cap the oldest letter is evicted SILENTLY (storage-utils.ts line 101, slice). Data loss without warning.
- Delete: wholesale clearSavedLetters only. No per-document delete, rename, search, or sort.
- P1.2 revised scope: add name field, per-document operations, eviction warning, IndexedDB migration as planned.

### P0.3 Mobile - static analysis only (live render pending)
- Method limit: no browser available in the sandbox. Findings come from class-level analysis, not a rendered 390x844 viewport. A live pass on a phone or DevTools remains open.
- Better than assumed: ModernAppShell has a hamburger below md, a slide-out drawer capped at 85vw, and responsive header trims. Forms are usable on mobile.
- Defect 1 (0.95, code-verified): the document preview pane is hidden below the xl breakpoint, 1280px (ModernAppShell.tsx line 230, hidden xl:flex). Phones and most tablets get NO live preview. DonDocs demoed live preview on an iPhone. This is the real mobile gap.
- Defect 2 (0.8): AMHSPreview and LivePreview carry min-w-[500px] and w-[900px]. If either becomes reachable on small screens, horizontal overflow follows.
- Dialogs (SettingsDialog, ImportModal, BatchModal) use max-w overrides on top of shadcn w-full defaults - expected to shrink correctly on mobile, unverified live.
- P4.5 revised scope: mobile preview mode (tab or toggle between form and preview), not general responsive repair.

### P0.4 Legacy share-link format - RECORDED
- Format: ?share=<payload> query parameter (url-state.ts line 89), payload is LZString.compressToEncodedURIComponent of ShareableState JSON. Optional routing field carries signature requests.
- Consumed once on mount by useShareLinkLoader, then stripped via searchParams.delete.
- Two exposure notes for P1.1: query params reach server logs and browser history, and the payload is readable by anyone with the link. P1.1 moves new links to an encrypted fragment (#) while keeping this decoder for old links.

### Re-scored gap list (post-audit)
1. Encrypted share links - 1.0
2. Document library UX - 1.0
3. Auto backup to disk - 0.95
4. Offline PWA - 0.95 (no service worker or manifest in public/)
5. Classification marking engine - 1.0
6. Guidance system - 0.9
7. Find and replace - 0.9
8. Undo - 0.9
9. Reference library - 0.85
10. Enclosure attach and merge - 0.95
11. Custom clauses - 0.95
12. Mobile preview - 0.95

Exit criterion met for all items except the live mobile render (method-limited, defect confirmed in code regardless). Phase 1 is ready for approval.

## Phase 1 record (implemented 2026-07-15, pending local verification)

### Shipped
- P1.1 Encrypted share links. New src/lib/crypto-utils.ts (AES-256-GCM, PBKDF2-SHA-256 at 600k iterations, v1 dot-payload). New #es= URL-fragment format in url-state.ts with expiry enforcement. ShareLinkDialog (password required, opt-out with warning, 1/7/30-day expiry) and UnlockShareDialog wired through page.tsx. Legacy ?share= links still decode. Unit tests in tests/crypto-utils.test.ts. Node round-trip, wrong-password, and tamper checks passed in the sandbox.
- P1.2 Document library. New src/lib/document-library.ts (IndexedDB 'semperscribe', documents + settings stores, no eviction cap, one-time legacy import with the localStorage key left for rollback). SavedLetter gains name and updatedAt. New DocumentLibraryDialog (search, recent/A-Z sort, load, rename, duplicate, per-document delete with confirm). File menu gains "Document Library...". Save now toasts, and a failed write reports instead of silently evicting.
- P1.3 Auto backup. New src/lib/auto-backup.ts (File System Access API, folder handle persisted in IndexedDB, permission re-authorization flow). Every library save mirrors a timestamped portable .nldp into the chosen folder. "Back Up All Now" in Settings, Data. Unsupported browsers get a manual-export note.
- P1.4 Offline PWA. public/manifest.webmanifest (relative URLs - both deploy targets), public/sw.js (network-first navigations with cached shell fallback, cache-first assets, scope-relative so /semperscribe and root both work), icons generated from USMC.png (192, 512, 512-maskable), ServiceWorkerRegister injects the manifest link with the runtime base path and parks the install prompt, Install App section in Settings.

### Out of scope, flagged
- Signature-request links (S2 flow) still use the legacy unencrypted format. Applying the password dialog there changes the S2 ceremony - needs its own ruling.
- src/lib/pdf-text-parser.tsx carried a latent type error (flatMap return-type union), exposed during verification by cache invalidation, unrelated to Phase 1. Fixed with a return-type annotation only - zero runtime change.

### Verification done in sandbox
- npx tsc --noEmit: clean, whole project.
- npx eslint on all 13 touched/new files: clean.
- crypto-utils: encrypt/decrypt round trip, wrong password, tampered ciphertext - all correct in Node.
- sw.js parses; manifest is valid JSON.

### Verification owed locally (Stephen)
1. npm test (vitest is unreliable in the sandbox; crypto-utils.test.ts is new).
2. npm run build for both DEPLOY_TARGET values.
3. Manual QA: create encrypted link, open in a fresh tab, wrong then right password; save several drafts, rename/duplicate/delete in the library; enable auto backup, save, confirm the .nldp lands; DevTools offline mode after one full load, reload, author and export a letter; install the app from Edge.
4. Delete src/lib/sync-probe-renamed.txt (sandbox artifact, deletion blocked from this side).

## Phase 2 record (implemented 2026-07-15, pending local verification)

### Shipped
- Engine: src/lib/classification.ts - level ladder (UNCLASSIFIED, CUI, plus CONFIDENTIAL/SECRET/TOP SECRET behind a training gate), portion prefixes, banner text, CUI designation indicator block content (DoDI 5200.48 para 3.4), and P2.4 consistency validation. Unknown custom levels rank above TOP SECRET so the banner must name them. Unit tests in tests/classification.test.ts.
- Validation wired into runLetterValidators, so marking issues surface in the live-preview banner and the export gate path like every other rule. Rules: incomplete CUI block (fail), portion exceeds banner (fail), unmarked paragraphs with portion marking on (warn), any level above CUI (warn - training output only). DonDocs renders markings without validating them; this is the surpass.
- Form UI: ClassificationSection (off by default; banner level, portion-marking and training-level toggles, CUI block fields) rendered in DocumentLayout for all letter and directive types. Per-paragraph portion dropdown in ParagraphItem, fed through useParagraphs.updateParagraphMarking. ParagraphData gains optional marking; FormData carries classification.
- PDF (NavalLetterPDF): bold centered banner top and bottom of every page including directive structural pages (Reports, Locator Sheet, Record of Changes, TOC), CUI designation block lower right of page 1 only, portion prefixes prepended to paragraph content so wrapping and indent math stay correct.
- DOCX (docx-generator): banner paragraph in first-page and default headers and in all footers (including staffing and structural roman-numeral footers), designation block in the first-page footer (right-aligned, 8pt), same portion-prefix mapping.
- Posture: PoC disclaimer banner untouched (P2.5). Training levels always emit a warning naming the tool non-authorized for classified material.

### Verified in sandbox
- npx tsc --noEmit and eslint: clean.
- End-to-end node render of a CUI letter with mixed portion markings through the REAL generators: PDF shows CUI banner top and bottom on both pages, complete designation block on page 1 only, zero body-text overlap (an overlap at bottom:40 was caught and fixed to bottom:20 inside the margin zone), portion prefixes (CUI) x4 and (U) x1 exactly as configured. DOCX XML shows the banner in both headers and both footers, the full designation block in the first-page footer, identical prefix counts.
- validateClassification flagged the two deliberately unmarked paragraphs (portion-markings-missing warn) during the harness run.

### Out of scope, flagged
- I-Type PDF (ITypePDF.tsx) carries no markings yet - deferred to avoid colliding with the itype-appendix branch work. Add when that branch lands.
- AMHS messages carry their own classification line already; untouched.
- The designation block competes for footer space with the DLA FOUO line when both are enabled - rare combination, cosmetic, revisit if a DLA CUI document becomes a real case.

### Verification owed locally (Stephen)
1. npm test (classification.test.ts is new).
2. npm run build, both DEPLOY_TARGET values.
3. Manual QA: enable markings on a basic letter, set CUI, fill the block, portion-mark a paragraph SECRET and watch the banner-exceeds fail appear; export PDF and DOCX and eyeball page 2 banners; confirm markings OFF produces byte-identical output to before (golden-diff spirit, docs/PHASE1_GOLDEN_DIFFS.md).

## Phase 3 record (implemented 2026-07-15, pending local verification)

### Shipped (P3.1 through P3.5)
- P3.2 Undo/redo: src/hooks/useUndoHistory.ts - debounced snapshots of all seven document slices, 50-entry cap, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (skipped inside text fields, where native text undo owns the keys), header toolbar buttons with enablement flags. Restores bump formKey per the import-path contract.
- P3.1 Find and replace: src/lib/find-replace.ts (pure: per-field counts, scope, case toggle, regex-escaped, replace-all returning new slices) plus FindReplaceDialog with live counts. Applied through the normal setters, so one replace equals one undo step. Menu item under the tools menu. Unit tests in tests/find-replace.test.ts.
- P3.4 Reference library: src/lib/reference-library.ts - 27 curated citations (SECNAV, MCO, DoD, statute) with prefix-first search - surfaced through ReferenceSuggestInput inside ReferencesSection. Anything not in the library types through unchanged.
- P3.5 Clause library: src/lib/clause-library.ts - five presets (POC, request for action, information only, recommend approval, directive effectiveness) plus user-saved customs through the storage-utils envelope (new customClauses key). ClauseToolbar in the Body Paragraphs header: insert as a new level-1 paragraph, save-last-paragraph-as-clause. Unit tests in tests/clause-library.test.ts.
- P3.3 Guidance: src/lib/guidance-data.ts - 14 document types with what/when/when-not/example/citation grounded in SECNAV M-5216.5, MCO 5216.20B, MCO 5215.1K - browsable in GuidanceDialog (opens preselected on the active type) from the tools menu.

### Deviations from the plan, on the record
1. P3.2 shipped as a snapshot-history hook, NOT the zustand+zundo store rewrite the plan sketched. Same user-facing feature, roughly a tenth of the diff, zero component API churn. The store rewrite remains open as a refactor if history granularity ever needs to be per-keystroke.
2. P3.6 (enclosure PDF attach/merge/links) DEFERRED to the next phase. It is a subsystem: attachment storage in IndexedDB, export pipeline changes, share-link and batch interactions. Bundling it here would have shipped six half-verified features instead of five verified ones.
3. Interactive feature walkthroughs (the driver.js half of P3.3) deferred: new dependency requires the LICENSES.md policy check before adoption. The when-to-use guide half shipped.
4. Custom clause deletion has no UI yet (deleteCustomClause exists in the lib and is tested). Save-name entry uses window.prompt, matching the existing confirm/alert precedent in useParagraphs.

### Verified in sandbox
- npx tsc --noEmit and eslint across all 16 touched/new files: clean.
- Node smoke of the pure libs: find-replace counts and replace-all correct (6/6 with metadata preserved), reference search returns SECNAV M-5216.5 / SECNAVINST 5216.7 / MCO 5216.20B for "5216", guidance registry resolves 14 types.

### Verification owed locally (Stephen)
1. npm test - find-replace.test.ts and clause-library.test.ts are new (clause tests need jsdom localStorage, standard local config).
2. npm run build, both DEPLOY_TARGET values.
3. Manual QA: type, wait a beat, Ctrl+Z and watch the form restore (including a paragraph delete); replace-all then one undo reverses it; type "5216" in a reference row and pick from the dropdown; insert a POC clause, edit it, save-last-as-clause, reload, insert the custom; open the Correspondence Guide from the tools menu on an MOA and read the entry.

### Defect fix during Stephen's QA (2026-07-15)
- Duplicate React key `13810` in the SSIC combobox. Diagnosis: the SSIC dataset intentionally carries cross-reference aliases (410 codes appear under multiple nomenclatures per SECNAV M-5210.2), so keying rows by code alone collides. Fix: row key is now code + nomenclature. Separately, the audit found 5 EXACT duplicate rows (3971, 3972, 12309, 5520, 9520) - true data defects, removed (2709 to 2704 entries). No alias rows were touched.

## Closing record - P3.6 and Phase 4 (implemented 2026-07-15, pending local verification)

### P3.6 Enclosure attachments - shipped
- src/lib/enclosure-attachments.ts: PDF magic-byte validation on attach, merge into the export in list order via pdf-lib, optional generated cover page ("Enclosure (n)" + title) per attachment, move/reorder helper. Node-verified: 8 pages with covers and 6 without on a 2-page base with 3+1-page attachments, reorder and out-of-range identity correct, corrupt attachments throw naming the file.
- AttachedEnclosures panel inside EnclosuresSection: attach (multi-file), ordered list with move/remove, size display, cover-page toggle. Attaching auto-appends the enclosure line so the letter's Encl: block lists the document; removing removes the matching line.
- Merge runs in useDocumentExport after signature fields, PDF format only.
- V1 boundaries, stated in the panel UI: attachments are SESSION-SCOPED (not in the library, .nldp, or share links) and merge into PDF only. Follow-ups recorded: library persistence, nldp embedding, in-PDF hyperlinks from the enclosure list, DOCX merge. Numbering assumes attachments occupy the trailing enclosure slots - manual line reordering after attaching desynchronizes cover numbers (documented limitation).

### Phase 4 items - status
- P4.1 Demo script: docs/DEMO_SCRIPT_MEETING_OF_THE_MINDS.md - 12-minute script closing the four false gaps, then trust features, then the five capabilities DonDocs lacks. Includes rehearsal setup and a no-dwell failure rule.
- P4.2 508 audit: docs/SECTION_508_FINDINGS.md - 7 findings. The material one: exported PDFs are untagged (F1) - a strategic app.gov exposure to raise in Track A first. F2/F3 (duplicate main landmark, no skip link) are one-hour fixes. No assistive-technology or axe pass ran - remediation phase work.
- P4.4 Import auto-detect: ALREADY EXISTS (services/import/docTypeDetector.ts, wired through useDocumentImport with a detection display in the import modal). Verified, zero work, gap closed at no cost.
- P4.5 Mobile preview: floating Preview button below the xl breakpoint opening the existing PreviewModal - phones now reach the preview in one tap instead of a buried menu item.
- P4.3 I-Type: stays with the itype-appendix branch. P4.6 marking-aware import: follow-up set.

### Debts closed
- Custom clause deletion UI (inline X in the clause menu, ClauseToolbar rebuilt on DropdownMenu).
- Pre-existing declaration-order error in page.tsx (applyProfileToForm referenced by an effect declared above it) - reordered, zero behavior change, surfaced by the React Compiler after the P3.6 hook additions.

### Verified in sandbox
- tsc --noEmit clean project-wide; eslint zero errors on all touched files (pre-existing react-compiler warnings in legacy effects left alone - their fixes change effect timing and need their own review).
- Enclosure merge proven end-to-end in node (page counts, ordering, corrupt-file rejection).

### Verification owed locally (Stephen)
1. npm test, npm run build both targets.
2. Manual: attach two PDFs, reorder, export PDF, check cover pages and page order; confirm DOCX export excludes them and the panel says so; attach a renamed .txt and watch the rejection toast; save a custom clause then delete it from the menu; open the app at phone width and tap the floating Preview button.

### Scoreboard, final
DonDocs gap list: 12 of 12 closed or consciously bounded. Enclosure hyperlinks-in-PDF is the single sub-feature of his set not replicated (recorded follow-up). SemperScribe-only capabilities: encrypted expiring share links, marking consistency validation, backup in a re-importable format, batch ZIP, import-with-detection, undo spanning replace-all, reference and clause libraries, correspondence guide. Remaining competitive work is organizational (Track A), not code.
