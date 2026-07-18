'use client';

/**
 * PG11-1 - NAVMC 118(11) remarks columns.
 *
 * Replaces the schema-driven remarks fields so the right column can
 * carry a template insert. A Page 11 is a two-column ledger: entries
 * fill the LEFT column first, and a free RIGHT column is wasted paper.
 * When the right column is empty, "Insert template" drops a second
 * entry's text into it - text only, because the page belongs to one
 * Marine and the name/EDIPI on the form already say who.
 *
 * Stephen's rulings (2026-07-17): entry text only; button lives on the
 * column; no fill-order lock (either column stays freely editable).
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileText, FilePlus2, X } from 'lucide-react';
import { FormData } from '@/types';
import { getBasePath } from '@/lib/path-utils';
import { useToast } from '@/hooks/use-toast';

interface Page11RemarksSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

interface TemplateEntry {
  id: string;
  title: string;
  description?: string;
  documentType?: string;
  url: string;
}

export function Page11RemarksSection({ formData, setFormData }: Page11RemarksSectionProps) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const left = (formData.remarksLeft as string) ?? '';
  const right = (formData.remarksRight as string) ?? '';
  const rightEmpty = right.trim() === '';

  // Page 11 templates come from the same index the Templates browser
  // reads - one source, so a new entry file shows up in both.
  useEffect(() => {
    if (!pickerOpen || entries.length > 0) return;
    setLoading(true);
    fetch(`${getBasePath()}/templates/global/index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: TemplateEntry[]) => {
        setEntries(Array.isArray(all) ? all.filter((t) => t.documentType === 'page11') : []);
      })
      .catch(() => toast({ title: 'Templates Unavailable', description: 'Could not load the Page 11 template list.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [pickerOpen, entries.length, toast]);

  const insertIntoRight = async (entry: TemplateEntry) => {
    try {
      const res = await fetch(`${getBasePath()}${entry.url}`);
      if (!res.ok) throw new Error(String(res.status));
      const nldp = await res.json();
      // Entry text lives in the LEFT column of every template (entries
      // flow left first); it lands in THIS document's right column.
      const text: string = nldp?.data?.formData?.remarksLeft ?? '';
      if (!text.trim()) throw new Error('empty template');
      setFormData((prev) => ({ ...prev, remarksRight: text }));
      setPickerOpen(false);
      toast({ title: 'Entry Added', description: `"${entry.title}" inserted into the right column.` });
    } catch {
      toast({ title: 'Insert Failed', description: `Could not load "${entry.title}".`, variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <FileText className="mr-2 h-5 w-5 text-primary-foreground" />
          Remarks
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="remarks-left" className="text-sm font-medium">Left Column Content</Label>
          <Textarea
            id="remarks-left"
            value={left}
            onChange={(e) => setFormData((prev) => ({ ...prev, remarksLeft: e.target.value }))}
            placeholder="Enter the entry text..."
            className="font-mono"
            rows={20}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 min-h-[28px]">
            <Label htmlFor="remarks-right" className="text-sm font-medium">Right Column Content</Label>
            {rightEmpty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />
                Insert template
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => setFormData((prev) => ({ ...prev, remarksRight: '' }))}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear column
              </Button>
            )}
          </div>
          <Textarea
            id="remarks-right"
            value={right}
            onChange={(e) => setFormData((prev) => ({ ...prev, remarksRight: e.target.value }))}
            placeholder="Overflow from the left column, or a second entry..."
            className="font-mono"
            rows={20}
          />
          <p className="text-xs text-muted-foreground">
            The right column takes overflow from the left, or a second entry for the same Marine.
          </p>
        </div>
      </CardContent>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Insert Entry Into Right Column</DialogTitle>
            <DialogDescription>
              Adds the entry text only. The Marine&apos;s name and DoD ID on this page stay as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
            {loading && <p className="text-sm text-muted-foreground py-6 text-center">Loading templates...</p>}
            {!loading && entries.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No Page 11 templates found.</p>
            )}
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => void insertIntoRight(entry)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="font-medium text-sm text-foreground">{entry.title}</div>
                {entry.description && (
                  <div className="text-xs text-muted-foreground mt-1">{entry.description}</div>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
