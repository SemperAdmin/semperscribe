# Codebase Audit — Semper Scribe

**Date:** 2026-07-05 · **Mode:** 2 (Codebase Audit) per `docs/engineering/prompt-library.md` · **Context:** `docs/engineering/project-context.md`

Method: four independent read-only review passes (architecture + trace, duplication/coupling, hidden state/performance, maintainability), each citing file and line evidence. Architecture was reverse-engineered from the code as written, not from the README. No code was changed in this audit; output is this report only.

**Headline finding shaping the decision:** the app eagerly ships ~5 MB of parsed JS data (a 3.85 MB base64 DoD seal plus ~1.1 MB of reference tables) and both export engines in the first-load bundle, while a fully orphaned duplicate component tree (`/components`, `/hooks`) and two parallel ~2.3k-line document renderers (PDF and DOCX) form the main structural risk. All are fixable in low-risk increments — the refactoring sequence is in §5.

---

## 1. Architecture (reverse-engineered)

Next.js 16 static-export SPA (`output: 'export'` in production), React 18, one client route doing all the work. No backend; persistence is `localStorage` plus lz-string-compressed share links. **VERIFIED** (next.config.ts; src/app/page.tsx:1).

| Module group | Responsibility as coded | Tier |
|---|---|---|
| `src/app/page.tsx` (797 lines) | God-controller: holds nearly all document state in `useState`, orchestrates preview, export, share, signature, persistence (page.tsx:40–797) | VERIFIED |
| `src/lib/schemas.ts` (2,447 lines) | `DOCUMENT_TYPES` registry + Zod schemas; `features` flags drive both which form sections render and which export pipeline runs | VERIFIED |
| `src/components/document/DocumentLayout.tsx` | Form router — picks section components from `features` flags (DocumentLayout.tsx:68, 108–109) | VERIFIED |
| `src/components/letter/*`, `src/components/ui/DynamicForm.tsx` | Form sections: hand-written sections call `setFormData` directly; `DynamicForm` is a schema-driven engine (react-hook-form + zodResolver) | VERIFIED |
| `src/components/pdf/NavalLetterPDF.tsx` (2,242 lines) | The actual PDF document: `@react-pdf/renderer` React tree = layout + pagination | VERIFIED |
| `src/lib/pdf-generator.ts` (182 lines) | Thin wrapper: font registration + `pdf(<NavalLetterPDF/>).toBlob()` (pdf-generator.ts:29–51) | VERIFIED |
| `src/lib/docx-generator.ts` (2,420 lines) | Independent DOCX rendering engine (`docx` lib) | VERIFIED |
| `src/services/export`, `src/services/pdf`, `src/services/docx` | Pipeline dispatch: `pdfPipelineService.generatePdfForDocType` routes `features.pdfPipeline` → generator (pdfPipelineService.ts:101–119); I-Type has its own path | VERIFIED |
| `src/services/import` | Word/PDF import: mammoth / pdfjs-dist text extraction → doc-type detection → `ImportPayload` | VERIFIED |
| `src/hooks` | State slices extracted from page.tsx (`useParagraphs`, `useImportExport`, `useUserProfile`, …) — but state still lifts back into page.tsx via setters | VERIFIED |
| `src/store` (zustand) | Peripheral only: `iTypeStore` is a one-way mirror page.tsx writes into for the I-Type preview (page.tsx:257–261); `formStore` has no consumer in page.tsx — likely dead or `dynamic-forms/`-only | VERIFIED / INFERRED |
| `src/lib` data modules | Embedded reference data: `military-dictionary.ts` (8,234 lines), `military-wordset.ts` (5,306), `units.ts` (3,701), `ssic.ts` (2,716) | VERIFIED |
| Root `/components`, `/hooks` | Orphaned duplicate trees — see finding D-1 | VERIFIED |

Persistence keys (all VERIFIED by grep): `navalLetters` (drafts, capped at 10 — storage-utils.ts:33–43), `semperscribe-user-profile` (useUserProfile.ts:64–89), `hasSeenDisclaimer` (DisclaimerModal.tsx:20–27). Share links: full state → `LZString.compressToEncodedURIComponent` → `?share=` param, 8,000-char soft cap (url-state.ts:39–105).

## 2. Traced request: type Subject → preview → PDF download

1. Keystroke in the Subject `<Input>` rendered by `DynamicForm.renderField` — DynamicForm.tsx:194. **VERIFIED**
2. react-hook-form updates (`mode:'onChange'`, zodResolver) — DynamicForm.tsx:129–133. **VERIFIED**
3. `form.watch` subscription, debounced **500 ms**, calls `onSubmit(delta)` — DynamicForm.tsx:136–157. **VERIFIED**
4. `handleDynamicFormSubmit` merges delta into `formData` — page.tsx:82–88 (wired via DocumentLayout.tsx:171). **VERIFIED**
5. `formData` change re-creates `handleUpdatePreview`, re-arming the preview effect, debounced another **1,500 ms** — page.tsx:305–311. **VERIFIED**
6. `generatePdfForDocType({formData, vias, references, …})` → `PIPELINE_MAP.standard` → `generateBasePDFBlob` — pdfPipelineService.ts:113–119. **VERIFIED**
7. `generateBasePDFBlob`: register fonts, `React.createElement(NavalLetterPDF, …)`, `pdf(doc).toBlob()` — pdf-generator.ts:38–50. **VERIFIED**
8. `applySignatureFields` stamps annotation boxes if present, else pass-through — page.tsx:268–276. **VERIFIED**
9. `URL.createObjectURL(blob)` → `setPreviewUrl` (previous URL revoked) — page.tsx:293–297. **VERIFIED**
10. `previewUrl` → `ModernAppShell` → `LivePreview` `<iframe src>` — LivePreview.tsx:84. **VERIFIED**
11. Export click → `generateDocument('pdf')`; **hard gate** `getExportBlockers(...)` blocks with `alert()` — page.tsx:496–503, letter-validators.ts. **VERIFIED**
12. SECNAV directives: blob generated first, `getPDFPageCount` (pdf-lib, dynamic import) enforces the 5-page cap; the counted blob is reused for download so gated == downloaded — page.tsx:506–532. **VERIFIED**
13. Anchor-click download with `getExportFilename` — page.tsx:542–549. **VERIFIED**
14. Persistence side path: Save → `SavedLetter` → `saveLetterToStorage` (prepend, `.slice(0,10)`, `localStorage.setItem('navalLetters', …)`) — page.tsx:391–411, storage-utils.ts:33–43; load-draft rehydrates and bumps `formKey` to remount forms — page.tsx:142–162. **VERIFIED / INFERRED** (load handler body in useImportExport.ts)

Net effect: a schema-driven field takes up to ~2 s (500 ms + 1,500 ms stacked debounces) to reach the preview, then a full PDF re-render (see P-1).

## 3. Findings

Severity scale: Critical / Major / Minor / Informational. Tiers: VERIFIED / INFERRED / ASSUMED. No Critical findings — nothing found that corrupts user data or breaks exports today.

### 3.1 Architecture decisions with long-term cost

- **A-1 · Informational · VERIFIED** — `output:'export'` static posture (next.config.ts) is by-design and matches the local-first product, but permanently forecloses API routes, Server Actions, SSR/ISR, middleware, and `next/image`. The `Promise.withResolvers` polyfill at the top of next.config.ts is a symptom of pushing all PDF work client-side under this constraint. Any future server-compute feature forces an architecture change.
- **A-2 · Minor · VERIFIED** — Dual deploy targets (ghpages vs cloudgov) branch on `DEPLOY_TARGET` with a case-sensitive hard-coded `basePath = '/semperscribe'` (next.config.ts). A case mismatch silently 404s every asset (the inline comment records this has already bitten). Two divergent production builds double the untested deploy surface; there is no automated per-target asset-URL check.
- **A-3 · Minor · VERIFIED** — Dependency posture: `pdfjs-dist@4.8.69` exact-pin is justified (matches `react-pdf@9.2.1`'s exact dependency; lockfile confirms a single copy). `mammoth@1.12.0` exact-pin has no documented rationale — add a comment or unpin deliberately. `next@16` + `react@18.3.1` is peer-valid today, but Next 16 is oriented around React 19, so staying on 18 accrues upgrade friction.

### 3.2 Duplicated logic

- **D-1 · Major · VERIFIED** — Root `/components` (35 tracked files) and `/hooks` (2 files) are **entirely orphaned duplicates** of `src/components/ui` and `src/hooks`. `tsconfig.json` maps `@/*` → `./src/*`; all 282+ `@/components` imports resolve into `src/`; zero imports reference the root trees. 31 of 32 root `components/ui/*` files are byte-identical to their src twins; `input.tsx` has already drifted — the stale-fork trap is live. `components.json` points shadcn at `src/components`, so future `npx shadcn add` deepens the split. Delete the root trees.
- **D-2 · Major · VERIFIED** — Two parallel ~2.3k-line document renderers: `src/components/pdf/NavalLetterPDF.tsx` (2,242 lines) and `src/lib/docx-generator.ts` (2,420 lines) each independently implement the naval-letter assembly rules (header blocks, date/SSIC/subject, enclosure/reference/via lists, signature blocks) — ~70–80 occurrences of the same formatting concerns in each. They do share the low-level engines (`indent-engine`, `paragraph-formatter`, `font-policy`), which contains the damage, but every layout rule change must land in two large files in lockstep. Related risk: the SECNAV 5-page cap is enforced by counting the **PDF** blob only (page.tsx:511–524); the DOCX branch (page.tsx:533–539) is never re-counted, so PDF/DOCX divergence would bypass the page-cap gate for DOCX exports.
- **D-3 · Minor · VERIFIED** — Committed manual backups: `backups/20251010_*/` (6 tracked files: 3 × `page.tsx.backup`, 3 × paragraph-formatter snapshots at 176–177 lines vs the live 395) plus `temp-paragraph-formatter.txt` (6.5 KB of real TS saved as `.txt`). Hand-rolled version control inside git; pollutes grep results and invites resurrecting stale logic.

### 3.3 Tight coupling and circular dependencies

- **C-1 · Minor · VERIFIED** — `src/app/page.tsx` (797 lines, 35 imports, 7 `useState` + 9 `useEffect` + 5 `useCallback`) is the single highest-coupling module: URL state, validation, storage, PDF+DOCX orchestration, signature ceremony, import/proofread/batch modals, and I-Type all meet here. Hooks extraction has helped (hence Minor, not Major), but state still lifts back via ~40 passed props.
- **C-2 · Minor · VERIFIED** — Source-level import cycle `paragraph-formatter.ts:3` ↔ `indent-engine.ts:30`. Currently defused because one edge is `import type` (erased at compile time), but adding any value import on that edge creates a real initialization-order hazard. Break it by extracting `ParagraphIndentSpec` / `generateCitation` into a leaf module.
- **C-3 · Informational · VERIFIED** — Two document UI components import policy internals directly from `@/lib/font-policy` (FontSelectorSection.tsx:5, HeaderSettingsSection.tsx:5). Narrow, stable leak; note only.

### 3.4 Hidden global state

- **G-1 · Minor · VERIFIED** — `page.tsx:628` calls `localStorage.removeItem('navalLetters')` with the key hard-coded inline, bypassing `storage-utils.ts` which owns that key as `STORAGE_KEY`. If the key changes, clearing silently stops working.
- **G-2 · Minor · VERIFIED** — Three localStorage namespaces managed across five files with no single storage module and no schema/version tag on any persisted blob; `useUserProfile.ts:67` spreads parsed JSON over defaults with no validation, so a shape change spreads stale fields silently.
- **G-3 · Informational · VERIFIED** — Module-scope mutable flags: `fontsRegistered` (pdf-generator.ts:14) guarding a **global** `Font.register` mutation of the `@react-pdf/renderer` registry, `_set` memo (military-wordset.ts:5300), `isConfigured` (console-utils.ts:5). Write-once and benign in the browser; process-global in tests/SSR. Exported singleton engines `relativeIndentEngine`/`fixedLadderEngine` (indent-engine.ts:238–239) are stateless today but unfrozen.
- **G-4 · Informational · VERIFIED** — Negative result: zustand stores mutate only through defined actions; no out-of-action mutation found. The I-Type sync effect re-runs `setITypeFormData` on every keystroke while in I-Type mode (page.tsx:257–261) — redundant work, not a correctness bug.

### 3.5 Performance risks

- **P-1 · Major · VERIFIED** — ~5 MB of data parsed eagerly into the first-load bundle: `dod-seal-data.ts` is **3,846,967 bytes** of base64, statically imported via pdf-seal.ts:1 / dod-seal.ts:2 → NavalLetterPDF → pdf-generator → page.tsx:12; plus `units.ts` (**690 KB**, imported at page.tsx:7), `ssic.ts` (**190 KB**, DynamicForm.tsx:23), `military-dictionary.ts` (**148 KB**, AutoSuggestInput.tsx:6), `military-wordset.ts` (**100 KB**, useSpellCheck.ts:4). None are behind `import()`. Every visitor pays ~5 MB of JS parse before touching anything.
- **P-2 · Major · VERIFIED** — Both export engines ship in the initial bundle: `@react-pdf/renderer` and `docx` are statically imported through page.tsx:12–13. By contrast the import-side heavy libs are already correctly lazy — mammoth (documentTextExtractor.ts:44), pdfjs-dist (:121), react-pdf via `next/dynamic` ssr:false, pdf-lib via dynamic `import()`. Converting the two export entry points to dynamic import removes the largest remaining code chunks from first load.
- **P-3 · Major · VERIFIED** — Preview path rebuilds the entire PDF from scratch on every debounced change: new `NavalLetterPDF` element + full `pdf(doc).toBlob()` layout + serialization per regeneration (page.tsx:279–311; pdf-generator.ts:29–51). The 1,500 ms debounce keeps this off the per-keystroke path, but any state churn that recreates `handleUpdatePreview` (keyed on seven state objects, page.tsx:303) retriggers a full regeneration. Dominant cost of the typing experience on multi-page letters.
- **P-4 · Minor · VERIFIED** — O(n²) citation work, duplicated: `computeSpecs` calls `generateCitation` per paragraph (indent-engine.ts:122–147; paragraph-formatter.ts:80–132), and NavalLetterPDF.tsx:461,1519 recomputes `generateCitation` per paragraph again instead of reading the `citation` already present in the computed specs (indent-engine.ts:138). Paragraph counts are small, so this is a smell, not a hot spot.
- **P-5 · Minor · VERIFIED** — Every DOCX export re-decodes the ~3.85 MB seal via `fetch(dataUrl).arrayBuffer()` with no cached buffer (dod-seal.ts:4–22).

### 3.6 Maintainability debt

- **T-1 · Major · VERIFIED** — Test coverage is narrow: 33 test files / 5,152 lines, all under `tests/`, versus 226 src files / 61,085 lines. Coverage concentrates (well) on format correctness — golden PDF/DOCX diffs, indent/spacing/keep rules, import parsing — but only **2** component tests exist for 115 `src/components` files, and page.tsx, all hooks, and both zustand stores are untested. Additionally `tsconfig.json` excludes `tests/**/*`, so tests aren't type-checked by the main `tsc` pass.
- **T-2 · Minor · VERIFIED** — `strict: true` but no `noUncheckedIndexedAccess`/`noUnusedLocals`/etc.; `: any` × 84 and `as any` × 16, concentrated in the untested NLDP/I-Type boundary (useNLDP.ts × 8, console-utils.ts × 6, iTypeStore.ts × 5, ITypePreview.tsx × 5) and export seams (i-type-export.ts × 3).
- **T-3 · Minor · VERIFIED** — Repo hygiene: ~9 ephemeral planning/summary `.md` files in the root (PLAN.md, SEAL_*_SUMMARY.md, POLICY_COMPLIANCE_AUDIT.md at 34.7 KB, …); `GITHUB_PAGES_DEPLOYMENT.md` exists byte-identical in both root and `docs/` (divergence trap); `Updates.txt` (a one-line personal note); `src/app/favicon1.ico` (inert duplicate favicon).
- **T-4 · Informational · VERIFIED** — Genuine TODO debt is tiny (2 markers), but one is functional: `i-type-seal.ts:2` — the USMC seal for I-Type is still a placeholder.
- **T-5 · Major · VERIFIED** — Oversized hand-maintained logic files: `schemas.ts` 2,447, `docx-generator.ts` 2,420, `NavalLetterPDF.tsx` 2,242 lines (the four larger files are generated data tables — acceptable as data, though `military-dictionary.ts` alone is 13% of src line count).

## 4. What is healthy

Worth stating so the refactor doesn't fix what isn't broken: the pipeline dispatch layer (`features.pdfPipeline` → `PIPELINE_MAP`) is a clean seam; export gating reuses the counted blob so what's validated is what downloads; import-side heavy libraries are already lazy-loaded; the golden-diff test suite is exactly the right kind of test for a formatting product; zustand usage is disciplined; real TODO debt is near zero; no runtime circular dependencies.

## 5. Refactoring sequence (risk-adjusted value: highest impact, lowest breakage first)

1. **Delete dead weight** — root `/components` + `/hooks` trees, `backups/`, `temp-paragraph-formatter.txt`, `Updates.txt`, `favicon1.ico`, root duplicate `GITHUB_PAGES_DEPLOYMENT.md`; move surviving planning docs into `docs/`. Zero runtime risk (nothing imports them — D-1, D-3, T-3); removes the drifted-fork trap. Verify with a production build.
2. **Lazy-load the seal and export engines** — put `dod-seal-data.ts` behind `import()` in pdf-seal.ts/dod-seal.ts, and make the export/preview entry points (`pdf-generator`, `docx-generator`) dynamic (P-1, P-2). Also cache the decoded seal `ArrayBuffer` (P-5). Big first-load win; the golden tests prove output parity per Global Rule 5.
3. **Code-split the reference tables** — dynamic-import `units.ts`, `ssic.ts`, `military-dictionary.ts`, `military-wordset.ts` at their consumers (autosuggest, spellcheck, settings) (P-1). Moderate win, low risk; needs loading states in three components.
4. **Centralize storage** — one storage module owning all three localStorage keys with a version tag and zod-validated parse; fix the hard-coded key at page.tsx:628 (G-1, G-2). Small, prevents a future silent-corruption bug class.
5. **Break the type-only cycle** — extract `ParagraphIndentSpec`/`generateCitation` into a leaf module; have NavalLetterPDF read `citation` from computed specs instead of recomputing (C-2, P-4). Mechanical, test-covered by the format suite.
6. **Add characterization tests before touching page.tsx** — per Mode 5 preconditions: component tests for the preview-debounce effect, export gating, and draft save/load, since page.tsx is untested (T-1) and is the target of step 7.
7. **Decompose page.tsx** — move preview generation, export orchestration, and share/URL state into dedicated hooks/services so page.tsx becomes wiring (C-1). Do this only after step 6's tests exist.
8. **Converge the renderers incrementally** — don't attempt a shared AST renderer in one move; instead extract the duplicated document-assembly decisions (header block ordering, list assembly, signature block rules) from NavalLetterPDF.tsx and docx-generator.ts into shared pure functions that both consume, one block at a time, golden tests green after each (D-2, T-5). Also add a DOCX-side page-cap check or an explicit waiver comment (D-2 rider).
9. **Housekeeping tier** — include `tests/` in a typecheck pass (separate tsconfig project), document or drop the mammoth pin, add `noUncheckedIndexedAccess` and burn down the 84 `: any` starting at the I-Type/NLDP boundary (T-1, T-2, A-3).

Deferred, with reason: React 19 / Next-16-native migration (A-3) — real but blocked behind renderer-library peer support and worth its own Mode 7 decision; single-deploy-target consolidation (A-2) — a product decision, not an engineering one; replacing the I-Type placeholder seal (T-4) — needs an authoritative asset, not code.
