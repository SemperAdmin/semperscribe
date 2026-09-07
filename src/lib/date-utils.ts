/**
 * Date utility functions for naval letter formatting
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Build a LOCAL-midnight Date from calendar parts, or null when the parts do
 * not name a real day (31 Feb, 0 Jan, month 13). `new Date(y, m, d)` rolls
 * such input forward or back silently, so the constructed date is checked
 * against the parts it was built from.
 *
 * @param month - 1-indexed calendar month
 */
export function localDateFromParts(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Parse 'YYYY-MM-DD' (or 'YYYY-M-D') into a LOCAL-midnight Date. Never route
 * an ISO date-only string through `new Date(string)`: the spec parses it as
 * UTC midnight, and west of Greenwich the local calendar day comes back one
 * day early (see src/lib/navmc10132-date.ts). Returns null for anything that
 * is not an ISO calendar date, rolled dates included.
 */
export function parseIsoLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  return localDateFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/**
 * Formats a date string to Business Letter format (Month D, YYYY)
 * e.g., "January 5, 2015"
 */
export function formatBusinessDate(dateString: string): string {
  if (!dateString) return '';

  const FULL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let date: Date | null = null;

  // Handle "today" or "now"
  if (dateString.toLowerCase() === 'today' || dateString.toLowerCase() === 'now') {
    date = new Date();
  } else {
    // Try to parse standard Naval format "5 Jan 15" or "5 Jan 2015"
    const navalMatch = dateString.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
    if (navalMatch) {
      const day = parseInt(navalMatch[1]);
      const monthStr = navalMatch[2];
      const yearStr = navalMatch[3];
      
      const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
      const year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
      
      if (monthIndex !== -1) {
        // Null for a rolled date such as 31 Feb; the input then comes back unchanged.
        date = localDateFromParts(year, monthIndex + 1, day);
      }
      if (!date) return dateString;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // Handle YYYY-MM-DD explicitly as local time to avoid timezone shifts
      date = parseIsoLocalDate(dateString);
      if (!date) return dateString;
    }

    // Fallback to standard Date parsing
    if (!date) {
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
  }

  if (date) {
    return `${FULL_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  return dateString; // Return original if parsing fails
}

/**
 * Converts various date formats to naval format (DD MMM YY)
 * Supports: Naval format, ISO dates, MM/DD/YYYY, YYYYMMDD, "today", "now"
 *
 * @param dateString - The date string to format
 * @returns Formatted date in naval format (e.g., "15 Jan 24")
 */
export function parseAndFormatDate(dateString: string): string {
  // If already in Naval format, return as-is
  const navalPattern = /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}$/i;
  if (navalPattern.test(dateString)) {
    return dateString;
  }

  let date: Date | null = null;

  // Handle various date formats
  if (dateString.toLowerCase() === 'today' || dateString.toLowerCase() === 'now') {
    date = new Date();
  } else if (/^\d{8}$/.test(dateString)) {
    // YYYYMMDD format
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
    // ISO format YYYY-MM-DD, parsed by parts into a LOCAL date. new Date(iso)
    // is UTC midnight and printed the previous day west of Greenwich.
    date = parseIsoLocalDate(dateString);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    // MM/DD/YYYY format
    const parts = dateString.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  } else {
    // Try generic Date parsing
    try {
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    } catch (e) {
      // ignore invalid date strings
    }
  }

  // If parsing failed, return original string
  if (!date || isNaN(date.getTime())) {
    return dateString;
  }

  // Format to naval format
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);

  return `${day} ${month} ${year}`;
}

/**
 * Gets today's date in naval format
 *
 * @returns Today's date formatted as "DD MMM YY"
 */
export function getTodaysDate(): string {
  const today = new Date();
  const navyDate = today.getDate() + ' ' + MONTHS[today.getMonth()] + ' ' + today.getFullYear().toString().slice(-2);
  return navyDate;
}
