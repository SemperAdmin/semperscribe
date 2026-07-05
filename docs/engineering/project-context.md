# Shared Context Block — Semper Scribe

Filled per `docs/engineering/prompt-library.md`. Prepend this block to any mode
invocation from the prompt library. Evidence tiers: VERIFIED items were read
from the repository; ASSUMED items need confirmation from the maintainer.

```
PROJECT CONTEXT
Stack: TypeScript 5.9.3, Next.js ^16.1.5 (static export, output:'export' in
  production), React 18.3.1, Tailwind CSS 3.4.14, Zustand 5.0.10, Zod 4.3.6,
  @react-pdf/renderer 4.3.2 / pdf-lib 1.17.1 (PDF), docx 8.5.0 (DOCX),
  mammoth 1.12.0 + pdfjs-dist 4.8.69 (import), Vitest 4. No database — all
  persistence is browser localStorage plus lz-string share links. [VERIFIED:
  package.json, next.config.ts]
Deployment target: GitHub Pages (basePath /semperscribe) with a secondary
  cloud.gov target (DEPLOY_TARGET=cloudgov, no basePath). Static hosting only;
  no server runtime. [VERIFIED: next.config.ts]
Load profile: Client-side only — every "request" is a local browser
  interaction; concurrency is one user per browser tab. Server load is static
  file serving by GitHub Pages. Data volume per user: individual documents
  (letters/orders), bounded by localStorage quota (~5 MB). [VERIFIED:
  architecture; user counts ASSUMED unknown — public POC, no telemetry]
Data sensitivity: None by policy — README and SECURITY.md direct users not to
  enter CUI/PII; app is an unofficial proof of concept with no ATO. In
  practice users type correspondence content that stays in their browser.
  [VERIFIED: README.md warning block]
Team: Single maintainer (SemperAdmin) on a personal basis, with AI-assisted
  contributions via PRs. [INFERRED: commit history, README "maintained on a
  personal basis"]
Non-goals: No backend, no accounts, no telemetry, no server-side processing,
  no handling of CUI/PII, not official USMC/DoD software. [VERIFIED: README]
Acceptance criteria: Exported documents conform to SECNAV M-5216.5 and
  MCO 5215.1K formatting (golden-diff tests in tests/golden); `npm test`
  passes; production build exports statically and serves correctly under the
  /semperscribe basePath. [VERIFIED: package.json scripts, README, tests/]
```
