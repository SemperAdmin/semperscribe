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

## File Locations
- Downloads go to your browser's default download folder
- Filenames follow the format: `[SSIC] [SUBJECT].[extension]`
- Example: `MCO 1610.7B PERFORMANCE EVALUATION SYSTEM PES.docx`

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