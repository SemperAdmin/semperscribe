# SemperScribe UX Audit - five personas, static walkthrough plus live build

User-experience audit, 2026-09-05, against the built v0.4.8 export driven with Playwright. The screenshots and driver scripts it cites lived in the auditing session's scratch directory and are not retained; every finding also names a file and line. Findings feed docs/UX_POLICY_PLAN_2026-09.md.

Method: static read of `src/app/page.tsx`, `src/components/letter/**`, `src/components/layout/**`, `src/hooks/**`, plus a live Playwright drive of the built export in `out/` served at `http://127.0.0.1:4173/semperscribe/` (chromium at `/opt/pw-browsers/chromium`, the pattern `playwright.config.ts` uses). Screenshots are in `.../scratchpad/shots/`. Scripts are in `.../scratchpad/*.mjs`. The live check succeeded, with zero page errors and zero console errors on load and on export.

## Summary - the ten highest-value friction points

| # | Persona | What happens | Why it matters | Evidence | Fix | Size |
|---|---|---|---|---|---|---|
| 1 | 3, 1 | The letter body cannot be reached or edited by keyboard. The paragraph box is a plain `<div onClick>`; no `<textarea>` exists in the DOM until a mouse click lands on it. | Section 508 / WCAG 2.1.1 Level A blocker on the app's primary input. Not listed in SECTION_508_FINDINGS.md. | `src/components/letter/ParagraphItem.tsx:359-370`; live: 0 textareas before click, 1 after; only 24 tabbable elements in the editor and the body is not one (`scratchpad/kbd.mjs`, `scratchpad/focus.mjs`) | Always mount the textarea, or give the div `tabIndex=0`, `role="textbox"` and an Enter/Space handler. Add an aria-label naming the paragraph number. | S |
| 2 | 1, 3, 5 | The compliance banner never renders below 1280px viewport width, and the mobile preview sheet is never given the issues. A drafter on a laptop or phone gets no validation feedback at all. | Required SECNAV M-5216.5 header elements (SSIC, From, To, Subj) ship missing with nothing on screen saying so. | `src/components/layout/ModernAppShell.tsx:277` (`hidden xl:flex`); `PreviewModal` receives no `issues` prop, `ModernAppShell.tsx:323-332`; live: banner ABSENT at 1279, 1024, 768 and 390 px (`scratchpad/final.mjs`, `shots/25-1279-no-banner.png`, `shots/22-mobile-editor.png`) | Lift the banner out of `LivePreview` into the shell so it renders at every width, and pass `issues` into `PreviewModal`. | M |
| 3 | 3, 4 | Every validation message names a code artifact, not the rule. "SSIC fails its document schema", cited as "Basic Letter schema (src/lib/schemas.ts)". | The dialog header promises "Live checks against SECNAV M-5216.5, MCO 5215.1K". A new join learns nothing; a CO cannot verify the claim; a source path in a citation field destroys trust. | `src/lib/schema-validators.ts:96-99`; `shots/05-compliance-dialog.png` | Map each required field to its policy citation, and write the rule as the requirement ("SSIC is required on every naval letter", SECNAV M-5216.5 para 2-3). | S/M |
| 4 | 1, 3 | The spellchecker is a hand-typed allowlist. A normal 48-word request paragraph produced 6 flags: approval, third, eighty-two, sourced, organically, +1 more. All six are false positives, zero true positives. | Users learn to ignore the flag bar within a day, and then miss the acronym and terminology hits that carry policy weight (SECNAV first-use rule). | `src/hooks/useSpellCheck.ts:18-90` (COMMON_ENGLISH is a literal set); live measurement in `scratchpad/spell.mjs`; `shots/18-spellcheck.png`, `shots/16-filled-letter.png` ("2 flagged \| approval \| third") | Use the browser's native `spellcheck` for English and reserve the custom pass for military terms and acronym first-use. | M |
| 5 | 1 | 69 templates ship, but the picker hard-filters to the current document type with no visible filter and no way to clear it. From a Basic Letter the dialog reads "Standard Templates (1)". | The corporal drafting the same three letters weekly is the reason templates exist, and 68 of 69 are unreachable from any one document. | `src/hooks/useTemplates.ts:79-81`; `out/templates/global/index.json` has 69 entries; `shots/27-templates-editor.png` | Show all templates with a "matches this document type" chip the user can toggle, and label the active filter. | S |
| 6 | 1, 5 | The header save indicator is dead code. It always reads "Draft" - before typing, after typing a full letter, and after Save Draft. | The whole trust posture is "your work lives on this device". With no save state the SCIF user has no signal that anything persisted. | `src/components/layout/ModernAppShell.tsx:181-193` renders from `isDirty`/`lastSavedAt`; `src/app/page.tsx:867-905` passes neither; `grep -rn isDirty src/` returns only the three shell lines. Visible as "BASIC / Draft" in every screenshot. | Pass `isDirty` and `lastSavedAt` from `page.tsx`. Same defect class as R12. | S |
| 7 | 3 | First run is a scrollable catalogue of every warning the app can emit, presented as documentation, before the app is visible. No sample document, no example letter, no tour. | The brand-new join has never opened the correspondence manual. This is the moment to teach the format, and it teaches the warning system instead. | `src/components/DisclaimerModal.tsx:38-108`; `shots/01-first-load.png` | Short consent modal with a link to the full text, and a "Start from a filled example" card on the landing page. | M |
| 8 | 4, 5 | A blocked export raises a native `alert()`. | The one moment the tool stops a policy violation is delivered in an unstyled, uncopyable box that names no field and offers no navigation. | `src/hooks/useDocumentExport.ts:83` | Route it through the Compliance dialog with a jump-to-field action. | S |
| 9 | 4, 3 | The preview pane on a new document is a black and grey void under a red compliance strip. No empty state, no call to action. | The first thing a new user sees after picking a type is a blank rectangle plus a failure message. | `shots/04-editor-empty.png`; `src/components/layout/LivePreview.tsx:76` onward has no empty branch for "document type chosen, nothing typed" | "Fill the header and your letter appears here" with the six required fields listed. | S |
| 10 | 3 | The SSIC picker is not an ARIA combobox and cannot be operated by keyboard. Plain `<div>` list, buttons that fire only on `onPointerDown`. | SSIC is a required field on every naval letter, and the lookup is the only way a new join finds the right code. | `src/components/ui/DynamicForm.tsx:25-72`; live DOM dump shows `role: null` on the list container (`scratchpad/walk8.mjs`) | Add `role="combobox"`, `aria-expanded`, `role="listbox"`/`role="option"`, arrow-key navigation and Enter to select. | S |

## Per-persona findings

### 1. Admin corporal - speed and reuse

- Templates picker shows 1 of 69 with no filter indicator. `src/hooks/useTemplates.ts:79-81`, `shots/27-templates-editor.png`.
- No save-state feedback anywhere in the chrome. `src/app/page.tsx:867-905` never passes `isDirty`/`lastSavedAt`.
- The Document Library empty state is honest but has no action: "No saved documents yet. Use File, Save Draft." It does not offer to save the current document. `shots/09-library.png`, `src/components/DocumentLibraryDialog.tsx`.
- Every paragraph requires a mouse click to enter edit mode, so the fast path (Tab from Subject straight into the body) does not exist. `src/components/letter/ParagraphItem.tsx:359-370`.
- Ctrl+K palette exists and covers save, export, share, library, guide, settings and all 25 types (`src/components/CommandPalette.tsx`), but nothing on screen advertises it - no hint in the header, no footer key legend.
- The spell bar flags ordinary words on every paragraph, adding a dismissal step to each edit. Measured 6 false positives on 48 words.

### 2. S-1 chief - review and kick back

- Review mode works and has the best empty state in the app: "No comments yet. Add one below, or use the comment button on any paragraph." Verified live, `scratchpad/tpl.mjs`, `shots/28-review-mode.png`.
- But the entry point is a persistent card at the top of the drafter's own editor - "Reviewing someone else's draft? Start review" - and it is tab stop 0, ahead of the drafter's letter. Tab-order dump index 0, `scratchpad/walk4.mjs`.
- The Compliance Issues dialog is a dead end: it lists issues with citations but offers no way to jump to the offending field, and none of the five required-field issues carried a Fix button. `src/components/ComplianceDialog.tsx`, `shots/05-compliance-dialog.png`.
- Compare Revisions needs two library snapshots; nothing says so, and with an empty library the reviewer opens the dialog and finds nothing to pick.

### 3. Brand-new join - guidance and defaults

- Header field help text is genuinely strong and is the app's best guidance surface: SSIC ("4-5 digit number from SECNAV M-5210.2"), From ("Title of the signing authority, not the individual's name"), Subject ("Brief topic in ALL CAPS"). Six fields, six examples. `src/components/document/HeaderSettingsSection.tsx`, `shots/04b-editor-full.png`.
- The Correspondence Guide is excellent - when to use, when not to use, an example subject, and a chapter citation per type. Reachable only from Review > Correspondence Guide, three levels deep, and never surfaced at the moment of choosing a type. `src/components/GuidanceDialog.tsx`, `shots/13-guidance.png`.
- Against that, the error messages teach nothing ("fails its document schema") and cite a TypeScript file.
- Policy defaults are right and pre-filled: date set to today on first client render (`src/app/page.tsx:355-359`), Times New Roman, USMC Standard header, Via/References/Enclosures all default to No, directives auto-set To: "Distribution List" (`src/app/page.tsx:508`).
- No example or sample letter anywhere in the first-run path. `examples/` holds one `.nldp` that the UI never references.

### 4. XO/CO - final check and signature

- The signature ceremony section states its own limits clearly and correctly: "Copy the request link from the placement screen... The signer signs in Adobe Acrobat with their CAC and returns the signed file - the link carries the request, never the signature." `src/components/signature/SignatureCeremonyPanel.tsx`, visible in `shots/04b-editor-full.png`.
- R12 is fixed. Preview Print and Download both have handlers and were enabled in the live build once a preview existed. `src/components/layout/LivePreview.tsx:47-73`, tab-order dump indices 27 and 28.
- The yellow "Non-official Proof of Concept" banner is permanent and undismissible, and consumes 52px of a 900px desktop viewport and 185px (22%) of a 390x844 phone. A signing officer reads it as "do not sign anything this produced". `src/app/layout.tsx` banner, every screenshot.
- Blocked export arrives as a native `alert()`. `src/hooks/useDocumentExport.ts:83`.
- There is no positive compliance state. When the letter validates, the banner simply vanishes. Nothing ever says "clean, ready to sign". Compare `shots/04-editor-empty.png` (banner) with `shots/16-filled-letter.png` (no banner, no confirmation).

### 5. SCIF user - disconnected

- Offline works. With the context set offline and the page reloaded, the app shell, sidebar and editor all came back from the service worker. `scratchpad/gunny.mjs`, `shots/23-offline-reload.png`.
- Only three network call sites exist and two are same-origin template fetches (`src/hooks/useTemplates.ts:64-65`, `src/components/letter/Page11RemarksSection.tsx:60`). The third is the GunnyBot LLM client, `src/lib/gunnybot/client.ts:86`.
- GunnyBot has four entry points inside the primary editing surface - "GunnyBot rewrite" on every paragraph, "Draft a paragraph with GunnyBot", "Open GunnyBot assistant" in the header, "GunnyBot Review" in the Review menu - none of which a disconnected user can ever use. The no-key state is handled well (Generate disabled, "Add your API key in Settings, Assistant tab.", `shots/19b-gunnybot-nokey.png`), but nothing says the feature needs network egress at all.
- The one place the SCIF user must trust - "did my work save?" - is exactly the indicator that never renders (finding 6).
- Enclosure file loss is reported, not silent, which is correct: `src/app/page.tsx:174-181` toasts "Re-attach: ..." by name.

## First-run metrics

Measured live, `scratchpad/firstrun.mjs`.

- Clicks from cold load to a downloaded, validator-clean PDF: **7**. I Understand, Standard Naval Letter card, SSIC field, pick SSIC 1500, click the paragraph box to enter edit mode, Export menu, PDF Document.
- Fields typed: **7**. SSIC, Originator Code, From, To, Subject, Paragraph 1, Signature Name. Date was pre-filled to today.
- Result: `Letter 1500 - REQUEST FOR RANGE TIME.pdf`, compliance banner cleared, no console errors.

That is a good number. One of those seven clicks should not exist: click 5 exists only because the paragraph box will not accept focus.

What the user is never told:

1. That the paragraph box must be clicked before it will accept text.
2. That the compliance banner only exists above 1280px, so on a narrow window they are drafting blind.
3. That the Templates list is filtered to the current document type.
4. That Ctrl+K exists.
5. That "Save Draft" writes to this browser only, until they open Settings > Data.
6. That DOCX is the accessible export - stated only inside the Export menu after opening it (`shots/06-export-menu.png`), which is the right place but the only place.
7. That the letter is now compliant. Silence is the only success signal.

## Accessibility findings, with counts

Live, Basic Letter editor at 1440x900 unless stated.

- **Tabbable elements in the entire editor: 24.** The letter body is not among them. Keyboard-only drafting is impossible. (`scratchpad/focus.mjs`)
- **Visible focus indicators: 23 of 24 pass.** The only miss is the preview `<iframe>`, which is acceptable. The Radix ring is applied consistently. (`scratchpad/focus.mjs`)
- **Controls with no accessible name: 5 of 13 visible form controls.** Two inputs named by placeholder only (sidebar "Search...", "Search SSIC...") and three unnamed buttons. The paragraph `<textarea>`, once opened, also has no `aria-label`, `aria-labelledby` or associated label. (`scratchpad/walk3.mjs`, `scratchpad/kbd.mjs`)
- **Form section headings: 0 of 9 are heading elements.** Unit Information, Header Information, Via, References, Enclosures, Body Paragraphs, Closing Block, Distribution and Copy To are all non-heading elements. Only "Classification Markings" and "LIVE PREVIEW" are `h3`. A screen-reader user cannot navigate the form by heading. (`scratchpad/final.mjs`)
- **aria-live regions: 3** on desktop - the warning banner (polite), the compliance banner (`role="alert"`), and the preview status (polite, "Document preview updated"). Errors are announced correctly at >=1280px. **Below 1280px the `role="alert"` region does not exist**, so validation failures are announced to nobody.
- **Custom comboboxes with no ARIA: 2 patterns.** `src/components/ui/DynamicForm.tsx:52-70` (SSIC) and `src/components/ui/AutoSuggestInput.tsx:60-73`. Neither exposes `role="combobox"`, `aria-expanded`, `role="listbox"` or `role="option"`; both select on `onPointerDown` only.
- **Touch targets under 44px tall at 390x844: 49.** Includes Undo and Redo at 32x32 and "Or enter manually..." at 119x16. (`scratchpad/walk7.mjs`)
- **Horizontal overflow at 390px: none.** `scrollWidth` 390 equals `clientWidth` 390 on both the landing page and the editor. Responsive layout holds.
- Contrast: the F6 measurements in SECTION_508_FINDINGS.md stand, with the caveat that the amber "Unsaved" and emerald "Saved" text measured there never renders (finding 6).

## Dead and half-wired items

- **R12 preview Print/Download: FIXED.** Handlers present at `src/components/layout/LivePreview.tsx:47-73`, enabled in the live build. Not dead.
- **Header save indicator: DEAD.** `isDirty` and `lastSavedAt` are declared in `ModernAppShell.tsx:63-64` and consumed at `:181-193`, and no caller passes them.
- **Mobile compliance: NEVER WIRED.** `PreviewModal` has no `issues` prop.
- **Orphaned files, zero referencing modules:** `src/components/ModernParagraphEditor.tsx` (239 lines, uses off-theme `text-gray-400` and `focus:ring-blue-500`) and `src/components/ui/SimpleCombobox.tsx` (hardcoded light-mode hex colours, `#ffffff` background and `#495057` text, which would be unreadable in dark mode if it were ever mounted).
- The clause-library deletions promised in USER_DRIVEN_ROADMAP.md line 192-197 have been completed - the build serves cleanly.

## What already works and must not be broken

- Header field help text: six fields, six concrete examples, real policy pointers. This is the model the error messages should copy.
- The Correspondence Guide: when to use, when not to use, example subject, chapter citation, per type.
- Policy defaults pre-filled: today's date, Times New Roman, USMC Standard header, Via/References/Enclosures default No, directives auto-set "Distribution List".
- Seven clicks and seven fields to a compliant exported PDF, with a correct filename derived from SSIC and subject.
- Offline reload from the service worker, and only same-origin fetches outside GunnyBot.
- The Export menu's DOCX accessibility note (F1 mitigation) is present and correctly worded.
- The share dialog's separation-of-channel guidance: "Share the password through a separate channel from the link."
- The review panel's empty state, which is the only empty state in the app with a call to action.
- Missing enclosure files are named and reported, never dropped silently.

## Recommended fix phases

**Phase 1 - Make the editor usable and honest (S).** Fixes findings 1, 2, 6.
`src/components/letter/ParagraphItem.tsx` (always-mounted textarea plus aria-label naming the paragraph number), `src/components/layout/ModernAppShell.tsx` and `src/components/layout/LivePreview.tsx` (lift the compliance banner out of the `xl`-only aside), `src/components/layout/PreviewModal.tsx` (accept and render `issues`), `src/app/page.tsx` (pass `isDirty` and `lastSavedAt`). Highest value per line in this report.

**Phase 2 - Messages that teach the rule (S/M).** Fixes findings 3, 8, and the Compliance dead end.
`src/lib/schema-validators.ts` (field-to-policy citation map, requirement-shaped rule text, drop the source path), `src/components/ComplianceDialog.tsx` (jump-to-field per issue, and a clean state that says so), `src/hooks/useDocumentExport.ts:83` (replace `alert()` with the dialog).

**Phase 3 - Stop crying wolf (M).** Fixes finding 4.
`src/hooks/useSpellCheck.ts` (delegate English to the platform via `spellcheck` on the textarea, keep the custom pass for military terms and acronym first-use only), `src/components/ui/SpellCheckBar.tsx` (report only what the custom pass owns).

**Phase 4 - Reuse for the daily driver (S).** Fixes finding 5 and the library dead end.
`src/hooks/useTemplates.ts` (unfiltered list plus a type-match chip), the templates dialog in `src/components/layout/HeaderActions.tsx` (label the active filter), `src/components/DocumentLibraryDialog.tsx` (empty state offers "Save this document now"), plus a Ctrl+K hint in the header.

**Phase 5 - First run and accessibility close-out (M).** Fixes findings 7, 9, 10 and the heading and combobox counts.
`src/components/DisclaimerModal.tsx` (short consent, link out to the full text), `src/components/layout/LandingPage.tsx` (a "Start from a filled example" card sourcing `examples/sample-training-schedule.nldp`), `src/components/layout/LivePreview.tsx` (empty state listing the six required fields), section headers in `src/components/letter/*Section.tsx` promoted to `h2`/`h3`, `src/components/ui/DynamicForm.tsx` and `src/components/ui/AutoSuggestInput.tsx` (full combobox ARIA plus arrow-key selection), and a touch-target sweep at 390px. Delete `ModernParagraphEditor.tsx` and `SimpleCombobox.tsx` while in the area.
