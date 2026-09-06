/**
 * Jump-to-field for the compliance dialog.
 *
 * The dialog listed issues with citations and offered no way back to
 * the field each one belonged to, so a reviewer read "SSIC is required
 * on every naval letter" and then went hunting for the box (UX audit,
 * persona 2). A validator issue which names one field now carries that
 * field name, and this takes the drafter to it.
 *
 * The header form marks every field wrapper with data-field, so the
 * lookup works for a plain input, a combobox and a date picker alike.
 * The first focusable control inside the wrapper takes focus.
 */

/** The attribute the form fields carry. */
export const FIELD_ATTRIBUTE = 'data-field';

const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';

/** A field name safe to put inside an attribute selector. */
function isPlainFieldName(field: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(field);
}

/**
 * Scrolls the named field into view and focuses its control. Returns
 * true when a field was found, so a caller which needs to know does
 * not have to guess. A field belonging to a section not on screen
 * reports false.
 */
export function focusDocumentField(
  field: string,
  root: ParentNode | null = typeof document === 'undefined' ? null : document,
): boolean {
  if (!root || !field || !isPlainFieldName(field)) return false;

  const wrapper = root.querySelector<HTMLElement>(`[${FIELD_ATTRIBUTE}="${field}"]`);
  if (!wrapper) return false;

  const target = wrapper.matches(FOCUSABLE)
    ? wrapper
    : wrapper.querySelector<HTMLElement>(FOCUSABLE);

  wrapper.scrollIntoView?.({ block: 'center' });
  target?.focus?.();
  return true;
}
