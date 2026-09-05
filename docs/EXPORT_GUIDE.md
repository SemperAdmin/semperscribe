# Export Functionality Guide

## How the Export Functions Work

Both export functions are **WORKING CORRECTLY** as confirmed by the console logs. Here's how to use them:

### 1. Word Document Export
- **Button**: "Generate Word Document" 
- **Action**: Click once → Document downloads immediately
- **File Format**: `.docx`
- **Status**: ✅ Working perfectly

### 2. NLDP Package Export  
- **Button**: "Export Package"
- **Action**: Two-step process:
  1. Click "Export Package" → Opens configuration dialog
  2. Fill out the dialog form (optional fields)
  3. Click "Export Package" button **inside the dialog** → File downloads
- **File Format**: `.nldp` (JSON format for sharing directive data)
- **Status**: ✅ Working perfectly

## Important Notes

### The Export Package is a 2-Step Process:
1. **First Click**: Opens the export configuration dialog
2. **Dialog Interaction**: Fill out optional metadata fields
3. **Second Click**: Click "Export Package" **within the dialog** to actually download

### Why the Dialog?
The NLDP export dialog allows you to:
- Add package title and description
- Include author information (optional)
- Add tags for organization
- Configure export settings

### Quick Export Option
If you want to skip the dialog configuration:
1. Click "Export Package" (opens dialog)
2. Immediately click "Export Package" in the dialog (uses default settings)
3. File downloads with minimal configuration

## Same-Page Endorsements

An endorsement carries a placement: new page or same page. SECNAV
M-5216.5 9-1 decides between them by measurement, not by taste. If the
endorsement "will completely fit on the signature page of the basic
letter or the preceding endorsement", it goes on that page. If not, it
goes on a new page.

The fit is measured when the package is assembled, because it depends
on the document underneath. Open Assemble Package, add the basic letter
and its endorsements in order, and press Measure pages. Each same-page
member reports either "Fits on page N of the previous document" or
"Does not fit: exported as a new-page endorsement". Export package PDF
then draws the fitting blocks onto the signature pages above them, so
they add no page and the members after them keep their numbering, and
exports the rest as new-page endorsements.

The measurement itself: the block fits when it renders to a single page
and its height plus two blank lines clears the one inch bottom margin,
counting down from the last line of content on the page below it. Page
numbers, classification banners and distribution statements sit inside
that margin and are not counted as content.

A same-page endorsement omits the SSIC, the subject and the basic
letter's identification by default, which 9-2.1.a allows as long as the
entire page will be photocopied. With that omission the endorsement
line reads FIRST ENDORSEMENT with nothing after it, and the
identification block is the Ser line and the date, which is what
Figure 9-1 draws. Clearing the checkbox brings the SSIC, the subject
and the "on ..." clause back. When a same-page endorsement does not
fit and falls back to a new page, the identification is restored
whatever the checkbox said, because every new-page endorsement carries
it (Figure 9-1, second endorsement).

A same-page endorsement carries the letter it is added to. Under
Endorsement Details, attach the signed letter as a PDF or pick a letter
from the library. The preview and the PDF export are then the letter
with the endorsement on it: composed onto the signature page when the
block fits, and appended as a new-page endorsement numbered after the
letter's pages when it does not, with the identification restored. The
details card and the export toast say which happened.

Without a letter attached, a same-page endorsement previews and
exports as a page of its own: letterhead, seal and page numbering like
any letter, with the 9-2.1.a omission still taken. There is no
signature page present to measure against, so the compliance panel
reports that and cites 9-1 rather than refusing. The bare block, with
no letterhead and no page number, exists only inside the composer: it
is rendered when a letter is attached or a package is assembled, and
drawn onto that letter's signature page (Figure 9-1). The Word export
is always the page, since Word takes no PDF host.

Figure 9-1 draws a horizontal rule between the basic letter and the
first endorsement. The text of 9-2 prescribes no rule, so none is
drawn: the figure's rule separates two documents printed on one
illustrated page.

## Official NAVMC Form Exports (XFA)

Three document types export onto the OFFICIAL fillable NAVMC form
instead of a redrawn PDF: NAVMC 10274 (AA Form), NAVMC 118(11)
(Page 11), and NAVMC 10922 (Dependency Application).

- **Open the file in Adobe Acrobat or Reader.** Browsers and most
  viewers show a "Please wait" placeholder page - the form is a
  dynamic LiveCycle XFA document and only Adobe renders it. The fields
  stay editable after export.
- **Signature fields or bound enclosure files force the flattened
  path** - the XFA renderer ignores drawn annotations and appended
  pages, so they would silently vanish from the official form.
- **NAVMC 10922 specifics:**
  - The export gate blocks on the dependency-application validators
    (self-attestation, dissolution dates, capacity, Section 7 line
    length) - each blocker states its MCO/FMR citation.
  - The START reason box cannot be checked on the editable form (the
    checkbox is unbindable in the form's own data layer). Check it in
    Adobe after export, or use the flattened export once available.
  - The official form's own artwork marks it "CUI (when filled in)".
    The app adds no markings; handle the filled file accordingly.
  - Rule sources and the full field map: `docs/NAVMC_10922_SPEC.md`.

## Official NAVMC Form Export (AcroForm)

NAVMC 10132 (Unit Punishment Book) exports onto the official blank too,
but by a completely different mechanism from the three XFA forms above.
It is a plain AcroForm addressed by field NAME. The two paths share
nothing except the idea of filling a bundled blank, so nothing in the
XFA section applies here.

- **It opens anywhere.** Any viewer renders it, Adobe not required.
  This is the practical difference from the XFA forms, which show a
  "Please wait" placeholder outside Adobe. The live preview inside
  SemperScribe shows the real document for the same reason.
- **The fields stay editable** after export.
- **The seven signature widgets are left empty on purpose** so items 9
  and 16 are CAC-signed in Adobe. The app never draws a signature.
- **Signature fields and bound enclosure files do NOT force a
  flattened path.** Drawn annotations and appended pages survive on an
  AcroForm, so NAVMC 10132 has no flattened fallback and needs none.
- **Adobe's usage-rights signature is removed.** Filling the form
  changes the bytes, which voids that signature, because it covers the
  original bytes exactly. Showing no signature beats showing an invalid
  one, since an invalid signature reads as tampering. Filling and
  signing are unaffected.
- **Signing item 16 locks the whole form in Adobe.** Do it last. The
  unit diary entry recorded there must comply with MCTFSPRIUM.
- **Item 5 findings store long values and display short ones.** The
  dropdowns store "Guilty" and "Not Guilty" while the form displays "G"
  and "NG", and the form's own item-6 script tests for "Guilty". A tool
  reading the file sees the long value. This is the government form's
  behavior, not the app's.
- **Item 6 clipping is the form's own defect.** The dropdown button
  covers part of the widget. The app measures against the usable width
  and warns before the text overflows.
- **The unit diary handoff is a separate panel, not part of the PDF.**
  It emits a copyable transcription aid. SemperScribe has no MCTFS
  connection, so a human types the entry. Only offense rows with a
  Guilty finding are reportable, and the panel warns when item 16
  already carries a UD number, because entering it twice creates a
  duplicate.
- **The official form's own artwork marks it "CUI (when filled in)".**
  The app adds no markings. Handle the filled file accordingly.
- Rule sources and the full 74-field map: `docs/NAVMC_10132_SPEC.md`
  and `tools/aa-forms/navmc10132-map.json`.

## File Locations
- Downloads go to your browser's default download folder
- Correspondence filenames follow the format: `[SSIC] [SUBJECT].[extension]`
- Example: `MCO 1610.7B PERFORMANCE EVALUATION SYSTEM PES.docx`
- Forms are named from the form and the Marine instead, since they
  carry no SSIC or subject line
- Example: `NAVMC 10132 - MARTINEZ LUIS A.pdf`
- `getExportFilename` in `src/lib/naval-format-utils.ts` is the single
  source for both

## Troubleshooting
- ✅ Both exports are confirmed working via console logs
- ✅ File generation is successful (16KB+ NLDP files, 13KB+ Word docs)
- ✅ Downloads are triggering properly
- If you don't see the file, check your browser's download folder and download permissions

## Console Evidence (from your logs)
```
Export completed successfully
useNLDP: Export completed successfully  
Word document download initiated successfully
Download completed successfully
```

The functionality is working correctly - it was a UI understanding issue, not a technical problem!