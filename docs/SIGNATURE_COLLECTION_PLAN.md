# SemperScribe CAC Signature Collection Plan

**Date:** 2026-06-10
**Basis:** Two-track council research (browser/CAC technical feasibility; DoD signature policy), 2026-06-10, sources cited inline.
**Rulings on record (Stephen, 2026-06-10):** all three legs ship (S1 export, S2 routing, S3 verification); verification ships without revocation checking, gap labeled prominently.
**Workflow rule:** no functional change ships without explicit approval. Each phase ends at an approval gate.

---

## VERIFIED CONSTRAINTS (council findings, not speculation)

| # | Constraint | Evidence |
| :- | :--- | :--- |
| K1 | No browser page served from a normal origin reaches the CAC private key. Web Crypto has no smartcard provider model. mTLS uses the key only inside the TLS handshake. WebAuthn emits FIDO assertions, not CMS signatures. Web Smart Card API shipped in Chrome 143 for Isolated Web Apps ONLY, never github.io origins. | W3C Web Crypto draft; Chromium issue 36917164; chromestatus feature 6411735804674048; WICG web-smart-card spec; Yubico WebAuthn-for-signing doc |
| K2 | A DoD-recognized digital signature is CMS PKCS#7 detached over the PDF ByteRange, produced from a DoD-approved PKI certificate (DoDI 8520.02, May 2023, Sec 3.b: "must be generated using DoD-approved PKI certificates"). No instruction names a mandatory tool. Acrobat/Reader + ActivClient is the de facto standard. | DoDI 8520.02 (esd.whs.mil); Adobe supported-standards doc |
| K3 | The signed artifact IS the file. The signature certifies exact bytes, so it cannot be detached into a URL and rejoined. URL return of a signature is conceptually void, independent of the 8,000-char share-URL cap (url-state.ts MAX_URL_LENGTH). | PDF ByteRange mechanics; src/lib/url-state.ts |
| K4 | Policy permits CAC-signed naval correspondence with NO signature-block format change. SECNAV M-5216.5 Ch 4 para 6 defers to DoD PKI policy; Appendix C para 2 permits digital signature on computer-generated letterhead; MCO 5216.20B is silent on PKI. HQMC publishes MCO change transmittals as Acrobat CAC signatures rendered over the standard typed block. "//signed//" appears nowhere in DON manuals (grep 0); "/s/" is the only typed convention, e-mail only. | SECNAV M-5216.5 w/CH-1; MCO 5216.20B; MCO 5215.1K CH pages (signed by SULLIVAN.ANDREW.NORMAN.1142346016, 2025) |
| K5 | DoD Root CAs 3/4/5/6 (bundle v5.14, 2026-04-28) are publicly downloadable, no auth: dl.dod.cyber.mil unclass-certificates_pkcs7_DoD.zip. CAC issuing CAs chain to Root 3 and Root 6. | Empirically downloaded and parsed 2026-06-10 |
| K6 | Browser-side revocation checking is impossible: crl.disa.mil and ocsp.disa.mil serve no CORS headers and run plain HTTP (mixed content). Verified empirically 2026-06-10. | Direct endpoint probes |
| K7 | Units route for signature via ETMS2/TMT (replaced DON TRACKER, May-Jun 2022; MARADMIN/NAVADMIN 051/22). Below the executive tier the dominant practice is e-mail + Acrobat CAC signing. | marines.mil MARADMIN; NAVADMIN 051/22 |

## REJECTED APPROACHES (with reasons, for the audit trail)

- **Signature return via URL** - violates K3. Dead on arrival.
- **In-browser CAC signing** - violates K1 in every variant.
- **Localhost signing bridge** (DBsign-style helper, Fortify, NexU) - Fortify archived 2024-09, NexU withdrawn 2025, DBsign is COTS requiring install + accreditation. Install burden defeats the static-app premise; localhost listeners carry their own security posture problems.
- **Server-side signing after CAC auth** - requires a backend the PoC deliberately lacks; creates a document-custody and Privacy Act surface the project posture forbids.
- **WebAuthn "signatures"** - wrong cryptographic envelope, not DoDI 8520.02 compliant (K1).

## ARCHITECTURE: PREPARE LOCALLY, SIGN NATIVELY, VERIFY ON RETURN

The app never touches the private key. It prepares the artifact, routes the request, and audits the result.

```
Drafter                          Signer                        Drafter
  | share URL (state+slip) ------> |                              |
  |                                | opens link, reviews,         |
  |                                | exports sign-ready PDF,      |
  |                                | signs in Acrobat w/ CAC      |
  |                                | --- signed PDF (email/ETMS2)-> |
  |                                                               | drops file in app
  |                                                               | client-side verify
```

---

## PHASE S1 - Sign-Ready Export (hardening of existing code)

Existing: src/lib/pdf-signature-field.ts (addSignatureField, addSignatureFieldAtPosition, addMultipleSignatureFields), manual placement modal wired in page.tsx (handleSignatureConfirm -> addMultipleSignaturesToBlob).

Defects found 2026-06-10:
1. **addSignatureField draws "SIGN HERE" ink into the page content stream.** The rectangle and text become permanent page content surviving the signature. Compliance defect: official correspondence must carry no extraneous markings (M-5216.5 standard letter contents). Fix: annotation-only AcroForm widget with an appearance stream, zero page-content writes.
2. Field placement is heuristic (text search) or manual. Fix: anchor placement to the known signature-block geometry the emitter already computes (4680-twip center start, 3-blank offset) so the field lands above the typed name deterministically. Manual placement stays as override.
3. Field naming: single anonymous field. Fix: name fields `Signature_<n>_<SIGNER_NAME_SLUG>` so multi-signer routing (endorsements, "by direction" chains) addresses fields deterministically.

Acceptance: golden test asserting (a) zero page-content-stream delta when a field is added, (b) AcroForm /SigFlags and field rect at the computed anchor, (c) field name slug. Export gate unaffected. Parity untouched (fields are annotations, not layout).
**GATE S1.**

## PHASE S2 - Routing Slip via Share URL (outbound only)

Extend ShareableState (url-state.ts, version bump to 2) with an optional `routing` object: requestedSigner, dueDate, returnChannel (free text: e-mail address or "ETMS2 task"), note. On open, the app shows a routing banner: who is asked to sign, by when, how to return. Export button label switches to "Export sign-ready PDF".

OPSEC HARD RULE (carried from the CUI posture): the share URL embeds the full letter text. Link-preview bots in Teams/Outlook fetch URLs. The routing banner and the docs state: URL routing is for non-sensitive drafts only, the user is responsible for content, same rule as the existing no-CUI posture. No "pending" markings added to the UI (ruling 2026-05).

Version migration: decodeStateFromUrl already tolerates missing version. v1 links keep working, routing object absent.

Acceptance: round-trip test (encode v2 -> decode -> banner fields), v1 backward-compat test, URL length warning still fires past 8,000 chars.
**GATE S2.**

## PHASE S3 - Client-Side Signature Verification (the differentiator)

Drop zone accepts a returned PDF. Fully client-side pipeline:
1. Parse /ByteRange + /Contents from the signature dictionary, hash the covered ranges (Web Crypto SHA-256/384 on plain bytes - permitted, no smartcard involved).
2. Parse the CMS PKCS#7 structure (pkijs or hand-rolled ASN.1, decide at implementation - pkijs adds a dependency, log it in LICENSES.md per SBOM policy).
3. Chain the signer certificate to the bundled DoD roots (v5.14 bundle, roots 3/4/5/6 + intermediates, committed to the repo as public artifacts - they are published unauthenticated by DISA, K5).
4. Detect post-signature incremental updates (bytes after the signed range).
5. Render verdict card: signer DN, signing time, integrity PASS/FAIL, chain PASS/FAIL, and a permanent labeled gap - "REVOCATION NOT CHECKED - this tool cannot reach DoD CRL/OCSP from the browser (no CORS, HTTP-only). Validate revocation in Acrobat for authoritative status." (Ruling: accept and label, 2026-06-10.)

The verdict card is advisory tooling, not an authoritative validation service - state this on the card. Acrobat remains the authoritative validator.

Bundle maintenance: DoD root bundle gets a version file + a quarterly manual refresh note in the doc. Roots 3 and 6 cover CAC issuance through at least 2029 (K5).

Acceptance: fixture set - (a) a CAC-signed PDF (Stephen supplies one, sanitized), verify PASS; (b) same file with one byte flipped inside ByteRange, integrity FAIL; (c) bytes appended after signature, modification flag; (d) self-signed cert chain, chain FAIL. All offline.
**GATE S3.**

---

## DEFERRED (out of scope until separately approved)

- Multi-signer endorsement-chain field orchestration (depends on the endorsement-chain phase already scheduled after Phase 4/5 directives work).
- Serverless OCSP relay for revocation (introduces infrastructure + privacy surface; revisit only if the PoC graduates toward adoption).
- ETMS2 integration of any kind (CAC-gated system, no public API).

## RISK REGISTER

| Risk | Posture |
| :--- | :--- |
| Share URL leaks document content via link previews / logs | Stated hard rule, user-owned, matches no-CUI posture |
| Verification verdict mistaken for authoritative validation | Advisory label on the card + revocation gap label |
| pdf-lib re-save altering signed bytes on verify | Verify path reads bytes raw, never re-saves through pdf-lib |
| DoD root bundle staleness | Version file + refresh cadence note |
