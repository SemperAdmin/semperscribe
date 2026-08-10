# SemperScribe Privacy Posture

Auditor-facing privacy posture statement. Complements the user-facing Privacy and Security Notice at `src/app/privacy/page.tsx` (rendered at the `/privacy` route).

- Last reviewed: 2026-08-04
- Document version: 2.0
- User-facing notice: https://semperadmin.github.io/semperscribe/privacy

Version 2.0 corrects a material misstatement. Version 1.0 claimed zero outbound
transmission of user data at runtime. That claim was true when written and became
false when GunnyBot shipped. Sections 1, 2, 3, 8, and 9 are revised. Section 13 is
new and covers the EDMS handoff mode.

## 1. Statement of Facts

SemperScribe processes only data the user enters or imports into the in-browser form. Document drafting, formatting, validation, and export all occur locally within the user's web browser. The application performs no server-side processing of user input and operates no backend.

Outbound transmission of user data occurs in exactly one circumstance: GunnyBot, the optional AI assistant. GunnyBot is off unless the user supplies an API key. When the user invokes it, the text of the request, which includes correspondence content the user selected, is transmitted to the provider the user chose, under the user's own key.

Providers are enumerated in `src/lib/gunnybot/providers.ts`.

| Provider | Endpoint | Operator |
|----------|----------|----------|
| Google Gemini | `https://generativelanguage.googleapis.com` | Commercial |
| GenAI.mil | `https://api.genai.mil` | DoD |

Anthropic (`https://api.anthropic.com`) was a listed provider through 2026-08-09 and was removed from the code on 2026-08-10 on a policy ruling: a commercial US vendor is not an acceptable egress destination on the DoD adoption path. No `api.anthropic.com` request is reachable from any build after that date.

No other runtime transmission exists. Telemetry, analytics, and third-party CDN fetches were removed in Phase 1 (commits 01237ec, 354c2a4) and have not returned.

Version 1.0 of this document stated the application "emits zero outbound transmissions of user data at runtime." That statement predates GunnyBot and is withdrawn.

## 2. Architectural Privacy Controls

The privacy posture is enforced by architecture, not by policy alone.

| Control | Mechanism | Evidence |
|---------|-----------|----------|
| No backend processing | Static export via Next.js `output: 'export'` | `next.config.ts` |
| No runtime telemetry | countapi.xyz beacons removed in P1-2 | commit `354c2a4` |
| AI egress is opt-in | GunnyBot is inert without a user-supplied API key. Keys are session-only and never persisted | `lib/gunnybot/keyring.ts` |
| AI egress is pre-screened | Structured-identifier scan before every send, routed through a consent gate that fails closed with no handler mounted | `lib/gunnybot/redaction.ts`, `lib/gunnybot/egress-gate.ts` |
| AI egress is restricted under EDMS mode | Commercial providers blocked at the single `fetch` call site whenever the session is bound to an EDMS request | `lib/gunnybot/client.ts`, `lib/edms-mode.ts` |
| No EDMS or external storage | Supabase integration removed in P1-1 | commit `01237ec` |
| No third-party CDN at runtime | Fonts via `next/font/google` build-time self-host, Font Awesome removed | commit `01463dd`, deletion of `dod-seal-base64.tsx` |
| No analytics or tracking | StatsDisplay deleted in P1-2 | commit `354c2a4` |
| No external image fetches | placehold.co fetch replaced with local DOD seal | commit `02949fc` |
| Local-only persistence | Browser `localStorage` only, scoped to same-origin | `useUserProfile.ts`, `storage-utils.ts` |
| Production console stripped | Diagnostic logs removed from production bundle | `next.config.ts` `compiler.removeConsole` |

One code path in the active source contacts a third-party host at runtime, and only on explicit user action: `streamChat` in `lib/gunnybot/client.ts`. It is the sole `fetch` call in the GunnyBot subsystem, which makes it the single enforcement point for every egress control described here. No other runtime third-party contact exists.

The scope of the pre-send scan is narrow by design and stated plainly here so no reader over-reads it. `redaction.ts` screens for two high-confidence structured identifiers, the SSN digit pattern and a bare 10-digit EDIPI. It does not screen for names, ranks, unit designators, duty status, subject lines, or free-text body content. Those pass to the chosen provider untouched. The PHI keyword list in `security-utils.ts` is deliberately not consulted, because bare-substring matching flagged ordinary correspondence vocabulary constantly. The control is a consent prompt, not a filter.

## 3. Information Handling Categories

| Category | Processed by SemperScribe? | Notes |
|----------|-----------------------------|-------|
| Personally Identifiable Information (PII) | No, by design. | User responsibility not to enter. Banner and Privacy Notice surface this. If entered and then sent through GunnyBot, it leaves the browser for the chosen provider. The pre-send scan catches SSN and EDIPI patterns only. |
| Controlled Unclassified Information (CUI) | No, by design. | User responsibility not to enter. Reference DoDI 5200.48. GunnyBot performs no CUI detection of any kind. A user who enters CUI and invokes a commercial provider has transmitted CUI to a commercial service. |
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

The application transfers no user data across a network boundary except through GunnyBot, and only on explicit user action with a user-supplied key.

Where that data comes to rest is a property of the provider the user selected, not of this application. Google operates globally distributed infrastructure. Neither this application nor its maintainer controls or attests to the residency, retention, or training use of text a user sends to a commercial provider. Users with a data-residency obligation select GenAI.mil, or do not use GunnyBot.

Build-time external touches (npm registry, Google Fonts API for the build-time download, GitHub Actions infrastructure) are developer-side and involve no user data.

## 9. Data Retention

The application retains no user data. `localStorage` contents persist until the user clears them. There is no maintainer-side retention period because there is no maintainer-side data store.

Text sent through GunnyBot is retained per the selected provider's own policy. The application has no visibility into, and no control over, that retention. This is disclosed in the GunnyBot settings panel before a key is saved.

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

## 13. EDMS Handoff Mode

SemperScribe is launched from the USMC EDMS Power App through a `#edms=` URL fragment. The handoff is inbound only and the payload is deliberately scalar: request ID, unit RUC, SSIC, document type, and reviewing section. It carries no subject line, no names, and no letter body. Implementation and per-field validation live in `lib/edms-handoff.ts`.

The design constraint driving that narrowness: a subject line on a naval letter routinely names a Marine. Placing one in a URL puts it in browser history and in any TLS-inspecting proxy log on the path. Excluding it keeps the categorization in `docs/RMF_READINESS.md` intact at the cost of the drafter typing the subject.

While EDMS mode is active, three controls apply, all enforced in code rather than by setting.

1. GunnyBot egress is restricted to GenAI.mil. Enforced in `streamChat`, the single `fetch` call site, so every caller is covered: draft, rewrite, proofread, QA, and the connection probe. Unrecognised providers are blocked, not allowed.
2. Share-link generation is suppressed. A share URL carries the whole letter, and mailing one out of an EDMS context routes a record around the records system.
3. Exports take the EDMS filename convention so each artifact correlates to its originating request.

EDMS mode is held in `sessionStorage`, never `localStorage`, so it expires with the browser tab. A stale EDMS context surviving into an unrelated draft would mislabel that draft's export.

The generated document leaves SemperScribe as a file the user downloads and uploads to EDMS by hand. No direct write path to EDMS exists, and none is planned. This preserves the no-backend posture in Section 2.

## 12. Policy Review

This posture is reviewed annually or when material changes to the application's data handling occur. The GunnyBot revision in version 2.0 is the reference case for what counts as material: a new runtime egress path requires a same-release document update, not a deferred one. The Last reviewed date at the top of this document reflects the most recent review. Substantive revisions also bump the Document version field.
