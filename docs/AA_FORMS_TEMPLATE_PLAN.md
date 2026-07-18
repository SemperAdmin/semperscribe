# AA Form + Page 11 Template Pack - Analysis and Plan (R13)

Status: SHIPPED 2026-07-17 (B1-B4; B5 = Stephen's content pass, open).
26 .nldp files in public/templates/global/, index.json at 58 entries,
tests/template-pack.test.ts guards the whole template system (354 checks
pass in the sandbox harness). Converter: outputs/syncfix/convert_aa_forms.py
(rerunnable). Known source-faithful quirks left for the B5 pass: the MMOA
teaching copies put YYYYMMDD placeholders on non-date items (Marital
Status, Number of Depns) and carry CAPT FNAME placeholders in their
subjects - kept verbatim; correcting official content is Stephen's call.
Date: 2026-07-17. Source: the 28 PDFs in Forms/ (gitignored, local only).
Extracted field data: outputs/aa_forms_datasets.json (sandbox scratchpad).

---

## 1. What the folder actually contains

All 28 files were opened and their embedded data extracted. These are XFA
(Adobe LiveCycle) forms - the visible PDF page is a "Please wait" shell and
the real content lives in embedded XML streams, which is why they render
blank in most tools. Extraction went through the XFA `datasets` stream.

| Group | Count | Files | Data quality |
|---|---|---|---|
| MMIB-3 topic templates ("AA FORM; X Template") | 18 | 3 POV, Alt Separation Site, BAH x7 (AFMT, Change Designated Place, DDT, DDT Extension, Deployment, PME/Training, Proximity Retention), COT Incentive, Circuitous Travel, ERD, Excess Baggage, Fully Funded PCSO, IPCOT Incentive, OTEIP Change, OTEIP Incentive, TAD >180 Days | Clean fill-in templates with placeholder conventions |
| MMOA assignment forms | 4 | MMOA-Blank, O6-level SgtMaj slate, not-to-be O6 SgtMaj slate, RA SgtMaj Billet | Blank + 3 niche SgtMaj slating letters |
| MMOA "reviewed" teaching copies | 4 | CONUS 12-mo extension, OCONUS 12-mo extension, TOS waiver, Tour curtailment | Templates with INSTRUCTIONAL NOTES embedded inside the field values ("(Note: MAX abbreviation, MCO P1070.12K...)") |
| Flat example | 1 | Billet-Request-EXAMPLE | No XFA - a printout, not a template. Reference only. |
| Page 11 | 1 | Redesignation - Page 11 | NAVMC 118(11), different form family entirely |

## 2. The NAVMC 10274 skeleton maps 1:1 onto the existing aa-form type

Every AA form carries the same 13 XFA fields. The app ALREADY has an
`aa-form` document type (schemas AAFormDefinition, template aa-form.ts,
renderer navmc10274Generator). The mapping is direct:

| XFA field | Form block | App field |
|---|---|---|
| Date | Date | date |
| ActNum | Action number | actionNo |
| FileNum | File number | ssic (7220 for pay/travel topics, 1331 for assignment topics) |
| NameFrom | From | from |
| Via1 | Via | vias[] |
| OrgStat | Organization/Station | orgStation |
| AddrTo | To | to |
| NatOfAct | Nature of action | subj |
| CopyTo | Copy to | copyTos[] |
| RefAuth | Reference/Authority | references[] |
| Encl1 | Enclosures | enclosures[] |
| SuppInfo | Supplementary information | paragraphs[] |
| ProcAct | Processing of action | (endorsement chain block - existing box handling) |

The SuppInfo bodies are numbered paragraphs with lettered sub-items -
EXACTLY the app's paragraph model. Example (BAH DDT): para 1 request, para 2
justification placeholder, para 3 data items a-f, para 4 POC line.

CONCLUSION: no new document type, no new renderer, no schema work for the
AA side.

CORRECTED delivery vehicle (2026-07-17, after inspecting the live system):
the Templates button does NOT read the TypeScript registry
(src/lib/templates - that feeds the dynamic-forms page). It fetches
`public/templates/global/index.json` and loads `.nldp` JSON payloads through
the normal import path, filtered by documentType with search. 32 templates
ship this way today, including ONE generic aa-form and FOURTEEN page11
entries. Each topic therefore becomes one `.nldp` file plus one index
entry - pure content, zero app code.

## 3. Conversion rules (the cleanup the source data needs)

1. SPLIT multi-line values on the embedded CR characters: RefAuth ->
   references[], Encl1 -> enclosures[], CopyTo -> copyTos[], Via1 -> vias[],
   AddrTo/OrgStat -> multi-line to/orgStation.
2. STRIP the "(Note: ...)" teaching text from the 4 reviewed MMOA files out
   of the field values and MOVE it into per-template guidance - the P3.3
   guidance system is the right home, so the notes appear as help, not as
   text a Marine must remember to delete.
3. NORMALIZE placeholders: the sources mix DD MMM YY with YYYY/MM/DD, and
   RANK FNAME MI. LNAME with Captain Fname. App convention wins: date
   defaults to today (existing behavior), the From line uses the profile
   autofill, and remaining fill-me slots use one visible convention.
4. REMOVE stray signature placeholders from SuppInfo tails ("FI. MI. LNAME"
   belongs in sig, not the last paragraph).
5. KEEP per-topic addressees: pay/travel topics go to CMC (MMIB-3), officer
   assignment topics to CMC (MMOA-1). The address is part of the topic
   knowledge - that is half the value of the pack.
6. The 3 SgtMaj slate letters are niche (First Sergeant/SgtMaj slating).
   Include or drop is a scope ruling (Section 6).

## 4. Page 11 - CORRECTION

The first version of this section claimed the app has no page-11 type.
FALSE - written from the XFA field comparison without checking schemas.
Ground truth: documentType `page11` exists (Page11Definition, pdfPipeline
`navmc11811`), with 14 Pg-11 templates already shipping (6105 x2, alcohol,
BCP, drug, hostile-fire waiver, PRP x2, resignation, retirement, sole
survivor, VSI/SSB, promotion x2). The Pg-11 model: name, edipi, date,
remarksLeft ("Entry:"), remarksRight (entry text with signature lines
inline).

Stephen's ruling (2026-07-17): apply the supplied Redesignation text to the
existing template model. F2 is therefore ONE new .nldp file
(page11-redesignation-firstsgt), not a build phase.

## 5. Build plan (FINAL - content generation, no app code)

- B1: conversion script (sandbox, one-shot) reads the extracted
  aa_forms_datasets.json and emits 25 aa-form .nldp files matching the
  existing aa-form.nldp shape exactly: CR-values split into
  vias/references/enclosures/copyTos arrays, SuppInfo split into the
  numbered paragraph model, MMOA "(Note:...)" text stripped INTO the
  package.description (surfaced in the picker card), placeholders
  normalized (dates blank -> app fills today; From line left as the
  profile-fill placeholder convention), stray signature tails removed.
- B2: page11-redesignation-firstsgt.nldp from Stephen's supplied text,
  verbatim, matching the existing page11 nldp shape.
- B3: index.json gains 26 entries (title, description, documentType, url).
- B4: tests/template-pack.test.ts - every index entry resolves to an
  existing file, every .nldp parses, documentType matches the index,
  formData.documentType present, aa-form entries carry subj + at least one
  reference or "NONE". Guards the whole template system, not just the pack.
- B5: human pass - Stephen spot-checks 3-4 templates in the picker on
  localhost before push (content accuracy is his call, not mine).

## 5b. ADDENDUM - Official-form PDF export (SHIPPED 2026-07-17)

Stephen's ruling: unsigned FORM exports go onto the ACTUAL NAVMC form,
fillable, not the flattened redraw. Implementation:

- public/forms/ bundles the blank NAVMC 10274 and NAVMC 118(11)
  (pikepdf-normalized: decrypted + xref rewritten - the identical
  operation that produced the Adobe-validated prototypes; the page11
  source was rights-encrypted and the AA source had a broken xref,
  both fatal to pdf-lib until normalized).
- src/lib/xfa-form-fill.ts replaces the XFA `datasets` stream via
  pdf-lib's low-level API. XML builders invert the template converter:
  (a)/(1) prefixes re-added, paragraph citations reconstructed with the
  SAME engine as the flattened renderer, XML-escaped, CR separators.
- useDocumentExport routes PDF exports of aa-form/page11 to the
  official form when NO signature fields are configured AND NO
  enclosure files are bound - both force the flattened path because the
  dynamic-XFA renderer ignores drawn annotations and appended pages.
  A toast states the Adobe-only constraint on every official export.
- Verified: 10/10 sandbox harness (builders, real-blank round trips,
  NeedsRendering preserved, non-XFA refusal), scoped tsc clean,
  tests/xfa-form-fill.test.ts runs the same against the real blanks.
  Adobe gate ROUND TWO pending: _XFA_TEST_*_V2.pdf are pdf-lib-written
  (the shipping code); Stephen validates in Adobe, then deletes all
  four _XFA_TEST_* files.

Known bounds (format properties, not defects): output renders only in
Adobe Acrobat/Reader; browsers show the LiveCycle shell page. DOCX
export of forms is unchanged (flattened path).

## 6. Rulings (Stephen, 2026-07-17)

1. F1 scope: ALL 22 topics in one pass (18 MMIB-3 + 4 MMOA reviewed).
2. SgtMaj slate letters: INCLUDE - 25 templates total.
3. F2 (Page 11): AFTER F1 ships. Recorded backlog, not in this build.
4. Pg 11 entry library: STEPHEN SUPPLIES his shop's standard entries when
   F2 begins.
