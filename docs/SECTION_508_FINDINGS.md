# Section 508 Findings - Targeted Audit (2026-07-15)

Remediation pass completed 2026-07-15 - status lines added per finding below.

Scope: static code audit of the UI layer plus export output review. Method limit: no assistive-technology pass (NVDA/JAWS) and no automated axe scan ran - both belong to the remediation phase on a live build. Severity: H = adoption blocker for app.gov, M = fix before review, L = polish.

## Findings

### F1 (H) - Exported PDFs are untagged - MITIGATED (option a), strategic decision open
@react-pdf/renderer and pdf-lib emit untagged PDFs: no structure tree, no reading order, no tagged headings. Screen readers get raw text at best. For a DOCUMENT GENERATOR this is the dominant 508 exposure - the products of the tool, not the tool, reach the widest audience. Options ranked: (a) position DOCX as the accessible output (docx exports carry real structure) and say so in the UI, (b) post-process tagging - heavy, (c) accept and document. Recommend (a) plus documentation.
STATUS: Option (a) shipped - the Export menu now carries a note directing users to DOCX for screen-reader accessible output. The strategic tagging decision stays on the Track A agenda.

### F2 (M) - Duplicate main landmarks - FIXED
app/layout.tsx wraps children in `<main>` and ModernAppShell renders a second `<main>`. Landmark navigation announces two main regions. Fix: ModernAppShell's inner element becomes a `<div>` with `role="region"` and a label, or the outer wrapper drops `<main>`.
STATUS: Fixed - the inner element is now a labeled region (`role="region"`, aria-label "Document form", id main-content, tabIndex -1 as the skip-link target). app/layout.tsx owns the single main landmark.

### F3 (M) - No skip link - FIXED
Keyboard users tab through the banner, header, and toolbar on every page load before reaching the form. Add a visually-hidden skip-to-content link as the first focusable element.
STATUS: Fixed - "Skip to document form" link renders as the first focusable element in ModernAppShell, visible on focus, targeting #main-content.

### F4 (M) - Icon-only buttons, legacy sections - FIXED
New components (library, share, clause, attachment panels) carry aria-labels throughout. Legacy icon buttons need a sweep - ReferenceManager and older paragraph controls rely on `title` alone in places. `title` is not reliably announced. Sweep rule: every `size="icon"` Button gets an aria-label.
STATUS: Fixed - brace-aware scan found 22 unlabeled icon buttons across 14 files; every one now carries an aria-label (title mirrored where present, explicit labels written where absent). Re-scan reports zero remaining. The shadcn sidebar trigger already named itself via sr-only text.

### F5 (M) - Live preview has no text alternative - FIXED
The right-pane PDF preview is an embedded canvas/iframe with no announced state. Screen-reader users get silence when the preview updates. Fix: aria-live region announcing "Preview updated, N pages" on regeneration.
STATUS: Fixed - a visually-hidden aria-live="polite" region in LivePreview announces "Updating document preview", "Document preview updated", or "Preview not available" as state changes. Page-count announcement remains a nice-to-have.

### F6 (L) - Color-contrast spot checks owed - MEASURED, ALL PASS
Theme tokens look compliant (muted-foreground on background computes near 4.6:1 in light mode) but nobody has measured the amber "Unsaved" text on the dark header or the yellow warning banner. Measure both modes with a contrast tool.
STATUS: Measured computationally (WCAG relative luminance). Light muted-foreground on background 4.84:1, dark 7.23:1, body text 15.86:1 both modes, banner black-on-yellow 13.71:1, amber "Unsaved" on header 11.61:1 light / 10.29:1 dark, emerald "Saved" 10.99:1 / 9.73:1. Every pair clears WCAG AA 4.5:1. No theme changes required.

### F7 (L) - Portion-marking select is native
The paragraph marking dropdown is a native `<select>` - fully accessible by default, but visually inconsistent with the Radix selects. Cosmetic only; do not trade accessibility for consistency.

### F8 (H) - Paragraph body unreachable by keyboard - FIXED (2026-09-05)
The letter body was a plain div with a click handler and no textarea existed in the DOM until a pointer landed on it, so the primary input of the app took neither focus nor text from the keyboard. WCAG 2.1.1 Level A.
STATUS: Fixed 2026-09-05 (phase D.2) - the read view is a control with tabIndex 0, role button, and an accessible name carrying the paragraph citation ("Paragraph 1 body"). Enter or Space opens the textarea under the same name, Escape returns focus to the read view. Pinned by tests/components/paragraph-item-keyboard.test.tsx and a Tab-to-body step in the e2e smoke test.

## What already passes

- Radix primitives (dialogs, menus, selects) ship focus trapping, escape handling, and ARIA wiring.
- The compliance banner uses role="alert" with aria-live.
- Form fields use Label-for-input association throughout the letter sections.
- Keyboard shortcuts (Ctrl+Z/Y) skip text fields, preserving native editing behavior.
- New Phase 1-3 components carry explicit aria-labels on all icon controls.

## Remediation status

F2, F3, F4, F5, F8: fixed in code. F6: measured, compliant, no changes. F1: mitigated in the UI; the PDF-tagging strategy decision belongs in the Track A app.gov conversation. F7: documented decision, no change.

Remaining for the accessibility close-out: an assistive-technology pass (NVDA or JAWS). The axe scan on a live build shipped in D.8 and is recorded below.

## D.8 accessibility close-out (2026-09-05)

Phase D.8 of docs/UX_POLICY_PLAN_2026-09.md. This is the pass the note
at the top of this file said was owed: an automated axe scan on a live
build, run from the e2e suite. The assistive-technology pass with NVDA
or JAWS is still owed and is not something an automated run replaces.

### What the axe pass is

`tests/e2e/axe.spec.ts` runs `@axe-core/playwright` against the built
static export on four surfaces: the landing page and a basic-letter
editor, each at 1280x800 and at 390x844. The narrow pass matters
because the audit found surfaces which exist only below the xl
breakpoint and nothing had ever checked them. Tags scanned: wcag2a,
wcag2aa, wcag21a, wcag21aa and best-practice. The gate is serious and
critical violations; moderate and minor findings are recorded here.

The persistent header and footer are excluded from the gate. Both carry
theme-token contrast failures which predate this phase, listed under
"Open, outside D.8" below.

### Fixed in D.8

- **F9 (H) - three form controls with no accessible name.** The audit
  counted 5 of 13 visible form controls unnamed. axe reported the three
  buttons as `button-name` [critical]: the Header Type, Body Font and
  Header Color selects in `HeaderSettingsSection`. Each carried a
  `<label>` with no `htmlFor` and a Radix `SelectTrigger` with no id, so
  a screen reader announced a button with no name at all. Each label now
  points at an id on its trigger. The two placeholder-named inputs were
  the sidebar search, which now carries `aria-label="Find in document"`,
  and the SSIC search, which now takes the id the visible FormLabel
  points at. The sidebar's clear-search button gained a name too.
- **F10 (H) - two custom comboboxes with no ARIA.** The SSIC picker in
  `DynamicForm` and `AutoSuggestInput` were plain div lists selecting on
  `onPointerDown` alone. Both are now WAI-ARIA comboboxes: `role`
  combobox on the input with `aria-expanded`, `aria-controls` and
  `aria-activedescendant`, a `role="listbox"` of `role="option"` items,
  arrow keys to move with wrap at both ends, Enter to select, Escape to
  close, and selection on click as well as on pointer down. The shared
  keyboard half is `src/hooks/useListboxNavigation.ts`. SSIC is required
  on every naval letter and this picker is the only lookup, so this was
  the required field no keyboard-only drafter reached.
- **F11 (M) - form section headings were not headings.** The audit
  measured 0 of 9. `CardTitle` takes an `as` prop and every form section
  card in the editor renders `h3`, one level under the document-type
  `h2` the editor puts above the form. Pinned by
  `tests/components/editor-headings.test.tsx`, which queries by role.
- **F12 (M) - touch targets under 44 px.** The audit counted 49 under 44
  px tall at 390x844, Undo and Redo among them at 32x32. The icon
  buttons in the editor chrome carry `max-sm:min-h-11 max-sm:min-w-11`,
  which is 44 px below the sm breakpoint and leaves desktop density
  untouched: the header action buttons including Undo and Redo, the
  mobile menu button, the paragraph move and level controls, the unit
  info controls and the sidebar clear-search button.
- **F13 (M) - landmarks were not distinguishable.** axe reported
  `landmark-unique` [moderate] on the two `aside` landmarks. The sidebar
  is now labelled "Document types and search" and the preview pane
  "Live preview".
- **Preview empty state.** Not a 508 finding as such, but the blank
  preview rectangle now names the required fields of the chosen type,
  read from the same document-type definition the schema validators run
  against.

### Open, outside D.8

Recorded with rule id, element and the ratio axe measured. All are
theme-token decisions rather than anything a D.8 file owns, and none is
fixable without changing the palette.

- `color-contrast` [serious], `header h1` "Semper Scribe": 3.14:1.
  Foreground #886616 (the gold `primary`) on #1a1c33 (the navy
  `secondary`). Needs 4.5:1 at 18px bold.
- `color-contrast` [serious], two header menu triggers (the settings
  dialog trigger and the overflow menu): 3.26:1. Foreground #6d6d78
  (`muted-foreground`) on #1a1c33.
- `color-contrast` [serious], five footer items (the proof-of-concept
  line, the privacy link, the security disclosure link, the licence link
  and the feedback link): 4.49:1. Foreground #6d6d78 on #f0f0f4 at 12px.
  This is the F6 measurement missing its real background: F6 measured
  `muted-foreground` on `background` at 4.84:1, and the footer sits on
  `bg-muted/40`, which is a different pair.
- `heading-order` [moderate], the sidebar `h3` "Document Type". The
  sidebar's group headings follow the header `h1` with no `h2` between
  them. Not gated, and the sidebar is outside the D.8 file set.

### Method note on F6

F6 recorded every measured pair as passing. Three of its pairs were
measured against the wrong background, which the axe run caught. The
lesson stands for the next pass: measure the computed pair on the built
page, not the token pair in the theme file.
