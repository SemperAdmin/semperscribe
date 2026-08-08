# NLDP Feature Guide

NLDP (Naval Letter Data Package) is SemperScribe's data interchange
format: a single JSON file with the `.nldp` extension carrying a
directive's form data, paragraphs, references, enclosures, vias, and
copy-to lines, plus integrity hashes.

**`src/lib/nldp-format.ts` is the specification. This guide is derived
from it.** When the module and this guide disagree, the module is right
and this guide must be fixed — never the module. (An earlier revision of
this guide documented a `packageId` / `metadata.checksums` shape that the
module never had; that is the failure this rule exists to prevent.)

## File shape (version 1.1)

```jsonc
{
  "format": "NLDP",
  "version": "1.1",              // "1.0" files still import
  "metadata": {
    "createdAt": "2026-08-08T12:00:00.000Z",
    "formatVersion": "1.1",
    "createdBy": "Marine Corps Directives Formatter",
    "generator": { "appVersion": "0.1.0" },   // 1.1: build traceability
    "author": { "name": "...", "unit": "...", "email": "..." },  // opt-in only
    "package": { "title": "...", "description": "...", "tags": [] }
  },
  "integrity": {
    "dataHash": "<sha-256 of the serialized data section>",
    "crc32": "<crc32 of the same>",
    "recordCount": 8
  },
  "data": {
    "formData": { /* document fields; see NLDPFormData */ },
    "paragraphs": [
      {
        "id": 1, "level": 1, "content": "...",
        "designator": "1."       // 1.1: printed designator, from lib/citation.ts
      }
    ],
    "references": [
      {
        "text": "MCO 5215.1K W/CH-3",
        "order": 1,
        "parsed": true,           // 1.1: best-effort structured citation
        "cited": { "docType": "MCO", "number": "5215.1K", "edition": "CH-3" }
      },
      {
        "text": "Verbal guidance, CO conf 12 Aug",
        "order": 2,
        "parsed": false,          // unparseable is a correct answer —
        "cited": null             // the exporter NEVER guesses a citation
      }
    ],
    "enclosures": [ { "text": "...", "order": 1 } ],
    "vias":       [ { "text": "...", "order": 1 } ],
    "copyTos":    [ { "text": "...", "order": 1 } ],
    "pocs": [],                   // 1.1: explicit contacts; empty today
    "directiveMetadata": {
      "status": "draft"           // 1.1 lifecycle enum, see below
    }
  },
  "release": { /* Release exports only — absent on a working export */ }
}
```

## Lifecycle

`draft → review → final → signed → promulgated` (plus `cancelled`).

`final` means **drafting is complete** — it does not mean a commander
signed the document. The `signed` and `promulgated` states were added in
1.1 precisely so a package cannot claim to be policy without saying who
attested to that and on what evidence. Only `signed` or `promulgated`
packages can be Released, and only Release packages are eligible for
policy-as-data ingest.

## The two exports

| | Working export (`.nldp`) | Release export (`.release.nldp`) |
|---|---|---|
| Purpose | move a draft between machines/people | hand a signed directive to the policy-as-data pipeline |
| `release` block | absent | present |
| Requirements | none | gates G1–G7 below |
| Menu action | "Save as Data Package (.nldp)" | "Release Package (.release.nldp)..." |

### Release gates

A Release export is refused unless every condition holds, and every
failing condition is listed at once, by name:

| # | Condition |
|---|---|
| G1 | lifecycle is `signed` or `promulgated` (chosen in the dialog — `final` fails) |
| G2 | the signed PDF/DOCX was supplied and its SHA-256 computed in-browser |
| G3 | `date_signed` is present and not in the future |
| G4 | a signature block (`sig`) is present |
| G5 | the paragraph tree is non-empty and every paragraph has a `designator` |
| G6 | a distribution statement code is present |
| G7 | the human accepted the affirmation text, shown in full |

The affirmation text and its version are recorded verbatim in the
`release` block (`lib/release.ts` owns both). `releasedBy` records a
**role or billet, never a personal name**.

The signed file itself is read, hashed with `crypto.subtle`, and
discarded. Only the hash travels in the package; nothing is uploaded.

**The release block is not tamper-proof, by design.** Anyone can
hand-edit JSON. The real control sits on the receiving side, where a
human verifies the encoding against the authoritative source and the
artifact hash is checked independently. Release is evidence for that
verification, not a substitute for it.

## Designators and citations

- `paragraphs[].designator` is the printed designator from
  `lib/citation.ts` — the standard naval-letter scheme (`1.`, `a.`,
  `(1)`, `(a)`, …). It is emitted so the numbering ladder has exactly
  one implementation. Do not add a second ladder.
- `references[].cited` is best-effort structured parsing
  (`lib/nldp-citations.ts`). `parsed: false` with `cited: null` is a
  correct, expected answer for anything not confidently matched. Never
  widen the parser to guess: a wrong citation becomes a false authority
  edge downstream, which is worse than none.

## Determinism

Export → import → export is byte-identical apart from
`metadata.createdAt`. Nothing inside `data` carries a wall-clock stamp
(`directiveMetadata.lastModified` is written only when a caller supplies
one), because the receiving pipeline requires idempotent ingest.

## Importing

`importNLDPFile` (lib/nldp-utils.ts) accepts versions `1.0` and `1.1`.
Integrity mismatches are reported as warnings, not failures — the hashes
detect corruption, they are not a security control. The app's import
path also still accepts the legacy ad-hoc export shape that predates the
canonical module.

## Samples

- `sample-directive.nldp` — working export, regenerated through the real
  module (genuine hashes).
- `examples/sample-directive.release.nldp` — Release export with a fake
  but well-formed signed-artifact hash.
- Regenerate both with
  `npx vite-node --config vitest.config.ts scripts/generate-nldp-samples.mts`.

## Retired: Policy-as-Data (USLM) export

`lib/policy-as-data.ts` is deprecated and its menu entry removed
(docs/POLICY_AS_DATA_HANDOFF.md section 3). SemperScribe emits NLDP and
nothing else; the policy-as-data repository derives its canonical record
from NLDP 1.1 Release packages.
