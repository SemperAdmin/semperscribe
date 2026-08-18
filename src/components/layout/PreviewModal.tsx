import React, { useEffect, useRef } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { FormData, AMHSReference } from '@/types';
import { generateFullMessage } from '@/services/amhs/amhsFormatter';

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  // For AMHS preview
  formData?: FormData;
  amhsReferences?: AMHSReference[];
  // For PDF preview
  previewUrl?: string;
  isLoading?: boolean;
  onUpdatePreview?: () => void;
}

export function PreviewModal({
  open,
  onOpenChange,
  documentType,
  formData,
  amhsReferences = [],
  previewUrl,
  isLoading,
  onUpdatePreview,
}: PreviewModalProps) {
  const isAMHS = documentType === 'amhs';
  const hasTriggeredRefresh = useRef(false);

  // Auto-refresh preview when modal opens (for non-AMHS documents)
  // Only trigger once per modal open
  useEffect(() => {
    if (open && !isAMHS && onUpdatePreview && !hasTriggeredRefresh.current) {
      hasTriggeredRefresh.current = true;
      onUpdatePreview();
    }
    // Reset the flag when modal closes
    if (!open) {
      hasTriggeredRefresh.current = false;
    }
  }, [open, isAMHS, onUpdatePreview]);

  // Generate AMHS message preview
  const amhsMessage = React.useMemo(() => {
    if (!isAMHS || !formData) return '';
    return generateFullMessage(formData, amhsReferences, formData.amhsPocs || []);
  }, [isAMHS, formData, amhsReferences]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] p-0 flex flex-col rounded-t-xl"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between shrink-0">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {isAMHS ? 'AMHS Text Preview' : 'Document Preview'}
          </SheetTitle>
          <div className="flex items-center gap-1">
            {!isAMHS && onUpdatePreview && (
              <Button
                size="sm"
                onClick={onUpdatePreview}
                disabled={isLoading}
                className="h-8 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
                {isLoading ? 'Generating...' : 'Refresh'}
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isAMHS ? (
            // AMHS Preview
            <div className="h-full bg-zinc-950">
              <div className="h-full w-full overflow-auto native-scroll">
                <div className="p-4">
                  <pre className="text-green-400 font-mono text-xs whitespace-pre leading-relaxed">
                    {amhsMessage || 'Fill in the form to see preview...'}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            // PDF Preview
            <div className="h-full bg-muted/40 relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-xs text-muted-foreground">Generating preview...</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground/40">
                  <div>
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Preview not available</p>
                    <p className="text-xs mt-1">Click Refresh to generate</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
