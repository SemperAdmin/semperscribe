// Shared derivations for the I-Type page 3 (authentication letter).
// One source of truth so the preview, PDF, and DOCX render identical strings.

// "U.S. MARINE CORPS" -> "UNITED STATES MARINE CORPS"
export const deriveService = (service?: string) =>
  service ? service.replace(/^U\.S\./, 'UNITED STATES') : '';

// Activity name in caps for the letterhead.
export const deriveEntity = (entity?: string) => (entity ? entity.toUpperCase() : '');

// Letterhead address: caps, no abbreviations punctuation per DON standard.
const sanitizeAddr = (s: string) =>
  s.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

// Split a one-line address into street line and city/state/zip line.
export const splitAddress = (address?: string): [string, string] => {
  if (!address) return ['', ''];
  const idx = address.indexOf(',');
  if (idx === -1) return [sanitizeAddr(address), ''];
  return [sanitizeAddr(address.slice(0, idx)), sanitizeAddr(address.slice(idx + 1))];
};

// "TECHNICAL MANUAL" -> "Technical Manual"
export const titleCase = (text?: string) =>
  text
    ? text
        .toLowerCase()
        .split(' ')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ')
    : '';

// "Technical Manual, TM-#####X-##/#,"
export const deriveAppropriatePublication = (publicationType?: string, shortTitle?: string) => {
  const type = titleCase(publicationType);
  if (!type && !shortTitle) return '';
  return `${type}, ${shortTitle || ''},`;
};

// Page-3 date in "D MMM YY" form, e.g. "9 Jun 26".
export const formatLongDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
};

// Inline link text reused across the boilerplate.
export const PAGE3_LINKS = {
  safetyEmail1: 'smb_mcsc_safety@usmc.mil',
  safetyEmail2: 'hqmc_safety_division@usmc.mil',
  portal: 'https://app.mcboss.usmc.mil/',
};
