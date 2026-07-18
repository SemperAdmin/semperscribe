import React, { useRef } from 'react';
import { FileText, Download, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { PageCountIndicator } from './PageCountIndicator';
import { hasFixer } from '@/lib/autofix';

export interface PreviewIssue {
  /** Validator issue id - the autofix registry keys on it (R5). */
  id: string;
  severity: 'block' | 'fail' | 'warn';
  rule: string;
  detail: string;
  citation: string;
}

interface LivePreviewProps {
  /** Phase 2 validator issues rendered inline above the preview. */
  issues?: PreviewIssue[];
  className?: string;
  previewUrl?: string; // If we have a blob URL
  isLoading?: boolean;
  onUpdatePreview?: () => void;
  documentType?: string;
  /** R12: filename for the Download button (defaults to a sensible name). */
  downloadFileName?: string;
  /** R5: opens the full compliance issue list. */
  onOpenIssues?: () => void;
  /**
   * XFA: the real export. The preview blob is a RENDER, and for the
   * NAVMC forms the real export is a different artifact (the official
   * fillable form) - saving the preview instead handed users a flat
   * copy under the export's own filename. When supplied, Download
   * delegates here so one authority produces every downloaded file.
   */
  onDownloadExport?: () => void;
}

export function LivePreview({ className, previewUrl, isLoading, onUpdatePreview, documentType = 'standard', issues = [], downloadFileName, onOpenIssues, onDownloadExport }: LivePreviewProps) {
  const blocking = issues.filter((i) => i.severity === 'block');
  const failing = issues.filter((i) => i.severity === 'fail');
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
    <aside className={cn("w-[45%] max-w-[900px] min-w-[500px] bg-muted/20 border-l border-border hidden xl:flex flex-col h-full", className)}>
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

      {(blocking.length > 0 || failing.length > 0) && (
        <div
          role="alert"
          className={cn(
            "px-4 py-1.5 text-xs text-white shrink-0 flex items-center justify-between gap-3",
            blocking.length > 0 ? "bg-red-900" : "bg-amber-900",
          )}
          title={[...blocking, ...failing].map((i) => `${i.rule} — ${i.detail} [${i.citation}]`).join('\n')}
        >
          <span className="min-w-0 truncate">
            <span className="font-semibold">
              {blocking.length > 0 ? 'EXPORT BLOCKED: ' : 'Compliance: '}
            </span>
            {[...new Set([...blocking, ...failing].map((i) => i.rule))].slice(0, 2).join(' | ')}
            {(() => {
              const rules = [...new Set([...blocking, ...failing].map((i) => i.rule))];
              return rules.length > 2 ? ` (+${rules.length - 2} more)` : '';
            })()}
          </span>
          {/* R5: the overflow pointer used to say "see Proofread" - a
              different check system that never listed these. This opens
              the real list, with autofix. */}
          {onOpenIssues && (
            <button
              type="button"
              onClick={onOpenIssues}
              className="shrink-0 underline font-semibold hover:no-underline focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
            >
              Review{issues.some((i) => hasFixer(i.id)) ? ' & fix' : ''}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden relative bg-muted/40">
        {/* F5 (SECTION_508_FINDINGS): announce preview state changes */}
        <div aria-live="polite" className="sr-only">
          {isLoading ? 'Updating document preview' : previewUrl ? 'Document preview updated' : 'Preview not available'}
        </div>
        <PageCountIndicator url={previewUrl || null} documentType={documentType} />
        {isLoading ? (
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
