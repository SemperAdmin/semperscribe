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

1. Go to the repository Security tab at https://github.com/SemperAdmin/semperscribe/security
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
- Findings against samples in `public/examples/`, `public/templates/`, and `sample-directive.nldp` which contain only fictional data per the audit pass.
- Advisories the CI audit gate already blocks. Every test run executes `npm audit --omit=dev --audit-level=high` against the production tree, and Dependabot files weekly updates for the rest. The two moderate postcss findings recorded in `docs/COMPLIANCE_REMEDIATION_PLAN.md` Phase 3 P3-3 were cleared by the 0.2.0 lockfile refresh; as of 2026-09-05 `npm audit` reports zero advisories in both trees.

## In Scope

- Cross-site scripting, prototype pollution, path traversal, or code injection in the active SemperScribe source under `src/`.
- Supply chain integrity findings against direct dependencies in `package.json`.
- Unintended information leakage that routes input data (drafted correspondence content) to any third-party host, outside the opt-in GunnyBot data flow described below. A GunnyBot code path that transmits content the user did not submit, targets a host the user did not configure, or fires when no key is set remains in scope.
- License compliance gaps in the dependency tree.

## NLDP Data Packages

An `.nldp` export carries the drafter's asserted lifecycle in
`data.directiveMetadata.status`. It is an assertion, not evidence: the
file is plain JSON and anyone can hand-edit it. Treat a package claiming
`signed` or `promulgated` as a claim to be checked, never as proof. The
control lives on the receiving policy-as-data side, where a human
verifies the encoding against the authoritative source before anything
publishes.

The Release export (`.release.nldp`), which carried a SHA-256 of the
signed document and a human affirmation, was withdrawn on 2026-08-20.
The signed artifact never reached the receiving side, so its hash could
not be checked against anything and the gates around it duplicated
validation the ingest side already performs.

Exporting a data package does not change what may be typed into the app.
The CUI warning still governs.

## Headless Companion Surface

The `companion/` directory holds an HTTP server and an MCP stdio server
which render documents outside the browser. Neither ships in the web
application, and neither runs unless an operator starts it.

The HTTP server binds `127.0.0.1` and carries no authentication by
design. Its trust boundary is the loopback interface and the operating
system account it runs under, so anything which reaches the socket
renders documents. `COMPANION_HOST` widens the bind, and a wider bind
publishes an unauthenticated renderer to whatever the new address
reaches. Put a reverse proxy which authenticates the caller in front of
it before widening it. The process prints a warning on startup when the
bind is not loopback. No CORS headers are sent, so a browser page from
another origin is refused the response.

Three controls sit inside the surface. The export sensitive-data scan is
mirrored, so a document with SSN, EDIPI, or clustered PHI hits is refused
with a 422 naming the findings until the caller sets
`acknowledgeSensitive`. File writes happen only under
`COMPANION_OUT_DIR`, resolved through realpath before the confinement
check, so traversal, absolute paths, planted symlinks, and symlinked
subdirectories are refused. Request bodies are capped at two megabytes
and each operation is bounded by a forty five second timer.

A path traversal, an injection, or a confinement bypass in `companion/`
is in scope for a report on the same terms as `src/`. The absence of
authentication on a loopback listener is the documented design and is
not a finding. See [`docs/COMPANION.md`](docs/COMPANION.md).

## Third-Party Data Flow (GunnyBot)

SemperScribe includes an optional assistant, GunnyBot, disabled until the user supplies a personal LLM provider API key. When enabled and used, GunnyBot sends the text the user submits to it (a typed question, a draft paragraph, or the document body for a review) directly from the browser to the user-chosen provider (Google or GenAI.mil), under the user's own key. The provider processes that text under the provider's own terms, outside SemperScribe's control. The key is held in browser session memory only, clears when the tab closes, and is never written to disk or sent to any SemperScribe-controlled host. This is an opt-in, user-controlled data flow, documented in the Privacy and Security Notice. The application applies no attestation or content filtering before sending, so the user is solely responsible for not submitting CUI, PII, or classified text to GunnyBot. This intentional flow is not an information-leakage defect. See In Scope above for the GunnyBot behavior that remains reportable.

## Compliance References

Vulnerability handling for this repository follows.

- DoD CIO Memorandum, "Software Development and Open Source Software," dated 24 January 2022, Attachment 2 paragraph 3F. Vulnerability information about OSS shall be handled at Impact Level 2 in accordance with the DoD Cloud Computing Security Requirements Guide.
- NIST Special Publication 800-218 (SSDF v1.1), practices PW.7 (review and analyze code) and RV.1 (identify and confirm vulnerabilities).
- DoD CIO Memorandum, "Accelerating Secure Software and the SWFT Initiative," dated 14 April. Establishes the rigorous software security verification expectation.

## What This Policy Does Not Promise

- A formal coordinated disclosure process. Add one if and when the PoC moves to a sponsoring DoD Component.
- An ATO, RMF artifacts, or DoD-side accreditation. The PoC is currently outside RMF scope per the compliance plan's analysis.
- That this project is or ever will be safe for processing real CUI, PII, or operational correspondence. The PoC is a format demonstration only.
