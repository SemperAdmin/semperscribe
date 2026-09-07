/**
 * The uploaded signed UPB, kept so every later export writes into IT rather
 * than into a fresh blank.
 *
 * WHY THIS IS NOT ON `formData`. The file is five megabytes. Document state
 * is JSON-serialized on every autosave and into every `.nldp`, so putting
 * the bytes there would stringify five megabytes on a timer and again on
 * every save. The bytes live in IndexedDB and document state carries only
 * the load report that says one exists, and the ID of the file it is.
 *
 * WHY IT REUSES THE ENCLOSURE FILE STORE. `document-library.ts` already
 * keeps binary blobs keyed by owning document, with quota handling, a
 * delete-by-owner sweep, a re-parent on Save, and a working-copy id for the
 * pre-save document. A second store would duplicate all of it and would
 * still need its own clear-form hook.
 *
 * ONE BASE PER DOCUMENT, KEYED BY A PER-LOAD ID (audit P6-1). The first
 * version keyed the base to the working-copy id for every document, and the
 * export read it with no id at all. So a signed file loaded for Marine A
 * stayed behind a fresh document for Marine B, whose export was then
 * patched INTO A's signed file; Save could not carry the base (its id was
 * not a bound file id); and Clear Form after Save deleted the saved
 * document's signed file. Now:
 *
 *   - `putNavmc10132Base` mints an id and returns it; the loader records
 *     it on `formData.navmc10132BaseFileId`, so the id travels with the
 *     document through autosave, Save, and `.nldp`.
 *   - `getNavmc10132Base(id)` reads by that id and only that id. No id,
 *     no base: a fresh document fills the blank.
 *   - Ownership starts at the working copy (Clear Form on an unsaved
 *     document sweeps it) and moves to the saved document on Save with the
 *     enclosures (page.tsx puts the id in the re-parent list).
 *   - Loading a second signed file replaces the first: the newer file
 *     CONTAINS every earlier pass, so keeping the old one has no value.
 */

import {
  filePut,
  fileGet,
  fileDelete,
  WORKING_COPY_DOC_ID,
} from '@/lib/document-library';
import type { FormData } from '@/types';

const ID_PREFIX = 'navmc10132-base:';

/** Thrown when the store could not be READ, which is not "no base". */
export class Navmc10132BaseReadError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'Navmc10132BaseReadError';
    this.cause = cause;
  }
}

/**
 * A fresh id, namespaced away from enclosure ids (random uuids) so the two
 * uses of the file store cannot collide. Random rather than derived from
 * the document, because the document has no stable id before Save and a
 * base must never be reachable from a document that did not load it.
 */
function newBaseFileId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${ID_PREFIX}${uuid}`;
}

/** The base id recorded on document state, or null when there is none. */
export function navmc10132BaseFileIdOf(formData: FormData): string | null {
  const id: unknown = formData.navmc10132BaseFileId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Stores the uploaded file as the base for later exports and returns the
 * id to record on the document. `replaces` is the document's previous
 * base, dropped so a second load does not leave the first behind.
 */
export async function putNavmc10132Base(
  bytes: ArrayBuffer,
  fileName: string,
  options: { docId?: string; replaces?: string | null } = {},
): Promise<string> {
  const fileId = newBaseFileId();
  await filePut({
    fileId,
    docId: options.docId ?? WORKING_COPY_DOC_ID,
    fileName,
    title: 'Uploaded signed NAVMC 10132',
    mimeType: 'application/pdf',
    bytes,
    byteLength: bytes.byteLength,
  });
  if (options.replaces && options.replaces !== fileId) {
    await clearNavmc10132Base(options.replaces);
  }
  return fileId;
}

/**
 * The base file's bytes, or null when the document has no base, or its
 * recorded base is not in this browser's store (a `.nldp` from another
 * machine, a swept working copy).
 *
 * THROWS ON A STORE FAILURE (audit P6-6). The first version swallowed an
 * IndexedDB error to null, so the export silently filled the blank, a
 * document with every signature gone, in place of the signed file. That
 * is the one outcome worse than no export: the clerk gets a file that
 * resembles theirs and cannot tell. A read failure is an export failure,
 * and the message says which.
 */
export async function getNavmc10132Base(
  baseFileId: string | null | undefined,
): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  if (!baseFileId) return null;
  let record;
  try {
    record = await fileGet(baseFileId);
  } catch (error) {
    throw new Navmc10132BaseReadError(
      'The signed NAVMC 10132 this document was loaded from could not be read from browser ' +
        `storage, so the export was stopped rather than filled onto a blank: ${
          error instanceof Error ? error.message : String(error)
        }`,
      error,
    );
  }
  if (!record) return null;
  return { bytes: new Uint8Array(record.bytes), fileName: record.fileName };
}

/** Drops one base, so exports of its document go back to filling the blank. */
export async function clearNavmc10132Base(baseFileId: string | null | undefined): Promise<void> {
  if (!baseFileId) return;
  try {
    await fileDelete(baseFileId);
  } catch (error) {
    console.error('NAVMC 10132 base file delete failed:', error);
  }
}
