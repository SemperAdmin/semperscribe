/**
 * Counseling Worksheet: vocabulary, dates, targets and the suggestion
 * engine (docs/COUNSELING_FORM_PLAN.md).
 *
 * Policy prescribes no form (MCO 1500.61 para 5.b(1); NAVMC 2795
 * Appendix A para 1), so the record is the app's own layout around the
 * four documentation minimums of NAVMC 2795 para 3005.1.j. Nothing here
 * blocks an export. Every rule is a suggestion keyed to the situation of
 * the session, carrying its cite and, where the app has enough to act,
 * a one-click action (owner decision, 2026-09-06).
 */
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';

// --- Functional areas (MCO 1500.61 para 4.a(1)(d)) ---

export type CounselingAreaId = 'fidelity' | 'fighter' | 'fitness' | 'family' | 'finances' | 'future';

export interface CounselingArea {
  id: CounselingAreaId;
  title: string;
  /** The order's own definition, abridged. */
  definition: string;
  /** What the leader asks about. */
  prompts: string[];
}

export const COUNSELING_AREAS: readonly CounselingArea[] = [
  {
    id: 'fidelity',
    title: 'Fidelity',
    definition: 'Faithfulness to one another, the Corps and the Nation: core values, leadership traits and principles, heritage, and ethical conduct.',
    prompts: ['Conduct on and off duty since the last session.', 'Any ethics or standards issue.', 'The example set for juniors.'],
  },
  {
    id: 'fighter',
    title: 'Fighter',
    definition: 'The skill sets and knowledge of a well-rounded warrior: PME, MOS duties and standards of performance, interpersonal communication, and on and off-duty education.',
    prompts: ['PME status and the next course.', 'MOS proficiency and training gaps.', 'Off-duty education.', 'Rifle and weapons qualifications.'],
  },
  {
    id: 'fitness',
    title: 'Fitness',
    definition: 'Physical, mental, spiritual and social health and well-being.',
    prompts: ['PFT, CFT and body composition.', 'Sleep, stress and resilience.', 'Spiritual and social support.'],
  },
  {
    id: 'family',
    title: 'Family',
    definition: 'The fundamental social relationships Marines draw strength from.',
    prompts: ['Dependents and their situation.', 'Housing and living conditions.', 'Upcoming family events.'],
  },
  {
    id: 'finances',
    title: 'Finances',
    definition: 'The disciplined practice of personal financial responsibility.',
    prompts: ['LES reviewed.', 'Debt, savings and big purchases ahead.', 'Command financial counselor referral.'],
  },
  {
    id: 'future',
    title: 'Future',
    definition: 'Setting and accomplishing goals in the other five areas.',
    prompts: ['Promotion and reenlistment timeline.', 'Career and civilian goals.', 'Targets set this session.'],
  },
];

export const AREA_CITATION = 'MCO 1500.61 para 4.a(1)(d)';

export function counselingArea(id: string): CounselingArea | undefined {
  return COUNSELING_AREAS.find((a) => a.id === id);
}

export type CounselingAreaStatus = '' | 'discussed' | 'not-this-session' | 'target-set';

export interface CounselingAreaEntry {
  area: CounselingAreaId;
  status: CounselingAreaStatus;
  notes: string;
}

export const AREA_STATUS_LABELS: Record<Exclude<CounselingAreaStatus, ''>, string> = {
  discussed: 'Discussed',
  'not-this-session': 'Not this session',
  'target-set': 'Target set',
};

// --- Occasions (MCO 1500.61 para 4.b(2); NAVMC 2795 para 2001) ---

export type CounselingOccasionKind = 'initial' | 'follow-on' | 'thirty-day' | 'event' | 'baseline';

export interface CounselingOccasion {
  value: string;
  label: string;
  kind: CounselingOccasionKind;
  citation: string;
}

export const COUNSELING_OCCASIONS: readonly CounselingOccasion[] = [
  { value: 'initial', label: 'Initial counseling session (ICS)', kind: 'initial', citation: 'NAVMC 2795 para 2001.1' },
  { value: 'follow-on', label: 'Follow-on session', kind: 'follow-on', citation: 'NAVMC 2795 para 2001.2' },
  { value: 'thirty-day', label: '30-day session (LCpl and below)', kind: 'thirty-day', citation: 'NAVMC 2795 para 2001.3' },
  { value: 'event-related', label: 'Event-related', kind: 'event', citation: 'NAVMC 2795 para 2001.4' },
  { value: 'rs-mro', label: 'Establishment of the RS and MRO relationship', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'fitness-report', label: 'Issuance of a fitness report', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'pro-con', label: 'Assignment of proficiency and conduct marks', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'promotion-eligibility', label: 'Eligibility for promotion', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'new-unit', label: 'Joining a new unit', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'pcs', label: 'Permanent change of station', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'force-preservation', label: 'Assignment to Force Preservation', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
  { value: 'billet-change', label: 'Major change in billet responsibilities', kind: 'baseline', citation: 'MCO 1500.61 para 4.b(2)' },
];

export function counselingOccasion(value: string): CounselingOccasion | undefined {
  return COUNSELING_OCCASIONS.find((o) => o.value === value);
}

// --- Life events (MCO 1500.61 para 4.b(1)(b)) ---

export interface CounselingLifeEvent {
  value: string;
  label: string;
}

export const COUNSELING_LIFE_EVENTS: readonly CounselingLifeEvent[] = [
  { value: 'promotion-reenlistment', label: 'Eligible for promotion or reenlistment' },
  { value: 'birth-of-child', label: 'Birth of a child' },
  { value: 'pcs-move', label: 'PCS move' },
  { value: 'first-purchase', label: 'First car or house' },
  { value: 'resident-school', label: 'Selection to a resident school or special training' },
];

export const LIFE_EVENT_CITATION = 'MCO 1500.61 para 4.b(1)(b)';

// --- ICS objectives (NAVMC 2795 para 2001.1.b) ---

export interface IcsObjective {
  id: string;
  text: string;
}

export const ICS_OBJECTIVES: readonly IcsObjective[] = [
  { id: 'expectations', text: "Make the senior's expectations clear." },
  { id: 'understanding', text: 'Confirm the junior understands those expectations.' },
  { id: 'targets', text: 'Set targets and make plans to meet them.' },
  { id: 'interest', text: "Convey the senior's interest and concern." },
  { id: 'style', text: "Explain the senior's leadership style." },
  { id: 'motivation', text: 'Motivate the junior toward the highest level of performance.' },
  { id: 'mission', text: "Confirm the junior understands the unit's mission and status and the junior's primary and collateral duties." },
];

export const ICS_CITATION = 'NAVMC 2795 para 2001.1.b';

// --- Grades ---

export interface CounselingGrade {
  value: string;
  label: string;
}

/**
 * E-1 through O-6, warrant officers included. The next-session interval
 * keys on this list: E-1 to E-3 follow the 30-day rule, everyone else
 * the corporal-through-colonel rule (owner decision, 2026-09-06).
 */
export const COUNSELING_GRADES: readonly CounselingGrade[] = [
  { value: 'E-1', label: 'Pvt (E-1)' }, { value: 'E-2', label: 'PFC (E-2)' }, { value: 'E-3', label: 'LCpl (E-3)' },
  { value: 'E-4', label: 'Cpl (E-4)' }, { value: 'E-5', label: 'Sgt (E-5)' }, { value: 'E-6', label: 'SSgt (E-6)' },
  { value: 'E-7', label: 'GySgt (E-7)' }, { value: 'E-8', label: 'MSgt or 1stSgt (E-8)' }, { value: 'E-9', label: 'MGySgt or SgtMaj (E-9)' },
  { value: 'W-1', label: 'WO (W-1)' }, { value: 'W-2', label: 'CWO2 (W-2)' }, { value: 'W-3', label: 'CWO3 (W-3)' },
  { value: 'W-4', label: 'CWO4 (W-4)' }, { value: 'W-5', label: 'CWO5 (W-5)' },
  { value: 'O-1', label: '2ndLt (O-1)' }, { value: 'O-2', label: '1stLt (O-2)' }, { value: 'O-3', label: 'Capt (O-3)' },
  { value: 'O-4', label: 'Maj (O-4)' }, { value: 'O-5', label: 'LtCol (O-5)' }, { value: 'O-6', label: 'Col (O-6)' },
];

export function gradeLabel(value: string): string {
  return COUNSELING_GRADES.find((g) => g.value === value)?.label ?? value;
}

/** Rank abbreviation alone ("LCpl"), for names on the record. */
export function rankAbbreviation(value: string): string {
  const label = COUNSELING_GRADES.find((g) => g.value === value)?.label;
  return label ? label.replace(/\s*\(.*\)$/, '') : value;
}

export function isLcplOrBelow(grade: string): boolean {
  return /^E-[123]$/.test(grade.trim());
}

export type CounselingComponent = '' | 'active' | 'reserve';

// --- Dates (naval "D MMM YY", the app's own format) ---

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseNavalDate(value: string | undefined): Date | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const naval = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})$/);
  if (naval) {
    const month = MONTHS.findIndex((m) => m.toLowerCase() === naval[2].toLowerCase());
    if (month < 0) return null;
    const year = naval[3].length === 2 ? 2000 + Number(naval[3]) : Number(naval[3]);
    const date = new Date(year, month, Number(naval[1]));
    return isNaN(date.getTime()) ? null : date;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function toNavalDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

export function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  out.setMonth(out.getMonth() + months);
  return out;
}

// --- Next-session interval (NAVMC 2795 para 2001) ---

export interface SessionInterval {
  days?: number;
  months?: number;
  label: string;
  citation: string;
}

export function nextSessionInterval(grade: string, component: string, occasion: string): SessionInterval {
  if (isLcplOrBelow(grade)) {
    if (component === 'reserve') {
      return { months: 3, label: 'every 3 months and once during annual training duty (reservists, lance corporal and below)', citation: 'NAVMC 2795 para 2001.3.f' };
    }
    return { days: 30, label: 'every 30 days (lance corporal and below)', citation: 'NAVMC 2795 para 2001.3.a' };
  }
  if (occasion === 'initial' || occasion === 'new-unit' || occasion === 'billet-change') {
    return { days: 90, label: 'approximately 90 days after the initial counseling session (corporal through colonel)', citation: 'NAVMC 2795 para 2001.2.a' };
  }
  return { months: 6, label: 'at intervals of no more than 6 months (corporal through colonel)', citation: 'NAVMC 2795 para 2001.2.a' };
}

export function applyInterval(from: Date, interval: SessionInterval): Date {
  if (interval.days) return addDays(from, interval.days);
  return addMonths(from, interval.months ?? 6);
}

/** The next-session date the rule computes from the session date, or '' without one. */
export function computedNextSessionDate(formData: FormData): string {
  const session = parseNavalDate(counselingField(formData, 'date'));
  if (!session) return '';
  const interval = nextSessionInterval(
    counselingField(formData, 'counselingMarineGrade'),
    counselingField(formData, 'counselingMarineComponent'),
    counselingField(formData, 'counselingOccasion'),
  );
  return toNavalDate(applyInterval(session, interval));
}

// --- Targets (NAVMC 2795 para 4002) ---

export type StandardKind = 'quantity' | 'quality' | 'timeliness' | 'manner';

export const STANDARD_KINDS: readonly { value: StandardKind; label: string; question: string }[] = [
  { value: 'quantity', label: 'Quantity', question: 'how much?' },
  { value: 'quality', label: 'Quality', question: 'how well?' },
  { value: 'timeliness', label: 'Timeliness', question: 'when, or how long?' },
  { value: 'manner', label: 'Manner', question: 'in what way?' },
];

export const TARGET_ACTIONS: readonly string[] = ['To complete', 'To achieve', 'To pass', 'To start', 'To maintain', 'To attend', 'To submit', 'To qualify'];

export const TARGET_CITATION = 'NAVMC 2795 para 4002';

export interface CounselingTarget {
  action: string;
  object: string;
  standardKinds: StandardKind[];
  standard: string;
  dueDate: string;
  area: CounselingAreaId | '';
}

export function emptyTarget(area: CounselingAreaId | '' = ''): CounselingTarget {
  return { action: '', object: '', standardKinds: [], standard: '', dueDate: '', area };
}

/** One sentence: action, object, standard, due date. Empty when nothing is entered. */
export function targetSentence(target: CounselingTarget): string {
  const head = [target.action.trim(), target.object.trim()].filter(Boolean).join(' ');
  let text = head;
  if (target.standard.trim()) text += (text ? ', ' : '') + target.standard.trim();
  if (target.dueDate.trim()) text += (text ? ' by ' : 'By ') + target.dueDate.trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Action verb, object, and a standard or a due date (4002.1.f to h). */
export function targetIsWellFormed(target: CounselingTarget): boolean {
  return !!target.action.trim() && !!target.object.trim() && (!!target.standard.trim() || !!target.dueDate.trim());
}

export type PriorTargetStatus = '' | 'met' | 'partly-met' | 'not-met' | 'dropped' | 'carried-forward';

export const PRIOR_TARGET_STATUS_LABELS: Record<Exclude<PriorTargetStatus, ''>, string> = {
  met: 'Met',
  'partly-met': 'Partly met',
  'not-met': 'Not met',
  dropped: 'Dropped',
  'carried-forward': 'Carried forward',
};

export interface CounselingPriorTarget {
  text: string;
  status: PriorTargetStatus;
}

export interface CounselingSubject {
  text: string;
  area: CounselingAreaId | 'duties' | '';
}

// --- Field access ---

export function counselingField(formData: FormData, name: string): string {
  const value = (formData as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function list<T>(formData: FormData, name: string): T[] {
  const value = (formData as Record<string, unknown>)[name];
  return Array.isArray(value) ? (value as T[]) : [];
}

export function counselingTargets(formData: FormData): CounselingTarget[] {
  return list<Partial<CounselingTarget>>(formData, 'counselingTargets').map((t) => ({ ...emptyTarget(), ...t, standardKinds: Array.isArray(t.standardKinds) ? t.standardKinds : [] }));
}

export function counselingSubjects(formData: FormData): CounselingSubject[] {
  return list<Partial<CounselingSubject>>(formData, 'counselingSubjects').map((s) => ({ text: s.text ?? '', area: s.area ?? '' }));
}

export function counselingPriorTargets(formData: FormData): CounselingPriorTarget[] {
  return list<Partial<CounselingPriorTarget>>(formData, 'counselingPriorTargets').map((t) => ({ text: t.text ?? '', status: t.status ?? '' }));
}

export function counselingLifeEvents(formData: FormData): string[] {
  return list<string>(formData, 'counselingLifeEvents').filter((v) => typeof v === 'string');
}

export function counselingIcsObjectives(formData: FormData): string[] {
  return list<string>(formData, 'counselingIcsObjectives').filter((v) => typeof v === 'string');
}

/** Six entries, one per area, in the order's order, whatever the stored list holds. */
export function counselingAreaEntries(formData: FormData): CounselingAreaEntry[] {
  const stored = list<Partial<CounselingAreaEntry>>(formData, 'counselingAreas');
  return COUNSELING_AREAS.map((area) => {
    const hit = stored.find((e) => e.area === area.id);
    return { area: area.id, status: hit?.status ?? '', notes: hit?.notes ?? '' };
  });
}

export function dismissedSuggestions(formData: FormData): string[] {
  return list<string>(formData, 'counselingDismissed');
}

function marineName(formData: FormData): string {
  const last = counselingField(formData, 'counselingMarineLastName').trim();
  const first = counselingField(formData, 'counselingMarineFirstName').trim();
  const mi = counselingField(formData, 'counselingMarineMiddleInitial').trim();
  return [last, [first, mi].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function counselingMarineDisplayName(formData: FormData): string {
  const rank = rankAbbreviation(counselingField(formData, 'counselingMarineGrade'));
  const name = marineName(formData);
  return [rank, name].filter(Boolean).join(' ');
}

export function counselingSeniorDisplayName(formData: FormData): string {
  const rank = rankAbbreviation(counselingField(formData, 'counselingSeniorGrade'));
  const last = counselingField(formData, 'counselingSeniorLastName').trim();
  const first = counselingField(formData, 'counselingSeniorFirstName').trim();
  const mi = counselingField(formData, 'counselingSeniorMiddleInitial').trim();
  const name = [last, [first, mi].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [rank, name].filter(Boolean).join(' ');
}

// --- The suggestion engine (plan section 5) ---

export type CounselingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CounselingSuggestion {
  id: string;
  step: CounselingStep;
  text: string;
  citation: string;
  /** The form field the suggestion belongs to, when one does. */
  field?: string;
  action?: {
    label: string;
    apply: (formData: FormData) => Partial<FormData>;
  };
}

const DOC_CITATION = 'NAVMC 2795 para 3005.1.j';

function areaTitles(ids: CounselingAreaId[]): string {
  return ids.map((id) => counselingArea(id)?.title ?? id).join(', ');
}

function addSubjects(formData: FormData, additions: CounselingSubject[]): Partial<FormData> {
  const current = counselingSubjects(formData);
  const have = new Set(current.map((s) => s.text.trim().toLowerCase()));
  const fresh = additions.filter((s) => !have.has(s.text.trim().toLowerCase()));
  return { counselingSubjects: [...current, ...fresh] };
}

function withAreaStatus(formData: FormData, ids: CounselingAreaId[], status: CounselingAreaStatus, onlyUnanswered = true): Partial<FormData> {
  const entries = counselingAreaEntries(formData).map((e) =>
    ids.includes(e.area) && (!onlyUnanswered || e.status === '') ? { ...e, status } : e,
  );
  return { counselingAreas: entries };
}

/**
 * Every suggestion the situation raises, dismissed ones removed. Pure:
 * the same form data returns the same list, so the panel and the
 * validators agree.
 */
export function counselingSuggestions(formData: FormData): CounselingSuggestion[] {
  if (formData.documentType !== 'counseling') return [];
  const get = (name: string) => counselingField(formData, name).trim();
  const out: CounselingSuggestion[] = [];

  const occasionValue = get('counselingOccasion');
  const occasion = counselingOccasion(occasionValue);
  const grade = get('counselingMarineGrade');
  const component = get('counselingMarineComponent');
  const sessionDate = parseNavalDate(get('date'));
  const subjects = counselingSubjects(formData).filter((s) => s.text.trim());
  const targets = counselingTargets(formData);
  const areas = counselingAreaEntries(formData);
  const lifeEvents = counselingLifeEvents(formData);
  const priorTargets = counselingPriorTargets(formData);

  // Step 1: occasion and timing.
  if (!sessionDate) {
    out.push({
      id: 'date', step: 1, field: 'date',
      text: 'Record the date of the session.',
      citation: `${DOC_CITATION}(1)`,
      action: { label: 'Set today', apply: () => ({ date: toNavalDate(new Date()) }) },
    });
  }
  const computedNext = computedNextSessionDate(formData);
  const nextValue = get('counselingNextSessionDate');
  const interval = nextSessionInterval(grade, component, occasionValue);
  if (sessionDate && !nextValue) {
    out.push({
      id: 'next-session', step: 1, field: 'counselingNextSessionDate',
      text: `Set the target date for the next session. The rule for this Marine is ${interval.label}: ${computedNext}.`,
      citation: `${interval.citation}; NAVMC 2795 Figures A-1 and A-2`,
      action: { label: `Set ${computedNext}`, apply: () => ({ counselingNextSessionDate: computedNext }) },
    });
  }
  const nextDate = parseNavalDate(nextValue);
  const computedDate = parseNavalDate(computedNext);
  if (sessionDate && nextDate && computedDate && nextDate.getTime() > computedDate.getTime()) {
    out.push({
      id: 'next-session-late', step: 1, field: 'counselingNextSessionDate',
      text: `The next session is set later than the rule for this Marine, ${interval.label}. The rule gives ${computedNext}.`,
      citation: interval.citation,
      action: { label: `Set ${computedNext}`, apply: () => ({ counselingNextSessionDate: computedNext }) },
    });
  }
  if (occasionValue === 'new-unit' || occasionValue === 'billet-change') {
    const ics = sessionDate ? toNavalDate(addDays(sessionDate, 30)) : '';
    out.push({
      id: 'new-unit', step: 1, field: 'counselingNextSessionDate',
      text: 'A new senior/junior relationship starts here. Hold the initial counseling session about 30 days in. It does not replace the welcome-aboard meeting.',
      citation: 'NAVMC 2795 para 2001.1.a; MCO 1500.61 para 4.b(2)',
      action: ics ? { label: `Set next session ${ics}`, apply: () => ({ counselingNextSessionDate: ics }) } : undefined,
    });
  }
  if (occasion?.kind === 'event') {
    out.push({
      id: 'event-praise', step: 1,
      text: 'A session is an occasion for praise as well as for problems. Either party starts one.',
      citation: 'NAVMC 2795 para 2001.4',
    });
  }

  // Step 2: who.
  if (!get('counselingMarineLastName')) {
    out.push({ id: 'marine-name', step: 2, field: 'counselingMarineLastName', text: 'Record the name of the Marine counseled.', citation: `${DOC_CITATION}(2)` });
  }
  if (!get('counselingSeniorLastName')) {
    out.push({ id: 'senior-name', step: 2, field: 'counselingSeniorLastName', text: 'Record who performed the counseling.', citation: 'NAVMC 2795 Figures A-1 and A-2' });
  }
  const billets = `${get('counselingSeniorBillet')} ${get('counselingBilletTitle')}`.toLowerCase();
  if (/\bmentor/.test(billets)) {
    out.push({
      id: 'mentor-label', step: 2, field: 'counselingSeniorBillet',
      text: "Counseling is the senior's duty. Mentoring is a voluntary relationship and is never directed, so the person performing counseling is the senior, not a mentor.",
      citation: 'MCO 1500.61 para 4.a(1)(d)',
    });
  }

  // Step 3: agenda.
  if (occasion?.kind === 'initial') {
    const ticked = new Set(counselingIcsObjectives(formData));
    const missing = ICS_OBJECTIVES.filter((o) => !ticked.has(o.id));
    if (missing.length) {
      out.push({
        id: 'ics-agenda', step: 3,
        text: `Cover the seven objectives of an initial counseling session. Still open: ${missing.map((o) => o.text.replace(/\.$/, '')).join('; ')}.`,
        citation: ICS_CITATION,
      });
    }
  }
  if (occasion?.kind === 'follow-on' && priorTargets.filter((t) => t.text.trim()).length === 0) {
    out.push({
      id: 'follow-on-review', step: 3,
      text: 'Review progress on the targets set last session, then modify them or add new ones.',
      citation: 'NAVMC 2795 para 2001.2.b',
    });
  }
  priorTargets.forEach((t, index) => {
    if (t.status === 'not-met' && t.text.trim()) {
      const core = t.text.trim().toLowerCase().replace(/^to\s+\w+\s+/, '');
      // Addressed once a new target carries it, however it was reworded.
      const already = targets.some((x) => `${x.action} ${x.object}`.toLowerCase().includes(core));
      if (already) return;
      out.push({
        id: `target-not-met-${index}`, step: 3,
        text: `"${t.text.trim()}" was not met. Identify the cause and agree a solution, or drop or modify the target if circumstances changed.`,
        citation: 'NAVMC 2795 para 2001.2.b, 4002.1.i(6)',
        action: {
          label: 'Carry forward as a new target',
          apply: (fd) => ({ counselingTargets: [...counselingTargets(fd), { ...emptyTarget(), object: t.text.trim() }] }),
        },
      });
    }
  });
  if (occasionValue === 'fitness-report' || occasionValue === 'pro-con') {
    out.push({
      id: 'fitrep-procon', step: 3,
      text: 'Tie the marks to the targets set and met this period, so the evaluation and the counseling say the same thing.',
      citation: 'MCO 1500.61 para 4.b(2); NAVMC 2795 para 4002',
    });
  }

  // Step 4: the six areas.
  const unanswered = areas.filter((a) => a.status === '').map((a) => a.area);
  if (unanswered.length) {
    out.push({
      id: 'area-unanswered', step: 4,
      text: `Answer each functional area: discussed, not this session, or target set. Open: ${areaTitles(unanswered)}.`,
      citation: `${AREA_CITATION}, 4.b(1)`,
      action: { label: 'Mark the open areas "not this session"', apply: (fd) => withAreaStatus(fd, unanswered, 'not-this-session') },
    });
  }
  areas.forEach((a) => {
    if (a.status === 'target-set' && !targets.some((t) => t.area === a.area)) {
      const title = counselingArea(a.area)?.title ?? a.area;
      out.push({
        id: `area-target-${a.area}`, step: 4,
        text: `${title} is marked for a target. Build it in step 6.`,
        citation: AREA_CITATION,
        action: { label: `Add a ${title} target`, apply: (fd) => ({ counselingTargets: [...counselingTargets(fd), emptyTarget(a.area)] }) },
      });
    }
  });
  if (isLcplOrBelow(grade)) {
    const topics: CounselingSubject[] = [
      { text: 'Strengths and weaknesses, and how to improve', area: 'duties' },
      { text: 'Pay and the Leave and Earnings Statement', area: 'finances' },
      { text: 'Family', area: 'family' },
      { text: 'Off-duty education and PME', area: 'fighter' },
      { text: 'Personal goals', area: 'future' },
      { text: 'Upcoming events affecting personal life', area: 'family' },
    ];
    const have = new Set(subjects.map((s) => s.text.trim().toLowerCase()));
    if (!topics.every((t) => have.has(t.text.toLowerCase()))) {
      out.push({
        id: 'thirty-day-topics', step: 4,
        text: 'A brief session, 10 to 15 minutes. Topics for a lance corporal or below: strengths and weaknesses, pay and the LES, family, off-duty education and PME, personal goals, and upcoming events.',
        citation: 'NAVMC 2795 para 2001.3.d, e',
        action: { label: 'Add the topics as subjects', apply: (fd) => addSubjects(fd, topics) },
      });
    }
  }
  const lifeRows: { value: string; id: string; text: string; subjects: CounselingSubject[]; areas: CounselingAreaId[] }[] = [
    {
      value: 'promotion-reenlistment', id: 'life-promotion',
      text: 'Cover the promotion or reenlistment timeline, PME and cutting-score or board requirements, and reenlistment options.',
      subjects: [{ text: 'Promotion or reenlistment timeline and requirements', area: 'future' }],
      areas: ['future', 'fighter'],
    },
    {
      value: 'birth-of-child', id: 'life-child',
      text: 'Cover dependency paperwork (this app carries NAVMC 10922), housing, finances and leave.',
      subjects: [{ text: 'Birth of a child: dependency paperwork, housing, finances, leave', area: 'family' }],
      areas: ['family', 'finances'],
    },
    {
      value: 'pcs-move', id: 'life-pcs',
      text: 'Cover orders, household goods, family plans, and finances during the move.',
      subjects: [{ text: 'PCS move: orders, household goods, family plans, finances', area: 'family' }],
      areas: ['family', 'finances'],
    },
    {
      value: 'first-purchase', id: 'life-purchase',
      text: 'Cover the financial decision and a command financial counselor referral.',
      subjects: [{ text: 'First car or house: the financial decision, command financial counselor', area: 'finances' }],
      areas: ['finances'],
    },
    {
      value: 'resident-school', id: 'life-school',
      text: 'Cover preparation, prerequisites, and what follows the course.',
      subjects: [{ text: 'Resident school or special training: preparation, prerequisites, what follows', area: 'fighter' }],
      areas: ['fighter', 'future'],
    },
  ];
  for (const row of lifeRows) {
    if (!lifeEvents.includes(row.value)) continue;
    const have = new Set(subjects.map((s) => s.text.trim().toLowerCase()));
    if (row.subjects.every((s) => have.has(s.text.toLowerCase()))) continue;
    out.push({
      id: row.id, step: 4,
      text: row.text,
      citation: LIFE_EVENT_CITATION,
      action: { label: `Add as a subject under ${areaTitles(row.areas)}`, apply: (fd) => addSubjects(fd, row.subjects) },
    });
  }
  if (occasionValue === 'force-preservation') {
    const have = subjects.some((s) => /well-being/i.test(s.text));
    if (!have) {
      out.push({
        id: 'force-preservation', step: 4,
        text: 'Cover physical, mental, spiritual and social well-being, and the resources available.',
        citation: 'MCO 1500.61 para 4.b(2), 4.a(1)(d) Fitness',
        action: { label: 'Add as a subject under Fitness', apply: (fd) => addSubjects(fd, [{ text: 'Well-being: physical, mental, spiritual, social; resources available', area: 'fitness' }]) },
      });
    }
  }

  // Step 6: targets.
  if (targets.length < 3) {
    out.push({
      id: 'target-count-low', step: 6,
      text: `Set a few important targets, generally three to five, achievable before the next session. ${targets.length} so far.`,
      citation: 'NAVMC 2795 para 4002.1.i(4)',
      action: { label: 'Add a target', apply: (fd) => ({ counselingTargets: [...counselingTargets(fd), emptyTarget()] }) },
    });
  }
  if (targets.length > 5) {
    out.push({
      id: 'target-count-high', step: 6,
      text: `${targets.length} targets. Keep the ones that make the biggest difference before the next session, generally three to five.`,
      citation: 'NAVMC 2795 para 4002.1.i(4)',
    });
  }
  targets.forEach((t, index) => {
    const touched = t.action.trim() || t.object.trim() || t.standard.trim() || t.dueDate.trim();
    if (touched && !targetIsWellFormed(t)) {
      out.push({
        id: `target-form-${index}`, step: 6,
        text: `Target ${index + 1}: state it as an action, its object, and a standard or due date (quantity, quality, timeliness or manner).`,
        citation: 'NAVMC 2795 para 4002.1.f to h',
      });
    }
    const due = parseNavalDate(t.dueDate);
    if (due && nextDate && due.getTime() > nextDate.getTime()) {
      out.push({
        id: `target-due-${index}`, step: 6,
        text: `Target ${index + 1} is due after the next session (${nextValue}). Move the date or split the target.`,
        citation: 'NAVMC 2795 para 4002.1.i(4)',
        action: {
          label: `Set due to ${nextValue}`,
          apply: (fd) => ({ counselingTargets: counselingTargets(fd).map((x, i) => (i === index ? { ...x, dueDate: nextValue } : x)) }),
        },
      });
    }
  });
  if (targets.length > 0 && !get('counselingMarineComments')) {
    out.push({
      id: 'target-ownership', step: 6,
      text: "Targets are a joint effort and the Marine should own them. Ask the Marine for one, and record the Marine's comments.",
      citation: 'NAVMC 2795 para 4002.1.i(5)',
      action: { label: "Include the Marine's comments", apply: () => ({ counselingIncludeMarineComments: true }) },
    });
  }

  // Step 5 and 7: content and the record.
  if (subjects.length === 0 && targets.length === 0 && !areas.some((a) => a.notes.trim())) {
    out.push({
      id: 'content', step: 5,
      text: 'Record the subjects discussed, the targets set, or both.',
      citation: `${DOC_CITATION}(3), (4)`,
    });
  }
  out.push({
    id: 'handling', step: 7,
    text: 'This record is for the senior and the junior only. It is not forwarded in the reporting chain, not passed to a succeeding senior, and destroyed when the senior/junior relationship ends.',
    citation: 'NAVMC 2795 para 3005.1.i; MCO 1500.61 para 5.c',
  });

  const dismissed = new Set(dismissedSuggestions(formData));
  return out.filter((s) => !dismissed.has(s.id));
}

/**
 * The suggestions as compliance-panel warnings. The handling note is
 * informational and stays out of the count. Empty for every other
 * documentType.
 */
export function runCounselingValidators(formData: FormData): ValidationIssue[] {
  if (formData.documentType !== 'counseling') return [];
  return counselingSuggestions(formData)
    .filter((s) => s.id !== 'handling')
    .map((s) => ({
      id: `counseling-${s.id}`,
      severity: 'warn' as const,
      rule: s.text,
      citation: s.citation,
      detail: `Suggestion for step ${s.step}. Nothing on this worksheet blocks an export.`,
      field: s.field,
    }));
}

// --- The record's own text ---

export const HANDLING_STATEMENT =
  'This record is for use only by the Marine counseled and the Marine performing the counseling. It is not forwarded in the reporting chain, is not passed to a succeeding senior, and is destroyed when the senior/junior relationship ends (NAVMC 2795 para 3005.1.i). It contains personally identifiable information protected by the Privacy Act of 1974 (MCO 1500.61 para 5.c).';

export const PRIVACY_MARKING = 'PRIVACY SENSITIVE';

export function occasionLabel(formData: FormData): string {
  const value = counselingField(formData, 'counselingOccasion');
  return counselingOccasion(value)?.label ?? value;
}
