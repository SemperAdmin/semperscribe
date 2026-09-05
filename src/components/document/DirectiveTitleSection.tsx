'use client';

import { FormData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface DirectiveTitleSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function DirectiveTitleSection({ formData, setFormData }: DirectiveTitleSectionProps) {
  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-amber-500">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg font-semibold font-headline tracking-wide">
          Directive Title
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Full Directive Title <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            value={formData.directiveTitle || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, directiveTitle: e.target.value }))}
            placeholder="e.g., MARINE CORPS ORDER 5210.11F"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            This title will appear underlined between the date and From line. Examples: MCO 5210.11F, NAVMC DIR 5000.1, MCBul 1020
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
