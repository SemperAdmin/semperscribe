'use client';

import { FormData } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllowedBodyFonts, getFontArchetype } from '@/lib/font-policy';

const FONT_LABELS: Record<string, string> = {
  times: 'Times New Roman',
  courier: 'Courier New',
};

interface FontSelectorSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function FontSelectorSection({ formData, setFormData }: FontSelectorSectionProps) {
  // P3.1 (G7): font choice is archetype-locked. Directives offer
  // Courier only; correspondence keeps the free Times/Courier choice.
  const allowed = getAllowedBodyFonts(formData.documentType);
  const locked = allowed.length === 1;
  const value = allowed.includes(formData.bodyFont as 'times' | 'courier')
    ? formData.bodyFont
    : allowed[0];
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Body Font</label>
        <Select
          value={value}
          disabled={locked}
          onValueChange={(val: any) => setFormData(prev => ({ ...prev, bodyFont: val }))}
        >
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Select Font" />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((f) => (
              <SelectItem key={f} value={f}>{FONT_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {getFontArchetype(formData.documentType) === 'usmc-directive'
            ? 'Locked: USMC directives use Courier New (MCO 5215.1K; audit C1)'
            : 'Font for document body'}
        </p>
      </div>
    </div>
  );
}
