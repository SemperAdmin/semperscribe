# Compliance posture

SemperScribe is an independent proof of concept maintained on a personal basis. It is not an authorized DoD system, carries no Authority to Operate, and is not under the Risk Management Framework. This page records what the repository does that supports an adoption review, and what it does not claim.

## What the repository does

- **Supply chain.** The deploy workflow generates a CycloneDX SBOM (`npm run sbom`). The test workflow runs `npm audit --omit=dev --audit-level=moderate` on the production dependencies, so a new moderate or higher advisory there fails the run. Dependabot opens weekly update pull requests. Third-party licenses and dual-license elections are in [LICENSES.md](../LICENSES.md).
- **Static analysis.** CodeQL runs on pushes and pull requests to `main` and weekly.
- **Open source.** The project license is MIT ([LICENSE](../LICENSE)).
- **Privacy.** The project has no backend and no telemetry. Text a user types stays in the browser, except what the optional GunnyBot assistant sends when it is used. See the README and the in-app Privacy and Security Notice.
- **Records.** Documents produced with the tool become Federal records under 44 USC 3301 when used in official business. Routing through a command's records manager (MCO 5210.11F) is the user's responsibility.
- **Mapping.** [COMPLIANCE.md](COMPLIANCE.md) maps repository artifacts to NIST SP 800-218 (SSDF) practices and DoD CIO open source guidance.

## What it does not claim

- It is not registered as an Electronic Information System, and it has no RMF authorization.
- It has no CUI authorization of its own. Whether CUI may be entered is a decision for the authorizing official of the system the application runs on (DoDI 5200.48 paragraphs 3.3.c and 3.10.b). Until a command has approved that use, do not enter CUI. Classified information is never permitted.
- PII such as names and EDIPI is accepted at the user's discretion and risk, and any Privacy Act or HIPAA obligation that follows is the user's.
