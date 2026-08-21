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
  }
}
```

## Lifecycle

`draft → review → final → signed → promulgated` (plus `cancelled`).

`final` means **drafting is complete** — it does not mean a commander
signed the document. The `signed` and `promulgated` states were added in
1.1 precisely so a package cannot claim to be policy while saying only
that someone finished typing it.

The drafter chooses the value in the export dialog and it is written to
`data.directiveMetadata.status`. Omitting it defaults to `draft`, which
is the safe direction: understating status never publishes a draft as
policy, overstating it does.

**This is an assertion, not evidence.** The file is plain JSON and anyone
can hand-edit it. Verification against the issuing authority's copy is
the receiving policy-as-data side's job, because it is the only side
holding an authoritative copy to compare against.

## The export

One data-package action: **"Save as Data Package (.nldp)..."** in the
Export menu. It opens the lifecycle dialog, then writes the file.

The Release export (`.release.nldp`) and its G1–G7 gates were withdrawn
on 2026-08-20. See `docs/POLICY_AS_DATA_HANDOFF.md` section 5,
"Reversal", for the reasoning.

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
- Regenerate it with
  `npx vite-node --config vitest.config.ts scripts/generate-nldp-samples.mts`.

## Retired paths

- **Policy-as-Data (USLM) export.** Menu entry removed at `0f2ce34`,
  module deleted 2026-08-20 (handoff section 3).
- **Release packages.** `lib/release.ts`, `ReleaseNLDPDialog`, the
  `release` block and the G1–G7 gates, removed 2026-08-20 (handoff
  section 5, "Reversal").

SemperScribe emits NLDP and nothing else. The policy-as-data repository
derives its canonical record from the NLDP 1.1 package plus its own
verification against the authoritative source.
