# NAVMC 11106 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the NAVMC 11106 Application for Cost-of-Living Allowances as a document type: EDIPI instead of SSN, Part A computed from the dependents entered, command-sponsorship dates driven by a per-dependent basis, exported as the official form in plain fillable format.

**Architecture:** A normalized bundled blank (XFA, usage rights, and dead buttons removed; label changed to EDIPI) is filled through the existing generic `acroform-fill.ts`, the same route as NAVMC 10132, so preview and export share one path. All entitlement logic lives in a pure rules module and a pure validators module. The UI is custom row and radio components interleaved with narrow `DynamicForm` instances, the 10922 pattern.

**Tech Stack:** Next.js, React, TypeScript, Zod, pdf-lib, Radix UI, Vitest with Testing Library. Python 3 with pypdf and PyMuPDF for the one-time blank normalization.

**Spec:** `docs/NAVMC_11106_SPEC.md`. It is the rule source. Read it before any task.

## Global Constraints

- Date fields print `YYYY-MM-DD`, the form's own template picture. Internal storage is ISO, so no conversion.
- EDIPI validates as `/^\d{10}$/`. The AcroForm field keeps its source name `SocSecNoApplc[0]`. The data key is `edipi`.
- Part A is never user-selected. Only `partAValue()` decides it.
- Only `core-fields` blocks export. Every other validator is `fail` or `warn`.
- The app never writes `SigMem[0]` or `SigCO[0]` and never draws a signature.
- Part D starts empty. No default values anywhere in the blank or the schema.
- Nothing from the AskMCAAT source emails enters this repo beyond ruling IDs.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit to this branch only. Do not push or open a PR unless the owner asks.
- RHF rule from the 10922 build: a key written by a custom component must not appear in a `DynamicForm` section, or the form clobbers it on its next sync.

## File map

| File | Responsibility |
|---|---|
| `tools/aa-forms/normalize_11106.py` | Generates the blank and field map from the library source |
| `public/forms/navmc-11106-blank.pdf` | Normalized bundled blank |
| `tools/aa-forms/navmc11106-map.json` | Field names, types, radio values, limits, source hash |
| `src/lib/acroform-fill.ts` | Gains a generic radio branch |
| `src/types/navmc.ts` | `Navmc11106Dependent`, sponsorship bases |
| `src/lib/navmc11106-rules.ts` | Part A, C10, D3, Remarks, field values. Pure |
| `src/lib/navmc11106-validators.ts` | Spec section 10. Pure |
| `src/lib/navmc11106-export.ts` | Fills the blank, throws on a failed fill |
| `src/lib/schemas.ts` | Schema, definition, registration |
| `src/components/letter/Navmc11106Sections.tsx` | The form UI |
| Registration points | Spec section 12 |

---

### Task 1: Normalized blank and field map

**Files:**
- Create: `tools/aa-forms/normalize_11106.py`, `public/forms/navmc-11106-blank.pdf`, `tools/aa-forms/navmc11106-map.json`
- Modify: `src/lib/xfa-form-fill.ts` (`officialFormAsset`), `tools/aa-forms/README.md`, `tests/assets.test.ts`
- Test: `tests/navmc11106-blank.test.ts`

**Interfaces:**
- Produces: `public/forms/navmc-11106-blank.pdf`; `tools/aa-forms/navmc11106-map.json` with shape `{ form, container, sourceSha256, fieldCount, fields: [{ name, type, maxLength?, flags, exportValues? }] }`; `officialFormAsset('navmc11106') === 'forms/navmc-11106-blank.pdf'`.

- [ ] **Step 1: Install dependencies and confirm a clean baseline**

The worktree has no `node_modules`.

Run: `npm ci`
Then run: `npx vitest run tests/assets.test.ts tests/navmc10132-acroform.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the failing test**

Create `tests/navmc11106-blank.test.ts`. It runs in the Node environment because pdfjs needs it, the same as `tests/directive-heading-format.test.ts`. The other suites in this plan run under jsdom, so they keep the `new Uint8Array` copy: there a raw Buffer fails pdf-lib's realm check (see the header of `tests/navmc10132-acroform.test.ts`).

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  PDFDict, PDFDocument, PDFName, PDFButton, PDFRadioGroup, PDFSignature, PDFTextField,
} from 'pdf-lib';
import map from '../tools/aa-forms/navmc11106-map.json';

const here = dirname(fileURLToPath(import.meta.url));
const blankPath = resolve(here, '../public/forms/navmc-11106-blank.pdf');

let bytes: Uint8Array;
let doc: PDFDocument;

beforeAll(async () => {
  bytes = new Uint8Array(readFileSync(blankPath));
  doc = await PDFDocument.load(bytes);
});

describe('NAVMC 11106 normalized blank', () => {
  it('has no XFA layer, usage rights, or document JavaScript', () => {
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    expect(acro.has(PDFName.of('XFA'))).toBe(false);
    expect(doc.catalog.has(PDFName.of('Perms'))).toBe(false);
    const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(names?.has(PDFName.of('JavaScript')) ?? false).toBe(false);
  });

  it('dropped the Print and Reset buttons and kept both signature fields', () => {
    const fields = doc.getForm().getFields();
    expect(fields.filter((f) => f instanceof PDFButton)).toHaveLength(0);
    const sigs = fields.filter((f) => f instanceof PDFSignature).map((f) => f.getName());
    expect(sigs.sort()).toEqual([
      'topmostSubform[0].Page1[0].SigCO[0]',
      'topmostSubform[0].Page1[0].SigMem[0]',
    ]);
  });

  it('carries no preset values', () => {
    for (const f of doc.getForm().getFields()) {
      if (f instanceof PDFTextField) expect(f.getText() ?? '').toBe('');
      if (f instanceof PDFRadioGroup) expect(f.getSelected()).toBeUndefined();
    }
  });

  it('keeps the form radio appearances, so pdf-lib will not redraw them as dots', () => {
    for (const f of doc.getForm().getFields()) {
      if (f instanceof PDFRadioGroup) expect(f.needsAppearancesUpdate()).toBe(false);
    }
  });

  it('prints EDIPI and no longer prints SSN', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loaded = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const content = await (await loaded.getPage(1)).getTextContent();
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(text).toContain('EDIPI');
    expect(text).not.toContain('SSN');
  });

  it('matches its field map', () => {
    const names = doc.getForm().getFields().map((f) => f.getName()).sort();
    expect(map.fields.map((f) => f.name).sort()).toEqual(names);
    expect(map.fieldCount).toBe(45);
    expect(map.sourceSha256).toBe('8d2bfef56dbc0a1ad75337968724b0a3ea4d92a19faad8875307c27ca13b2485');
  });
});
```

The count is 36 text fields, 7 radio groups, 2 signatures.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/navmc11106-blank.test.ts`
Expected: FAIL. The map import and blank do not exist.

- [ ] **Step 4: Write the normalizer**

Create `tools/aa-forms/normalize_11106.py`:

```python
#!/usr/bin/env python3
"""Generate the bundled NAVMC 11106 blank and field map. Spec section 7.

The source is a STATIC XFA form: real page content, an AcroForm widget for
every field. Removing the XFA layer leaves a plain fillable form that takes
the 10132 route through src/lib/acroform-fill.ts.

Usage:
    python tools/aa-forms/normalize_11106.py <NAVMC 11106 (EF).pdf> \
        public/forms/navmc-11106-blank.pdf tools/aa-forms/navmc11106-map.json

Requires pypdf and PyMuPDF. Fails loudly if the source revision changes.
"""
import hashlib
import json
import os
import sys
import tempfile

import pymupdf
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    FloatObject,
    NameObject,
    TextStringObject,
)

EXPECTED_SOURCE_SHA256 = "8d2bfef56dbc0a1ad75337968724b0a3ea4d92a19faad8875307c27ca13b2485"
PREFIX = "topmostSubform[0].Page1[0]."
DROP = {"PrintButton1[0]", "ResetButton1[0]"}
LABEL_RECT = pymupdf.Rect(474.0, 150.0, 490.0, 158.5)
LABEL_ORIGIN = (474.8, 157.2)
HELV_AUTO = "/Helv 0 Tf 0 g"
# Auto-size fills a multiline field's whole box, so these two are fixed.
FIXED_DA = {"DutyStatn[0]": "/Helv 10 Tf 0 g", "RemrkD3[0]": "/Helv 9 Tf 0 g"}
FF_MULTILINE = 1 << 12


def add_off_state(writer, widget):
    """pdf-lib regenerates a radio whose /AS is missing from /N, which redraws
    the form's X marks as round dots. The source ships only the on state."""
    normal = widget["/AP"]["/N"].get_object()
    if "/Off" in normal:
        return
    x0, y0, x1, y1 = [float(v) for v in widget["/Rect"]]
    off = DecodedStreamObject()
    off.update({
        NameObject("/Type"): NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/BBox"): ArrayObject(
            [FloatObject(0), FloatObject(0), FloatObject(x1 - x0), FloatObject(y1 - y0)]
        ),
    })
    off.set_data(b"")
    normal[NameObject("/Off")] = writer._add_object(off)


def strip_xfa(src, tmp):
    w = PdfWriter(clone_from=src)
    root = w._root_object
    af = root["/AcroForm"].get_object()
    del af[NameObject("/XFA")]
    for key in ("/Perms", "/NeedsRendering"):
        if key in root:
            del root[NameObject(key)]
    if "/Names" in root:
        names = root["/Names"].get_object()
        if "/JavaScript" in names:
            del names[NameObject("/JavaScript")]

    page = w.pages[0]
    kept = ArrayObject()
    for ref in page["/Annots"]:
        o = ref.get_object()
        if o.get("/T") in DROP:
            continue
        kept.append(ref)
        if o.get("/FT") == "/Tx":
            o[NameObject("/DA")] = TextStringObject(FIXED_DA.get(o.get("/T"), HELV_AUTO))
        if o.get("/T") == "SocSecNoApplc[0]":
            o[NameObject("/TU")] = TextStringObject("Enter applicant's 10-digit EDIPI.")
        parent = o["/Parent"].get_object() if "/Parent" in o else None
        if parent is not None and parent.get("/FT") == "/Btn" and "/AP" in o:
            add_off_state(w, o)
    page[NameObject("/Annots")] = kept

    def prune(node):
        kids = node.get("/Kids")
        if kids is None:
            return
        out = ArrayObject()
        for ref in kids:
            kid = ref.get_object()
            if kid.get("/T") in DROP:
                continue
            prune(kid)
            out.append(ref)
        node[NameObject("/Kids")] = out

    for ref in af["/Fields"]:
        prune(ref.get_object())
    af[NameObject("/DA")] = TextStringObject(HELV_AUTO)
    w.write(tmp)


def relabel(tmp, out):
    d = pymupdf.open(tmp)
    page = d[0]
    page.add_redact_annot(LABEL_RECT)
    page.apply_redactions(
        images=pymupdf.PDF_REDACT_IMAGE_NONE,
        graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
    )
    page.insert_text(LABEL_ORIGIN, "EDIPI", fontname="helv", fontsize=7.0)
    d.save(out, garbage=3, deflate=True)
    d.close()


def verify(out):
    r = PdfReader(out)
    root = r.trailer["/Root"]
    af = root["/AcroForm"].get_object()
    assert "/XFA" not in af, "XFA survived"
    assert "/Perms" not in root, "usage rights survived"
    fields = r.get_fields()
    names = {k.split(".")[-1] for k in fields}
    assert not (names & DROP), names & DROP
    assert {"SigMem[0]", "SigCO[0]"} <= names
    for key, value in fields.items():
        assert value.get("/V") in (None, ""), (key, value.get("/V"))
    page = pymupdf.open(out)[0]
    text = page.get_text()
    assert "EDIPI" in text and "SSN" not in text
    assert len(page.search_for("EDIPI")) == 1


def build_map(out, source_sha):
    r = PdfReader(out)
    fields = {}
    for ref in r.pages[0]["/Annots"]:
        o = ref.get_object()
        parent = o["/Parent"].get_object() if "/Parent" in o else None
        if parent is not None and parent.get("/FT") == "/Btn":
            title = str(parent["/T"])
            entry = fields.setdefault(
                title, {"name": PREFIX + title, "type": "/Btn", "flags": ["radio"], "exportValues": []}
            )
            normal = o["/AP"]["/N"].get_object()
            entry["exportValues"] += [str(k)[1:] for k in normal.keys() if k != "/Off"]
            entry["exportValues"].sort()
        else:
            title = str(o["/T"])
            ff = int(o.get("/Ff", 0))
            entry = {"name": PREFIX + title, "type": str(o["/FT"]), "flags": []}
            if ff & FF_MULTILINE:
                entry["flags"].append("multiline")
            if o.get("/MaxLen") is not None:
                entry["maxLength"] = int(o["/MaxLen"])
            fields[title] = entry
    return {
        "form": "NAVMC 11106 (REV. 1-89) (EF)",
        "container": "AcroForm",
        "sourceSha256": source_sha,
        "fieldCount": len(fields),
        "fields": sorted(fields.values(), key=lambda f: f["name"]),
    }


def main():
    src, out, map_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(src, "rb") as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()
    if sha != EXPECTED_SOURCE_SHA256:
        raise SystemExit(f"Source changed: {sha}. Re-verify the spec before regenerating.")
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "stripped.pdf")
        strip_xfa(src, tmp)
        relabel(tmp, out)
    verify(out)
    with open(map_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(build_map(out, sha), fh, indent=2)
        fh.write("\n")
    print("ok", out, os.path.getsize(out))


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Generate the blank and map**

Run: `python tools/aa-forms/normalize_11106.py "E:/GunnyBot/Policies/NAVMC_Forms/NAVMC 11106 (EF).pdf" public/forms/navmc-11106-blank.pdf tools/aa-forms/navmc11106-map.json`
Expected: `ok public/forms/navmc-11106-blank.pdf <size>`. Size is about 105 KB.

- [ ] **Step 6: Register the asset**

In `src/lib/xfa-form-fill.ts`, inside `officialFormAsset`, after the `navmc10132` line:

```ts
    : documentType === 'navmc11106' ? 'forms/navmc-11106-blank.pdf'
```

Update the comment above it to read "NAVMC 10132 and 11106 are plain AcroForms, not XFA. They are registered here because this is the one place that maps a document type to its bundled blank, but they fill through their own export modules, never through exportOfficialForm below."

In `tests/assets.test.ts`, change the list to:

```ts
    for (const type of ['aa-form', 'page11', 'navmc10922', 'navmc10132', 'navmc11106']) {
```

Add to `tools/aa-forms/README.md`, after the NAVMC 10922 section:

```markdown
## NAVMC 11106 blank

`public/forms/navmc-11106-blank.pdf` and `navmc11106-map.json` are generated by
`normalize_11106.py`. The source is a static XFA form, so removing the XFA layer
leaves a plain AcroForm that fills through `src/lib/acroform-fill.ts`. The printed
SSN label is changed to EDIPI by owner ruling. Rule source: `docs/NAVMC_11106_SPEC.md`.
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/navmc11106-blank.test.ts tests/assets.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/aa-forms/normalize_11106.py tools/aa-forms/navmc11106-map.json tools/aa-forms/README.md public/forms/navmc-11106-blank.pdf src/lib/xfa-form-fill.ts tests/navmc11106-blank.test.ts tests/assets.test.ts docs/NAVMC_11106_SPEC.md docs/NAVMC_11106_BUILD_PLAN.md
git commit -m "feat(navmc11106): add normalized blank with EDIPI label and field map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Radio support in the AcroForm filler

**Files:**
- Modify: `src/lib/acroform-fill.ts`
- Test: `tests/acroform-fill-radio.test.ts`

**Interfaces:**
- Consumes: `public/forms/navmc-11106-blank.pdf`.
- Produces: `fillAcroFormWithReport` writes a string value to a `PDFRadioGroup`. An invalid value lands in `report.errors`. `/Btn` radios no longer land in `report.skipped`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument, PDFDict, PDFRadioGroup } from 'pdf-lib';
import { fillAcroFormWithReport, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import map from '../tools/aa-forms/navmc11106-map.json';

const here = dirname(fileURLToPath(import.meta.url));
const blank = () => new Uint8Array(readFileSync(resolve(here, '../public/forms/navmc-11106-blank.pdf')));
const fields = map.fields as AcroFormFieldMeta[];
const RAD = 'topmostSubform[0].Page1[0].RadA1[0]';

describe('acroform-fill radio groups', () => {
  it('selects the value and reports it written', async () => {
    const { bytes, report } = await fillAcroFormWithReport(blank(), { [RAD]: 'both' }, { fields });
    expect(report.written).toContain(RAD);
    expect(report.errors).toEqual([]);
    const group = (await PDFDocument.load(bytes)).getForm().getRadioGroup(RAD);
    expect(group.getSelected()).toBe('both');
  });

  it('keeps the form appearance streams rather than redrawing them', async () => {
    const before = (await PDFDocument.load(blank())).getForm().getRadioGroup(RAD);
    const refsBefore = before.acroField.getWidgets().map((w) => w.getAppearances()?.normal);
    expect(refsBefore.every((n) => n instanceof PDFDict)).toBe(true);

    const { bytes } = await fillAcroFormWithReport(blank(), { [RAD]: 'both' }, { fields });
    const group = (await PDFDocument.load(bytes)).getForm().getRadioGroup(RAD);
    expect(group.needsAppearancesUpdate()).toBe(false);
    const states = group.acroField.getWidgets().map((w) => w.getAppearanceState()?.toString());
    expect(states.sort()).toEqual(['/Off', '/Off', '/both']);
  });

  it('reports a bad value instead of throwing, and leaves the group unset', async () => {
    const { bytes, report } = await fillAcroFormWithReport(blank(), { [RAD]: 'nope' }, { fields });
    expect(report.errors[0][0]).toBe(RAD);
    const field = (await PDFDocument.load(bytes)).getForm().getField(RAD);
    expect(field).toBeInstanceOf(PDFRadioGroup);
    expect((field as PDFRadioGroup).getSelected()).toBeUndefined();
  });

  it('leaves untouched groups unset', async () => {
    const { bytes } = await fillAcroFormWithReport(blank(), { [RAD]: 'mem' }, { fields });
    const other = (await PDFDocument.load(bytes)).getForm().getRadioGroup('topmostSubform[0].Page1[0].RadD2B1[0]');
    expect(other.getSelected()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/acroform-fill-radio.test.ts`
Expected: FAIL. `report.written` lacks the radio, because it lands in `report.skipped` as `PDFRadioGroup`.

- [ ] **Step 3: Write the implementation**

In `src/lib/acroform-fill.ts`, add `PDFRadioGroup` to the pdf-lib import. Add this branch before the final `else` in the write loop:

```ts
      } else if (field instanceof PDFRadioGroup) {
        // Written directly, NOT with field.select(). select() marks the group
        // dirty, and updateFieldAppearances() then replaces the form's own
        // appearance streams with pdf-lib's round dots. Measured on NAVMC
        // 11106, whose X marks came back as circles. The blank must carry an
        // /Off state on each widget, or pdf-lib regenerates the group anyway.
        const exportValue = String(value);
        if (!field.getOptions().includes(exportValue)) {
          report.errors.push([name, `"${exportValue}" is not an export value`]);
          continue;
        }
        const on = PDFName.of(exportValue);
        field.acroField.dict.set(PDFName.of('V'), on);
        for (const widget of field.acroField.getWidgets()) {
          widget.setAppearanceState(widget.getOnValue() === on ? on : PDFName.of('Off'));
        }
        report.written.push(name);
```

Add a fifth item to the module header comment, after item 3:

```text
 * 4. A RADIO GROUP IS WRITTEN AT THE DICTIONARY LEVEL, BECAUSE pdf-lib's OWN
 *    select() REDRAWS IT. See the branch in the write loop. A form whose
 *    widgets lack an /Off appearance gets regenerated regardless, so that
 *    must be fixed in the bundled blank (tools/aa-forms/normalize_11106.py).
```

Renumber the existing "A fourth, smaller thing" paragraph's opening to "A fifth, smaller thing".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/acroform-fill-radio.test.ts tests/navmc10132-acroform.test.ts`
Expected: PASS. The 10132 suite proves nothing regressed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/acroform-fill.ts tests/acroform-fill-radio.test.ts
git commit -m "feat(acroform-fill): write radio groups without redrawing the form's marks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Data types and rules module

**Files:**
- Modify: `src/types/navmc.ts`
- Create: `src/lib/navmc11106-rules.ts`
- Test: `tests/navmc11106-rules.test.ts`

**Interfaces:**
- Produces, from `@/types/navmc`: `NAVMC_11106_SPONSORSHIP_BASES`, `Navmc11106SponsorshipBasis`, `Navmc11106Dependent`, `NAVMC_11106_EMPTY_DEPENDENT`.
- Produces, from `@/lib/navmc11106-rules`:
  - `NAVMC_11106_MAX_DEPENDENTS: 6`, `NAVMC_11106_REMARKS_LIMIT: 720`
  - `NAVMC_11106_BASIS_INFO: Record<Navmc11106SponsorshipBasis, { label: string; hint: string; dated: boolean; counted: boolean }>`
  - `type Navmc11106PartA = 'mem' | 'both' | 'dep'`
  - `rowHasContent(row): boolean`
  - `spouseRow(data): Navmc11106Dependent`, `dependentRows(data): Navmc11106Dependent[]`
  - `countedSpouse(data): Navmc11106Dependent | null`, `countedChildren(data): Navmc11106Dependent[]`, `countedDependents(data): Navmc11106Dependent[]`
  - `partAValue(data): Navmc11106PartA`
  - `withDependentsOnlyReset<T extends FormData>(data: T): T`
  - `effectiveSponsoredOn(row): string`, `commandSponsoredDate(data): string`
  - `suggestedEffectiveDate(data): string`
  - `generatedRemarks(data): string[]`, `combinedRemarks(data): string`
  - `navmc11106Values(data): Record<string, string>`

- [ ] **Step 1: Add the types**

Append to `src/types/navmc.ts`:

```ts
// --- NAVMC 11106 (REV. 1-89) Application for Cost-of-Living Allowances ---
// Rule source: docs/NAVMC_11106_SPEC.md. Field map:
// tools/aa-forms/navmc11106-map.json.

export const NAVMC_11106_SPONSORSHIP_BASES = [
  'installation-approval',
  'cmc-conversion',
  'command-award',
  'birth',
  'adoption-placement',
  'dual-mil-separation',
  'not-required',
  'designated-place',
  'not-sponsored',
  'active-duty-spouse',
] as const;
export type Navmc11106SponsorshipBasis = (typeof NAVMC_11106_SPONSORSHIP_BASES)[number];

export interface Navmc11106Dependent {
  name: string;
  relationship: string;
  /** ISO. Date of marriage on the spouse row, date of birth otherwise. */
  eventDate: string;
  sponsorshipBasis: '' | Navmc11106SponsorshipBasis;
  /** ISO. Empty for bases that carry no date. Not printed by row. */
  sponsoredOn: string;
}

export const NAVMC_11106_EMPTY_DEPENDENT: Navmc11106Dependent = {
  name: '',
  relationship: '',
  eventDate: '',
  sponsorshipBasis: '',
  sponsoredOn: '',
};
```

- [ ] **Step 2: Write the failing test**

Create `tests/navmc11106-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT, type Navmc11106Dependent } from '@/types/navmc';
import {
  commandSponsoredDate,
  combinedRemarks,
  countedDependents,
  generatedRemarks,
  navmc11106Values,
  partAValue,
  suggestedEffectiveDate,
  withDependentsOnlyReset,
} from '@/lib/navmc11106-rules';

const P = 'topmostSubform[0].Page1[0].';
const row = (over: Partial<Navmc11106Dependent>): Navmc11106Dependent => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...over });
const form = (over: Record<string, unknown> = {}) => ({ documentType: 'navmc11106', ...over }) as unknown as FormData;
const child = (over: Partial<Navmc11106Dependent> = {}) =>
  row({ name: 'MARINE, TEST JR', relationship: 'SON', eventDate: '2021-02-03', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01', ...over });

describe('Part A is computed from the dependents entered', () => {
  it('is member only with no dependents', () => {
    expect(partAValue(form())).toBe('mem');
  });

  it('ignores blank rows', () => {
    expect(partAValue(form({ navmc11106Dependents: [row({}), row({})] }))).toBe('mem');
  });

  it('is member and dependents once a dependent is added', () => {
    expect(partAValue(form({ navmc11106Dependents: [child()] }))).toBe('both');
  });

  it('counts a spouse alone', () => {
    expect(partAValue(form({ navmc11106Spouse: row({ name: 'MARINE, ALEX' }) }))).toBe('both');
  });

  it('is dependents only when the option is on and dependents exist', () => {
    expect(partAValue(form({ navmc11106Dependents: [child()], dependentsOnly: true }))).toBe('dep');
  });

  it('ignores the option when no dependents exist', () => {
    expect(partAValue(form({ dependentsOnly: true }))).toBe('mem');
  });

  it.each(['not-sponsored', 'active-duty-spouse'] as const)('does not count a %s row', (basis) => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: basis })] });
    expect(countedDependents(data)).toHaveLength(0);
    expect(partAValue(data)).toBe('mem');
  });

  it('resets the option when the last counted dependent is gone', () => {
    const data = form({ dependentsOnly: true, conusColaDependents: true, conusColaZip: '92055' });
    expect(withDependentsOnlyReset(data)).toMatchObject({ dependentsOnly: false, conusColaDependents: false, conusColaZip: '' });
  });

  it('leaves the option alone while dependents remain', () => {
    const data = form({ dependentsOnly: true, navmc11106Dependents: [child()] });
    expect(withDependentsOnlyReset(data).dependentsOnly).toBe(true);
  });
});

describe('command sponsored date', () => {
  it('prints the latest date among counted rows', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' }),
      navmc11106Dependents: [child({ sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' })],
    });
    expect(commandSponsoredDate(data)).toBe('2026-08-03');
  });

  it('ignores rows whose basis carries no date', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-required', sponsoredOn: '2026-01-01' })] });
    expect(commandSponsoredDate(data)).toBe('');
  });
});

describe('suggested D3 date', () => {
  it('member only uses the arrival date', () => {
    expect(suggestedEffectiveDate(form({ dateOfArrival: '2026-06-01' }))).toBe('2026-06-01');
  });

  it('member only moves a day with MALT Plus on the reporting day', () => {
    expect(suggestedEffectiveDate(form({ dateOfArrival: '2026-06-30', maltPlusOnReportingDay: true }))).toBe('2026-07-01');
  });

  it('with dependents uses the later of arrival and sponsorship', () => {
    const base = { navmc11106Dependents: [child()] };
    expect(suggestedEffectiveDate(form({ ...base, dependentsArrived: '2026-06-10' }))).toBe('2026-06-10');
    expect(suggestedEffectiveDate(form({ ...base, dependentsArrived: '2026-03-01' }))).toBe('2026-04-01');
  });

  it('with no arrival date, trusts sponsorship only for a dependent already there', () => {
    expect(suggestedEffectiveDate(form({ navmc11106Dependents: [child()] }))).toBe('');
    const born = child({ sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' });
    expect(suggestedEffectiveDate(form({ navmc11106Dependents: [born] }))).toBe('2026-08-03');
  });

  it('with no sponsorship date, falls back to arrival', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-required', sponsoredOn: '' })], dependentsArrived: '2026-06-10' });
    expect(suggestedEffectiveDate(data)).toBe('2026-06-10');
  });

  it('dependents only uses the dependents arrival', () => {
    const data = form({ navmc11106Dependents: [child()], dependentsOnly: true, dependentsArrived: '2026-06-10' });
    expect(suggestedEffectiveDate(data)).toBe('2026-06-10');
  });
});

describe('generated Remarks', () => {
  it('lists rows whose date differs from the printed C10', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' }),
      navmc11106Dependents: [child({ name: 'BABY', sponsorshipBasis: 'birth', eventDate: '2026-08-03', sponsoredOn: '' })],
    });
    expect(generatedRemarks(data)).toEqual(['C10: S COMMAND SPONSORED 2026-04-01.']);
  });

  it('states the basis for rows with no date', () => {
    const data = form({
      navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'not-required' }),
      navmc11106Dependents: [child({ name: 'K', sponsorshipBasis: 'designated-place', sponsoredOn: '' })],
    });
    expect(generatedRemarks(data)).toEqual([
      'S: COMMAND SPONSORSHIP NOT REQUIRED.',
      'K: PAID AT DEPENDENT LOCATION.',
    ]);
  });

  it('adds the CONUS line only on a dependents-only application', () => {
    const on = form({ navmc11106Dependents: [child()], dependentsOnly: true, conusColaDependents: true, conusColaZip: '92055' });
    expect(generatedRemarks(on)).toContain('CONUS COLA. ZIP 92055.');
    const off = form({ navmc11106Dependents: [child()], conusColaDependents: true, conusColaZip: '92055' });
    expect(generatedRemarks(off)).not.toContain('CONUS COLA. ZIP 92055.');
  });

  it('puts the user text first', () => {
    const data = form({ navmc11106Remarks: 'SEE ORDERS.', navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'not-required' }) });
    expect(combinedRemarks(data)).toBe('SEE ORDERS. S: COMMAND SPONSORSHIP NOT REQUIRED.');
  });
});

describe('field values', () => {
  it('sets Part A and writes the EDIPI to the source field name', () => {
    const values = navmc11106Values(form({ edipi: '1234567890' }));
    expect(values[`${P}RadA1[0]`]).toBe('mem');
    expect(values[`${P}SocSecNoApplc[0]`]).toBe('1234567890');
  });

  it('closes up excluded rows so printed rows have no gaps', () => {
    const values = navmc11106Values(form({
      navmc11106Dependents: [child({ name: 'SKIP', sponsorshipBasis: 'not-sponsored' }), child({ name: 'KEEP' })],
    }));
    expect(values[`${P}NameDep2[0]`]).toBe('KEEP');
    expect(values[`${P}NameDep3[0]`]).toBe('');
  });

  it('defaults the spouse relationship and leaves an excluded spouse off row 1', () => {
    const counted = navmc11106Values(form({ navmc11106Spouse: row({ name: 'S', eventDate: '2019-05-04', sponsorshipBasis: 'installation-approval' }) }));
    expect(counted[`${P}NameSps1[0]`]).toBe('S');
    expect(counted[`${P}RelatnshpSps1[0]`]).toBe('SPOUSE');
    expect(counted[`${P}DateMarr[0]`]).toBe('2019-05-04');
    const excluded = navmc11106Values(form({ navmc11106Spouse: row({ name: 'S', sponsorshipBasis: 'active-duty-spouse' }) }));
    expect(excluded[`${P}NameSps1[0]`]).toBe('');
  });

  it('passes Part D through and never writes a signature', () => {
    const values = navmc11106Values(form({ d1Quarters: 'n', d1Assignment: 'no', d2b: 'y' }));
    expect(values[`${P}RadD1AvailNot[0]`]).toBe('n');
    expect(values[`${P}RadD1AssnNot[0]`]).toBe('no');
    expect(values[`${P}RadD2B1[0]`]).toBe('y');
    expect(`${P}SigMem[0]` in values).toBe(false);
    expect(`${P}SigCO[0]` in values).toBe(false);
  });

  it('caps Remarks at the form limit so the fill cannot fail on length', () => {
    const values = navmc11106Values(form({ navmc11106Remarks: 'X'.repeat(900) }));
    expect(values[`${P}RemrkD3[0]`]).toHaveLength(720);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/navmc11106-rules.test.ts`
Expected: FAIL with a module-not-found error on `@/lib/navmc11106-rules`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/navmc11106-rules.ts`:

```ts
/**
 * NAVMC 11106 rules. Pure functions, no UI or PDF imports.
 * Rule source: docs/NAVMC_11106_SPEC.md sections 3, 4, and 9.
 */
import type { FormData } from '@/types';
import {
  NAVMC_11106_EMPTY_DEPENDENT,
  type Navmc11106Dependent,
  type Navmc11106SponsorshipBasis,
} from '@/types/navmc';

const P = 'topmostSubform[0].Page1[0].';

export const NAVMC_11106_MAX_DEPENDENTS = 6;
export const NAVMC_11106_REMARKS_LIMIT = 720;

export type Navmc11106PartA = 'mem' | 'both' | 'dep';

export const NAVMC_11106_BASIS_INFO: Record<
  Navmc11106SponsorshipBasis,
  { label: string; hint: string; dated: boolean; counted: boolean }
> = {
  'installation-approval': {
    label: 'Approved by gaining installation',
    hint: 'Approval date from the installation G-1/S-1 message or orders endorsement (MCO 1300.8 Ch 6 par 4.b(4), 5).',
    dated: true,
    counted: true,
  },
  'cmc-conversion': {
    label: 'CMC approved tour conversion',
    hint: 'Date CMC approved the unaccompanied-to-accompanied conversion (MCO 1300.8 Ch 6 par 9.e(1)).',
    dated: true,
    counted: true,
  },
  'command-award': {
    label: 'Command awarded sponsorship',
    hint: 'Date the command awarded sponsorship to an acquired or formerly non-sponsored dependent, no tour conversion needed (MCO 1300.8 Ch 6 par 6.e, 7.c).',
    dated: true,
    counted: true,
  },
  birth: {
    label: 'Born during the tour',
    hint: 'Sponsored at birth during an accompanied tour, or to a female Marine on an unaccompanied or dependent-restricted tour. Uses the date of birth (MCO 1300.8 Ch 6 par 6.b).',
    dated: true,
    counted: true,
  },
  'adoption-placement': {
    label: 'Adoption placement',
    hint: 'Date placed in the home, including pre-adoptive placement (MCO 1300.8 Ch 6 par 6.d).',
    dated: true,
    counted: true,
  },
  'dual-mil-separation': {
    label: 'Spouse separated from service overseas',
    hint: 'Day after separation, if the remaining member serves the accompanied tour and the spouse did not travel to CONUS at Government expense (MCO 1300.8 Ch 6 par 5.c).',
    dated: true,
    counted: true,
  },
  'not-required': {
    label: 'Sponsorship not required (exception)',
    hint: 'An exception applies, such as marriage to a Service member on the PCS effective date. No date. The basis prints in Remarks (FMR Vol 7A Ch 68 par 2.2.3).',
    dated: false,
    counted: true,
  },
  'designated-place': {
    label: 'Unaccompanied, paid at dependent location',
    hint: 'Dependents at the old PDS or a designated place. No date. The basis prints in Remarks (FMR Vol 7A Ch 68 par 2.2.2).',
    dated: false,
    counted: true,
  },
  'not-sponsored': {
    label: 'Not command sponsored',
    hint: 'Not claimable, so this row will not print or count (FMR Vol 7A Ch 68 par 3.6).',
    dated: false,
    counted: false,
  },
  'active-duty-spouse': {
    label: 'Spouse is on active duty',
    hint: 'An active-duty spouse is not a dependent, so this row will not print or count (FMR Vol 7A Ch 68 par 2.2.1, Table 68-5).',
    dated: false,
    counted: false,
  },
};

const ALREADY_AT_PDS: ReadonlySet<string> = new Set(['birth', 'adoption-placement', 'dual-mil-separation']);

const str = (data: FormData, key: string): string => String(data[key] ?? '');

export function rowHasContent(row: Navmc11106Dependent): boolean {
  return Boolean(row.name.trim() || row.relationship.trim() || row.eventDate || row.sponsorshipBasis || row.sponsoredOn);
}

const isCounted = (row: Navmc11106Dependent): boolean =>
  rowHasContent(row) && (row.sponsorshipBasis === '' || NAVMC_11106_BASIS_INFO[row.sponsorshipBasis].counted);

export function spouseRow(data: FormData): Navmc11106Dependent {
  return { ...NAVMC_11106_EMPTY_DEPENDENT, ...(data.navmc11106Spouse ?? {}) };
}

export function dependentRows(data: FormData): Navmc11106Dependent[] {
  const rows: Navmc11106Dependent[] = Array.isArray(data.navmc11106Dependents) ? data.navmc11106Dependents : [];
  return rows.map((r) => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...r }));
}

export function countedSpouse(data: FormData): Navmc11106Dependent | null {
  const spouse = spouseRow(data);
  return isCounted(spouse) ? spouse : null;
}

export function countedChildren(data: FormData): Navmc11106Dependent[] {
  return dependentRows(data).filter(isCounted).slice(0, NAVMC_11106_MAX_DEPENDENTS);
}

export function countedDependents(data: FormData): Navmc11106Dependent[] {
  const spouse = countedSpouse(data);
  return [...(spouse ? [spouse] : []), ...countedChildren(data)];
}

export function partAValue(data: FormData): Navmc11106PartA {
  if (countedDependents(data).length === 0) return 'mem';
  return data.dependentsOnly === true ? 'dep' : 'both';
}

/** Spec section 4: the option must not return on its own when dependents come back. */
export function withDependentsOnlyReset<T extends FormData>(data: T): T {
  if (countedDependents(data).length > 0) return data;
  return { ...data, dependentsOnly: false, conusColaDependents: false, conusColaZip: '' } as T;
}

export function effectiveSponsoredOn(row: Navmc11106Dependent): string {
  if (row.sponsorshipBasis === '' || !NAVMC_11106_BASIS_INFO[row.sponsorshipBasis].dated) return '';
  return row.sponsorshipBasis === 'birth' ? row.eventDate : row.sponsoredOn;
}

/** ISO dates sort lexically, so max is a string comparison. */
const latest = (dates: string[]): string => dates.filter(Boolean).sort().pop() ?? '';

export function commandSponsoredDate(data: FormData): string {
  return latest(countedDependents(data).map(effectiveSponsoredOn));
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Spec section 9.1. A suggestion only: the commander decides D3. */
export function suggestedEffectiveDate(data: FormData): string {
  const part = partAValue(data);
  if (part === 'mem') {
    const arrival = str(data, 'dateOfArrival');
    if (!arrival) return '';
    return data.maltPlusOnReportingDay === true ? nextDay(arrival) : arrival;
  }
  const arrived = str(data, 'dependentsArrived');
  if (part === 'dep') return arrived;
  const c10 = commandSponsoredDate(data);
  if (arrived) return latest([arrived, c10]);
  const latestRow = countedDependents(data).find((r) => effectiveSponsoredOn(r) === c10);
  return c10 && latestRow && ALREADY_AT_PDS.has(latestRow.sponsorshipBasis) ? c10 : '';
}

/** Spec section 9.2. */
export function generatedRemarks(data: FormData): string[] {
  const lines: string[] = [];
  const c10 = commandSponsoredDate(data);
  for (const row of countedDependents(data)) {
    const date = effectiveSponsoredOn(row);
    if (date && date !== c10) lines.push(`C10: ${row.name} COMMAND SPONSORED ${date}.`);
    if (row.sponsorshipBasis === 'not-required') lines.push(`${row.name}: COMMAND SPONSORSHIP NOT REQUIRED.`);
    if (row.sponsorshipBasis === 'designated-place') lines.push(`${row.name}: PAID AT DEPENDENT LOCATION.`);
  }
  if (partAValue(data) === 'dep' && data.conusColaDependents === true) {
    lines.push(`CONUS COLA. ZIP ${str(data, 'conusColaZip')}.`);
  }
  return lines;
}

export function combinedRemarks(data: FormData): string {
  return [str(data, 'navmc11106Remarks').trim(), ...generatedRemarks(data)].filter(Boolean).join(' ');
}

export function navmc11106Values(data: FormData): Record<string, string> {
  const values: Record<string, string> = {
    [`${P}RadA1[0]`]: partAValue(data),
    [`${P}NameApplc[0]`]: str(data, 'nameOfMarine'),
    [`${P}GrdApplc[0]`]: str(data, 'grade'),
    [`${P}DateRnk[0]`]: str(data, 'dateOfRank'),
    [`${P}SocSecNoApplc[0]`]: str(data, 'edipi'),
    [`${P}DutyStatn[0]`]: str(data, 'dutyStation'),
    [`${P}DateOrdrs[0]`]: str(data, 'ordersEffectiveDate'),
    [`${P}DateArrvl[0]`]: str(data, 'dateOfArrival'),
    [`${P}DepLoc[0]`]: str(data, 'dependentLocation'),
    [`${P}DateDepArrv[0]`]: str(data, 'dependentsArrived'),
    [`${P}DateDepComnd[0]`]: commandSponsoredDate(data),
    [`${P}DateMemSigntr[0]`]: str(data, 'memberSignedDate'),
    [`${P}RadD1AvailNot[0]`]: str(data, 'd1Quarters'),
    [`${P}RadD1AssnNot[0]`]: str(data, 'd1Assignment'),
    [`${P}RadD1ToMemDep[0]`]: str(data, 'd1ToWhom'),
    [`${P}RadD2AvailNot[0]`]: str(data, 'd2Mess'),
    [`${P}RadD2Mem[0]`]: str(data, 'd2Who'),
    [`${P}RadD2B1[0]`]: str(data, 'd2b'),
    [`${P}DateApplcEffct[0]`]: str(data, 'effectiveDate'),
    [`${P}RemrkD3[0]`]: combinedRemarks(data).slice(0, NAVMC_11106_REMARKS_LIMIT),
    [`${P}DateCmndOffcr[0]`]: str(data, 'coDate'),
    [`${P}NameComndOffcr[0]`]: str(data, 'coNameGradeActivity'),
  };

  const spouse = countedSpouse(data);
  values[`${P}NameSps1[0]`] = spouse?.name ?? '';
  values[`${P}RelatnshpSps1[0]`] = spouse ? spouse.relationship || 'SPOUSE' : '';
  values[`${P}DateMarr[0]`] = spouse?.eventDate ?? '';

  const children = countedChildren(data);
  for (let i = 0; i < NAVMC_11106_MAX_DEPENDENTS; i += 1) {
    const n = i + 2;
    values[`${P}NameDep${n}[0]`] = children[i]?.name ?? '';
    values[`${P}RelatnshpDep${n}[0]`] = children[i]?.relationship ?? '';
    values[`${P}DateDepBrth${n}[0]`] = children[i]?.eventDate ?? '';
  }
  return values;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/navmc11106-rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/navmc.ts src/lib/navmc11106-rules.ts tests/navmc11106-rules.test.ts
git commit -m "feat(navmc11106): compute Part A, C10, D3, and Remarks from entered data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Validators

**Files:**
- Create: `src/lib/navmc11106-validators.ts`
- Modify: `src/lib/letter-validators.ts`
- Test: `tests/navmc11106-validators.test.ts`

**Interfaces:**
- Consumes: everything Task 3 produces; `ValidationIssue` from `@/lib/letter-validators` as a type-only import, because that module imports this one at runtime.
- Produces: `runNavmc11106Validators(formData: FormData, now?: Date): ValidationIssue[]`, a no-op for other document types.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT, type Navmc11106Dependent } from '@/types/navmc';
import { runNavmc11106Validators } from '@/lib/navmc11106-validators';

const NOW = new Date(2026, 10, 5);
const row = (o: Partial<Navmc11106Dependent>): Navmc11106Dependent => ({ ...NAVMC_11106_EMPTY_DEPENDENT, ...o });
const CORE = { nameOfMarine: 'MARINE, TEST', grade: 'SGT', edipi: '1234567890', dutyStation: 'OKINAWA JP' };
const form = (o: Record<string, unknown> = {}) => ({ documentType: 'navmc11106', ...CORE, ...o }) as unknown as FormData;
const child = (o: Partial<Navmc11106Dependent> = {}) =>
  row({ name: 'K', relationship: 'SON', eventDate: '2021-02-03', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01', ...o });
const ids = (data: FormData) => runNavmc11106Validators(data, NOW).map((i) => i.id);
const sev = (data: FormData, id: string) => runNavmc11106Validators(data, NOW).find((i) => i.id === id)?.severity;

describe('navmc11106 validators', () => {
  it('is a no-op for other document types', () => {
    expect(runNavmc11106Validators({ documentType: 'basic' } as unknown as FormData, NOW)).toEqual([]);
  });

  it('is clean on a complete member-only application', () => {
    expect(ids(form())).toEqual([]);
  });

  it.each([
    ['nameOfMarine', ''], ['grade', ''], ['dutyStation', ''], ['edipi', '123'], ['edipi', '123-45-6789'],
  ])('blocks when %s is %s', (key, value) => {
    expect(sev(form({ [key]: value }), 'navmc11106-core-fields')).toBe('block');
  });

  it('is the only blocker', () => {
    const messy = form({ navmc11106Dependents: [row({ name: 'K' })], dependentsOnly: true, navmc11106Remarks: 'X'.repeat(900) });
    expect(runNavmc11106Validators(messy, NOW).filter((i) => i.severity === 'block')).toEqual([]);
  });

  it('fails an incomplete row', () => {
    expect(sev(form({ navmc11106Dependents: [child({ relationship: '' })] }), 'navmc11106-row-incomplete')).toBe('fail');
  });

  it('does not require a relationship on the spouse row', () => {
    const data = form({ navmc11106Spouse: child({ relationship: '' }), dependentsArrived: '2026-06-10' });
    expect(ids(data)).not.toContain('navmc11106-row-incomplete');
  });

  it('fails a row with no basis', () => {
    expect(sev(form({ navmc11106Dependents: [child({ sponsorshipBasis: '' })] }), 'navmc11106-basis-missing')).toBe('fail');
  });

  it('fails a dated basis with no date, but not birth, which uses the date of birth', () => {
    expect(ids(form({ navmc11106Dependents: [child({ sponsoredOn: '' })] }))).toContain('navmc11106-sponsored-date-missing');
    expect(ids(form({ navmc11106Dependents: [child({ sponsorshipBasis: 'birth', sponsoredOn: '' })] })))
      .not.toContain('navmc11106-sponsored-date-missing');
  });

  it('warns on excluded rows', () => {
    expect(sev(form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-sponsored' })] }), 'navmc11106-not-sponsored-excluded')).toBe('warn');
    expect(sev(form({ navmc11106Spouse: child({ sponsorshipBasis: 'active-duty-spouse' }) }), 'navmc11106-active-duty-spouse-excluded')).toBe('warn');
  });

  it('warns on the reduced rate when non-sponsored dependents and quarters are present', () => {
    const data = form({ navmc11106Dependents: [child({ sponsorshipBasis: 'not-sponsored' })], d1Quarters: 'y' });
    expect(sev(data, 'navmc11106-reduced-rate')).toBe('warn');
  });

  it('warns that member only with quarters and mess is barracks COLA', () => {
    expect(sev(form({ d1Quarters: 'y', d2Mess: 'y' }), 'navmc11106-barracks-no-form')).toBe('warn');
    expect(ids(form({ d1Quarters: 'n', d2Mess: 'y' }))).not.toContain('navmc11106-barracks-no-form');
  });

  it('fails dependents only without a location, or CONUS without a ZIP', () => {
    const base = { navmc11106Dependents: [child()], dependentsOnly: true };
    expect(sev(form(base), 'navmc11106-dep-only-no-location')).toBe('fail');
    expect(ids(form({ ...base, dependentLocation: 'BERLIN GERMANY' }))).not.toContain('navmc11106-dep-only-no-location');
    expect(ids(form({ ...base, conusColaDependents: true }))).toContain('navmc11106-dep-only-no-location');
    expect(ids(form({ ...base, conusColaDependents: true, conusColaZip: '92055' }))).not.toContain('navmc11106-dep-only-no-location');
  });

  it('warns when box 2 carries a dependent location', () => {
    expect(sev(form({ navmc11106Dependents: [child()], dependentLocation: 'BERLIN' }), 'navmc11106-member-dep-with-location')).toBe('warn');
  });

  it('warns when installation approval is after arrival', () => {
    const data = form({ navmc11106Dependents: [child({ sponsoredOn: '2026-07-01' })], dependentsArrived: '2026-06-10' });
    expect(sev(data, 'navmc11106-c10-before-travel')).toBe('warn');
  });

  it('warns when D3 differs from the suggestion or is in the future', () => {
    expect(sev(form({ dateOfArrival: '2026-06-01', effectiveDate: '2026-06-02' }), 'navmc11106-effective-date-differs')).toBe('warn');
    expect(ids(form({ dateOfArrival: '2026-06-01', effectiveDate: '2026-06-01' }))).not.toContain('navmc11106-effective-date-differs');
    expect(sev(form({ effectiveDate: '2026-11-06' }), 'navmc11106-effective-date-future')).toBe('warn');
    expect(ids(form({ effectiveDate: '2026-11-05' }))).not.toContain('navmc11106-effective-date-future');
  });

  it('warns that mess availability does not affect with-dependent COLA', () => {
    expect(sev(form({ navmc11106Dependents: [child()], d2b: 'y' }), 'navmc11106-mess-ignored-with-deps')).toBe('warn');
  });

  it('warns when Impractical has no Remarks', () => {
    expect(sev(form({ d2b: 'n' }), 'navmc11106-impractical-needs-statement')).toBe('warn');
    expect(ids(form({ d2b: 'n', navmc11106Remarks: 'OPERATIONAL NEED.' }))).not.toContain('navmc11106-impractical-needs-statement');
  });

  it('fails over-long Remarks and row fields', () => {
    expect(sev(form({ navmc11106Remarks: 'X'.repeat(721) }), 'navmc11106-remarks-too-long')).toBe('fail');
    expect(sev(form({ navmc11106Dependents: [child({ name: 'N'.repeat(26) })] }), 'navmc11106-field-too-long')).toBe('fail');
    expect(sev(form({ navmc11106Dependents: [child({ relationship: 'R'.repeat(21) })] }), 'navmc11106-field-too-long')).toBe('fail');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/navmc11106-validators.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the implementation**

Create `src/lib/navmc11106-validators.ts`:

```ts
/**
 * NAVMC 11106 validators. Pure functions, folded into runLetterValidators.
 * Rule source: docs/NAVMC_11106_SPEC.md section 10. Only core-fields blocks.
 */
import type { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime.
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  NAVMC_11106_BASIS_INFO,
  NAVMC_11106_REMARKS_LIMIT,
  combinedRemarks,
  countedDependents,
  countedSpouse,
  dependentRows,
  effectiveSponsoredOn,
  partAValue,
  rowHasContent,
  spouseRow,
  suggestedEffectiveDate,
} from '@/lib/navmc11106-rules';

const NAME_LIMIT = 25;
const RELATIONSHIP_LIMIT = 20;

const issue = (
  slug: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string,
): ValidationIssue => ({ id: `navmc11106-${slug}`, severity, rule, citation, detail });

const str = (data: FormData, key: string): string => String(data[key] ?? '').trim();

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function runNavmc11106Validators(data: FormData, now: Date = new Date()): ValidationIssue[] {
  if (data.documentType !== 'navmc11106') return [];
  const out: ValidationIssue[] = [];

  const missing: string[] = [];
  if (!str(data, 'nameOfMarine')) missing.push('Name');
  if (!str(data, 'grade')) missing.push('Grade');
  if (!str(data, 'dutyStation')) missing.push('Current permanent duty station');
  if (!/^\d{10}$/.test(str(data, 'edipi'))) missing.push('EDIPI (10-digit DoD ID)');
  if (missing.length > 0) {
    out.push(issue('core-fields', 'block', 'Required member fields are incomplete', 'NAVMC 11106 Part B', `Missing: ${missing.join('; ')}.`));
  }

  const spouse = spouseRow(data);
  const children = dependentRows(data);
  const allFilled = [spouse, ...children].filter(rowHasContent);
  const counted = countedDependents(data);
  const part = partAValue(data);

  // The spouse row leads `counted` when it is counted. Its relationship
  // defaults to SPOUSE at fill time, so only the other rows must state one.
  const spouseIsFirst = countedSpouse(data) !== null;
  const incomplete = counted.find((row, i) =>
    !row.name.trim() || !row.eventDate || (!(spouseIsFirst && i === 0) && !row.relationship.trim()));
  if (incomplete) {
    out.push(issue('row-incomplete', 'fail', 'A dependent row is incomplete', 'NAVMC 11106 Part C', `${incomplete.name || 'A row'} needs a name, relationship, and date.`));
  }
  if (allFilled.some((r) => r.sponsorshipBasis === '')) {
    out.push(issue('basis-missing', 'fail', 'A dependent has no sponsorship basis', 'MCO 1300.8 Ch 6 par 5', 'Choose how each dependent came to be command sponsored, or mark the row as not sponsored.'));
  }
  if (counted.some((r) => r.sponsorshipBasis !== '' && NAVMC_11106_BASIS_INFO[r.sponsorshipBasis].dated && !effectiveSponsoredOn(r))) {
    out.push(issue('sponsored-date-missing', 'fail', 'A sponsorship date is missing', 'docs/NAVMC_11106_SPEC.md section 3.3', 'The basis chosen for this dependent needs a date.'));
  }

  const hasNotSponsored = allFilled.some((r) => r.sponsorshipBasis === 'not-sponsored');
  if (hasNotSponsored) {
    out.push(issue('not-sponsored-excluded', 'warn', 'A non-command-sponsored dependent will not print', 'FMR Vol 7A Ch 68 par 3.6', 'With-dependent COLA is not authorized for a non-command-sponsored dependent.'));
    if (data.d1Quarters === 'y') {
      out.push(issue('reduced-rate', 'warn', 'Reduced COLA rate applies', 'FMR Vol 7A Ch 68 Table 68-4 rule 13', 'With quarters available and non-sponsored dependents near the PDS, the Marine rates only the reduced rate.'));
    }
  }
  if (allFilled.some((r) => r.sponsorshipBasis === 'active-duty-spouse')) {
    out.push(issue('active-duty-spouse-excluded', 'warn', 'An active-duty spouse will not print', 'FMR Vol 7A Ch 68 par 2.2.1, Table 68-5', 'An active-duty spouse is not a dependent. See the joint-household rule in Table 68-5.'));
  }
  if (part === 'mem' && data.d1Quarters === 'y' && data.d2Mess === 'y') {
    out.push(issue('barracks-no-form', 'warn', 'This looks like barracks COLA', 'PRIUM 80102 par 3; FMR Vol 7A Ch 68 Table 68-4 rule 11', 'With quarters and mess both available, barracks COLA is reported on the unit diary with no application.'));
  }

  const isConus = data.conusColaDependents === true;
  if (part === 'dep' && (isConus ? !str(data, 'conusColaZip') : !str(data, 'dependentLocation'))) {
    out.push(issue('dep-only-no-location', 'fail', 'Dependents only needs the dependents location', 'PRIUM 80102 par 4 Note 2; PRIUM 80101 par 3.a(5)', isConus ? 'Enter the ZIP code for CONUS COLA.' : 'Complete block C8.'));
  }
  if (part === 'both' && str(data, 'dependentLocation')) {
    out.push(issue('member-dep-with-location', 'warn', 'Dependents listed at another location', 'PRIUM 80102 par 3.a(1)(c)', 'Dependents away from the PDS usually mean a dependents-only application.'));
  }

  const arrived = str(data, 'dependentsArrived');
  if (arrived && counted.some((r) => r.sponsorshipBasis === 'installation-approval' && r.sponsoredOn > arrived)) {
    out.push(issue('c10-before-travel', 'warn', 'Sponsorship approved after dependents arrived', 'JTR par 050803', 'Sponsorship is generally required before Government-funded dependent travel starts.'));
  }

  const effective = str(data, 'effectiveDate');
  const suggested = suggestedEffectiveDate(data);
  if (effective && suggested && effective !== suggested) {
    out.push(issue('effective-date-differs', 'warn', 'Effective date differs from the computed date', 'FMR Vol 7A Ch 68 par 2.1.5, 3.2.1, 3.3', `The rules suggest ${suggested}. The commander decides.`));
  }
  if (effective && effective > localIso(now)) {
    out.push(issue('effective-date-future', 'warn', 'Effective date is in the future', 'PRIUM 80102 par 12.h', 'TTC 014 rejects a future effective date.'));
  }

  if (part === 'both' && data.d2b) {
    out.push(issue('mess-ignored-with-deps', 'warn', 'Mess availability does not affect with-dependent COLA', 'FMR Vol 7A Ch 68 par 3.3', 'Block D2B has no effect on this rate.'));
  }
  if (data.d2b === 'n' && !str(data, 'navmc11106Remarks')) {
    out.push(issue('impractical-needs-statement', 'warn', 'Impractical needs a stated basis', 'FMR Vol 7A Ch 68 Table 68-4 rule 3, note 1', 'State the mission or operational need in Remarks. Personal convenience is not a basis.'));
  }

  if (combinedRemarks(data).length > NAVMC_11106_REMARKS_LIMIT) {
    out.push(issue('remarks-too-long', 'fail', 'Remarks exceed the form limit', 'NAVMC 11106 Remarks', `Remarks, including generated lines, must fit in ${NAVMC_11106_REMARKS_LIMIT} characters. The export cuts anything longer.`));
  }
  if (allFilled.some((r) => r.name.length > NAME_LIMIT || r.relationship.length > RELATIONSHIP_LIMIT)) {
    out.push(issue('field-too-long', 'fail', 'A dependent entry is too long for the form', 'NAVMC 11106 Part C', `Names are limited to ${NAME_LIMIT} characters and relationships to ${RELATIONSHIP_LIMIT}.`));
  }
  return out;
}
```

Fold into `src/lib/letter-validators.ts`. Add the import next to `runNavmc10922Validators`:

```ts
import { runNavmc11106Validators } from '@/lib/navmc11106-validators';
```

Add after `...runNavmc10132Validators(formData),`:

```ts
    // NAVMC 11106 COLA application rules, a no-op for every other
    // documentType (docs/NAVMC_11106_SPEC.md section 10).
    ...runNavmc11106Validators(formData),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/navmc11106-validators.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navmc11106-validators.ts src/lib/letter-validators.ts tests/navmc11106-validators.test.ts
git commit -m "feat(navmc11106): add validators with policy citations" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Schema, export, and registration

**Files:**
- Create: `src/lib/navmc11106-export.ts`
- Modify: `src/lib/schemas.ts`, `src/services/export/pdfPipelineService.ts`, `src/hooks/useDocumentExport.ts`, `src/hooks/useDocumentImport.ts`, `src/lib/naval-format-utils.ts`, `src/lib/proofread-checks.ts`, `src/lib/indent-engine.ts`, `src/lib/templates/index.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/HeaderActions.tsx`, `src/components/letter/DocumentTypeSection.tsx`, `tests/components/dynamicform-edipi.test.tsx`
- Test: `tests/navmc11106-export.test.ts`

**Interfaces:**
- Consumes: `navmc11106Values`, `fillAcroFormWithReport`, `officialFormAsset`, `loadAssetBytes`, the field map.
- Produces: `exportNavmc11106Form(formData: FormData): Promise<Blob>`, throwing when any field fails to write; `DOCUMENT_TYPES.navmc11106` with section ids `member` and `dependent-dates`; `PdfPipeline` member `'navmc11106'`.

- [ ] **Step 1: Write the failing test**

Mock the asset loader so the real blank is read from disk. The fill itself is not mocked, because this is the round trip the spec requires.

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT } from '@/types/navmc';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { exportNavmc11106Form } from '@/lib/navmc11106-export';

const here = dirname(fileURLToPath(import.meta.url));
vi.mock('@/lib/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assets')>()),
  loadAssetBytes: vi.fn(async () => new Uint8Array(readFileSync(resolve(here, '../public/forms/navmc-11106-blank.pdf')))),
}));

const P = 'topmostSubform[0].Page1[0].';
const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const form = (o: Record<string, unknown>) =>
  ({ documentType: 'navmc11106', nameOfMarine: 'MARINE, TEST', grade: 'SGT', edipi: '1234567890', dutyStation: 'OKINAWA JP', ...o }) as unknown as FormData;

describe('exportNavmc11106Form', () => {
  it('fills text and radios and leaves signatures open', async () => {
    const blob = await exportNavmc11106Form(form({
      navmc11106Spouse: { ...NAVMC_11106_EMPTY_DEPENDENT, name: 'MARINE, ALEX', eventDate: '2019-05-04', sponsorshipBasis: 'installation-approval', sponsoredOn: '2026-04-01' },
      dependentsArrived: '2026-06-10',
      d1Quarters: 'y',
      effectiveDate: '2026-06-10',
    }));
    const pdf = await PDFDocument.load(await blobBytes(blob));
    const f = pdf.getForm();
    expect(f.getTextField(`${P}SocSecNoApplc[0]`).getText()).toBe('1234567890');
    expect(f.getTextField(`${P}NameSps1[0]`).getText()).toBe('MARINE, ALEX');
    expect(f.getTextField(`${P}DateDepComnd[0]`).getText()).toBe('2026-04-01');
    expect(f.getRadioGroup(`${P}RadA1[0]`).getSelected()).toBe('both');
    expect(f.getRadioGroup(`${P}RadD1AvailNot[0]`).getSelected()).toBe('y');
    expect(f.getRadioGroup(`${P}RadD2B1[0]`).getSelected()).toBeUndefined();
    expect(f.getSignature(`${P}SigMem[0]`).acroField.getWidgets()).toHaveLength(1);
    expect(f.getSignature(`${P}SigCO[0]`).acroField.getWidgets()).toHaveLength(1);
  });

  it('checks Member Only when no dependents are entered', async () => {
    const pdf = await PDFDocument.load(await blobBytes(await exportNavmc11106Form(form({}))));
    expect(pdf.getForm().getRadioGroup(`${P}RadA1[0]`).getSelected()).toBe('mem');
  });

  it('throws rather than deliver a form missing a value', async () => {
    await expect(exportNavmc11106Form(form({ edipi: '1'.repeat(40) }))).rejects.toThrow(/SocSecNoApplc/);
  });
});

describe('NAVMC 11106 registration', () => {
  it('is a form on the AcroForm pipeline with PDF export only', () => {
    const def = DOCUMENT_TYPES.navmc11106;
    expect(def.features.pdfPipeline).toBe('navmc11106');
    expect(def.features.exportFormats).toEqual(['pdf']);
    expect(def.features.showSignature).toBe(false);
  });

  it('does not put custom-component keys in a DynamicForm section', () => {
    const names = DOCUMENT_TYPES.navmc11106.sections.flatMap((s) => s.fields.map((f) => f.name));
    for (const key of ['navmc11106Spouse', 'navmc11106Dependents', 'dependentsOnly', 'effectiveDate', 'navmc11106Remarks', 'd1Quarters']) {
      expect(names).not.toContain(key);
    }
  });
});
```

Add `['navmc11106', 'edipi'],` to `EDIPI_FIELDS` in `tests/components/dynamicform-edipi.test.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/navmc11106-export.test.ts`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the export module**

Create `src/lib/navmc11106-export.ts`:

```ts
/**
 * NAVMC 11106 official-form export. A plain AcroForm, so it fills through
 * acroform-fill.ts, not xfa-form-fill.ts. Preview and export share this path.
 * Rule source: docs/NAVMC_11106_SPEC.md section 11.
 */
import type { FormData } from '@/types';
import { fillAcroFormWithReport, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import { loadAssetBytes } from '@/lib/assets';
import { navmc11106Values } from '@/lib/navmc11106-rules';
import { officialFormAsset } from '@/lib/xfa-form-fill';
import fieldMap from '../../tools/aa-forms/navmc11106-map.json';

export async function exportNavmc11106Form(formData: FormData): Promise<Blob> {
  const asset = officialFormAsset('navmc11106');
  if (!asset) throw new Error('No official blank registered for NAVMC 11106.');
  const base = await loadAssetBytes(asset);
  const { bytes, report } = await fillAcroFormWithReport(base, navmc11106Values(formData), {
    fields: fieldMap.fields as AcroFormFieldMeta[],
  });
  // A pay document missing a value is a wrong record, not a degraded one.
  if (report.errors.length > 0) {
    const detail = report.errors.map(([name, why]) => `${name}: ${why}`).join('; ');
    throw new Error(`NAVMC 11106 fill failed. ${detail}`);
  }
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
```

- [ ] **Step 4: Add the schema and definition**

In `src/lib/schemas.ts`:

Add `NAVMC_11106_SPONSORSHIP_BASES` to the import from `@/types/navmc`, and add `'navmc11106'` to the `PdfPipeline` union after `'navmc10132'`.

Add after `Navmc10132Definition`:

```ts
// 7c. NAVMC 11106 (Application for Cost-of-Living Allowances)
// Rule source: docs/NAVMC_11106_SPEC.md. Zod stays permissive; the rules live
// in navmc11106-validators.ts. Only keys no custom component writes appear in
// `sections`, because RHF clobbers external writes on its next sync.
const Navmc11106DependentRow = z.object({
  name: z.string().optional(),
  relationship: z.string().optional(),
  eventDate: z.string().optional(),
  sponsorshipBasis: z.union([z.literal(''), z.enum(NAVMC_11106_SPONSORSHIP_BASES)]).optional(),
  sponsoredOn: z.string().optional(),
});

export const Navmc11106Schema = z.object({
  documentType: z.literal('navmc11106'),
  nameOfMarine: z.string().optional(),
  grade: z.string().optional(),
  edipi: z.string().optional(),
  dateOfRank: z.string().optional(),
  dutyStation: z.string().optional(),
  ordersEffectiveDate: z.string().optional(),
  dateOfArrival: z.string().optional(),
  maltPlusOnReportingDay: z.boolean().optional(),
  navmc11106Spouse: Navmc11106DependentRow.optional(),
  navmc11106Dependents: z.array(Navmc11106DependentRow).max(6).optional(),
  dependentsOnly: z.boolean().optional(),
  dependentLocation: z.string().optional(),
  dependentsArrived: z.string().optional(),
  memberSignedDate: z.string().optional(),
  conusColaDependents: z.boolean().optional(),
  conusColaZip: z.string().optional(),
  d1Quarters: z.string().optional(),
  d1Assignment: z.string().optional(),
  d1ToWhom: z.string().optional(),
  d2Mess: z.string().optional(),
  d2Who: z.string().optional(),
  d2b: z.string().optional(),
  effectiveDate: z.string().optional(),
  navmc11106Remarks: z.string().optional(),
  coDate: z.string().optional(),
  coNameGradeActivity: z.string().optional(),
});

export const Navmc11106Definition: DocumentTypeDefinition = {
  id: 'navmc11106',
  name: 'NAVMC 11106 (Application for Cost-of-Living Allowances)',
  description:
    'Application for OCONUS COLA per MCTFS PRIUM par 80102 and DoD FMR Vol 7A Ch 68.',
  icon: '🌏',
  schema: Navmc11106Schema,
  features: {
    ...STANDARD_LETTER_FEATURES,
    showHeaderSettings: false,
    showUnitInfo: false,
    showVia: false,
    showReferences: false,
    showEnclosures: false,
    showParagraphs: false,
    showClosingBlock: false,
    showClassification: false,
    // The form carries its own two signature fields.
    showSignature: false,
    category: 'forms',
    pdfPipeline: 'navmc11106',
    exportFormats: ['pdf'],
  },
  sections: [
    {
      id: 'member',
      title: 'Part B — Member Data',
      fields: [
        { name: 'nameOfMarine', label: 'Name (Last, First, MI)', type: 'text', required: true, maxLength: 70, placeholder: 'MARINE, ALONZO D', className: 'md:col-span-1' },
        { name: 'grade', label: 'Grade', type: 'text', required: true, maxLength: 20, placeholder: 'SGT', className: 'md:col-span-1' },
        { name: 'dateOfRank', label: 'Date of Rank', type: 'date-picker', className: 'md:col-span-1' },
        { name: 'edipi', label: 'EDIPI', type: 'text', required: true, maxLength: 10, digitsOnly: true, inputMode: 'numeric', placeholder: '1234567890', className: 'md:col-span-1' },
        { name: 'dutyStation', label: 'Current Permanent Duty Station (City, Province, Country)', type: 'text', required: true, maxLength: 130, placeholder: 'CAMP FOSTER, OKINAWA, JAPAN', className: 'md:col-span-2' },
        { name: 'ordersEffectiveDate', label: 'Effective Date of Orders', type: 'date-picker', className: 'md:col-span-1' },
        { name: 'dateOfArrival', label: 'Date of Arrival', type: 'date-picker', description: 'COLA starts the day the Marine reports to the new PDS (FMR Vol 7A Ch 68 par 3.2.1).', className: 'md:col-span-1' },
      ],
    },
    {
      id: 'dependent-dates',
      title: 'Part C — Location and Dates',
      fields: [
        { name: 'dependentLocation', label: "8. Dependent's Location if Other Than Sponsor's", type: 'text', maxLength: 70, className: 'md:col-span-2' },
        { name: 'dependentsArrived', label: '9. Date Dependents Arrive at Permanent Station', type: 'date-picker', description: 'The date the most recent dependent arrived. Leave empty for a child born at the PDS.', className: 'md:col-span-1' },
        { name: 'memberSignedDate', label: "Date of Member's Signature", type: 'date-picker', className: 'md:col-span-1' },
      ],
    },
  ],
};
```

Add `Navmc11106Schema,` to the `DocumentSchema` union after `Navmc10132Schema,`, and `navmc11106: Navmc11106Definition,` to `DOCUMENT_TYPES` after the `navmc10132` line.

- [ ] **Step 5: Register in the pipeline**

In `src/services/export/pdfPipelineService.ts`, generalize the notice page:

```ts
async function generateFillPlaceholder(formLabel: string): Promise<Blob> {
```

Replace `generateNavmc10132Placeholder` with that signature, change the first line of `lines` to `[formLabel, bold, 16],`, and change its existing call to `generateFillPlaceholder('NAVMC 10132 (Unit Punishment Book)')`. Then add to `PIPELINE_MAP` after `navmc10132`:

```ts
  // NAVMC 11106 fills the normalized AcroForm blank. Same failure contract as
  // the 10132: the preview degrades to the notice page, an export gets the error.
  navmc11106: async (ctx) => {
    const { exportNavmc11106Form } = await import('@/lib/navmc11106-export');
    try {
      return await exportNavmc11106Form(ctx.formData);
    } catch (error) {
      if (ctx.mode !== 'preview') throw error;
      console.error('NAVMC 11106 AcroForm fill failed, previewing the notice page instead:', error);
      return generateFillPlaceholder('NAVMC 11106 (Cost-of-Living Allowances)');
    }
  },
```

- [ ] **Step 6: Add the export toast**

In `src/hooks/useDocumentExport.ts`, immediately after the closing brace of the `if (format === 'pdf' && formData.documentType === 'navmc10132') { ... }` block:

```ts
      if (format === 'pdf' && formData.documentType === 'navmc11106') {
        toast?.({
          title: 'Official Form Exported',
          description:
            'This is the NAVMC 11106 in plain fillable format, with EDIPI in block 4. It contains '
            + 'Privacy Act information, so handle the file accordingly. A commander completes Part D, '
            + 'and both signature blocks are open for a CAC signature. After approval, upload it to the '
            + 'OMPF Field Folder and keep a local copy (MARADMIN 015/20 par 4.b.3).',
        });
      }
```

- [ ] **Step 7: Register in the remaining points**

`src/lib/naval-format-utils.ts`, after the `navmc10132` filename block:

```ts
  // COLA application. The member's name identifies the record.
  if (formData.documentType === 'navmc11106') {
    const name = sanitize(formData.nameOfMarine ?? '') || 'Marine';
    return `NAVMC 11106 - ${name}.${extension}`;
  }
```

`src/lib/proofread-checks.ts` line 111: add `'navmc11106'` to the `isForm` array.

`src/lib/indent-engine.ts` line 65: add `'navmc11106'` to the array.

`src/lib/templates/index.ts`, after the `navmc10132` line:

```ts
  'navmc11106': { ...BasicLetterTemplate, id: 'navmc11106-default', typeId: 'navmc11106', name: 'NAVMC 11106 (Cost-of-Living Allowances)' }, // Placeholder
```

`src/hooks/useDocumentImport.ts`, in `STRUCTURED_FORMS`:

```ts
  navmc11106: 'Cost-of-Living Allowance application (NAVMC 11106)',
```

`src/components/layout/Sidebar.tsx`, after the NAVMC 10132 button:

```tsx
                  <DocumentTypeButton
                    active={documentType === 'navmc11106'}
                    onClick={() => handleSelect('navmc11106')}
                    label="COLA Application (NAVMC 11106)"
                  />
```

`src/components/layout/HeaderActions.tsx` line 699: add `&& documentType !== 'navmc11106'` to the DOCX condition. Leave `isFormDocument` at line 241 alone, since reading a filled form back is out of scope.

`src/components/letter/DocumentTypeSection.tsx`: import `Coins` from `lucide-react`, add `&& formData.documentType !== 'navmc11106'` to the condition at line 579, and add after the NAVMC 10132 card:

```tsx
            <DocumentTypeCard
              type="navmc11106"
              icon={<Coins className="w-10 h-10" />}
              title="NAVMC 11106"
              description="Application for overseas Cost-of-Living Allowance per MCTFS PRIUM par 80102 and DoD FMR Vol 7A Ch 68."
              note="&rarr; For OCONUS COLA"
              isActive={formData.documentType === 'navmc11106'}
              onClick={() => setFormData(prev => ({ ...prev, documentType: 'navmc11106' }))}
            />
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run tests/navmc11106-export.test.ts tests/components/dynamicform-edipi.test.tsx tests/document-type-options.test.ts tests/document-types.test.ts tests/components/DocumentTypeSection.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors. If the JSON import of `fieldMap.fields` fails the cast, match the `navmc10132-export.ts` pattern.

- [ ] **Step 9: Commit**

```bash
git add src/lib/navmc11106-export.ts src/lib/schemas.ts src/services/export/pdfPipelineService.ts src/hooks/useDocumentExport.ts src/hooks/useDocumentImport.ts src/lib/naval-format-utils.ts src/lib/proofread-checks.ts src/lib/indent-engine.ts src/lib/templates/index.ts src/components/layout/Sidebar.tsx src/components/layout/HeaderActions.tsx src/components/letter/DocumentTypeSection.tsx tests/navmc11106-export.test.ts tests/components/dynamicform-edipi.test.tsx
git commit -m "feat(navmc11106): register document type and fill the official form" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Form UI

**Files:**
- Create: `src/components/letter/Navmc11106Sections.tsx`
- Modify: `src/components/document/DocumentLayout.tsx`
- Test: `tests/components/navmc11106-sections.test.tsx`

**Interfaces:**
- Consumes: Task 3 rules, `DOCUMENT_TYPES.navmc11106`.
- Produces: `Navmc11106FormSections({ formData, setFormData, onDynamicSync, formKey })`, the same props as `Navmc10922FormSections`.

- [ ] **Step 1: Write the failing test**

Uses a stateful harness, because Part A must follow state changes.

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT } from '@/types/navmc';
import { Navmc11106FormSections } from '@/components/letter/Navmc11106Sections';

afterEach(cleanup);

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [formData, setFormData] = React.useState({ documentType: 'navmc11106', ...initial } as unknown as FormData);
  return <Navmc11106FormSections formData={formData} setFormData={setFormData} onDynamicSync={vi.fn()} formKey={1} />;
}

const selectedBox = () => screen.getByRole('list', { name: 'Part A purpose' }).querySelector('[aria-current="true"]')?.textContent;
const child = { ...NAVMC_11106_EMPTY_DEPENDENT, name: 'MARINE, KID', relationship: 'SON', sponsorshipBasis: 'installation-approval' };

describe('NAVMC 11106 Part A', () => {
  it('shows Member Only with no dependents and hides the Dependents only option', () => {
    render(<Harness />);
    expect(selectedBox()).toContain('For Member Only');
    expect(screen.queryByRole('checkbox', { name: /Dependents only/ })).toBeNull();
  });

  it('moves to Member and Dependents as soon as a dependent is typed', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Dependent 1 name"), { target: { value: 'MARINE, KID' } });
    expect(selectedBox()).toContain('For Member and Dependents');
    expect(screen.getByRole('checkbox', { name: /Dependents only/ })).toBeTruthy();
  });

  it('moves to Dependents Only when the option is checked', () => {
    render(<Harness initial={{ navmc11106Dependents: [child] }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Dependents only/ }));
    expect(selectedBox()).toContain("For Member's Dependents Only");
  });

  it('returns to Member Only and clears the option when the last dependent is removed', () => {
    render(<Harness initial={{ navmc11106Dependents: [child], dependentsOnly: true }} />);
    expect(selectedBox()).toContain("For Member's Dependents Only");
    fireEvent.click(screen.getByRole('button', { name: 'Remove dependent 1' }));
    expect(selectedBox()).toContain('For Member Only');
    fireEvent.change(screen.getByLabelText('Dependent 1 name'), { target: { value: 'MARINE, NEW' } });
    expect(selectedBox()).toContain('For Member and Dependents');
  });

  it('does not count a non-sponsored dependent, and explains why', () => {
    render(<Harness initial={{ navmc11106Dependents: [{ ...child, sponsorshipBasis: 'not-sponsored' }] }} />);
    expect(selectedBox()).toContain('For Member Only');
    expect(screen.getByText(/will not print or count/)).toBeTruthy();
  });
});

describe('NAVMC 11106 Part C and Part D', () => {
  it('explains what command sponsored means', () => {
    render(<Harness />);
    expect(screen.getByText(/authorized by the appropriate authority/)).toBeTruthy();
  });

  it('hides the sponsored-date input for a basis that uses the date of birth', () => {
    render(<Harness initial={{ navmc11106Dependents: [{ ...child, sponsorshipBasis: 'birth' }] }} />);
    expect(screen.queryByLabelText('Dependent 1 date command sponsored')).toBeNull();
  });

  it('starts Part D empty', () => {
    render(<Harness />);
    for (const radio of screen.getAllByRole('radio')) expect(radio.getAttribute('aria-checked')).toBe('false');
  });

  it('offers the suggested effective date but does not apply it on its own', () => {
    render(<Harness initial={{ dateOfArrival: '2026-06-01' }} />);
    const input = screen.getByLabelText('3. This Application Is Approved Effective') as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /Use suggested date/ }));
    expect(input.value).toBe('2026-06-01');
  });

  it('shows the Remarks lines the app will add', () => {
    render(<Harness initial={{ navmc11106Spouse: { ...child, name: 'S', sponsorshipBasis: 'not-required' } }} />);
    expect(screen.getByText('S: COMMAND SPONSORSHIP NOT REQUIRED.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/navmc11106-sections.test.tsx`
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Write the component**

Create `src/components/letter/Navmc11106Sections.tsx`:

```tsx
'use client';

/**
 * NAVMC 11106 form sections. Narrow DynamicForm instances interleaved with
 * custom components so the screen follows the paper's order, the 10922 pattern.
 * Rule source: docs/NAVMC_11106_SPEC.md.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckSquare, Square, Users, ClipboardCheck, ListChecks } from 'lucide-react';
import type { FormData } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, type DocumentTypeDefinition } from '@/lib/schemas';
import {
  NAVMC_11106_EMPTY_DEPENDENT,
  NAVMC_11106_SPONSORSHIP_BASES,
  type Navmc11106Dependent,
  type Navmc11106SponsorshipBasis,
} from '@/types/navmc';
import {
  NAVMC_11106_BASIS_INFO,
  NAVMC_11106_MAX_DEPENDENTS,
  NAVMC_11106_REMARKS_LIMIT,
  combinedRemarks,
  commandSponsoredDate,
  countedDependents,
  dependentRows,
  generatedRemarks,
  partAValue,
  rowHasContent,
  spouseRow,
  suggestedEffectiveDate,
  withDependentsOnlyReset,
  type Navmc11106PartA,
} from '@/lib/navmc11106-rules';

interface SectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onDynamicSync: (data: any) => void;
  formKey: number | string;
}
type StateProps = Pick<SectionsProps, 'formData' | 'setFormData'>;

function subDefinition(ids: string[]): DocumentTypeDefinition {
  const def = DOCUMENT_TYPES['navmc11106'];
  return { ...def, sections: def.sections.filter((s) => ids.includes(s.id)) };
}
const DEF_MEMBER = subDefinition(['member']);
const DEF_DATES = subDefinition(['dependent-dates']);

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center text-lg font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

const PART_A_BOXES: Array<{ value: Navmc11106PartA; label: string }> = [
  { value: 'mem', label: 'For Member Only' },
  { value: 'both', label: 'For Member and Dependents' },
  { value: 'dep', label: "For Member's Dependents Only" },
];

function PartASection({ formData, setFormData }: StateProps) {
  const part = partAValue(formData);
  const hasDependents = countedDependents(formData).length > 0;
  return (
    <SectionCard icon={<ListChecks className="mr-2 h-5 w-5" />} title="Part A — Purpose">
      <p className="text-xs text-muted-foreground mb-3">
        Set automatically from the dependents entered in Part C.
      </p>
      <ul aria-label="Part A purpose" className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PART_A_BOXES.map(({ value, label }) => (
          <li
            key={value}
            aria-current={part === value ? 'true' : undefined}
            className={`flex items-center gap-2 rounded-md border p-2 text-sm ${part === value ? 'border-primary font-semibold' : 'border-border text-muted-foreground'}`}
          >
            {part === value ? <CheckSquare className="h-4 w-4 shrink-0" aria-hidden /> : <Square className="h-4 w-4 shrink-0" aria-hidden />}
            {label}
          </li>
        ))}
      </ul>
      {hasDependents && (
        <div className="mt-3 space-y-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={formData.dependentsOnly === true}
              onCheckedChange={(v) => setFormData((prev) => ({ ...prev, dependentsOnly: v === true }))}
            />
            Dependents only
          </label>
          <p className="text-xs text-muted-foreground">
            Check when this application covers only dependents at a location other than your PDS.
            Your own COLA at the PDS, if any, goes on a separate application with no dependents listed.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function RowEditor({ row, label, isSpouse, onChange, onRemove }: {
  row: Navmc11106Dependent;
  label: string;
  isSpouse: boolean;
  onChange: (patch: Partial<Navmc11106Dependent>) => void;
  onRemove?: () => void;
}) {
  const info = row.sponsorshipBasis ? NAVMC_11106_BASIS_INFO[row.sponsorshipBasis] : null;
  const bases = NAVMC_11106_SPONSORSHIP_BASES.filter((b) => isSpouse || b !== 'active-duty-spouse');
  const needsDate = info?.dated === true && row.sponsorshipBasis !== 'birth';
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        {onRemove && rowHasContent(row) && (
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-name`}>{label} name</Label>
          <Input id={`${id}-name`} maxLength={25} value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-relationship`}>{label} relationship</Label>
          <Input id={`${id}-relationship`} maxLength={20} placeholder={isSpouse ? 'SPOUSE' : 'SON'} value={row.relationship} onChange={(e) => onChange({ relationship: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-event`}>{isSpouse ? 'Date of marriage' : `${label} date of birth`}</Label>
          <Input id={`${id}-event`} type="date" value={row.eventDate} onChange={(e) => onChange({ eventDate: e.target.value })} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs" htmlFor={`${id}-basis`}>How command sponsored</Label>
          <Select
            value={row.sponsorshipBasis || undefined}
            onValueChange={(v) => onChange({ sponsorshipBasis: v as Navmc11106SponsorshipBasis })}
          >
            <SelectTrigger id={`${id}-basis`} aria-label={`${label} sponsorship basis`}>
              <SelectValue placeholder="Select a basis" />
            </SelectTrigger>
            <SelectContent>
              {bases.map((b) => (
                <SelectItem key={b} value={b}>{NAVMC_11106_BASIS_INFO[b].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {info && <p className="text-[11px] text-muted-foreground">{info.hint}</p>}
        </div>
        {needsDate && (
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`${id}-sponsored`}>{label} date command sponsored</Label>
            <Input id={`${id}-sponsored`} type="date" value={row.sponsoredOn} onChange={(e) => onChange({ sponsoredOn: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}

const padRows = (rows: Navmc11106Dependent[]): Navmc11106Dependent[] => {
  const out = rows.slice(0, NAVMC_11106_MAX_DEPENDENTS);
  while (out.length < NAVMC_11106_MAX_DEPENDENTS) out.push({ ...NAVMC_11106_EMPTY_DEPENDENT });
  return out;
};

function DependentsSection({ formData, setFormData }: StateProps) {
  const rows = padRows(dependentRows(formData));
  const lastFilled = rows.reduce((last, r, i) => (rowHasContent(r) ? i : last), -1);
  const [opened, setOpened] = useState(1);
  const visible = Math.min(NAVMC_11106_MAX_DEPENDENTS, Math.max(opened, lastFilled + 1, 1));
  const c10 = commandSponsoredDate(formData);

  const updateRow = (i: number, patch: Partial<Navmc11106Dependent>) =>
    setFormData((prev) => {
      const next = padRows(dependentRows(prev));
      next[i] = { ...next[i], ...patch };
      return withDependentsOnlyReset({ ...prev, navmc11106Dependents: next });
    });
  const removeRow = (i: number) =>
    setFormData((prev) => {
      const next = padRows(dependentRows(prev));
      next.splice(i, 1);
      return withDependentsOnlyReset({ ...prev, navmc11106Dependents: padRows(next) });
    });
  const updateSpouse = (patch: Partial<Navmc11106Dependent>) =>
    setFormData((prev) => withDependentsOnlyReset({ ...prev, navmc11106Spouse: { ...spouseRow(prev), ...patch } }));

  return (
    <SectionCard icon={<Users className="mr-2 h-5 w-5" />} title="Part C — Dependents COLA Is Claimed For">
      <div className="text-xs text-muted-foreground mb-4 space-y-1">
        <p>
          A command-sponsored dependent is one authorized by the appropriate authority to reside at
          the OCONUS location with you on an accompanied tour (JTR Appendix A). Being a dependent in
          MCTFS, or living at the PDS, does not make a dependent command sponsored.
        </p>
        <p>
          List only dependents COLA is claimed for. Tell your commanding officer when any dependent
          leaves the PDS vicinity for 31 or more days, not only on a return to the United States
          (FMR Vol 7A Ch 68 Table 68-3).
        </p>
        <p>
          With-dependent COLA generally starts on the later of arrival and sponsorship. Acquired or
          newly sponsored dependents need at least 12 months left on the tour after arrival or
          approval, whichever is later (MCO 1300.8 Ch 6 par 6.a, 7.b).
        </p>
        {c10 && <p className="font-medium">Block 10 will print {c10}.</p>}
      </div>
      <div className="space-y-4">
        <RowEditor row={spouseRow(formData)} label="Spouse" isSpouse onChange={updateSpouse} />
        {rows.slice(0, visible).map((row, i) => (
          <RowEditor
            key={i}
            row={row}
            label={`Dependent ${i + 1}`}
            isSpouse={false}
            onChange={(patch) => updateRow(i, patch)}
            onRemove={() => removeRow(i)}
          />
        ))}
      </div>
      {visible < NAVMC_11106_MAX_DEPENDENTS && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setOpened(visible + 1)}>
          Add dependent
        </Button>
      )}
    </SectionCard>
  );
}

function ConusSection({ formData, setFormData }: StateProps) {
  if (partAValue(formData) !== 'dep') return null;
  const on = formData.conusColaDependents === true;
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6 space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={on}
          onCheckedChange={(v) => setFormData((prev) => ({ ...prev, conusColaDependents: v === true }))}
        />
        Dependents are in CONUS, at a location paying CONUS COLA
      </label>
      <p className="text-xs text-muted-foreground">
        No application is needed when the CONUS COLA rate there is $0 (AskMCAAT 039-24). Part D is
        not required for this case (PRIUM 80101 par 3.a(4)).
      </p>
      {on && (
        <div className="space-y-1 max-w-[12rem]">
          <Label className="text-xs" htmlFor="conus-zip">Dependent ZIP code</Label>
          <Input
            id="conus-zip"
            maxLength={5}
            inputMode="numeric"
            value={String(formData.conusColaZip ?? '')}
            onChange={(e) => setFormData((prev) => ({ ...prev, conusColaZip: e.target.value.replace(/\D/g, '') }))}
          />
        </div>
      )}
    </div>
  );
}

function RadioChoice({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" id={`${id}-label`}>{label}</span>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-5 text-[11px]" aria-label={`Clear ${label}`} onClick={() => onChange('')}>
            Clear
          </Button>
        )}
      </div>
      <RadioGroup aria-labelledby={`${id}-label`} value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
        {options.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
            <Label className="text-sm font-normal" htmlFor={`${id}-${o.value}`}>{o.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function PartDSection({ formData, setFormData }: StateProps) {
  const text = (key: string) => String(formData[key] ?? '');
  const set = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));
  const suggestion = suggestedEffectiveDate(formData);
  const generated = generatedRemarks(formData);
  const total = combinedRemarks(formData).length;

  return (
    <SectionCard icon={<ClipboardCheck className="mr-2 h-5 w-5" />} title="Part D — Commanding Officer's Certificate">
      <p className="text-xs text-muted-foreground mb-4">
        Commander completes (PRIUM 80102 par 3.b). Leave blank if the command fills this part after signature.
      </p>
      <div className="space-y-4">
        <RadioChoice label="1. Government quarters are" value={text('d1Quarters')} onChange={(v) => set('d1Quarters', v)}
          options={[{ value: 'y', label: 'Available' }, { value: 'n', label: 'Not available' }]} />
        <RadioChoice label="Quarters assignment" value={text('d1Assignment')} onChange={(v) => set('d1Assignment', v)}
          options={[{ value: 'Yes', label: 'Assigned' }, { value: 'no', label: 'Not assigned' }]} />
        <RadioChoice label="Quarters to whom" value={text('d1ToWhom')} onChange={(v) => set('d1ToWhom', v)}
          options={[{ value: 'mem', label: 'To the member' }, { value: 'dep', label: "To the member's dependents" }]} />
        <RadioChoice label="2A. Government mess" value={text('d2Mess')} onChange={(v) => set('d2Mess', v)}
          options={[{ value: 'y', label: 'Is' }, { value: 'n', label: 'Is not' }]} />
        <RadioChoice label="Mess available to" value={text('d2Who')} onChange={(v) => set('d2Who', v)}
          options={[{ value: 'memdep', label: 'Member and dependents' }, { value: 'mem', label: 'Member' }]} />
        <RadioChoice label="2B. Mess status" value={text('d2b')} onChange={(v) => set('d2b', v)}
          options={[
            { value: 'y', label: 'Enlisted member authorized to mess separately' },
            { value: 'n', label: 'Impractical to use Government mess for 3 meals a day' },
          ]} />

        <div className="space-y-1 max-w-xs">
          <Label className="text-sm" htmlFor="n11106-effective">3. This Application Is Approved Effective</Label>
          <Input id="n11106-effective" type="date" value={text('effectiveDate')} onChange={(e) => set('effectiveDate', e.target.value)} />
          {suggestion && text('effectiveDate') !== suggestion && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => set('effectiveDate', suggestion)}>
              Use suggested date ({suggestion})
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-sm" htmlFor="n11106-remarks">Remarks</Label>
          <Textarea id="n11106-remarks" rows={4} value={text('navmc11106Remarks')} onChange={(e) => set('navmc11106Remarks', e.target.value)} />
          {generated.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Will also print:</p>
              <ul className="list-disc pl-4">
                {generated.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          )}
          <p className={`text-xs ${total > NAVMC_11106_REMARKS_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`}>
            {total} of {NAVMC_11106_REMARKS_LIMIT} characters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-sm" htmlFor="n11106-co-date">Date</Label>
            <Input id="n11106-co-date" type="date" value={text('coDate')} onChange={(e) => set('coDate', e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm" htmlFor="n11106-co-name">Name, Grade, and Activity of Commanding Officer</Label>
            <Input id="n11106-co-name" maxLength={65} value={text('coNameGradeActivity')} onChange={(e) => set('coNameGradeActivity', e.target.value)} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export function Navmc11106FormSections({ formData, setFormData, onDynamicSync, formKey }: SectionsProps) {
  return (
    <>
      <PartASection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm key={`navmc11106-${formKey}-member`} documentType={DEF_MEMBER} onSubmit={onDynamicSync} defaultValues={formData} />
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
          <Checkbox
            checked={formData.maltPlusOnReportingDay === true}
            onCheckedChange={(v) => setFormData((prev) => ({ ...prev, maltPlusOnReportingDay: v === true }))}
          />
          MALT Plus authorized on the reporting day (COLA starts the next day, FMR Vol 7A Ch 68 par 3.2.1)
        </label>
      </div>
      <DependentsSection formData={formData} setFormData={setFormData} />
      <ConusSection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm key={`navmc11106-${formKey}-dates`} documentType={DEF_DATES} onSubmit={onDynamicSync} defaultValues={formData} />
      </div>
      <PartDSection formData={formData} setFormData={setFormData} />
    </>
  );
}
```

- [ ] **Step 4: Wire it into the layout**

In `src/components/document/DocumentLayout.tsx`, add the import after the 10132 one:

```tsx
import { Navmc11106FormSections } from '@/components/letter/Navmc11106Sections';
```

Add a branch immediately before `) : formData.documentType === 'navmc10132' ? (`:

```tsx
          ) : formData.documentType === 'navmc11106' ? (
            <Navmc11106FormSections
              formData={formData}
              setFormData={setFormData}
              onDynamicSync={handleDynamicFormSubmit}
              formKey={formKey}
            />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/components/navmc11106-sections.test.tsx`
Expected: PASS. If a label query fails, fix the component's label text so it matches the test: the labels above are the accessibility contract.

- [ ] **Step 6: Commit**

```bash
git add src/components/letter/Navmc11106Sections.tsx src/components/document/DocumentLayout.tsx tests/components/navmc11106-sections.test.tsx
git commit -m "feat(navmc11106): add form sections with automatic Part A" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verify the whole form in the app

**Files:**
- Modify: `docs/NAVMC_11106_SPEC.md` (status block, implementation table)
- Modify, only if a defect is found: the files that own it

**Interfaces:**
- Consumes: everything above.
- Produces: verified behavior, and the owner's Adobe Reader check list.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run typecheck`
Run: `npm run typecheck:tests`
Run: `npm run lint`
Run: `npm run lint:ratchet`
Run: `npm run test:nogolden`
Expected: all pass. A failure in a registration-exhaustiveness test means a Task 5 point was missed: fix that, not the test.

- [ ] **Step 2: Run the golden suite**

Run: `npm run test:golden`
Expected: PASS with no golden changes. This form adds no letter rendering, so any diff is a regression.

- [ ] **Step 3: Exercise the form in the running app**

Start the dev server with `preview_start` (add a `.claude/launch.json` entry for `npm run dev` if none exists). Select NAVMC 11106 and confirm:

1. Part A shows For Member Only and no Dependents only option.
2. Typing a dependent name moves it to For Member and Dependents, and the option appears.
3. Checking the option moves it to For Member's Dependents Only, and the CONUS section appears.
4. Removing the dependent returns to For Member Only and clears the option.
5. A row set to Not command sponsored does not change Part A and does not print.
6. The live preview shows the filled form, the EDIPI label, and X marks rather than dots.
7. Export downloads `NAVMC 11106 - <name>.pdf`, and the toast appears.

Check the console and server logs for errors. Take a screenshot of the preview.

- [ ] **Step 4: Update the spec status**

Replace the status lines at the top of `docs/NAVMC_11106_SPEC.md` with:

```markdown
Status - built 2026-11-05 per `docs/NAVMC_11106_BUILD_PLAN.md`. Adobe Reader and CAC signing await the owner's check.
```

- [ ] **Step 5: Commit**

```bash
git add docs/NAVMC_11106_SPEC.md
git commit -m "docs(navmc11106): record build status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand the owner the Adobe Reader check**

It cannot be automated here. Report these to the owner to run on the exported file:

1. Opens in Adobe Reader with no warning about signatures or usage rights.
2. All values and the X marks show. Text fields and radios are still editable.
3. Both signature fields accept a CAC signature.
4. The file also opens and displays in a browser.
