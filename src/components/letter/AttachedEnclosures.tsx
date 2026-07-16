'use client';

/**
 * P3.6 (DONDOCS_PARITY_PLAN) - attached PDF enclosures panel.
 * File picker, ordered list with move/remove, cover-page toggle.
 * Attachments are session-scoped in v1 and merge into PDF exports
 * only - the note in the panel says exactly this so nobody is
 * surprised by a .nldp or DOCX without them.
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileUp, ChevronUp, ChevronDown, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnclosureAttachment, fileToAttachment } from '@/lib/enclosure-attachments';

interface AttachedEnclosuresProps {
  attachments: EnclosureAttachment[];
  onAdd: (attachment: EnclosureAttachment) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  coverPages: boolean;
  onCoverPagesChange: (value: boolean) => void;
  startingNumber: number;
}

export function AttachedEnclosures({
  attachments,
  onAdd,
  onRemove,
  onMove,
  coverPages,
  onCoverPagesChange,
  startingNumber,
}: AttachedEnclosuresProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        onAdd(await fileToAttachment(file));
      } catch (error) {
        toast({ title: 'Attachment Rejected', description: (error as Error).message, variant: 'destructive' });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Attached PDF enclosures</p>
          <p className="text-xs text-muted-foreground">
            Merge into the PDF export in this order, after the letter.
            Session only - re-attach after a reload. Not included in DOCX, .nldp, or share links.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="w-3.5 h-3.5 mr-1.5" /> Attach PDF...
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
          aria-label="Attach PDF enclosures"
        />
      </div>

      {attachments.length > 0 && (
        <>
          <div className="space-y-1">
            {attachments.map((attachment, index) => (
              <div key={attachment.id} className="flex items-center gap-2 rounded border border-border bg-background/50 px-2 py-1.5">
                <span className="flex h-7 w-10 items-center justify-center shrink-0 rounded bg-secondary text-secondary-foreground text-xs font-medium">
                  ({startingNumber + index})
                </span>
                <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 text-sm truncate" title={attachment.fileName}>
                  {attachment.title}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {(attachment.bytes.byteLength / 1024).toFixed(0)} KB
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(index, 1)} disabled={index === attachments.length - 1} aria-label="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemove(attachment.id)} aria-label="Remove attachment">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="encl-cover-pages" checked={coverPages} onCheckedChange={onCoverPagesChange} />
            <Label htmlFor="encl-cover-pages" className="cursor-pointer text-xs">
              Generate a cover page before each attachment
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
