/**
 * Best-effort structured citation parsing for NLDP 1.1 references
 * (docs/POLICY_AS_DATA_HANDOFF.md section 4).
 *
 * The contract is strict: `parsed: false, cited: null` is a correct,
 * expected answer. An unparsed reference is handled downstream; a wrong
 * one becomes a false authority edge in the policy graph, which is
 * worse than none. NEVER widen a pattern to make `parsed: true` more
 * often — every pattern here must anchor on an unambiguous issuance
 * token and take the number exactly as printed, periods intact.
 */

import type { NLDPCitedIssuance } from './nldp-format';

/**
 * Issuance series whose citations follow the common
 * "<TYPE> <number><revision?>" shape, e.g. "MCO 5215.1K",
 * "SECNAVINST 5216.5E", "DoDI 1000.13". Matched case-insensitively but
 * reported in the canonical spelling given here.
 */
const SERIES_TOKENS = [
  'MCO',
  'MCBUL',
  'NAVMC',
  'SECNAVINST',
  'OPNAVINST',
  'BUPERSINST',
  'DODD',
  'DODI',
  'DODM',
] as const;

/** "MARADMIN 341/26" — the one series numbered per-year. */
const MARADMIN_RE = /^MARADMIN\s+(\d{1,4})\/(\d{2}|\d{4})\b/i;

/**
 * "<TYPE> <P?nnnn.n...X>" with the number taken verbatim. The optional
 * leading P is the publication marker (e.g. "MCO P5060.20"). A trailing
 * revision letter stays inside `number` because that is how it prints.
 */
const SERIES_RE = new RegExp(
  '^(' + SERIES_TOKENS.join('|') + ')\\s+(P?\\d{3,5}(?:\\.\\d+)*[A-Z]?)(?=$|[\\s,;])',
  'i'
);

/** "w/CH-2", "with Ch 1", "CH-3" following the number. */
const EDITION_RE = /\b(?:w\/|with\s+)?ch(?:ange)?[-\s]?(\d+)\b/i;

/**
 * Strips a leading reference label like "(a) " so both raw reference
 * text and labelled lines parse identically.
 */
function stripLabel(text: string): string {
  return text.replace(/^\s*\([a-z]{1,3}\)\s*/i, '').trim();
}

export interface CitationParseResult {
  parsed: boolean;
  cited: NLDPCitedIssuance | null;
}

/**
 * Parses one reference line into a structured citation, or reports
 * honestly that it could not.
 */
export function parseCitedIssuance(text: string): CitationParseResult {
  const line = stripLabel(text);
  if (!line) return { parsed: false, cited: null };

  const maradmin = line.match(MARADMIN_RE);
  if (maradmin) {
    const year = maradmin[2].length === 2 ? `20${maradmin[2]}` : maradmin[2];
    return {
      parsed: true,
      cited: { docType: 'MARADMIN', number: maradmin[1], year },
    };
  }

  const series = line.match(SERIES_RE);
  if (series) {
    const docType = SERIES_TOKENS.find(
      t => t.toLowerCase() === series[1].toLowerCase()
    )!;
    const cited: NLDPCitedIssuance = { docType, number: series[2] };
    const edition = line.slice(series[0].length).match(EDITION_RE);
    if (edition) cited.edition = `CH-${edition[1]}`;
    return { parsed: true, cited };
  }

  return { parsed: false, cited: null };
}
