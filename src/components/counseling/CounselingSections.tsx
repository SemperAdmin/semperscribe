'use client';

/**
 * Counseling Worksheet: the guided session (docs/COUNSELING_FORM_PLAN.md
 * section 7).
 *
 * Seven steps in the order a session runs (NAVMC 2795 chapter 3), each
 * headed by its policy guidance, with the open suggestions for the step
 * under the heading and a progress rail at the top. No step is
 * mandatory and every step is skippable: the suggestion engine in
 * src/lib/counseling.ts raises everything policy asks for, keyed to the
 * situation, and nothing blocks an export (owner decision, 2026-09-06).
 *
 * Every input writes to formData directly, so no react-hook-form
 * instance can clobber a value a one-click action wrote.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Check, Lightbulb, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD_ATTRIBUTE } from '@/lib/field-focus';
import type { FormData } from '@/types';
import {
  AREA_CITATION, AREA_STATUS_LABELS, COUNSELING_AREAS, COUNSELING_GRADES, COUNSELING_LIFE_EVENTS, COUNSELING_OCCASIONS,
  HANDLING_STATEMENT, ICS_CITATION, ICS_OBJECTIVES, LIFE_EVENT_CITATION, PRIOR_TARGET_STATUS_LABELS, STANDARD_KINDS,
  TARGET_ACTIONS, TARGET_CITATION, computedNextSessionDate, counselingAreaEntries, counselingField, counselingIcsObjectives,
  counselingLifeEvents, counselingOccasion, counselingPriorTargets, counselingSubjects, counselingSuggestions, counselingTargets,
  dismissedSuggestions, emptyTarget, nextSessionInterval, targetSentence,
  JEPES_ADVERSE_REASONS, JEPES_ATTRIBUTES, JEPES_BANDS, JEPES_CITATION, JEPES_GUIDANCE, benchmarkAtBaseline,
  counselingBenchmark, counselingPriorBenchmark, isJepesGrade, jepesBand, jepesMarkValue,
  type CounselingAreaId, type CounselingAreaStatus, type CounselingStep, type CounselingSuggestion, type CounselingTarget,
  type JepesAttribute, type JepesBenchmark, type JepesMark, type JepesPriorBenchmark, type PriorTargetStatus, type StandardKind,
} from '@/lib/counseling';

interface CounselingSectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

interface StepMeta {
  n: CounselingStep;
  title: string;
  guidance: string;
  citation: string;
}

const STEPS: readonly StepMeta[] = [
  { n: 1, title: 'Occasion and timing', guidance: 'Pick the occasion and any life events. The next-session date follows the interval for this Marine.', citation: 'NAVMC 2795 para 2001; MCO 1500.61 para 4.b(1)(b), 4.b(2)' },
  { n: 2, title: 'Who', guidance: 'The Marine counseled and the Marine performing the counseling.', citation: 'NAVMC 2795 para 3005.1.j(2), Figures A-1 and A-2' },
  { n: 3, title: 'Agenda', guidance: 'Initial: the seven objectives. Follow-on: last session’s targets, each marked. Event-related: the event.', citation: 'NAVMC 2795 para 2001.1.b, 2001.2.b, 2001.4' },
  { n: 4, title: 'The six functional areas', guidance: 'Walk each area with its prompts. Answer discussed, not this session, or target set. Notes become subjects discussed.', citation: AREA_CITATION },
  { n: 5, title: 'Performance', guidance: 'Major accomplishments, strengths and deficiencies since the last session.', citation: 'NAVMC 2795 para 3005.1.g, 2001.2.b' },
  { n: 6, title: 'Targets for the coming period', guidance: 'Three to five, each an action, its object, a standard, and a due date before the next session.', citation: TARGET_CITATION },
  { n: 7, title: 'Close and record', guidance: 'Comments, signatures, and the handling statement. Nothing here blocks the export.', citation: 'NAVMC 2795 para 3004, 3005.1.i' },
];

function stepId(n: number): string {
  return `counseling-step-${n}`;
}

export function CounselingSections({ formData, setFormData }: CounselingSectionsProps) {
  const patch = (p: Partial<FormData>) => setFormData((prev) => ({ ...prev, ...p }));
  const set = (name: string, value: unknown) => patch({ [name]: value } as Partial<FormData>);
  const get = (name: string) => counselingField(formData, name);

  const suggestions = counselingSuggestions(formData);
  const forStep = (n: CounselingStep) => suggestions.filter((s) => s.step === n);
  const applySuggestion = (s: CounselingSuggestion) => {
    if (!s.action) return;
    setFormData((prev) => ({ ...prev, ...s.action!.apply(prev) }));
  };
  const dismissSuggestion = (s: CounselingSuggestion) => {
    setFormData((prev) => ({ ...prev, counselingDismissed: [...dismissedSuggestions(prev), s.id] }));
  };

  const occasion = counselingOccasion(get('counselingOccasion'));
  const areas = counselingAreaEntries(formData);
  const targets = counselingTargets(formData);
  const subjects = counselingSubjects(formData);
  const priorTargets = counselingPriorTargets(formData);
  const lifeEvents = counselingLifeEvents(formData);
  const objectives = counselingIcsObjectives(formData);
  const interval = nextSessionInterval(get('counselingMarineGrade'), get('counselingMarineComponent'), get('counselingOccasion'));
  const computedNext = computedNextSessionDate(formData);
  const includeMarineComments = (formData as Record<string, unknown>).counselingIncludeMarineComments === true;
  const benchmark = counselingBenchmark(formData);
  const priorBenchmark = counselingPriorBenchmark(formData);
  const showBenchmark = isJepesGrade(get('counselingMarineGrade'));

  const done: Record<CounselingStep, boolean> = {
    1: !!get('counselingOccasion').trim(),
    2: !!get('counselingMarineLastName').trim() && !!get('counselingSeniorLastName').trim(),
    3: occasion?.kind === 'initial' ? objectives.length > 0
      : occasion?.kind === 'follow-on' ? priorTargets.some((t) => t.text.trim())
      : occasion?.kind === 'event' ? !!get('counselingEventDescription').trim()
      : !!occasion,
    4: areas.every((a) => a.status !== ''),
    5: !!(get('counselingAccomplishments').trim() || get('counselingStrengths').trim() || get('counselingDeficiencies').trim()),
    6: targets.some((t) => targetSentence(t)),
    7: !!get('counselingSeniorSignedDate').trim() && !!get('counselingMarineSignedDate').trim(),
  };

  // --- list editors ---
  const setAreas = (next: typeof areas) => set('counselingAreas', next);
  const setArea = (id: CounselingAreaId, change: Partial<{ status: CounselingAreaStatus; notes: string }>) =>
    setAreas(areas.map((a) => (a.area === id ? { ...a, ...change } : a)));
  const setTargets = (next: CounselingTarget[]) => set('counselingTargets', next);
  const setTarget = (index: number, change: Partial<CounselingTarget>) => setTargets(targets.map((t, i) => (i === index ? { ...t, ...change } : t)));
  const setSubjects = (next: typeof subjects) => set('counselingSubjects', next);
  const setPriorTargets = (next: typeof priorTargets) => set('counselingPriorTargets', next);
  const setBenchmark = (next: JepesBenchmark) => set('counselingBenchmark', next);
  const setMark = (id: JepesAttribute['id'], change: Partial<JepesMark>) => setBenchmark({ ...benchmark, [id]: { ...benchmark[id], ...change } });
  const setPriorBenchmark = (change: Partial<JepesPriorBenchmark>) => set('counselingPriorBenchmark', { ...priorBenchmark, ...change });
  const toggleLifeEvent = (value: string, on: boolean) =>
    set('counselingLifeEvents', on ? [...lifeEvents.filter((v) => v !== value), value] : lifeEvents.filter((v) => v !== value));
  const toggleObjective = (id: string, on: boolean) =>
    set('counselingIcsObjectives', on ? [...objectives.filter((v) => v !== id), id] : objectives.filter((v) => v !== id));

  return (
    <div className="space-y-6" data-testid="counseling-sections">
      <StepRail done={done} />

      {/* Step 1 */}
      <StepCard meta={STEPS[0]} done={done[1]} suggestions={forStep(1)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="counselingOccasion" label="Occasion">
            <Select value={get('counselingOccasion')} onValueChange={(v) => set('counselingOccasion', v)}>
              <SelectTrigger id="counselingOccasion" aria-label="Occasion"><SelectValue placeholder="Pick the occasion" /></SelectTrigger>
              <SelectContent>
                {COUNSELING_OCCASIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {occasion && <p className="text-[11px] text-muted-foreground mt-1">{occasion.citation}</p>}
          </Field>
          <TextField name="date" label="Date of session" value={get('date')} onChange={(v) => set('date', v)} placeholder="D MMM YY" />
          {occasion?.kind === 'event' && (
            <TextField name="counselingEventDescription" label="The event" value={get('counselingEventDescription')} onChange={(v) => set('counselingEventDescription', v)} className="md:col-span-2" />
          )}
          {(occasion?.kind === 'follow-on' || occasion?.kind === 'thirty-day' || occasion?.kind === 'baseline') && (
            <>
              <TextField name="counselingIcsDate" label="Date of initial counseling session" value={get('counselingIcsDate')} onChange={(v) => set('counselingIcsDate', v)} placeholder="D MMM YY" />
              <TextField name="counselingLastSessionDate" label="Date of last session" value={get('counselingLastSessionDate')} onChange={(v) => set('counselingLastSessionDate', v)} placeholder="D MMM YY" />
            </>
          )}
          <Field name="counselingNextSessionDate" label="Target date for next session">
            <div className="flex gap-2">
              <Input id="counselingNextSessionDate" value={get('counselingNextSessionDate')} onChange={(e) => set('counselingNextSessionDate', e.target.value)} placeholder="D MMM YY" />
              {computedNext && get('counselingNextSessionDate') !== computedNext && (
                <Button type="button" variant="outline" size="sm" onClick={() => set('counselingNextSessionDate', computedNext)}>Use {computedNext}</Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">The rule for this Marine: {interval.label} ({interval.citation}).</p>
          </Field>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Life events <span className="text-[11px] text-muted-foreground font-normal">({LIFE_EVENT_CITATION})</span></legend>
          <div className="grid gap-2 md:grid-cols-2 mt-2">
            {COUNSELING_LIFE_EVENTS.map((e) => (
              <label key={e.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={lifeEvents.includes(e.value)} onCheckedChange={(on) => toggleLifeEvent(e.value, on === true)} aria-label={e.label} />
                {e.label}
              </label>
            ))}
          </div>
          <TextField name="counselingLifeEventsOther" label="Unit-specific event (optional)" value={get('counselingLifeEventsOther')} onChange={(v) => set('counselingLifeEventsOther', v)} className="mt-3" placeholder="Deployment, marriage, return from deployment" />
        </fieldset>
      </StepCard>

      {/* Step 2 */}
      <StepCard meta={STEPS[1]} done={done[2]} suggestions={forStep(2)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <h4 className="text-sm font-semibold mb-2">Marine counseled</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField name="counselingMarineLastName" label="Last name" value={get('counselingMarineLastName')} onChange={(v) => set('counselingMarineLastName', v)} />
          <TextField name="counselingMarineFirstName" label="First name" value={get('counselingMarineFirstName')} onChange={(v) => set('counselingMarineFirstName', v)} />
          <TextField name="counselingMarineMiddleInitial" label="Middle initial" value={get('counselingMarineMiddleInitial')} onChange={(v) => set('counselingMarineMiddleInitial', v)} />
          <Field name="counselingMarineGrade" label="Grade">
            <Select value={get('counselingMarineGrade')} onValueChange={(v) => set('counselingMarineGrade', v)}>
              <SelectTrigger id="counselingMarineGrade" aria-label="Grade"><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>{COUNSELING_GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field name="counselingMarineComponent" label="Component">
            <Select value={get('counselingMarineComponent')} onValueChange={(v) => set('counselingMarineComponent', v)}>
              <SelectTrigger id="counselingMarineComponent" aria-label="Component"><SelectValue placeholder="Active or reserve" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="reserve">Reserve</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <TextField name="counselingMarineEdipi" label="EDIPI" value={get('counselingMarineEdipi')} onChange={(v) => set('counselingMarineEdipi', v)} placeholder="10 digits" />
          <TextField name="counselingMarineDor" label="Date of rank" value={get('counselingMarineDor')} onChange={(v) => set('counselingMarineDor', v)} placeholder="D MMM YY" />
          <TextField name="counselingMarinePmos" label="PMOS" value={get('counselingMarinePmos')} onChange={(v) => set('counselingMarinePmos', v)} />
          <TextField name="counselingMarineBilletMos" label="Billet MOS" value={get('counselingMarineBilletMos')} onChange={(v) => set('counselingMarineBilletMos', v)} />
          <TextField name="counselingBilletTitle" label="Billet title" value={get('counselingBilletTitle')} onChange={(v) => set('counselingBilletTitle', v)} className="md:col-span-3" />
          <TextField name="counselingBilletDescription" label="Billet description (if required)" value={get('counselingBilletDescription')} onChange={(v) => set('counselingBilletDescription', v)} className="md:col-span-3" />
        </div>
        <h4 className="text-sm font-semibold mt-6 mb-2">Marine performing counseling (senior)</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField name="counselingSeniorLastName" label="Last name" value={get('counselingSeniorLastName')} onChange={(v) => set('counselingSeniorLastName', v)} />
          <TextField name="counselingSeniorFirstName" label="First name" value={get('counselingSeniorFirstName')} onChange={(v) => set('counselingSeniorFirstName', v)} />
          <TextField name="counselingSeniorMiddleInitial" label="Middle initial" value={get('counselingSeniorMiddleInitial')} onChange={(v) => set('counselingSeniorMiddleInitial', v)} />
          <Field name="counselingSeniorGrade" label="Grade">
            <Select value={get('counselingSeniorGrade')} onValueChange={(v) => set('counselingSeniorGrade', v)}>
              <SelectTrigger id="counselingSeniorGrade" aria-label="Senior's grade"><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent>{COUNSELING_GRADES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <TextField name="counselingSeniorEdipi" label="EDIPI" value={get('counselingSeniorEdipi')} onChange={(v) => set('counselingSeniorEdipi', v)} placeholder="10 digits" />
          <TextField name="counselingSeniorBillet" label="Billet" value={get('counselingSeniorBillet')} onChange={(v) => set('counselingSeniorBillet', v)} />
        </div>
      </StepCard>

      {/* Step 3 */}
      <StepCard meta={STEPS[2]} done={done[3]} suggestions={forStep(3)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        {!occasion && <p className="text-sm text-muted-foreground">Pick the occasion in step 1 and the agenda for it appears here.</p>}
        {occasion?.kind === 'initial' && (
          <fieldset>
            <legend className="text-sm font-medium">Objectives of an initial counseling session <span className="text-[11px] text-muted-foreground font-normal">({ICS_CITATION})</span></legend>
            <div className="space-y-2 mt-2">
              {ICS_OBJECTIVES.map((o) => (
                <label key={o.id} className="flex items-start gap-2 text-sm">
                  <Checkbox className="mt-0.5" checked={objectives.includes(o.id)} onCheckedChange={(on) => toggleObjective(o.id, on === true)} aria-label={o.text} />
                  {o.text}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {occasion && occasion.kind !== 'initial' && occasion.kind !== 'event' && (
          <div>
            <p className="text-sm font-medium">Targets set last session <span className="text-[11px] text-muted-foreground font-normal">(NAVMC 2795 para 2001.2.b)</span></p>
            <div className="space-y-2 mt-2">
              {priorTargets.map((t, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input aria-label={`Prior target ${index + 1}`} value={t.text} onChange={(e) => setPriorTargets(priorTargets.map((x, i) => (i === index ? { ...x, text: e.target.value } : x)))} />
                  <Select value={t.status} onValueChange={(v) => setPriorTargets(priorTargets.map((x, i) => (i === index ? { ...x, status: v as PriorTargetStatus } : x)))}>
                    <SelectTrigger className="w-44" aria-label={`Prior target ${index + 1} status`}><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIOR_TARGET_STATUS_LABELS) as Exclude<PriorTargetStatus, ''>[]).map((k) => <SelectItem key={k} value={k}>{PRIOR_TARGET_STATUS_LABELS[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove prior target ${index + 1}`} onClick={() => setPriorTargets(priorTargets.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setPriorTargets([...priorTargets, { text: '', status: '' }])}><Plus className="w-4 h-4 mr-1" />Add a prior target</Button>
            </div>
          </div>
        )}
        {occasion?.kind === 'event' && (
          <p className="text-sm text-muted-foreground">Describe the event in step 1. Record what was said under the areas in step 4 and the targets in step 6.</p>
        )}
      </StepCard>

      {/* Step 4 */}
      <StepCard meta={STEPS[3]} done={done[4]} suggestions={forStep(4)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <div className="grid gap-4 md:grid-cols-2">
          {COUNSELING_AREAS.map((area) => {
            const entry = areas.find((a) => a.area === area.id)!;
            return (
              <div key={area.id} className={cn('rounded-md border p-3', entry.status ? 'border-border' : 'border-dashed border-muted-foreground/40')} data-testid={`area-${area.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold">{area.title}</h4>
                  {entry.status && <Badge variant="secondary">{AREA_STATUS_LABELS[entry.status]}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{area.definition}</p>
                <ul className="text-xs mt-2 list-disc pl-4 space-y-0.5">
                  {area.prompts.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <div className="flex flex-wrap gap-1 mt-3" role="group" aria-label={`${area.title} status`}>
                  {(Object.keys(AREA_STATUS_LABELS) as Exclude<CounselingAreaStatus, ''>[]).map((status) => (
                    <Button key={status} type="button" size="sm" variant={entry.status === status ? 'default' : 'outline'} aria-pressed={entry.status === status}
                      onClick={() => setArea(area.id, { status: entry.status === status ? '' : status })}>
                      {AREA_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
                <Textarea className="mt-2" rows={2} aria-label={`${area.title} notes`} placeholder="Notes become a subject discussed" value={entry.notes} onChange={(e) => setArea(area.id, { notes: e.target.value })} />
              </div>
            );
          })}
        </div>
        <div className="mt-5">
          <p className="text-sm font-medium">Subjects discussed <span className="text-[11px] text-muted-foreground font-normal">(NAVMC 2795 para 3005.1.j(3))</span></p>
          <div className="space-y-2 mt-2">
            {subjects.map((s, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Input aria-label={`Subject ${index + 1}`} value={s.text} onChange={(e) => setSubjects(subjects.map((x, i) => (i === index ? { ...x, text: e.target.value } : x)))} />
                <Select value={s.area} onValueChange={(v) => setSubjects(subjects.map((x, i) => (i === index ? { ...x, area: v as typeof s.area } : x)))}>
                  <SelectTrigger className="w-36" aria-label={`Subject ${index + 1} area`}><SelectValue placeholder="Area" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duties">Duties</SelectItem>
                    {COUNSELING_AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove subject ${index + 1}`} onClick={() => setSubjects(subjects.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setSubjects([...subjects, { text: '', area: '' }])}><Plus className="w-4 h-4 mr-1" />Add a subject</Button>
          </div>
        </div>
      </StepCard>

      {/* Step 5 */}
      <StepCard meta={STEPS[4]} done={done[5]} suggestions={forStep(5)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <div className="grid gap-4">
          <AreaField name="counselingAccomplishments" label="Major accomplishments and significant events this period" value={get('counselingAccomplishments')} onChange={(v) => set('counselingAccomplishments', v)} />
          <AreaField name="counselingStrengths" label="Strengths" value={get('counselingStrengths')} onChange={(v) => set('counselingStrengths', v)} />
          <AreaField name="counselingDeficiencies" label="Deficiencies" value={get('counselingDeficiencies')} onChange={(v) => set('counselingDeficiencies', v)} />
        </div>
        {showBenchmark && (
          <BenchmarkBlock
            benchmark={benchmark}
            prior={priorBenchmark}
            onMark={setMark}
            onPrior={setPriorBenchmark}
            onBaseline={() => setBenchmark(benchmarkAtBaseline(benchmark))}
          />
        )}
      </StepCard>

      {/* Step 6 */}
      <StepCard meta={STEPS[5]} done={done[6]} suggestions={forStep(6)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <div className="space-y-4">
          {targets.map((t, index) => (
            <div key={index} className="rounded-md border p-3" data-testid={`target-${index}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Target {index + 1}</h4>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove target ${index + 1}`} onClick={() => setTargets(targets.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 mt-2">
                <div>
                  <Label htmlFor={`target-${index}-action`}>Action</Label>
                  <Input id={`target-${index}-action`} list="counseling-target-actions" value={t.action} onChange={(e) => setTarget(index, { action: e.target.value })} placeholder="To complete" />
                </div>
                <div>
                  <Label htmlFor={`target-${index}-object`}>Object</Label>
                  <Input id={`target-${index}-object`} value={t.object} onChange={(e) => setTarget(index, { object: e.target.value })} placeholder="the Corporals Course" />
                </div>
                <div>
                  <Label htmlFor={`target-${index}-standard`}>Standard</Label>
                  <Input id={`target-${index}-standard`} value={t.standard} onChange={(e) => setTarget(index, { standard: e.target.value })} placeholder="with a first-class score" />
                  <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label={`Target ${index + 1} standard kind`}>
                    {STANDARD_KINDS.map((k) => {
                      const on = t.standardKinds.includes(k.value);
                      return (
                        <Button key={k.value} type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} title={k.question}
                          onClick={() => setTarget(index, { standardKinds: on ? t.standardKinds.filter((x) => x !== k.value) : [...t.standardKinds, k.value as StandardKind] })}>
                          {k.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label htmlFor={`target-${index}-due`}>Due date</Label>
                  <Input id={`target-${index}-due`} value={t.dueDate} onChange={(e) => setTarget(index, { dueDate: e.target.value })} placeholder="D MMM YY" />
                  <Label htmlFor={`target-${index}-area`} className="mt-2 block">Area</Label>
                  <Select value={t.area} onValueChange={(v) => setTarget(index, { area: v as CounselingAreaId })}>
                    <SelectTrigger id={`target-${index}-area`} aria-label={`Target ${index + 1} area`}><SelectValue placeholder="Area" /></SelectTrigger>
                    <SelectContent>{COUNSELING_AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm mt-3" data-testid={`target-${index}-sentence`}>{targetSentence(t) || <span className="text-muted-foreground">The target reads here as one sentence.</span>}</p>
            </div>
          ))}
          <datalist id="counseling-target-actions">{TARGET_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
          <Button type="button" variant="outline" size="sm" onClick={() => setTargets([...targets, emptyTarget()])}><Plus className="w-4 h-4 mr-1" />Add a target</Button>
        </div>
      </StepCard>

      {/* Step 7 */}
      <StepCard meta={STEPS[6]} done={done[7]} suggestions={forStep(7)} onApply={applySuggestion} onDismiss={dismissSuggestion}>
        <div className="grid gap-4">
          <AreaField name="counselingSeniorComments" label="Senior's comments" value={get('counselingSeniorComments')} onChange={(v) => set('counselingSeniorComments', v)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeMarineComments} onCheckedChange={(on) => set('counselingIncludeMarineComments', on === true)} aria-label="Include the Marine's comments" />
            Include the Marine&apos;s comments (two-way communication, MCO 1500.61 para 4.a(1)(c))
          </label>
          {includeMarineComments && (
            <AreaField name="counselingMarineComments" label="Marine's comments" value={get('counselingMarineComments')} onChange={(v) => set('counselingMarineComments', v)} />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="counselingSeniorSignedDate" label="Marine performing counseling signed on" value={get('counselingSeniorSignedDate')} onChange={(v) => set('counselingSeniorSignedDate', v)} placeholder="D MMM YY" />
            <TextField name="counselingMarineSignedDate" label="Marine counseled signed on" value={get('counselingMarineSignedDate')} onChange={(v) => set('counselingMarineSignedDate', v)} placeholder="D MMM YY" />
          </div>
          <p className="text-xs text-muted-foreground border-l-2 pl-3" data-testid="counseling-handling">{HANDLING_STATEMENT}</p>
          {suggestions.filter((s) => s.id !== 'handling').length > 0 && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Open suggestions before you export</p>
              <ul className="text-sm mt-1 space-y-1">
                {suggestions.filter((s) => s.id !== 'handling').map((s) => (
                  <li key={s.id}><a className="underline" href={`#${stepId(s.step)}`}>Step {s.step}</a>: {s.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </StepCard>
    </div>
  );
}

// --- pieces ---

/**
 * The provisional JEPES benchmark (docs/COUNSELING_JEPES_BENCHMARK_PLAN.md).
 * Shown only while the grade typed on this worksheet is E-1 to E-4. The
 * descriptors from Figure 1-2 live here and nowhere on the export
 * (owner decision, 2026-09-06). Marks start blank; the one button
 * applies the para 3.a(3) baseline.
 */
function BenchmarkBlock({ benchmark, prior, onMark, onPrior, onBaseline }: {
  benchmark: JepesBenchmark;
  prior: JepesPriorBenchmark;
  onMark: (id: JepesAttribute['id'], change: Partial<JepesMark>) => void;
  onPrior: (change: Partial<JepesPriorBenchmark>) => void;
  onBaseline: () => void;
}) {
  const hasPrior = JEPES_ATTRIBUTES.some((a) => jepesMarkValue(prior[a.id]) !== null);
  return (
    <section className="space-y-4 rounded-md border p-3" aria-labelledby="counseling-benchmark-heading" data-testid="counseling-benchmark">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="counseling-benchmark-heading" className="font-semibold">JEPES benchmark (provisional)</h4>
          <p className="text-sm text-muted-foreground">
            The senior&apos;s mark at this session, not the mark of record. The reporting chain enters JEPES command input at period end; this is the trail it rests on. Pvt through Cpl only.
          </p>
          <p className="text-[11px] text-muted-foreground">{JEPES_CITATION}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onBaseline} data-testid="benchmark-baseline">Start at 2.5</Button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Marking guidance (para 3.a)</summary>
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          {JEPES_GUIDANCE.map((g) => <li key={g.band}>{g.text}</li>)}
        </ul>
        <p className="mt-2 text-muted-foreground">About 80 percent of a unit lands between 2.0 and 4.0. That is a statement about a unit, not a rule for one Marine.</p>
      </details>

      <div className="grid gap-2 sm:grid-cols-4 rounded-md bg-muted/40 p-2">
        <p className="sm:col-span-4 text-xs text-muted-foreground">Prior session&apos;s benchmark, if one exists. Typed by the senior; the app keeps no history.</p>
        {JEPES_ATTRIBUTES.map((a) => (
          <TextField key={a.id} name={`counselingPriorBenchmark.${a.id}`} label={`Prior: ${a.title}`} value={prior[a.id]} onChange={(v) => onPrior({ [a.id]: v })} placeholder="0.0 to 5.0" />
        ))}
        <TextField name="counselingPriorBenchmark.date" label="Prior session date" value={prior.date} onChange={(v) => onPrior({ date: v })} placeholder="D MMM YY" />
      </div>

      {JEPES_ATTRIBUTES.map((a) => {
        const m = benchmark[a.id];
        const band = jepesBand(m.mark);
        const value = jepesMarkValue(m.mark);
        const priorValue = jepesMarkValue(prior[a.id]);
        const delta = value !== null && priorValue !== null ? Math.round((value - priorValue) * 10) / 10 : null;
        const needsJustification = band?.id === 'exceptional' || band?.id === 'below' || band?.id === 'adverse';
        return (
          <div key={a.id} className="rounded-md border p-3 space-y-3" data-testid={`benchmark-${a.id}`}>
            <div>
              <h5 className="font-medium">{a.title}</h5>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <Field name={`counselingBenchmark.${a.id}.mark`} label="Mark (0.0 to 5.0)">
                <Input
                  id={`counselingBenchmark.${a.id}.mark`}
                  inputMode="decimal"
                  value={m.mark}
                  onChange={(e) => onMark(a.id, { mark: e.target.value })}
                  placeholder="blank"
                  aria-describedby={`counselingBenchmark.${a.id}.band`}
                />
              </Field>
              <div id={`counselingBenchmark.${a.id}.band`} className="text-sm">
                {band ? (
                  <>
                    <p className="flex items-center gap-2">
                      <Badge variant="outline">{band.label}</Badge>
                      {hasPrior && delta !== null && (
                        <span className="text-xs text-muted-foreground">prior {prior[a.id].trim()}, {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}</span>
                      )}
                    </p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {a.bands[band.id].map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </>
                ) : m.mark.trim() ? (
                  <p className="text-xs text-destructive">Enter one decimal between 0.0 and 5.0.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No mark yet. Bands: {JEPES_BANDS.map((b) => `${b.label} ${b.min.toFixed(1)}${b.max !== b.min ? ` to ${b.max.toFixed(1)}` : ''}`).join('; ')}.</p>
                )}
              </div>
            </div>
            {band?.id === 'adverse' && (
              <Field name={`counselingBenchmark.${a.id}.adverseReason`} label="Reason for 0.0 (Non Rec / Adverse column)">
                <Select value={m.adverseReason} onValueChange={(v) => onMark(a.id, { adverseReason: v })}>
                  <SelectTrigger id={`counselingBenchmark.${a.id}.adverseReason`}><SelectValue placeholder="Choose the reason" /></SelectTrigger>
                  <SelectContent>
                    {JEPES_ADVERSE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {band?.id === 'exceptional' && (
              <div className="flex items-center gap-2" {...{ [FIELD_ATTRIBUTE]: `counselingBenchmark.${a.id}.commendatory` }}>
                <Checkbox id={`counselingBenchmark.${a.id}.commendatory`} checked={m.commendatory} onCheckedChange={(v) => onMark(a.id, { commendatory: v === true })} />
                <Label htmlFor={`counselingBenchmark.${a.id}.commendatory`}>Formal commendatory material on file (visible in JEPES under Adversity/Commendatory)</Label>
              </div>
            )}
            <Field name={`counselingBenchmark.${a.id}.justification`} label={needsJustification ? 'Justification (required in this band)' : 'Justification (optional)'}>
              <Textarea id={`counselingBenchmark.${a.id}.justification`} rows={2} value={m.justification} onChange={(e) => onMark(a.id, { justification: e.target.value })} />
            </Field>
          </div>
        );
      })}
    </section>
  );
}

function StepRail({ done }: { done: Record<CounselingStep, boolean> }) {
  return (
    <nav aria-label="Counseling steps" className="bg-card p-3 rounded-lg shadow-sm border border-border">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <li key={s.n}>
            <a href={`#${stepId(s.n)}`} className={cn('inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border', done[s.n] ? 'bg-primary/10 border-primary/40 text-foreground' : 'border-border text-muted-foreground')}
              aria-label={`Step ${s.n}, ${s.title}${done[s.n] ? ', done' : ''}`}>
              <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]', done[s.n] ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                {done[s.n] ? <Check className="w-3 h-3" /> : s.n}
              </span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepCard({ meta, done, suggestions, onApply, onDismiss, children }: {
  meta: StepMeta;
  done: boolean;
  suggestions: CounselingSuggestion[];
  onApply: (s: CounselingSuggestion) => void;
  onDismiss: (s: CounselingSuggestion) => void;
  children: React.ReactNode;
}) {
  return (
    <Card id={stepId(meta.n)} className="border-border shadow-sm scroll-mt-4" data-testid={stepId(meta.n)}>
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg font-semibold flex items-center gap-2">
          {done && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
          Step {meta.n}. {meta.title}
        </CardTitle>
        <p className="text-sm text-secondary-foreground/80">{meta.guidance}</p>
        <p className="text-[11px] text-secondary-foreground/70">{meta.citation}</p>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {suggestions.length > 0 && (
          <ul className="space-y-2" aria-label={`Suggestions for step ${meta.n}`}>
            {suggestions.map((s) => (
              <li key={s.id} className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 p-2 text-sm" data-suggestion={s.id}>
                <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <div className="flex-1">
                  <p>{s.text}</p>
                  <p className="text-[11px] text-muted-foreground">{s.citation}</p>
                  {s.action && (
                    <Button type="button" size="sm" variant="secondary" className="mt-1" onClick={() => onApply(s)}>{s.action.label}</Button>
                  )}
                </div>
                {s.id !== 'handling' && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Dismiss: ${s.text}`} onClick={() => onDismiss(s)}><X className="w-4 h-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {children}
      </CardContent>
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

function AreaField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field name={name} label={label}>
      <Textarea id={name} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
