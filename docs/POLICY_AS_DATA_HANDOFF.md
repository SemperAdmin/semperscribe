# SemperScribe changes for policy-as-data ingest

Audience: an implementing developer or coding agent working in
`github.com/SemperAdmin/semperscribe`.
Source of truth: this document, plus `NLDP-CONTRACT.md` in the policy-as-data
repository for the receiving side.
Audited against: `f843a95`, 2026-08-07.
Date: 2026-08-08. Owner: Stephen.

Place a copy at `docs/POLICY_AS_DATA_HANDOFF.md` in SemperScribe.

---

## 0. TL;DR

1. **Stop emitting canonical records.** `src/lib/policy-as-data.ts` reimplements
   rules that live in the policy-as-data repository and breaks four of them.
   Freeze it, then delete it. SemperScribe emits NLDP and nothing else.
2. **Bump NLDP to 1.1** with six additions: paragraph designators, a real
   lifecycle enum, structured references, a signed-artifact hash, a release
   block, and explicit contact flagging. Section 4 has the exact types.
3. **Add a Release step.** Export splits into two paths: a working export
   (unchanged, `release` absent) and a Release export, which requires a signed
   artifact and an explicit human affirmation. Only a Release package is
   eligible for ingest.
4. **`'final'` is not `'signed'`.** The current enum is
   `'draft' | 'review' | 'final'`. None of those means a commander signed it.
   That gap is the reason a draft can currently export as active policy.
5. **`docs/NLDP_FEATURE_GUIDE.md` is stale.** Section 6 resolves it.

Nothing here touches PDF, DOCX, AMHS, import, or the editor. The blast radius is
the NLDP module, one new release module, one dialog, and the export hook.

---

## 1. The two acts, and why they are not the same

The requirement is a human verification step. There are two distinct human acts
and conflating them is the design error to avoid.

| | **Release** | **Verification** |
|---|---|---|
| Who | the drafter or the signing authority, in SemperScribe | a reviewer in policy-as-data |
| Asserts | "this package corresponds to the document that was signed" | "this encoding matches the issuing authority's copy" |
| Evidence | the signed artifact and its hash | the authoritative source, read paragraph by paragraph |
| Where recorded | inside the NLDP file | the attestation ledger, `VERIFICATION-DESIGN.md` |
| Can SemperScribe do it | yes | **no** |

SemperScribe cannot perform verification, because it is not the issuing
authority and it holds no authoritative copy to compare against. What it can do
is supply the evidence verification needs, which is the signed artifact hash and
an honest lifecycle state.

**Build Release. Do not build a verification UI.**

---

## 2. The publication rule, and one correction to it

The instruction was that nothing should be public until it is verified. Correct
for authored content, and it needs one qualification before it is implemented,
because applied literally it would empty the existing site.

Three independent conditions gate rendering. Do not collapse them into one flag.

| Condition | Question | Source |
|---|---|---|
| **Release authority** | may this be shown to this audience | distribution statement code |
| **Lifecycle** | is this in force | signed, promulgated, cancelled |
| **Verification** | has a human confirmed the encoding | attestation ledger |

The rule this handoff implements:

- **Authored records render only when VERIFIED.** A record originating in
  SemperScribe carries existence risk: a draft that was never signed being read
  as policy. That is unacceptable at any confidence level, so the gate is
  absolute.
- **Extracted records keep per-provision disclosure**, unchanged. Those
  transcribe issuances that are already public. Their risk is fidelity, not
  existence, and it is already disclosed per provision. Applying the authored
  rule to them would unpublish essentially the whole corpus and destroy the
  site's value for no safety gain.

That distinction is enforced on the policy-as-data side. SemperScribe's job is
to make it possible by stating, in the file, which kind of record this is and
what evidence backs it.

---

## 3. Retire the canonical exporter

`src/lib/policy-as-data.ts` and `src/lib/policy-as-data.test.ts`.

**Why it goes.** It reimplements the identifier grammar, the publishability
gate, the schema version, and the provenance stamp. All four live in the
policy-as-data repository, none is visible from here, and all four are wrong in
this copy:

- `/us/dod/don/usmc/mco/5215.1k` contains a period. The receiving grammar
  forbids it, because USLM reserves the period for the format suffix, so that
  identifier resolves as document `mco/5215` in format `1k`.
- `converted_at: new Date().toISOString()` makes re-export non-deterministic, so
  ingest cannot be idempotent.
- `publication.publishable` is hardcoded `true` while the distribution statement
  code is read and ignored. Statement A is public release; B through F and X are
  not.
- `status: 'active'` is hardcoded while the package says `draft`.

Full detail in `NLDP-CONTRACT.md` section 3. Do not fix these in place. Fixing
them here leaves two implementations of the same rules in two repositories,
which is the failure this whole programme exists to detect.

**How it goes.**

1. Mark both files `@deprecated` with a pointer to this document. Keep them
   compiling for one release so nothing breaks silently.
2. Remove the export path from the UI in the same release, so no user produces a
   `.policy.json` that the receiving side will reject.
3. Delete both files in the following release.

**One thing to keep.** The path-ladder logic in `pathSegment` and
`provisionLabel` matches the receiving grammar exactly and was correct. It moves
to the policy-as-data side. Nothing is lost.

---

## 4. NLDP 1.1

All additions. A 1.0 reader must still parse a 1.1 file, so every new field is
optional at the type level and required only by the release validator.

`src/lib/nldp-format.ts`:

```ts
// --- lifecycle: the current enum cannot express "signed" ---
export type NLDPLifecycle =
  | 'draft'        // being written
  | 'review'       // in staffing
  | 'final'        // drafting complete, NOT signed
  | 'signed'       // signature applied
  | 'promulgated'  // released to the fleet
  | 'cancelled';

// --- paragraphs gain the designator SemperScribe already computes ---
export interface NLDPParagraph {
  id: number;
  level: number;
  content: string;
  isMandatory?: boolean;
  title?: string;
  acronymError?: string;
  /** 1.1 - printed designator from lib/citation.ts, e.g. "1.", "a.", "(1)".
   *  Emitted so the numbering rule has exactly one implementation. */
  designator?: string;
}

// --- references gain a best-effort structured citation ---
export interface NLDPCitedIssuance {
  docType?: string;   // MCO, MARADMIN, SECNAVINST, DODI, USC, ...
  number?: string;    // as printed, periods intact: "1050.3J"
  year?: string;      // MARADMIN only
  edition?: string;   // change package or revision suffix
}
export interface NLDPReference {
  text: string;
  order?: number;
  /** 1.1 - null when the text could not be parsed. Never guess. */
  cited?: NLDPCitedIssuance | null;
  parsed?: boolean;
}

// --- the signed artifact, which is what makes verification possible ---
export interface NLDPSignedArtifact {
  filename: string;
  format: 'pdf' | 'docx';
  sha256: string;
  byteLength: number;
  hashedAt: string;
}

// --- the release block: present only on a Release export ---
export interface NLDPRelease {
  released: true;
  releasedAt: string;
  releasedBy: string;          // role or billet, NOT a personal name
  lifecycle: Extract<NLDPLifecycle, 'signed' | 'promulgated'>;
  signedArtifact: NLDPSignedArtifact;
  affirmation: string;         // the exact text the human accepted
  affirmationVersion: string;  // so a changed wording is detectable
}

export interface NLDPData {
  formData: NLDPFormData;
  paragraphs: NLDPParagraph[];
  references: NLDPReference[];
  enclosures: NLDPEnclosure[];
  vias: NLDPVia[];
  copyTos: NLDPCopyTo[];
  /** 1.1 - contacts carried explicitly so the receiver can mask them. */
  pocs?: Array<{ role?: string; name?: string; phone?: string;
                 email?: string; isContact: true }>;
  directiveMetadata?: {
    estimatedPageCount?: number;
    lastModified?: string;
    status?: NLDPLifecycle;
  };
}

export interface NLDPFile {
  format: 'NLDP';
  version: '1.0' | '1.1';
  metadata: NLDPMetadata;
  integrity: NLDPDataIntegrity;
  data: NLDPData;
  /** 1.1 - absent on a working export. Ingest requires it. */
  release?: NLDPRelease;
}

export const NLDP_CONSTANTS = {
  FORMAT_NAME: 'NLDP',
  CURRENT_VERSION: '1.1',
  FILE_EXTENSION: '.nldp',
  MIME_TYPE: 'application/json',
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_VERSIONS: ['1.0', '1.1'],
  CREATOR_APP: 'Marine Corps Directives Formatter',
} as const;
```

Also add to `NLDPMetadata` a `generator` block carrying the app version and
commit, so a defective export is traceable to the build that produced it.

**Four notes on intent.**

- `designator` exists so the numbering ladder has one implementation, in the tool
  that owns it. Populate it from `lib/citation.ts` at export time. Do not add a
  second ladder.
- `cited` is best-effort and `parsed: false` is a correct, expected answer.
  **Never guess a citation.** An unparsed reference is handled downstream; a
  wrong one becomes a false authority edge, which is worse than none.
- `releasedBy` takes a role or billet, never a personal name. A published
  register of who released what is personal data attached to an official act.
- `supersession` is deliberately not added. `NLDPFormData` already carries
  `cancellationDate`, `basicDirectiveReference`, `changeNumber`, and
  `pageReplacements`. See section 7.

---

## 5. The Release step

New module `src/lib/release.ts`, one dialog, one hook change. No backend, no
account, consistent with the local-first architecture.

### The gate

A Release export is refused unless every condition holds. Refuse with the
specific failing condition named. Do not disable the button without saying why.

| # | Condition |
|---|---|
| G1 | `directiveMetadata.status` is `signed` or `promulgated` |
| G2 | a signed artifact has been supplied and its SHA-256 computed in-browser |
| G3 | `date_signed` is present and not in the future |
| G4 | `sig` is present |
| G5 | the paragraph tree is non-empty and every paragraph has a `designator` |
| G6 | a distribution statement code is present |
| G7 | the human has accepted the affirmation text below |

### The affirmation

Show it in full. Record the exact string and its version in the file.

> I confirm this package corresponds to the document that was signed and
> promulgated, that the attached file is that signed document, and that the text
> in this package matches it. I understand this package may be ingested into a
> policy corpus and rendered as policy after independent verification.

### Behaviour

- **Working export** stays exactly as it is today. No `release` block. Same
  button, same filename.
- **Release export** is a separate, clearly labelled action producing
  `<id>.release.nldp`.
- Hashing is client-side via `crypto.subtle.digest`. The signed file is read,
  hashed, and **discarded**. Do not embed it in the package; the hash is the
  evidence and the file is the user's.
- If any gate fails, list every failure at once rather than the first.

### Files

| File | Change |
|---|---|
| `src/lib/nldp-format.ts` | types above, version constants |
| `src/lib/nldp-utils.ts` | populate `designator`, `cited`, `pocs`; write `release` |
| `src/lib/release.ts` | **new** - gates, affirmation text and version, hashing |
| `src/hooks/useNLDP.ts` | second export path |
| `src/components/NLDPFileManager.tsx` | Release action and dialog |
| `src/lib/citation.ts` | no logic change; export a per-paragraph designator helper if one is not already reachable |
| `sample-directive.nldp` | regenerate at 1.1, working export |
| `examples/` | add a Release sample with a fake but well-formed hash |
| `docs/NLDP_FEATURE_GUIDE.md` | rewrite, section 6 |

---

## 6. Resolve the documentation conflict

`docs/NLDP_FEATURE_GUIDE.md` documents `metadata.packageId`,
`metadata.checksums`, and `formatVersion: "1.0.0"`.

**The guide is wrong.** `src/lib/nldp-format.ts` defines `NLDPFile` as
`{format, version, metadata, integrity, data}` with `CURRENT_VERSION: '1.0'`,
and `sample-directive.nldp` matches the module exactly. There is no `packageId`
and no `metadata.checksums`.

Fix the guide, not the module. While rewriting it, state plainly that the module
is the specification and the guide is derived, so this does not recur.

---

## 7. Corrections to the earlier audit

Two findings in `NLDP-CONTRACT.md` were wrong or incomplete. Recorded so neither
is re-found.

**R9, supersession, is PARTIALLY MET, not NOT MET.** `NLDPFormData` carries
`cancellationDate`, `basicDirectiveReference`, `changeNumber`, `revision_suffix`,
and `pageReplacements`. Those were not in the sample file, which is why the first
pass missed them. No new fields are needed; the receiving side maps what already
exists. **Confirm the semantics of `basicDirectiveReference` before mapping it,**
since a change package pointing at its basic order is a different relationship
from a new edition superseding an old one, and the receiving side keeps them
apart.

**R8, contact flagging, is better than reported.** `NLDPExportConfig` already
carries `includePersonalInfo` and `NLDPMetadata` carries `author`. The `pocs`
addition in section 4 makes body contacts explicit rather than inferred.

**The lifecycle enum is worse than reported.** It is
`'draft' | 'review' | 'final'`. The first audit assumed the enum was unknown. It
is known and it has no signed state, which is precisely why a draft can export
as active policy today. This is now the single highest-value change in this
handoff.

---

## 8. Tests

The repository already runs vitest with a `tests/citation.test.ts` and a golden
suite. Match that pattern.

| Test | Asserts |
|---|---|
| `release-gate.test.ts` | each of G1 to G7 fails independently and by name; all-pass produces a `release` block |
| `release-gate.test.ts` | `status: 'final'` **fails** G1. This is the regression guard for the draft-leakage defect. |
| `nldp-designator.test.ts` | every exported paragraph carries a `designator` identical to `lib/citation.ts` for the same tree |
| `nldp-citation-parse.test.ts` | an unparseable reference yields `parsed: false, cited: null` and never a guess |
| `nldp-roundtrip.test.ts` | export then import then export is byte-identical apart from `createdAt` |
| `nldp-compat.test.ts` | a 1.0 file still imports under the 1.1 reader |
| `nldp-hash.test.ts` | a known byte sequence produces a known SHA-256 |

The round-trip test matters most. The receiving side requires idempotent ingest,
and a package that does not round-trip cannot deliver it.

---

## 9. Security and privacy

- **No new egress.** Hashing is `crypto.subtle` in the browser. The signed file
  never leaves the machine and is not embedded in the package.
- **`releasedBy` is a role or billet.** Never a personal name. Same reasoning as
  the receiving side's verifier roster.
- **The release block is not tamper-proof, and say so.** Anyone can hand-edit
  JSON. This is an accepted proof-of-concept shortcut. The real control is on the
  receiving side, where a human verifies against the authoritative source and the
  artifact hash is checked independently. Put that sentence in the guide, and in
  `SECURITY.md` if the release feature ships.
- **The CUI warning still governs.** A Release export does not change what may be
  typed into the app. If the signed document is CUI, its hash is safe to carry
  and its text is not.

---

## 10. Do not

- Do not build a verification UI, a reviewer queue, an approval chain, or an
  account system. Wrong tool, wrong repository.
- Do not fix `policy-as-data.ts` in place. Retire it.
- Do not add a second numbering ladder.
- Do not guess a citation to make `parsed: true` more often.
- Do not make `release` mandatory on the normal export path. The working export
  is what most users need, and gating it would push people back to email.
- Do not upload or POST anything. Local-first is the architecture, not a phase.

---

## 11. Acceptance criteria

1. `.nldp` at version 1.1 exports and imports, and 1.0 files still import.
2. Every paragraph carries a `designator` matching `lib/citation.ts`.
3. A document with `status: 'final'` cannot produce a Release package, and the
   refusal names G1.
4. A Release package carries a SHA-256 of a real file the user selected.
5. `references[].parsed` is `false` wherever the text was not confidently
   parsed, and no `cited` object is invented.
6. `policy-as-data.ts` is deprecated and its UI path removed.
7. `docs/NLDP_FEATURE_GUIDE.md` matches `src/lib/nldp-format.ts` field for field.
8. Export, import, export is byte-identical apart from `createdAt`.
9. No new runtime dependency, no network call, no persisted personal name.

---

## 12. Confidence

0.9. Every type, constant, and enum quoted here was read from the repository at
`f843a95`. The `'draft' | 'review' | 'final'` enum, the `NLDPFile` shape, the
`NLDP_CONSTANTS` values, and the supersession fields in `NLDPFormData` are
verbatim.

Lower on two points, both flagged in place. The semantics of
`basicDirectiveReference` are **UNCONFIRMED** and must be settled before the
receiving side maps it. Whether `lib/citation.ts` already exposes a per-paragraph
entry point suitable for the exporter was not checked; if it does not, adding one
is a small refactor and not a rewrite.
