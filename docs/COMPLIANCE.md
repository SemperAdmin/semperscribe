# SemperScribe Compliance Mapping

Auditor-friendly mapping of project artifacts to NIST SP 800-218 (SSDF v1.1) practices and DoD CIO OSS Guidance paragraphs. This document is the single-page reference for an SCA or compliance reviewer.

- Last reviewed: 2026-05-23
- Document version: 1.0
- Repo: https://github.com/SemperAdmin/semperscribe
- Posture: Non-official PoC pursuing voluntary alignment with DoD adoption-readiness standards. No ATO. Not under RMF scope.

## NIST SP 800-218 (SSDF v1.1) Mapping

### PO. Prepare the Organization

| Practice | Description | SemperScribe Response | Artifact |
|----------|-------------|----------------------|----------|
| PO.1.1 | Identify and document security requirements | Compliance plan defines security work scope | `docs/COMPLIANCE_REMEDIATION_PLAN.md` |
| PO.1.3 | Communicate requirements to third parties | N/A for a personal PoC with no third-party developers | None required |
| PO.2.1 | Create roles and responsibilities | Solo maintainer documented in SECURITY.md | `SECURITY.md` |
| PO.2.2 | Provide role-based training | N/A solo project | None required |
| PO.3.2 | Follow recommended security toolchain practices | TypeScript strict, ESLint, Node version pinned | `tsconfig.json`, `eslint.config.mjs`, `.nvmrc` |
| PO.3.3 | Configure tools to generate artifacts that satisfy security requirements | SBOM generation, CodeQL findings, type-check enforcement | `.github/workflows/deploy.yml`, `.github/workflows/codeql.yml`, `next.config.ts` |
| PO.4.1 | Define criteria for software security checks | Build must pass, npm audit zero high+critical, CodeQL surfaces clean | `docs/COMPLIANCE_REMEDIATION_PLAN.md` Phase 3 |
| PO.5.1 | Separate and protect environments | Production strips console output, dev vs prod basePath, no shared backend | `next.config.ts` compiler.removeConsole |

### PS. Protect the Software

| Practice | Description | SemperScribe Response | Artifact |
|----------|-------------|----------------------|----------|
| PS.1.1 | Store code securely | GitHub repository, contributor model | https://github.com/SemperAdmin/semperscribe |
| PS.2.1 | Provide software integrity verification | Git commit SHA hashes, CycloneDX SBOM with hashes | `npm run sbom` output, GitHub commit signatures |
| PS.3.1 | Securely archive necessary files | Git tags including `baseline-pre-compliance` and `pre-p2-2-orphan-removal` | `git tag -l` |
| PS.3.2 | Collect, safeguard, and share provenance data | SBOM artifact uploaded on every deploy, retained 90 days | Workflow artifact `sbom-{sha}` |

### PW. Produce Well-Secured Software

| Practice | Description | SemperScribe Response | Artifact |
|----------|-------------|----------------------|----------|
| PW.1.1 | Use threat modeling | Compliance plan stress-tested against 12 uploaded DoD policies | `docs/COMPLIANCE_REMEDIATION_PLAN.md` |
| PW.4.1 | Acquire well-secured third-party components | License inventory, SBOM, npm overrides for known issues | `LICENSES.md`, `package.json` overrides |
| PW.4.4 | Verify acquired components comply with requirements | `npm audit` reports zero findings as of last verification | `npm audit` |
| PW.6.2 | Configure compilers and toolchains to minimize vulnerabilities | TypeScript strict, build error checking on | `next.config.ts`, `tsconfig.json` |
| PW.7.1 | Determine if code review is needed | Solo project; static analysis substitutes | `.github/workflows/codeql.yml` |
| PW.7.2 | Perform code review | CodeQL security-extended + security-and-quality query suites | CodeQL Security tab |
| PW.8.1 | Determine if testing is needed | Yes, build pipeline executes type check and static analysis | `npm run build`, CodeQL |
| PW.9.1 | Configure with secure defaults | UNCLASSIFIED-only banner, no-CUI warning, no telemetry | `ModernAppShell.tsx`, `next.config.ts` |
| PW.9.2 | Communicate secure default configuration | Documented in /privacy and README | `src/app/privacy/page.tsx`, `README.md` Compliance Posture |

### RV. Respond to Vulnerabilities

| Practice | Description | SemperScribe Response | Artifact |
|----------|-------------|----------------------|----------|
| RV.1.1 | Gather information from purchasers and others | GitHub Private Vulnerability Reporting | `SECURITY.md` |
| RV.1.2 | Review and triage vulnerabilities | Best-effort response documented in SECURITY.md | `SECURITY.md` |
| RV.1.3 | Have a vulnerability disclosure program | SECURITY.md establishes the program | `SECURITY.md` |
| RV.2.1 | Analyze each vulnerability | Manual triage by maintainer per SECURITY.md | `SECURITY.md` |
| RV.2.2 | Develop and release security advisories | Via GitHub Security Advisories when applicable | GitHub Security tab |
| RV.3.1 | Identify root cause and remediate | Tracked in compliance plan when an audit pass is needed | `docs/COMPLIANCE_REMEDIATION_PLAN.md` |

## DoD CIO OSS Guidance Mapping

Reference: DoD CIO Memorandum, "Software Development and Open Source Software," dated 24 January 2022.

| Paragraph | Topic | SemperScribe Response |
|-----------|-------|----------------------|
| 2A | Adopt, Buy, Create approach | Project is original code; not adopting existing solutions wholesale. Voluntary alignment for future-pathing. |
| 2C(1) | Long-term support assessment | N/A; personal PoC without DoD program manager. |
| 2C(2) | Trusted sources | All deps installed from npmjs.org via package-lock.json. CodeQL flags suspicious transitives. |
| 2C(3) | Dependencies | SBOM enumerates the full tree. Overrides applied for known issues. |
| 2C(4) | Component security | CodeQL static analysis, npm audit, dependency provenance via SBOM. |
| 2C(5) | Component integrity | Git commit SHAs, signed tags where applicable, SBOM with hashes. |
| 2C(6) | Foreign government influence | No known foreign-government influence on direct dependencies. Out-of-scope analysis for transitives. |
| 2D | License conformance | MIT license elected for project. All transitives within OSS Guidance paragraph 3G approved set. See LICENSES.md. |
| 3C | Open source release | Project hosted public on GitHub. License is MIT (approved). Distribution channel is GitHub, not code.mil. Future migration to code.mil out-of-scope for the PoC. |
| 3D | Distribution Statements | The project source is treated as Distribution Statement A equivalent (public release). Tool outputs are user-marked. |
| 3F | Vulnerability handling at Impact Level 2 | SECURITY.md documents the disclosure channel and handling expectations. |
| 3G | Approved licenses | MIT (project), LGPL-3 (sharp transitives), Apache-2.0, BSD, ISC. All on the approved-without-action list. WTFPL avoided via dual-license election. MPL-2.0 (axe-core, dev-only) flagged for Component CIO approval if PoC moves to release. |

## DoD CIO SWFT Initiative

Reference: DoD CIO Memorandum, "Accelerating Secure Software and the SWFT Initiative," signed Katherine Arrington, 14 April.

| Initiative Element | SemperScribe Response |
|--------------------|----------------------|
| Cybersecurity and SCRM requirements | SSDF practice mapping (this document), license inventory (LICENSES.md), SBOM (deploy workflow) |
| Software security verification processes | CodeQL static analysis, npm audit, TypeScript strict, build verification on every commit |
| Secure information sharing | GitHub Private Vulnerability Reporting (SECURITY.md) |
| Federal Government-led risk determinations | N/A; PoC outside any Federal sponsorship today |

## Out-of-Scope Items (explicit)

The following are deliberately not addressed by this compliance posture.

- RMF Authorization to Operate. Not applicable to a personal PoC. Reference DoDI 8510.01 paragraph 1.1.
- DoDIN Cybersecurity. Reference DoDI 8530.01. Out of scope until the PoC connects to the DoDIN.
- CUI Program. Reference DoDI 5200.48. The PoC does not process CUI by design. User responsibility for not entering CUI.
- USMC Privacy Program. Reference MCO 5211.5. The PoC does not collect or maintain a system of records.
- Marine Corps Records Management Program. Reference MCO 5210.11F. Tool outputs become records when used in official business; the tool itself is not an EIS.
- DoD Insider Threat Program. Reference DoDI 5205.16. Out of scope for the artifact; in scope for the maintainer if they hold DoD access.
- Marine Corps Cybersecurity (MCEN). Reference MCO 5239.2B. Out of scope until the PoC connects to MCEN.
- IT Portfolio Management. Reference MCO 5230.21. Out of scope for a non-investment personal PoC.

## Audit Trail

Every compliance-relevant change since the audit started is recorded in `docs/COMPLIANCE_REMEDIATION_PLAN.md` and the git commit history. Pre-compliance baseline is tagged `baseline-pre-compliance` at SHA `4561cf5531696e8407082f5c8cf77854ce6e1dc3`.

## Refresh Cadence

- This mapping document. Reviewed when material policy or architecture changes occur. Last reviewed date and document version at top.
- SBOM. Regenerated on every deploy via `.github/workflows/deploy.yml`.
- CodeQL. Runs on every push and weekly on Monday.
- npm audit. Reviewed when dependencies change. Manual `npm audit` produces the current state.
- License inventory in LICENSES.md. Reviewed when direct dependencies change.
