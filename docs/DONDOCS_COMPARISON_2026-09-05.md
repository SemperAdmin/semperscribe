# DonDocs vs SemperScribe: Full-Stack Comparison

Audit date: 2026-09-05.
Method: fresh clone of both repositories, static checks, unit suites, production builds, dependency audits, and source verification of every README claim quoted below. No figure in this document rests on a README alone.

Repositories audited.

- DonDocs: https://github.com/marinecoders/dondocs at commit 40fc721 (v1.2.143).
- SemperScribe: https://github.com/SemperAdmin/semperscribe at commit 32b9e4f on main (v0.1.0).

## Verdict

DonDocs is the more mature engineering product for naval letters and memoranda. SemperScribe is the broader administrative product for a USMC S-1 shop. The two are not independent designs. SemperScribe's own planning file, docs/DONDOCS_PARITY_PLAN.md dated 2026-07-15, names DonDocs as the benchmark, lists nine features DonDocs had and SemperScribe lacked, and 23 source files still cite the plan by name. Read DonDocs as the benchmark and SemperScribe as the follow-on with a wider scope.

## 1. Identity and provenance

| Fact | DonDocs | SemperScribe |
|---|---|---|
| Version | 1.2.143 | 0.1.0 |
| First commit in history | 2025-12-29 | 2026-07-15 (history begins with a squash titled "DonDocs parity program") |
| Commits | 289 | 70 |
| Human authors | 5 | 3 |
| Share of commits by top author | 94 percent (rchiofalo, 272 of 289) | 61 percent (Stephen, 43 of 70) |
| Commits attributed to an AI author | 0 (CLAUDE.md forbids it) | 13 authored as "Claude" |
| Releases | 142 tagged versions between 2026-07-01 and 2026-09-01, auto-created from CHANGELOG.md | none, no changelog |
| GitHub stars, forks | 8, 1 | 0, 0 |
| Issues | 12 total, 2 open, includes user bug reports | 0 |
| Open pull requests | 2 | 1 |
| Published surfaces | Cloudflare Pages config, Docker image on ghcr.io via release workflow | GitHub Pages, cloud.gov manifest |

Reading. DonDocs has an external feedback loop. Users file formatting bugs, the maintainer ships a versioned fix, and a regression test lands per closed issue. SemperScribe has no visible external users and no release discipline. Everything it knows about user friction comes from its own persona exercise (docs/USER_DRIVEN_ROADMAP.md).

## 2. Stack

| Layer | DonDocs | SemperScribe |
|---|---|---|
| Build and framework | Vite 8, React 19, TypeScript 6 | Next.js 16 static export, React 18, TypeScript 5.9 |
| UI | Tailwind 4, shadcn/ui, Radix | Tailwind 3, shadcn/ui, Radix |
| State | Zustand 5 | React hooks plus Zustand 5 |
| Body editor | TipTap block editor, dnd-kit drag reorder, inline bold/italic/underline, @ menu | Custom paragraph list with multi-level numbering |
| PDF engine | SwiftLaTeX (pdfTeX compiled to WebAssembly), pdf-lib post-process | @react-pdf/renderer, pdf-lib for forms and signature fields |
| DOCX engine | Flat LaTeX to Pandoc WebAssembly, Lua filter, JSZip OOXML patching | docx npm library, native OOXML generation |
| Extra export | LaTeX source | AMHS plain text, NLDP JSON package, batch ZIP |
| Import | Text PDF and .docx through pdf.js and Pandoc, review step | .docx via mammoth and PDF via pdfjs, rule-based field parser, review modal |
| Storage | IndexedDB (documents, attachments, 10 snapshots per doc), gzip-compressed localStorage for profiles | IndexedDB (documents, settings, enclosure files), localStorage for drafts and profile |
| Offline | vite-plugin-pwa with Workbox, 35 precache entries totaling 13.4 MiB | Hand-written sw.js, network-first shell |
| Headless use | Companion HTTP server on 127.0.0.1:7712 and an MCP server, 1,020 lines, same generator as the app | none |
| LLM integration | none | GunnyBot, user-supplied key, Google Gemini or GenAI.mil |
| Deploy | wrangler.toml, Dockerfile with Caddy, ghcr.io image | next export to out/, gh-pages, cloud.gov staticfile buildpack |

## 3. Measured size and health

All numbers measured in this sandbox on 2026-09-05.

| Measure | DonDocs | SemperScribe |
|---|---|---|
| Source lines under src (ts and tsx) | 55,056 | 88,698 |
| Of which embedded data tables | units and SSIC live in JSON, lazy loaded | about 20,300 lines (military dictionary 13,540, units 3,707, SSIC 2,711) |
| Test files, test lines | 196 files, 26,067 lines | 92 files, 17,853 lines |
| Unit suite result | 2,241 passed, 0 failed, 149 files, 87 s | 2,322 passed, 1 failed, 83 files, 92 s |
| The one failure | n/a | tests/golden/page-parity.test.ts needs LibreOffice Writer. The sandbox has libreoffice-core without the Writer module, so soffice converts nothing. Environmental, and the test fails by design when the converter is present but broken. |
| Typecheck | pass | pass (app and tests) |
| Lint | 0 errors, 0 warnings, eslint-plugin-security active | 0 errors, 54 warnings (react-hooks/set-state-in-effect) |
| npm audit, production tree | 27 moderate, 0 high | 1 high (browserslist), 1 moderate, 1 low |
| JavaScript shipped | 3.73 MB across dist/assets, largest chunk 2.78 MB | 10.65 MB across out/_next chunks, largest chunk 3.85 MB |
| Static output on disk | 31 MB (15 MB TeX Live, 1.8 MB engine wasm) | 25 MB (8.3 MB blank form PDFs, 1.1 MB fonts) |
| Downloaded on first DOCX export | 58 MB Pandoc wasm, then cached by service worker | 0 |
| Production build in this sandbox | Failed under npm run build: the prebuild step fetches Pandoc from unpkg and the proxy returned HTTP 403. Direct vite build passed and the no-CDN guard passed. | Passed |

Reading.

- SemperScribe ships roughly 2.9 times the JavaScript in total, but not on first load. The chunks referenced by out/index.html total 3.14 MB against DonDocs's 3.73 MB. The 3.85 MB largest chunk is lazy and is the DoD and Navy seal PNGs stored as base64 inside src/lib/dod-seal-data.ts. Moving those to static PNGs is the single largest bundle fix. See docs/HARDENING_PLAN_2026-09.md.
- DonDocs's PDF path costs 17 MB of TeX assets before the first preview renders. Its DOCX path costs a further 58 MB on first use. SemperScribe renders both formats from its 10.65 MB of JavaScript with no second download.
- DonDocs's build has a hard network dependency on unpkg.com. Any network policy blocking unpkg, as this sandbox's proxy did, breaks the default build. The script documents a manual staging path for offline builds. SemperScribe builds from npm ci alone.
- SemperScribe's README states "zero known vulnerabilities in production dependencies as of the last audit pass." The audit today shows one high-severity advisory in the production tree. The claim is time-bound and now stale.

## 4. CI and release engineering

| Gate | DonDocs | SemperScribe |
|---|---|---|
| Typecheck, lint, unit tests on every PR | yes, 3-way matrix | yes, on every non-main branch and PR |
| Coverage threshold | yes, whole-src, set 0.1 points below baseline (statements 15.5 percent) | no |
| Production build in CI | yes, plus "no test file in dist" assertion | only at deploy time |
| Bundle-size budget | yes, 4.0 MiB on dist/assets JS, fails the PR | no |
| Generated-artifact drift checks | yes, two: tex bundle vs source, pdf.js worker vs installed version | no |
| npm audit gate | yes, high and above, no allowlist | no, audit runs by hand |
| SBOM | generated and validated as a blocking job | generated, non-blocking, deploy proceeds if it fails |
| CodeQL | via GitHub default setup, no workflow file in repo (unverifiable from the clone) | workflow file in repo with a config, weekly plus per push |
| Runtime CDN guard | postbuild script fails the build on any third-party URL in dist | no equivalent |
| Compile matrix | 380 pairwise fixtures through xelatex and 380 through pandoc, about 770 tests per PR, 15-minute budget | page-parity test through LibreOffice headless |
| Nightly deep test | rotating 50K-fixture DOCX slice of a 17.7M-fixture cartesian space | no |
| Mutation testing | Stryker config, local only, break threshold 50 percent, scoped to the LaTeX layer | no |
| Release | version bump on main auto-creates a GitHub release with CHANGELOG notes, then a Docker image | push to main deploys to Pages, no version, no tag |
| Deploy gated on tests | yes | yes |
| GitLab mirror | no | yes |

Reading. DonDocs enforces quality in CI. SemperScribe documents quality in markdown. SemperScribe's docs/COMPLIANCE.md maps the project to NIST SP 800-218 practices and cites git tags such as baseline-pre-compliance as evidence. Those tags do not exist in the repository. git tag -l returns nothing. The history was reset on 2026-07-15 and the compliance document was not updated to match.

## 5. Testing philosophy

DonDocs layers five kinds of tests and documents the layering in tests/README.md.

- Property tests with fast-check (98 files under tests/unit).
- A regression corpus of 22 files, one per closed user issue.
- 22 React component tests.
- Fuzz and combinatorial suites (10 files).
- An integration compile matrix requiring real xelatex and pandoc, plus companion contract tests over HTTP and MCP.

SemperScribe concentrates on domain rules and output fidelity.

- Golden snapshots of DOCX document.xml and PDF text layout for a fixture letter, with a rule requiring a regulation citation on every snapshot diff.
- A page-fill parity test rendering the DOCX through LibreOffice and asserting the same page break as the PDF pipeline.
- Deep validator suites for NAVMC 10132 (unit punishment book), NAVMC 10922, and the NJP package, encoding MCM Part V limits such as the six-month suspension cap.
- Import parser tests under tests/services/import.

Neither repository runs an end-to-end browser test. Neither measures time to first preview. DonDocs's coverage gate sits at 15.5 percent of statements, which is a regression floor, not a quality target.

## 6. Document coverage

| Family | DonDocs | SemperScribe |
|---|---|---|
| Letters and endorsements | 7 (naval, standard, business, multiple-address, joint, same-page and new-page endorsement) | 4 (basic, multiple-address, endorsement, business) |
| Memoranda and agreements | 9 (MFR, memorandum for, plain paper, letterhead, decision, executive, joint, MOA, MOU) | 6 (MFR, from-to, letterhead, MOA, MOU, coordination page) |
| Executive correspondence | 4 (executive, standard, action, information memoranda) | 1 type with 4 format variants |
| Staffing papers (MCO 5216.20B) | 0 | 3 (information, position, decision) |
| Directives (MCO 5215.1K, SECNAV M-5215.1) | 0 | 5 (MCO, MCBul, change transmittal, SECNAVINST, SECNAV notice) |
| DLA formats | 0 | 2 |
| Forms | 2 (NAVMC 10274, NAVMC 118(11)) | 5 (NAVMC 10274, 118(11), 10132, 10922, JAGMAN Appendix A-1) |
| Messages | 0 | AMHS GENADMIN, MARADMIN, ALMAR |
| Technical publications | 0 | I-type cover and admin pages |
| Total schema-defined types | 20 LaTeX templates | 27 (26 in schemas.ts plus I-type). README says 25 and undercounts. |
| Content templates | 11 auditor-approved letters, save-as-template | 69 global .nldp templates, mostly AA form variants |
| Unit directory | 3,140 units, 852 KB JSON, lazy loaded | 3,690 units with RUC, MCC, UIC, address, bundled as TypeScript |
| SSIC codes | 2,240 | 2,704 |
| Reference library | 135 entries with stable ids and keywords | 28 entries |
| Office codes | 74 | rank and title tables |
| Clause library | yes, seeded | removed (commit 2026-07-16) |
| Batch placeholders | 28 across 6 categories, CSV and Excel import | CSV import with user-defined tokens, ZIP output |

Reading. For the naval letter itself DonDocs covers more variants and does so with a LaTeX template per type. For everything an S-1 touches beyond letters, SemperScribe is the only one of the two with any coverage. A user who needs a MARADMIN, an MCO, an information paper, or a unit punishment book has one option.

## 7. Feature deltas

Present in DonDocs, absent in SemperScribe.

- pdfTeX typesetting with real kerning and hyphenation.
- LaTeX source export.
- Headless companion over HTTP and MCP for scripted or agent-driven generation.
- Block paragraph editor: Enter splits, Backspace merges, Tab indents within SECNAV nesting rules, drag reorder with children.
- Per-document version history, 10 snapshots, safety snapshot before restore.
- Multi-document workspace with full-text search, pin, rename, duplicate, delete with undo.
- Full-account JSON backup covering profiles, snippets, templates, and enclosure bytes, plus an auto-synced backup file on Chromium.
- PII and PHI scan before every download: SSN, EDIPI, DOB, phone, non-.mil email, 40 medical keywords.
- Classification through TOP SECRET//SCI with portion markings and a hostname-based level gate.
- Endorsement inheritance from a saved base letter.
- Three density modes, three color schemes, welcome tour, in-app-browser detection.
- Docker image and release automation.

Present in SemperScribe, absent in DonDocs.

- Every document family in section 6 beyond letters and memoranda: directives, staffing papers, AMHS, DLA, I-type, three additional forms.
- Word and PDF import into structured fields with a review-and-confirm modal.
- Military spell check and dictionary, acronym first-use checker.
- Voice dictation into paragraphs.
- Proofread checklist mapped to SECNAV M-5216.5 chapter 2 paragraph 19, plus one-click autofix for mechanical findings.
- Review comments carried inside an encrypted share link, and revision compare between saves.
- Package assembly: basic letter plus endorsement chain with continuous numbering.
- NLDP portable data format for interchange and a policy-as-data handoff design.
- NJP workflow: NAVMC 10132 with MCM Part V validators, suspension math, appeal scaffolding.
- GunnyBot drafting and review assistant with redaction and an egress consent gate.
- Section 508 audit with remediation status, SSDF mapping, license election record, cloud.gov target.

Present in both after the parity program: encrypted share links (AES-GCM over PBKDF2, DonDocs at 120,000 iterations, SemperScribe adds link expiry), IndexedDB document library, auto backup to disk, installable PWA, CUI marking engine, find and replace, undo with 50 steps, command palette, dark mode, profiles, batch generation, DOCX export, enclosure PDF merge, signature fields.

## 8. Security and privacy posture, verified in source

| Claim | DonDocs | SemperScribe |
|---|---|---|
| "No data leaves the browser" | True. Every fetch in src targets same-origin assets. A postbuild guard blocks third-party URLs. | False as a blanket statement. GunnyBot posts document text to generativelanguage.googleapis.com or api.genai.mil under the user's key. SECURITY.md discloses this. The README highlight "no data leaves the browser" does not. |
| Pre-export sensitive-data scan | Yes, detectPII runs before download in App.tsx and ShareModal.tsx | No. scanForSensitiveData exists in src/lib/security-utils.ts but its only caller is the GunnyBot redaction path. A PDF or DOCX with an SSN downloads without warning. |
| API key handling | n/a | Memory only, cleared on tab close, never persisted. Proxy base URL persisted in localStorage, not a secret. |
| Share link crypto | PBKDF2-SHA256 120,000 iterations, AES-GCM, payload in URL | PBKDF2, AES-256-GCM, payload in URL fragment, optional expiry enforced on load |
| URL scheme allowlist for exported hyperlinks | Yes, safeUrl chokepoint, mutation tested | Not audited here |
| Classification gate | Client-side hostname check, documented as guidance, not a control | Marking engine with consistency validation, disclaimer banner retained |
| Vulnerability reporting | Private reporting, one-week acknowledgement target | Private reporting, best effort |
| Licensing exposure | Ships SwiftLaTeX (AGPL-3.0), pdfTeX and Pandoc (GPL-2.0-or-later) as unmodified wasm binaries, documented in THIRD_PARTY_LICENSES.md | MIT tree, two dual-license elections recorded, one MPL-2.0 test-only transitive, LGPL sharp binaries unused at runtime |
| Accessibility of output | Untagged PDF from pdfTeX | Untagged PDF from react-pdf, UI directs screen-reader users to DOCX |

Reading on licensing. A DoD component reviewing DonDocs for hosting will ask about AGPL-3.0 in SwiftLaTeX. The project documents the components as separately invoked binaries, which is the standard defensible position, but it is a legal question SemperScribe does not have to answer.

## 9. Defects and risks found

DonDocs.

- DOCX pipeline limits are structural, documented in docs/KNOWN_ISSUES.md as by design: no signature images, no digital signature fields, unreliable reference hyperlinks, no enclosure merging, page-number position not controllable. A user who needs a signed Word document does the work by hand after export.
- Copy-To and Distribution lists overflow off the page when longer than one page because SwiftLaTeX lacks longtable.
- The default build depends on unpkg.com at build time. Reproduced here: HTTP 403 through a filtering proxy, build exit 1.
- 58 MB Pandoc download on first DOCX export. On a constrained network this is a multi-minute wait with no prior warning beyond the docs.
- Bus factor of one: 94 percent of commits from a single author.
- 27 moderate advisories in the production tree pass the high-only audit gate.
- README drift: states Vite 7 and Node 18 or higher, package.json pins Vite 8 and TypeScript 6, CI runs Node 22.
- Enclosure blobs in IndexedDB have no garbage collection. Removed enclosures leave bytes behind, documented in docs/STORAGE.md.

SemperScribe.

- README headline contradicts SECURITY.md on data egress (section 8).
- No PII scan before PDF or DOCX download, while the benchmark it copied has one.
- One high-severity advisory in the production dependency tree today.
- docs/COMPLIANCE.md cites git tags as evidence. The tags do not exist.
- No versioning, no changelog, no release. A user has no way to say which build they are on when reporting a bug, and there is no issue tracker activity to report to.
- 54 lint warnings suppressed to warning level, mostly setState inside effects.
- JavaScript payload about 2.9x DonDocs.
- The page-parity test hard-failed without LibreOffice, so a contributor without it saw a red suite on first clone. Changed 2026-09-05: it now skips off CI when soffice is absent, and reports the converter's own output when soffice is present but writes nothing.
- 60 files under docs, several stale: docs/README.md still calls the project "Naval Letter Generator," package.json name is naval-letter-generator, the roadmap is dated 2026-02-16.
- Git history rewritten to start at the parity program. Provenance before 2026-07-15 is gone from the repository.

## 10. Fit by user

| User | Better fit | Reason |
|---|---|---|
| Drafter who needs the best-looking naval letter PDF and a matching Word file | DonDocs | pdfTeX typography, 142 shipped fixes, regression corpus from real users |
| S-1 clerk producing AA forms, Page 11s, NJP paperwork, MARADMINs, orders | SemperScribe | DonDocs has none of those families |
| Reviewer or chief kicking back drafts | SemperScribe | review comments and revision compare ride the share link |
| Someone converting a legacy .docx letter into a compliant one | SemperScribe | import parses into fields, DonDocs import exists but is newer and less tested (3 files) |
| Automation or agent pipeline generating letters from JSON | DonDocs | companion HTTP and MCP server, contract-tested |
| Air-gapped host | DonDocs, with staging work | Docker image and Caddy config exist, Pandoc parts must be staged manually. SemperScribe's static export also works but has no container recipe. |
| Compliance reviewer wanting paper artifacts | SemperScribe | SSDF mapping, 508 findings, license elections, with the caveat in section 4 about missing tags |
| Compliance reviewer wanting enforced controls | DonDocs | audit gate, SBOM validation, bundle budget, no-CDN guard, all blocking |
| Team choosing a codebase to extend | DonDocs for letters, SemperScribe for forms | DonDocs has stricter gates and a smaller surface, SemperScribe has the domain rules already encoded |

## 11. Confidence

| Finding | Confidence |
|---|---|
| Provenance and parity relationship | 0.95, read directly from SemperScribe's own plan and first commit |
| Test, lint, typecheck, audit results | 0.95, executed here |
| Bundle and asset sizes | 0.85, DonDocs measured without Pandoc parts, SemperScribe chunk total overstates first load |
| Document type counts | 0.9, counted from schemas.ts and tex/templates |
| PII scan wiring | 0.9, grep of all call sites |
| DOCX limitation list for DonDocs | 0.9, from the maintainer's own known-issues file, not reproduced |
| Output typography quality | 0.5, not rendered side by side in this audit |
| Runtime performance, time to first preview | 0.0, not measured |

Weighted overall confidence 0.86.

## 12. Gaps shared by both

- Neither has an Authority to Operate, RMF package, or accredited CUI handling. Both say so.
- Neither produces tagged PDF, so neither PDF output meets Section 508 for screen readers.
- Neither runs a browser end-to-end test.
- Neither has more than one active maintainer.
- Neither validates output against Microsoft Word's own pagination. SemperScribe uses LibreOffice as a proxy and says so. DonDocs asserts parity through pandoc text extraction.
