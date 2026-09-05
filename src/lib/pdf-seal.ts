import { loadSealDataUrl, type SealKind } from '@/lib/seal-assets';

// Data URLs by seal, filled by preloadPDFSeal(). The PDF generators
// await the preload before building the document tree because
// @react-pdf renders synchronously and <Image> needs its source ready.
const loaded = new Map<SealKind, string>();

/**
 * Load both seals (2.9 MB of PNG, fetched once and cached by
 * seal-assets and by the service worker). Must resolve before any render
 * calls getPDFSealDataUrl().
 */
export async function preloadPDFSeal(): Promise<void> {
  const kinds: SealKind[] = ['dod', 'navy'];
  const urls = await Promise.all(kinds.map(kind => loadSealDataUrl(kind)));
  kinds.forEach((kind, i) => loaded.set(kind, urls[i]));
}

/**
 * Get the appropriate seal data URL for PDF rendering
 * @param headerType - 'USMC' for Marine Corps (black DoD seal) or 'DON' for Navy (blue seal)
 * @returns Base64 data URL for the seal image
 */
export function getPDFSealDataUrl(headerType: 'USMC' | 'DON' | 'DLA' = 'USMC'): string {
  // Navy blue seal for DON, DoD seal for USMC and DLA.
  const kind: SealKind = headerType === 'DON' ? 'navy' : 'dod';
  const url = loaded.get(kind);
  if (!url) {
    throw new Error('Seal data not loaded — await preloadPDFSeal() before rendering the PDF');
  }
  return url;
}
