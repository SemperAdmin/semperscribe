# Changelog

All notable changes to Semper Scribe are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
semantic versioning. A version bump in `package.json` on `main` creates the
matching GitHub release with this file's section as the notes.

## [0.4.5] - 2026-09-05

Phases B.5 and B.6 of `docs/HARDENING_PLAN_2026-09.md`: the military
dictionary on demand, and the bundle budgets re-measured. No
user-visible change beyond timing. First-load JavaScript drops from
2,655,337 B to 2,553,227 B.

### Changed

- `validateAcronyms` takes the military dictionary as an optional
  argument instead of importing the 148 KB table. Detection is
  unchanged without it; the dictionary only adds the suggested
  expansion to each warning. `runLetterValidators` accepts it through
  a new options argument.
- The page fetches the dictionary once there is body text to scan,
  through `useMilitaryDictionary(enabled)`, and the compliance issues
  re-derive when it arrives. The proofread report and the export gate
  run without it and list the same acronyms, unsuggested.
- Deploy's initial-load budget lowered to 2,810,000 B. The total budget
  stays at 7,490,000 B against 6,887,587 B measured.
- The smoke test's first-load marker check now covers the dictionary
  alongside pdf-lib and jszip.

## [0.4.4] - 2026-09-05

Phase B.4 of `docs/HARDENING_PLAN_2026-09.md`: pdf-lib out of the
initial load. No user-visible change. First-load JavaScript drops from
3,139,817 B to 2,655,337 B.

### Changed

- The enclosure row model, the file reader and the merge schedule live
  in `src/lib/enclosure-rows.ts`, which has no pdf-lib dependency. The
  page and the Enclosures section import that module; the pdf-lib merge
  in `enclosure-attachments.ts` is loaded on demand at export time, as
  it already was at its three call sites.
- jszip loads with the first batch run instead of with the page.
- Deploy's initial-load budget lowered to 2,920,000 B (measured plus
  ten percent). The total budget is unchanged.
- The smoke test asserts that no chunk referenced by `index.html`
  carries pdf-lib or jszip, and that both still exist in a lazy chunk.

## [0.4.3] - 2026-09-05

Phases A.5 and A.6 of `docs/HARDENING_PLAN_2026-09.md`: the dependency
warnings and the memoization warnings. No user-visible change. Lint
warnings 14 to 0.

### Changed

- New `useLatestRef` hook (`src/hooks/useLatestRef.ts`): a ref holding
  the value from the latest commit, for effects which keep a fixed
  schedule but read current props. AMHSEditor uses it so the DTG is
  generated once at first load and never refilled under the user's
  cursor when the field is cleared or the callback prop changes.
- `getUiCitation` and `validateParagraphNumbering` are pure module
  functions exported from `src/hooks/useParagraphs.ts`; the hook still
  returns them under the same names. With them out of the closure the
  React Compiler compiles the hook, which removes the five memoization
  warnings as well.
- `templateMatches` is the pure, exported filter behind `useTemplates`.
- ITypePreview memoises its Components Affected row source so the
  cover and overflow lists key on a stable input.
- page.tsx lists the two dependencies its callbacks already read.

### Removed

- DistributionSection's initialise-if-undefined mount effect. Its only
  parent always passes a distribution object, so it never ran.

## [0.4.2] - 2026-09-05

Phase A.4 of `docs/HARDENING_PLAN_2026-09.md`: async loads and one-time
initialisation. No user-visible change. Lint warnings 24 to 14, and the
`set-state-in-effect` rule reaches zero.

### Changed

- New `useSyncedUpdate` in `src/hooks/useSyncedState.ts`: runs a callback
  during the render in which a source value changes, for state the
  component owns but a single `useSyncedState` cannot hold. Used for
  today's date (applied on the first client render, gated by
  `useHydrated` so the prerendered markup still matches), the profile
  defaults once the profile loads, the reports-to-admin-subsection sync,
  and the legacy level 0 paragraph migration.
- `useShareLinkLoader` reads the inbound link (EDMS handoff, encrypted
  fragment, legacy share param, in that order) once on the first client
  render. The EDMS latch, callback and hash clear stay in an effect
  which runs once per link.
- `useSpellCheck` clears its issue list in the render where the text
  empties or the check is disabled, and keeps the previous list while
  text is edited until the debounced check replaces it, as before.
- `useVoiceInput` creates one speech recogniser on the first mic press
  and reads the latest paragraphs and update callback through refs. The
  previous version created a recogniser at mount and another each time
  the update callback changed identity.
- Page 11 remarks: the template list loads from the button which opens
  the picker instead of an effect watching the open flag. A failed load
  still toasts and retries on the next open.
- The smoke test asserts the exported letter carries the run date in
  navy format, so a build-time date baked into the export fails CI.

### Removed

- A write-only EDMS context state in `page.tsx` whose value was never
  read.

## [0.4.1] - 2026-09-05

Phase A.3 of `docs/HARDENING_PLAN_2026-09.md`: state reset when an input
changes. No user-visible change. Lint warnings 31 to 24.

### Changed

- PageCountIndicator, DocumentImportModal and RevisionCompareDialog reset
  their local state during render through `useSyncedState`, keyed on the
  preview URL, the parse result and the dialog phase, instead of in an
  effect after the first paint. The revision dialog keeps its
  two-most-recent default once per open and re-arms it on close.
- ShareLinkDialog and GunnyBotSettings derive the EDMS lock and the saved
  proxy URL from `useHydrated`, so the first client render already shows
  the locked state. The GunnyBot mount effect now holds only the store
  side effects (provider, model, key presence) and no local state.
- SignaturePlacementModal is a wrapper plus a body. The body is remounted
  by key on every open and whenever the last letter page changes while
  open, so page, boxes and selection start fresh without an effect. The
  preview object URL is created once per blob in the wrapper and revoked
  when the blob changes or the modal unmounts.

### Added

- Component tests for all six dialogs and indicators above
  (`tests/components/*-dialog.test.tsx`, `page-count-indicator`,
  `signature-placement-modal`) plus an EDMS case for GunnyBotSettings.

## [0.4.0] - 2026-09-05

Phase B.1 of `docs/HARDENING_PLAN_2026-09.md`: the letterhead seals leave
the JavaScript bundle. Same pixels, same PDF and DOCX output.

### Changed

- The DoD and Navy seals are static files under `public/seals/`,
  byte-identical to the base64 data they replace, fetched on first use and
  cached (`src/lib/seal-assets.ts`). The PDF path still receives a data
  URL and the DOCX path an ArrayBuffer, both from one shared byte load per
  seal. The service worker serves them under its network-first stable-asset
  rule, so offline export keeps working after the first load.
- Total JavaScript shipped: 10,654,691 B to 6,809,010 B. Initial load is
  unchanged at 3,138,848 B. The seal transfer itself shrinks from 3.85 MB
  of base64 text to 2.9 MB of PNG, decoded once by the browser.
- Deploy's total-JS budget lowered to 7,490,000 B (measured plus ten
  percent). The initial-load budget is unchanged.
- The smoke test now asserts the exported letter carries an image
  XObject, so a broken seal fetch fails CI as a missing image and as a
  same-origin 4xx.

### Removed

- `src/lib/dod-seal-data.ts`, the 3.85 MB base64 module.

## [0.3.4] - 2026-09-05

Phase B.3 of `docs/HARDENING_PLAN_2026-09.md`: dependency hygiene. No
runtime change; the bundler already tree-shook the removed packages.

### Removed

- `recharts`, `file-saver` (and `@types/file-saver`), and
  `embla-carousel-react` from the dependency tree. Nothing under `src/`
  imported them; the carousel component which used embla went in 0.3.2.

### Changed

- `autoprefixer`, `postcss`, `tailwindcss`, and `tailwindcss-animate` moved
  to devDependencies. They run at build time only. The production SBOM
  now lists 232 components instead of 340, so the supply-chain surface
  reported to reviewers matches what the app ships.

## [0.3.3] - 2026-09-05

Phase A.7 of `docs/HARDENING_PLAN_2026-09.md`: the four image lint
warnings. Lint baseline 35 to 31. No runtime change.

### Changed

- The two `<img>` elements (header seal, I-type seal preview) carry a
  documented `no-img-element` disable: the export runs with
  `images.unoptimized`, so `next/image` would render the same element with
  no optimisation.
- `jsx-a11y/alt-text` is switched off for `src/components/pdf/**`: it
  matched @react-pdf's `Image` drawing primitive by name, which has no alt
  prop. The PDFs are untagged either way (SECTION_508_FINDINGS F1).

## [0.3.2] - 2026-09-05

Phase A.2 of `docs/HARDENING_PLAN_2026-09.md`: mount and media flags. No
user-visible change. Lint warnings 41 to 35.

### Changed

- New `useHydrated` hook (`src/hooks/useHydrated.ts`): false on the server
  and hydration render, true from the first client render, through
  `useSyncExternalStore`. Replaces the mounted-flag effect in ThemeToggle
  and gates the browser-only reads in DisclaimerModal (stored
  acknowledgement) and PlatformSettings (parked install prompt, standalone
  display mode), which now derive through `useSyncedState` and stay
  settable by their handlers.
- `useIsMobile` rewritten on `useSyncExternalStore` with a matchMedia
  subscription; same values, read during render.
- GuidanceDialog preselects the active document type through
  `useSyncedState` keyed on open state and type, instead of an effect.

### Removed

- `src/components/ui/carousel.tsx`, an unused shadcn component carrying
  one of the warnings. Nothing imported it.

## [0.3.1] - 2026-09-05

Phase A.1 of `docs/HARDENING_PLAN_2026-09.md`: derived state mirrored from
props. No user-visible change. Lint warnings 51 to 41.

### Changed

- New `useSyncedState` hook (`src/hooks/useSyncedState.ts`): local state
  which re-derives from a source value whenever the source changes
  identity, done during render rather than in a post-commit effect. Same
  observable behaviour as the `useEffect(() => setFlag(derive(source)))`
  pattern it replaces, minus the extra render and the first-paint flash.
- Ten effects replaced with it: the show/hide flag in ReferencesSection,
  ViaSection, CopyToSection, EnclosuresSection, ManualDistributionSection
  and ClosingBlockSection, and the visible-row count in the NAVMC 10922
  dependent and dissolution sections and the NAVMC 10132 offense and
  victim sections.
- Stateful component tests (`tests/components/list-sections-stateful.test.tsx`)
  pin the radio-and-list interplay in a parent holding real state, so the
  quirks of the old behaviour (clearing the only typed entry collapses the
  section, a form clear collapses a manually opened one) are kept on
  purpose.

## [0.3.0] - 2026-09-05

Phase 0 of `docs/HARDENING_PLAN_2026-09.md`: the safety net every later
refactor and bundle change runs behind.

### Added

- Browser smoke test on the built static export (`tests/e2e/smoke.spec.ts`,
  Playwright). Loads the app with zero console errors and zero same-origin
  4xx responses, types a basic letter and exports it as PDF and DOCX with
  the subject verified in both files, and exports an AA Form through the
  official NAVMC 10274 form path. Runs in CI after the build.
- Lint ratchet (`scripts/lint-ratchet.mjs`, `.lint-baseline.json`). CI
  fails when any rule's warning count rises above the committed baseline.
- Coverage floor (`npm run test:coverage`) with thresholds in
  `vitest.config.ts` set just below the measured baseline.
- Bundle report (`scripts/bundle-report.mjs`) splitting initial-load from
  lazy JavaScript. Deploy enforces both an initial-load and a total budget.
- Forty component tests pinning the show/hide and row-collapse behaviour
  of the nine sections Phase A.1 will refactor.

### Fixed

- The header seal requested `/logo.png` at the origin root on first paint
  and only corrected the path in an effect, a live 404 on GitHub Pages.
  The base path is now inlined at build time so the first request is
  right. Caught by the new smoke test. One lint warning fewer.

## [0.2.0] - 2026-09-05

First versioned release. Baseline established by the DonDocs comparison audit
in `docs/DONDOCS_COMPARISON_2026-09-05.md`.

### Added

- Pre-export sensitive-data check. Every PDF, DOCX, official-form, and batch
  ZIP download scans for SSN and EDIPI patterns and PHI keyword clusters and
  prompts for acknowledgement before the file is written
  (`src/lib/export-gate.ts`, `src/components/ExportScanGate.tsx`).
- Versioning. `CHANGELOG.md`, semantic version in `package.json`, a release
  workflow creating a GitHub release on version bump, and the running
  version shown in the app's Privacy and Security Notice.
- CI gates. `npm audit --omit=dev --audit-level=high` on every test run.
  Deploy now waits on a validated SBOM, asserts no test file reaches the
  static export, and enforces a bundle-size budget on `out/_next/static`.

### Changed

- README now states the GunnyBot data flow next to the local-first claim
  instead of only in `SECURITY.md`, corrects the document-type count to 27,
  and replaces the stale zero-vulnerability claim with the CI audit gate.
- `docs/COMPLIANCE.md` no longer cites git tags lost in the 2026-07-15
  history reset.
- `docs/README.md` rewritten as an index. Package name is now `semperscribe`.
- `tests/golden/page-parity.test.ts` skips with a loud message when
  LibreOffice is absent outside CI. On CI, or when `SOFFICE_PATH` is set, a
  missing binary still fails. When `soffice` runs but writes no PDF (Writer
  module not installed), the failure now quotes the converter's output
  instead of a bare file-not-found.

### Fixed

- One high-severity advisory (browserslist) and two lower advisories in the
  production dependency tree, via lockfile refresh.
- Two unused eslint-disable directives.

## [0.1.0] - 2026-07-15

Unversioned baseline at the start of the DonDocs parity program. See
`docs/DONDOCS_PARITY_PLAN.md` and `docs/USER_DRIVEN_ROADMAP.md` for the
feature history before this changelog existed.
