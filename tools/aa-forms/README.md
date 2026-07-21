# AA Form / Page 11 template pipeline

Provenance and regeneration path for the 25 AA Form templates and the
Page 11 entries in `public/templates/global/`. Full analysis:
`docs/AA_FORMS_TEMPLATE_PLAN.md`.

## Why this exists

The source PDFs (the original `Forms/` folder) are dynamic XFA
(LiveCycle) forms - the visible page is a "Please wait" shell and the
real content lives in embedded XML. `xfa_datasets_extracted.json` is
that content, pulled from all 28 files: it IS the source data, so the
original PDFs are no longer required to regenerate the templates.

## Files

- `xfa_datasets_extracted.json` - the XFA `datasets` field values from
  each source PDF, keyed by original filename. 28 entries.
- `convert_aa_forms.py` - converts that data into `.nldp` templates +
  index entries. Encodes every cleanup rule: list prefixes stripped
  (the renderer adds them - a prefixed source item would double-number),
  SuppInfo split into the app's paragraph model with the naval ladder
  normalized, MMOA "(Note: ...)" teaching text moved into the picker
  description, "or NONE" artifacts removed, signature tails dropped,
  Page 11 entries flowing LEFT column first.

## Regenerating

```bash
# expects xfa_datasets_extracted.json at /tmp/forms/all_datasets.json
mkdir -p /tmp/forms && cp tools/aa-forms/xfa_datasets_extracted.json /tmp/forms/all_datasets.json
python3 tools/aa-forms/convert_aa_forms.py     # writes /tmp/nldp_out
cp /tmp/nldp_out/*.nldp public/templates/global/
# then merge /tmp/nldp_out/_new_index_entries.json into index.json
npm test -- template-pack                      # guards every entry
```

Prefer fixing a rule here and regenerating over hand-editing 25 files.

## Re-extracting from new source PDFs

```python
import pikepdf, re, html
pdf = pikepdf.open('SOME-AA-FORM.pdf')
xfa = pdf.Root.AcroForm.XFA
for i in range(0, len(xfa), 2):
    if str(xfa[i]) == 'datasets':
        print(xfa[i+1].read_bytes().decode('utf-8'))
```

## The bundled blanks

`public/forms/navmc-10274-blank.pdf` and `navmc-118-11-blank.pdf` are
the official blanks, pikepdf-normalized (decrypted + xref rewritten -
the 118(11) source was rights-encrypted and the 10274 source had a
broken xref, both fatal to pdf-lib). The XFA export fetches them at
runtime; they are NOT regenerable from this folder. Do not replace them
with raw downloads without re-normalizing:

```python
import pikepdf
pdf = pikepdf.open('raw.pdf'); pdf.save('normalized.pdf')
```

`public/forms/navmc-10922-blank.pdf` is the NAVMC 10922 (7-21)
Dependency Application, same normalization (source was encrypted with
invalid padding, fatal to pypdf). All 10 XFA streams verified
byte-identical to the source after normalization.

## NAVMC 10922 positional map

The 10922 form has non-unique field names (77 of 102 datasets nodes are
`ParticipantName`), so filling is positional, not name-keyed.
`extract_10922_map.py` derives the position order from template.xml and
verifies it against the form's shipped datasets stream on every run:

```bash
# regenerate the map (fails loudly if the form revision changed)
python3 tools/aa-forms/extract_10922_map.py extract \
    public/forms/navmc-10922-blank.pdf tools/aa-forms/navmc10922-map.json

# sentinel round-trip: fill 102 indexed values, re-extract, assert order
python3 tools/aa-forms/extract_10922_map.py verify \
    public/forms/navmc-10922-blank.pdf tools/aa-forms/navmc10922-map.json
```

`navmc10922-map.json` is the single source for the positional emitter
(`buildNavmc10922Xml`), the flattened generator's box map, and the
round-trip tests. Rule source: `docs/NAVMC_10922_SPEC.md`. Build
sequence: `docs/NAVMC_10922_BUILD_PLAN.md`.
