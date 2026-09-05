# Changelog

All notable changes to Semper Scribe are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
semantic versioning. A version bump in `package.json` on `main` creates the
matching GitHub release with this file's section as the notes.

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
