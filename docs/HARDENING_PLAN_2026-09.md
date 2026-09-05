# Hardening Plan: lint debt and bundle weight, without breaking functionality

Date: 2026-09-05. Baseline commit: 8c1f6fc (v0.2.0).
Scope: the two items the DonDocs comparison left open, plus the safety net both need. Feature work is out of scope.

## Ground rules

1. Safety net before refactor. No warning is fixed and no chunk is split until Phase 0 lands and is green on CI.
2. One category per pull request. Each PR is revertable on its own. No PR mixes a lint category with a bundle change.
3. Every PR runs the same gate locally before push: `npm run typecheck && npm run typecheck:tests && npm run lint && npm test && npm run build`, then the smoke test against `out/`.
4. Behaviour parity is the acceptance test, not the warning count. A fix which changes what the user sees is a bug, even if lint goes green.
5. Ratchets, not cliffs. CI fails when a number gets worse, never because it is not yet zero.

## Baseline, measured 2026-09-05

| Measure | Value |
|---|---|
| Lint warnings | 52. By rule: set-state-in-effect 33, exhaustive-deps 10, preserve-manual-memoization 5, no-img-element 2, jsx-a11y/alt-text 2 |
| Files carrying warnings | 35 |
| Total JS under out/_next/static | 10,654,516 bytes |
| Initial-load JS referenced by out/index.html | 3,138,673 bytes across 40 chunks |
| Largest chunk | 3,846,972 bytes, lazy. It is src/lib/dod-seal-data.ts: two 3600x3600 PNG seals as base64 (1.36 MB and 1.53 MB decoded), loaded on first seal render |
| Second largest chunk | 1,396,526 bytes, lazy. @react-pdf/renderer and fontkit |
| Largest initial chunk | 709,475 bytes. Mixed app code: docx, mammoth, pdfjs, lz-string, SSIC table |
| Component tests | 7 files |
| Coverage tooling | none installed |
| Browser end-to-end test | none |
| Unused production dependencies | recharts, file-saver. autoprefixer, postcss, tailwindcss, tailwindcss-animate are build-time only and belong in devDependencies |

Correction to the comparison audit: the "2.9x DonDocs" figure compared SemperScribe's total chunk bytes with DonDocs's total. On initial load SemperScribe ships 3.14 MB against DonDocs's 3.73 MB. The remaining 7.5 MB is lazy, and 3.85 MB of it is the seal module.

## Phase 0 status, 2026-09-05: landed on the PR branch (v0.3.0)

| Item | State | Evidence |
|---|---|---|
| 0.1 smoke test | done, 3 paths green locally | `tests/e2e/smoke.spec.ts`, `playwright.config.ts`, `scripts/serve-out.mjs`, `e2e` job in test.yml |
| 0.2 lint ratchet | done, baseline 51 | `scripts/lint-ratchet.mjs`, `.lint-baseline.json`, step in test.yml |
| 0.3 coverage floor | done | statements 45.48, branches 41.49, functions 36.04, lines 46.42 measured; thresholds one point under in `vitest.config.ts`; `coverage` job in test.yml |
| 0.4 component tests | done, 40 tests in 5 files | `tests/components/list-sections.test.tsx`, `references-enclosures-sections.test.tsx`, `closing-block-section.test.tsx`, `navmc10132-rows.test.tsx`, `navmc10922-rows.test.tsx` |
| 0.5 bundle report and budgets | done | `scripts/bundle-report.mjs`; deploy.yml enforces initial 3,460,000 B and total 11,720,000 B |

First catch by the smoke test: the header seal requested `/logo.png` at the origin root on first paint, a live 404 on GitHub Pages, because the base path was applied in an effect after render. Fixed by inlining the base path at build time (`NEXT_PUBLIC_BASE_PATH` from next.config.ts). That also removed one set-state-in-effect warning, so the ratchet baseline is 51.

Two things the local run cannot show. The `e2e` job has not yet run on GitHub's runner, and the coverage figure will read slightly higher there because the LibreOffice half of the parity test runs. Exit criterion "three consecutive green e2e runs on CI" is open until the PR's CI history shows it.

## Phase A.1 status, 2026-09-05: landed (v0.3.1)

Ten set-state-in-effect warnings removed, baseline 51 to 41. Every site turned out to be user-overridable (the radio handlers set the flag and mutate the list in the same click), so none was a pure mirror and all ten took the previous-value pattern, packaged as `src/hooks/useSyncedState.ts`. The hook puts the source first in its reconcile callback because TypeScript infers the state type from the callback's return only in that order; with `prev` first every boolean site inferred `unknown`.

Two behaviours differ from the effect version, both improvements with no visible change: the derived value is present on the first render instead of one commit later, and a source change re-derives in the same render. Stateful tests added in `tests/components/list-sections-stateful.test.tsx` pin the interplay the static tests could not: Yes on the page default opens one empty input, clearing the only typed entry collapses, a template load opens, a form clear closes even after a manual Yes.

## Phase A.2 status, 2026-09-05: landed (v0.3.2)

Six set-state-in-effect warnings removed, baseline 41 to 35. ModernAppShell's site had already gone in Phase 0 with the logo fix, so A.2 had six sites, not seven. `useHydrated` (`useSyncExternalStore` with a false server snapshot) replaced the mounted flag in ThemeToggle and gated the browser-only reads in DisclaimerModal and PlatformSettings, which then derive through `useSyncedState`. `useIsMobile` moved onto `useSyncExternalStore`. GuidanceDialog's open-time preselection turned out to be a reset-on-input case and took `useSyncedState` keyed on open state and document type. `carousel.tsx` was unused by anything in `src/` and was deleted rather than patched; `embla-carousel-react` becomes a B.3 removal.

Sixteen tests added across six files: hook semantics for `useHydrated` and `useIsMobile` (with a matchMedia stub, since jsdom has none), and component behaviour for DisclaimerModal, GuidanceDialog, ThemeToggle, and PlatformSettings. The smoke test's zero-console-error assertion on the built export is the hydration-mismatch guard for this phase.

## Phase A.7 status, 2026-09-05: landed (v0.3.3)

Four image warnings removed, baseline 35 to 31. Two documented per-line disables for `<img>` under `images.unoptimized`, and a scoped `jsx-a11y/alt-text` override for `src/components/pdf/**` where the rule matched @react-pdf's `Image` by name. Comments and config only; no runtime change.

## Phase 0: safety net (one PR, blocks everything after it)

### 0.1 Browser smoke test on the built export

Chromium and Playwright are already provisioned in the remote environment. Add `tests/e2e/smoke.spec.ts` and a `test:e2e` script which serves `out/` and drives one full path: load the app, accept the disclaimer, choose Basic Letter, fill From, To, Subj, one paragraph, export PDF, assert the download is a PDF with one page and the subject text in its text layer, then export DOCX and assert the file opens with mammoth and contains the subject. Add a second path for the official NAVMC 10274 export, since the XFA branch is the one most likely to break under a chunk split.

Why first: unit tests import modules directly and never exercise dynamic `import()` boundaries, chunk loading, or the service worker. Every bundle change in Phase B can pass the unit suite and still fail in the browser. This test is the only guard for that class of break.

CI: a new `e2e` job in test.yml on `ubuntu-latest`, `npm run build` then `npm run test:e2e`. Budget 10 minutes.

### 0.2 Lint ratchet

Add `scripts/lint-ratchet.mjs`: runs eslint in JSON mode, counts warnings per rule, compares to `.lint-baseline.json` (committed, starts at the table above). Fails when any rule's count rises. Prints the per-rule delta. Wire into test.yml after the lint step. When a PR lowers a count, it updates the baseline in the same PR.

Why: the 52 warnings stayed at 52 because nothing stopped 55. This makes the number move only one way.

### 0.3 Coverage floor

Install `@vitest/coverage-v8`. Add `test:coverage` with thresholds set 0.5 points below the measured baseline for statements, branches, functions, lines, over `src/**`. Wire into test.yml. Bump thresholds upward in any PR which raises them.

### 0.4 Component tests for the sections Phase A will touch

Before any refactor, add render tests for each component in A.1 below: render with an empty list, assert the section is collapsed; render with one filled item, assert it is expanded; add and remove an item through the UI, assert the parent callback receives the new list. Nine files, one test file each under `tests/components/`. These tests pass on today's code, then must still pass after the refactor.

### 0.5 Initial-load budget

Add `scripts/bundle-report.mjs`: parses `out/index.html`, sums the referenced chunks, prints initial-load bytes and total bytes and the ten largest chunks with a lazy or initial flag. Add a second budget to deploy.yml: initial-load 3.5 MiB alongside the existing 11.7 MiB total. Lower both budgets in the PR which achieves each reduction.

Exit criteria for Phase 0: all five land on main, CI green, the e2e job has passed on three consecutive runs.

## Phase A: lint debt, by category

Each sub-phase is one PR. Order is by risk, lowest first. The ratchet baseline drops with each.

### A.1 Derived state mirrored from props (about 10 warnings, lowest risk)

Pattern found in ReferencesSection, ViaSection, CopyToSection, EnclosuresSection, ManualDistributionSection, ClosingBlockSection, Navmc10922Sections (two sites), OffensesSection, VictimsSection:

```ts
useEffect(() => { setShowRef(references.some(r => r.trim() !== '')); }, [references]);
```

Fix per site, chosen by reading whether the user is allowed to override the flag.

- If the flag is only ever a mirror of the list: delete the state, compute `const showRef = references.some(...)` during render.
- If the user toggles it and the list re-syncs it: keep the state, replace the effect with the React "storing information from previous renders" pattern (compare the previous list in render, set state during render). Same observable behaviour, no post-render cascade.

Verification: the 0.4 component tests, unchanged, pass.

### A.2 Mount and media flags (about 7 warnings, low risk)

ThemeToggle, PlatformSettings, DisclaimerModal, GuidanceDialog, ModernAppShell, use-mobile, ui/carousel. These set a `mounted` flag or read `matchMedia` after mount to avoid a hydration mismatch.

- Add `src/hooks/useHydrated.ts` built on `useSyncExternalStore` with a server snapshot of `false` and a client snapshot of `true`. Replace every `useEffect(() => setMounted(true), [])` with it.
- Rewrite `useIsMobile` on `useSyncExternalStore` subscribing to the media query. Same return values.
- carousel.tsx is shadcn-generated. Replace the effect with the upstream shadcn version which already avoids the warning, or accept one documented disable on that file.

Verification: the export is static, so hydration mismatches surface as console errors on load. The e2e smoke test asserts zero console errors during the load step. Add that assertion in this PR.

### A.3 Reset-on-input-change (about 7 warnings, medium risk)

PageCountIndicator (reset page count when the URL changes), SignaturePlacementModal (two sites), RevisionCompareDialog, ShareLinkDialog, GunnyBotSettings, DocumentImportModal. Each resets local state when a prop changes.

Fix: where the component is a dialog, pass a `key` from the parent which changes with the input, so React remounts it with fresh state and the effect disappears. Where a remount is too costly (PageCountIndicator holds a pdf.js Document), use the previous-value comparison in render.

Verification: dialog open, edit, close, reopen with a different document, assert the fields show the new document. One component test per dialog, added in this PR.

### A.4 Async loads and one-time initialisation (about 9 warnings, medium risk)

Page11RemarksSection (fetch template index), useSpellCheck, useShareLinkLoader, useVoiceInput, useParagraphs line 40, page.tsx lines 358, 398, 443, 811.

The rule flags a synchronous setState before or beside an async load. Fixes.

- Synchronous initial values move into the `useState` initializer.
- Values derived from another state move to render-time derivation or `useMemo`.
- Genuine one-time side effects (EDMS context read, voice recogniser construction) stay in the effect but the setState moves into the async continuation or into the initializer when the value is available synchronously.
- page.tsx sites need reading one at a time. They are the autofill-from-profile and directive-paragraph-seeding paths. Each gets a unit test on the pure part (the seeding function) before the effect is touched.

Verification: e2e path extended to open a share link and to load a Page 11 template.

### A.5 exhaustive-deps (10 warnings, highest risk per warning)

Each of the ten is a deliberate omission or a bug. Decide per site by reading the effect.

- Omitted callback props (AMHSEditor onUpdate, DistributionSection onUpdateDistribution, page.tsx setParagraphs): store the latest callback in a ref updated during render, call the ref inside the effect. Behaviour unchanged, warning gone. React 18.3 has no stable `useEffectEvent`, so the ref is the supported pattern.
- Omitted values which should re-run the effect (page.tsx profile.manualUnitName, adminSubsections reportsRequired content): add the dependency and write a test proving the effect re-runs when the value changes and stays idle when it does not.
- useTemplates matchesQuery: wrap in `useCallback` or move it outside the hook, then add it to the deps.
- ITypePreview logical expression: hoist `componentsAffected` into a `useMemo` above the two dependents.

### A.6 useParagraphs memoization (5 warnings)

The five preserve-manual-memoization warnings cascade from the exhaustive-deps warning on line 90. Fix that dependency first (A.5), re-lint, then address any survivor by removing the manual `useCallback` the compiler cannot preserve. Paragraph numbering has a full unit suite (`tests/paragraph-formatter.test.ts`, `tests/indent-engine.test.ts`) which stays the oracle.

### A.7 Images (4 warnings, trivial)

- `@next/next/no-img-element` in ModernAppShell and ITypeSealSection: `images.unoptimized` is already set, so `next/image` gives nothing. Add a file-level disable with the reason.
- `jsx-a11y/alt-text` in NavalLetterPDF and ITypePDF: the flagged element is @react-pdf's `Image`, which has no alt attribute. Scope the rule off for `src/components/pdf/**` in eslint.config.mjs with a comment.

Exit criteria for Phase A: zero warnings, ratchet baseline at zero, `--max-warnings 0` added to the lint script so the ratchet script can be deleted.

## Phase B: bundle weight

Each step measures with `scripts/bundle-report.mjs` before and after and records both numbers in the PR body. Each step runs the e2e smoke test on the built export.

### B.1 Seals out of JavaScript (largest win, low risk)

Move the two PNGs from `src/lib/dod-seal-data.ts` to `public/seals/dod-seal.png` and `public/seals/navy-seal.png`, byte-identical. Replace `pdf-seal.ts` and `dod-seal.ts` loaders with a `fetch(basePath + '/seals/...')` returning an ArrayBuffer, cached per seal. For @react-pdf, pass the same-origin URL as the `Image` source. For docx, the ArrayBuffer already fits `ImageRun`. In the vitest environment there is no server, so the loader reads from `public/` with `fs` when `window` is undefined, which is what the golden PDF test needs.

Add `/seals/` to the service worker's stable-asset list so offline export keeps working. Delete `dod-seal-data.ts`.

Expected: total JS drops by about 3.85 MB. Seal transfer drops from 3.85 MB of base64 text to 2.9 MB of binary, decoded once by the browser instead of twice.

Verification: golden tests pass unchanged (the PDF layout snapshot is text only and the DOCX snapshot excludes image bytes, so byte-identical PNGs cannot change either). The e2e PDF export is checked for the seal by asserting the page has an image XObject.

### B.2 Seal resolution (optional, needs a human eye)

The seals render at about one inch. 3600 px at one inch is 3600 dpi. A 1200 px seal is 1200 dpi at print size and about 15 percent of the bytes. Downscale with a lossless resampler, render one PDF and one DOCX side by side with the original at 400 percent zoom, and let the maintainer accept or reject. Not automated on purpose.

### B.3 Dependency hygiene (trivial)

Remove recharts and file-saver. Move autoprefixer, postcss, tailwindcss, tailwindcss-animate to devDependencies. Regenerate the SBOM and confirm the component count falls. No bundle change expected, since the bundler already tree-shakes unused packages, but the audit surface and the SBOM shrink.

### B.4 pdf-lib out of the initial load (medium)

`src/lib/enclosure-attachments.ts` imports pdf-lib and is imported statically by page.tsx, useLivePreview, useDocumentExport, useSignatureWorkflow, and EnclosuresSection. Only the merge function needs pdf-lib. Split the pure row helpers (`newRow`, `reconcileRows`, `computeMergeItems`, types) into `enclosure-rows.ts` and leave the merge in `enclosure-attachments.ts`, imported dynamically at the two call sites which already `await import()` other modules.

Measure: initial-load bytes before and after. Expected: a few hundred KB.

### B.5 Spell-check dictionary on demand (medium)

`military-dictionary.ts` (148 KB source) is imported statically by useReferenceData and acronym-validators. Load it on first spell-check or first acronym validation with a dynamic import and a cached promise, matching how units are already loaded through `loadUnits`. The validators are pure and tested, so the change is in the loader only.

### B.6 Re-measure and lower budgets

After B.1 through B.5, set the total budget to measured plus 10 percent and the initial-load budget the same way. Record both in `docs/DONDOCS_COMPARISON_2026-09-05.md` under a dated addendum.

## Order and sizing

| Step | PR | Risk | Rough size |
|---|---|---|---|
| 0.1 to 0.5 | 1 | low | e2e spec, three scripts, nine component tests, two CI jobs |
| A.1 | 1 | low | nine components |
| A.2 | 1 | low | one new hook, seven call sites |
| A.7 | 1 | trivial | config and two comments |
| B.3 | 1 | trivial | package.json, lockfile |
| B.1 | 1 | low | two loaders, two PNGs, service worker list |
| A.3 | 1 | medium | seven components, seven tests |
| B.4 | 1 | medium | one module split, five importers |
| A.4 | 1 | medium | four hooks, four page.tsx sites |
| A.5 and A.6 | 1 | medium | ten sites, each with a test |
| B.5 | 1 | medium | one loader |
| B.2 | 1 | needs review | two PNGs |
| B.6 | 1 | trivial | two numbers |

Thirteen PRs. Each is small enough to review in one sitting and revert with one command.

## What this plan does not do

- It does not enable the React Compiler or upgrade React to 19. That would remove the memoization warnings by another route, but it is a framework change with its own risk and belongs in its own plan.
- It does not touch the PDF or DOCX generators' output. Any diff in a golden snapshot during this plan is a defect in the PR, not a snapshot to accept.
- It does not add features. The DonDocs feature deltas (version history, headless companion, block editor) are a separate roadmap item.
