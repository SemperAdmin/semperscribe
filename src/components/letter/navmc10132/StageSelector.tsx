'use client';

/**
 * NAVMC 10132 stage selector, rendered above every other section.
 *
 * WHAT THIS CONTROLS. `formData.stage` is not a field on the form, it is
 * app state deciding which of the sections below are shown, matching what
 * the form's own signature locks would already have closed at that point
 * in the seven-pass process (docs/NAVMC_10132_SPEC.md section 13). A clerk
 * at notification has no business seeing findings, punishment, or appeal
 * controls that belong three to six passes later, per decision row D-46.
 *
 * WHY A CLERK SETS THIS BY HAND, AND WHY THAT WILL CHANGE. The app cannot
 * yet read a signed PDF back to compute which signatures are already on
 * it, so it cannot detect the pass itself. That round trip is unbuilt.
 * `formData.stage` is typed and defaulted like ordinary data, not wired to
 * a human-only control, so that once the round trip lands, an imported
 * signed file sets this the same way an import would set any other field,
 * and nothing here has to change.
 *
 * WHY THE OPTIONS ARE NAMED FOR WHAT HAPPENS, NOT "PASS 3". A clerk knows
 * "punishment imposed," not the form's own internal pass numbering, so the
 * labels and descriptions come from NAVMC_10132_STAGE_INFO, keyed off what
 * each stage unlocks rather than its position in the sequence.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FormData } from '@/types';
import {
  NAVMC_10132_STAGE_VALUES,
  NAVMC_10132_STAGE_INFO,
  navmc10132Stage,
  type Navmc10132Stage,
} from '@/types/navmc';
import { Route } from 'lucide-react';

interface StageSelectorProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

function parseStageValue(value: string): Navmc10132Stage {
  return value === 'complete' ? 'complete' : (Number(value) as Navmc10132Stage);
}

export function StageSelector({ formData, setFormData }: StageSelectorProps) {
  const stage = navmc10132Stage(formData);
  const info = NAVMC_10132_STAGE_INFO[stage];

  return (
    <div className="mb-6 rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-semibold">Stage of the process</Label>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Not a field on the form. It picks which sections below are shown, matching what the
        form's own signatures would already have closed at this point. Move it forward as the
        document proceeds; a new document starts at notification. Once the app can read a signed
        copy back, this will be set automatically instead of by hand.
      </p>
      <div className="mt-3 max-w-sm">
        <Select
          value={String(stage)}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, stage: parseStageValue(value) }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NAVMC_10132_STAGE_VALUES.map((value) => (
              <SelectItem key={String(value)} value={String(value)}>
                {NAVMC_10132_STAGE_INFO[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{info.description}</p>
    </div>
  );
}
