'use client';

/**
 * TLA Packet: the request on screen, in the order it is built. Every input
 * writes to formData directly, as the Counseling Worksheet does, so the
 * lodging claimed and the rule checks read back while the user types. It
 * takes facts only: finance sets the per diem and computes the amount.
 * Nothing here blocks an export: the TLA Authority and the disbursing or
 * finance office decide the claim (src/lib/tla.ts).
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { FIELD_ATTRIBUTE } from '@/lib/field-focus';
import type { FormData } from '@/types';
import {
  TLA_ADDITIONAL_REASONS, TLA_EARLY_TERMINATION_REASONS, TLA_REQUEST_KINDS, TLA_SITUATIONS,
  emptyTlaPeriod, summarizeTla, tlaAdvisories, tlaField, tlaFlag, tlaHousingLog, tlaMoneyText, tlaPeriods, tlaRequestKind,
  type TlaCoverage, type TlaHousingEntry, type TlaLodgingKind, type TlaPeriod,
} from '@/lib/tla';

interface TlaSectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

const COVERAGE_OPTIONS: readonly { value: TlaCoverage; label: string }[] = [
  { value: 'lodging-and-mie', label: 'Lodging and M&IE' },
  { value: 'lodging-only', label: 'Lodging only (meals paid elsewhere, such as the travel claim)' },
  { value: 'mie-only', label: 'M&IE only (friends or relatives, or kitchen renovation)' },
];

const LODGING_OPTIONS: readonly { value: TlaLodgingKind; label: string }[] = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'government', label: 'Government or Government contract' },
];

export function TlaSections({ formData, setFormData }: TlaSectionsProps) {
  const set = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value } as FormData));
  const get = (name: string) => tlaField(formData, name);
  const flag = (name: string) => tlaFlag(formData, name);

  const periods = tlaPeriods(formData);
  const log = tlaHousingLog(formData);
  const kind = tlaRequestKind(formData);
  const summary = summarizeTla(formData);
  const advisories = tlaAdvisories(formData);

  const setPeriods = (next: TlaPeriod[]) => set('tlaPeriods', next);
  const patchPeriod = (index: number, patch: Partial<TlaPeriod>) =>
    setPeriods(periods.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const addPeriod = () => {
    // A further period usually differs in its dates or occupants, not its lodging.
    const previous = periods[periods.length - 1];
    setPeriods([...periods, previous ? { ...previous, startDate: '', endDate: '', extraRoomCharge: '' } : emptyTlaPeriod()]);
  };
  const setLog = (next: TlaHousingEntry[]) => set('tlaHousingLog', next);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What this packet does</CardTitle>
          <p className="text-sm text-muted-foreground">
            The request behind the NAVMC 11116, which the command submits for payment. Enter the facts. Finance sets the per diem from the location and dates, and computes the amount.
          </p>
        </CardHeader>
        {advisories.length > 0 && (
          <CardContent>
            <ul className="space-y-2" aria-label="Checks for this claim">
              {advisories.map((a) => (
                <li key={`${a.id}-${a.text}`} data-testid={`tla-advisory-${a.id}`} className="flex gap-2 rounded-md border border-border bg-muted/50 p-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {a.text} <span className="text-xs text-muted-foreground">({a.citation})</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Step title="1. The Marine and the order">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TextField name="tlaMarineLastName" label="Last name" value={get('tlaMarineLastName')} onChange={(v) => set('tlaMarineLastName', v)} />
          <TextField name="tlaMarineFirstName" label="First name" value={get('tlaMarineFirstName')} onChange={(v) => set('tlaMarineFirstName', v)} />
          <TextField name="tlaMarineMiddleInitial" label="Middle initial" value={get('tlaMarineMiddleInitial')} onChange={(v) => set('tlaMarineMiddleInitial', v)} />
          <TextField name="tlaMarineGrade" label="Grade" value={get('tlaMarineGrade')} onChange={(v) => set('tlaMarineGrade', v)} />
          <TextField name="tlaMarineEdipi" label="EDIPI" value={get('tlaMarineEdipi')} onChange={(v) => set('tlaMarineEdipi', v.replace(/\D/g, '').slice(0, 10))} />
          <TextField name="tlaUnit" label="Unit" value={get('tlaUnit')} onChange={(v) => set('tlaUnit', v)} />
          <TextField name="tlaPds" label="OCONUS PDS" value={get('tlaPds')} onChange={(v) => set('tlaPds', v)} />
          <TextField name="tlaOrdersReference" label="Order reference" value={get('tlaOrdersReference')} onChange={(v) => set('tlaOrdersReference', v)} className="md:col-span-2" />
          <DateField name="tlaReportDate" label="Reported" value={get('tlaReportDate')} onChange={(v) => set('tlaReportDate', v)} />
          <DateField name="tlaDepartureDate" label="Departing" value={get('tlaDepartureDate')} onChange={(v) => set('tlaDepartureDate', v)} />
          <DateField name="tlaHhgDeliveryDate" label="Household goods delivered" value={get('tlaHhgDeliveryDate')} onChange={(v) => set('tlaHhgDeliveryDate', v)} />
        </div>
      </Step>

      <Step title="2. The request">
        <div {...{ [FIELD_ATTRIBUTE]: 'tlaRequestKind' }}>
          <Label>Type of request</Label>
          <RadioGroup className="mt-2 space-y-1" value={kind} onValueChange={(v) => set('tlaRequestKind', v)}>
            {TLA_REQUEST_KINDS.map((k) => (
              <div key={k.value} className="flex items-center gap-2">
                <RadioGroupItem id={`tlaRequestKind-${k.value}`} value={k.value} />
                <Label htmlFor={`tlaRequestKind-${k.value}`} className="font-normal">
                  {k.label}: <span className="text-muted-foreground">{k.hint}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <PickField
          name="tlaSituation"
          label="Situation"
          value={get('tlaSituation')}
          onChange={(v) => set('tlaSituation', v)}
          options={TLA_SITUATIONS}
          placeholder="Pick the situation"
        />

        <TextField name="tlaPriorDays" label="TLA days already authorized" value={get('tlaPriorDays')} onChange={(v) => set('tlaPriorDays', v.replace(/\D/g, ''))} />

        {kind === 'additional' && (
          <div className="space-y-4 rounded-md border border-border p-3">
            <PickField
              name="tlaAdditionalReason"
              label="Why more TLA is needed"
              value={get('tlaAdditionalReason')}
              onChange={(v) => set('tlaAdditionalReason', v)}
              options={TLA_ADDITIONAL_REASONS}
              placeholder="Pick the reason"
            />
            <AreaField name="tlaAdditionalNarrative" label="What happened" value={get('tlaAdditionalNarrative')} onChange={(v) => set('tlaAdditionalNarrative', v)} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField name="tlaDailyTla" label="TLA received or expected, per day, if known" value={get('tlaDailyTla')} onChange={(v) => set('tlaDailyTla', v)} />
              <TextField name="tlaDailyHousingAllowance" label="Housing allowance, per day" value={get('tlaDailyHousingAllowance')} onChange={(v) => set('tlaDailyHousingAllowance', v)} />
              <TextField name="tlaDailyFamilySeparationHousing" label="Family Separation Housing, per day" value={get('tlaDailyFamilySeparationHousing')} onChange={(v) => set('tlaDailyFamilySeparationHousing', v)} />
            </div>
          </div>
        )}
      </Step>

      <Step title="3. Lodging">
        <CheckField name="tlaMemberCoupleTogether" label="Married to a Service member, lodging together, no dependents (65 percent each)" checked={flag('tlaMemberCoupleTogether')} onChange={(v) => set('tlaMemberCoupleTogether', v)} />

        {periods.map((p, index) => (
          <PeriodCard key={index} index={index} period={p} onChange={(patch) => patchPeriod(index, patch)} onRemove={() => setPeriods(periods.filter((_, i) => i !== index))} />
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addPeriod}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add lodging period
        </Button>

        <p data-testid="tla-total" className="text-sm font-semibold">
          Lodging claimed: {tlaMoneyText(summary.lodgingTotal)} for {summary.totalDays} {summary.totalDays === 1 ? 'day' : 'days'}
        </p>
      </Step>

      <Step title="4. GTCC and housing allowance">
        <TextField name="tlaGtccSplit" label="Amount to split to the GTCC" value={get('tlaGtccSplit')} onChange={(v) => set('tlaGtccSplit', v)} placeholder="Enter 0 if none" />
        <CheckField name="tlaHousingOverlap" label="TLA overlaps OHA, BAH or Government quarters" checked={flag('tlaHousingOverlap')} onChange={(v) => set('tlaHousingOverlap', v)} />
        {flag('tlaHousingOverlap') && (
          <AreaField name="tlaOverlapComment" label="Why the overlap is authorized" value={get('tlaOverlapComment')} onChange={(v) => set('tlaOverlapComment', v)} />
        )}
        <CheckField name="tlaReceiptsAttached" label="Itemized lodging receipts are attached" checked={flag('tlaReceiptsAttached')} onChange={(v) => set('tlaReceiptsAttached', v)} />
      </Step>

      <Step title="5. Housing search">
        <TextField name="tlaHousingOfficial" label="Housing official" value={get('tlaHousingOfficial')} onChange={(v) => set('tlaHousingOfficial', v)} />
        {log.map((entry, index) => (
          <div key={index} className="grid grid-cols-1 items-end gap-2 md:grid-cols-[10rem_1fr_auto]">
            <div>
              <Label htmlFor={`tlaHousingLog-${index}-date`}>{`Housing entry ${index + 1}, date`}</Label>
              <Input id={`tlaHousingLog-${index}-date`} type="date" className="mt-1" value={entry.date ?? ''} onChange={(e) => setLog(log.map((x, i) => (i === index ? { ...x, date: e.target.value } : x)))} />
            </div>
            <div>
              <Label htmlFor={`tlaHousingLog-${index}-action`}>{`Housing entry ${index + 1}, action`}</Label>
              <Input id={`tlaHousingLog-${index}-action`} className="mt-1" value={entry.action ?? ''} onChange={(e) => setLog(log.map((x, i) => (i === index ? { ...x, action: e.target.value } : x)))} />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove housing entry ${index + 1}`} onClick={() => setLog(log.filter((_, i) => i !== index))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLog([...log, { date: '', action: '' }])}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add housing entry
        </Button>
      </Step>

      <Step title="6. Certifications">
        <p className="text-sm text-muted-foreground">Switch on only what applies. Each prints with its own signature line.</p>
        <CheckField name="tlaCertMilitaryNecessity" label="Military necessity: TDY, deployment or hospitalization while keeping TLA lodging" checked={flag('tlaCertMilitaryNecessity')} onChange={(v) => set('tlaCertMilitaryNecessity', v)} />
        {flag('tlaCertMilitaryNecessity') && (
          <AreaField name="tlaMilitaryNecessityNote" label="Why the lodging was kept" value={get('tlaMilitaryNecessityNote')} onChange={(v) => set('tlaMilitaryNecessityNote', v)} />
        )}
        <CheckField name="tlaCertGovQuarters" label="Government quarters were not available" checked={flag('tlaCertGovQuarters')} onChange={(v) => set('tlaCertGovQuarters', v)} />
        {flag('tlaCertGovQuarters') && (
          <AreaField name="tlaGovQuartersNote" label="Who confirmed it, and when" value={get('tlaGovQuartersNote')} onChange={(v) => set('tlaGovQuartersNote', v)} />
        )}
        <CheckField name="tlaCertNearestLodging" label="Nearest suitable lodging: none available at the PDS" checked={flag('tlaCertNearestLodging')} onChange={(v) => set('tlaCertNearestLodging', v)} />
        {flag('tlaCertNearestLodging') && (
          <AreaField name="tlaNearestLodgingNote" label="Where the Marine lodged, and why" value={get('tlaNearestLodgingNote')} onChange={(v) => set('tlaNearestLodgingNote', v)} />
        )}
        <CheckField name="tlaCertBeforeOrders" label="TLA before the PCS order was issued" checked={flag('tlaCertBeforeOrders')} onChange={(v) => set('tlaCertBeforeOrders', v)} />
        {flag('tlaCertBeforeOrders') && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DateField name="tlaOrdersAdvisedDate" label="Date advised the order was coming" value={get('tlaOrdersAdvisedDate')} onChange={(v) => set('tlaOrdersAdvisedDate', v)} />
            <AreaField name="tlaBeforeOrdersNote" label="Who advised the Marine" value={get('tlaBeforeOrdersNote')} onChange={(v) => set('tlaBeforeOrdersNote', v)} />
          </div>
        )}
        <CheckField name="tlaCertEarlyTermination" label="Early termination: housing relinquished more than 10 days before departure" checked={flag('tlaCertEarlyTermination')} onChange={(v) => set('tlaCertEarlyTermination', v)} />
        {flag('tlaCertEarlyTermination') && (
          <div className="space-y-4">
            <PickField name="tlaEarlyTerminationReason" label="Reason housing was relinquished" value={get('tlaEarlyTerminationReason')} onChange={(v) => set('tlaEarlyTerminationReason', v)} options={TLA_EARLY_TERMINATION_REASONS} placeholder="Pick the reason" />
            <DateField name="tlaHousingRelinquishedDate" label="Date relinquished" value={get('tlaHousingRelinquishedDate')} onChange={(v) => set('tlaHousingRelinquishedDate', v)} />
            <AreaField name="tlaEarlyTerminationNote" label="Details" value={get('tlaEarlyTerminationNote')} onChange={(v) => set('tlaEarlyTerminationNote', v)} />
          </div>
        )}
      </Step>

      <Step title="7. Signature">
        <TextField name="tlaAuthorizingOfficial" label="Authorizing official" value={get('tlaAuthorizingOfficial')} onChange={(v) => set('tlaAuthorizingOfficial', v)} placeholder="Name and billet" />
      </Step>
    </div>
  );
}

function PeriodCard({ index, period, onChange, onRemove }: { index: number; period: TlaPeriod; onChange: (patch: Partial<TlaPeriod>) => void; onRemove: () => void }) {
  const n = index + 1;
  const id = (name: string) => `tlaPeriods-${index}-${name}`;
  const text = (name: keyof TlaPeriod, label: string, type: 'text' | 'date' = 'text') => (
    <div>
      <Label htmlFor={id(name)}>{`Period ${n}, ${label}`}</Label>
      <Input id={id(name)} type={type} className="mt-1" value={String(period[name] ?? '')} onChange={(e) => onChange({ [name]: e.target.value } as Partial<TlaPeriod>)} />
    </div>
  );
  return (
    <div className="space-y-3 rounded-md border border-border p-3" {...{ [FIELD_ATTRIBUTE]: `tlaPeriods.${index}` }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{`Period ${n}`}</h4>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove period ${n}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {text('startDate', 'first day', 'date')}
        {text('endDate', 'last day', 'date')}
        <div className="md:col-span-2">{text('lodgingName', 'lodging name and location')}</div>
        {text('dailyLodgingCost', 'daily lodging cost')}
        {text('dailyFees', 'daily tax and GTCC fees')}
        {text('dependents12Plus', 'dependents 12 or older')}
        {text('dependentsUnder12', 'dependents under 12')}
        <div>
          <Label htmlFor={id('coverage')}>{`Period ${n}, what is paid`}</Label>
          <Select value={period.coverage} onValueChange={(v) => onChange({ coverage: v as TlaCoverage })}>
            <SelectTrigger id={id('coverage')} className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COVERAGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={id('lodgingKind')}>{`Period ${n}, lodging type`}</Label>
          <Select value={period.lodgingKind} onValueChange={(v) => onChange({ lodgingKind: v as TlaLodgingKind })}>
            <SelectTrigger id={id('lodgingKind')} className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LODGING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {text('extraRoomCharge', 'extra room charge, first day only')}
      </div>
      <CheckField name={id('memberOccupying')} label={`Period ${n}: the Marine is in the lodging`} checked={period.memberOccupying} onChange={(v) => onChange({ memberOccupying: v })} />
      <CheckField name={id('kitchen')} label={`Period ${n}: the lodging has an adequate kitchen`} checked={period.kitchen} onChange={(v) => onChange({ kitchen: v })} />
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ name, label, className, children }: { name: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} {...{ [FIELD_ATTRIBUTE]: name }}>
      <Label htmlFor={name}>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TextField({ name, label, value, onChange, placeholder, className }: { name: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <Field name={name} label={label} className={className}>
      <Input id={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}

function DateField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field name={name} label={label}>
      <Input id={name} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function AreaField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field name={name} label={label}>
      <Textarea id={name} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function PickField({ name, label, value, onChange, options, placeholder }: { name: string; label: string; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[]; placeholder: string }) {
  return (
    <Field name={name} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={name}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

function CheckField({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-2" {...{ [FIELD_ATTRIBUTE]: name }}>
      <Checkbox id={name} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={name} className="font-normal">{label}</Label>
    </div>
  );
}
