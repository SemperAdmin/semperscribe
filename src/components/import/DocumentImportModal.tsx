'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, FileUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ExtractedFieldName,
  ExtractionResult,
} from '@/services/import/extractionTypes';
import { DocTypeDetection } from '@/services/import/docTypeDetector';

/** Types the import pipeline supports in v1 (the standard-letter family). */
const IMPORTABLE_TYPES: { id: string; label: string }[] = [
  { id: 'basic', label: 'Basic Letter' },
  { id: 'mfr', label: 'Memorandum for the Record' },
  { id: 'letterhead-memo', label: 'Letterhead Memo' },
  { id: 'from-to-memo', label: 'From-To Memo' },
];

const FIELD_ROWS: { name: ExtractedFieldName; label: string }[] = [
  { name: 'ssic', label: 'SSIC' },
  { name: 'originatorCode', label: 'Originator Code' },
  { name: 'date', label: 'Date' },
  { name: 'from', label: 'From' },
  { name: 'to', label: 'To' },
  { name: 'subj', label: 'Subject' },
  { name: 'line1', label: 'Unit Name' },
  { name: 'line1b', label: 'Unit Sub-Name' },
  { name: 'line2', label: 'Address' },
  { name: 'line3', label: 'City, State Zip' },
  { name: 'sig', label: 'Signature Name' },
  { name: 'delegationText', label: 'Delegation Text' },
];

const LIST_ROWS: { key: ListKey; label: string }[] = [
  { key: 'vias', label: 'Via' },
  { key: 'references', label: 'References' },
  { key: 'enclosures', label: 'Enclosures' },
  { key: 'copyTos', label: 'Copy To' },
  { key: 'distList', label: 'Distribution' },
];

type ListKey = 'vias' | 'references' | 'enclosures' | 'copyTos' | 'distList';

interface DocumentImportModalProps {
  open: boolean;
  fileName: string;
  result: ExtractionResult | null;
  detection: DocTypeDetection | null;
  onChangeDocumentType: (documentType: string) => void;
  onConfirm: (edited: ExtractionResult) => void;
  onCancel: () => void;
}

interface EditableState {
  fields: Partial<Record<ExtractedFieldName, string>>;
  lists: Record<ListKey, string>;
}

function stateFromResult(result: ExtractionResult): EditableState {
  const fields: EditableState['fields'] = {};
  for (const { name } of FIELD_ROWS) {
    const field = result.fields[name];
    if (field) fields[name] = field.value;
  }
  return {
    fields,
    lists: {
      vias: result.vias.join('\n'),
      references: result.references.join('\n'),
      enclosures: result.enclosures.join('\n'),
      copyTos: result.copyTos.join('\n'),
      distList: result.distList.join('\n'),
    },
  };
}

function splitList(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export function DocumentImportModal({
  open,
  fileName,
  result,
  detection,
  onChangeDocumentType,
  onConfirm,
  onCancel,
}: DocumentImportModalProps) {
  // Lazy initializer covers the first mount; the effect resyncs when the
  // result changes (new import, or a document-type override re-parse).
  const [edited, setEdited] = useState<EditableState | null>(
    () => (result ? stateFromResult(result) : null),
  );

  useEffect(() => {
    setEdited(result ? stateFromResult(result) : null);
  }, [result]);

  const lowConfidence = useMemo(() => {
    const set = new Set<ExtractedFieldName>();
    if (result) {
      for (const [name, field] of Object.entries(result.fields)) {
        if (field?.confidence === 'low') set.add(name as ExtractedFieldName);
      }
    }
    return set;
  }, [result]);

  if (!result || !edited) return null;

  const setField = (name: ExtractedFieldName, value: string) =>
    setEdited(prev => (prev ? { ...prev, fields: { ...prev.fields, [name]: value } } : prev));

  const setList = (key: ListKey, value: string) =>
    setEdited(prev => (prev ? { ...prev, lists: { ...prev.lists, [key]: value } } : prev));

  const handleConfirm = () => {
    const fields: ExtractionResult['fields'] = {};
    // Non-visual fields recovered by the parser (e.g. headerType) pass
    // through untouched; visual fields take the user's edited values.
    for (const [name, field] of Object.entries(result.fields)) {
      if (field && !FIELD_ROWS.some(row => row.name === name)) {
        fields[name as ExtractedFieldName] = field;
      }
    }
    for (const { name } of FIELD_ROWS) {
      const value = edited.fields[name]?.trim();
      if (value) {
        fields[name] = {
          value,
          confidence: 'high',
          sourceLines: result.fields[name]?.sourceLines ?? [],
        };
      }
    }
    onConfirm({
      ...result,
      fields,
      vias: splitList(edited.lists.vias),
      references: splitList(edited.lists.references),
      enclosures: splitList(edited.lists.enclosures),
      copyTos: splitList(edited.lists.copyTos),
      distList: splitList(edited.lists.distList),
    });
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            Review Imported Document
          </DialogTitle>
          <DialogDescription>
            Extracted from <span className="font-medium">{fileName}</span>. Check the fields below —
            values the parser was unsure about are flagged. Everything stays editable after import.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4 -mr-2">
          <div className="space-y-5 pb-2">
            {(result.warnings.length > 0) && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                {result.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={result.documentType} onValueChange={onChangeDocumentType}>
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTABLE_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {detection && detection.confidence === 'low' && (
                <p className="text-xs text-muted-foreground">
                  Detection was uncertain — verify the type; changing it re-reads the document.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_ROWS.map(({ name, label }) => {
                const flagged = lowConfidence.has(name) && edited.fields[name] === result.fields[name]?.value;
                return (
                  <div key={name} className="space-y-1">
                    <Label htmlFor={`import-${name}`} className="flex items-center gap-2 text-xs">
                      {label}
                      {flagged && (
                        <Badge variant="outline" className="border-amber-500/60 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0">
                          check
                        </Badge>
                      )}
                    </Label>
                    <Input
                      id={`import-${name}`}
                      value={edited.fields[name] ?? ''}
                      onChange={e => setField(name, e.target.value)}
                      className={cn(flagged && 'border-amber-500/60 focus-visible:ring-amber-500/40')}
                    />
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LIST_ROWS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`import-${key}`} className="text-xs">
                    {label} <span className="text-muted-foreground">(one per line)</span>
                  </Label>
                  <Textarea
                    id={`import-${key}`}
                    value={edited.lists[key]}
                    onChange={e => setList(key, e.target.value)}
                    rows={Math.max(2, Math.min(4, edited.lists[key].split('\n').length))}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Paragraphs ({result.paragraphs.length}) — edit in the main editor after import</Label>
              <div className="rounded-md border border-border bg-background/50 p-3 space-y-2 max-h-48 overflow-y-auto">
                {result.paragraphs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No body paragraphs were found.</p>
                ) : (
                  result.paragraphs.map(p => (
                    <p
                      key={p.id}
                      className="text-xs text-foreground/90"
                      style={{ paddingLeft: `${(p.level - 1) * 16}px` }}
                    >
                      {p.content || <span className="text-muted-foreground italic">(empty)</span>}
                    </p>
                  ))
                )}
              </div>
            </div>

            {result.unmatchedText.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className="w-3.5 h-3.5" />
                  Unmatched text ({result.unmatchedText.length} {result.unmatchedText.length === 1 ? 'line' : 'lines'} the parser could not place)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-md border border-border bg-background/50 p-3 max-h-32 overflow-y-auto">
                    {result.unmatchedText.map((line, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono">{line}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2 border-t border-border pt-3">
          <p className="text-xs text-destructive flex items-center gap-1.5 sm:mr-auto">
            <AlertTriangle className="w-3.5 h-3.5" />
            Importing replaces your current document.
          </p>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Import Document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
