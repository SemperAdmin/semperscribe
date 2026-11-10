# Semper Scribe - User-Focused Marketing Details

> Revised 10 November 2026. The earlier version (20 October 2025) described the
> app's first incarnation, the "Marine Corps Directives Formatter": orders and
> bulletins only, an 8-step wizard, and Word output only. None of that matches the
> current app. Every claim below traces to the code or the root
> [`README.md`](../README.md). Keep it that way: no time-savings percentages, ROI
> figures, or "100% compliant" claims unless they are measured and cited.

## Overview

**Semper Scribe** is a local-first web application that formats USMC correspondence, directives, and administrative forms. It runs entirely in the browser and is aligned with **SECNAV M-5216.5** and **MCO 5215.1K**.

> **Not official USMC software.** Semper Scribe is a non-official Proof of Concept with no Authority to Operate. Never enter classified information. Enter CUI only once your authorizing official has approved the application for that use on your system. Any marketing copy must carry this posture.

---

## What Problems It Solves

- **Formatting kickbacks.** Letters come back for margins, header alignment, paragraph numbering, and citation errors, not content. The app lays out the format and checks it live as you type.
- **Outdated templates.** Shared Word templates drift. Semper Scribe builds each document from one maintained definition per type.
- **Lost drafts.** Drafts go into an on-device library with crash recovery and optional auto backup to a folder.
- **Rework on official forms.** NAVMC forms are filled onto the official PDF, with validation for each form's own rules.

---

## Key Features

### 1. Document Coverage: 32 Types in 10 Groups

| Group | Types |
|---|---|
| Standard Letter | Basic Letter, Multiple-Address Letter, Endorsement (new page or same page) |
| Memorandums | MFR, From-To, Letterhead, MOA, MOU |
| Staffing Papers | Information, Position, Decision Papers, Coordination Page |
| External & Executive | Business Letter, Executive Correspondence |
| DLA Correspondence | DLA Memorandum, DLA Business Letter |
| Directives | MCO, MCBul, Change Transmittal, SECNAV Instruction, SECNAV Notice, Volume |
| Forms | NAVMC 10274 (AA Form), NAVMC 118(11) (Page 11), NAVMC 10922, NAVMC 10132 (Unit Punishment Book), NAVMC 11106 (COLA), DD 368, TLA Packet |
| Counseling Worksheets | Counseling Worksheet |
| Technical Publication | I-Type Publication |
| AMHS Message | GENADMIN, MARADMIN, ALMAR |

### 2. Guided Editing

- Pick a type in the sidebar and fill guided sections. There is no fixed wizard.
- Searchable unit database (about 3,700 entries) for letterhead and unit information.
- SSIC lookup (about 2,700 codes).
- Profile auto-fill for From line, signature block, and originator code.
- Multi-level paragraphs with add, remove, reorder, voice dictation, and spell check with a military dictionary.
- References, enclosures (PDF enclosures merge into the export), Via chain, distribution, and copy-to.
- About 120 shipped templates, plus a filled example on the home page.

### 3. Live Checking

- Live PDF preview with a compliance banner.
- **Compliance Issues** lists every validation issue, and a one-click **Fix** corrects the mechanical ones.
- **Proofread** checklist in four categories per SECNAV M-5216.5: Format, Framework, Typography & Grammar, Content.
- Classification marking validation: a portion marking above the banner is flagged.
- Correspondence Guide: what the main correspondence types are for, and when not to use them.

### 4. Output

- PDF, PDF with signature fields, and Word (DOCX). DOCX is the screen-reader accessible copy.
- AMHS plain text, and the NLDP data package for moving a document between machines.
- Batch generation: a CSV in, one PDF per row in a ZIP out.
- Package assembly: one PDF with continuous page, reference, and enclosure numbering.
- Encrypted share links (AES-256, password, optional expiry).

### 5. Trust and Data Handling

- No backend, no telemetry. The formatter transmits nothing.
- Every export is scanned for SSN and EDIPI patterns and PHI keyword clusters, and asks before the file is written. It asks, it never blocks or rewrites.
- Installs as an app and works offline.
- The optional GunnyBot assistant is the one path where data leaves the browser. It stays off until the user supplies a personal provider key, and it scans for SSN and EDIPI before sending.

### 6. Review and Signature

- Review mode with paragraph comments for kickback lists.
- Revision compare between two saves, with restore.
- Signature fields placed on the PDF, and a guided signing flow. CAC signing itself happens in Acrobat.

---

## Use Cases

- **Admin clerks and S-1 staff:** letters, endorsements, Page 11 entries, AA forms, COLA and dependency applications.
- **Staff officers:** staffing papers, MOAs and MOUs, executive correspondence.
- **Directive writers:** orders, bulletins, change transmittals, and multi-chapter volumes.
- **Legal clerks:** the NAVMC 10132 Unit Punishment Book and the NJP package generated from it.
- **Small-unit leaders:** counseling worksheets.

---

## Platform Details

- **Type:** static web application (Next.js), deployed to GitHub Pages, with a cloud.gov target available.
- **Requirements:** a modern browser. Chrome or Edge are needed for folder auto backup.
- **Storage:** browser IndexedDB and localStorage on the user's device only.
- **License:** MIT.

---

## Marketing Messages

### Tagline options

1. "Naval correspondence, formatted to standard and validated as you type."
2. "You bring the content. Semper Scribe handles the format."
3. "SECNAV M-5216.5 aligned, entirely in your browser."

### Claims to avoid

- "100% compliant", "zero errors", or any time-savings figure without a measurement behind it.
- "Official" or anything that suggests USMC, DON, or DoD endorsement.
- "Nothing ever leaves your machine". GunnyBot is the opt-in exception.
- A fixed document-type count in long-lived copy. The landing page computes it from the registry.

---

## Demo Scenarios

1. **First letter:** open the filled example, then build a basic letter from the sidebar, clear Compliance Issues, and export PDF and DOCX.
2. **Rescue a bad letter:** import a badly formatted Word or PDF letter, review the detected fields, and export it in correct format.
3. **Batch run:** generate one document per row of a CSV into a ZIP.
4. **Trust:** send an encrypted share link, then show the pre-export sensitive-data prompt.

See also [`DEMO_SCRIPT_MEETING_OF_THE_MINDS.md`](DEMO_SCRIPT_MEETING_OF_THE_MINDS.md).
