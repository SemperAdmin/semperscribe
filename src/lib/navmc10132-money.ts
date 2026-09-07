/**
 * One reader for every dollar figure the NAVMC 10132 carries.
 *
 * WHY ONE READER. Until 2026-09 the forfeiture amount was read five different
 * ways: `Number(text)` in V-20 and W-07 (NaN on "$700" or "1,200", so the
 * over-ceiling gate SKIPPED the exact entries a clerk is most likely to type),
 * a strip-everything-but-digits regex in the item 6 renderer (which printed
 * "$$1,200" for "$1,200" and would have read "-700" as a figure), a
 * `[\d,]+` pattern on import, and `Number()` again in the MCTFS worksheet.
 * Five readers cannot agree, and a figure that one of them accepts and
 * another rejects is a forfeiture that validates on screen and fails on
 * export, or worse, exports unvalidated.
 *
 * WHAT A DOLLAR FIGURE IS, here. An optional leading `$`, digits with
 * optional thousands commas, and at most two decimal places. Nothing else:
 * no sign, no exponent, no hex, no trailing point, no bare ".50". Anything
 * outside that is null, and every caller treats null as "not a dollar
 * figure" rather than as zero. JavaScript's `Number()` accepts "7e2", "0x10",
 * "Infinity" and "-700", none of which a commander imposes as a forfeiture.
 *
 * INTEGER CENTS ARE THE CANONICAL VALUE. A caller comparing or summing
 * figures uses `cents`, so "100.10" times 3 is 30030 and not 300.29999.
 * `dollars` is `cents / 100` for callers that print or compare against a
 * whole-dollar ceiling.
 */

export interface ParsedDollars {
  /** The figure in integer cents. */
  cents: number;
  /** The figure in dollars, equal to cents / 100. */
  dollars: number;
}

/**
 * Thousands groups are either absent (`1200`) or complete (`1,200`,
 * `1,234,567`). A comma anywhere else is not a figure. Up to two decimal
 * places, and a decimal point must be followed by at least one digit.
 */
const DOLLAR_FIGURE = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Reads a dollar figure as typed. Strips one leading `$` and surrounding
 * whitespace, accepts thousands commas, and refuses everything else.
 * Returns null for a missing, blank, or unparseable value.
 */
export function parseDollars(text: unknown): ParsedDollars | null {
  if (typeof text !== 'string') return null;
  let body = text.trim();
  if (body.startsWith('$')) body = body.slice(1).trimStart();
  const match = DOLLAR_FIGURE.exec(body);
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ''));
  const fraction = match[2] ?? '';
  const centsPart = fraction === '' ? 0 : Number(fraction.padEnd(2, '0'));
  const cents = whole * 100 + centsPart;
  if (!Number.isSafeInteger(cents)) return null;
  return { cents, dollars: cents / 100 };
}

/** True when a parsed figure carries cents, which MCO 5800.16 Vol 14 para 010901 forbids. */
export function hasCents(parsed: ParsedDollars): boolean {
  return parsed.cents % 100 !== 0;
}

/**
 * Prints integer cents as `$1,200` or, where cents are present, `$50.50`.
 * One `$`, thousands separators, the way MCO 5800.16 Vol 14's worked example
 * (2) prints $500. A whole-dollar figure prints no decimals, because the
 * order requires whole dollars and ".00" would suggest cents were considered.
 */
export function formatDollars(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  const wholeText = whole.toLocaleString('en-US');
  return rest === 0 ? `$${wholeText}` : `$${wholeText}.${String(rest).padStart(2, '0')}`;
}

/**
 * A whole non-negative integer as typed: `\d+` and nothing else. Used for
 * day and month counts and for completed years of service, where `Number()`
 * would admit "1e1", "0x10", "-3" and "2.5". Null when the text is blank or
 * anything other than digits.
 */
export function parseWholeNumber(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const body = text.trim();
  if (!/^\d+$/.test(body)) return null;
  const value = Number(body);
  return Number.isSafeInteger(value) ? value : null;
}
