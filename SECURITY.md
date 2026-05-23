# Security Policy

## Status

SemperScribe is a non-official Proof of Concept (PoC) maintained on a personal basis. It is not official USMC software and carries no Authority to Operate. The repository is governed by the compliance posture documented in `docs/COMPLIANCE_REMEDIATION_PLAN.md`.

## Supported Versions

Only the latest commit on the `main` branch is supported. Older commits, tags, and branches are unsupported.

| Branch | Supported |
|--------|-----------|
| `main` (HEAD) | Yes |
| All other refs | No |

## Reporting a Vulnerability

Use GitHub's private vulnerability reporting workflow. Do not file public issues or pull requests for vulnerabilities.

1. Go to the repository Security tab at https://github.com/furby203824/SemperScribe/security
2. Click "Report a vulnerability"
3. Describe the issue, reproduction steps, affected commit SHA, and any proof-of-concept code

GitHub keeps the report private and only visible to the maintainer until disclosed.

## Response Expectations

This is a personal-time project. No formal Service Level Agreement applies. Reports are reviewed on a best-effort basis. For critical or high-severity findings, expect a response within a reasonable window. Lower-severity findings may be triaged in batch.

Reporters are welcome to escalate publicly after a reasonable disclosure window if no response is received.

## Out of Scope

The following are explicit non-concerns for this PoC.

- Findings against the live GitHub Pages deployment URL (the site is a static export with no backend).
- Findings that require an attacker to first compromise the user's workstation, browser, or local file system.
- Findings against samples in `examples/`, `public/templates/`, and `sample-directive.nldp` which contain only fictional data per the audit pass.
- Two documented residual moderate findings in transitive postcss XSS via CSS stringification, accepted as low-attack-surface per `docs/COMPLIANCE_REMEDIATION_PLAN.md` Phase 3 P3-3.

## In Scope

- Cross-site scripting, prototype pollution, path traversal, or code injection in the active SemperScribe source under `src/`.
- Supply chain integrity findings against direct dependencies in `package.json`.
- Information leakage that would route input data (drafted correspondence content) to any third-party host.
- License compliance gaps in the dependency tree.

## Compliance References

Vulnerability handling for this repository follows.

- DoD CIO Memorandum, "Software Development and Open Source Software," dated 24 January 2022, Attachment 2 paragraph 3F. Vulnerability information about OSS shall be handled at Impact Level 2 in accordance with the DoD Cloud Computing Security Requirements Guide.
- NIST Special Publication 800-218 (SSDF v1.1), practices PW.7 (review and analyze code) and RV.1 (identify and confirm vulnerabilities).
- DoD CIO Memorandum, "Accelerating Secure Software and the SWFT Initiative," dated 14 April. Establishes the rigorous software security verification expectation.

## What This Policy Does Not Promise

- A formal coordinated disclosure process. Add one if and when the PoC moves to a sponsoring DoD Component.
- An ATO, RMF artifacts, or DoD-side accreditation. The PoC is currently outside RMF scope per the compliance plan's analysis.
- That this project is or ever will be safe for processing real CUI, PII, or operational correspondence. The PoC is a format demonstration only.
