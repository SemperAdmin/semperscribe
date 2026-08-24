# NAVMC 10132 - Phase 0 report

Date 2026-08-23. Plan reference: `docs/NAVMC_10132_BUILD_PLAN.md` Phase 0.
Status: cloud-side work complete. Three probes need Stephen on a local machine.

## What shipped

| Artifact | Path |
|---|---|
| Official blank, byte-identical | `public/forms/navmc-10132-blank.pdf` |
| Field map extractor | `tools/aa-forms/extract_10132_map.py` |
| Generated map | `tools/aa-forms/navmc10132-map.json` |
| Reference fill implementation | `tools/aa-forms/navmc10132_fill.mjs` |
| Independent verifier | `tools/aa-forms/verify_10132_roundtrip.py` |
| Probe fixture generator | `tools/aa-forms/navmc10132_probe_values.mjs` |
| Probe PDFs | `_scratch/navmc10132-phase0/` |

Blank SHA-256 `1e99e12dcd97789e744b3578ad8b56edea05773a38be3402fe171581f19effc8`,
recorded in the map as `sourceSha256`. sja.marines.mil re-posted this same 08-2023
revision under a 2025-03 filename, so a filename or date proves nothing. The hash is
the only reliable revision signal.

## Round-trip result

    74 fields, 7 signature widgets untouched
    67 of 67 writable fields written, 0 errors
    independent pypdf verifier: PASS
    findings dropdowns hold export values ("Guilty"), not display text ("G")
    read-only flags restored on all four unlocked fields

## Two defects in the fill path, found by running it

Neither was visible from reading the PDF. Both are now handled in
`navmc10132_fill.mjs` and both must carry into `src/lib/acroform-fill.ts`.

### F-1. Rich text crashes the export on the most common case

`21 REMARKS` carries the RichText flag. pdf-lib's `getText()` throws
`RichTextFieldReadError` when a rich-text field is EMPTY, and
`updateFieldAppearances()` calls `getText()` on every text field. A UPB with no
remarks is entirely ordinary, so the export crashed on the ordinary case.

Fix: clear bit 26 on `21 REMARKS` before generating appearances. Safe because the
blank carries no `/RV`, the app never writes rich content, and Acrobat renders `/V`
normally on a plain text field. This also answers decision D-5 in the direction the
spec preferred.

### F-2. pdf-lib writes display text, not export values

`getOptions()` returns DISPLAY text. `select()` writes whatever string it is handed
straight into `/V` with NO validation against `/Opt`. Both failure modes are live:

- Passing the display value writes `/V = "G"`, which is not a valid export value.
- Passing the export value writes `/V = "Guilty"` AND renders "Guilty" into a
  22.76pt-wide widget at 8pt, which clips.

Fix is a two-step write, driven by the map's `exportDiffersFromDisplay` column:
select the DISPLAY text, generate appearances, then patch `/V` to the EXPORT value.
Verified against the raw appearance streams:

    single step: /V = "Guilty"   appearance draws <4775696C7479> = "Guilty"  CLIPPED
    two step   : /V = "Guilty"   appearance draws <47>           = "G"       CORRECT

Six fields need it: the five findings dropdowns and `2 COUNSELOPP`. The list comes
from the map, never hardcoded.

Because `select()` does not validate, the emitter must validate against the map
itself. A typo would otherwise ship silently. `navmc10132_fill.mjs` rejects any
value that is not an export value for its field.

## Probe artifacts for local testing

All four use the fictional identity already used by the 10922 templates:
MARINE, ALONZO DEAN, Sgt E5, EDIPI 1234567890, H&S Co 1/6.

| File | Purpose |
|---|---|
| `probe-a-acceptance.pdf` | Clean acceptance, item 21 deliberately EMPTY. This is the case that triggered F-1 |
| `probe-b-ur3-kept.pdf` | Same content, `/Root/Perms` LEFT IN PLACE |
| `probe-b-ur3-stripped.pdf` | Same content, `/Root/Perms` REMOVED. Identical to probe A |
| `probe-c-remarks-long.pdf` | Multi-line structured remarks plus victims routed to item 21 |
| `probe-d-refusal.pdf` | Accused refuses to sign. Demonstrates the two JavaScript fixes |
| `probe-e-finding-display.pdf` | Identical to probe A except `1A FINDING` `/V` holds the display value "G". Single-variable differential for the addendum below |

Probe D is the one worth opening first. Without the Booker engine and the read-only
unlock, that document would state the accused accepted NJP while the refusal box is
checked. It now reads "(No Booker statement due to refusal to sign.)" and item 2's
demand has been coerced to "I demand trial and refuse non-judicial punishment,"
reproducing the form's own scripted coupling.

## What Stephen runs locally

**Probe A, decision D-2.** Load `probe-a-acceptance.pdf` through the app's pdfjs
preview component. Do the widget values paint? A cloud-side pdfjs text-layer check
found nothing, which proves nothing either way: widget values live in annotation
appearance streams, not the page text layer. This has to be looked at.
A negative answer adds Phase 5b.

**Probe B, decision D-12.** Open `probe-b-ur3-kept.pdf` and
`probe-b-ur3-stripped.pdf` in Acrobat AND in Reader. Compare the banners. The kept
version should show an invalid signature, which reads as tampering. The stripped
version should show nothing. Confirm and pick. Current default in the tool is to
strip, overridable with `--keep-perms`.

**Probe C, decision D-5.** Open `probe-c-remarks-long.pdf` in Acrobat and confirm
item 21 renders all its lines with the RichText flag cleared. Cloud-side poppler
renders it correctly, but Acrobat is the authority.

**Probe D.** Confirm items 23, 24, and 25 on page 2 carry the accused identity, and
that the Booker line and item 2 demand read as described above.

## Addendum 2026-08-23: item 5 clips in Acrobat, and the form is why

Stephen opened probe A in Acrobat. Everything landed. One cell displays wrong: the
1A findings combo shows a clipped partial "G".

Measured off the screenshot at 1.2026 px/pt against the widget rect in the map:

| Element | Measured | Source |
|---|---|---|
| `1A FINDING` widget | 23.76pt | map rect 245.2 to 269.0 |
| Acrobat dropdown button | 15.8pt | pixel scan, x 304-322 |
| Text area left over | under 7pt, roughly 4.6pt after border and padding | pixel scan, x 296-303 |
| Display text "G" at Helvetica 8pt | 6.22pt | font metrics |
| Export value "Guilty" at 8pt | 20.45pt | font metrics |

The button eats two thirds of the field.

### The differential ran, and it settles the cause

Stephen opened probe A (`/V` = "Guilty") and probe E (`/V` = "G"). Both show the
IDENTICAL clipped glyph. That result cannot discriminate on its own, because at a
4.6pt text area the left fragment of "Guilty" and the left fragment of "G" are the
same pixels. The differential was designed before the button was measured and asks
a question the geometry had already made unanswerable.

`2 COUNSELOPP` answers it instead, using data already in both screenshots. Its export
value is "have" and its display value is "   have" with three leading spaces, and at
48.9pt the widget is wide enough that BOTH fit. So the leading gap discriminates.

Measured on the interior text area, excluding the border and the form's own
underline artwork:

| Screenshot | Leading gap | Ink width | Glyph clusters |
|---|---|---|---|
| probe A | 11.40pt | 15.80pt | 4 |
| probe E | 9.05pt | 15.93pt | 4 |
| "have" at Helvetica 8pt | ~1pt expected | 15.57pt | 4 |
| "   have" at Helvetica 8pt | ~6.7pt expected | 15.57pt | 4 |

Both carry roughly 9 to 11pt of leading space before 15.8pt of ink. That is the
DISPLAY string. **Acrobat maps `/V` through `/Opt` and renders the display text.**

Two conclusions follow:

1. The two-step write is correct and Acrobat honours it. The earlier hypothesis that
   Acrobat renders the raw `/V` is REFUTED.
2. The findings clip is caused entirely by the dropdown button consuming the widget.
   Acrobat is rendering the right string, "G", into a text area too narrow to hold
   it. Nothing the emitter does can change that.

### Decision: keep the export value

`/V` stays "Guilty", and this is now settled rather than provisional. The form's own item-6 validate script tests
`getField("1A FINDING").valueAsString != "Guilty"`, so writing "G" would make the
form falsely alert "There must be a guilty finding in order to impose punishment"
on a document that has one. Correct data plus a cosmetic on-screen clip beats
incorrect data plus a clean glyph. The two-step write stands.

### Outstanding control

Open the untouched `public/forms/navmc-10132-blank.pdf` in Acrobat and pick Guilty at
1A by hand. A human selection stores the export value exactly as the emitter does.

- If it clips identically, this is a defect in the official form, our output is no
  worse than the government's, and it becomes the fifth finding in the CMC (JA)
  defect report.
- If it renders a clean "G", the emitter is doing something Acrobat dislikes and the
  two-step write needs rework before Phase 5.

Prediction, stated before the test: it clips identically. Confidence is now high,
because Acrobat has been shown to render the display text and "G" does not fit
regardless of what the emitter writes. The control is still worth thirty seconds,
since a clean render would mean something about our output differs from a hand
selection in a way the measurements have not caught.

## Notes carried to Phase 5

1. pdf-lib substitutes Helvetica for the widgets' declared `/Arial`. The two are
   metric-compatible so spacing matches, but glyph shapes differ slightly from an
   Acrobat-filled reference. Cosmetic, worth knowing before anyone diffs renders.
2. pdf-lib repaints the widget border and a white background box when it generates
   an appearance. Nothing on page 1 or 2 appeared obscured in the rendered probes,
   but a close Acrobat comparison is the real check.
3. Capacity figures in the map differ from the spec's hand-calculated table by at
   most one character. The MAP is authoritative from here. Better still, the
   validator should measure the actual string width in points rather than count
   characters, since the font is proportional. Recommend V-09 and V-15 be
   implemented as width checks with the character count kept only as a UI meter hint.

## Gate

Awaiting Stephen's answers to D-2, D-5, and D-12 before Phase 1 starts.
