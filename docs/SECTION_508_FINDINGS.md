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

## What already passes

- Radix primitives (dialogs, menus, selects) ship focus trapping, escape handling, and ARIA wiring.
- The compliance banner uses role="alert" with aria-live.
- Form fields use Label-for-input association throughout the letter sections.
- Keyboard shortcuts (Ctrl+Z/Y) skip text fields, preserving native editing behavior.
- New Phase 1-3 components carry explicit aria-labels on all icon controls.

## Remediation status

F2, F3, F4, F5: fixed in code. F6: measured, compliant, no changes. F1: mitigated in the UI; the PDF-tagging strategy decision belongs in the Track A app.gov conversation. F7: documented decision, no change.

Remaining for the accessibility close-out: an assistive-technology pass (NVDA or JAWS) and an axe scan on a live build - static analysis cannot substitute for either.
