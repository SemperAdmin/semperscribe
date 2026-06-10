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

1. The DOCX half requires `soffice`. Resolution order: the
   `SOFFICE_PATH` environment variable (full binary path, checked
   first, errors loudly if set but wrong), then `/usr/bin/soffice`,
   `/usr/local/bin/soffice`, then `which soffice`. Absent all of
   these, the test FAILS by design. It does not skip. CI installs
   LibreOffice. Windows local runs: install LibreOffice, then
   `$env:SOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"`
   before `npm test`.
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
