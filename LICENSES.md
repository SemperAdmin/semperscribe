# Third-Party License Inventory and Elections

This document records the licenses governing SemperScribe and its dependency tree. It exists alongside `LICENSE` (the legal text for SemperScribe itself) to give compliance reviewers a single audit-friendly artifact.

## Project License

SemperScribe is released under the MIT License. See `LICENSE` at the repository root for the legal text.

## Policy Basis

License selection and dependency licensing for this project follow the DoD Chief Information Officer Memorandum titled "Software Development and Open Source Software," dated 24 January 2022, Attachment 2 paragraph 3G:

> DoD programs releasing code as OSS may use any of the following licenses, which have been shown to be acceptable for DoD use: Apache-2.0, BSD, GPL, LGPL, and MIT licenses. Component CIOs may grant permission to use other licenses if required.

MIT is on the approved-without-action list.

## Dual-License Elections

Two transitive dependencies are dual-licensed. The project elects the permissive option in each case.

| Package | Available | Elected | Rationale |
|---------|-----------|---------|-----------|
| jszip | MIT OR GPL-3.0-or-later | MIT | Avoids GPL copyleft propagation. Permissive option aligns with the MIT project license. |
| expand-template | MIT OR WTFPL | MIT | Avoids WTFPL, which is not on the OSS Guidance paragraph 3G approved-without-action list and would require Component CIO sign-off if elected. |

## LGPL-3.0-or-later Transitives

The `sharp` image library family ships with LGPL-3.0-or-later binaries (libvips bindings). LGPL-3 is explicitly approved by OSS Guidance paragraph 3G.

LGPL-3.0-or-later packages currently in the dependency tree.

- @img/sharp-libvips-darwin-arm64
- @img/sharp-libvips-darwin-x64
- @img/sharp-libvips-linux-arm
- @img/sharp-libvips-linux-arm64
- @img/sharp-libvips-linux-ppc64
- @img/sharp-libvips-linux-riscv64
- @img/sharp-libvips-linux-s390x
- @img/sharp-libvips-linux-x64
- @img/sharp-libvips-linuxmusl-arm64
- @img/sharp-libvips-linuxmusl-x64
- @img/sharp-wasm32 (Apache-2.0 AND LGPL-3.0-or-later AND MIT compound)
- @img/sharp-win32-arm64 (Apache-2.0 AND LGPL-3.0-or-later compound)
- @img/sharp-win32-ia32 (Apache-2.0 AND LGPL-3.0-or-later compound)
- @img/sharp-win32-x64 (Apache-2.0 AND LGPL-3.0-or-later compound)

These are dynamically linked binary distributions. Standard practice for LGPL compliance with dynamically linked libraries.

Note. sharp is pulled in transitively by Next.js for image optimization. The project sets `images.unoptimized: true` in next.config.ts, which means sharp is not exercised at runtime. The packages are installed but unused.

## MPL-2.0 Transitive

One package carries Mozilla Public License 2.0.

| Package | License | Source |
|---------|---------|--------|
| axe-core | MPL-2.0 | Dependency of the direct devDependency @axe-core/playwright (the e2e accessibility scan); also reached transitively through eslint-config-next via eslint-plugin-jsx-a11y |

MPL-2.0 is not on the OSS Guidance paragraph 3G approved-without-action list. Per the same paragraph, "Component CIOs may grant permission to use other licenses if required." If the PoC moves to a sponsoring DoD Component, expect to seek that approval.

axe-core is a testing-only dependency. It does not ship in the production bundle.

## Compound-License Transitives Worth Noting

These compound licenses are present but resolve cleanly under their permissive components.

| Package | License |
|---------|---------|
| @img/sharp-wasm32 | Apache-2.0 AND LGPL-3.0-or-later AND MIT |
| @img/sharp-win32-* | Apache-2.0 AND LGPL-3.0-or-later |

Each component is independently approved per OSS Guidance paragraph 3G.

## License Family Summary

Approximate breakdown of the dependency tree by primary license.

| Family | Approval Status |
|--------|-----------------|
| MIT | Approved without action |
| Apache-2.0 | Approved without action |
| BSD-2-Clause, BSD-3-Clause | Approved without action |
| ISC | Functionally equivalent to MIT, approved |
| LGPL-3.0-or-later | Approved without action |
| MPL-2.0 | Requires Component CIO approval for DoD release |
| WTFPL | Avoided via dual-license election |
| GPL-3.0-or-later | Avoided via dual-license election (jszip) |

## How to Refresh This Inventory

Run from the repo root.

```
npm install
npm ls --all --long > licenses-tree.txt
```

Or use a dedicated tool.

```
npx license-checker --summary
```

For an SBOM that includes license fields, see the planned P3-2 cyclonedx-npm integration in `docs/COMPLIANCE_REMEDIATION_PLAN.md`.

## Maintainer Responsibilities

- Re-run the inventory whenever direct dependencies change.
- Surface any new copyleft or non-approved license discoveries for review before the affected commit lands.
- If sharp's transitive role changes from unused to actively exercised, re-evaluate the LGPL distribution obligations.
- If axe-core moves from dev to runtime dependency, escalate the MPL-2.0 review.

## Compliance References

- DoD CIO Memorandum, "Software Development and Open Source Software," 24 January 2022, Attachment 2 paragraph 3G.
- DoD CIO Memorandum, "Accelerating Secure Software and the SWFT Initiative," 14 April. Visibility into the origins of code is a SCRM expectation.
- NIST SP 800-218 (SSDF v1.1), practices PW.4.1 and PW.4.4 on managing third-party software components.
