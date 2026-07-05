import { ImageRun, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, convertInchesToTwip } from 'docx';

type LetterheadType = 'marine-corps' | 'navy';

// Decoding the ~3.8 MB base64 seal costs a full fetch+decode pass;
// cache the decoded buffer per seal so repeated exports pay it once.
const sealBufferCache = new Map<LetterheadType, ArrayBuffer>();

async function resolveSealDataUrl(letterheadType: LetterheadType): Promise<string> {
  const { DOD_SEAL_DETAILED, NAVY_SEAL_BLUE } = await import('./dod-seal-data');
  // Fallback to DoD seal if Navy seal is not ready
  return (letterheadType === 'navy' && NAVY_SEAL_BLUE && !NAVY_SEAL_BLUE.includes('YOUR_NAVY_SEAL_BASE64_DATA_HERE'))
    ? NAVY_SEAL_BLUE
    : DOD_SEAL_DETAILED;
}

export async function getDoDSealBuffer(letterheadType: LetterheadType = 'marine-corps'): Promise<ArrayBuffer> {
  const cached = sealBufferCache.get(letterheadType);
  if (cached) return cached;

  const dataUrl = await resolveSealDataUrl(letterheadType);
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  sealBufferCache.set(letterheadType, buffer);
  return buffer;
}

export async function createDoDSeal(letterheadType: LetterheadType = 'marine-corps'): Promise<ImageRun> {
  const sealBuffer = await getDoDSealBuffer(letterheadType);

  return new ImageRun({
    data: sealBuffer,
    transformation: {
      width: convertInchesToTwip(0.067),
      height: convertInchesToTwip(0.067),
    },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: 458700
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: 458700
      },
    },
  });
}
