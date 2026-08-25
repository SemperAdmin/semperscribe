# Phase 0 Parity Harness — Baseline Status

Recorded: 2026-06-09. Baseline commit: 82a6c52.

## Golden files

| Artifact | File | Status at baseline |
| :--- | :--- | :--- |
| DOCX document.xml (fixture letter) | `__snapshots__/basic-letter.document.xml` | GREEN — snapshot committed, deterministic across runs |
| PDF positioned text layout (fixture letter) | `__snapshots__/basic-letter.pdf-layout.txt` | GREEN — snapshot committed |

## Page-fill pagination parity

Status at baseline: **GREEN**. The page-fill fixture spills to page 2 in
both pipelines and the sentinel paragraph lands on the same page in the
PDF pipeline and in the DOCX pipeline rendered through LibreOffice
headless (Liberation fonts, metric-compatible with TNR/Courier New).

Constraints on this result:

1. The DOCX half requires `soffice`. REVISED 2026-08-25, in both the
   probe and what happens when it comes up empty.

   Resolution order: the `SOFFICE_PATH` environment variable (full
   binary path, checked first, errors loudly if set but wrong), then
   the platform's default install directories, then PATH via `where`
   on Windows and `which` elsewhere. The probe used to run `which`
   unconditionally, which is not a Windows command, so on Windows it
   threw and the test reported "not found" whether LibreOffice was
   installed or not: `SOFFICE_PATH` was the only way to pass.

   Absent all of these the behaviour now depends on WHO is asking.
   In CI (`CI=true`) the test FAILS, unchanged and deliberately: a CI
   run that quietly stops checking parity is worse than no check.
   Locally it SKIPS, and says so twice, in the skipped test's name and
   on stderr, naming what was not evaluated and where it still is.

   That is a retreat from "fails everywhere", and the reason is that
   the old rule cost more attention than it bought. A developer who
   declines to install LibreOffice could never see a green suite, so
   one known red became scenery. On 2026-08-25 a Windows run carried
   this failure plus an unrelated 30-second timeout and the timeout
   nearly went unremarked behind it.

   The PDF half was split into its own test at the same time. It needs
   no LibreOffice and now runs everywhere. Under the old single-test
   structure a machine without `soffice` lost the PDF assertions too,
   because the test aborted at the `soffice` check before reaching
   them. Less LibreOffice, more local coverage.
2. LibreOffice pagination is a proxy for Microsoft Word pagination.
   They agree on simple flows at these metrics, but Word is the
   authoritative renderer. Treat parity-green as "no known divergence,"
   not proof of Word-identical breaks.
3. Both golden snapshots intentionally pin current DEFECTS (for
   example `w:top="720"`, the 0.5-inch top margin, audit gap G3, and
   the 0.25-inch fixed indent cascade, gap G1). Phase 1 fixes change
   these snapshots; each snapshot diff hunk must carry a citation.

## How to update a golden file

1. Make the approved code change.
2. Run `npx vitest run tests/golden` — the snapshot test fails and
   prints the diff.
3. Review every hunk against the cited authority (SECNAV M-5216.5,
   MCO 5215.1K, MCO 5216.20B).
4. Re-run with `npx vitest run tests/golden -u` to accept.
5. Commit the snapshot change in the same commit as the code change,
   citations in the commit message.
