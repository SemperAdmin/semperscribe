/**
 * The sidebar's document-type grouping, as data, in sidebar order.
 *
 * Sidebar.tsx keeps its own hand-written JSX and does NOT import this
 * file: the 32 Semper Scribe how-to videos were recorded against the
 * current sidebar (10 to 12 Nov 2026), so its rendering stays
 * byte-for-byte unchanged. tests/sidebar-groups-drift.test.ts reads
 * Sidebar.tsx as text and fails when the two disagree, so this copy
 * cannot drift silently.
 *
 * Groups 1 to 9 are the sidebar accordion items. AMHS Message renders
 * as a standalone button after the accordion and is listed as group 10
 * so every sidebar type has a group. The same-page endorsement is a picker option of the
 * `endorsement` type, not a type id, so it is not listed.
 *
 * Spec: docs/superpowers/specs/2026-11-13-howto-videos-design.md 4.1.
 */
export interface DocumentGroup {
  /** The sidebar AccordionItem value, or the type id for a standalone item. */
  key: string;
  /** The sidebar label, verbatim. */
  label: string;
  /** Registry type ids in sidebar order. */
  typeIds: readonly string[];
}

export const DOCUMENT_GROUPS: readonly DocumentGroup[] = [
  { key: 'standard-letter', label: 'Standard Letter', typeIds: ['basic', 'multiple-address', 'endorsement'] },
  { key: 'memorandums', label: 'Memorandums', typeIds: ['mfr', 'from-to-memo', 'letterhead-memo', 'moa', 'mou'] },
  { key: 'staffing-papers', label: 'Staffing Papers', typeIds: ['information-paper', 'position-paper', 'decision-paper', 'coordination-page'] },
  { key: 'external-executive', label: 'External & Executive', typeIds: ['business-letter', 'executive-correspondence'] },
  { key: 'dla-correspondence', label: 'DLA Correspondence', typeIds: ['dla-memorandum', 'dla-business-letter'] },
  { key: 'directives', label: 'Directives', typeIds: ['mco', 'bulletin', 'volume', 'secnav-instruction', 'secnav-notice', 'change-transmittal'] },
  { key: 'forms', label: 'Forms', typeIds: ['aa-form', 'page11', 'navmc10922', 'navmc10132', 'navmc11106', 'dd1561', 'dd368', 'tla-packet'] },
  { key: 'counseling-worksheets', label: 'Counseling Worksheets', typeIds: ['counseling'] },
  { key: 'technical-publication', label: 'Technical Publication', typeIds: ['i-type'] },
  { key: 'amhs', label: 'AMHS Message', typeIds: ['amhs'] },
];
