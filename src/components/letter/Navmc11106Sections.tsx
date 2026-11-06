'use client';

/**
 * NAVMC 11106 form sections. Narrow DynamicForm instances interleaved with
 * custom components so the screen follows the paper's order, the 10922 pattern.
 * Rule source: docs/NAVMC_11106_SPEC.md.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CheckSquare, Square, Users, ClipboardCheck, ListChecks } from 'lucide-react';
import type { FormData } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, type DocumentTypeDefinition } from '@/lib/schemas';
import {
  NAVMC_11106_EMPTY_DEPENDENT,
  NAVMC_11106_SPONSORSHIP_BASES,
  type Navmc11106Dependent,
  type Navmc11106SponsorshipBasis,
} from '@/types/navmc';
import {
  NAVMC_11106_BASIS_INFO,
  NAVMC_11106_MAX_DEPENDENTS,
  NAVMC_11106_REMARKS_LIMIT,
  combinedRemarks,
  commandSponsoredDate,
  countedDependents,
  dependentRows,
  generatedRemarks,
  partAValue,
  rowHasContent,
  spouseRow,
  suggestedEffectiveDate,
  withDependentsOnlyReset,
  type Navmc11106PartA,
} from '@/lib/navmc11106-rules';

interface SectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onDynamicSync: (data: any) => void;
  formKey: number | string;
}
type StateProps = Pick<SectionsProps, 'formData' | 'setFormData'>;

function subDefinition(ids: string[]): DocumentTypeDefinition {
  const def = DOCUMENT_TYPES['navmc11106'];
  return { ...def, sections: def.sections.filter((s) => ids.includes(s.id)) };
}
const DEF_MEMBER = subDefinition(['member']);
const DEF_DATES = subDefinition(['dependent-dates']);

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center text-lg font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

const PART_A_BOXES: Array<{ value: Navmc11106PartA; label: string }> = [
  { value: 'mem', label: 'For Member Only' },
  { value: 'both', label: 'For Member and Dependents' },
  { value: 'dep', label: "For Member's Dependents Only" },
];

function PartASection({ formData, setFormData }: StateProps) {
  const part = partAValue(formData);
  const hasDependents = countedDependents(formData).length > 0;
  return (
    <SectionCard icon={<ListChecks className="mr-2 h-5 w-5" />} title="Part A — Purpose">
      <p className="text-xs text-muted-foreground mb-3">
        Set automatically from the dependents entered in Part C.
      </p>
      <ul aria-label="Part A purpose" className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {PART_A_BOXES.map(({ value, label }) => (
          <li
            key={value}
            aria-current={part === value ? 'true' : undefined}
            className={`flex items-center gap-2 rounded-md border p-2 text-sm ${part === value ? 'border-primary font-semibold' : 'border-border text-muted-foreground'}`}
          >
            {part === value ? <CheckSquare className="h-4 w-4 shrink-0" aria-hidden /> : <Square className="h-4 w-4 shrink-0" aria-hidden />}
            {label}
          </li>
        ))}
      </ul>
      {hasDependents && (
        <div className="mt-3 space-y-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={formData.dependentsOnly === true}
              onCheckedChange={(v) => setFormData((prev) => ({ ...prev, dependentsOnly: v === true }))}
            />
            Dependents only
          </label>
          <p className="text-xs text-muted-foreground">
            Check when this application covers only dependents at a location other than your PDS.
            Your own COLA at the PDS, if any, goes on a separate application with no dependents listed.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

export function basesForRow(isSpouse: boolean): readonly Navmc11106SponsorshipBasis[] {
  return NAVMC_11106_SPONSORSHIP_BASES.filter((b) =>
    isSpouse
      ? b !== 'birth' && b !== 'adoption-placement'
      : b !== 'active-duty-spouse' && b !== 'dual-mil-separation');
}

function RowEditor({ row, label, isSpouse, onChange, onRemove }: {
  row: Navmc11106Dependent;
  label: string;
  isSpouse: boolean;
  onChange: (patch: Partial<Navmc11106Dependent>) => void;
  onRemove?: () => void;
}) {
  const info = row.sponsorshipBasis ? NAVMC_11106_BASIS_INFO[row.sponsorshipBasis] : null;
  const bases = basesForRow(isSpouse);
  const needsDate = info?.dated === true && row.sponsorshipBasis !== 'birth';
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        {onRemove && rowHasContent(row) && (
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-name`}>{label} name</Label>
          <Input id={`${id}-name`} maxLength={25} value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-relationship`}>{label} relationship</Label>
          <Input id={`${id}-relationship`} maxLength={20} placeholder={isSpouse ? 'SPOUSE' : 'SON'} value={row.relationship} onChange={(e) => onChange({ relationship: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`${id}-event`}>{isSpouse ? 'Date of marriage' : `${label} date of birth`}</Label>
          <Input id={`${id}-event`} type="date" value={row.eventDate} onChange={(e) => onChange({ eventDate: e.target.value })} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs" htmlFor={`${id}-basis`}>How command sponsored</Label>
          <Select
            value={row.sponsorshipBasis || undefined}
            onValueChange={(v) => onChange({ sponsorshipBasis: v as Navmc11106SponsorshipBasis })}
          >
            <SelectTrigger id={`${id}-basis`} aria-label={`${label} sponsorship basis`}>
              <SelectValue placeholder="Select a basis" />
            </SelectTrigger>
            <SelectContent>
              {bases.map((b) => (
                <SelectItem key={b} value={b}>{NAVMC_11106_BASIS_INFO[b].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {info && <p className="text-[11px] text-muted-foreground">{info.hint}</p>}
        </div>
        {needsDate && (
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`${id}-sponsored`}>{label} date command sponsored</Label>
            <Input id={`${id}-sponsored`} type="date" value={row.sponsoredOn} onChange={(e) => onChange({ sponsoredOn: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}

const padRows = (rows: Navmc11106Dependent[]): Navmc11106Dependent[] => {
  const out = rows.slice(0, NAVMC_11106_MAX_DEPENDENTS);
  while (out.length < NAVMC_11106_MAX_DEPENDENTS) out.push({ ...NAVMC_11106_EMPTY_DEPENDENT });
  return out;
};

function DependentsSection({ formData, setFormData }: StateProps) {
  const rows = padRows(dependentRows(formData));
  const lastFilled = rows.reduce((last, r, i) => (rowHasContent(r) ? i : last), -1);
  const [opened, setOpened] = useState(1);
  const visible = Math.min(NAVMC_11106_MAX_DEPENDENTS, Math.max(opened, lastFilled + 1, 1));
  const c10 = commandSponsoredDate(formData);

  const updateRow = (i: number, patch: Partial<Navmc11106Dependent>) =>
    setFormData((prev) => {
      const next = padRows(dependentRows(prev));
      next[i] = { ...next[i], ...patch };
      return withDependentsOnlyReset({ ...prev, navmc11106Dependents: next });
    });
  const removeRow = (i: number) =>
    setFormData((prev) => {
      const next = padRows(dependentRows(prev));
      next.splice(i, 1);
      return withDependentsOnlyReset({ ...prev, navmc11106Dependents: padRows(next) });
    });
  const updateSpouse = (patch: Partial<Navmc11106Dependent>) =>
    setFormData((prev) => withDependentsOnlyReset({ ...prev, navmc11106Spouse: { ...spouseRow(prev), ...patch } }));

  return (
    <SectionCard icon={<Users className="mr-2 h-5 w-5" />} title="Part C — Dependents COLA Is Claimed For">
      <div className="text-xs text-muted-foreground mb-4 space-y-1">
        <p>
          A command-sponsored dependent is one authorized by the appropriate authority to reside at
          the OCONUS location with you on an accompanied tour (JTR Appendix A). Being a dependent in
          MCTFS, or living at the PDS, does not make a dependent command sponsored.
        </p>
        <p>
          List only dependents COLA is claimed for. Tell your commanding officer when any dependent
          leaves the PDS vicinity for 31 or more days, not only on a return to the United States
          (FMR Vol 7A Ch 68 Table 68-3).
        </p>
        <p>
          With-dependent COLA generally starts on the later of arrival and sponsorship. Acquired or
          newly sponsored dependents need at least 12 months left on the tour after arrival or
          approval, whichever is later (MCO 1300.8 Ch 6 par 6.a, 7.b).
        </p>
        {c10 && <p className="font-medium">Block 10 will print {c10}.</p>}
      </div>
      <div className="space-y-4">
        <RowEditor row={spouseRow(formData)} label="Spouse" isSpouse onChange={updateSpouse} />
        {rows.slice(0, visible).map((row, i) => (
          <RowEditor
            key={i}
            row={row}
            label={`Dependent ${i + 1}`}
            isSpouse={false}
            onChange={(patch) => updateRow(i, patch)}
            onRemove={() => removeRow(i)}
          />
        ))}
      </div>
      {visible < NAVMC_11106_MAX_DEPENDENTS && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setOpened(visible + 1)}>
          Add dependent
        </Button>
      )}
    </SectionCard>
  );
}

function ConusSection({ formData, setFormData }: StateProps) {
  if (partAValue(formData) !== 'dep') return null;
  const on = formData.conusColaDependents === true;
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6 space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={on}
          onCheckedChange={(v) => setFormData((prev) => ({ ...prev, conusColaDependents: v === true }))}
        />
        Dependents are in CONUS, at a location paying CONUS COLA
      </label>
      <p className="text-xs text-muted-foreground">
        No application is needed when the CONUS COLA rate there is $0 (AskMCAAT 039-24). Part D is
        not required for this case (PRIUM 80101 par 3.a(4)).
      </p>
      {on && (
        <div className="space-y-1 max-w-[12rem]">
          <Label className="text-xs" htmlFor="conus-zip">Dependent ZIP code</Label>
          <Input
            id="conus-zip"
            maxLength={5}
            inputMode="numeric"
            value={String(formData.conusColaZip ?? '')}
            onChange={(e) => setFormData((prev) => ({ ...prev, conusColaZip: e.target.value.replace(/\D/g, '') }))}
          />
        </div>
      )}
    </div>
  );
}

function RadioChoice({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" id={`${id}-label`}>{label}</span>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-5 text-[11px]" aria-label={`Clear ${label}`} onClick={() => onChange('')}>
            Clear
          </Button>
        )}
      </div>
      <RadioGroup aria-labelledby={`${id}-label`} value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
        {options.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
            <Label className="text-sm font-normal" htmlFor={`${id}-${o.value}`}>{o.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function PartDSection({ formData, setFormData }: StateProps) {
  const text = (key: string) => String(formData[key] ?? '');
  const set = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));
  const suggestion = suggestedEffectiveDate(formData);
  const generated = generatedRemarks(formData);
  const total = combinedRemarks(formData).length;

  return (
    <SectionCard icon={<ClipboardCheck className="mr-2 h-5 w-5" />} title="Part D — Commanding Officer's Certificate">
      <p className="text-xs text-muted-foreground mb-4">
        Commander completes (PRIUM 80102 par 3.b). Leave blank if the command fills this part after signature.
      </p>
      <div className="space-y-4">
        <RadioChoice label="1. Government quarters are" value={text('d1Quarters')} onChange={(v) => set('d1Quarters', v)}
          options={[{ value: 'y', label: 'Available' }, { value: 'n', label: 'Not available' }]} />
        <RadioChoice label="Quarters assignment" value={text('d1Assignment')} onChange={(v) => set('d1Assignment', v)}
          options={[{ value: 'Yes', label: 'Assigned' }, { value: 'no', label: 'Not assigned' }]} />
        <RadioChoice label="Quarters to whom" value={text('d1ToWhom')} onChange={(v) => set('d1ToWhom', v)}
          options={[{ value: 'mem', label: 'To the member' }, { value: 'dep', label: "To the member's dependents" }]} />
        <RadioChoice label="2A. Government mess" value={text('d2Mess')} onChange={(v) => set('d2Mess', v)}
          options={[{ value: 'y', label: 'Is' }, { value: 'n', label: 'Is not' }]} />
        <RadioChoice label="Mess available to" value={text('d2Who')} onChange={(v) => set('d2Who', v)}
          options={[{ value: 'memdep', label: 'Member and dependents' }, { value: 'mem', label: 'Member' }]} />
        <RadioChoice label="2B. Mess status" value={text('d2b')} onChange={(v) => set('d2b', v)}
          options={[
            { value: 'y', label: 'Enlisted member authorized to mess separately' },
            { value: 'n', label: 'Impractical to use Government mess for 3 meals a day' },
          ]} />

        <div className="space-y-1 max-w-xs">
          <Label className="text-sm" htmlFor="n11106-effective">3. This Application Is Approved Effective</Label>
          <Input id="n11106-effective" type="date" value={text('effectiveDate')} onChange={(e) => set('effectiveDate', e.target.value)} />
          {suggestion && text('effectiveDate') !== suggestion && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => set('effectiveDate', suggestion)}>
              Use suggested date ({suggestion})
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-sm" htmlFor="n11106-remarks">Remarks</Label>
          <Textarea id="n11106-remarks" rows={4} value={text('navmc11106Remarks')} onChange={(e) => set('navmc11106Remarks', e.target.value)} />
          {generated.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Will also print:</p>
              <ul className="list-disc pl-4">
                {generated.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          )}
          <p className={`text-xs ${total > NAVMC_11106_REMARKS_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`}>
            {total} of {NAVMC_11106_REMARKS_LIMIT} characters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-sm" htmlFor="n11106-co-date">Date</Label>
            <Input id="n11106-co-date" type="date" value={text('coDate')} onChange={(e) => set('coDate', e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm" htmlFor="n11106-co-name">Name, Grade, and Activity of Commanding Officer</Label>
            <Input id="n11106-co-name" maxLength={65} value={text('coNameGradeActivity')} onChange={(e) => set('coNameGradeActivity', e.target.value)} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export function Navmc11106FormSections({ formData, setFormData, onDynamicSync, formKey }: SectionsProps) {
  return (
    <>
      <PartASection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm key={`navmc11106-${formKey}-member`} documentType={DEF_MEMBER} onSubmit={onDynamicSync} defaultValues={formData} />
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
          <Checkbox
            checked={formData.maltPlusOnReportingDay === true}
            onCheckedChange={(v) => setFormData((prev) => ({ ...prev, maltPlusOnReportingDay: v === true }))}
          />
          MALT Plus authorized on the reporting day (COLA starts the next day, FMR Vol 7A Ch 68 par 3.2.1)
        </label>
      </div>
      <DependentsSection formData={formData} setFormData={setFormData} />
      <ConusSection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm key={`navmc11106-${formKey}-dates`} documentType={DEF_DATES} onSubmit={onDynamicSync} defaultValues={formData} />
      </div>
      <PartDSection formData={formData} setFormData={setFormData} />
    </>
  );
}
