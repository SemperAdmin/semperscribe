/**
 * XFA (docs/AA_FORMS_TEMPLATE_PLAN.md addendum) - export onto the
 * OFFICIAL form. NAVMC 10274 and NAVMC 118(11) are dynamic LiveCycle
 * XFA forms: the page content is a "Please wait" shell and Adobe
 * renders the real form from embedded XML (template + datasets).
 * Replacing the `datasets` stream with our data makes Adobe show the
 * official form, filled, with EDITABLE fields - not a flattened
 * redraw. Prototype gated 2026-07-17: Stephen verified both filled
 * forms render and edit in Adobe.
 *
 * Format constraints callers must respect (they are Adobe's, not ours):
 * - The output renders ONLY in Adobe Acrobat/Reader. Chrome/Edge show
 *   the shell page, exactly like the blank official forms.
 * - Appended pages are ignored by the XFA renderer, so enclosure
 *   attachments and drawn signature fields CANNOT ride along - those
 *   route to the flattened export path.
 */

import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString } from 'pdf-lib';
import { FormData, ParagraphData } from '@/types';
import { generateCitation } from '@/lib/citation';
import { indexToRefLetter } from '@/lib/letter-validators';
import { resolvePublicPath } from '@/lib/path-utils';

/** XML-escape plus XFA's CR line separator (&#xD;). */
function xfaEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\n/g, '&#xD;');
}

function tag(name: string, value: string): string {
  const v = value.trim();
  return v ? `<${name}>${xfaEscape(v)}</${name}>` : `<${name}/>`;
}

const XFA_WRAP = (inner: string) =>
  `<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><form1>${inner}</form1></xfa:data></xfa:datasets>`;

export interface FormSlices {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
}

/**
 * NAVMC 10274 datasets XML - the inverse of the template converter:
 * list prefixes are re-added (the paper form's boxes hold full text)
 * and paragraph citations are reconstructed with the SAME citation
 * engine the flattened renderer uses, so both exports number alike.
 */
export function buildNavmc10274Xml(slices: FormSlices): string {
  const { formData, vias, references, enclosures, copyTos, paragraphs } = slices;

  const viaList = vias.filter(v => v.trim());
  const viaText = viaList.length <= 1
    ? (viaList[0] ?? '')
    : viaList.map((v, i) => `(${i + 1}) ${v}`).join('\n');

  const refStart = (formData.startingReferenceLevel || 'a').charCodeAt(0) - 96;
  const refText = references.filter(r => r.trim())
    .map((r, i) => `(${indexToRefLetter(refStart + i)}) ${r}`).join('\n');

  const enclStart = parseInt(formData.startingEnclosureNumber || '1', 10);
  const enclText = enclosures.filter(e => e.trim())
    .map((e, i) => `(${enclStart + i}) ${e}`).join('\n');

  const copyText = copyTos.filter(c => c.trim()).join('\n');

  const supp = paragraphs
    .filter(p => p.content.trim())
    .map((p, i) => {
      const { citation } = generateCitation(p, i, paragraphs);
      const indent = '    '.repeat(Math.max(0, (p.level || 1) - 1));
      return `${indent}${citation}  ${p.content}`;
    })
    .join('\n\n');

  return XFA_WRAP([
    tag('Date', formData.date || ''),
    tag('ActNum', formData.actionNo || ''),
    tag('FileNum', formData.ssic || ''),
    tag('NameFrom', formData.from || ''),
    tag('Via1', viaText),
    tag('OrgStat', formData.orgStation || ''),
    tag('AddrTo', formData.to || ''),
    tag('NatOfAct', formData.subj || ''),
    tag('CopyTo', copyText),
    tag('RefAuth', refText),
    tag('Encl1', enclText),
    tag('SuppInfo', supp),
    tag('ProcAct', ''),
  ].join(''));
}

/** NAVMC 118(11) datasets XML. Header date/signature boxes stay empty -
 * they are signed by hand. */
export function buildNavmc11811Xml(formData: FormData): string {
  return XFA_WRAP([
    tag('Date1', ''),
    tag('Date2', ''),
    tag('Date3', ''),
    tag('NameLFM', (formData.name as string) || ''),
    tag('EDIPI', (formData.edipi as string) || ''),
    tag('Remarks1', (formData.remarksLeft as string) || ''),
    tag('Remarks2', (formData.remarksRight as string) || ''),
    tag('_11', ''),
  ].join(''));
}

function xfaEntryName(obj: unknown): string {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
  return '';
}

/**
 * Copies any byte source into THIS realm's Uint8Array.
 *
 * pdf-lib gates on `instanceof Uint8Array` in two places (PDFDocument
 * .load and typedArrayFor inside flateStream). Bytes born in another
 * JavaScript realm - a Node Buffer from readFileSync, or jsdom's
 * TextEncoder output under vitest - fail that check and pdf-lib then
 * misroutes them (NaN type, or .charCodeAt on a typed array). Copying
 * through the local constructor makes the check true by construction.
 * Duck-typed on purpose: instanceof is the very thing failing.
 */
function toLocalBytes(source: ArrayBuffer | Uint8Array): Uint8Array {
  const view = source as { byteOffset?: number; byteLength: number; buffer?: ArrayBufferLike };
  if (view.buffer !== undefined && view.byteOffset !== undefined) {
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  return new Uint8Array(source as ArrayBuffer);
}

/**
 * Replaces the `datasets` stream inside a dynamic XFA PDF. Everything
 * else - template, page shell, NeedsRendering - stays byte-identical,
 * which is what keeps the form official and editable.
 */
export async function fillXfaDatasets(baseBytes: ArrayBuffer | Uint8Array, datasetsXml: string): Promise<Uint8Array> {
  // The bundled blanks are pre-decrypted/normalized (pikepdf rewrite -
  // the same operation that produced the Adobe-validated prototypes).
  // ignoreEncryption is belt-and-braces for a stray rights-enabled base.
  const doc = await PDFDocument.load(toLocalBytes(baseBytes), { updateMetadata: false, ignoreEncryption: true });
  // Typed lookup THROWS on absence - probe untyped so a non-form PDF
  // gets the honest error, not pdf-lib's assertion.
  const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'));
  const xfa = acroForm instanceof PDFDict ? acroForm.lookup(PDFName.of('XFA')) : undefined;
  if (!(xfa instanceof PDFArray)) {
    throw new Error('Base form carries no XFA array - not a LiveCycle form.');
  }
  let replaced = false;
  for (let i = 0; i < xfa.size() - 1; i += 2) {
    if (xfaEntryName(xfa.get(i)) === 'datasets') {
      const stream = doc.context.flateStream(toLocalBytes(new TextEncoder().encode(datasetsXml)));
      xfa.set(i + 1, doc.context.register(stream));
      replaced = true;
      break;
    }
  }
  if (!replaced) throw new Error('XFA datasets stream not found in the base form.');
  return doc.save({ useObjectStreams: false });
}

/** Which document types have an official XFA base form. */
export function officialFormPath(documentType: string): string | null {
  if (documentType === 'aa-form') return resolvePublicPath('forms/navmc-10274-blank.pdf');
  if (documentType === 'page11') return resolvePublicPath('forms/navmc-118-11-blank.pdf');
  return null;
}

/** Fetches the bundled blank and fills it from the document state. */
export async function exportOfficialForm(slices: FormSlices): Promise<Blob> {
  const path = officialFormPath(slices.formData.documentType);
  if (!path) throw new Error(`No official form for type "${slices.formData.documentType}".`);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load the blank form (${res.status}).`);
  const base = await res.arrayBuffer();
  const xml = slices.formData.documentType === 'aa-form'
    ? buildNavmc10274Xml(slices)
    : buildNavmc11811Xml(slices.formData);
  const bytes = await fillXfaDatasets(base, xml);
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
