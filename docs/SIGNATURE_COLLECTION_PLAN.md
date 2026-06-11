
---

## STATUS LOG

### S1 SHIPPED (2026-06-10)

Fixture received from Stephen: app-generated letter CAC-signed in
Acrobat - adbe.pkcs7.detached over ByteRange [0 8407 19527 866522],
signer cert from DOD EMAIL CA-70 chaining to DoD Root CA 6, field
"Signature1", CMS blob 5559 bytes. Confirms K2/K5 end to end.
Fixture held OUT of the repo pending Stephen's ruling (carries his
EDIPI; DoDI 8520.02 says cert disclosure is not a PII breach, public-
repo posture is still his call). Needed as the S3 PASS fixture.

src/lib/pdf-signature-field.ts rebuilt:
- Defect 1 closed: zero page-content writes in all three entry points
  (the old code drew "SIGN HERE"/signer-name ink into the content
  stream; manual path included). Cue moved to the widget's /AP /N
  Form XObject (dashed box + gray label, Helvetica) - Acrobat
  replaces it with the signature appearance at signing time.
- Defect 3 closed: deterministic names Signature_<n>_<SIGNER_SLUG>
  via buildSignatureFieldName (exported).
- Defect 2 partial: auto-anchor path (addSignatureField) retains the
  content-stream text-position search (signature-indent X column,
  lowest line, signer-name fallback) - it reads OUR generated PDF, so
  it is deterministic for app output. Direct geometry hand-off from
  the emitter deferred; manual placement modal unchanged as override.
- console.log noise removed; API surface unchanged (page.tsx /
  useDocumentExport untouched).

Proof: tests/signature-fields.test.ts (6) - name slugs, content-
stream byte-identity on both paths, /Sig + SigFlags 3 + rect + /AP /N
appearance text, auto-anchor rect at signature indent + 24pt above
name, unique multi-signer names. Suite 1045 green (27 files), tsc
clean, golden parity green.

Gate S1 OPEN ITEMS for Stephen:
1. Sign a fresh export and confirm in Acrobat: cue box visible,
   vanishes after signing, no ink in the signed artifact.
2. Ruling: commit the CAC-signed fixture (with your EDIPI) to the
   public repo for S3 CI, or supply a sanitized/test-cert fixture.

### S2 SHIPPED (2026-06-10) — guided ceremony, no backend

Ruling (Stephen): DocuSign-style fully in-app CAC signing is barred
by K1 on any architecture; ship the guided ceremony instead, no
relay backend. Signed fixture NEVER goes to GitHub (ruling); S3
PASS check against it stays local, FAIL fixtures synthetic.

S2a (commit 16f3f9c):
- url-state v2: optional SignatureRouting {requestedSigner, dueDate,
  returnEmail, note}; v1 links decode unchanged.
- signature-probe.ts: STRUCTURAL detection only (ByteRange/SubFilter/
  /M time, signer + CA hints scraped from CMS printable strings,
  bytes-after-signed-range flag). No digest, no chain, no trust
  decision — every consumer labels it. Verified exact against the
  real CAC-signed fixture (signer CN with 10-digit EDIPI cap, DOD
  EMAIL CA-70, DoD Root CA 6; DER tag-byte bleed handled with the
  2026 DoD PKI shape heuristic, superseded by S3 ASN.1).

S2b:
- RequestSignatureCard (drafter): routing fields -> v2 share link ->
  clipboard, OPSEC rule stated on the card and in the toast.
- SignatureCeremonyPanel (signer): 4-step stepper — save sign-ready
  PDF (File System Access API, anchor-download fallback; same export
  gate as generateDocument, then the S1 anchored field with the
  requested signer's name) -> Acrobat instructions -> drop-zone
  structural check (advisory card, "not cryptographic verification"
  label, incremental-update warning) -> return via navigator.share
  with the file attached (OS share sheet -> Outlook) or mailto
  fallback.
- page.tsx: routing slips detected on share-link import; ceremony
  panel replaces the request card; i-type/amhs/page11 excluded.

Proof: tests/signature-probe.test.ts (6) — v2 round-trip, v1
back-compat, version stamping, probe shape/trailing-bytes/negative;
tests/components/SignatureCeremony.test.tsx (3) — banner fields,
save->sign->probe walk with advisory label, OPSEC text. Suite 1054
green (29 files), tsc clean.

Gate S2 open items:
1. Stephen end-to-end walk: request link on one machine/profile,
   ceremony on another, share-sheet return on Windows (navigator.share
   file support rides Edge/Chrome on Win 10/11 — verify on your box).
2. S3 next: real CMS verification with bundled DoD roots replaces the
   probe card in-place (same panel slot, same advisory framing until
   revocation is solved, which stays out of scope per ruling).

### S2c SHIPPED (2026-06-10) — workflow corrections (Stephen, 3 issues)

Rulings:
1. Signer tier: CAC PKI ONLY. The Acrobat step is the floor (K1);
   the in-app /s/ electronic-signature tier (M-5216.5 Ch 2 class)
   was offered and declined.
2. The ORIGINATOR configures signature fields; request-signature
   lives in the Configure Signature Fields section.
3. No routing form — the request e-mail carries who/when/where. The
   link keeps only requestedSigner (from the first configured
   field's signer name, else the typed sig block).

Changes:
- Placement-modal confirm now PERSISTS fields to
  formData.signatureFields (travels with share links, drafts, .nldp)
  instead of downloading. SignatureFieldSection rebuilt: configure /
  download sign-ready / copy request link, configured-fields summary,
  auto-anchor fallback note.
- buildSignReadyBlob shared by download, ceremony, and request paths:
  export gate, then configured fields (S1 per-signer names) or the
  auto-anchored field.
- RequestSignatureCard deleted. Ceremony return step without a
  return address now instructs "reply to the request e-mail" instead
  of erroring.

Proof: SignatureFieldSection render tests (2) added; ceremony walk
test unchanged and green. Suite 1055 green (29 files), tsc clean.

Caveat on formData.signatureFields: FormData is the permissive type,
so the field rides untyped; zod parse in dynamic-form submit paths
would strip it. Acceptable for the PoC; flagged for the schema pass
if signature fields ever become per-type validated structure.

### S2d SHIPPED (2026-06-10) — friction pass on the signer loop

Stephen's two corrections from the live walk:
1. Routing toast removed — the ceremony panel is the whole message.
2. Signer save step: cannot reach zero under the CAC-PKI-only ruling
   (Acrobat signs files on disk; Acrobat is the only CAC-capable
   signer present — K1). Everything around it is now removed: the
   save picker's file handle is HELD, the signer overwrites the same
   file when Acrobat prompts, and step 3 is a one-click "Check the
   signed file" re-reading that handle. No drag-back, no second file
   picker. Drop zone remains as the fallback (no FS Access API, or
   saved elsewhere); "no signature yet" re-check message instead of
   a dead end. Loop is now: Begin -> sign in Acrobat -> Check ->
   Return.

Proof: held-handle ceremony test (mocked showSaveFilePicker ->
getFile -> probe card, no drop zone touched). Suite 1056 green
(29 files), tsc clean.

### S2e SHIPPED (2026-06-10) — request link in the placement modal + signing mode

Stephen's directives from the placement-modal walk:
1. The Configure Signature Fields MODAL now carries the request
   action: Cancel | Save Fields | Save & Copy Request Link. The
   copy path takes the FRESH positions from the modal (never the
   trailing async formData) and stamps the first field's signer
   name into the link routing.
2. Signing mode: a receiver opening a request link sees the ceremony
   panel and the live document preview ONLY — the form editor with
   the document metadata is hidden until Dismiss. The signer signs;
   the originator's form stays out of sight.

Suite 1056 green (29 files), tsc clean.

### S2f SHIPPED (2026-06-10) — fields ride every PDF surface; section slimmed

Stephen's walk corrections:
1. Configured signature fields now ride EVERY PDF surface through one
   shared applier: the live preview (originator AND signer see the
   placed box rendered — browser viewers draw the widget /AP
   appearance), the Export PDF download, the ceremony save, and the
   request-link flow. The signer opening a request link sees the PDF
   with the box ready, then saves and clicks the same box in Acrobat.
2. The two brown buttons left the Configure Signature Fields section
   (download + copy link): Export carries the fields automatically,
   and the placement modal owns Save & Copy Request Link. The
   section keeps Place/Edit + the configured-fields summary.

Note: with NO fields configured, exported PDFs are unchanged (no
auto-anchor injection on plain exports — auto-anchor remains the
ceremony fallback only). Suite 1056 green (29 files), tsc clean.
