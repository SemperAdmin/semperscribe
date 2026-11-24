'use client';

/**
 * DD Form 1561 (DEC 2017), Statement to Substantiate Payment of Family
 * Separation Allowance: the guided editor (spec docs/DD1561_FSA_SPEC.md P2,
 * Phase 3). Every input writes to formData directly, the TLA Packet pattern,
 * so the eligibility panel, the day counter and the derived check boxes read
 * back while the Marine types. No DynamicForm instance, so nothing clobbers.
 *
 * Five steps, in the order a Marine thinks about the claim:
 *  1. Do you qualify?               dependency facts, live eligibility panel
 *  2. What kind of separation?      situation cards -> dd1561FsaType
 *  3. Dates                         type-specific rows, live qualifying-day count, block 8g
 *  4. Your certification            derived 8a-8g checklist, blocks 1-4, 7, 9a
 *  5. Orders and certifying official blocks 13, 14, optional 15a-c and 16
 *
 * Owner decisions (binding): the 10-digit EDIPI, never an SSN; no dollar
 * figure anywhere, qualifying days only; blocks 15a-c and 16 optional and
 * never defaulted; both signatures (9b, 15d) always left blank. The rules
 * live in src/lib/dd1561-rules.ts; this file only presents them.
 */

import React, { useId, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Anchor, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, ChevronUp, ClipboardCheck,
  FileSignature, Info, Plane, Plus, Square, Trash2, Truck, Users,
} from 'lucide-react';
import { FIELD_ATTRIBUTE } from '@/lib/field-focus';
import { parseIsoLocalDate } from '@/lib/date-utils';
import type { FormData } from '@/types';
import {
  DD1561_EMPTY_FSA_T_ROW,
  DD1561_EMPTY_SHIP_SEGMENT,
  type Dd1561FsaTRow,
  type Dd1561FsaType,
  type Dd1561ShipSegment,
  type Dd1561ShipSegmentStatus,
} from '@/types/dd1561';
import {
  DD1561_FORM_FSA_T_ROWS,
  DD1561_QUALIFYING_THRESHOLD,
  addDays,
  dd1561CheckBoxes,
  dd1561DayCount,
  dd1561Type,
  evaluateDd1561Eligibility,
  fsaTCountFor,
  isValidEdipi,
  type Dd1561CheckBoxes,
  type Dd1561DayCount,
  type Dd1561Finding,
} from '@/lib/dd1561-rules';

interface Dd1561SectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

interface StepProps {
  formData: FormData;
  set: (name: string, value: unknown) => void;
}

const FMR = 'DoD FMR Vol 7A Ch 27';

// ---------------------------------------------------------------------------
// Small readers and formatters
// ---------------------------------------------------------------------------

const text = (data: FormData, key: string): string => String(data[key] ?? '');
const yesNo = (data: FormData, key: string): boolean | undefined =>
  data[key] === true ? true : data[key] === false ? false : undefined;

/** "30 May 2026" for an ISO date; '' when not a date. Local, never UTC. */
export function longDate(iso: string): string {
  const d = parseIsoLocalDate(iso ?? '');
  return d ? format(d, 'd MMM yyyy') : '';
}

const toIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayWord = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;

const asCount = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function SectionCard({ icon, title, intro, children, testId }: {
  icon: React.ReactNode;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className="shadow-sm border-border mb-6" data-testid={testId}>
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="flex items-center text-lg font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

interface Choice { value: string; label: string; hint?: string }

/** A single-answer question: fieldset + legend around a radio group. */
function ChoiceQuestion({ name, legend, hint, value, options, onChange, columns = 2 }: {
  name: string;
  legend: string;
  hint?: React.ReactNode;
  value: string;
  options: readonly Choice[];
  onChange: (v: string) => void;
  /** 'wrap' lays short options out in a row that wraps (the editor column is narrow). */
  columns?: 2 | 'wrap';
}) {
  const legendId = `${name}-legend`;
  const hintId = hint ? `${name}-hint` : undefined;
  const layout = columns === 'wrap' ? 'flex flex-wrap gap-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-2';
  return (
    <fieldset className="space-y-2" {...{ [FIELD_ATTRIBUTE]: name }}>
      <legend id={legendId} className="text-sm font-medium leading-snug">{legend}</legend>
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      <RadioGroup
        aria-labelledby={legendId}
        aria-describedby={hintId}
        value={value}
        onValueChange={onChange}
        className={layout}
      >
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const selected = value === o.value;
          return (
            <Label
              key={o.value}
              htmlFor={id}
              className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 font-normal ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <RadioGroupItem id={id} value={o.value} className="mt-0.5 shrink-0" />
              <span>
                {o.label}
                {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

const YES_NO: readonly Choice[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

function YesNoQuestion({ name, legend, hint, value, onChange }: {
  name: string;
  legend: string;
  hint?: React.ReactNode;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <ChoiceQuestion
      name={name}
      legend={legend}
      hint={hint}
      value={value === true ? 'yes' : value === false ? 'no' : ''}
      options={YES_NO}
      onChange={(v) => onChange(v === 'yes')}
    />
  );
}

function Field({ name, label, hint, error, className, children }: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} {...{ [FIELD_ATTRIBUTE]: name }}>
      <Label htmlFor={name} id={`${name}-label`}>{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({ name, label, value, onChange, placeholder, hint, error, className, inputMode, maxLength }: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}) {
  const describedBy = [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <Field name={name} label={label} hint={hint} error={error} className={className}>
      <Input
        id={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

/** The shared DatePicker over an ISO yyyy-mm-dd string. */
function DateField({ name, label, value, onChange, hint, className }: {
  name: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  className?: string;
}) {
  const current = parseIsoLocalDate(value ?? '');
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      <DatePicker
        id={name}
        aria-labelledby={`${name}-label ${name}`}
        aria-describedby={hint ? `${name}-hint` : undefined}
        date={current ?? undefined}
        setDate={(d) => onChange(d ? toIso(d) : '')}
      />
    </Field>
  );
}

function CountField({ name, label, value, onChange, hint }: {
  name: string;
  label: string;
  value: unknown;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <Field name={name} label={label} hint={hint}>
      <Input
        id={name}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        className="max-w-[10rem]"
        value={String(asCount(value))}
        onChange={(e) => onChange(asCount(e.target.value))}
        aria-describedby={hint ? `${name}-hint` : undefined}
      />
    </Field>
  );
}

function CheckField({ name, label, checked, onChange, hint }: {
  name: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3" {...{ [FIELD_ATTRIBUTE]: name }}>
      <Checkbox
        id={name}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 h-5 w-5"
        aria-describedby={hint ? `${name}-hint` : undefined}
      />
      <div>
        <Label htmlFor={name} className="font-normal leading-snug cursor-pointer">{label}</Label>
        {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** A plain note; icon is decorative, the words carry the meaning. */
function Note({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="flex gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm" data-testid={testId}>
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function Finding({ f }: { f: Dd1561Finding }) {
  return (
    <li className="rounded-md border border-border bg-background p-3 text-sm" data-testid={`dd1561-finding-${f.code}`}>
      {f.message}
      <span className="mt-1 block text-xs text-muted-foreground">{f.citation}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Do you qualify?
// ---------------------------------------------------------------------------

const MARITAL_OPTIONS: readonly Choice[] = [
  { value: 'married', label: 'Married' },
  { value: 'never-married', label: 'Never married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'legally-separated', label: 'Legally separated' },
  { value: 'widowed', label: 'Widowed' },
];

const CUSTODY_OPTIONS: readonly Choice[] = [
  { value: 'member', label: 'I have legal custody' },
  { value: 'joint-14-plus', label: 'Joint custody, and they live with me 14 or more days a month' },
  { value: 'joint-under-14', label: 'Joint custody, and they live with me fewer than 14 days a month' },
  { value: 'other-person', label: 'Someone else has legal custody' },
];

const WAS_OPTIONS: readonly Choice[] = [
  { value: 'was', label: 'Yes, we were living together' },
  { value: 'was-not', label: 'No, we were not living together' },
];

/** True once the Marine has answered anything in step 1. */
function answeredAnything(data: FormData): boolean {
  if (text(data, 'dd1561MaritalStatus')) return true;
  return [
    'dd1561HasChildren', 'dd1561ClaimsParent', 'dd1561DependentOnActiveDuty', 'dd1561SoleDependentInstitutionalized',
    'dd1561AllDependentsNear', 'dd1561DualMilitary', 'dd1561PermissiveOrders', 'dd1561Mobilized',
  ].some((k) => yesNo(data, k) !== undefined);
}

export function EligibilityPanel({ formData }: { formData: FormData }) {
  const elig = evaluateDd1561Eligibility(formData);
  const started = answeredAnything(formData);
  // Choosing the type is step 2's job: say so as a next step, not a finding.
  const typePending = elig.blockers.some((b) => b.code === 'type-missing');
  const blockers = elig.blockers.filter((b) => b.code !== 'type-missing');
  const qualifies = blockers.length === 0;
  return (
    <section
      aria-labelledby="dd1561-eligibility-title"
      className={`rounded-lg border-2 p-4 ${started && qualifies ? 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30' : 'border-border bg-muted/30'}`}
      data-testid="dd1561-eligibility"
    >
      <h4 id="dd1561-eligibility-title" className="text-base font-semibold">What the regulation says so far</h4>
      <div role="status" aria-live="polite" className="mt-2 space-y-3">
        {!started ? (
          <p className="text-sm text-muted-foreground">Answer the questions above to see how they line up with the FSA rules.</p>
        ) : qualifies ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-300" data-testid="dd1561-qualifies">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            Appears to qualify{typePending ? '. Next, choose the kind of separation in step 2.' : '.'}
          </p>
        ) : (
          <div>
            <p className="text-sm font-semibold">These answers do not fit the FSA rules as written:</p>
            <ul className="mt-2 space-y-2" aria-label="Points that do not fit the rules">
              {blockers.map((b) => <Finding key={b.code} f={b} />)}
            </ul>
          </div>
        )}
        {started && elig.warnings.length > 0 && (
          <div>
            <p className="text-sm font-semibold">Notes for you and the certifying official:</p>
            <ul className="mt-2 space-y-2" aria-label="Notes">
              {elig.warnings.map((w) => <Finding key={w.code} f={w} />)}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This is a guide to {FMR}. The certifying official reviews the facts and decides the entitlement.
      </p>
    </section>
  );
}

function QualifyStep({ formData, set }: StepProps) {
  const hasChildren = yesNo(formData, 'dd1561HasChildren');
  const claimsParent = yesNo(formData, 'dd1561ClaimsParent');
  const dualMil = yesNo(formData, 'dd1561DualMilitary');
  const mobilized = yesNo(formData, 'dd1561Mobilized');
  const spouseEdipi = text(formData, 'dd1561SpouseEdipi');
  return (
    <SectionCard
      icon={<Users className="mr-2 h-5 w-5" aria-hidden="true" />}
      title="1. Do you qualify?"
      intro="FSA is for a Marine with dependents, or married to another service member, whose orders keep the family apart. Answer for the day you received the orders."
      testId="dd1561-step-qualify"
    >
      <ChoiceQuestion
        name="dd1561MaritalStatus"
        legend="What is your marital status?"
        value={text(formData, 'dd1561MaritalStatus')}
        options={MARITAL_OPTIONS}
        onChange={(v) => set('dd1561MaritalStatus', v)}
        columns="wrap"
      />

      <YesNoQuestion
        name="dd1561HasChildren"
        legend="Are you claiming one or more children?"
        value={hasChildren}
        onChange={(v) => set('dd1561HasChildren', v)}
      />
      {hasChildren && (
        <div className="ml-4 border-l-2 border-border pl-4">
          <ChoiceQuestion
            name="dd1561ChildCustody"
            legend="Who had legal custody of the child(ren) when you received the orders?"
            hint="Joint custody counts only with a court order, divorce decree or notarized custody affidavit that shows it."
            value={text(formData, 'dd1561ChildCustody')}
            options={CUSTODY_OPTIONS}
            onChange={(v) => set('dd1561ChildCustody', v)}
          />
        </div>
      )}

      <YesNoQuestion
        name="dd1561ClaimsParent"
        legend="Are you claiming a parent?"
        value={claimsParent}
        onChange={(v) => set('dd1561ClaimsParent', v)}
      />
      {claimsParent && (
        <div className="ml-4 space-y-4 border-l-2 border-border pl-4">
          <YesNoQuestion
            name="dd1561ParentDependencyApproved"
            legend="Does the parent have a current, approved dependency determination?"
            value={yesNo(formData, 'dd1561ParentDependencyApproved')}
            onChange={(v) => set('dd1561ParentDependencyApproved', v)}
          />
          <YesNoQuestion
            name="dd1561ParentResidesWithMember"
            legend="Does the parent live in the home you keep up for both of you?"
            value={yesNo(formData, 'dd1561ParentResidesWithMember')}
            onChange={(v) => set('dd1561ParentResidesWithMember', v)}
          />
        </div>
      )}

      {(hasChildren || claimsParent) && (
        <YesNoQuestion
          name="dd1561DependentOnActiveDuty"
          legend="Is any dependent other than your spouse on active duty?"
          hint="A dependent who draws active-duty basic pay is not counted for FSA. Your other dependents still count."
          value={yesNo(formData, 'dd1561DependentOnActiveDuty')}
          onChange={(v) => set('dd1561DependentOnActiveDuty', v)}
        />
      )}

      <YesNoQuestion
        name="dd1561SoleDependentInstitutionalized"
        legend="Is your only dependent in an institution (for example a hospital or care facility) for more than a year?"
        value={yesNo(formData, 'dd1561SoleDependentInstitutionalized')}
        onChange={(v) => set('dd1561SoleDependentInstitutionalized', v)}
      />

      <YesNoQuestion
        name="dd1561AllDependentsNear"
        legend="Do all of your dependents live at or near the place this claim is about?"
        hint="Near means within 50 miles or 1.5 hours one way, or you commute daily. The place is the new duty station for a PCS, the TDY location for TDY, or the port the ship is in."
        value={yesNo(formData, 'dd1561AllDependentsNear')}
        onChange={(v) => set('dd1561AllDependentsNear', v)}
      />

      <YesNoQuestion
        name="dd1561DualMilitary"
        legend="Are you married to another member on active duty?"
        value={dualMil}
        onChange={(v) => set('dd1561DualMilitary', v)}
      />
      {dualMil && (
        <fieldset className="ml-4 space-y-4 border-l-2 border-border pl-4">
          <legend className="sr-only">Your spouse (block 8f)</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              name="dd1561SpouseEdipi"
              label="Spouse's DoD ID (EDIPI)"
              value={spouseEdipi}
              onChange={(v) => set('dd1561SpouseEdipi', v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10 digits"
              inputMode="numeric"
              maxLength={10}
              hint="The 10-digit DoD ID on the CAC. Never a Social Security number."
              error={spouseEdipi && !isValidEdipi(spouseEdipi) ? 'Enter all 10 digits of the DoD ID (EDIPI).' : undefined}
            />
            <TextField
              name="dd1561SpouseBranchComponent"
              label="Spouse's branch and component"
              value={text(formData, 'dd1561SpouseBranchComponent')}
              onChange={(v) => set('dd1561SpouseBranchComponent', v)}
              placeholder="USN ACTIVE"
            />
          </div>
          <ChoiceQuestion
            name="dd1561SpouseResidingTogether"
            legend="Were you and your spouse living together right before the orders separated you?"
            value={text(formData, 'dd1561SpouseResidingTogether')}
            options={WAS_OPTIONS}
            onChange={(v) => set('dd1561SpouseResidingTogether', v)}
          />
          <YesNoQuestion
            name="dd1561SpouseReceivingFsa"
            legend="Is your spouse already receiving FSA for this same period?"
            value={yesNo(formData, 'dd1561SpouseReceivingFsa')}
            onChange={(v) => set('dd1561SpouseReceivingFsa', v)}
          />
        </fieldset>
      )}

      <YesNoQuestion
        name="dd1561PermissiveOrders"
        legend="Are these permissive orders (travel you asked for, not directed by the command)?"
        value={yesNo(formData, 'dd1561PermissiveOrders')}
        onChange={(v) => set('dd1561PermissiveOrders', v)}
      />

      <YesNoQuestion
        name="dd1561Mobilized"
        legend="Are you a Reserve Component Marine mobilized to active duty?"
        value={mobilized}
        onChange={(v) => set('dd1561Mobilized', v)}
      />
      {mobilized && (
        <div className="ml-4 border-l-2 border-border pl-4 md:max-w-sm">
          <DateField
            name="dd1561MobilizedDepartureDate"
            label="6. Date you left home for the unit home station"
            hint="Reserve members only. The day you left your home of residence to report to your unit's home station on your mobilization orders."
            value={text(formData, 'dd1561MobilizedDepartureDate')}
            onChange={(v) => set('dd1561MobilizedDepartureDate', v)}
          />
        </div>
      )}

      <EligibilityPanel formData={formData} />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Step 2: What kind of separation?
// ---------------------------------------------------------------------------

const SITUATIONS: ReadonlyArray<{ value: Dd1561FsaType; title: string; body: string; code: string; icon: React.ReactNode }> = [
  {
    value: 'R',
    title: "PCS where my family can't come with me",
    body: 'Permanent change of station where the government will not move your dependents to or near the new duty station.',
    code: 'FSA-R (Restricted)',
    icon: <Truck className="h-5 w-5" aria-hidden="true" />,
  },
  {
    value: 'S',
    title: 'Aboard ship away from homeport',
    body: 'Duty aboard a ship, or with a unit embarked on one, that is away from its homeport for more than 30 continuous days.',
    code: 'FSA-S (Ship)',
    icon: <Anchor className="h-5 w-5" aria-hidden="true" />,
  },
  {
    value: 'T',
    title: 'TDY/TAD for more than 30 days',
    body: 'Temporary duty away from your permanent duty station for more than 30 continuous days, with your dependents not living near the TDY location.',
    code: 'FSA-T (Temporary)',
    icon: <Plane className="h-5 w-5" aria-hidden="true" />,
  },
];

function TypeStep({ formData, set }: StepProps) {
  const type = dd1561Type(formData);
  return (
    <SectionCard
      icon={<ClipboardCheck className="mr-2 h-5 w-5" aria-hidden="true" />}
      title="2. What kind of separation?"
      intro="Pick the one that matches your orders. Only one FSA is paid for a period."
      testId="dd1561-step-type"
    >
      <fieldset {...{ [FIELD_ATTRIBUTE]: 'dd1561FsaType' }}>
        <legend id="dd1561FsaType-legend" className="sr-only">Kind of separation (block 5)</legend>
        <RadioGroup
          aria-labelledby="dd1561FsaType-legend"
          value={type}
          onValueChange={(v) => set('dd1561FsaType', v)}
          className="grid grid-cols-1 gap-3"
        >
          {SITUATIONS.map((s) => {
            const id = `dd1561FsaType-${s.value}`;
            const selected = type === s.value;
            return (
              <Label
                key={s.value}
                htmlFor={id}
                className={`flex cursor-pointer gap-3 rounded-lg border-2 p-4 font-normal ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                data-testid={`dd1561-situation-${s.value}`}
              >
                <RadioGroupItem
                  id={id}
                  value={s.value}
                  className="mt-1 shrink-0"
                  aria-labelledby={`${id}-title`}
                  aria-describedby={`${id}-body`}
                />
                <span className="space-y-1">
                  <span id={`${id}-title`} className="flex items-center gap-2 text-base font-semibold">
                    {s.icon}
                    {s.title}
                  </span>
                  <span id={`${id}-body`} className="block text-sm text-muted-foreground">{s.body}</span>
                  <span className="block text-xs font-medium">
                    {selected ? `Selected: ${s.code}` : s.code}
                  </span>
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      </fieldset>

      {type === 'R' && (
        <div className="space-y-4 rounded-md border border-border p-4" data-testid="dd1561-fsa-r-questions">
          <p className="text-sm font-medium">A few more questions for a PCS:</p>
          <YesNoQuestion
            name="dd1561FsaRElectedUnaccompanied"
            legend="Did you choose an unaccompanied tour where an accompanied tour is authorized?"
            value={yesNo(formData, 'dd1561FsaRElectedUnaccompanied')}
            onChange={(v) => set('dd1561FsaRElectedUnaccompanied', v)}
          />
          <YesNoQuestion
            name="dd1561FsaRTransportAuthorized"
            legend="Is moving your dependents to or near the new duty station authorized at government expense?"
            value={yesNo(formData, 'dd1561FsaRTransportAuthorized')}
            onChange={(v) => set('dd1561FsaRTransportAuthorized', v)}
          />
          <YesNoQuestion
            name="dd1561FsaRCertifiedMedical"
            legend="Is a dependent unable to come for a certified medical reason?"
            value={yesNo(formData, 'dd1561FsaRCertifiedMedical')}
            onChange={(v) => set('dd1561FsaRCertifiedMedical', v)}
          />
          <YesNoQuestion
            name="dd1561FsaRSecretarialWaiver"
            legend="Was a Secretarial waiver granted for unusual family or operational circumstances?"
            value={yesNo(formData, 'dd1561FsaRSecretarialWaiver')}
            onChange={(v) => set('dd1561FsaRSecretarialWaiver', v)}
          />
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Dates and the qualifying-day count
// ---------------------------------------------------------------------------

function DayCounter({ count, label }: { count: Dd1561DayCount; label: string }) {
  const counted = count.periods.filter((p) => p.days !== null);
  const open = count.openEnded ? count.periods[count.periods.length - 1] : undefined;
  return (
    <div
      className={`rounded-lg border-2 p-4 ${count.exceedsThirty ? 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/30' : 'border-border bg-muted/30'}`}
      data-testid="dd1561-day-counter"
    >
      <h4 className="text-base font-semibold">Qualifying days</h4>
      <div role="status" aria-live="polite" className="mt-1 space-y-1 text-sm">
        {counted.length === 0 && !open ? (
          <p className="text-muted-foreground">Enter the dates above to count the days.</p>
        ) : (
          <>
            {counted.length > 0 && (
              <p className="text-lg font-semibold" data-testid="dd1561-day-total">
                {count.qualifyingDays} qualifying days. More than {DD1561_QUALIFYING_THRESHOLD}: {count.exceedsThirty ? 'yes' : 'no'}.
              </p>
            )}
            {counted.length > 1 && (
              <ul className="list-disc pl-5" aria-label="Separate periods">
                {counted.map((p) => (
                  <li key={`${p.from}-${p.to}`}>{longDate(p.from)} to {longDate(p.to)}: {dayWord(p.days ?? 0)}</li>
                ))}
              </ul>
            )}
            {open && (
              <p data-testid="dd1561-still-deployed">
                Still deployed since {longDate(open.from)}. The period passes {DD1561_QUALIFYING_THRESHOLD} days on {longDate(addDays(open.from, DD1561_QUALIFYING_THRESHOLD))}.
              </p>
            )}
            {counted.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {label} Counts the day you leave, the day you return and the 31st of a month.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FsaTRows({ formData, set }: StepProps) {
  const raw = (formData.dd1561FsaTRows as Dd1561FsaTRow[] | undefined) ?? [];
  const rows: Dd1561FsaTRow[] = raw.length > 0 ? raw.map((r) => ({ ...DD1561_EMPTY_FSA_T_ROW, ...r })) : [{ ...DD1561_EMPTY_FSA_T_ROW }];
  const setRows = (next: Dd1561FsaTRow[]) => set('dd1561FsaTRows', next);
  const patch = (i: number, p: Partial<Dd1561FsaTRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const count = fsaTCountFor(formData);
  const leaveBefore = asCount(formData.dd1561FsaTLeaveBeforeDays);
  const leaveAfter = asCount(formData.dd1561FsaTLeaveAfterDays);
  return (
    <div className="space-y-4">
      <fieldset className="space-y-3" {...{ [FIELD_ATTRIBUTE]: 'dd1561FsaTRows' }}>
        <legend className="text-sm font-medium">Block 10. Where you went and when</legend>
        <p className="text-xs text-muted-foreground">
          One row per TDY location, in order. Row 1 starts the day you actually left your duty station; the last row ends the day you actually got back. Enter leave separately below.
        </p>
        {rows.map((r, i) => {
          const n = i + 1;
          const id = (k: string) => `dd1561FsaTRow${n}-${k}`;
          return (
            <div key={i} className="rounded-lg border border-border p-3 space-y-3" data-testid={`dd1561-fsa-t-row-${n}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Row {n}{n > DD1561_FORM_FSA_T_ROWS ? ' (continuation page)' : ''}</p>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${n}`}>
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField name={id('location')} label={`Row ${n} location`} value={r.location} onChange={(v) => patch(i, { location: v })} placeholder="CITY, STATE" className="sm:col-span-2" />
                <DateField
                  name={id('from')}
                  label={`Row ${n} from`}
                  hint={i === 0
                    ? 'The day you actually left your permanent duty station for the TDY, from your endorsed orders or travel voucher. Enter it as it happened; leave and travel are applied below.'
                    : 'The day you started at this location, for example the day you arrived after moving from the previous TDY site.'}
                  value={r.from}
                  onChange={(v) => patch(i, { from: v })}
                />
                <DateField
                  name={id('to')}
                  label={`Row ${n} to`}
                  hint={i === rows.length - 1
                    ? 'The day you actually got back to your permanent duty station, from your endorsed orders or travel voucher.'
                    : 'The last day at this location before moving to the next one.'}
                  value={r.to}
                  onChange={(v) => patch(i, { to: v })}
                />
              </div>
              {i > 0 && (
                <CheckField
                  name={id('interrupted')}
                  label={`The TDY was interrupted before row ${n}`}
                  hint="You were released from the TDY or went back to your duty station to resume duty there. Leave, a hospital stay or a short visit home is not an interruption."
                  checked={r.interruptedBefore === true}
                  onChange={(v) => patch(i, { interruptedBefore: v })}
                />
              )}
              {count.rows[i] && count.rows[i].days !== null && (
                <p className="text-xs text-muted-foreground">Prints as {count.rows[i].inclusiveDates}, {dayWord(count.rows[i].days ?? 0)}.</p>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={() => setRows([...rows, { ...DD1561_EMPTY_FSA_T_ROW }])}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add a TDY location
        </Button>
        {rows.length > DD1561_FORM_FSA_T_ROWS && (
          <Note testId="dd1561-continuation-note">
            The form has room for {DD1561_FORM_FSA_T_ROWS} rows. Rows {DD1561_FORM_FSA_T_ROWS + 1} and later print on a continuation page attached to the form.
          </Note>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4">
        <CountField
          name="dd1561FsaTLeaveBeforeDays"
          label="Days of leave or proceed time before traveling to the TDY"
          hint="Leave, proceed or permissive days you used after checking out of your duty station and before you started travel to the TDY. Those days come off the start of the count."
          value={formData.dd1561FsaTLeaveBeforeDays}
          onChange={(n) => set('dd1561FsaTLeaveBeforeDays', n)}
        />
        <CountField
          name="dd1561FsaTLeaveAfterDays"
          label="Days of leave before getting back to your duty station"
          hint="Leave you took after the TDY ended and before you reported back. Those days come off the end of the count."
          value={formData.dd1561FsaTLeaveAfterDays}
          onChange={(n) => set('dd1561FsaTLeaveAfterDays', n)}
        />
        <DateField
          name="dd1561FsaTFirstTravelDate"
          label="First day of authorized travel (optional)"
          hint="Only if your orders say travel may not begin before a certain date. The count never starts before it. Leave empty if your orders do not say."
          value={text(formData, 'dd1561FsaTFirstTravelDate')}
          onChange={(v) => set('dd1561FsaTFirstTravelDate', v)}
        />
      </div>
      {(leaveBefore > 0 || leaveAfter > 0) && count.constructiveDeparture && count.constructiveReturn && (
        <Note testId="dd1561-constructive-dates">
          With leave taken out, the count runs from {longDate(count.constructiveDeparture)} to {longDate(count.constructiveReturn)} ({FMR} par 4.4.1.2).
        </Note>
      )}
    </div>
  );
}

const SEGMENT_STATUSES: ReadonlyArray<{ value: Dd1561ShipSegmentStatus; label: string }> = [
  { value: 'away', label: 'Aboard ship away from homeport' },
  { value: 'remain-aboard-orders', label: 'At homeport under orders to stay aboard' },
  { value: 'remain-aboard-disciplinary', label: 'Kept aboard at homeport for disciplinary reasons' },
];

function FsaSSegments({ formData, set }: StepProps) {
  const raw = (formData.dd1561FsaSSegments as Dd1561ShipSegment[] | undefined) ?? [];
  const segs: Dd1561ShipSegment[] = raw.length > 0 ? raw.map((s) => ({ ...DD1561_EMPTY_SHIP_SEGMENT, ...s })) : [{ ...DD1561_EMPTY_SHIP_SEGMENT }];
  const setSegs = (next: Dd1561ShipSegment[]) => set('dd1561FsaSSegments', next);
  const patch = (i: number, p: Partial<Dd1561ShipSegment>) => setSegs(segs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const [stillDeployed, setStillDeployed] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="dd1561FsaSShipUnit"
          label="12a. Name of ship or unit"
          value={text(formData, 'dd1561FsaSShipUnit')}
          onChange={(v) => set('dd1561FsaSShipUnit', v)}
          placeholder="USS SAMPLE (LHD 0)"
        />
        <TextField
          name="dd1561FsaSHomeport"
          label="12b. Homeport"
          value={text(formData, 'dd1561FsaSHomeport')}
          onChange={(v) => set('dd1561FsaSHomeport', v)}
          placeholder="SAN DIEGO, CA"
        />
      </div>
      <fieldset className="space-y-3" {...{ [FIELD_ATTRIBUTE]: 'dd1561FsaSSegments' }}>
        <legend className="text-sm font-medium">Time aboard</legend>
        <p className="text-xs text-muted-foreground">
          Start with the day the ship left homeport, or the day you joined it away from homeport. Add a stretch for a second ship or for days at homeport under orders to stay aboard; back-to-back stretches count as one period.
        </p>
        {segs.map((s, i) => {
          const n = i + 1;
          const id = (k: string) => `dd1561FsaSSeg${n}-${k}`;
          const open = stillDeployed[i] ?? Boolean(s.from && !s.to);
          return (
            <div key={i} className="rounded-lg border border-border p-3 space-y-3" data-testid={`dd1561-fsa-s-seg-${n}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Stretch {n}</p>
                {segs.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSegs(segs.filter((_, j) => j !== i));
                      // Keyed by index: shift the later stretches' choices down one.
                      setStillDeployed((prev) => {
                        const next: Record<number, boolean> = {};
                        for (const [k, v] of Object.entries(prev)) {
                          const idx = Number(k);
                          if (idx < i) next[idx] = v;
                          else if (idx > i) next[idx - 1] = v;
                        }
                        return next;
                      });
                    }}
                    aria-label={`Remove stretch ${n}`}
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field name={id('status')} label={`Stretch ${n} status`} className="sm:col-span-2">
                  <Select value={s.status} onValueChange={(v) => patch(i, { status: v as Dd1561ShipSegmentStatus })}>
                    <SelectTrigger id={id('status')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEGMENT_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField name={id('ship')} label={`Stretch ${n} ship or unit`} value={s.shipUnit ?? ''} onChange={(v) => patch(i, { shipUnit: v })} />
                <DateField
                  name={id('from')}
                  label={`Stretch ${n} from`}
                  hint="The day the ship left homeport with you aboard, or the day you joined the ship if it was already away from homeport."
                  value={s.from}
                  onChange={(v) => patch(i, { from: v })}
                />
                {open ? (
                  <p className="self-end pb-2 text-sm text-muted-foreground">No return date: still deployed.</p>
                ) : (
                  <DateField
                    name={id('to')}
                    label={`Stretch ${n} to`}
                    hint="The day the ship returned to homeport, or the day you were detached from the ship."
                    value={s.to}
                    onChange={(v) => patch(i, { to: v })}
                  />
                )}
              </div>
              <CheckField
                name={id('open')}
                label="Still deployed"
                checked={open}
                onChange={(v) => {
                  setStillDeployed((prev) => ({ ...prev, [i]: v }));
                  if (v) patch(i, { to: '' });
                }}
              />
            </div>
          );
        })}
        <Button type="button" variant="outline" onClick={() => setSegs([...segs, { ...DD1561_EMPTY_SHIP_SEGMENT }])}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add a stretch
        </Button>
      </fieldset>
    </div>
  );
}

function FsaRDetails({ formData, set }: StepProps) {
  const count = dd1561DayCount(formData);
  const r = count.fsaR;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Block 11. Your PCS</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="dd1561FsaRLastPds" label="Last permanent duty station" value={text(formData, 'dd1561FsaRLastPds')} onChange={(v) => set('dd1561FsaRLastPds', v)} placeholder="CAMP SAMPLE, NC" />
        <DateField name="dd1561FsaRDetachDate" label="Date you departed (detached)" hint="The day you checked out of your last duty station, from the detaching endorsement on your PCS orders." value={text(formData, 'dd1561FsaRDetachDate')} onChange={(v) => set('dd1561FsaRDetachDate', v)} />
        <DateField name="dd1561FsaRLeaveFrom" label="Leave en route, from" hint="First day of leave taken on the way to the new station, from your orders endorsements or leave record. Leave empty if you took none." value={text(formData, 'dd1561FsaRLeaveFrom')} onChange={(v) => set('dd1561FsaRLeaveFrom', v)} />
        <DateField name="dd1561FsaRLeaveTo" label="Leave en route, to" hint="Last day of that leave." value={text(formData, 'dd1561FsaRLeaveTo')} onChange={(v) => set('dd1561FsaRLeaveTo', v)} />
        <DateField name="dd1561FsaRProceedFrom" label="Proceed time, from" hint="First day of proceed time authorized on your orders. Leave empty if you used none." value={text(formData, 'dd1561FsaRProceedFrom')} onChange={(v) => set('dd1561FsaRProceedFrom', v)} />
        <DateField name="dd1561FsaRProceedTo" label="Proceed time, to" hint="Last day of proceed time." value={text(formData, 'dd1561FsaRProceedTo')} onChange={(v) => set('dd1561FsaRProceedTo', v)} />
        <TextField name="dd1561FsaRNewPds" label="New permanent duty station" value={text(formData, 'dd1561FsaRNewPds')} onChange={(v) => set('dd1561FsaRNewPds', v)} placeholder="CAMP SAMPLE, JAPAN" />
        <DateField name="dd1561FsaRReportDate" label="Date you reported" hint="The day you checked in at the new duty station, from the reporting endorsement on your orders." value={text(formData, 'dd1561FsaRReportDate')} onChange={(v) => set('dd1561FsaRReportDate', v)} />
        <DateField
          name="dd1561FsaRFirstTravelDate"
          label="First day of authorized travel (optional)"
          hint="Only if your orders say travel may not begin before a certain date. FSA-R never starts before it. Leave empty if your orders do not say."
          value={text(formData, 'dd1561FsaRFirstTravelDate')}
          onChange={(v) => set('dd1561FsaRFirstTravelDate', v)}
        />
      </div>
      <div className="rounded-lg border-2 border-border bg-muted/30 p-4" data-testid="dd1561-fsa-r-start">
        <h4 className="text-base font-semibold">When FSA-R starts</h4>
        <div role="status" aria-live="polite" className="mt-1 text-sm">
          {r?.startDate ? (
            <p>
              <span className="font-semibold">{longDate(r.startDate)}</span>: the day you departed plus {dayWord(r.leaveDays)} of leave en route and {dayWord(r.proceedDays)} of proceed time. No FSA-R accrues during leave en route or proceed time ({FMR} Table 27-1 rules 1-2, Table 27-4 note 4).
            </p>
          ) : (
            <p className="text-muted-foreground">Enter the date you departed to see the start date.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RedeploymentQuestion({ formData, set, count }: StepProps & { count: Dd1561DayCount }) {
  const last = text(formData, 'dd1561LastTdyWithin30');
  const r = count.redeployment;
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <ChoiceQuestion
        name="dd1561LastTdyWithin30"
        legend="8g. Did your last TDY or deployment end within 30 days before this one started?"
        value={last}
        options={[
          { value: 'was', label: 'Yes, within 30 days' },
          { value: 'was-not', label: 'No' },
        ]}
        onChange={(v) => set('dd1561LastTdyWithin30', v)}
      />
      {last === 'was' && (
        <div className="ml-4 space-y-4 border-l-2 border-border pl-4">
          <ChoiceQuestion
            name="dd1561PriorPeriodType"
            legend="What was the earlier period?"
            hint="TDY days and ship days are never added together."
            value={text(formData, 'dd1561PriorPeriodType')}
            options={[
              { value: 'T', label: 'TDY/TAD' },
              { value: 'S', label: 'Aboard ship away from homeport' },
            ]}
            onChange={(v) => set('dd1561PriorPeriodType', v)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField name="dd1561PriorPeriodFrom" label="Earlier period, first counted day" hint="The day you left your duty station (or homeport) for the earlier TDY or deployment, after any leave or proceed days." value={text(formData, 'dd1561PriorPeriodFrom')} onChange={(v) => set('dd1561PriorPeriodFrom', v)} />
            <DateField name="dd1561PriorPeriodTo" label="Earlier period, day you got back" hint="The day you returned to your duty station (or the ship returned to homeport) from that earlier period." value={text(formData, 'dd1561PriorPeriodTo')} onChange={(v) => set('dd1561PriorPeriodTo', v)} />
          </div>
          <div role="status" aria-live="polite" className="text-sm" data-testid="dd1561-redeployment">
            {r?.evaluated ? (
              <div className="space-y-1">
                <p>
                  Earlier period: {dayWord(r.priorDays ?? 0)}{r.priorQualified ? ' (more than 30)' : ' (30 or fewer)'}.
                  {r.interimDays !== null && ` Days in between: ${r.interimDays}.`}
                </p>
                <p className="font-semibold">
                  {!r.sameKind
                    ? 'A TDY and a ship period are never combined, so the earlier period does not carry into this one.'
                    : r.continues
                      ? `FSA continues through the days in between: ${dayWord(r.creditedDays)} counted.`
                      : r.creditedDays > 0
                        ? `This period stands on its own: ${dayWord(r.creditedDays)} counted.`
                        : 'The earlier period does not carry into this one.'}
                </p>
                <p className="text-xs text-muted-foreground">{r.citation}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Enter both dates of the earlier period and this period&apos;s dates to see whether it carries over.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsStep({ formData, set }: StepProps) {
  const type = dd1561Type(formData);
  const count = dd1561DayCount(formData);
  return (
    <SectionCard
      icon={<CalendarDays className="mr-2 h-5 w-5" aria-hidden="true" />}
      title="3. Dates"
      intro="Enter the dates from your orders and travel. The app counts qualifying days only; finance works out the payment."
      testId="dd1561-step-details"
    >
      {!type && <p className="text-sm text-muted-foreground">Choose the kind of separation in step 2 first.</p>}
      {type === 'T' && <FsaTRows formData={formData} set={set} />}
      {type === 'S' && <FsaSSegments formData={formData} set={set} />}
      {type === 'R' && <FsaRDetails formData={formData} set={set} />}
      {(type === 'T' || type === 'S') && (
        <>
          <DayCounter count={count} label={type === 'T' ? `${FMR} par 4.4.1.` : `${FMR} par 4.4.3.`} />
          <RedeploymentQuestion formData={formData} set={set} count={count} />
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Your certification
// ---------------------------------------------------------------------------

interface ChecklistItem { block: string; text: string; marked: boolean; why: string }

/** The boxes the form will mark, each with the answer that sets it. */
export function dd1561Checklist(data: FormData, boxes: Dd1561CheckBoxes = dd1561CheckBoxes(data)): ChecklistItem[] {
  const type = dd1561Type(data);
  const hasChildren = data.dd1561HasChildren === true;
  const claimsParent = data.dd1561ClaimsParent === true;
  const custody = text(data, 'dd1561ChildCustody');
  const activeDuty = yesNo(data, 'dd1561DependentOnActiveDuty');
  const institution = yesNo(data, 'dd1561SoleDependentInstitutionalized');
  const residing = text(data, 'dd1561SpouseResidingTogether');
  const last = text(data, 'dd1561LastTdyWithin30');
  const situation = SITUATIONS.find((s) => s.value === type);
  return [
    {
      block: '5',
      text: situation ? situation.code : 'FSA type',
      marked: boxes.typeFsaT || boxes.typeFsaR || boxes.typeFsaS,
      why: situation ? `From step 2: "${situation.title}".` : 'Left blank until you choose the kind of separation in step 2.',
    },
    {
      block: '8a',
      text: 'I am not divorced or legally separated from my spouse.',
      marked: boxes.cert8a,
      why: boxes.cert8a ? 'You said you are married.' : 'Left blank: you did not say you are married.',
    },
    {
      block: '8b',
      text: 'My child(ren) were not in the legal custody of another person when I received the orders.',
      marked: boxes.cert8b,
      why: boxes.cert8b
        ? (custody === 'joint-14-plus' ? 'You said you share custody and the child lives with you 14 or more days a month.' : 'You said you have legal custody.')
        : !hasChildren ? 'Left blank: no child claimed.' : !custody ? 'Left blank until you answer the custody question.' : 'Left blank: your custody answer does not fit this statement.',
    },
    {
      block: '8c',
      text: 'My dependent(s), other than my spouse, are not on active duty.',
      marked: boxes.cert8c,
      why: boxes.cert8c
        ? 'You said no dependent other than your spouse is on active duty.'
        : !(hasChildren || claimsParent) ? 'Left blank: no child or parent claimed.' : activeDuty === undefined ? 'Left blank until you answer the active-duty question.' : 'Left blank: you said a dependent is on active duty.',
    },
    {
      block: '8d',
      text: 'My sole dependent is not in an institution for more than 1 year.',
      marked: boxes.cert8d,
      why: boxes.cert8d ? 'You said no.' : institution === undefined ? 'Left blank until you answer the institution question.' : 'Left blank: you said yes.',
    },
    {
      block: '8e',
      text: 'I am claiming a parent with a current approved dependency who lives in the home I keep up.',
      marked: boxes.cert8e,
      why: boxes.cert8e ? 'You said all three: parent claimed, dependency approved, living in your home.' : !claimsParent ? 'Left blank: no parent claimed.' : 'Left blank: not every parent question was answered yes.',
    },
    {
      block: '8f',
      text: 'I am married to an active-duty member.',
      marked: boxes.cert8f,
      why: boxes.cert8f
        ? (residing === 'was' ? 'You said yes. "Was residing with me" is marked.' : residing === 'was-not' ? 'You said yes. "Was not residing with me" is marked.' : 'You said yes. Answer whether you were living together.')
        : 'Left blank: you did not say you are married to a member.',
    },
    {
      block: '8g',
      text: 'My last TDY or deployment was / was not within 30 days of this one.',
      marked: boxes.cert8g,
      why: boxes.cert8g
        ? (last === 'was' ? 'You said it was within 30 days. "Was" is marked.' : 'You said no. "Was not" is marked.')
        : type === 'R' ? 'Left blank: this applies to TDY and ship separations.' : 'Left blank until you answer question 8g in step 3.',
    },
  ];
}

function CertificationStep({ formData, set }: StepProps) {
  const items = dd1561Checklist(formData);
  const edipi = text(formData, 'dd1561Edipi');
  const type = dd1561Type(formData);
  return (
    <SectionCard
      icon={<CheckSquare className="mr-2 h-5 w-5" aria-hidden="true" />}
      title="4. Your certification"
      intro="Blocks 5 and 8a to 8g come from your answers above, so nothing is asked twice. Check the list, then fill in your details."
      testId="dd1561-step-certification"
    >
      <div>
        <h4 className="text-sm font-semibold">Boxes the form will mark</h4>
        <ul className="mt-2 space-y-2" aria-label="Boxes the form will mark" data-testid="dd1561-checklist">
          {items.map((it) => (
            <li
              key={it.block}
              className={`flex gap-3 rounded-md border p-3 text-sm ${it.marked ? 'border-primary' : 'border-border'}`}
              data-testid={`dd1561-box-${it.block}`}
              data-marked={it.marked ? 'true' : 'false'}
            >
              {it.marked
                ? <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                : <Square className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <div>
                <p>
                  <span className="font-semibold">Block {it.block}: {it.marked ? 'marked X' : 'left blank'}.</span> {it.text}
                </p>
                <p className="text-xs text-muted-foreground">{it.why}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="dd1561MemberName"
          label="1. Name (Last, First, MI)"
          value={text(formData, 'dd1561MemberName')}
          onChange={(v) => set('dd1561MemberName', v)}
          placeholder="LAST, FIRST MI"
        />
        <TextField
          name="dd1561Grade"
          label="2. Grade"
          value={text(formData, 'dd1561Grade')}
          onChange={(v) => set('dd1561Grade', v)}
          placeholder="SGT"
        />
        <TextField
          name="dd1561Edipi"
          label="3. DoD ID number (EDIPI)"
          value={edipi}
          onChange={(v) => set('dd1561Edipi', v.replace(/\D/g, '').slice(0, 10))}
          placeholder="10 digits"
          inputMode="numeric"
          maxLength={10}
          hint="The 10-digit DoD ID on your CAC. Never a Social Security number."
          error={edipi && !isValidEdipi(edipi) ? 'Enter all 10 digits of the DoD ID (EDIPI).' : undefined}
        />
        <TextField
          name="dd1561BranchOrganization"
          label="4. Branch and organization"
          value={text(formData, 'dd1561BranchOrganization')}
          onChange={(v) => set('dd1561BranchOrganization', v)}
          placeholder="USMC, UNIT NAME"
        />
      </div>

      <Field name="dd1561DependentAddresses" label="7. Current address(es) of your dependent(s)" hint="One address per line. List each place a dependent lives.">
        <Textarea
          id="dd1561DependentAddresses"
          rows={3}
          value={text(formData, 'dd1561DependentAddresses')}
          onChange={(e) => set('dd1561DependentAddresses', e.target.value)}
          aria-describedby="dd1561DependentAddresses-hint"
        />
      </Field>

      <Note>
        Block 9: by signing you agree to tell your command if your dependents visit you for more than {type === 'R' ? '90 continuous days' : type ? '30 days' : '90 continuous days (FSA-R) or more than 30 days (FSA-T, FSA-S)'}.
      </Note>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateField
          name="dd1561MemberSignedDate"
          label="9a. Date you sign (optional)"
          hint="The day you sign block 9b. Leave it empty to write the date by hand when you sign."
          value={text(formData, 'dd1561MemberSignedDate')}
          onChange={(v) => set('dd1561MemberSignedDate', v)}
        />
        <p className="self-end text-sm text-muted-foreground">Block 9b, your signature, is left blank for you to sign.</p>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Orders and the certifying official
// ---------------------------------------------------------------------------

function OrdersStep({ formData, set }: StepProps) {
  const certifierKeys = ['dd1561CertifierName', 'dd1561CertifierTitle', 'dd1561CertifierOrganization', 'dd1561CertifiedDate'];
  const hasCertifier = certifierKeys.some((k) => text(formData, k).trim() !== '');
  // Follows the data until the user toggles, so details that load after
  // mount (import, template) still open the panel.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? hasCertifier;
  const panelId = useId();
  return (
    <SectionCard
      icon={<FileSignature className="mr-2 h-5 w-5" aria-hidden="true" />}
      title="5. Orders and certifying official"
      intro="Part II of the form. Blocks 10 to 12 come from your dates in step 3."
      testId="dd1561-step-orders"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          name="dd1561OrdersAuthority"
          label="13. Orders number or authority"
          value={text(formData, 'dd1561OrdersAuthority')}
          onChange={(v) => set('dd1561OrdersAuthority', v)}
          placeholder="TAD ORDERS 000-26"
        />
        <DateField
          name="dd1561OrdersDate"
          label="13. Date of the orders"
          hint="The date printed on the orders themselves (the issue date), not the date you left or reported."
          value={text(formData, 'dd1561OrdersDate')}
          onChange={(v) => set('dd1561OrdersDate', v)}
        />
      </div>
      <CheckField
        name="dd1561BahWithDependentsConfirmed"
        label="14. The member draws BAH (or lives in government quarters) as a member with dependents or a member married to a member."
        hint="Confirm from the member's pay record."
        checked={formData.dd1561BahWithDependentsConfirmed === true}
        onChange={(v) => set('dd1561BahWithDependentsConfirmed', v)}
      />

      <div className="rounded-lg border border-border" data-testid="dd1561-certifier">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setToggled(!open)}
        >
          <span>Certifying official (optional, can be left for the certifier)</span>
          {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {open && (
          <div id={panelId} className="space-y-4 border-t border-border p-4">
            <p className="text-sm text-muted-foreground">
              Blocks 15a to 15c and 16 are optional. Leave them empty for whoever certifies the entitlement to fill in.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField name="dd1561CertifierName" label="15a. Typed name" value={text(formData, 'dd1561CertifierName')} onChange={(v) => set('dd1561CertifierName', v)} />
              <TextField name="dd1561CertifierTitle" label="15b. Title" value={text(formData, 'dd1561CertifierTitle')} onChange={(v) => set('dd1561CertifierTitle', v)} />
              <TextField name="dd1561CertifierOrganization" label="15c. Organization" value={text(formData, 'dd1561CertifierOrganization')} onChange={(v) => set('dd1561CertifierOrganization', v)} />
              <DateField name="dd1561CertifiedDate" label="16. Date certified" hint="The day the certifying official signs block 15d. Usually left for the certifier." value={text(formData, 'dd1561CertifiedDate')} onChange={(v) => set('dd1561CertifiedDate', v)} />
            </div>
          </div>
        )}
        <p className="border-t border-border px-4 py-3 text-sm">
          Block 15d, the signature, is always left blank for the certifying official to sign.
        </p>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function Dd1561FormSections({ formData, setFormData }: Dd1561SectionsProps) {
  const set = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value } as FormData));
  return (
    <div data-testid="dd1561-sections">
      <QualifyStep formData={formData} set={set} />
      <TypeStep formData={formData} set={set} />
      <DetailsStep formData={formData} set={set} />
      <CertificationStep formData={formData} set={set} />
      <OrdersStep formData={formData} set={set} />
    </div>
  );
}
