# SemperScribe Compliance Remediation Plan

Target posture. PoC primed for future DoD adoption.
Baseline. main at 4561cf5 (2026-04-25), cloned from https://github.com/furby203824/SemperScribe.
Branch strategy on record. Direct to main (stress-test note below).
EDMS path. Delete entirely.
Public hosting. Keep github.io after hardening, not before.

## Stress-test note on the branch strategy choice

You chose direct-to-main. Counter-argument on record. Direct-to-main on a compliance hardening pass eliminates the only review surface you have. A single bad commit on layout.tsx or supabase deletion poisons the deployment, and github.io serves a broken or leaky page until the next push. Recommendation, hold the choice for low-risk phases (Phase 1, Phase 6) and switch to a short-lived branch for Phase 2 and Phase 3 where build behavior changes. You retain the right to override.

## Pre-flight, before any code changes

PRE-1. Fix the .git/config defect. The current file has a bad line 12 (trailing whitespace or null bytes). From your terminal:

- Open D:\Coding\SemperScribe\.git\config in a plain editor.
- Strip the trailing blank lines and any non-ASCII bytes after the last bracket section.
- Save as ASCII or UTF-8 without BOM.
- Confirm with `git status` returning normally.

PRE-2. Tag the baseline before changes. Once git is healthy:

```
git tag -a baseline-pre-compliance -m "Baseline before compliance hardening, audit pass 2026-05"
git push origin baseline-pre-compliance
```

PRE-3. Remove the empty local-only folders. `rmdir src\app\api src\app\directives`. Both are empty. They are leftovers from prior local work.

PRE-4. Confirm the head SHA matches the baseline manifest. `git rev-parse HEAD` must return `4561cf5531696e8407082f5c8cf77854ce6e1dc3`.

## Phase 1. OpSec bleed removal. Highest priority

Goal. Cut every outbound data path the PoC takes without explicit user action. Maps to OPSEC PAM 5510, NIST 800-53 SC-7 and AU-12, FISMA 44 USC 3554, MCO 5211.5.

P1-1. Delete the Supabase backend.

- Delete supabase\ directory in full.
- Delete src\lib\edms-service.ts.
- Delete src\hooks\useEDMSContext.ts.
- Delete src\components\EDMSLinkBadge.tsx.
- Delete src\components\ReturnToEDMSDialog.tsx.
- Remove all EDMS imports and code paths from src\app\page.tsx.
- Remove the supabaseUrl, supabaseKey, edmsId URL parameter handling.
- Acceptance. `grep -ri "edms\|supabase" src\` returns zero hits.

P1-2. Delete the countapi.xyz telemetry.

- Delete src\hooks\useStats.ts.
- Delete src\components\StatsDisplay.tsx.
- Remove every import and call site for incrementDocumentCount, incrementSaveCount, incrementLoadCount.
- Acceptance. `grep -ri "countapi\|useStats\|StatsDisplay" src\` returns zero hits.

P1-3. Rewrite sample-directive.nldp.

- Replace From, To, sponsor_code, ssic_code, sig fields with fictional values.
- Use unit name TRAINING DEMO COMMAND, SSIC 0000, sponsor TD-1, signature D. E. MO-USER.
- Replace MCO 1553.4B and MCRP 3-0A references with fictional placeholders like SAMPLE-1, SAMPLE-2.
- Acceptance. `grep "Commandant of the Marine Corps" sample-directive.nldp` returns zero hits.

P1-4. Audit all examples\ and public\templates\ files for the same impersonation pattern.

- Iterate every .nldp file in public\templates\.
- Replace any real CMC, SECNAV, real-unit references with fictional placeholders.
- Acceptance. `grep -ri "Commandant of the Marine Corps\|Secretary of the Navy" public\templates examples` returns zero hits.

## Phase 2. External asset self-hosting

Goal. Eliminate all third-party fetches. Maps to DSOP Reference Design immutable infrastructure, NIST 800-218 PO.5.1, NIST 800-53 SI-7.

P2-1. Self-host Roboto and Bebas Neue.

- Download .woff2 files for Roboto 400, 500, 700 and Bebas Neue Regular.
- Place under public\fonts\.
- Add an @font-face block in src\app\globals.css pointing at the local files.
- Acceptance. Build output `out\` contains no reference to fonts.googleapis.com or fonts.gstatic.com.

P2-2. Replace Font Awesome with lucide-react.

- lucide-react is already in package.json at version 0.525.0.
- Grep src\ for `fa-` and `font-awesome` class names. Map each to a lucide icon.
- Remove the cdnjs Font Awesome link tag from src\app\layout.tsx.
- Acceptance. `grep -ri "fa-\|font-awesome\|cdnjs" src\` returns zero hits.

P2-3. Remove the placehold.co fallback.

- Edit src\lib\dod-seal-base64.tsx line 318. Replace the fetch with a local public\seals\dod-seal-placeholder.png served from the bundle.
- Acceptance. `grep -r "placehold.co" src\` returns zero hits.

P2-4. Update src\app\layout.tsx.

- Remove the four external `<link>` tags (preconnect, googleapis, gstatic, cdnjs).
- Add no replacements other than the local CSS import.
- Acceptance. The rendered HTML head contains only relative URLs.

## Phase 3. Build assurance and SSDF readiness

Goal. Generate provenance artifacts on every release. Maps to NIST 800-218 PO.3.3, PW.4.1, PW.4.4, SWFT Initiative directive.

P3-1. Re-enable type checks.

- Edit next.config.ts. Set `typescript.ignoreBuildErrors` to `false`.
- Run `npm run build`. Fix every type error in turn.
- Acceptance. Build passes with type checking on.

P3-2. Add SBOM generation.

- Install dev dep: `npm install --save-dev @cyclonedx/cyclonedx-npm`.
- Add an npm script: `"sbom": "cyclonedx-npm --output-file sbom.cdx.json"`.
- Edit .github\workflows\deploy.yml to run `npm run sbom` and upload sbom.cdx.json as a release artifact.
- Acceptance. Each deploy run produces sbom.cdx.json in the workflow artifacts.

P3-3. Lock down deprecated and risky transitives.

- Add to package.json:
  ```
  "overrides": {
    "inflight": "npm:lru-cache@^11.0.0",
    "glob": "^10.0.0"
  }
  ```
- Run `npm install` then `npm audit`.
- Acceptance. `npm audit` reports zero high or critical findings. `npm ls inflight` shows the lru-cache replacement.

P3-4. Trace and decide on sharp.

- Run `npm ls sharp` to find the parent.
- If next.js pulls it for image optimization, add `"sharp": false` override or pin Next.js to a version where sharp is optional.
- Acceptance. `npm ls sharp` returns nothing or only an explicitly elected version.

P3-5. Strip console output from production builds.

- Edit next.config.ts. Add `compiler: { removeConsole: { exclude: ['error'] } }`.
- Acceptance. Built bundle contains no `console.log` calls.

P3-6. Add SECURITY.md.

- Document the disclosure channel.
- Reference DoD CIO OSS Guidance paragraph 3F.
- Include response time targets.

P3-7. Add LICENSES.md.

- Document the project license (proposed: MIT or Apache-2.0).
- Elect MIT for jszip dual license.
- List the LGPL transitive set (sharp libvips) and the elected runtime license.
- Reference DoD CIO OSS Guidance paragraph 3G.

P3-8. Pin Node version.

- Add .nvmrc with `20.x`.
- Confirm .github\workflows\deploy.yml uses the same version. The file currently has `node-version: '20'`. Good.

## Phase 4. UI compliance surface

Goal. Add the markers a Marine reviewing the tool will look for. Maps to DoDI 5200.48 CUI marking, 44 USC 3301 records disclaimer, MCO 5211.5.

P4-1. Add a persistent CUI banner.

- Edit src\components\layout\ModernAppShell.tsx.
- Insert a top banner reading: "Warning. Non-official Proof of Concept. Do not enter CUI, PII, or other sensitive information. Outputs constitute Federal records under 44 USC 3301 when used in official business. Route through your CDRM." Framing emphasizes user responsibility, not system CUI handling capability.
- Banner must be visible on every route.
- Acceptance. Visual test on every page shows the banner.

P4-2. Add a Privacy and Security Notice route.

- Create src\app\privacy\page.tsx.
- Content. Disclaim collection of PII, document the absence of telemetry after Phase 1, cite SECNAVINST 5211.5F paragraph 5b.
- Link from the persistent banner.

P4-3. Enforce distribution-statement selection on export.

- Edit src\app\Step7Distribution.tsx.
- Block the export action until a distribution statement is chosen.
- Acceptance. Cypress or Vitest UI test confirms export button stays disabled with no selection.

P4-4. Update README.md.

- Remove the live github.io URL until Phase 2 is complete.
- Add a "Compliance Posture" section citing the OSS Guidance and SSDF references.
- Add a "Not Official USMC Software" disclaimer at the top.

## Phase 5. Documentation artifacts

Goal. Pre-build the artifacts an RMF SCA will ask for. Maps to DoDI 8510.01 RMF Steps 1-2 and DoDI 5000.82 paragraph 1.1.

P5-1. docs\COMPLIANCE.md.

- Map each NIST SSDF practice (PO, PS, PW, RV) to the file in the repo that satisfies it or the open gap.
- Map each DoD CIO OSS Guidance paragraph (2A, 2C, 3C, 3F, 3G) to the project's response.
- One page maximum. Keep it auditor-friendly.

P5-2. docs\RMF_READINESS.md.

- Pre-draft of the System Categorization step. Recommend Low-Low-Low under FIPS 199 given absence of PII or CUI after Phase 1.
- Pre-draft control selection summary against the NIST 800-53 Low baseline.
- Pre-draft network boundary diagram: github.io static SPA, no backend.

P5-3. docs\SBOM_POLICY.md.

- Cadence. SBOM generated on every release.
- Format. CycloneDX 1.5 JSON.
- Storage. Workflow artifact, plus committed copy at sbom\latest.cdx.json.

P5-4. docs\PRIVACY_POSTURE.md.

- Statement of facts. App processes user-entered data in the browser only.
- After Phase 1, no outbound transmission of user data.
- Cite Privacy Act 5 USC 552a(e)(10).

## Phase 6. Verification gate

Goal. Prove every Phase passed before announcing readiness. No phase advances without these checks.

V-1. Grep audit.

```
grep -ri "supabase\|edms\|countapi\|placehold.co\|fonts.googleapis\|fonts.gstatic\|cdnjs.cloudflare" src public examples
```

Expected output. Zero matches.

V-2. Build and type check.

```
npm install
npm run build
```

Expected output. Build completes with type checking enabled, no errors.

V-3. Test suite.

```
npm run test
```

Expected output. All passing. New tests required for the CUI banner presence and distribution-statement enforcement.

V-4. SBOM.

```
npm run sbom
```

Expected output. sbom.cdx.json produced, contains at least one component entry per direct dependency.

V-5. Audit.

```
npm audit --omit=dev
```

Expected output. Zero high or critical findings.

V-6. Network trace.

- Build the app, serve out\ locally, load in a fresh browser profile with DevTools Network panel open.
- Expected output. Zero requests to external hosts other than the same origin.

V-7. Visual compliance.

- Confirm CUI banner present on every route.
- Confirm Privacy notice route loads.
- Confirm sample directive shows fictional data only.

## Out-of-scope items (explicit)

- Anything requiring access to an AO or DoD-side sponsor. The plan stops at PoC-grade readiness for future submission.
- ATO-grade artifacts. The plan produces pre-draft RMF artifacts only.
- Code.mil migration. Schedule separately once a sponsoring Component CIO is identified.
- Hosted backend storage. Removed by Phase 1 and not added back.

## Confidence

- Phase scope and file paths. 0.93. Each task points at a confirmed file or directory in the baseline.
- Acceptance criteria. 0.92. Each is observable and falsifiable.
- Sequencing. 0.88. Phase 2 has a dependency on Phase 1 only because the layout.tsx external link removal is cleaner without the EDMS banner code mixed in. Phase 3 type-error fixes may surface new work not yet visible.

Weighted total. 0.91.

## Rollback

If any phase produces a regression that blocks github.io rendering:

```
git checkout baseline-pre-compliance -- <file path>
```

Restores the single offending file from the tagged baseline. Full rollback:

```
git reset --hard baseline-pre-compliance
```

## Recommended execution order

1. Pre-flight (PRE-1 through PRE-4). Required.
2. Phase 1. Highest value per line of code changed. Low risk.
3. Phase 6 sample asset rewrite is folded into P1-3 and P1-4.
4. Phase 2. Moderate risk, build-impacting.
5. Phase 3. High risk, build-impacting. Stage on a branch even though you chose direct-to-main for the rest.
6. Phase 4. UI surface, low risk.
7. Phase 5. Documentation only, no risk.
8. Verification gate after each phase, not just at the end.
