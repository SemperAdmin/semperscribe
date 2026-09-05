# DonDocs vs SemperScribe: Full-Stack Comparison, Second Audit

Audit date: 2026-09-05, second pass, after SemperScribe's hardening program (`docs/HARDENING_PLAN_2026-09.md`, versions 0.2.0 through 0.4.7).
Method: same as the first audit (`DONDOCS_COMPARISON_2026-09-05.md`). Fresh clone of both repositories, static checks, unit suites, production builds, dependency audits, and source verification of every claim. Every SemperScribe number below was re-measured in this sandbox today. DonDocs is unchanged since the first audit, so its figures are carried forward and the two which drift with time (dependency audit, action pinning) were re-run.

Repositories audited.

- DonDocs: https://github.com/marinecoders/dondocs at commit 40fc721 (v1.2.143). No commits since the first audit.
- SemperScribe: https://github.com/SemperAdmin/semperscribe at commit e0667f8 on main (v0.4.7). 51 commits since the first audit's 32b9e4f (v0.1.0).

## Verdict

DonDocs remains the stronger product for the naval letter itself: pdfTeX typography, a regression corpus fed by real users, a headless companion, and an output-fidelity test matrix SemperScribe has nothing like. SemperScribe remains the only one of the two with any coverage of directives, staffing papers, messages, DLA formats, and the NJP and Page 11 forms.

What changed is the engineering gap. In the first audit SemperScribe documented quality in markdown while DonDocs enforced it in CI. Today SemperScribe enforces more gates than DonDocs does: a blocking dependency audit which is clean, a lint ratchet at zero, a coverage floor, two bundle budgets, a blocking SBOM, a browser smoke test on the built export, SHA-pinned actions with a test which keeps them pinned, and a Dependabot feed. Its first-load JavaScript is now smaller than DonDocs's. The one defect the first audit called out as a copied benchmark's missing feature, no sensitive-data scan before export, is closed. The provenance concern is unchanged and one governance difference has widened: 40 percent of SemperScribe's commits are now authored as "Claude", where DonDocs forbids AI authorship outright.

## 0. The first audit's findings, revisited

| First-audit finding on SemperScribe | Status today | Where |
|---|---|---|
| README contradicted SECURITY.md on data egress | Fixed. README states the GunnyBot data flow next to the local-first claim. | 0.2.0 |
| No PII scan before PDF or DOCX download | Fixed. Every PDF, DOCX, official-form and batch ZIP export scans for SSN, EDIPI and PHI keyword clusters and prompts before writing. | `src/lib/export-gate.ts`, 0.2.0 |
| One high advisory in the production tree | Fixed. `npm audit` reports zero advisories in both trees; CI fails on high or above. | 0.2.0, gate in test.yml |
| docs/COMPLIANCE.md cited git tags which did not exist | Fixed. The citation is gone. 14 real version tags now exist. | 0.2.0 |
| No versioning, changelog, or release | Fixed. `CHANGELOG.md`, semantic versions, a release workflow which tags and publishes on every bump, version shown in the app. | 0.2.0 |
| 54 lint warnings | Fixed. Zero warnings, held at zero by a ratchet which fails CI on any rise. | 0.3.0 through 0.4.3 |
| JavaScript payload 2.9x DonDocs | Reduced. Total 10.65 MB to 6.89 MB; first load 3.14 MB to 2.55 MB, now under DonDocs's 3.73 MB. | B.1, B.4, B.5 |
| Page-parity test hard-failed without LibreOffice | Fixed. Skips off CI when the converter is absent, fails loudly when it is present but broken. | 0.2.0 |
| Stale docs index and package name | Fixed. `docs/README.md` rewritten, package renamed `semperscribe`. | 0.2.0 |
| Git history reset at the parity program | Unchanged. Provenance before 2026-07-15 is still outside the repository. | |
| No coverage threshold, no bundle budget, non-blocking SBOM, no audit gate | All four fixed. | Phase 0, deploy.yml |
| Neither project ran a browser end-to-end test | SemperScribe now does: four Playwright paths on the built export in CI. DonDocs still does not. | 0.3.0, 0.4.4, 0.4.5 |

Two new items found in this pass and fixed in the same day: share-link payloads were trusted after `JSON.parse` with a type cast and are now schema-checked (0.4.7), and both editors could lose up to 500 ms of typing to an export issued inside their debounce window (0.4.6). The second surfaced as a CI failure on a fast runner and is a real user-facing fix.

## 1. Identity and provenance

| Fact | DonDocs | SemperScribe |
|---|---|---|
| Version | 1.2.143 | 0.4.7 |
| First commit in history | 2025-12-29 | 2026-07-15, a squash titled "DonDocs parity program" |
| Commits | 289 | 121 |
| Human authors | 5 | 2 (Stephen 43, Semper Admin 26), plus Dependabot 4 |
| Commits attributed to an AI author | 0. CLAUDE.md forbids it. | 48 of 121 (40 percent), authored as "Claude". 35 of the 51 commits since the first audit. |
| Releases | 142 tagged versions, auto-created from CHANGELOG.md | 14 tagged versions (v0.2.0 to v0.4.7), auto-created from CHANGELOG.md by release.yml |
| GitHub stars, forks, issues | 8, 1, 12 issues with user bug reports (first audit, not re-fetched) | 0, 0, 0 (first audit, not re-fetched) |
| Published surfaces | Cloudflare Pages config, Docker image on ghcr.io | GitHub Pages, cloud.gov manifest |

Reading. DonDocs still has the external feedback loop and SemperScribe still does not. SemperScribe now has release discipline: a bug report can name a version, and each version has notes. The AI-authorship share is a governance fact a reviewer will weigh either way; the commits are attributed, gated by the same CI as human commits, and reviewed by an automated reviewer on every PR, but no second human reviews them.

## 2. Stack

Unchanged from the first audit except for the rows below.

| Layer | DonDocs | SemperScribe |
|---|---|---|
| Build and framework | Vite 8, React 19, TypeScript 6 | Next.js 16 static export, React 18, TypeScript 5.9 |
| Runtime for build and test | Node 22 | Node 22 (was 20, which reached end of life in April 2026) |
| PDF engine | SwiftLaTeX (pdfTeX in WebAssembly), pdf-lib post-process | @react-pdf/renderer; pdf-lib loads on demand for forms, signature fields and enclosure merge |
| Reference data | Units and SSIC in JSON, lazy loaded | Units, SSIC, dictionary and word set all lazy loaded; the letterhead seals are static PNGs |
| Headless use | Companion HTTP server and MCP server | None |
| LLM integration | None | GunnyBot, user-supplied key, Gemini or GenAI.mil, egress gate enforced at the send path |

## 3. Measured size and health

All SemperScribe numbers measured in this sandbox on 2026-09-05 at e0667f8. DonDocs numbers from the first audit at the same commit, with the audit re-run today.

| Measure | DonDocs | SemperScribe |
|---|---|---|
| Source lines under src (ts and tsx) | 55,056 | 89,031 |
| Of which embedded data tables | none, JSON files | about 20,000 lines across four tables, none on the first load |
| Test files, test lines | 196 files, 26,067 lines | 127 files, 20,484 lines (was 92 and 17,853) |
| Unit suite result | 2,241 passed, 0 failed | 2,483 passed, 0 failed among the tests which can run here; the LibreOffice parity test skips by design and passes on CI (was 2,322) |
| Browser end-to-end | none | 4 Playwright paths on the built export: load with zero console errors, letter to PDF and DOCX with subject and run date verified in the files, AA form through the official NAVMC 10274 path, first-load chunks free of pdf-lib, jszip and the dictionary |
| Coverage, measured | statements 15.5 percent (gate baseline) | statements 51.2, branches 46.4, functions 41.9, lines 52.3 percent; floors 44.5, 40.5, 35, 45.5 |
| Typecheck | pass | pass, app and tests |
| Lint | 0 errors, 0 warnings, eslint-plugin-security active | 0 errors, 0 warnings (was 54), ratchet holds the floor |
| npm audit, production tree | 27 moderate, 0 high (re-run today, unchanged) | 0 in the production tree, 0 in the full tree |
| JavaScript on first load | 3.73 MB (single bundle, everything is initial) | 2.55 MB across 18 chunks (was 3.14 MB) |
| JavaScript total | 3.73 MB, largest chunk 2.78 MB | 6.89 MB across 53 chunks, largest chunk 1.40 MB (was 10.65 MB and 3.85 MB) |
| Static output on disk | 31 MB (15 MB TeX Live, 1.8 MB engine wasm) | 24 MB (8.3 MB blank form PDFs, 2.8 MB seals, 1.1 MB fonts) |
| Downloaded on first DOCX export | 58 MB Pandoc wasm | 0 |
| Production build in this sandbox | Failed under npm run build (unpkg fetch, HTTP 403 through the proxy); direct vite build passed | Passed, from npm ci alone |
| Production dependencies, SBOM components | not re-measured | 43 direct, 232 in the SBOM (was 340) |

Reading. The first-load number is the one a user feels, and SemperScribe now wins it by 1.2 MB while shipping both export formats with no second download. DonDocs's total is smaller because it defers its engines to 17 MB of TeX assets and a 58 MB Pandoc download outside the JavaScript count. SemperScribe's remaining first-load weight is the Next runtime (883 KB), zod (264 KB), the letter form components (176 KB), and react-day-picker (64 KB), none of which the hardening plan targeted.

## 4. CI and release engineering

| Gate | DonDocs | SemperScribe |
|---|---|---|
| Typecheck, lint, unit tests on every PR | yes, 3-way matrix | yes |
| Lint warnings held at a floor | not needed, zero | ratchet script, baseline zero, CI fails on any rise |
| Coverage threshold | yes, statements 15.5 percent | yes, four thresholds one point under the measured baseline |
| Production build in CI | yes, plus "no test file in dist" | yes at deploy, plus "no test file in out" |
| Bundle-size budget | one, 4.0 MiB on dist/assets, fails the PR | two, initial-load 2,810,000 B and total 7,490,000 B, each lowered in the PR which earned the reduction |
| Browser smoke test in CI | no | yes, Playwright on the static export, traces uploaded on failure |
| Generated-artifact drift checks | yes, two | no |
| npm audit gate | yes, high and above | yes, high and above, production tree, currently clean |
| SBOM | blocking, validated | blocking, validated (was non-blocking) |
| Dependency update feed | Dependabot security PRs arrive; no dependabot.yml in the repo | dependabot.yml: weekly grouped npm minor and patch, weekly Actions |
| Third-party actions pinned to commit SHAs | 0 of 33 `uses:` lines | all, with the version noted, and a test which fails if a pin, a permissions block or `pull_request_target` changes |
| CodeQL | default setup, no workflow in repo | workflow in repo, security-extended and security-and-quality, weekly plus per push |
| Runtime CDN guard | postbuild fails on any third-party URL in dist | no equivalent; the smoke test asserts zero same-origin 4xx and zero console errors instead |
| Output-fidelity matrix | 380 xelatex plus 380 pandoc fixtures per PR, nightly 50K-fixture slice | page-parity through LibreOffice headless, golden DOCX and PDF snapshots |
| Mutation testing | Stryker, local, LaTeX layer | no |
| Release | version bump creates a release and a Docker image | version bump creates a release with the changelog section as notes |
| Deploy gated on tests | yes | yes |

Reading. The first audit's sentence, "DonDocs enforces quality in CI, SemperScribe documents quality in markdown," is no longer true. Count the blocking gates and SemperScribe has more. Count the depth of output verification and DonDocs still leads by a wide margin: its 770-fixture compile matrix per PR has no counterpart. SemperScribe's supply-chain posture (clean audit, SHA pins, Dependabot, blocking SBOM) is now ahead of DonDocs's (27 moderate advisories accepted, tag-pinned actions, no feed config).

## 5. Testing philosophy

DonDocs is unchanged: property tests, a per-issue regression corpus, component tests, fuzz suites, and an integration compile matrix with real xelatex and pandoc.

SemperScribe added a layer under its domain-rule suites during the hardening program.

- Component tests for the state derivations the lint work refactored: 60-plus tests across the list sections, dialogs, editors and hooks, each pinning the behaviour before the refactor and asserting it after.
- A browser smoke test on the built export which reads the exported PDF and DOCX back and checks their content, including today's date so a build-time date can never ship.
- Source-contract tests: the enclosure row model imports no pdf-lib, the validators never import the dictionary, every action is SHA-pinned.
- The first audit's four suites remain: golden snapshots with a regulation citation required on every diff, LibreOffice page parity, NAVMC and NJP validators, import parsers.

Coverage at 51 percent of statements against DonDocs's 15.5 percent floor is a different kind of number: SemperScribe measures whole-source coverage with data tables excluded and sets the floor a point under it; DonDocs sets a regression floor and relies on the compile matrix for confidence. Neither number says anything about typography.

## 6. Document coverage

Unchanged from the first audit. DonDocs: 20 LaTeX templates, all letters and memoranda. SemperScribe: 27 schema-defined types across letters, memoranda, staffing papers, directives, DLA formats, five forms, AMHS messages and I-type publications. Reference data counts are unchanged (units 3,140 vs 3,690, SSIC 2,240 vs 2,704, reference library 135 vs 28).

## 7. Feature deltas

Present in DonDocs, absent in SemperScribe. Unchanged: pdfTeX typesetting, LaTeX source export, headless HTTP and MCP companion, block paragraph editor with drag reorder, per-document version history with ten snapshots, multi-document workspace with full-text search, full-account JSON backup, classification through TOP SECRET//SCI, endorsement inheritance, density and colour modes, Docker image.

Removed from this list since the first audit: "PII and PHI scan before every download." SemperScribe now has one on every export path.

Present in SemperScribe, absent in DonDocs. Unchanged: the document families beyond letters, Word and PDF import into fields, military spell check and acronym checker, voice dictation, proofread checklist with autofix, review comments in the share link, revision compare, package assembly, NLDP interchange format, the NJP workflow, GunnyBot, the compliance paper trail.

Added since the first audit: a browser end-to-end test in CI, a per-version changelog and release, a first-load budget, a schema check on inbound share links.

Present in both: encrypted share links (PBKDF2-SHA-256, DonDocs at 120,000 iterations, SemperScribe at 600,000 with link expiry), IndexedDB document library, auto backup, installable PWA, CUI marking, find and replace, undo, command palette, dark mode, profiles, batch generation, DOCX export, enclosure merge, signature fields.

## 8. Security and privacy posture, verified in source

| Claim | DonDocs | SemperScribe |
|---|---|---|
| "No data leaves the browser" | True. Same-origin fetches only, postbuild guard. | Qualified and now stated as such in the README: the assistant posts document text to the user's chosen provider under the user's key, with a redaction step and a consent gate. |
| Pre-export sensitive-data scan | Yes | Yes, since 0.2.0, on every export path including batch ZIP |
| Inbound share link handling | Payload decoded and used | Legacy `?share=` held behind a confirm dialog; both formats schema-checked before reaching the editor (0.4.7) |
| Share link crypto | PBKDF2-SHA-256 at 120,000 iterations, AES-GCM | PBKDF2-SHA-256 at 600,000 iterations, AES-256-GCM, random salt and IV, optional expiry |
| API key handling | n/a | Memory only, never persisted; proxy URL restricted to http and https |
| Service worker | Workbox precache | Same-origin GET only, network-first for stable assets |
| Dangerous DOM APIs | not audited | none: no innerHTML, eval, or dangerouslySetInnerHTML in src |
| Dependency advisories | 27 moderate accepted | zero |
| Supply chain | actions tag-pinned, no update feed config | actions SHA-pinned with a guard test, Dependabot weekly |
| Licensing exposure | AGPL-3.0 SwiftLaTeX, GPL pdfTeX and Pandoc as unmodified wasm | MIT tree |
| Accessibility of output | untagged PDF | untagged PDF, UI directs screen-reader users to DOCX |

## 9. Defects and risks found

DonDocs. Unchanged from the first audit, because the code is unchanged: structural DOCX limits, Copy-To overflow past one page, the unpkg build dependency, the 58 MB first-export download, bus factor of one, 27 moderate advisories under a high-only gate, README drift on Vite and Node, no garbage collection of enclosure blobs. One addition from this pass: none of its 33 action references is SHA-pinned.

SemperScribe.

- Provenance still starts at 2026-07-15.
- 40 percent of commits are AI-authored with no second human reviewer. The gates are the review.
- Total JavaScript is still 1.8 times DonDocs's, in lazy chunks. First load is smaller.
- No container recipe and no headless API. An automation pipeline still has one option, and it is DonDocs.
- The letterhead seals are shipped at full resolution (2.8 MB of PNG). Downscaling is the one plan item left, held for a human eye on the output.
- No mutation testing and no output-fidelity matrix of DonDocs's scale.
- No Content-Security-Policy. GitHub Pages sets no headers and a meta policy would need `unsafe-inline` for the framework's bootstrap. Accepted, not fixed.

## 10. Fit by user

| User | Better fit | Reason |
|---|---|---|
| Drafter who needs the best-looking naval letter PDF and Word file | DonDocs | pdfTeX typography, 142 shipped fixes, regression corpus from real users. Unchanged. |
| S-1 clerk producing AA forms, Page 11s, NJP paperwork, MARADMINs | SemperScribe | DonDocs has none of those families. Unchanged. |
| Reviewer kicking back drafts | SemperScribe | Review comments and revision compare ride the share link. Unchanged. |
| Converting a legacy .docx letter | SemperScribe | Field-level import with review. Unchanged. |
| Automation or agent pipeline | DonDocs | Companion HTTP and MCP server. Unchanged. |
| Air-gapped host | DonDocs, with staging work | Docker recipe exists. Unchanged. |
| Compliance reviewer wanting paper artifacts | SemperScribe | SSDF mapping, 508 findings, license elections, now with real version tags and a changelog behind them. |
| Compliance reviewer wanting enforced controls | Even, leaning SemperScribe on supply chain | SemperScribe: clean audit, SHA pins, Dependabot, blocking SBOM, budgets, coverage floor, lint ratchet, browser smoke. DonDocs: no-CDN guard, drift checks, compile matrix. Changed from DonDocs in the first audit. |
| Team choosing a codebase to extend | DonDocs for letters, SemperScribe for forms | Same split. SemperScribe's zero-warning, gated, hook-refactored codebase is now easier to extend than it was; DonDocs's output verification is still the deeper safety net for typesetting changes. |

## 11. Confidence

| Finding | Confidence |
|---|---|
| SemperScribe measurements (tests, lint, audit, coverage, bundle) | 0.95, executed here today |
| DonDocs measurements carried forward | 0.9, same commit as the first audit; audit and pinning re-run today |
| Status of first-audit findings | 0.95, each verified in source or CI configuration |
| Feature delta lists | 0.85, source-verified for the changes, first-audit reading for the rest |
| Fit-by-user judgements | 0.75, reasoned from the tables, not from user trials |
| Output typography quality | 0.5, still not rendered side by side |
| Runtime performance, time to first preview | 0.0, still not measured |

Weighted overall confidence 0.87.

## 12. Gaps shared by both

- Neither has an Authority to Operate, RMF package, or accredited CUI handling.
- Neither produces tagged PDF.
- Neither has more than one active human maintainer.
- Neither validates output against Microsoft Word's own pagination.
- Neither has been measured for time to first preview. This is the largest remaining blind spot in both audits.

Removed from the shared list since the first audit: browser end-to-end testing. SemperScribe runs one; DonDocs still does not.
