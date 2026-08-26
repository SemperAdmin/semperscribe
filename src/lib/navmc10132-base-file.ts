/**
 * The uploaded signed UPB, kept so every later export writes into IT rather
 * than into a fresh blank.
 *
 * WHY THIS IS NOT ON `formData`. The file is five megabytes. Document state
 * is JSON-serialized on every autosave and into every `.nldp`, so putting
 * the bytes there would stringify five megabytes on a timer and again on
 * every save. The bytes live in IndexedDB and document state carries only
 * the load report that says one exists.
 *
 * WHY IT REUSES THE ENCLOSURE FILE STORE. `document-library.ts` already
 * keeps binary blobs keyed by owning document, with quota handling, a
 * delete-by-owner sweep, and a working-copy id for the pre-save document. A
 * second store would duplicate all of it and would still need its own
 * clear-form hook. The id scheme below keeps the two uses from colliding,
 * and `fileDeleteForDoc` on Clear Form drops the base along with the
 * enclosures, which is the behaviour you want: a cleared document has no
 * signed file behind it any more.
 *
 * ONE BASE PER DOCUMENT, replaced rather than accumulated. Loading a second
 * signed file overwrites the first, because the newer file is the one
 * carrying the newer signatures. Every pass produces a file that CONTAINS
 * every earlier pass, so keeping the old one has no value.
 */

import {
  filePut,
  fileGet,
  fileDelete,
  WORKING_COPY_DOC_ID,
} from '@/lib/document-library';

/**
 * Deterministic, and namespaced away from enclosure ids, which are random
 * uuids. A fixed id per document is what makes "replace the base" a put
 * rather than a search-and-delete.
 */
function baseFileId(docId: string): string {
  return `navmc10132-base:${docId}`;
}

/** Stores the uploaded file as the base for later exports. */
export async function putNavmc10132Base(
  bytes: ArrayBuffer,
  fileName: string,
  docId: string = WORKING_COPY_DOC_ID,
): Promise<void> {
  await filePut({
    fileId: baseFileId(docId),
    docId,
    fileName,
    title: 'Uploaded signed NAVMC 10132',
    mimeType: 'application/pdf',
    bytes,
    byteLength: bytes.byteLength,
  });
}

/**
 * The base file's bytes, or null when this document was not loaded from one.
 *
 * NEVER THROWS. A missing base is the ordinary case, a fresh document, and
 * an IndexedDB failure must degrade to "no base" rather than take the export
 * down: filling the blank is a worse export than writing into the signed
 * file, and it is very much better than no export at all.
 */
export async function getNavmc10132Base(
  docId: string = WORKING_COPY_DOC_ID,
): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  try {
    const record = await fileGet(baseFileId(docId));
    if (!record) return null;
    return { bytes: new Uint8Array(record.bytes), fileName: record.fileName };
  } catch (error) {
    console.error('NAVMC 10132 base file read failed, falling back to the blank:', error);
    return null;
  }
}

/** Drops the base, so exports go back to filling the blank. */
export async function clearNavmc10132Base(
  docId: string = WORKING_COPY_DOC_ID,
): Promise<void> {
  try {
    await fileDelete(baseFileId(docId));
  } catch (error) {
    console.error('NAVMC 10132 base file delete failed:', error);
  }
}
