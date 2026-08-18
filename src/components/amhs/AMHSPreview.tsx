import React, { useMemo } from 'react';
import { FormData, AMHSReference } from '@/types';
import { generateFullMessage } from '@/services/amhs/amhsFormatter';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AMHSPreviewProps {
  formData: FormData;
  references: AMHSReference[];
  className?: string;
}

export function AMHSPreview({ formData, references, className }: AMHSPreviewProps) {
  const formattedMessage = useMemo(() => {
    return generateFullMessage(formData, references, formData.amhsPocs || []);
  }, [formData, references]);

  return (
    <aside className={cn("w-[45%] max-w-[900px] min-w-[500px] bg-muted/20 border-l border-border hidden xl:flex flex-col h-full", className)}>
      {/* Header */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <FileText className="w-4 h-4" />
          AMHS Text Preview
        </h3>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden relative bg-zinc-950">
        <div className="h-full w-full overflow-auto native-scroll">
            <div className="p-6">
                <pre className="text-green-400 font-mono text-sm whitespace-pre leading-snug">
                    {formattedMessage}
                </pre>
            </div>
        </div>
      </div>
    </aside>
  );
}
