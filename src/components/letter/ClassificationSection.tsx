'use client';

/**
 * P2 (DONDOCS_PARITY_PLAN) - classification marking controls.
 *
 * Off by default. When on: banner level, CUI designation indicator
 * block fields, per-paragraph portion marking toggle, and a training
 * gate unlocking levels above CUI for exercise documents. Markings are
 * formatting output - the app's no-storage posture is unchanged.
 */

import React from 'react';
import { FormData } from '@/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert } from 'lucide-react';
import {
  ClassificationConfig,
  getClassification,
  STANDARD_LEVELS,
  TRAINING_LEVELS,
  needsCuiBlock,
  levelRank,
} from '@/lib/classification';

interface ClassificationSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function ClassificationSection({ formData, setFormData }: ClassificationSectionProps) {
  const config = getClassification(formData);

  const update = (changes: Partial<ClassificationConfig>) => {
    setFormData(prev => ({
      ...prev,
      classification: {
        ...getClassification(prev),
        ...changes,
        ...(changes.cui ? { cui: { ...getClassification(prev).cui, ...changes.cui } } : {}),
      },
    }));
  };

  const levels: string[] = config.customLevels
    ? [...STANDARD_LEVELS, ...TRAINING_LEVELS]
    : [...STANDARD_LEVELS];
  if (!levels.includes(config.level)) levels.push(config.level);

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Classification Markings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Banner lines, CUI designation block, and portion markings on the output.
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
          aria-label="Enable classification markings"
        />
      </div>

      {config.enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="classification-level">Banner level</Label>
              <Select value={config.level} onValueChange={(level) => update({ level })}>
                <SelectTrigger id="classification-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.portionMarking}
                  onCheckedChange={(checked) => update({ portionMarking: checked })}
                  aria-label="Enable portion markings"
                  id="portion-marking"
                />
                <Label htmlFor="portion-marking" className="cursor-pointer text-sm">Portion markings</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.customLevels}
                  onCheckedChange={(checked) => update({ customLevels: checked })}
                  aria-label="Enable training levels"
                  id="custom-levels"
                />
                <Label htmlFor="custom-levels" className="cursor-pointer text-sm">Training levels</Label>
              </div>
            </div>
          </div>

          {levelRank(config.level) >= 2 && (
            <p className="text-xs text-destructive">
              Levels above CUI are for training and exercise documents only.
              This tool is not an authorized system for classified material.
            </p>
          )}

          {needsCuiBlock(config) && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-foreground">CUI designation indicator block (page 1, DoDI 5200.48)</p>
              <div className="space-y-1.5">
                <Label htmlFor="cui-controlled-by">Controlled by (one office per line)</Label>
                <Textarea
                  id="cui-controlled-by"
                  value={config.cui.controlledBy}
                  onChange={(e) => update({ cui: { ...config.cui, controlledBy: e.target.value } })}
                  placeholder={'Department of the Navy\nHQMC, Administration and Resource Management Division'}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cui-categories">CUI Category</Label>
                  <Input
                    id="cui-categories"
                    value={config.cui.categories}
                    onChange={(e) => update({ cui: { ...config.cui, categories: e.target.value } })}
                    placeholder="PRVCY"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cui-distribution">Distribution/LDC</Label>
                  <Input
                    id="cui-distribution"
                    value={config.cui.distribution}
                    onChange={(e) => update({ cui: { ...config.cui, distribution: e.target.value } })}
                    placeholder="FEDCON"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cui-poc">POC</Label>
                  <Input
                    id="cui-poc"
                    value={config.cui.poc}
                    onChange={(e) => update({ cui: { ...config.cui, poc: e.target.value } })}
                    placeholder="GySgt Smith, DSN 555-0100"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
