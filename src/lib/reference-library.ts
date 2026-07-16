/**
 * P3.4 (DONDOCS_PARITY_PLAN) - curated reference library.
 *
 * Common directives and manuals cited in Marine Corps and Navy
 * correspondence, formatted the way they appear in a reference line.
 * Fed to the references autosuggest. Not exhaustive by design - the
 * list grows by demand, and users type anything not listed.
 */

export interface LibraryReference {
  /** Citation text as it belongs in the reference line. */
  citation: string;
  /** Human title for the suggestion list. */
  title: string;
}

export const REFERENCE_LIBRARY: LibraryReference[] = [
  { citation: 'SECNAV M-5216.5', title: 'DON Correspondence Manual' },
  { citation: 'SECNAV M-5210.1', title: 'DON Records Management Manual' },
  { citation: 'SECNAVINST 5216.7', title: 'DON Correspondence Management' },
  { citation: 'MCO 5215.1K', title: 'Marine Corps Directives Management Program' },
  { citation: 'MCO 5216.20B', title: 'Marine Corps Correspondence Program' },
  { citation: 'MCO 5210.11F', title: 'Marine Corps Records Management Program' },
  { citation: 'MCO 1050.3J', title: 'Regulations for Leave, Liberty, and Administrative Absence' },
  { citation: 'MCO 1000.6', title: 'Assignment, Classification, and Travel Systems Manual (ACTS)' },
  { citation: 'MCO 1610.7B', title: 'Performance Evaluation System (PES)' },
  { citation: 'MCO 1400.32D', title: 'Marine Corps Promotion Manual, Volume 2 (ENLPROMMAN)' },
  { citation: 'MCO 1900.16 CH-2', title: 'Marine Corps Separation and Retirement Manual (MARCORSEPMAN)' },
  { citation: 'MCO P1070.12K', title: 'Marine Corps Individual Records Administration Manual (IRAM)' },
  { citation: 'MCO 1130.80C', title: 'Enlisted Retention and Career Development Program' },
  { citation: 'MCO 5000.14E', title: 'Marine Corps Business and Support Services Program' },
  { citation: 'MCTFSPRIM', title: 'MCTFS Personnel Reporting Instructions Manual' },
  { citation: 'MCTFSCODESMAN', title: 'MCTFS Codes Manual' },
  { citation: 'DoDI 5200.48', title: 'Controlled Unclassified Information (CUI)' },
  { citation: 'DoDM 5200.01, Volume 2', title: 'DoD Information Security Program: Marking of Information' },
  { citation: 'DoD 5500.07-R', title: 'Joint Ethics Regulation (JER)' },
  { citation: 'JTR', title: 'Joint Travel Regulations' },
  { citation: 'DoDFMR 7000.14-R', title: 'DoD Financial Management Regulation' },
  { citation: 'U.S. Navy Regulations, 1990', title: 'United States Navy Regulations' },
  { citation: 'UCMJ', title: 'Uniform Code of Military Justice' },
  { citation: 'JAGINST 5800.7G', title: 'Manual of the Judge Advocate General (JAGMAN)' },
  { citation: '10 U.S.C.', title: 'Title 10, United States Code - Armed Forces' },
  { citation: '5 U.S.C. 552a', title: 'The Privacy Act of 1974' },
  { citation: '44 U.S.C. 3301', title: 'Definition of Federal Records' },
];

/**
 * Suggestions matching a fragment against citation and title,
 * citation-prefix matches first.
 */
export function searchReferences(fragment: string, limit = 8): LibraryReference[] {
  const query = fragment.trim().toLowerCase();
  if (query.length < 2) return [];
  const prefix: LibraryReference[] = [];
  const contains: LibraryReference[] = [];
  for (const ref of REFERENCE_LIBRARY) {
    const citation = ref.citation.toLowerCase();
    const title = ref.title.toLowerCase();
    if (citation.startsWith(query)) prefix.push(ref);
    else if (citation.includes(query) || title.includes(query)) contains.push(ref);
  }
  return [...prefix, ...contains].slice(0, limit);
}
