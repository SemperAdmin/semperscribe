/**
 * ISO date helpers for the NAVMC 10132 form.
 *
 * All nine date fields on this form format as yyyy-mm-dd, set by the form's own
 * AFDate_FormatEx scripts, so ISO is both the storage and the print format.
 *
 * THE TRAP THIS EXISTS TO AVOID: never call new Date('2026-08-14'). The ECMAScript
 * spec parses a bare date-only string as UTC midnight, so anywhere west of
 * Greenwich the local calendar date comes back one day earlier. The NAVMC 10922
 * build hit this. Parse the parts and build a LOCAL date instead.
 */

/** Parse yyyy-mm-dd into a local-midnight Date. Returns null on anything else. */
export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Local constructor, not Date.parse. See the header note.
  const d = new Date(year, month - 1, day);
  // Reject a rolled-over date such as 2026-02-31 becoming 2026-03-03.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Format a Date as yyyy-mm-dd using its LOCAL calendar fields. */
export function toIsoDate(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
