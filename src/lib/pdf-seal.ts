type SealData = {
  DOD_SEAL_DETAILED: string;
  NAVY_SEAL_BLUE: string;
};

// The seal module is ~3.8 MB of base64; loading it lazily keeps it out
// of the first-load bundle. Cached after the first import.
let sealData: SealData | null = null;

/**
 * Load the seal data chunk. Must resolve before any render calls
 * getPDFSealDataUrl() — the PDF generators await this before building
 * the document tree.
 */
export async function preloadPDFSeal(): Promise<void> {
  if (!sealData) {
    sealData = await import('./dod-seal-data');
  }
}

/**
 * Get the appropriate seal data URL for PDF rendering
 * @param headerType - 'USMC' for Marine Corps (black DoD seal) or 'DON' for Navy (blue seal)
 * @returns Base64 data URL for the seal image
 */
export function getPDFSealDataUrl(headerType: 'USMC' | 'DON' | 'DLA' = 'USMC'): string {
  if (!sealData) {
    throw new Error('Seal data not loaded — await preloadPDFSeal() before rendering the PDF');
  }
  const { DOD_SEAL_DETAILED, NAVY_SEAL_BLUE } = sealData;

  // Use Navy blue seal for DON, DoD seal for USMC and DLA
  const seal = (headerType === 'DON' && NAVY_SEAL_BLUE && !NAVY_SEAL_BLUE.includes('YOUR_NAVY_SEAL_BASE64_DATA_HERE'))
    ? NAVY_SEAL_BLUE
    : DOD_SEAL_DETAILED;

  return seal;
}
