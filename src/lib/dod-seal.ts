import { ImageRun, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, convertInchesToTwip } from 'docx';

import { loadSealBytes } from '@/lib/seal-assets';

type LetterheadType = 'marine-corps' | 'navy';

// One ArrayBuffer per seal, sliced from the shared byte cache so repeated
// exports pay for the load once. The bytes come from public/seals/ (see
// seal-assets.ts), no longer from a base64 module.
const sealBufferCache = new Map<LetterheadType, ArrayBuffer>();

export async function getDoDSealBuffer(letterheadType: LetterheadType = 'marine-corps'): Promise<ArrayBuffer> {
  const cached = sealBufferCache.get(letterheadType);
  if (cached) return cached;

  const bytes = await loadSealBytes(letterheadType === 'navy' ? 'navy' : 'dod');
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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
