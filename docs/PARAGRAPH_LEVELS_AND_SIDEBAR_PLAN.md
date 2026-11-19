# Paragraph Level Change and Collapsible Sidebar Plan

Status: planned, not built. Two user-requested UI enhancements.

Decisions locked with the requester:

- Indent and outdent move the whole branch (paragraph plus its descendants).
- The sidebar collapses by manual toggle only, and the choice persists.

---

## Feature A. Indent and outdent an existing paragraph

### Problem

`ParagraphItem` offers Main, Sub, Same and Up, and every one of them inserts a
new paragraph. Nothing changes the level of a paragraph already written. To
turn sibling 2. into sub-paragraph 1c today, the Marine adds a new Sub
paragraph, retypes or pastes the text, then deletes the original.

### Terminology risk

The request says "promote a sibling paragraph to a sub-paragraph". In outline
terms a move to a deeper level is a demotion. Users will mix these words, so
the UI uses direction words, not rank words:

- Indent: one level deeper (2. becomes 1c). Icon `IndentIncrease`.
- Outdent: one level higher (1c becomes 2.). Icon `IndentDecrease`.

The tooltip shows the resulting citation, matching the existing "+ 1c"
pattern: "Indent to 1c", "Outdent to 2.".

### Rules (pure functions, `src/hooks/useParagraphs.ts`)

Branch of paragraph at index i = i plus every following paragraph with a
level greater than `prev[i].level`, stopping at the first one at or above it.

`indentParagraph(id)`:

- Blocked at index 0 (no parent to nest under).
- Blocked when `level > prev[i - 1].level`. A paragraph nests at most one
  level below the paragraph above it, so 2. after 1. becomes 1a, never 1(1).
- Blocked when any branch member would exceed the document's max level
  (8, or 4 for `information-paper` and `position-paper`, same limit the Sub
  button already uses).
- Otherwise every branch member gets `level + 1`.

`outdentParagraph(id)`:

- Blocked at level 1.
- Otherwise every branch member gets `level - 1`.

Both:

- Blocked when the paragraph is `isMandatory` or carries a `title`
  (MOU, MOA, directive section headings). Changing those breaks the template.
- Return `prev` unchanged when blocked, so React skips the render.
- Export a pure `canIndent(list, index, maxLevel)` and `canOutdent(list, index)`
  so the buttons disable from the same rule the action enforces.

Citations need no change. `getUiCitation` derives from position and level, so
every number below the moved branch renumbers on the next render.

### Numbering warnings

No confirm dialog. Restructuring passes through invalid states (the first new
sub-paragraph is always a lone sibling until the second exists), and a prompt
on every click is noise. `ParagraphSection` line 77 already renders
`validateParagraphNumbering` errors, so the warning shows without new code.

### UI (`src/components/letter/ParagraphItem.tsx`)

- Two icon buttons in the header row beside Move Up and Move Down, same
  `h-8 w-8` and `max-sm:min-h-11` touch sizing.
- Disabled, not hidden, when blocked, with a `title` naming the reason.
  Hidden buttons shift the toolbar and hide the feature from new users.
- Accessible name includes the target citation: "Indent paragraph 2 to 1c".
- Keyboard: Alt+Shift+Right indents, Alt+Shift+Left outdents, while the
  paragraph textarea or read view has focus. Word uses the same chord for
  outline levels. Tab and Shift+Tab are rejected: capturing Tab in a textarea
  traps keyboard users (WCAG 2.1.2).
- Polite live region announces the result: "Paragraph is now 1c".
- Focus stays on the moved paragraph.

### Wiring

`onIndent` and `onOutdent` thread through the same path as `onMoveUp`:

- `useParagraphs` returns `indentParagraph`, `outdentParagraph`.
- `src/app/page.tsx` passes them to `DocumentLayout`.
- `DocumentLayout` and `SamePageEndorsementSection` pass them to
  `ParagraphSection`, which passes them to `ParagraphItem`.
- `ParagraphSection` computes `nextCitations.indent` and `.outdent` for the
  tooltips by running `getUiCitation` on the simulated result.

Undo needs no change. `useUndoHistory` snapshots `paragraphs`. Its snapshot is
debounced, so three fast indent clicks collapse into one undo step. Accept it.

### Out of scope (separate paragraph models)

- Volume `BlockEditor` and `ChapterTree` (`useVolumeStore`).
- AMHS `MessageBodyEditor`.
- I-Type appendix editor.

Each of these needs its own pass if Marines ask for it there.

### Tests

- `tests/use-paragraphs-levels.test.tsx` (new):
  - indent sibling 2. under 1. yields 1a, branch children follow.
  - indent blocked at index 0, at level jump, at max level (8 and 4).
  - outdent blocked at level 1, branch children follow.
  - mandatory and titled paragraphs blocked.
  - blocked call returns the same array reference.
  - citations of paragraphs after the branch renumber.
- `tests/components/paragraph-item-levels.test.tsx` (new): buttons render,
  disabled states carry a reason, Alt+Shift+Arrow fires the handlers.
- Extend the existing axe e2e run to cover the new buttons.

---

## Feature B. Collapsible desktop sidebar

### Problem, with numbers

At a 1366px laptop width the preview pane shows (it appears at `xl`, 1280px
and up). Sidebar takes 256px fixed, preview takes `w-[45%] min-w-[500px]`,
which is 615px. Editor gets about 495px minus padding. The
sidebar holds the document type picker and Find in Document, which a Marine
uses at the start of a document and rarely after.

### Behavior

- Expanded: today's `w-64` sidebar, plus a collapse button in its top row.
- Collapsed: a `w-12` rail with three controls stacked:
  - Expand sidebar.
  - Document type, showing the current type's icon. Click expands the sidebar
    with the type accordion focused.
  - Find in Document. Click expands the sidebar and focuses the search input.
- Width animates with `transition-[width]`, disabled under
  `prefers-reduced-motion`.
- State persists in `localStorage` under `semperscribe.sidebarCollapsed`,
  read and written inside try/catch, default expanded. First paint renders
  expanded, then applies the stored value after hydration (`useHydrated`)
  to avoid a server and client mismatch in the static export.
- Mobile (below `md`) is unchanged. The `Sheet` drawer ignores the setting.

### Controls

- Button in the sidebar header and in the rail, with `aria-expanded` and
  `aria-controls` pointing at the sidebar region.
- Command palette entry "Toggle sidebar".
- Keyboard shortcut Ctrl+\ (Cmd+\ on Mac). Ctrl+B is rejected: Firefox binds it
  to the bookmarks sidebar and it reads as Bold inside the editor.
- When collapsing moves focus out of a now-hidden control, focus returns to
  the expand button.

### Files

- `src/hooks/useSidebarCollapsed.ts` (new): state, persistence, toggle.
- `src/components/layout/Sidebar.tsx`: `collapsed` and `onToggleCollapsed`
  props, rail rendering, header button.
- `src/components/layout/ModernAppShell.tsx`: owns the hook, passes props to
  the desktop `Sidebar` only, registers the shortcut.
- `src/components/CommandPalette.tsx`: new command.

### Not chosen

- The unused shadcn `src/components/ui/sidebar.tsx` already supports a
  collapsible rail. Adopting it means rebuilding the shell layout around its
  provider. Larger diff, more regression surface, no added user value now.
- Persisting the existing preview toggle (`showPreview`) is a related gap but
  out of scope.

### Tests

- `tests/use-sidebar-collapsed.test.tsx` (new): default expanded, toggle,
  persistence, storage throwing falls back to expanded.
- Extend `tests/components/sidebar-*.test.tsx`: rail renders three labeled
  buttons, expand from search focuses the input, `aria-expanded` flips.
- Playwright: at 1366x768, collapse, reload, sidebar stays collapsed, axe
  passes in both states.

---

## Build order for token-orchestrator

1. A1 pure rules plus unit tests (`useParagraphs`).
2. A2 `ParagraphItem` buttons, keyboard, live region, component tests.
3. A3 wiring through `page.tsx`, `DocumentLayout`, `SamePageEndorsementSection`.
4. B1 `useSidebarCollapsed` plus tests.
5. B2 `Sidebar` rail and `ModernAppShell` wiring, palette, shortcut.
6. Gate: `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`,
   `npm run test:nogolden`, `npm run test:e2e -- --trace off`.

A and B touch disjoint files, so they run as two parallel tracks.
