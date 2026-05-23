# SemperScribe SBOM Policy

Policy for generating, storing, and refreshing the Software Bill of Materials (SBOM) for SemperScribe.

- Last reviewed: 2026-05-23
- Document version: 1.0
- Policy owner: Project maintainer (solo)

## 1. Scope

This policy covers the SBOM artifact that enumerates the project's production-runtime dependencies. It does not cover the dev-dependency tree, which is excluded from the SBOM via the `--omit dev` flag.

## 2. Format

CycloneDX 1.5 JSON. Selected because.

- CycloneDX is an OWASP-maintained open standard for SBOMs.
- 1.5 is the current major-minor version supported by `@cyclonedx/cyclonedx-npm` at the time of this policy.
- JSON is machine-readable and easy to diff across releases.

The tooling that produces the SBOM is `@cyclonedx/cyclonedx-npm`, declared as a dev dependency in `package.json`. The npm script is `npm run sbom`, defined as:

```
cyclonedx-npm --output-format JSON --output-file sbom.cdx.json --omit dev
```

## 3. Cadence

The SBOM is regenerated on every successful deploy to GitHub Pages. The deploy workflow is `.github/workflows/deploy.yml`. The SBOM step runs in a parallel job named `sbom` so it cannot block the deploy.

Manual regeneration is supported any time via `npm run sbom` at the project root.

## 4. Storage

The SBOM is stored as a GitHub Actions workflow artifact named `sbom-{commit-sha}` with a 90-day retention.

The SBOM file `sbom.cdx.json` is deliberately not committed to the git tree. Rationale.

- The SBOM is reproducible from the lockfile (`package-lock.json`), which is committed.
- A committed SBOM would create merge conflicts on every dependency update.
- The workflow artifact path provides traceability without polluting commit history.

`.gitignore` excludes `sbom.cdx.json` and `sbom.spdx.json` so accidental local generation does not enter commits.

## 5. Access

The workflow artifact is accessible to anyone who can view the public repository at https://github.com/furby203824/SemperScribe/actions.

For a specific commit's SBOM.

1. Navigate to Actions on the repository.
2. Find the workflow run matching the commit SHA.
3. Open the run and download the `sbom-{sha}` artifact from the run summary.

## 6. Refresh Triggers

The SBOM is regenerated on the following triggers.

- Every push to the `main` branch (via the deploy workflow).
- Every manual `workflow_dispatch` of the deploy workflow.
- Any local invocation of `npm run sbom`.

Direct dependency changes (entries added or removed in `package.json` `dependencies`) require human review of the resulting SBOM before merge. Direct dependency review is also a trigger for refreshing the License inventory in `LICENSES.md`.

## 7. Audit Use

An SCA or compliance reviewer requesting the SBOM should be directed to.

- The latest workflow artifact at https://github.com/furby203824/SemperScribe/actions for the current state.
- Specific historical artifacts retained for 90 days per the workflow setting.
- The commit SHA that generated each SBOM is in the artifact name.

For SBOMs older than the 90-day retention window, regenerate from any historical commit via `git checkout {sha} && npm install && npm run sbom`.

## 8. Quality Controls

The CycloneDX output is validated by the tooling itself. The generated SBOM includes.

- Project metadata (name, version, license).
- Component list with package name, version, license, and integrity hash (where available from npm).
- Dependency graph showing parent-child relationships.

The build process aborts if `npm run sbom` fails. The SBOM job in the deploy workflow runs independently of build/deploy and therefore does not block deployment if SBOM generation has a transient issue.

## 9. Compliance References

This policy supports the following authorities.

- Executive Order 14028, "Improving the Nation's Cybersecurity," 12 May 2021, section 4 on SBOM provision.
- OMB Memorandum M-22-18, "Enhancing the Security of the Software Supply Chain through Secure Software Development Practices," September 2022, requiring SBOM as attestation evidence.
- NIST SP 800-218 (SSDF v1.1) practice PW.4.1 example 3, "Obtain provenance information (e.g., SBOM, source composition analysis, binary software composition analysis) for each software component."
- DoD CIO Memorandum, "Accelerating Secure Software and the SWFT Initiative," signed Katherine Arrington, 14 April. Identifies software origin visibility as a SCRM gap that SBOM closes.
- DoD CIO Memorandum, "Software Development and Open Source Software," 24 January 2022, paragraph 2C(3) on dependency analysis.

## 10. Policy Review

This policy is reviewed annually or when the underlying SBOM tooling, format, or storage location changes. The Last reviewed date at the top of this document reflects the most recent review. Substantive revisions also bump the Document version field.
