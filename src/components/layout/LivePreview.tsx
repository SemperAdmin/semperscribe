import React, { useRef } from 'react';
import { Check, FileText, Download, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RequiredFieldStatus } from '@/lib/required-fields';

import { PageCountIndicator } from './PageCountIndicator';

// D.2: the compliance banner moved to the shell so it renders at every
// width. The issue shape it reads keeps its old import path.
export type { PreviewIssue } from './ComplianceBanner';

interface LivePreviewProps {
  className?: string;
  previewUrl?: string; // If we have a blob URL
  isLoading?: boolean;
  onUpdatePreview?: () => void;
  documentType?: string;
  /** R12: filename for the Download button (defaults to a sensible name). */
  downloadFileName?: string;
  /**
   * XFA: the real export. The preview blob is a RENDER, and for the
   * NAVMC forms the real export is a different artifact (the official
   * fillable form) - saving the preview instead handed users a flat
   * copy under the export's own filename. When supplied, Download
   * delegates here so one authority produces every downloaded file.
   */
  onDownloadExport?: () => void;
  /**
   * D.8 (UX audit finding 9): the required fields of the chosen type,
   * supplied only while the document is still untouched. Present means
   * "show the empty state instead of a blank render".
   */
  emptyStateFields?: RequiredFieldStatus[] | null;
}

/**
 * D.8: what the preview is waiting for, in place of a blank rectangle.
 * The field list comes from the document-type definition, so it names
 * the same requirements the compliance banner enforces.
 */
export function PreviewEmptyState({ fields }: { fields: RequiredFieldStatus[] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Fill the header and your letter appears here.</p>
        {/* D.8: text-muted-foreground measures 4.41:1 against the
            preview's muted ground at 12 px, under the 4.5:1 AA floor
            (measured by the axe pass). Foreground clears it. */}
        <p className="mt-1 text-xs text-foreground">This document type needs:</p>
        <ul className="mt-3 space-y-1 text-left text-xs text-foreground">
          {fields.map((field) => (
            <li key={field.name} className="flex items-center gap-2">
              {field.filled ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
              )}
              <span className={cn(field.filled && 'line-through')}>{field.label}</span>
              {field.filled && <span className="sr-only">already filled</span>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-foreground">
          Then write at least one paragraph and type the signature name in the closing block.
        </p>
      </div>
    </div>
  );
}

export function LivePreview({ className, previewUrl, isLoading, onUpdatePreview, documentType = 'standard', downloadFileName, onDownloadExport, emptyStateFields }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // R12 (USER_DRIVEN_ROADMAP): the Print and Download buttons were inert.
  // Print drives the same-origin blob iframe's own print dialog; Download
  // saves the preview blob under the export filename.
  const handlePrint = () => {
    const frame = iframeRef.current;
    if (!frame) return;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    // Export path wins when wired - it owns format routing (official
    // XFA form vs flattened render) and the export gate.
    if (onDownloadExport) {
      onDownloadExport();
      return;
    }
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = downloadFileName || 'SemperScribe_Preview.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <aside aria-label="Live preview" className={cn("w-[45%] max-w-[900px] min-w-[500px] bg-muted/20 border-l border-border hidden xl:flex flex-col h-full", className)}>
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</h3>
        <div className="flex items-center space-x-1">
           {onUpdatePreview && (
             <Button
               variant="ghost"
               size="sm"
               className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2 gap-1.5 mr-2"
               onClick={onUpdatePreview}
               disabled={isLoading}
             >
               <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
               Refresh
             </Button>
           )}
           <Button
             variant="ghost"
             size="icon"
             aria-label="Print preview"
             title="Print"
             className="h-7 w-7 text-muted-foreground hover:text-foreground"
             onClick={handlePrint}
             disabled={!previewUrl || isLoading}
           >
             <Printer className="w-3.5 h-3.5" />
           </Button>
           <Button
             variant="ghost"
             size="icon"
             aria-label="Download preview"
             title="Download PDF"
             className="h-7 w-7 text-muted-foreground hover:text-foreground"
             onClick={handleDownload}
             disabled={!previewUrl || isLoading}
           >
             <Download className="w-3.5 h-3.5" />
           </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-muted/40">
        {/* F5 (SECTION_508_FINDINGS): announce preview state changes */}
        <div aria-live="polite" className="sr-only">
          {isLoading ? 'Updating document preview' : previewUrl ? 'Document preview updated' : 'Preview not available'}
        </div>
        <PageCountIndicator url={previewUrl || null} documentType={documentType} />
        {/* D.8: the untouched document never shows a spinner or a blank
            page - it says what it is waiting for. */}
        {emptyStateFields && emptyStateFields.length > 0 ? (
          <PreviewEmptyState fields={emptyStateFields} />
        ) : isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-xs text-muted-foreground">Generating preview...</p>
            </div>
          </div>
        ) : previewUrl ? (
          <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground/40">
            <div>
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Preview not available</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
