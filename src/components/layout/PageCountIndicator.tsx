"use client";

import React from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPdfWorkerSrc } from '@/lib/pdf-worker';

// Dynamically import react-pdf to avoid SSR issues (pdfjs-dist requires Promise.withResolvers)
const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });

// Configure PDF.js worker on client only
if (typeof window !== 'undefined') {
    import("react-pdf").then((pdfjs) => {
        pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
    });
}

interface PageCountIndicatorProps {
  url: string | null;
  documentType: string;
}

export function PageCountIndicator({ url, documentType }: PageCountIndicatorProps) {
  // Page count is keyed on the URL: a new preview resets it to unknown
  // during render, before the invisible Document below reloads and reports.
  const [numPages, setNumPages] = useSyncedState(url, () => null as number | null);

  const isPositionPaper = documentType === 'position-paper';

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (!url || !isPositionPaper) return null;

  let status: 'green' | 'yellow' | 'red' = 'green';
  let message = '1 Page (Preferred)';

  if (numPages === 1) {
    status = 'green';
    message = '1 Page (Preferred)';
  } else if (numPages === 2) {
    status = 'yellow';
    message = '2 Pages (Allowed)';
  } else if (numPages && numPages > 2) {
    status = 'red';
    message = `${numPages} Pages (Over Limit)`;
  }

  return (
    <div className="absolute top-14 right-6 z-10 flex gap-2 pointer-events-none">
      <div className="hidden">
        {/* Invisible Document to count pages */}
        <Document file={url} onLoadSuccess={onDocumentLoadSuccess} />
      </div>
      
      {numPages !== null && (
         <Badge variant="outline" className={cn(
            "bg-background/95 backdrop-blur shadow-md border-2 px-3 py-1.5 flex items-center gap-2 transition-all pointer-events-auto",
            status === 'green' && "border-green-500 text-green-700 dark:text-green-400",
            status === 'yellow' && "border-yellow-500 text-yellow-700 dark:text-yellow-400",
            status === 'red' && "border-destructive text-destructive animate-pulse"
         )}>
            {status === 'green' && <CheckCircle className="w-4 h-4" />}
            {status === 'yellow' && <Info className="w-4 h-4" />}
            {status === 'red' && <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">{message}</span>
         </Badge>
      )}
    </div>
  );
}
