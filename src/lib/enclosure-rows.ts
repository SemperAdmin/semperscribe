/**
 * ENC (docs/ENCLOSURE_UPLOAD_PLAN.md) - the enclosure row model and the
 * merge schedule. Pure data helpers with no pdf-lib dependency: the
 * page and the section components import these statically, while the
 * merge engine in enclosure-attachments.ts (which needs pdf-lib) is
 * loaded on demand at export time.
 */

import { MAX_ENCLOSURE_FILE_BYTES } from '@/lib/document-library';

export type EnclosureMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface EnclosureAttachment {
  id: string;
  fileName: string;
  /** Title used on the enclosure line and cover page. */
  title: string;
  mimeType: EnclosureMimeType;
  /** Raw file bytes. */
  bytes: ArrayBuffer;
}

/**
 * One typed enclosure line, optionally bound to a file. Position in
 * the row array determines the enclosure number.
 */
export interface EnclosureRow {
  /** Stable key - survives reorder and delete. */
  key: string;
  /** The enclosure line text. */
  title: string;
  /** Bound file id, or undefined for a physical enclosure. */
  fileId?: string;
}

/** A file scheduled into the merge, carrying its row-derived number. */
export interface MergeItem {
  number: number;
  attachment: EnclosureAttachment;
}

let rowCounter = 0;
/** A fresh unbound row with a stable key. */
export function newRow(title = ''): EnclosureRow {
  rowCounter += 1;
  return { key: `row-${Date.now()}-${rowCounter}`, title };
}

/**
 * Reconciles a plain title list onto existing rows, POSITION-based:
 * row i keeps its key and file binding, its title becomes titles[i].
 * Extra titles become fresh unbound rows; extra rows drop (their
 * bindings with them). This is the adapter that lets every legacy
 * `setEnclosures(string[])` caller (undo, find-replace, import,
 * recovery) keep working against the row model. Known limit, recorded
 * in the plan: a caller that REMOVES a bound row through this path
 * drops the binding, and undo restores the title only.
 */
export function reconcileRows(prev: EnclosureRow[], titles: string[]): EnclosureRow[] {
  return titles.map((title, i) =>
    i < prev.length
      ? (prev[i].title === title ? prev[i] : { ...prev[i], title })
      : newRow(title),
  );
}

/**
 * Derives the merge schedule from the rows - the ONLY place enclosure
 * numbers attach to files. Row i carries number startingNumber + i.
 * Rows without a bound file consume their number and contribute
 * nothing (a physical enclosure sent separately).
 */
export function computeMergeItems(
  rows: EnclosureRow[],
  files: ReadonlyMap<string, EnclosureAttachment>,
  startingNumber: number,
): MergeItem[] {
  const items: MergeItem[] = [];
  rows.forEach((row, index) => {
    if (!row.fileId) return;
    const attachment = files.get(row.fileId);
    if (attachment) items.push({ number: startingNumber + index, attachment });
  });
  return items;
}

function detectMime(head: Uint8Array): EnclosureMimeType | null {
  if (head.length >= 5 && String.fromCharCode(...head.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  return null;
}

/**
 * Reads a File into an attachment. Accepts PDF, JPG, PNG by magic
 * bytes; refuses everything else and files over the size cap.
 */
export async function fileToAttachment(file: File): Promise<EnclosureAttachment> {
  if (file.size > MAX_ENCLOSURE_FILE_BYTES) {
    const mb = (MAX_ENCLOSURE_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The per-file limit is ${mb} MB.`);
  }
  const bytes = await file.arrayBuffer();
  const mimeType = detectMime(new Uint8Array(bytes.slice(0, 8)));
  if (!mimeType) {
    throw new Error(`"${file.name}" is not a PDF, JPG, or PNG. For Word documents, save as PDF first.`);
  }
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    title: file.name.replace(/\.(pdf|jpe?g|png)$/i, ''),
    mimeType,
    bytes,
  };
}
