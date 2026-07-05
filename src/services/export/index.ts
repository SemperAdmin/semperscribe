import { FormData } from '@/types';

export type ExportFormat = 'pdf' | 'docx';

export async function exportDocument(
  documentType: string,
  formData: FormData,
  format: ExportFormat
): Promise<Buffer | Blob> {
  // Route I-Type exports. Generators are imported on demand so the
  // PDF/DOCX engines stay out of the first-load bundle.
  if (documentType === 'i-type') {
    if (format === 'pdf') {
      const { generateITypePDF } = await import('@/services/pdf/i-type-export');
      return generateITypePDF(formData as any);
    } else if (format === 'docx') {
      const { generateITypeDocx } = await import('@/services/docx/i-type-docx');
      return generateITypeDocx(formData as any);
    }
    throw new Error(`Unsupported export format for I-Type: ${format}`);
  }

  // Route other document types (existing logic preserved)
  // Add calls to existing PDF/DOCX handlers for basic, mco, endorsement, etc.

  throw new Error(`Export not supported for document type: ${documentType}`);
}

export async function downloadDocument(
  documentType: string,
  formData: FormData,
  format: ExportFormat,
  filename?: string
): Promise<void> {
  try {
    const result = await exportDocument(documentType, formData, format);
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const ext = format;
    const defaultName = `${documentType}-${Date.now()}.${ext}`;

    let blob: Blob;
    if (result instanceof Blob) {
      blob = result;
    } else {
      const uint8Array = new Uint8Array(result);
      blob = new Blob([uint8Array], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`Failed to download ${documentType} as ${format}:`, error);
    throw error;
  }
}

export async function getAvailableExportFormats(documentType: string): Promise<ExportFormat[]> {
  const supportedFormats: Record<string, ExportFormat[]> = {
    'i-type': ['pdf', 'docx'],
    'basic': ['pdf', 'docx'],
    'mco': ['pdf', 'docx'],
  };

  return supportedFormats[documentType] || [];
}
