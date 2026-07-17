/**
 * Enclosures Section Component
 *
 * ENC (docs/ENCLOSURE_UPLOAD_PLAN.md): ONE list. Each enclosure row
 * optionally binds an uploaded file (PDF/JPG/PNG). The row's position
 * is its number - the v1 two-list design let the typed lines and the
 * uploads drift apart and then GUESSED the mapping at export.
 * Reordering a row moves its file with it.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Plus, Trash2, AlertTriangle, FileUp, FileText, ChevronUp, ChevronDown, X } from 'lucide-react';
import { FormData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  EnclosureRow,
  EnclosureAttachment,
  fileToAttachment,
} from '@/lib/enclosure-attachments';

interface EnclosuresSectionProps {
  rows: EnclosureRow[];
  /** Row operations - the file binding rides the row. */
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onUpdateTitle: (key: string, title: string) => void;
  onMoveRow: (key: string, direction: -1 | 1) => void;
  /** Clears every row and binding (the "No" radio). */
  onClearRows: () => void;
  /** File binding operations. */
  files: ReadonlyMap<string, EnclosureAttachment>;
  onBindFile: (rowKey: string, attachment: EnclosureAttachment) => void;
  onUnbindFile: (rowKey: string) => void;
  coverPages: boolean;
  onCoverPagesChange: (value: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
}

export function EnclosuresSection({
  rows, onAddRow, onRemoveRow, onUpdateTitle, onMoveRow, onClearRows,
  files, onBindFile, onUnbindFile,
  coverPages, onCoverPagesChange,
  formData, setFormData,
}: EnclosuresSectionProps) {
  const { toast } = useToast();
  const [showEncl, setShowEncl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Row awaiting a file from the (single, shared) picker. */
  const pendingRowKey = useRef<string | null>(null);

  useEffect(() => {
    setShowEncl(rows.some(r => r.title.trim() !== '' || r.fileId));
  }, [rows]);

  const isPositionPaper = formData.documentType === 'position-paper';
  const labelText = isPositionPaper ? 'Tabs' : 'Enclosures';
  const itemLabel = isPositionPaper ? 'Tab' : 'Enclosure';
  const itemPlaceholder = isPositionPaper
    ? 'Enter tab details (e.g., Detailed Financial Analysis)'
    : 'Enter enclosure details (e.g., Training Certificate, Medical Records)';

  const getEnclosureIndicator = (index: number, startingNumber: string): string => {
    if (isPositionPaper) {
      // Tabs use Letters (A, B, C...)
      return String.fromCharCode(65 + index); // 65 is 'A'
    }
    return `(${parseInt(startingNumber || '1', 10) + index})`;
  };

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowEncl(true);
      if (rows.length === 0) onAddRow();
    } else {
      setShowEncl(false);
      onClearRows();
    }
  };

  const generateEnclosureOptions = () => {
    return Array.from({ length: 20 }, (_, i) => {
      const num = i + 1;
      return {
        value: num.toString(),
        label: `Start with enclosure (${num})`,
      };
    });
  };

  const openPickerFor = (rowKey: string) => {
    pendingRowKey.current = rowKey;
    fileInputRef.current?.click();
  };

  const handleFilePicked = async (fileList: FileList | null) => {
    const rowKey = pendingRowKey.current;
    pendingRowKey.current = null;
    if (!fileList || fileList.length === 0 || !rowKey) return;
    try {
      const attachment = await fileToAttachment(fileList[0]);
      onBindFile(rowKey, attachment);
      // A file dropped on an empty row names the row after itself.
      const row = rows.find(r => r.key === rowKey);
      if (row && !row.title.trim()) onUpdateTitle(rowKey, attachment.title);
    } catch (error) {
      toast({ title: 'File Rejected', description: (error as Error).message, variant: 'destructive' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const anyFiles = rows.some(r => r.fileId);

  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <Paperclip className="mr-2 h-5 w-5 text-primary-foreground" />
          {labelText}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup
            defaultValue={showEncl ? 'yes' : 'no'}
            value={showEncl ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="encl-yes" />
              <Label htmlFor="encl-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="encl-no" />
              <Label htmlFor="encl-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {!showEncl && (
          <p className="text-sm text-muted-foreground pt-1">
            Select &quot;Yes&quot; to attach supporting documents (e.g., training certificates, reports).
          </p>
        )}

        {showEncl && (
          <div className="space-y-4 pt-2">
            {formData.documentType === 'endorsement' && (
              <>
                <Alert variant="default" className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold ml-2">Endorsement Enclosure Rules</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 ml-2">
                    Only add NEW enclosures not mentioned in the basic letter or previous endorsements. Continue the numbering sequence from the last enclosure.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Starting Enclosure:</Label>
                  <Select
                    value={formData.startingEnclosureNumber}
                    onValueChange={(val) => setFormData({ ...formData, startingEnclosureNumber: val })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select starting number" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateEnclosureOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-3">
              <Label className="font-semibold mb-2 flex items-center">
                <Paperclip className="mr-2 h-4 w-4" />
                Enter {itemLabel}(s):
              </Label>
              {rows.map((row, index) => {
                const boundFile = row.fileId ? files.get(row.fileId) : undefined;
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex w-full gap-2 items-center">
                      <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                        {getEnclosureIndicator(index, formData.startingEnclosureNumber)}
                      </span>
                      <Input
                        className="flex-1 border-input focus-visible:ring-primary"
                        type="text"
                        placeholder={itemPlaceholder}
                        value={row.title}
                        onChange={(e) => onUpdateTitle(row.key, e.target.value)}
                        aria-label={`${itemLabel} ${getEnclosureIndicator(index, formData.startingEnclosureNumber)}`}
                      />
                      {!isPositionPaper && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => openPickerFor(row.key)}
                          title={boundFile ? 'Replace attached file' : 'Attach file (PDF, JPG, PNG)'}
                          aria-label={boundFile ? `Replace file for ${itemLabel} ${index + 1}` : `Attach file to ${itemLabel} ${index + 1}`}
                        >
                          <FileUp className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-9 w-9"
                        onClick={() => onMoveRow(row.key, -1)}
                        disabled={index === 0}
                        title="Move up"
                        aria-label={`Move ${itemLabel} ${index + 1} up`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-9 w-9"
                        onClick={() => onMoveRow(row.key, 1)}
                        disabled={index === rows.length - 1}
                        title="Move down"
                        aria-label={`Move ${itemLabel} ${index + 1} down`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      {index === rows.length - 1 ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                          onClick={onAddRow}
                          title="Add Enclosure"
                          aria-label="Add Enclosure"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => onRemoveRow(row.key)}
                          title="Remove Enclosure"
                          aria-label="Remove Enclosure"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {boundFile && (
                      <div className="flex items-center gap-2 ml-14 rounded border border-border bg-background/50 px-2 py-1">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 min-w-0 text-xs truncate" title={boundFile.fileName}>
                          {boundFile.fileName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {(boundFile.bytes.byteLength / 1024).toFixed(0)} KB
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onUnbindFile(row.key)}
                          title="Remove attached file (keeps the enclosure line)"
                          aria-label={`Remove file from ${itemLabel} ${index + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => void handleFilePicked(e.target.files)}
                aria-label="Attach enclosure file"
              />
            </div>

            {!isPositionPaper && anyFiles && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Attached files merge into the PDF export behind the letter, in row order.
                  Each file&apos;s first page is stamped &quot;Enclosure (n)&quot; per SECNAV M-5216.5.
                  Files save with the document in this browser. Not included in DOCX, .nldp, or share links.
                </p>
                <div className="flex items-center gap-2">
                  <Switch id="encl-cover-pages" checked={coverPages} onCheckedChange={onCoverPagesChange} />
                  <Label htmlFor="encl-cover-pages" className="cursor-pointer text-xs">
                    Use a cover sheet instead of stamping the first page
                  </Label>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
