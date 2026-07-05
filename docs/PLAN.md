# Refactoring Plan: Config-Driven Document Architecture

## Goal
Refactor SemperScribe so that adding a new document type requires **one definition file** and **zero edits** to existing rendering/export code. Transform `page.tsx` from ~1600 lines of conditional spaghetti into a ~200-line orchestrator.

---

## Current Problems

1. **30+ conditionals** in `page.tsx` checking `formData.documentType`
2. **4x duplicated** 3-way PDF dispatch (aa-form vs page11 vs standard) across preview, export, signature prep, and signature confirm
3. **Hooks exist but are unused** — `useDocumentExport`, `useParagraphs`, `useImportExport`, `useVoiceInput` are defined in `/src/hooks/` but `page.tsx` duplicates their logic inline
4. **Zustand store exists** (`/src/store/formStore.ts`) but only holds NAVMC 10274 data — main form state lives as 15+ `useState` calls in `page.tsx`

---

## Phase 1: Add `DocumentFeatures` to the Registry (Additive, Zero Risk)

**Files:** `src/lib/schemas.ts`

Add a `features` property to `DocumentTypeDefinition` that encodes what each document type needs:

```ts
interface DocumentFeatures {
  // Section visibility
  showHeaderSettings: boolean;    // Header Type, Body Font, Header Color
  showUnitInfo: boolean;          // Unit Info / Letterhead
  showEndorsementDetails: boolean;// Endorsement-specific fields
  showDirectiveTitle: boolean;    // MCO/Bulletin directive title input
  showVia: boolean;               // Via Section
  showReferences: boolean;        // References Section
  showEnclosures: boolean;        // Enclosures Section
  showDistribution: boolean;      // Distribution Statement & Distribution Section
  showReports: boolean;           // Reports Section
  showParagraphs: boolean;        // Paragraph Section
  showClosingBlock: boolean;      // Closing Block Section
  showMOAForm: boolean;           // MOA/MOU Form Section
  showSignature: boolean;         // Digital Signature section

  // Behavior
  isAMHS: boolean;                // Exclusive AMHS editor view
  isDirective: boolean;           // Auto-set "To" = "Distribution List"
  paragraphTemplate?: string;     // 'mco' | 'bulletin' | 'moa' | 'default'
  category: string;               // Sidebar group: 'standard-letter' | 'memorandums' | 'staffing-papers' | etc.

  // Export capabilities
  exportFormats: ('pdf' | 'docx' | 'amhs-text')[];
  pdfPipeline: 'standard' | 'navmc10274' | 'navmc11811' | 'amhs';
}
```

**Feature matrix for all 20 types** (derived from the conditional catalog):

| Feature | basic | multiple-address | endorsement | aa-form | mco | bulletin | change-transmittal | page11 | mfr | from-to-memo | letterhead-memo | amhs | moa | mou | info-paper | position-paper | decision-paper | coordination-page | business-letter | exec-correspondence |
|---------|-------|-----------------|-------------|---------|-----|----------|-------------------|--------|-----|-------------|----------------|------|-----|-----|-----------|---------------|---------------|------------------|----------------|-------------------|
| showHeaderSettings | Y | Y | Y | N | Y | Y | Y | N | Y | N | Y | N | N | N | Y | Y | Y | Y | Y | Y |
| showUnitInfo | Y | Y | Y | Y | Y | Y | Y | N | N | N | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| showEndorsementDetails | N | N | Y | N | N | N | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| showDirectiveTitle | N | N | N | N | Y | Y | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| showVia | Y | Y | Y | Y | Y | Y | Y | N | Y | Y | Y | N | N | N | Y | Y | Y | N | Y | Y |
| showReferences | Y | Y | Y | Y | Y | Y | Y | N | Y | Y | Y | N | N | N | Y | Y | Y | N | Y | Y |
| showEnclosures | Y | Y | Y | Y | Y | Y | Y | N | Y | Y | Y | N | N | N | Y | Y | Y | N | Y | Y |
| showDistribution | N | N | N | N | Y | Y | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| showReports | N | N | N | N | Y | Y | N | N | N | N | N | N | N | N | N | N | N | N | N | N |
| showParagraphs | Y | Y | Y | Y | Y | Y | Y | N | Y | Y | Y | N | Y | Y | Y | Y | Y | N | Y | Y |
| showClosingBlock | Y | Y | Y | Y | Y | Y | Y | N | Y | Y | Y | N | N | N | Y | Y | Y | N | Y | Y |
| showMOAForm | N | N | N | N | N | N | N | N | N | N | N | N | Y | Y | N | N | N | N | N | N |
| showSignature | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | N | N | N | Y | Y | Y | N | Y | Y |
| isAMHS | N | N | N | N | N | N | N | N | N | N | N | Y | N | N | N | N | N | N | N | N |
| isDirective | N | N | N | N | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N | N | N |
| pdfPipeline | std | std | std | navmc10274 | std | std | std | navmc11811 | std | std | std | amhs | std | std | std | std | std | std | std | std |
| category | standard-letter | standard-letter | standard-letter | forms | directives | directives | directives | forms | memorandums | memorandums | memorandums | amhs | memorandums | memorandums | staffing-papers | staffing-papers | staffing-papers | staffing-papers | external-executive | external-executive |

**Tests:** Add tests verifying every document type has a valid `features` object with all required keys.

---

## Phase 2: Create `DocumentLayout` Component (Replace Conditionals)

**New file:** `src/components/document/DocumentLayout.tsx`

A single component that reads `features` and renders the appropriate sections:

```tsx
function DocumentLayout({ features, formData, ... }) {
  return (
    <>
      {features.isAMHS ? (
        <AMHSEditor ... />
      ) : (
        <>
          {features.showHeaderSettings && <HeaderSettings ... />}
          {features.showUnitInfo && <UnitInfoSection ... />}
          {features.showMOAForm && <MOAFormSection ... />}
          {features.showEndorsementDetails && <EndorsementDetails ... />}
          <DynamicForm ... />
          {features.showDirectiveTitle && <DirectiveTitleInput ... />}
          {features.showVia && <ViaSection ... />}
          {features.showReferences && <ReferencesSection ... />}
          {features.showEnclosures && <EnclosuresSection ... />}
          {features.showDistribution && <>
            <DistributionStatementSection ... />
            <ReportsSection ... />
          </>}
          {features.showParagraphs && <ParagraphSection ... />}
          {features.showClosingBlock && <ClosingBlockSection ... />}
          {features.showDistribution && <DistributionSection ... />}
          {features.showSignature && <SignatureSection ... />}
        </>
      )}
    </>
  );
}
```

**Key difference from current code:** The conditionals check `features.showX` (config-driven) instead of `formData.documentType !== 'x' && formData.documentType !== 'y'` (hardcoded exclusions).

**Steps:**
1. Extract the `HeaderSettings` inline JSX (lines 1254-1307 of page.tsx) into its own component
2. Extract the `EndorsementDetails` card (lines 1326-1454) into its own component
3. Extract the `DirectiveTitleInput` card (lines 1467-1492) into its own component
4. Extract the `SignatureSection` card (lines 1567-1599) into its own component
5. Create `DocumentLayout` that composes all sections based on `features`
6. Replace the entire render body in `page.tsx` with `<DocumentLayout />`

**Tests:** Snapshot/render tests confirming each document type renders the correct sections.

---

## Phase 3: Wire Up Existing Hooks (Eliminate Duplicate Logic)

**Problem:** `page.tsx` duplicates logic already in extracted hooks. Wire them up instead.

**Hooks to integrate:**

| Hook | What it replaces in page.tsx | Lines saved |
|------|----------------------------|-------------|
| `useParagraphs` | `addParagraph`, `removeParagraph`, `updateParagraphContent`, `moveParagraphUp/Down`, `getUiCitation`, `validateParagraphNumbering` | ~130 lines |
| `useDocumentExport` | `downloadPDF`, `generateDocument`, `handleOpenSignaturePlacement`, `handleSignatureConfirm`, `handleSignatureCancel`, `handleUpdatePreview` | ~250 lines |
| `useImportExport` | `handleImport`, `handleLoadDraft`, `handleLoadTemplateUrl`, `handleExportNldp`, `handleShareLink`, `handleCopyAMHS`, `handleExportAMHS` | ~200 lines |
| `useVoiceInput` | `initializeVoiceRecognition`, `toggleVoiceInput`, voice state | ~50 lines |

**Steps:**
1. Audit each hook to confirm API compatibility with page.tsx usage
2. Replace inline implementations with hook calls one at a time
3. Remove the dead inline code after each replacement
4. Run tests after each replacement

**Expected result:** `page.tsx` drops from ~1600 to ~600 lines.

---

## Phase 4: Expand Zustand Store for All Form State

**File:** `src/store/documentStore.ts` (rename/replace `formStore.ts`)

Move the 15+ `useState` calls from page.tsx into a single Zustand store:

```ts
interface DocumentStore {
  // Form state
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  validation: ValidationState;
  formKey: number;

  // Actions
  setFormData: (updater: (prev: FormData) => FormData) => void;
  changeDocumentType: (newType: string) => void;
  setParagraphs: (paragraphs: ParagraphData[]) => void;
  // ... etc
}
```

**Benefits:**
- Any component can read/write form state without prop drilling
- `DocumentLayout` sections access state directly instead of receiving 10+ props
- `page.tsx` becomes a thin shell: initialize store, render shell + layout

**Steps:**
1. Create `documentStore.ts` with all state from page.tsx
2. Move `handleDocumentTypeChange` logic into a store action (`changeDocumentType`)
3. Update components to use `useDocumentStore()` instead of props
4. Reduce page.tsx to ~150-200 lines (mount + ModernAppShell + DocumentLayout)

---

## Phase 5: Config-Driven Export Service

**New file:** `src/services/export/documentExporter.ts`

Replace the 4x duplicated 3-way PDF dispatch with a registry-based approach:

```ts
const PDF_PIPELINES = {
  standard: async (formData, ...) => generateBasePDFBlob(...),
  navmc10274: async (formData, ...) => {
    const bytes = await generateNavmc10274(mapToNavmc10274(formData));
    return new Blob([bytes], { type: 'application/pdf' });
  },
  navmc11811: async (formData, ...) => {
    const bytes = await generateNavmc11811(mapToNavmc11811(formData));
    return new Blob([bytes], { type: 'application/pdf' });
  },
};

export async function generatePdfForDocType(docType: string, formData: FormData, ...) {
  const features = DOCUMENT_TYPES[docType].features;
  const pipeline = PDF_PIPELINES[features.pdfPipeline];
  return pipeline(formData, ...);
}
```

This eliminates the duplicated conditional dispatch in:
- `handleUpdatePreview()` (line 282)
- `generateDocument()` (line 836)
- `handleOpenSignaturePlacement()` (line 703)
- `handleSignatureConfirm()` (line 755)

---

## Phase 6: Data-Driven Sidebar

**File:** `src/components/layout/Sidebar.tsx`

Replace the hardcoded accordion groups with groups derived from `DOCUMENT_TYPES`:

```tsx
const groups = Object.values(DOCUMENT_TYPES).reduce((acc, def) => {
  const cat = def.features.category;
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(def);
  return acc;
}, {});
```

Add a `sidebarConfig` to define group labels and icons:
```ts
const SIDEBAR_GROUPS = {
  'standard-letter': { label: 'Standard Letter', icon: Mail },
  'memorandums': { label: 'Memorandums', icon: Notebook },
  // ...
};
```

---

## Phase 7: Split schemas.ts into Per-Type Files (Optional, Large Scale)

**Current:** `src/lib/schemas.ts` is 1800 lines with all 20 types.

**Target:**
```
src/lib/document-types/
  index.ts              # Re-exports DOCUMENT_TYPES registry
  types.ts              # Shared interfaces (DocumentTypeDefinition, DocumentFeatures, etc.)
  validators.ts         # Shared validators (ssicFieldRequired, ssicFieldDirective, etc.)
  basic.ts              # BasicLetterSchema + BasicLetterDefinition + features
  mco.ts                # MCOSchema + MCODefinition + features
  bulletin.ts           # ...
  ...
```

Each file exports one complete document type definition. The index file assembles the registry.

---

## Implementation Order

| Phase | Risk | Lines Changed | Effort | Prerequisite |
|-------|------|--------------|--------|-------------|
| 1. Add features config | None (additive) | +200 | Small | None |
| 2. DocumentLayout component | Low (extract + replace) | +300, -400 | Medium | Phase 1 |
| 3. Wire up existing hooks | Low (replace duplicates) | -630 | Medium | None (can parallel Phase 2) |
| 4. Zustand store expansion | Medium (state migration) | +200, -400 | Medium | Phases 2 & 3 |
| 5. Export service | Low (extract + replace) | +100, -300 | Small | Phase 1 |
| 6. Data-driven sidebar | Low (replace hardcoded) | +30, -60 | Small | Phase 1 |
| 7. Split schemas.ts | Low (file moves) | 0 net | Medium | Phase 1 |

**Each phase leaves the app fully functional with all tests passing.**

---

## Success Criteria

- `page.tsx` is under 200 lines
- Adding a new document type = one file with schema + definition + features
- All 640+ existing tests pass
- No conditional chains checking `formData.documentType` in rendering code
- 4x duplicated PDF dispatch reduced to 1 function
