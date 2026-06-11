'use client';

import { FormData } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllowedBodyFonts, getFontArchetype } from '@/lib/font-policy';

const FONT_LABELS: Record<string, string> = {
  times: 'Times New Roman',
  courier: 'Courier New',
};

const HEADER_LABELS: Record<string, string> = {
  USMC: 'USMC Standard',
  DON: 'Department of the Navy',
  DLA: 'Defense Logistics Agency',
};

/** Directives carry Navy or Marine Corps letterhead only (user
 *  ruling 2026-06-10); DLA letterhead is correspondence-only. */
function getAllowedHeaderTypes(documentType: string): string[] {
  return getFontArchetype(documentType) === 'usmc-directive'
    ? ['USMC', 'DON']
    : ['USMC', 'DON', 'DLA'];
}

interface HeaderSettingsSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function HeaderSettingsSection({ formData, setFormData }: HeaderSettingsSectionProps) {
  const isDirective = getFontArchetype(formData.documentType) === 'usmc-directive';
  const allowedHeaders = getAllowedHeaderTypes(formData.documentType);
  const headerValue = allowedHeaders.includes(formData.headerType as string)
    ? formData.headerType
    : allowedHeaders[0];
  // P3.1 (G7): this selector renders for directives (showHeaderSettings),
  // so the archetype font lock applies here too.
  const allowedFonts = getAllowedBodyFonts(formData.documentType);
  const fontLocked = allowedFonts.length === 1;
  const fontValue = allowedFonts.includes(formData.bodyFont as 'times' | 'courier')
    ? formData.bodyFont
    : allowedFonts[0];
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Header Type</label>
        <Select
          value={headerValue}
          onValueChange={(val: any) => setFormData(prev => ({ ...prev, headerType: val }))}
        >
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Select Header" />
          </SelectTrigger>
          <SelectContent>
            {allowedHeaders.map((h) => (
              <SelectItem key={h} value={h}>{HEADER_LABELS[h]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {isDirective ? 'Directives use Navy or Marine Corps letterhead' : 'Changes header title text'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Body Font</label>
        <Select
          value={fontValue}
          disabled={fontLocked}
          onValueChange={(val: any) => setFormData(prev => ({ ...prev, bodyFont: val }))}
        >
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Select Font" />
          </SelectTrigger>
          <SelectContent>
            {allowedFonts.map((f) => (
              <SelectItem key={f} value={f}>{FONT_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {fontLocked
            ? 'Locked: USMC directives use Courier New (MCO 5215.1K)'
            : 'Font for document body'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Header Color</label>
        <Select
          value={formData.accentColor || 'black'}
          onValueChange={(val: any) => setFormData(prev => ({ ...prev, accentColor: val }))}
        >
          <SelectTrigger className="bg-background border-input">
            <SelectValue placeholder="Select Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="black">Black</SelectItem>
            <SelectItem value="blue">Blue</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Color of header text only</p>
      </div>
    </div>
  );
}
