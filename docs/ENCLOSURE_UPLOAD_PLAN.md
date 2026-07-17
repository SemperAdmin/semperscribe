# Enclosure Upload - Bind, Persist, Merge (Plan)

Status: SHIPPED 2026-07-16 (see Section 14 for the record and deviations).
Date: 2026-07-16. Author: Claude, for Stephen (SemperScribe PoC).

---

## 1. The finding that reframes the request

This feature already ships. It landed earlier in this project as P3.6.
The existing pieces, all verified in the tree today:

- `src/lib/enclosure-attachments.ts` - `EnclosureAttachment = { id, fileName, title, bytes }`, `fileToAttachment` (PDF-only, rejects on magic bytes), `mergeAttachmentsIntoPdf`, `moveAttachment`.
- `src/components/letter/AttachedEnclosures.tsx` - a second, separate list under the enclosures card: attach, reorder, remove, cover-page toggle.
- `src/hooks/useDocumentExport.ts` - merges the attached PDFs behind the letter on PDF export only.

So the work is repair and extension, not a green field. Three defects and one boundary gap drive the plan.

### Defect 1 - silent mis-numbering (the core bug)

Typed enclosure lines and uploaded files are two independent lists with no link. The merge guesses the link at `useDocumentExport.ts:82`:

```
startingNumber = startingEnclosureNumber + max(0, typedCount - attachments.length)
```

The guess assumes every uploaded file maps to the LAST N typed lines, in upload order. Break the assumption and the number is wrong with no warning:

- Type 3 enclosures, upload a file for enclosure (1). The merge labels it "Enclosure (3)" and appends it last.
- The panel badge shows the same wrong number, so the UI confirms its own error.

### Defect 2 - unmarked cover page inside a marked package

`mergeAttachmentsIntoPdf` draws a cover page with the enclosure number and title and NO classification banner. With the marking engine active, the app generates an unmarked page inside an otherwise-marked document. The toggle also defaults ON, adding separator sheets to packages with no such requirement.

### Defect 3 - files evaporate on reload

Attachments live in a session-only `useState` (`page.tsx:173`). A reload, a crash, or an R3 autosave recovery keeps the typed lines and loses the files. The user re-attaches before every export.

### Boundary gap - file types

`fileToAttachment` rejects everything except PDF. Scanned certificates and phone photos (JPG, PNG) are the common real case and are refused.

---

## 2. Target behavior (approved rulings)

Four decisions, recorded from the 16 Jul question set:

1. BINDING - bind the file to the enclosure line. One list. Each enclosure row holds an optional file. Merge order equals list order. Reorder a row and its file moves with it. Removes the guess and the parallel move buttons.
2. PERSISTENCE - persist files to IndexedDB. Files bind to the saved document and re-hydrate on reopen. Share links never carry files (a multi-megabyte PDF will not fit a URL fragment). DB goes v2 to v3.
3. FILE TYPES - PDF plus JPG and PNG. pdf-lib embeds images with no new dependency. DOCX uploads are refused with a "save as PDF first" message.
4. COVER PAGES - keep the generated cover page, default it OFF, and stamp it with classification markings when the engine is active. A SECNAV M-5216.5 check on separator-sheet requirements is a build-time task before this ships (see Section 11).

---

## 3. Data model

### 3.1 Design constraint that shapes everything

`enclosures: string[]` is a field of `FormData` and `SavedLetter` (`types/index.ts:68`). It flows to every renderer (PDF, DOCX, I-Type), every validator, the share-link encoder (`url-state.ts:31`), and package assembly. Widening the base type touches all of them and multiplies risk.

The plan keeps `enclosures: string[]` as the wire type. Renderers see no change. Binding lives beside it, and a derived value feeds the old readers.

### 3.2 The row model (page-level state)

Replace the two parallel arrays with one internal row model held in `page.tsx`:

```ts
interface EnclosureRow {
  key: string;        // stable id, survives reorder and delete
  title: string;      // the enclosure line text
  fileId?: string;    // points at a stored file, or undefined for a physical enclosure
}
```

Derived for the existing readers, so nothing downstream changes shape:

```ts
const enclosures: string[] = rows.map(r => r.title);
```

The old readers keep receiving `string[]`. The file binding rides `fileId`.

### 3.3 The file record (new IndexedDB store)

Files are binary and large. Storing them inside the `SavedLetter` record bloats every `libLoadAll()` (the library list would pull all bytes into memory). Give them their own store:

```ts
interface StoredEnclosureFile {
  fileId: string;       // primary key
  docId: string;        // owning document id, for cascade delete
  fileName: string;
  title: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  bytes: ArrayBuffer;
  byteLength: number;   // for the quota display without decoding
}
```

`SavedLetter` gains one optional field only:

```ts
enclosureBindings?: { key: string; title: string; fileId?: string }[];
```

Old saved documents have no bindings. They hydrate to zero files and behave exactly as before. The migration is additive.

---

## 4. Persistence (IndexedDB v2 to v3)

In `document-library.ts`:

- Bump `DB_VERSION` to 3.
- In `onupgradeneeded`, add store `enclosureFiles` keyed by `fileId`, with an index on `docId` for cascade delete. Keep the existing `documents` and `settings` stores untouched.
- Add `fileLoadForDoc(docId)`, `filePut(record)`, `fileDeleteForDoc(docId)`.
- On document delete (`libDelete`), delete its files by the `docId` index in the same logical operation, so no orphan bytes survive a document.

Write-through timing (recommended default, see Section 12 open item): a file persists the moment the user attaches it, keyed to the current working document id, not deferred to an explicit Save. The reason: the ruling was "survive a reload." A crash before Save is exactly the case the ruling targets. R3 autosave already tracks a working copy id to bind against. Session-to-saved re-parenting updates `docId` on the file records at Save.

---

## 5. Merge engine (`enclosure-attachments.ts`)

### 5.1 Correct numbering (kills Defect 1)

The number comes from the row position, not a guess. Walk the typed enclosure rows in order. Each row consumes one number, starting at `startingEnclosureNumber`. A row with a `fileId` contributes its file to the merge at that number. A row without a file consumes its number and contributes nothing (a physical enclosure mailed separately). Merge order equals row order. No arithmetic guess remains.

```
number(rowIndex) = startingEnclosureNumber + rowIndex
merge sequence   = rows.filter(r => r.fileId).map(r => r.file), in row order
```

### 5.2 Image embedding (adds JPG, PNG)

- PDF sources: unchanged. `copyPages` then append.
- Image sources: `embedJpg` or `embedPng` (both native to pdf-lib), add a Letter page (612 x 792), scale the image to fit inside a one-inch margin box preserving aspect ratio, center it.
- `fileToAttachment` widens its accept check to the three magic-byte signatures. DOCX and anything else are refused with the "save as PDF first" message.

### 5.3 Marked cover page (kills Defect 2)

- Default the toggle OFF.
- When cover pages are on AND the classification engine is active, draw the banner at top and bottom of the generated cover page using the existing `classification.ts` banner and `cuiBlockLines` helpers. The generated page carries the same marking as the letter it sits inside.
- When the engine is off, the cover page renders as today (heading plus title), minus the default-on behavior.

---

## 6. UI (`AttachedEnclosures.tsx` folds into `EnclosuresSection.tsx`)

One list replaces two. Each enclosure row renders:

```
[ (n) ] [ title input .......................... ] [ Attach / Replace ] [ up ] [ down ] [ remove ]
```

- Attach opens the file picker (accept `.pdf,.jpg,.jpeg,.png`). A bound row shows the file name, size, and a Replace and a Clear-file action.
- Reorder moves the whole row, title and file together. The separate `moveAttachment` path retires.
- The cover-page toggle stays, relabeled to state it applies to bound files and defaults off.
- The panel note updates: files persist with the saved document, and files are excluded from DOCX, .nldp, and share links.

Endorsement starting-number logic already exists in `EnclosuresSection` and feeds `startingEnclosureNumber`. The row model reads from it unchanged.

---

## 7. Boundaries (stated so no one is surprised)

- SHARE LINKS - carry titles only, never files. `MAX_URL_LENGTH` is 8000 characters. A file will not fit and will not be attempted. Existing behavior, made explicit in the panel note.
- DOCX EXPORT - continues to exclude merged files. The enclosure LINES (titles) render in DOCX as today. PDF and image merge into DOCX is a recorded future item, not this scope.
- .nldp - carries titles and bindings metadata, not file bytes. A document moved by .nldp arrives with its enclosure list intact and its files left in the source browser, same posture as a share link. The panel note says so.
- CUI - unchanged. The app does not handle CUI. The user owns not entering it. The marked cover page reflects the user-selected level, nothing more.

---

## 8. Validation (new advisory checks)

- A bound file whose row has an empty title - warn. An enclosure needs a name.
- A row number exceeding the typed enclosure list length - not reachable under the row model (numbers derive from position), so the old failure mode disappears by construction.
- Total merged page count against the SECNAV 5-page text cap - already gated in `useDocumentExport` for SECNAV types. Merged enclosure pages sit after the letter body and do not count against the text cap. Confirm the gate measures body pages, not the merged total, during the build.
- Quota exhaustion on attach or save - report the failure with the file name and the size, never silent-drop. Mirrors the P1.2 no-silent-eviction rule.

---

## 9. Blast radius (files touched)

Corrected from the earlier framing. The renderer count is ZERO because the wire type holds.

WRITE (behavior change):
- `src/lib/enclosure-attachments.ts` - image embedding, marked cover page, position-based numbering, wider file accept.
- `src/lib/document-library.ts` - DB v3, `enclosureFiles` store, file CRUD, cascade delete.
- `src/components/letter/EnclosuresSection.tsx` - single bound list UI.
- `src/app/page.tsx` - row-model state, derived `enclosures`, save and load hydration, clear-form reset.
- `src/hooks/useDocumentExport.ts` - drop the guess, pass rows to the merge.
- `src/types/index.ts` - add optional `enclosureBindings` to `SavedLetter`.

DELETE:
- `src/components/letter/AttachedEnclosures.tsx` - folded into `EnclosuresSection`. (Deletion runs on Windows, the sandbox mount blocks `rm`.)

UNCHANGED (proof the wire type held):
- All PDF, DOCX, I-Type renderers. All validators. `url-state.ts`. `package-assembly.ts`. They read `enclosures: string[]` and never learn a file exists.

---

## 10. Build order (phased, one reviewable step each)

1. STORE - `document-library.ts` v3 plus file CRUD and cascade delete. Unit test the round-trip with fake-indexeddb. No UI yet.
2. ENGINE - `enclosure-attachments.ts` position-based numbering, image embedding, marked cover page. Node harness with pdf-lib measures page count and checks the banner text. This is the defect-killing step.
3. MODEL - `page.tsx` row state and derived `enclosures`. Renderers stay untouched. Verify the live preview and both exports still match pre-change output for a file-free document (regression guard).
4. UI - fold `AttachedEnclosures` into `EnclosuresSection`, single bound list, replace and clear actions.
5. PERSIST - write-through on attach, hydrate on load, re-parent on save, reset on clear.
6. BOUNDARIES and COPY - panel notes, DOCX and .nldp and share-link exclusions confirmed, quota reporting.

Each step lands behind the workflow rule: no step ships without your go, and any step below 95 percent confidence pauses for a question.

---

## 11. Risks

- SECNAV separator-sheet rule - I have not verified M-5216.5 on whether generated cover sheets are permitted or required. Step 2 pauses for that check before the cover-page code is trusted. Default-off is the safe posture until confirmed.
- IndexedDB quota - large scanned PDFs fill the origin quota. The size cap value is an open item (Section 12). Quota errors surface to the user, never swallowed.
- Write-through re-parenting - a file attached before the first Save binds to a working id. Save must re-point `docId` atomically or a file orphans. Covered by the cascade-delete index and a Save-path test.
- Preview cost - the live preview does not merge files (merge is export-only). State this in the UI so a user does not expect the preview to show enclosures.

---

## 12. Open sub-decisions (need a ruling before or during build)

1. Write-through vs Save-time persist. Recommended: write-through, so a crash before Save keeps the files. The alternative loses files on a pre-Save crash, which contradicts the persistence ruling.
2. Per-file size cap. Recommended: 25 MB per file, with a total-package soft warning at 100 MB. Values are a guess pending your operational norm for enclosure sizes.
3. Preview shows enclosures. Recommended: no. Merge stays export-only for speed. A "merges on export" note sits under the list.

---

## 13. Verification plan

- Unit - fake-indexeddb round-trip for the file store and cascade delete. Position-numbering math. Image-embed page count.
- Node harness - render a letter, merge a mixed PDF-plus-PNG set, measure that enclosure (n) lands at the right page and the marked cover carries the banner text.
- Regression - a file-free document produces byte-comparable exports before and after the model change.
- Authority - your `npm run build` (the real type-check) and a manual export on Windows. The sandbox mount cannot run a full project type-check reliably, so your build is the verdict.

---

## 14. SHIPPED record (2026-07-16)

### Doctrine ruling that changed the design mid-build

The Section 11 SECNAV check ran before the engine was built and REVERSED the
cover-page framing. M-5216.5 requires "Enclosure (N)" marked in the LOWER RIGHT
CORNER of the enclosure's FIRST PAGE; a separate sheet carrying the marking is
the sanctioned fallback for items impractical to mark. Stephen's ruling
(2026-07-16): stamp the first page by default; cover sheet optional (default
OFF), and when the cover is on it CARRIES the mark and the stamp is omitted -
substitution per the manual, never duplication. Generated cover pages take the
classification banner (top and bottom) when the marking engine is active;
uploaded pages are never overprinted with classification markings.

### What shipped, by plan step

1. STORE - document-library.ts DB v3: `enclosureFiles` store (keyPath fileId,
   docId index), StoredEnclosureFile, filePut/fileGet/fileDelete/
   fileDeleteForDoc/fileDeleteIfOwnedBy/fileLoadForDoc/fileReparent/
   fileReparentByIds, cascade delete inside libDelete's own transaction,
   libClear clears files, WORKING_COPY_DOC_ID, 25MB cap constant.
2. ENGINE - enclosure-attachments.ts rewritten: EnclosureRow, computeMergeItems
   (position IS the number - the guess is dead), first-page stamp at the
   doctrinal position (lower right, right-aligned to the 1in margin, baseline
   0.5in), JPG/PNG embedding (letter page, 1in margin box, no upscale),
   magic-byte accept for pdf/jpg/png with save-as-PDF-first refusal, 25MB cap
   at attach, cover mode with banner, parse failures name their enclosure.
   reconcileRows + newRow adapt legacy string[] writers onto the row model.
3. MODEL - page.tsx: enclosureRows + enclosureFiles map are the source of
   truth; `enclosures` derives via useMemo; `setEnclosures` reconciles titles
   onto rows so undo/find-replace/import/recovery keep their contract.
   SavedLetter gains optional enclosureBindings. useDocumentExport takes
   rows+files, computes items, passes the classification banner.
4. UI - EnclosuresSection: single bound list. Per-row Attach/Replace button,
   file chip (name, KB, remove-file), reorder moves title AND file, "No" radio
   clears bindings, cover-sheet toggle relabeled and default OFF, boundary
   note (persists in browser; not in DOCX, .nldp, share links). A file dropped
   on an empty-titled row names the row after itself.
5. PERSIST - write-through filePut on bind (owner WORKING_COPY_DOC_ID, quota
   failure surfaces via toast and keeps the session binding); Save re-parents
   bound files to the saved id (ownership follows the latest save); load-draft
   and crash-recovery hydrate rows + files by fileId with missing-file
   stripping and a destructive toast; unbind deletes bytes only when the
   working copy owns them; clear-form/discard-recovery purge working-copy
   files. WorkingCopy + useAutosave carry enclosureBindings.
6. BOUNDARIES - share links and .nldp carry titles only (unchanged wire type);
   DOCX excludes merged files; panel copy states all three.

### Verification record (sandbox, honest scope)

- ENC-1 node harness (fake-indexeddb): 14/14 - schema, v2->v3 upgrade keeps
  documents, CRUD, cascade, reparent.
- ENC-2 node harness (pdf-lib + pdftotext): 13/13 - numbering (bound, unbound,
  continuation, ghost), page counts both modes, magic bytes, cap, corrupt-file
  naming. Text-position proof: "Enclosure (1)" on merged p2 only, "(2)" on p4
  only; stamp bbox right-aligned at x=540/baseline 36; cover mode puts CUI x2 +
  mark on covers, file pages unmarked and unstamped.
- esbuild bundle of the full page.tsx graph: exit 0 (imports/exports/syntax).
- Scoped tsc exit 0: enclosure-attachments, document-library, autosave,
  useAutosave, useImportExport. useDocumentExport and the two components
  exceed the degraded mount's I/O (Radix/react-pdf type graphs time out) -
  their prop boundaries were hand-cross-checked, and `npm run build` on
  Windows is the type authority, as always.
- New vitest files (run on Windows): tests/document-library-files.test.ts,
  tests/enclosure-attachments.test.ts. fake-indexeddb@6.2.5 added to
  devDependencies (package extracted in node_modules; run `npm install` once
  to settle package-lock.json).

### Known limits (recorded, not hidden)

- Undo/redo snapshots titles only: undoing a bound-row deletion restores the
  title, not the binding. Extending the undo history to rows is a follow-up.
- Sibling saves of one session share file bytes; ownership follows the latest
  save. Deleting the owning document strands earlier siblings' bindings -
  hydration then reports the missing file and strips the binding, visibly.
- ~~Live preview never merges files (export-only), matching the panel copy.~~
  REVERSED 2026-07-16 (post-deploy ruling): the preview merges bound files -
  full-package WYSIWYG. Wired through useLivePreview (same order as export:
  signature fields, then merge), attach/remove/reorder trigger the debounced
  refresh. Same ruling moved the stamp from first-page-only to EVERY page of
  each enclosure (permitted by M-5216.5), verified per-page via pdftotext.
  Signature field placement still renders the letter alone by design - fields
  land on letter pages, and the merge happens after field application in both
  preview and export, so indices stay letter-relative.
- Rotated source-PDF pages: the stamp uses unrotated coordinates; a rotated
  first page gets the stamp in a rotated position. Edge case, unhandled.
- AttachedEnclosures.tsx is orphaned (zero importers) and awaits Windows
  deletion; it still compiles, so the build does not break on it.
