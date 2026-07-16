'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { format, parse } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { FormData } from '@/types';

const COMMON_OFFICES = [
  'DC M&RA', 'DC PP&O', 'DC I', 'DC AVN', 'DC CD&I',
  'AC/S G-1', 'AC/S G-2', 'AC/S G-3', 'AC/S G-4', 'AC/S G-6', 'AC/S G-8',
  'SJA', 'PAO', 'Inspector General', 'Comptroller',
];

interface CoordinatingOffice {
  office: string;
  concurrence: string;
  aoName: string;
  date: string;
  staffingComment: string;
  concurrenceCommentText: string;
  noResponseDate: string;
}

interface CoordinationPageFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function CoordinationPageForm({ formData, setFormData }: CoordinationPageFormProps) {
  const offices: CoordinatingOffice[] = formData.coordinatingOffices || [];

  function updateOffices(newOffices: CoordinatingOffice[]) {
    setFormData(prev => ({ ...prev, coordinatingOffices: newOffices }));
  }

  function updateField(index: number, field: keyof CoordinatingOffice, value: string) {
    const updated = [...offices];
    updated[index] = { ...updated[index], [field]: value };
    updateOffices(updated);
  }

  function addEntry(office = '') {
    updateOffices([...offices, { office, concurrence: 'pending', aoName: '', date: '', staffingComment: '', concurrenceCommentText: '', noResponseDate: '' }]);
  }

  function removeEntry(index: number) {
    updateOffices(offices.filter((_, i) => i !== index));
  }

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="text-lg font-semibold">Coordinating Offices</CardTitle>
        <p className="text-sm opacity-80 mt-1">
          List all internal and external agencies/commands per MCO 5216.20B.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-4">
          {offices.map((entry, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg bg-background space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Entry {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove entry"
                  onClick={() => removeEntry(index)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
                {/* STAFF/EXTERNAL AGENCY */}
                <div className="space-y-2">
                  <Label>Staff/External Agency *</Label>
                  <Input
                    placeholder="e.g., AC/S G-3"
                    list={`office-suggestions-${index}`}
                    value={entry.office}
                    onChange={e => updateField(index, 'office', e.target.value)}
                  />
                  <datalist id={`office-suggestions-${index}`}>
                    {COMMON_OFFICES.map(o => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>

                {/* NAME */}
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="Grade and name, or None Obtained"
                    value={entry.aoName}
                    onChange={e => updateField(index, 'aoName', e.target.value)}
                  />
                </div>

                {/* DATE & POSITION */}
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <DatePicker
                      date={entry.date ? parse(entry.date, 'd MMM yy', new Date()) : undefined}
                      setDate={(d) => updateField(index, 'date', d ? format(d, 'd MMM yy') : '')}
                      placeholder="Pick a date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={entry.concurrence || 'pending'}
                      onValueChange={val => updateField(index, 'concurrence', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="concur">Concur</SelectItem>
                        <SelectItem value="concur-comment">Concur w/comment</SelectItem>
                        <SelectItem value="nonconcur">Non-concur</SelectItem>
                        <SelectItem value="nonconcur-comment">Non-concur w/comment</SelectItem>
                        <SelectItem value="no-response">No response</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* CONDITIONAL: w/comment text input */}
              {(entry.concurrence === 'concur-comment' || entry.concurrence === 'nonconcur-comment') && (
                <div className="space-y-2">
                  <Label>Comment Text</Label>
                  <Input
                    placeholder="Enter comment text..."
                    value={entry.concurrenceCommentText || ''}
                    onChange={e => updateField(index, 'concurrenceCommentText', e.target.value)}
                  />
                </div>
              )}

              {/* CONDITIONAL: no-response date picker */}
              {entry.concurrence === 'no-response' && (
                <div className="space-y-2">
                  <Label>As of Date</Label>
                  <DatePicker
                    date={entry.noResponseDate ? parse(entry.noResponseDate, 'd MMM yy', new Date()) : undefined}
                    setDate={(d) => updateField(index, 'noResponseDate', d ? format(d, 'd MMM yy') : '')}
                    placeholder="Select as-of date"
                  />
                </div>
              )}

              {/* STAFFING COMMENT */}
              <div className="space-y-2">
                <Label>Staffing Comment</Label>
                <Textarea
                  placeholder="Optional staffing comment for this office..."
                  value={entry.staffingComment || ''}
                  onChange={e => updateField(index, 'staffingComment', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => addEntry()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>

          {offices.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const defaults = ['AC/S G-1', 'AC/S G-3', 'AC/S G-4', 'AC/S G-8', 'SJA'];
                const newOffices = defaults.map(office => ({
                  office, concurrence: 'pending', aoName: '', date: '', staffingComment: '', concurrenceCommentText: '', noResponseDate: '',
                }));
                updateOffices([...offices, ...newOffices]);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Common Staff Sections
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
