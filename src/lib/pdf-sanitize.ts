/**
 * P4-4 (remediation 2026-09): action stripping for uploaded PDFs.
 *
 * pdf-lib's copyPages copies a page's whole object graph, so a
 * page-level /AA (additional actions) dictionary carrying JavaScript,
 * and annotations whose /A or /AA action launches a program, runs
 * script, submits a form or opens a remote file, ride along into the
 * export. Every uploaded document goes through sanitizePdfActions
 * before its pages are copied: the catalog's /OpenAction and /AA go,
 * every page's /AA goes, and an annotation whose action subtype is
 * one of the dangerous set loses its /A (the annotation itself stays,
 * so the page looks the same). A plain https /URI link survives.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';

/** Action subtypes never carried into an export (ISO 32000-1 table 198). */
const DANGEROUS_ACTIONS = new Set([
  'Launch',
  'JavaScript',
  'SubmitForm',
  'ImportData',
  'GoToR',
  'GoToE',
]);

const A = PDFName.of('A');
const AA = PDFName.of('AA');
const S = PDFName.of('S');
const URI = PDFName.of('URI');
const NEXT = PDFName.of('Next');

function stringValue(value: unknown): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return null;
}

/** True when this action, or any action chained from it via /Next, is dangerous. */
function isDangerousAction(action: unknown, seen = new Set<PDFDict>()): boolean {
  if (!(action instanceof PDFDict) || seen.has(action)) return false;
  seen.add(action);
  const subtype = action.lookup(S);
  const name = subtype instanceof PDFName ? subtype.decodeText() : '';
  if (DANGEROUS_ACTIONS.has(name)) return true;
  if (name === 'URI') {
    const uri = stringValue(action.lookup(URI));
    if (uri && /^\s*javascript:/i.test(uri)) return true;
  }
  const next = action.lookup(NEXT);
  if (next instanceof PDFDict) return isDangerousAction(next, seen);
  if (next instanceof PDFArray) {
    for (let i = 0; i < next.size(); i++) {
      if (isDangerousAction(next.lookup(i), seen)) return true;
    }
  }
  return false;
}

/**
 * Strips document-, page- and annotation-level actions from a loaded
 * document in place. Returns the number of keys removed, so a caller
 * can log or test that the document carried something.
 */
export function sanitizePdfActions(doc: PDFDocument): number {
  let removed = 0;
  const openAction = PDFName.of('OpenAction');
  if (doc.catalog.has(openAction)) {
    doc.catalog.delete(openAction);
    removed += 1;
  }
  if (doc.catalog.has(AA)) {
    doc.catalog.delete(AA);
    removed += 1;
  }

  for (const page of doc.getPages()) {
    if (page.node.has(AA)) {
      page.node.delete(AA);
      removed += 1;
    }
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      if (annot.has(AA)) {
        // Every /AA trigger (focus, blur, page open, calculate) is script.
        annot.delete(AA);
        removed += 1;
      }
      if (isDangerousAction(annot.lookup(A))) {
        annot.delete(A);
        removed += 1;
      }
    }
  }
  return removed;
}
