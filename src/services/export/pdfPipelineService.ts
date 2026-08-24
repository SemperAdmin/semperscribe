import { ParagraphData, FormData } from '@/types';
import { DOCUMENT_TYPES, PdfPipeline } from '@/lib/schemas';
import type { CoordinationPageData } from '@/services/pdf/coordinationPageGenerator';
import { Navmc11811Data } from '@/types/navmc';
import { mergeAdminSubsections } from '@/lib/naval-format-utils';

// Generators are imported dynamically inside each pipeline so the PDF
// engines (@react-pdf/renderer, pdf-lib, the seal data) stay out of the
// first-load bundle and load on the first preview/export instead.

interface PdfBuildContext {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList?: string[];
}

function buildNavmc10274Data(ctx: PdfBuildContext) {
  return {
    actionNo: ctx.formData.actionNo || '',
    ssic: ctx.formData.ssic || '',
    date: ctx.formData.date || '',
    from: ctx.formData.from || '',
    orgStation: ctx.formData.orgStation || '',
    to: ctx.formData.to || '',
    via: ctx.vias.filter(v => v.trim()).join('\n'),
    subject: ctx.formData.subj || '',
    reference: (() => {
      const startCode = (ctx.formData.startingReferenceLevel || 'a').charCodeAt(0);
      return ctx.references
        .filter(r => r.trim())
        .map((r, i) => `(${String.fromCharCode(startCode + i)}) ${r}`)
        .join('\n');
    })(),
    enclosure: (() => {
      const startNum = parseInt(ctx.formData.startingEnclosureNumber || '1', 10);
      return ctx.enclosures
        .filter(e => e.trim())
        .map((e, i) => `(${startNum + i}) ${e}`)
        .join('\n');
    })(),
    supplementalInfo: ctx.paragraphs.map(p => p.content).join('\n'),
    supplementalInfoParagraphs: ctx.paragraphs,
    copyTo: ctx.copyTos.filter(c => c.trim()).join('\n'),
    signature: ctx.formData.sig || '',
  };
}

function buildNavmc11811Data(ctx: PdfBuildContext): Navmc11811Data {
  return {
    name: ctx.formData.name || '',
    edipi: ctx.formData.edipi || '',
    remarksLeft: ctx.formData.remarksLeft || '',
    remarksRight: ctx.formData.remarksRight || '',
  };
}

async function generateStandardPdf(ctx: PdfBuildContext): Promise<Blob> {
  const { generateBasePDFBlob } = await import('@/lib/pdf-generator');
  const paragraphsToRender = mergeAdminSubsections(ctx.paragraphs, ctx.formData.adminSubsections);
  return generateBasePDFBlob(
    ctx.formData,
    ctx.vias,
    ctx.references,
    ctx.enclosures,
    ctx.copyTos,
    paragraphsToRender,
    ctx.distList || []
  );
}

async function generateNavmc10274Pdf(ctx: PdfBuildContext): Promise<Blob> {
  const { generateNavmc10274 } = await import('@/services/pdf/navmc10274Generator');
  const data = buildNavmc10274Data(ctx);
  const pdfBytes = await generateNavmc10274(data);
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

async function generateNavmc11811Pdf(ctx: PdfBuildContext): Promise<Blob> {
  const { generateNavmc11811 } = await import('@/services/pdf/navmc11811Generator');
  const data = buildNavmc11811Data(ctx);
  const pdfBytes = await generateNavmc11811(data);
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

function buildCoordinationPageData(ctx: PdfBuildContext): CoordinationPageData {
  return {
    documentType: ctx.formData.documentType,
    subj: ctx.formData.subj || '',
    coordinatingOffices: ctx.formData.coordinatingOffices as CoordinationPageData['coordinatingOffices'],
    remarks: ctx.formData.remarks,
    bodyFont: ctx.formData.bodyFont as CoordinationPageData['bodyFont'],
  };
}

async function generateCoordinationPagePdf(ctx: PdfBuildContext): Promise<Blob> {
  const { createCoordinationPagePdf } = await import('@/services/pdf/coordinationPageGenerator');
  const data = buildCoordinationPageData(ctx);
  const pdfBytes = await createCoordinationPagePdf(data);
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * NAVMC 10132 fallback notice page.
 *
 * A WORKING stub, deliberately not a throwing one. The live preview calls
 * generatePdfForDocType on a timer, so a throwing PIPELINE_MAP entry crashes
 * the preview pane rather than showing a message. The 10922 build hit that
 * live. Since Phase 5 this is the FALLBACK: the AcroForm fill is the primary
 * path and this page shows only when the blank cannot be fetched or filled.
 */
async function generateNavmc10132Placeholder(): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const lines: [string, typeof bold, number][] = [
    ['NAVMC 10132 (Unit Punishment Book)', bold, 16],
    ['', body, 12],
    ['The official blank could not be filled.', body, 12],
    ['', body, 12],
    ['This page stands in for the official form because the fill that', body, 11],
    ['writes your data onto the bundled blank did not complete. Your', body, 11],
    ['entries are not lost - they are still in the form on screen.', body, 11],
    ['', body, 12],
    ['The browser console carries the underlying error.', body, 11],
  ];
  let y = 700;
  for (const [text, font, size] of lines) {
    if (text) page.drawText(text, { x: 72, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 8;
  }
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

const PIPELINE_MAP: Record<PdfPipeline, (ctx: PdfBuildContext) => Promise<Blob>> = {
  standard: generateStandardPdf,
  navmc10274: generateNavmc10274Pdf,
  navmc11811: generateNavmc11811Pdf,
  // NAVMC 10922 flattened redraw (build plan Phase 5, programmatic
  // variant). Serves the live preview, the START reason (unbindable in
  // the XFA datasets), and signature/enclosure exports. Plain PDF
  // exports still route through xfa-form-fill onto the official
  // editable form before this map is consulted.
  navmc10922: async (ctx) => {
    const { generateNavmc10922 } = await import('@/services/pdf/navmc10922Generator');
    const bytes = await generateNavmc10922(ctx.formData);
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  },
  // NAVMC 10132 fills the official AcroForm blank. The live preview consumes
  // this map on a timer, so a failure must degrade to the placeholder notice
  // page rather than throw and take the preview pane down with it.
  navmc10132: async (ctx) => {
    try {
      const { exportNavmc10132Form } = await import('@/lib/navmc10132-export');
      return await exportNavmc10132Form(ctx.formData);
    } catch (error) {
      console.error('NAVMC 10132 AcroForm fill failed, falling back to the notice page:', error);
      return generateNavmc10132Placeholder();
    }
  },
  amhs: async () => new Blob([], { type: 'text/plain' }), // AMHS doesn't use PDF
  'coordination-page': generateCoordinationPagePdf,
};

/**
 * Generates a PDF blob for any document type using the pipeline
 * configured in its DocumentFeatures.
 */
export async function generatePdfForDocType(ctx: PdfBuildContext): Promise<Blob> {
  const docType = ctx.formData.documentType;
  const features = DOCUMENT_TYPES[docType]?.features;
  const pipeline: PdfPipeline = features?.pdfPipeline || 'standard';
  const generator = PIPELINE_MAP[pipeline];
  return generator(ctx);
}
