# Semper Scribe - Project Roadmap

> Reference file for tracking features, correspondence types, and implementation progress.
> Updated: 2026-02-16 (Reflecting MCO 5216.20B)

---

## Correspondence Types

### Group 1: Standard Naval Letter Format

Uses the standard "From: / To: / Subj:" header structure.

| Type | Status | Reference | Notes |
|------|--------|-----------|-------|
| Standard Letter | DONE | SECNAV M-5216.5, Ch 2 | Default format for official correspondence outside the command |
| Multiple-Address Letter | DONE | SECNAV M-5216.5, Ch 2 | Same as Standard Letter but addresses multiple recipients (e.g., "Distribution List") |
| Endorsement (Same-Page) | DONE | SECNAV M-5216.5, Ch 3 | Continues on the original page if space permits |
| Endorsement (New-Page) | DONE | SECNAV M-5216.5, Ch 3 | Starts on a fresh page |

### Group 2: Memorandums

Internal or semi-formal correspondence. Formatting varies significantly.

| Type | Status | Reference | Notes |
|------|--------|-----------|-------|
| Memorandum for the Record (MFR) | DONE | SECNAV M-5216.5, Ch 5 | No "To:" line. Documents events internally. Uses plain paper (no letterhead) |
| "From-To" Memorandum | DONE | SECNAV M-5216.5, Ch 5 | Informal, internal routine business. Uses plain paper or authorized command memo forms |
| Letterhead Memorandum | DONE | SECNAV M-5216.5, Ch 5 | Formal memo to senior officials. Uses Command Letterhead but keeps "From/To" structure |
| Memorandum of Agreement/Understanding (MOA/MOU) | DONE | SECNAV M-5216.5, Ch 5 | Side-by-side dual-party headers and signature blocks |

### Group 3: Staffing Papers (USMC Specific)

Updated per MCO 5216.20B. Briefing documents used for staffing actions and decisions.

| Type | Status | Reference | Notes |
|------|--------|-----------|-------|
| Information Paper | DONE | MCO 5216.20B, Sec 10 | New Standard. Replaces Point/Talking papers. Uses "tick and bullet" format. 1-2 pages max. |
| Position/Decision Paper | DONE | MCO 5216.20B, Sec 10 | Unified format. Includes BLUF, Discussion, and mandatory Decision Grid (Approve/Disapprove). |
| Coordination Page | DONE | MCO 5216.20B, Fig 13-8 | Mandatory staffing table for routing packages. Tracks concurrence/non-concurrence. |
| CMC Green Letter | TODO | MCO 5216.20B, Sec 10 | Personal comms between CMC and General Officers. (Lower priority). |
| CMC White Letter | TODO | MCO 5216.20B, Sec 10 | Personal comms between CMC and Commanders. (Lower priority). |

### Group 4: External & Executive

No "From/To" block. Civilian-style letter formatting.

| Type | Status | Reference | Notes |
|------|--------|-----------|-------|
| Business Letter | DONE | SECNAV M-5216.5, Ch 4 | Writing to civilians/private businesses. "Dear Mr. Smith," / "Sincerely," format |
| Executive Correspondence | DONE | SECNAV M-5216.5, Ch 12 | Letters to President, Congress, SecDef. Supports letter, standard memo, action memo, and info memo formats |

### Other Document Types

| Type | Status | Reference | Notes |
|------|--------|-----------|-------|
| AMHS Message (GENADMIN/MARADMIN) | DONE | JANAP 128 / NTP-3 | DTG, references, NARR, POC, validation, terminal preview |
| MCO (Marine Corps Order) | DONE | MCO 5215.1K | Directives with distribution statements and reports required |
| MCBul (Bulletin) | DONE | MCO 5215.1K | Time-limited directives with cancellation date |
| AA Form (NAVMC 10274) | DONE | NAVMC 10274 | Administrative Action form |
| Page 11 (NAVMC 118-11) | DONE | MCO P1070.12K | Administrative Remarks |

---

## Template Architecture

Three master templates to cover the majority of formatting logic:

| Template | Covers | Status |
|----------|--------|--------|
| Template A (Standard) | Standard Letters, Endorsements, Letterhead Memos | DONE |
| Template B (Papers) | Information Papers, Position/Decision Papers (updated bullet logic) | DONE |
| Template C (Civilian) | Business Letters, Executive Correspondence (center/right alignment, salutations) | DONE |

---

## Implemented Features

### Core
- [x] Live document preview (desktop side panel)
- [x] Mobile preview modal (slide-up sheet with auto-refresh)
- [x] PDF export with proper formatting
- [x] DOCX export (Microsoft Word)
- [x] AMHS plain text export
- [x] Shareable links (LZ-string compressed URL state)
- [x] Draft saving/loading (browser localStorage)
- [x] NLDP import/export (Naval Letter Data Package)
- [x] Template system (global and unit-specific)
- [x] Form validation with real-time feedback
- [x] SSIC database with combobox search
- [x] Unit code database

### Editor
- [x] Multi-level paragraph numbering (1., 1.a., 1.a.(1), etc.)
- [x] Bold/Italic/Underline text formatting
- [x] Voice input / speech-to-text (Web Speech API)
- [x] Smart paragraph insertion
- [x] Reference list with letter designators
- [x] Enclosure list with numbering
- [x] Via chain routing
- [x] Copy-to distribution
- [x] Closing block (signature, name, title)

### AMHS Message
- [x] Message type selection (GENADMIN, MARADMIN, etc.)
- [x] Classification and precedence
- [x] Auto-generated DTG (Zulu time) with refresh
- [x] Reference manager with document identifiers
- [x] NARR auto-generation from references
- [x] POC manager (name, phone, email)
- [x] Message body with smart paragraph insert
- [x] Validation before copy/export
- [x] Terminal-style preview (green on black)

### Directives (MCO/Bulletin)
- [x] Distribution statement (A through F)
- [x] Reports required with RCS symbols
- [x] Cancellation date (bulletins)
- [x] Directive title line

### Integration
- EDMS context detection and Supabase Edge Function support were removed in the 2026-05 compliance remediation pass. See docs/COMPLIANCE_REMEDIATION_PLAN.md, Phase 1.

### UX
- [x] Responsive design (mobile, tablet, desktop)
- [x] Disclaimer modal on startup
- [x] Tooltips with contextual help
- [x] Acronym database
- [x] Signature placement modal (interactive PDF overlay)
- [x] Toast notifications

---

## Planned Features

### High Priority
- [x] Multiple-Address Letter support (distribution list addressing)
- [x] Memorandum for the Record (MFR) format
- [x] "From-To" Memorandum format
- [x] Letterhead Memorandum format
- [x] Information Paper
- [x] Coordination Page

### Medium Priority
- [x] Position/Decision Paper
- [x] Business Letter format (civilian style)

### Lower Priority
- [x] Executive Correspondence format
- [x] MOA/MOU format (multi-party signature blocks)
- [x] Template B engine (bullet indentation logic for papers)
- [x] Template C engine (civilian letter formatting)
- [ ] CMC Green/White Letters

### Feature Enhancements
- [x] Spell check with military terminology awareness
- [x] Batch document generation (mail merge via CSV)
- [x] Print-optimized CSS for direct browser printing (covered by PDF preview)

---

## Reference Documents

| Reference | Title | Covers |
|-----------|-------|--------|
| SECNAV M-5216.5 | Department of the Navy Correspondence Manual | Ch 2: Standard Letters; Ch 3: Endorsements; Ch 4: Business/Executive Letters; Ch 5: Memorandums |
| MCO 5216.20B | Marine Corps Correspondence Manual | Information Papers, Position/Decision Papers, Coordination Pages |
| MCO 5215.1K | Marine Corps Directives Management | Marine Corps Orders (MCO), Bulletins (MCBul), distribution statements |
| MCO P1070.12K | Marine Corps Individual Records Administration Manual | Page 11 (NAVMC 118-11) administrative remarks |
| NAVMC 10274 | Administrative Action Form | AA Form field definitions and usage |
| NAVMC 118-11 | Administrative Remarks (Page 11) | Service record entries |
| JANAP 128 / NTP-3 | Message Handling Procedures | AMHS message formatting (GENADMIN, MARADMIN) |
