# DLA Correspondence Implementation Plan

## Goal
Add DLA Correspondence Manual (2011) support as a **separate, parallel ruleset** alongside the existing Navy/USMC correspondence system, without breaking any existing functionality.

## Guiding Principles
- **Additive only** — no modifications to existing Navy/USMC rendering paths; all DLA logic branches off new conditionals
- **Feature-flagged by headerType** — extend `'USMC' | 'DON'` to `'USMC' | 'DON' | 'DLA'`
- **New document types** — DLA formats get their own `documentType` values, schemas, and templates
- **Existing tests must pass** — run full test suite after each phase

---

## Phase 1: Type System & Infrastructure (No UI/rendering changes)

### Step 1.1 — Extend `headerType` union
**Files:**
- `src/hooks/useUserProfile.ts` — change `headerType: 'USMC' | 'DON'` → `'USMC' | 'DON' | 'DLA'`
- `src/lib/pdf-seal.ts` — update `getPDFSealDataUrl()` signature to accept `'DLA'`; DLA uses the standard DoD seal (same as USMC), so return the DoD seal for `'DLA'`
- `src/lib/docx-generator.ts` — update seal selection logic to handle `'DLA'`

### Step 1.2 — Add DLA document type schemas
**File:** `src/lib/schemas.ts`
- Add `DLAMemorandumDefinition` — DLA Standard Memorandum schema with:
  - `documentType: z.literal('dla-memorandum')`
  - `memorandumFor` field (replaces `to`)
  - `subject` field (replaces `subj`)
  - `through` array field (replaces `vias`)
  - `from` field removed (sender is identified in the letterhead only)
  - `signerFullName` field (full name in ALL CAPS, e.g., "JOHN M. HANCOCK")
  - Date field defaulting to civilian format
  - Standard paragraph structure (reuse existing `ParagraphData`)
- Add `DLABusinessLetterDefinition` — DLA Business Letter schema with:
  - `documentType: z.literal('dla-business-letter')`
  - Similar to existing `BusinessLetterDefinition` but with DLA-specific header/signature rules
  - Civilian date format enforced
  - Full name signature block
- Add `DocumentCategory` value: `'dla-correspondence'`
- Register both in `DOCUMENT_TYPES` object
- Set `pdfPipeline: 'standard'` initially (DLA-specific rendering handled via conditionals in Phase 3)
- Set appropriate `DocumentFeatures`:
  - `showVia: false` (DLA uses THROUGH, not Via)
  - `showEndorsementDetails: false`
  - New feature flag: `showThrough: true`
  - `category: 'dla-correspondence'`

### Step 1.3 — Add DLA templates
**New files:**
- `src/lib/templates/dla-memorandum.ts` — `DLAMemorandumTemplate` with:
  - `typeId: 'dla-memorandum'`
  - `headerType: 'DLA'`
  - `formatting: { dateStyle: 'civilian', subjectCase: 'uppercase', font: 'Times New Roman' }`
  - Default data with `memorandumFor`, `subject`, `through` fields
  - Signature: `signerFullName: 'JOHN M. HANCOCK'`
- `src/lib/templates/dla-business-letter.ts` — `DLABusinessLetterTemplate` with:
  - Similar structure, civilian-audience defaults
  - Salutation, complimentary close
  - Full name signature block

**Updated file:**
- `src/lib/templates/index.ts` — import and register both templates in `DOCUMENT_TEMPLATES`

### Step 1.4 — Run existing tests
- Verify all existing tests pass with no regressions
- The new types are additive; nothing existing should break

---

## Phase 2: UI Integration

### Step 2.1 — Settings & header type selector
**Files:**
- `src/components/SettingsDialog.tsx` (lines 276-289) — add `<SelectItem value="DLA">Defense Logistics Agency</SelectItem>`
- `src/components/document/HeaderSettingsSection.tsx` (lines 16-27) — add same DLA option

### Step 2.2 — Sidebar document type group
**File:** `src/components/layout/Sidebar.tsx`
- Add new `<AccordionItem value="dla-correspondence">` group after the existing categories
- Include `DocumentTypeButton` entries for:
  - `dla-memorandum` → "Standard Memorandum (DLA)"
  - `dla-business-letter` → "Business Letter (DLA)"

### Step 2.3 — Form field rendering for DLA types
The existing `DynamicForm` system renders fields from `SectionDefinition` arrays defined in the schema. The DLA schemas from Step 1.2 will define their own sections with the correct fields (`memorandumFor`, `subject`, `through`), so the form should render correctly without additional page.tsx changes.

Key considerations:
- `memorandumFor`, `subject`, `through` fields render via the DLA schema's `SectionDefinition`
- `from`, `vias`, `ssic`, `originatorCode` are **not present** in DLA schemas, so they won't appear
- When user switches to a DLA document type, the schema-driven form picks up the correct definition automatically

---

## Phase 3: PDF & DOCX Rendering

### Step 3.1 — Letterhead rendering
**Files:**
- `src/components/pdf/NavalLetterPDF.tsx` (lines 776-778) — add DLA branch:
  ```
  formData.headerType === 'USMC'
    ? 'UNITED STATES MARINE CORPS'
    : formData.headerType === 'DLA'
    ? 'DEFENSE LOGISTICS AGENCY'
    : 'DEPARTMENT OF THE NAVY'
  ```
- `src/lib/docx-generator.ts` (lines 119-121) — same letterhead text branch
- DLA uses the standard DoD seal (already available as the USMC/default seal)

### Step 3.2 — Header block rendering (MEMORANDUM FOR / SUBJECT / THROUGH)
**File:** `src/components/pdf/NavalLetterPDF.tsx`
- Add boolean helpers at the document type conditionals section (~line 580):
  ```
  const isDLAMemo = formData.documentType === 'dla-memorandum';
  const isDLABusinessLetter = formData.documentType === 'dla-business-letter';
  const isDLAType = formData.documentType.startsWith('dla-');
  ```
- **New conditional rendering block** (after existing From/To/Via block ~line 1052):
  - `MEMORANDUM FOR:` line using `formData.memorandumFor`
  - `SUBJECT:` line using `formData.subject`
  - `THROUGH:` lines using `formData.through[]` array (no endorsement chain — just simple routing labels)
  - No `From:` line, no Sender's Symbol block (no SSIC/originator code)
- **Gate existing blocks** to exclude DLA types:
  - Add `&& !isDLAType` to the From/To/Via rendering conditional (~line 1052)
  - Add `&& !isDLAType` to the Subj rendering conditional
  - Add `&& !isDLAType` to the Sender's Symbol block conditional
- **Same changes mirrored in** `src/lib/docx-generator.ts`

### Step 3.3 — Signature block rendering
**File:** `src/components/pdf/NavalLetterPDF.tsx` (lines 1447-1457)
- For DLA types, render `formData.signerFullName` (already ALL CAPS full name, e.g., "JOHN M. HANCOCK") instead of `formData.sig.toUpperCase()` (initials + last name, e.g., "J. K. JANICKI")
- Add conditional:
  ```
  {isDLAType ? formData.signerFullName : formData.sig?.toUpperCase()}
  ```
- **Same changes in** `src/lib/docx-generator.ts` (lines 1361-1392)

### Step 3.4 — Date format enforcement
- DLA types always use civilian date format (`March 21, 2011`)
- Add `isDLAType` to the `isCivilianStyle` conditional at ~line 588:
  ```
  const isCivilianStyle = isBusinessLetter || isExecLetter || isDLAType;
  ```
- This reuses the existing `formatBusinessDate()` function — no new date logic needed

---

## Phase 4: Validation & Proofreading

### Step 4.1 — Proofread checks for DLA
**File:** `src/lib/proofread-checks.ts`
- Add `const isDLAType = docType.startsWith('dla-');` near the top of `runProofreadChecks()`
- Adjust existing checks:
  - **Letterhead check (b.1):** Pass if `headerType === 'DLA'` and letterhead is configured
  - **SSIC check:** Skip for DLA types (DLA does not use SSIC/originator codes)
  - **Signature check:** Validate `signerFullName` (full name) instead of `sig` (initials) for DLA
  - **Subject check:** Works the same — ALL CAPS subject (no change needed)
  - **Date check:** Validate civilian format only for DLA types
  - **Via/endorsement checks:** Skip for DLA; add THROUGH presence validation instead

### Step 4.2 — Validation utilities
**File:** `src/lib/validation-utils.ts`
- Add `validateDLASignerName()` — ensures full name format (e.g., "JOHN M. HANCOCK"), not just initials
- Add `validateCivilianDate()` — ensures date matches "Month DD, YYYY" pattern
- Reuse existing validators for subject line (ALL CAPS), paragraph structure, references, enclosures

---

## Phase 5: Templates & Test Files

### Step 5.1 — NLDP template files (loadable starting-point documents)
**New files:**
- `public/templates/global/dla-standard-memorandum.nldp`
- `public/templates/global/dla-business-letter.nldp`

### Step 5.2 — Tests
**New file:** `tests/dla-correspondence.test.ts`
- Schema validation tests for DLA memorandum and business letter
- Signature block format tests (full name vs initials)
- Date format enforcement (civilian only)
- MEMORANDUM FOR / SUBJECT / THROUGH field presence
- Template default data completeness

**Updated file:** `tests/document-types.test.ts`
- Add `'dla-memorandum'` and `'dla-business-letter'` to any tests that iterate over all document types

---

## Phase 6: Verification & Cleanup

### Step 6.1 — Automated regression
- `npx vitest` — all existing + new tests pass
- `npm run build` — no TypeScript errors
- `npm run lint` — no new lint issues

### Step 6.2 — Manual verification checklist
- [ ] Create a DLA Standard Memorandum → verify PDF:
  - "DEFENSE LOGISTICS AGENCY" letterhead with DoD seal
  - `MEMORANDUM FOR:` addressee line (no `From:` line)
  - `SUBJECT:` line (not `Subj:`)
  - `THROUGH:` routing (no endorsement chain)
  - Civilian date format throughout (e.g., "March 21, 2011")
  - Full name signature in ALL CAPS (e.g., "JOHN M. HANCOCK")
- [ ] Create a DLA Business Letter → verify PDF:
  - DLA letterhead
  - Civilian date, full name signature
  - Salutation and complimentary close
- [ ] Create a Navy Standard Letter → verify **unchanged** output
- [ ] Create a USMC Basic Letter → verify **unchanged** output
- [ ] Switch headerType between USMC/DON/DLA in Settings → verify correct letterhead and seal

---

## File Change Summary

| File | Change Type | Phase |
|------|-------------|-------|
| `src/hooks/useUserProfile.ts` | Modify type union | 1 |
| `src/lib/pdf-seal.ts` | Extend function signature, add DLA branch | 1 |
| `src/lib/schemas.ts` | Add 2 DLA schema definitions + features + register | 1 |
| `src/lib/templates/dla-memorandum.ts` | **New file** | 1 |
| `src/lib/templates/dla-business-letter.ts` | **New file** | 1 |
| `src/lib/templates/index.ts` | Import + register DLA templates | 1 |
| `src/components/SettingsDialog.tsx` | Add DLA select option | 2 |
| `src/components/document/HeaderSettingsSection.tsx` | Add DLA select option | 2 |
| `src/components/layout/Sidebar.tsx` | Add DLA accordion group | 2 |
| `src/components/pdf/NavalLetterPDF.tsx` | Add DLA letterhead, header block, signature, date branches | 3 |
| `src/lib/docx-generator.ts` | Mirror DLA rendering branches from NavalLetterPDF | 3 |
| `src/lib/proofread-checks.ts` | Add DLA-aware check logic | 4 |
| `src/lib/validation-utils.ts` | Add DLA-specific validators | 4 |
| `public/templates/global/dla-standard-memorandum.nldp` | **New file** | 5 |
| `public/templates/global/dla-business-letter.nldp` | **New file** | 5 |
| `tests/dla-correspondence.test.ts` | **New file** | 5 |
| `tests/document-types.test.ts` | Add DLA types to iteration tests | 5 |

**New files: 5** | **Modified files: 12** | **Total: 17 files**

---

## Key Differences Summary (DLA vs Navy/USMC)

| Feature | Navy/USMC (Current) | DLA (New) |
|---------|---------------------|-----------|
| Primary format | Standard Letter (From/To/Via/Subj) | Standard Memorandum (MEMORANDUM FOR/SUBJECT) |
| Header block | From: / To: / Subj: + Sender's Symbol | MEMORANDUM FOR: / SUBJECT: (no From line) |
| Routing | Via: with mandatory endorsements | THROUGH: without endorsements |
| Date format | 3 styles (abbreviated, standard, civilian) | Civilian only (March 21, 2011) |
| Signature | Initials + Last Name (J. K. JANICKI) | Full name ALL CAPS (JOHN M. HANCOCK) |
| Letterhead | UNITED STATES MARINE CORPS / DEPARTMENT OF THE NAVY | DEFENSE LOGISTICS AGENCY |
| Seal | DoD seal (USMC) or Navy seal (DON) | DoD seal |
| SSIC/Originator Code | Required | Not used |
