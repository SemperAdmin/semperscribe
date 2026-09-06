/**
 * Structured Reference Input Component
 * Provides a three-field input for basic letter references (Who, Type, Date)
 * Used in endorsement document type
 */

import React from 'react';
import { parseAndFormatDate } from '@/lib/date-utils';
import { REFERENCE_TYPES, COMMON_ORIGINATORS } from '@/lib/constants';
import { FormData } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

export interface StructuredReferenceInputProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function StructuredReferenceInput({ formData, setFormData }: StructuredReferenceInputProps) {
  const generateReferenceString = (who: string, type: string, ssic: string, date: string): string => {
    if (!who || !type || !date) return '';
    const ssicPart = ssic ? ` ${ssic}` : '';
    // Format the date to naval format (D Mmm YY)
    const formattedDate = parseAndFormatDate(date);
    return `${who}'s ${type}${ssicPart} dtd ${formattedDate}`;
  };

  const updateReference = (field: 'who' | 'type' | 'ssic' | 'date', value: string) => {
    const newWho = field === 'who' ? value : formData.referenceWho;
    const newType = field === 'type' ? value : formData.referenceType;
    const newSsic = field === 'ssic' ? value : (formData.basicLetterSsic || '');
    const newDate = field === 'date' ? value : formData.referenceDate;

    const fullReference = generateReferenceString(newWho, newType, newSsic, newDate);

    setFormData((prev: FormData) => ({
      ...prev,
      referenceWho: newWho,
      referenceType: newType,
      basicLetterSsic: newSsic,
      referenceDate: newDate,
      basicLetterReference: fullReference
    }));
  };

  return (
    <Card className="border-border shadow-md bg-card">
      <CardHeader className="py-3 px-4 border-b border-border bg-secondary text-primary-foreground rounded-t-lg">
        <CardTitle as="h4" className="text-sm font-bold flex items-center gap-2 tracking-wide">
          <Info className="w-4 h-4 text-primary-foreground" />
          Basic Letter Reference Components
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="text-xs text-muted-foreground bg-accent/5 p-3 rounded-md border border-border/50">
          <div className="flex gap-2 mb-1">
            <span className="font-semibold">Format:</span>
            <span>on [who]'s [type] [ssic] dtd [date]</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold">Examples:</span>
            <span className="italic">on CO's ltr 5000 dtd 12 Jul 25 • on GySgt Admin's AA Form 1000 dtd 15 Aug 25</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Who</Label>
            <Input
              type="text"
              value={formData.referenceWho}
              onChange={(e) => updateReference('who', e.target.value)}
              placeholder="CO, GySgt Admin, etc."
              list="common-originators"
              className="h-9"
            />
            <datalist id="common-originators">
              {COMMON_ORIGINATORS.map(originator => (
                <option key={originator} value={originator} />
              ))}
            </datalist>
            <p className="text-[10px] text-muted-foreground">Who originated the basic letter?</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Type</Label>
            <Select
              value={formData.referenceType}
              onValueChange={(val) => updateReference('type', val)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">What type of document?</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">SSIC</Label>
            <Input
              type="text"
              value={formData.basicLetterSsic || ''}
              onChange={(e) => updateReference('ssic', e.target.value)}
              placeholder="5216, 1000, etc."
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">Basic letter SSIC</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Date</Label>
            <DatePicker
              date={formData.referenceDate ? new Date(formData.referenceDate + 'T00:00:00') : undefined}
              setDate={(d) => updateReference('date', d ? format(d, 'yyyy-MM-dd') : '')}
              placeholder="Pick a date"
            />
            {formData.referenceDate && (
              <p className="text-[10px] text-muted-foreground">
                Will display as: <span className="font-semibold">{parseAndFormatDate(formData.referenceDate)}</span>
              </p>
            )}
            {!formData.referenceDate && (
              <p className="text-[10px] text-muted-foreground">Date of basic letter</p>
            )}
          </div>
        </div>

        {formData.endorsementLevel && (
          <div className="space-y-1 pt-2">
            {!formData.referenceWho && (
              <div className="text-xs text-destructive flex items-center gap-1">
                • Please specify who originated the basic letter
              </div>
            )}
            {!formData.referenceType && (
              <div className="text-xs text-destructive flex items-center gap-1">
                • Please select the document type
              </div>
            )}
            {!formData.referenceDate && (
              <div className="text-xs text-destructive flex items-center gap-1">
                • Please enter the document date
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
