'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Braces,
  Table2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormData, ParagraphData } from '@/types';
import {
  MergeField,
  getMergeableFieldsForDocType,
  detectMergeFields,
} from '@/lib/merge-utils';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';
import { CsvParseResult } from '@/lib/merge-utils';

interface BatchGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
}

type Step = 'fields' | 'import' | 'preview' | 'generating' | 'done';

export function BatchGenerateModal({
  open,
  onOpenChange,
  formData,
  paragraphs,
  vias,
  references,
  enclosures,
  copyTos,
  distList,
}: BatchGenerateModalProps) {
  const [step, setStep] = useState<Step>('fields');
  const [selectedFormKeys, setSelectedFormKeys] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvParseResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    progress,
    exportCsvTemplate,
    importCsv,
    validateImport,
    runBatch,
    reset,
  } = useBatchGenerate();

  // Detect all merge fields from the document + selected form fields
  const mergeFields: MergeField[] = useMemo(() => {
    return detectMergeFields(formData, paragraphs, selectedFormKeys);
  }, [formData, paragraphs, selectedFormKeys]);

  // Inline {{TOKEN}} fields detected in the document text
  const inlineTokenFields = useMemo(() => {
    return mergeFields.filter(f => f.source === 'paragraph' || (f.source === 'form' && !f.formKey));
  }, [mergeFields]);

  const toggleFormField = (key: string) => {
    setSelectedFormKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExportTemplate = () => {
    exportCsvTemplate(mergeFields);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await importCsv(file);
    setCsvData(result);

    // Validate columns
    const validation = validateImport(result.headers, mergeFields);
    const errors: string[] = [...result.errors];
    if (validation.missing.length > 0) {
      errors.push(`Missing columns: ${validation.missing.join(', ')}`);
    }
    if (validation.extra.length > 0) {
      // Extras are warnings, not blocking
    }
    setValidationErrors(errors);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';

    setStep('preview');
  };

  const handleGenerate = async () => {
    if (!csvData || csvData.rows.length === 0) return;

    setStep('generating');
    await runBatch(
      formData,
      paragraphs,
      vias,
      references,
      enclosures,
      copyTos,
      distList,
      mergeFields,
      csvData.rows,
    );
    setStep('done');
  };

  const handleClose = () => {
    // Reset state when closing
    setStep('fields');
    setCsvData(null);
    setValidationErrors([]);
    reset();
    onOpenChange(false);
  };

  const progressPct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Batch Generate (Mail Merge)
          </DialogTitle>
          <DialogDescription>
            Generate multiple documents from a CSV spreadsheet. Each row produces one PDF.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {(['fields', 'import', 'preview', 'generating'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ArrowRight className="h-3 w-3" />}
              <Badge
                variant={step === s || (s === 'generating' && step === 'done') ? 'default' : 'outline'}
                className={cn('text-[10px] px-2', step === s && 'bg-primary text-primary-foreground')}
              >
                {i + 1}. {s === 'fields' ? 'Fields' : s === 'import' ? 'Import' : s === 'preview' ? 'Preview' : 'Generate'}
              </Badge>
            </React.Fragment>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-2">
          {/* ─── STEP 1: Select merge fields ─── */}
          {step === 'fields' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Select form fields to include as CSV columns:</h4>
                <p className="text-xs text-muted-foreground">
                  Fields shown are relevant to <strong>{formData.documentType || 'this document type'}</strong>. Toggle to include them in the CSV template.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {getMergeableFieldsForDocType(formData.documentType || 'basic')
                    .map(f => (
                      <label
                        key={f.key}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm',
                          selectedFormKeys.includes(f.key)
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-background border-border hover:bg-accent/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedFormKeys.includes(f.key)}
                          onCheckedChange={() => toggleFormField(f.key)}
                        />
                        <div>
                          <span className="font-medium">{f.label}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">({f.description})</span>
                        </div>
                      </label>
                    ))}
                </div>
              </div>

              {/* Show inline tokens found in the document */}
              {inlineTokenFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Braces className="h-4 w-4 text-blue-500" />
                    Inline tokens detected in document text:
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {inlineTokenFields.map(f => (
                      <Badge key={f.name} variant="secondary" className="font-mono text-xs">
                        {`{{${f.name}}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These will automatically become columns in the CSV template.
                  </p>
                </div>
              )}

              {mergeFields.length === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  No merge fields selected. Check some form fields above, or add <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{`{{FIELD_NAME}}`}</code> tokens
                  in your paragraph text.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleExportTemplate}
                  disabled={mergeFields.length === 0}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV Template
                </Button>
                <Button
                  onClick={() => setStep('import')}
                  disabled={mergeFields.length === 0}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Import CSV ─── */}
          {step === 'import' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Import your filled CSV:</h4>
                <p className="text-xs text-muted-foreground">
                  Upload the CSV file with one row per document. Column headers must match:
                </p>
                <div className="flex flex-wrap gap-1.5 my-2">
                  {mergeFields.map(f => (
                    <Badge key={f.name} variant="outline" className="font-mono text-xs">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  'hover:border-primary/50 hover:bg-accent/5',
                  'border-border'
                )}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Click to upload CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">.csv files accepted</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep('fields')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportTemplate}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template Again
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Preview imported data ─── */}
          {step === 'preview' && csvData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-primary" />
                  {csvData.rows.length} row{csvData.rows.length !== 1 ? 's' : ''} loaded
                </h4>
                <Badge variant={validationErrors.length > 0 ? 'destructive' : 'default'}>
                  {validationErrors.length > 0 ? `${validationErrors.length} issue(s)` : 'Valid'}
                </Badge>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="space-y-1">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Data preview table */}
              <div className="border rounded-md overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">#</th>
                      {csvData.headers.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        {csvData.headers.map(h => (
                          <td key={h} className="px-2 py-1 max-w-[200px] truncate">
                            {row[h] || <span className="text-muted-foreground italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.rows.length > 10 && (
                  <div className="text-xs text-muted-foreground px-2 py-1.5 bg-muted/30 border-t">
                    ... and {csvData.rows.length - 10} more rows
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { setCsvData(null); setStep('import'); }}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={csvData.rows.length === 0 || validationErrors.some(e => e.startsWith('Missing columns'))}
                  className="flex-1"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Generate {csvData.rows.length} PDF{csvData.rows.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 4: Generating ─── */}
          {step === 'generating' && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium">{progress.currentLabel}</p>
              </div>
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progress.current} / {progress.total}
              </p>
            </div>
          )}

          {/* ─── STEP 5: Done ─── */}
          {step === 'done' && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-3">
                {status === 'done' ? (
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                )}
                <p className="text-sm font-medium text-center">{progress.currentLabel}</p>
              </div>

              {progress.errors.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-destructive">Errors:</h4>
                  {progress.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      Row {err.row} ({err.label}): {err.error}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setStep('fields');
                    setCsvData(null);
                    setValidationErrors([]);
                    reset();
                  }}
                  className="flex-1"
                >
                  Generate Another Batch
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
