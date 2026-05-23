# SemperScribe Privacy Posture

Auditor-facing privacy posture statement. Complements the user-facing Privacy and Security Notice at `src/app/privacy/page.tsx` (rendered at the `/privacy` route).

- Last reviewed: 2026-05-23
- Document version: 1.0
- User-facing notice: https://furby203824.github.io/SemperScribe/privacy

## 1. Statement of Facts

SemperScribe processes only data the user enters or imports into the in-browser form. All processing occurs locally within the user's web browser. The application performs no server-side processing of user input. After Phase 1 of the compliance remediation pass (commits 01237ec, 354c2a4), the application emits zero outbound transmissions of user data at runtime.

## 2. Architectural Privacy Controls

The privacy posture is enforced by architecture, not by policy alone.

| Control | Mechanism | Evidence |
|---------|-----------|----------|
| No backend processing | Static export via Next.js `output: 'export'` | `next.config.ts` |
| No runtime telemetry | countapi.xyz beacons removed in P1-2 | commit `354c2a4` |
| No EDMS or external storage | Supabase integration removed in P1-1 | commit `01237ec` |
| No third-party CDN at runtime | Fonts via `next/font/google` build-time self-host, Font Awesome removed | commit `01463dd`, deletion of `dod-seal-base64.tsx` |
| No analytics or tracking | StatsDisplay deleted in P1-2 | commit `354c2a4` |
| No external image fetches | placehold.co fetch replaced with local DOD seal | commit `02949fc` |
| Local-only persistence | Browser `localStorage` only, scoped to same-origin | `useUserProfile.ts`, `storage-utils.ts` |
| Production console stripped | Diagnostic logs removed from production bundle | `next.config.ts` `compiler.removeConsole` |

After the compliance pass, no code path in the active source contacts any third-party host at runtime. Verifiable by `grep -ri "fetch.*https://" src/` returning only same-origin or build-time fetches.

## 3. Information Handling Categories

| Category | Processed by SemperScribe? | Notes |
|----------|-----------------------------|-------|
| Personally Identifiable Information (PII) | No, by design. | User responsibility not to enter. Banner and Privacy Notice surface this. |
| Controlled Unclassified Information (CUI) | No, by design. | User responsibility not to enter. Reference DoDI 5200.48. |
| Protected Health Information (PHI) | No. | Not applicable to USMC correspondence drafts. |
| Classified information | No. | Public unclassified system. |
| Government records (post-creation) | Output only, not stored | User responsibility per 44 USC 3301 and MCO 5210.11F. |

## 4. Privacy Act of 1974 Posture

The Privacy Act of 1974 (5 USC 552a) applies to a "system of records," defined in subsection (a)(5) as a group of records under agency control retrieved by an individual identifier.

SemperScribe does not maintain a system of records.

- The application has no database, no backend, no persistent storage beyond the user's own browser.
- Browser `localStorage` is not a Federal record system. It is user-controlled local storage, equivalent to a temp file on the user's workstation.
- No retrieval mechanism by individual identifier exists or could exist absent a backend.

Accordingly, the Privacy Act's substantive requirements (notice, accuracy, security, accounting, redress) do not directly bind the application as operated.

5 USC 552a(e)(10) requires appropriate administrative, technical, and physical safeguards. The application's safeguards are architectural (no backend, no telemetry, no PII collection). These exceed the (e)(10) baseline by removing the data-handling surface entirely.

If a user enters real PII into the form fields, the user assumes any resulting Privacy Act obligations personally. The application does not provide a safe harbor for such use.

## 5. SECNAVINST 5211.5F Mapping

SECNAVINST 5211.5F, DON Privacy Program, dated 20 May 2019, paragraph 5b requires that PII maintained by or for the DON be relevant, collected directly, maintained per authority, covered by a SORN, reviewed annually, protected from unauthorized access, and safeguarded with appropriate controls.

SemperScribe does not collect or maintain PII on behalf of the DON. None of paragraph 5b applies as a binding obligation. The architectural posture nonetheless mirrors the controls.

- Relevance. The application does not collect or retain data at all. No relevance assessment is required.
- Direct collection. N/A; user enters or imports their own draft text.
- Authority. N/A; no PII processed.
- SORN coverage. N/A; no system of records.
- Annual review. This document and the Privacy Notice are reviewed per the Refresh Cadence section in `docs/COMPLIANCE.md`.
- Unauthorized access protection. Same-origin policy of the browser. HTTPS via GitHub Pages.
- Safeguards. Browser-level controls plus the architectural decisions documented above.

## 6. MCO 5211.5 Mapping

MCO 5211.5, USMC Privacy Program, dated 28 August 2024, paragraph 5b on PII protection. SemperScribe does not handle PII. The MCO 5211.5 obligations attach to USMC personnel handling PII, not to a personal PoC that processes no PII. The user-responsibility framing in the in-app banner and Privacy Notice reinforces this.

## 7. Browser Storage Disclosure

The application uses browser `localStorage` for the following user-controlled functions only.

- Draft persistence between sessions (the user's own draft letters and forms).
- User profile defaults (signature line, unit, originator code).
- UI preferences (theme, font selection).

`localStorage` is scoped to the application's origin per the W3C Web Storage specification. Data does not leave the user's browser. The user can clear it at any time via standard browser controls or via the Settings dialog's Data tab.

No cookies are set by SemperScribe. No third-party cookies are loaded. No fingerprinting libraries are present.

## 8. Cross-Border Data Transfer

None. The application does not transfer user data across any network boundary at runtime. Build-time external touches (npm registry, Google Fonts API for the build-time download, GitHub Actions infrastructure) are developer-side and do not involve user data.

## 9. Data Retention

The application does not retain user data. `localStorage` contents persist until the user clears them. There is no maintainer-side retention period because there is no maintainer-side data store.

## 10. User Rights

Users of the application have full control over the data they enter.

- Access. The user enters and views their own data in their own browser.
- Correction. The user edits their own data in their own browser.
- Deletion. The user clears their own `localStorage` via browser controls or the Settings dialog.
- Portability. Users can export their drafts as NLDP files for sharing or backup.
- No appeal mechanism is required because no maintainer-side processing occurs.

## 11. Compliance References

- Privacy Act of 1974, 5 USC 552a, in particular subsections (a)(5) (system of records definition) and (e)(10) (safeguards).
- SECNAVINST 5211.5F, DON Privacy Program, 20 May 2019, paragraph 5b.
- MCO 5211.5, USMC Privacy Program, 28 August 2024.
- DoDI 5200.48, Controlled Unclassified Information, 6 March 2020.
- NIST SP 800-53 Rev 5 controls in the PT (PII Processing and Transparency) family.
- W3C Web Storage specification (browser `localStorage` scoping).

## 12. Policy Review

This posture is reviewed annually or when material changes to the application's data handling occur. The Last reviewed date at the top of this document reflects the most recent review. Substantive revisions also bump the Document version field.
