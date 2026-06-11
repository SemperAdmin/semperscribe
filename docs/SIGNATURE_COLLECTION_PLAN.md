
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
