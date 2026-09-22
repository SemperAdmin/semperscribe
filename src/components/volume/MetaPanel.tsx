import React, { useCallback } from 'react';
import { useVolumeStore } from '@/store/volumeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, FileText, History, Book } from 'lucide-react';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

/** Edits the order metadata, volume metadata, top-level change log, and
 * references of the volume document. Chapter/section/paragraph content is
 * handled by ChapterTree. */
export function MetaPanel() {
  const doc = useVolumeStore((s) => s.doc);
  const setDoc = useVolumeStore((s) => s.setDoc);
  const updateMeta = useVolumeStore((s) => s.updateMeta);

  const patchOrder = useCallback(
    (patch: Partial<VolumeDoc['order']>) => setDoc({ ...doc, order: { ...doc.order, ...patch } }),
    [doc, setDoc],
  );

  const addChangeRow = useCallback(
    () => setDoc({ ...doc, changeLog: [...doc.changeLog, { version: '', summary: '', originationDate: '', dateOfChanges: '' }] }),
    [doc, setDoc],
  );
  const removeChangeRow = useCallback(
    (i: number) => setDoc({ ...doc, changeLog: doc.changeLog.filter((_, idx) => idx !== i) }),
    [doc, setDoc],
  );
  const updateChangeRow = useCallback(
    (i: number, patch: Partial<VolumeDoc['changeLog'][number]>) =>
      setDoc({ ...doc, changeLog: doc.changeLog.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }),
    [doc, setDoc],
  );

  const addReference = useCallback(
    () => setDoc({ ...doc, references: [...doc.references, { text: '' }] }),
    [doc, setDoc],
  );
  const removeReference = useCallback(
    (i: number) => setDoc({ ...doc, references: doc.references.filter((_, idx) => idx !== i) }),
    [doc, setDoc],
  );
  const updateReferenceText = useCallback(
    (i: number, text: string) => setDoc({ ...doc, references: doc.references.map((r, idx) => (idx === i ? { ...r, text } : r)) }),
    [doc, setDoc],
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border border-l-4 border-l-primary">
        <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
          <CardTitle as="h3" className="flex items-center text-lg font-semibold">
            <FileText className="mr-2 h-5 w-5" /> Order &amp; Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vol-order-designator">Order designator</Label>
              <Input id="vol-order-designator" value={doc.order.designator} onChange={(e) => patchOrder({ designator: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="vol-order-policy-title">Policy title</Label>
              <Input id="vol-order-policy-title" value={doc.order.policyTitle} onChange={(e) => patchOrder({ policyTitle: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vol-order-sponsor">Sponsor code</Label>
              <Input id="vol-order-sponsor" value={doc.order.sponsorCode} onChange={(e) => patchOrder({ sponsorCode: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vol-number">Volume number</Label>
              <Input
                id="vol-number"
                type="number"
                min={1}
                value={doc.volume.number}
                onChange={(e) => updateMeta({ number: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="vol-title">Volume title</Label>
              <Input id="vol-title" value={doc.volume.title} onChange={(e) => updateMeta({ title: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="vol-title-quoted"
              checked={!!doc.volume.titleQuoted}
              onCheckedChange={(c) => updateMeta({ titleQuoted: c === true })}
            />
            <Label htmlFor="vol-title-quoted" className="cursor-pointer">Quote the title on the cover page</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vol-orig-date">Original publication date</Label>
              <Input
                id="vol-orig-date"
                value={doc.volume.originalPublicationDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => updateMeta({ originalPublicationDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vol-updated-date">Last updated date</Label>
              <Input
                id="vol-updated-date"
                value={doc.volume.lastUpdatedDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => updateMeta({ lastUpdatedDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vol-distribution-kind">Distribution</Label>
              <Select
                value={doc.volume.distribution.kind}
                onValueChange={(val) => updateMeta({ distribution: { ...doc.volume.distribution, kind: val as 'statementA' | 'pcn' } })}
              >
                <SelectTrigger id="vol-distribution-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="statementA">Statement A</SelectItem>
                  <SelectItem value="pcn">PCN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {doc.volume.distribution.kind === 'pcn' && (
              <div className="space-y-1">
                <Label htmlFor="vol-distribution-value">PCN</Label>
                <Input
                  id="vol-distribution-value"
                  value={doc.volume.distribution.value ?? ''}
                  onChange={(e) => updateMeta({ distribution: { ...doc.volume.distribution, value: e.target.value } })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="vol-submit-changes">Submit changes to</Label>
            <Textarea
              id="vol-submit-changes"
              value={doc.volume.submitChangesTo}
              onChange={(e) => updateMeta({ submitChangesTo: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="vol-cancellation">Cancellation (optional)</Label>
            <Input
              id="vol-cancellation"
              value={doc.volume.cancellation ?? ''}
              onChange={(e) => updateMeta({ cancellation: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vol-report-required"
                checked={!!doc.volume.reportRequired}
                onCheckedChange={(c) => updateMeta({ reportRequired: c === true })}
              />
              <Label htmlFor="vol-report-required" className="cursor-pointer">Report required</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vol-section-period"
                checked={!!doc.volume.sectionPeriod}
                onCheckedChange={(c) => updateMeta({ sectionPeriod: c === true })}
              />
              <Label htmlFor="vol-section-period" className="cursor-pointer">Section designator ends with a period</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vol-references-summary-page"
                checked={doc.volume.referencesSummaryPage !== false}
                onCheckedChange={(c) => updateMeta({ referencesSummaryPage: c === true })}
              />
              <Label htmlFor="vol-references-summary-page" className="cursor-pointer">References summary page</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vol-page-band">Page band</Label>
              <Select value={doc.volume.pageBand} onValueChange={(val) => updateMeta({ pageBand: val as VolumeDoc['volume']['pageBand'] })}>
                <SelectTrigger id="vol-page-band" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="chapter-page">Chapter-page</SelectItem>
                  <SelectItem value="sequential">Sequential</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border border-l-4 border-l-primary">
        <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
          <CardTitle as="h3" className="flex items-center text-lg font-semibold">
            <History className="mr-2 h-5 w-5" /> Change Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {doc.changeLog.map((row, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
              <Input placeholder="Version" value={row.version} onChange={(e) => updateChangeRow(i, { version: e.target.value })} aria-label={`Change ${i + 1} version`} />
              <Input placeholder="Summary" className="md:col-span-2" value={row.summary} onChange={(e) => updateChangeRow(i, { summary: e.target.value })} aria-label={`Change ${i + 1} summary`} />
              <Input placeholder="Origination date" value={row.originationDate} onChange={(e) => updateChangeRow(i, { originationDate: e.target.value })} aria-label={`Change ${i + 1} origination date`} />
              <div className="flex gap-2">
                <Input placeholder="Date of changes" value={row.dateOfChanges} onChange={(e) => updateChangeRow(i, { dateOfChanges: e.target.value })} aria-label={`Change ${i + 1} date of changes`} />
                <Button type="button" variant="outline" size="icon" onClick={() => removeChangeRow(i)} aria-label={`Remove change ${i + 1}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addChangeRow}>
            <Plus className="w-4 h-4 mr-1" /> Add Change
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border border-l-4 border-l-primary">
        <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
          <CardTitle as="h3" className="flex items-center text-lg font-semibold">
            <Book className="mr-2 h-5 w-5" /> References
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {doc.references.map((ref, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                placeholder="Reference text"
                value={ref.text}
                onChange={(e) => updateReferenceText(i, e.target.value)}
                aria-label={`Reference ${i + 1}`}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => removeReference(i)} aria-label={`Remove reference ${i + 1}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addReference}>
            <Plus className="w-4 h-4 mr-1" /> Add Reference
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
