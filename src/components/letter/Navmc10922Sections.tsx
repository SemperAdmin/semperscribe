'use client';

/**
 * NAVMC 10922 form sections - Phase 2 of docs/NAVMC_10922_BUILD_PLAN.md.
 *
 * Why this exists instead of one DynamicForm: the paper form's order is
 * Section 1, 2 (dependents grid), 3 (custodian), 4 (marriage scalars,
 * dissolution grid, court order), 5, 6, 7. A single DynamicForm renders
 * all scalar sections in one block, which would push every grid after
 * Section 7. This component interleaves four narrow DynamicForm
 * instances with the three custom grids so the screen follows the
 * paper. Each instance sanitizes to its own section keys and the parent
 * merge is a shallow spread, so instances and grids never clobber each
 * other's fields.
 *
 * Grid capacity is fixed - 6 dependents, 4 dissolutions, 1 custodian -
 * because those are form facts (spec section 5). No add-row controls.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users, Home, HeartCrack, FileCheck2, Building, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Unit } from '@/lib/units';
import { useUnits } from '@/hooks/useReferenceData';
import { FormData } from '@/types';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES, DocumentTypeDefinition } from '@/lib/schemas';
import {
  Navmc10922Dependent,
  Navmc10922Dissolution,
  NAVMC_10922_RELATIONSHIPS,
  NAVMC_10922_EMPTY_DEPENDENT,
  NAVMC_10922_EMPTY_DISSOLUTION,
} from '@/types/navmc';
import { DatePicker } from '@/components/ui/date-picker';
import {
  NAVMC10922_DOCS_VIEWED_CAPACITY,
  suggestAllowanceClaimedFrom,
  claimedFromHint,
  parseDateLoose,
  formatMDYY,
  sameDay,
  suggestedDocuments,
  parseDocItems,
  joinDocItems,
  swornPartsFromDate,
  swornPartsToDate,
  lossNarrative,
  isManagedDocLabel,
} from '@/lib/navmc10922-utils';

interface Navmc10922SectionsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  /** The page-level dynamic form merge handler (keeps debug logging). */
  onDynamicSync: (data: any) => void;
  formKey: number | string;
}

// Narrow sub-definitions sharing the registered schema. Module scope
// keeps them referentially stable, which DynamicForm's memos expect.
function subDefinition(ids: string[]): DocumentTypeDefinition {
  const def = DOCUMENT_TYPES['navmc10922'];
  return { ...def, sections: def.sections.filter((s) => ids.includes(s.id)) };
}
const DEF_HEADER = subDefinition(['reason', 'identification']);
const DEF_MARITAL = subDefinition(['marital']);
const DEF_SUPPORT = subDefinition(['support']);
const DEF_TAIL = subDefinition(['natural-parent', 'spouse-service']);

function sixDependents(formData: FormData): Navmc10922Dependent[] {
  const rows: Navmc10922Dependent[] = Array.isArray(formData.dependents)
    ? [...formData.dependents]
    : [];
  while (rows.length < 6) rows.push({ ...NAVMC_10922_EMPTY_DEPENDENT });
  return rows.slice(0, 6);
}

function fourDissolutions(formData: FormData): Navmc10922Dissolution[] {
  const rows: Navmc10922Dissolution[] = Array.isArray(formData.dissolutions)
    ? [...formData.dissolutions]
    : [];
  while (rows.length < 4) rows.push({ ...NAVMC_10922_EMPTY_DISSOLUTION });
  return rows.slice(0, 4);
}

function SectionCard({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

// --- Reason for application: derived START/GAIN + LOSS panel --------

/**
 * The reason code derives from Section 2: any dependent marked
 * previously approved means a record exists (GAIN); none means this
 * application establishes the record (START) - the discriminator the
 * printed column header carries ("If previously approved, give date of
 * approval"). LOSS is always a manual choice, and its panel names the
 * lost dependent, who has NO Section 2 row - the roster lists the
 * REMAINING dependents.
 */
function ReasonSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const rows = sixDependents(formData);
  const anyPrev = rows.some((r) =>
    (r.name || r.relationship) && r.previouslyApproved
  );
  const derived: 'start' | 'gain' = anyPrev ? 'gain' : 'start';
  const reason = (formData.reason as string) || '';
  const isLoss = reason === 'loss';

  // START/GAIN is fully derived from the Section 2 previously-approved
  // flags - no manual selection (Stephen 2026-07-20). The only user
  // choice is LOSS, which toggles; leaving LOSS returns to derivation.
  React.useEffect(() => {
    if (!isLoss && reason !== derived) {
      setFormData((prev) => ({ ...prev, reason: derived, reasonMode: 'auto' }));
    }
  }, [isLoss, reason, derived, setFormData]);

  const toggleLoss = () =>
    setFormData((prev) =>
      prev.reason === 'loss'
        ? { ...prev, reason: derived, reasonMode: 'auto' }
        : { ...prev, reason: 'loss', reasonMode: 'manual' }
    );

  const narrative = lossNarrative(formData);

  return (
    <SectionCard icon={<FileCheck2 className="mr-2 h-5 w-5" />} title="Reason for Application">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
          {isLoss ? 'LOSS' : derived.toUpperCase()}
        </span>
        <Button type="button" size="sm" variant={isLoss ? 'default' : 'outline'} onClick={toggleLoss}>
          {isLoss ? 'Cancel LOSS — back to automatic' : 'This is a LOSS'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {isLoss
          ? 'LOSS selected - name the lost dependent below. The roster in Section 2 lists the REMAINING dependents.'
          : anyPrev
            ? 'GAIN - derived automatically: at least one Section 2 dependent is marked previously approved, so a record exists.'
            : 'START - derived automatically: no dependent is marked previously approved, so this application establishes the record. START exports via the flattened print (the box is unbindable on the editable form).'}
      </p>

      {reason === 'loss' && (
        <div className="mt-4 rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            Lost dependent — not listed in Section 2 (the roster carries the REMAINING dependents)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={(formData.lostDependentName as string) ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, lostDependentName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relationship</Label>
              <Select
                value={(formData.lostDependentRelationship as string) || undefined}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, lostDependentRelationship: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {NAVMC_10922_RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loss Event</Label>
              <Select
                value={(formData.lostEventType as string) || undefined}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, lostEventType: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="divorce">Divorce</SelectItem>
                  <SelectItem value="annulment">Annulment</SelectItem>
                  <SelectItem value="death">Death</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Effective Date</Label>
              <Input
                type="date"
                value={(formData.lostEffectiveDate as string) ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, lostEffectiveDate: e.target.value }))}
              />
            </div>
          </div>
          {(formData.lostEventType === 'divorce' || formData.lostEventType === 'annulment' ||
            (formData.lostEventType === 'death' && formData.lostDependentRelationship === 'SPOUSE')) && (
            <p className="text-[11px] text-amber-600">
              A marriage ended - record it in the Section 4 dissolution table (former marriage of
              YOURSELF, with date, place, and reason) and clear the present-marriage block.
            </p>
          )}
          {narrative && (
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono flex-1">{narrative}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={parseDocItems((formData.documentsViewed as string) ?? '').includes(narrative)}
                onClick={() =>
                  setFormData((prev) => {
                    const items = parseDocItems((prev.documentsViewed as string) ?? '');
                    return items.includes(narrative)
                      ? prev
                      : { ...prev, documentsViewed: joinDocItems([...items, narrative]) };
                  })
                }
              >
                Add to Section 7 line
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// --- Section 1: unit / station with directory search ----------------

function UnitSearchDialog({ open, onOpenChange, onSelect, title }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (unit: Unit) => void;
  title: string;
}) {
  const [query, setQuery] = React.useState('');
  const { units, loading } = useUnits();
  const filtered = React.useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return units
      .filter((u) =>
        u.unitName.toLowerCase().includes(q) ||
        u.ruc.toLowerCase().includes(q) ||
        u.mcc.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, units]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col h-[70vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search by Name, RUC, or MCC..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {query.length <= 1 && (
              <p className="text-center py-8 text-muted-foreground text-sm">Type at least 2 characters to search...</p>
            )}
            {query.length > 1 && loading && (
              <p className="text-center py-8 text-muted-foreground text-sm">Loading unit directory...</p>
            )}
            {query.length > 1 && !loading && filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No units found matching &quot;{query}&quot;</p>
            )}
            {filtered.map((u) => (
              <button
                key={`${u.ruc}-${u.mcc}-${u.streetAddress}`}
                type="button"
                onClick={() => { onSelect(u); onOpenChange(false); setQuery(''); }}
                className="w-full text-left p-3 rounded-lg hover:bg-secondary/5 transition-colors border border-transparent hover:border-secondary/20 flex flex-col gap-1"
              >
                <span className="font-semibold text-sm">{u.unitName}</span>
                <span className="text-xs text-muted-foreground flex gap-2">
                  <Badge variant="secondary" className="text-[10px] h-5">RUC: {u.ruc}</Badge>
                  <Badge variant="outline" className="text-[10px] h-5">MCC: {u.mcc}</Badge>
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {u.streetAddress}, {u.cityState} {u.zip}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function unitAddressBlock(u: Unit): string {
  return `${u.unitName}\n${u.streetAddress}\n${u.cityState} ${u.zip}`.toUpperCase();
}

/**
 * Owns organizationStation, unitRuc, and futureAddressEta OUTSIDE the
 * DynamicForm instances - an instance owning these keys would clobber
 * unit-search writes on its next debounced sync (RHF seeds defaults
 * once at mount and never re-reads formData).
 */
function UnitStationSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const [orgSearch, setOrgSearch] = React.useState(false);
  const [futureSearch, setFutureSearch] = React.useState(false);

  return (
    <SectionCard icon={<Building className="mr-2 h-5 w-5" />} title="Section 1 — Organization and Station">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="n10922-org" className="text-sm">Organization and Station Preparing This Application</Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOrgSearch(true)}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Search unit
            </Button>
          </div>
          <Textarea
            id="n10922-org"
            rows={3}
            value={(formData.organizationStation as string) ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, organizationStation: e.target.value }))}
            placeholder={'1/6 2D MARDIV\nPSC BOX 20098\nCAMP LEJEUNE NC 28542-0098'}
          />
          <div className="flex items-end gap-3">
            <div className="space-y-1 w-40">
              <Label htmlFor="n10922-ruc" className="text-xs">Unit RUC</Label>
              <Input
                id="n10922-ruc"
                value={(formData.unitRuc as string) ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, unitRuc: e.target.value }))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground pb-1">
              Auto-filled from the unit search. The RUC decides who holds approval authority
              (MCO 1751.3 Ch 1 para 1.c).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="n10922-future" className="text-sm">Future Address and ETA if Transfer Anticipated Within 60 Days</Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFutureSearch(true)}>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Search unit
            </Button>
          </div>
          <Textarea
            id="n10922-future"
            rows={3}
            value={(formData.futureAddressEta as string) ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, futureAddressEta: e.target.value }))}
            placeholder="Leave blank unless a PCS falls within 60 days of the application date."
          />
          <p className="text-[11px] text-muted-foreground">
            Only when a PCS falls within 60 days. Selecting a unit inserts its address and an
            ETA line to complete.
          </p>
        </div>
      </div>

      <UnitSearchDialog
        open={orgSearch}
        onOpenChange={setOrgSearch}
        title="Search Units — Preparing Organization"
        onSelect={(u) =>
          setFormData((prev) => ({ ...prev, organizationStation: unitAddressBlock(u), unitRuc: u.ruc }))
        }
      />
      <UnitSearchDialog
        open={futureSearch}
        onOpenChange={setFutureSearch}
        title="Search Units — Future Duty Station"
        onSelect={(u) =>
          setFormData((prev) => ({ ...prev, futureAddressEta: `${unitAddressBlock(u)}\nETA: ` }))
        }
      />
    </SectionCard>
  );
}

// --- Section 2: dependents grid -------------------------------------

function DependentsSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const rows = sixDependents(formData);
  const rowHasContent = (r: Navmc10922Dependent) =>
    Boolean(r.name || r.address || r.relationship || r.dateOfBirth || r.allowanceClaimedFrom);
  const lastActive = rows.reduce((a, r, i) => (rowHasContent(r) ? i : a), -1);

  // Visible rows collapse the fixed 6-row form array to save vertical
  // space: populated rows plus any blank rows the user added, capped at
  // the form's capacity. Template loads can raise the active count
  // after mount - the effect keeps the view in sync.
  const [visible, setVisible] = React.useState(() => Math.max(1, lastActive + 1));
  React.useEffect(() => {
    setVisible((v) => Math.max(v, lastActive + 1, 1));
  }, [lastActive]);

  const updateRow = (index: number, patch: Partial<Navmc10922Dependent>) => {
    setFormData((prev) => {
      const next = sixDependents(prev);
      next[index] = { ...next[index], ...patch };
      return { ...prev, dependents: next };
    });
  };

  return (
    <SectionCard icon={<Users className="mr-2 h-5 w-5" />} title="Section 2 — Dependent Information">
      <p className="text-xs text-muted-foreground mb-4">
        The form holds up to 6 dependents. DATE ALLOWANCE CLAIMED FROM is the date the
        dependent is acquired — marriage, birth, adoption (FMR Vol 7A Ch 26 May 2025 para 10.3,
        Table 26-1 rule 5).
      </p>
      <div className="space-y-4">
        {rows.slice(0, visible).map((row, i) => {
          const prev = !!row.previouslyApproved;
          const suggestion = prev ? null : suggestAllowanceClaimedFrom(row, formData.marriageDate as string);
          const hint = prev ? null : claimedFromHint(row.relationship);
          const differs =
            suggestion && row.allowanceClaimedFrom.trim() !== '' &&
            !sameDay(row.allowanceClaimedFrom, suggestion.date);
          const canOffer = suggestion && row.allowanceClaimedFrom.trim() === '';
          const rowActive = Boolean(
            row.name || row.address || row.relationship || row.dateOfBirth || row.allowanceClaimedFrom
          );
          return (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-muted-foreground">Dependent {i + 1}</span>
                {rowActive && (
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={prev}
                        onCheckedChange={(v) => updateRow(i, { previouslyApproved: v === true })}
                      />
                      Previously approved on an earlier NAVMC 10922
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={!!row.livesOutsideHousehold}
                        onCheckedChange={(v) => updateRow(i, { livesOutsideHousehold: v === true })}
                      />
                      Lives outside the member&apos;s household (requires Section 3 custodian)
                    </label>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name (full given name)</Label>
                  <Input value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship</Label>
                  <Select
                    value={row.relationship || undefined}
                    onValueChange={(v) => updateRow(i, { relationship: v as Navmc10922Dependent['relationship'] })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {NAVMC_10922_RELATIONSHIPS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={row.dateOfBirth} onChange={(e) => updateRow(i, { dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Complete Address (include zip code)</Label>
                  <Input value={row.address} onChange={(e) => updateRow(i, { address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {prev ? 'Date of Approval (previously approved)' : 'Date Allowance Claimed From'}
                  </Label>
                  <Input
                    type="date"
                    value={row.allowanceClaimedFrom}
                    onChange={(e) => updateRow(i, { allowanceClaimedFrom: e.target.value })}
                  />
                  {canOffer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs mt-1"
                      onClick={() => updateRow(i, { allowanceClaimedFrom: suggestion.date })}
                    >
                      Use {formatMDYY(suggestion.date)} ({suggestion.basis === 'marriage' ? 'marriage date' : 'date of birth'})
                    </Button>
                  )}
                  {canOffer && (
                    <p className="text-[11px] text-muted-foreground">{suggestion.citation}</p>
                  )}
                  {differs && (
                    <p className="text-[11px] text-amber-600">
                      Differs from the computed {formatMDYY(suggestion!.date)} ({suggestion!.citation}).
                      An override is allowed; be ready to substantiate it.
                    </p>
                  )}
                  {hint && rowActive && (
                    <p className="text-[11px] text-muted-foreground">{hint}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={visible >= 6}
          onClick={() => setVisible((v) => Math.min(6, v + 1))}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Add dependent
        </Button>
        <span className="text-xs text-muted-foreground">
          {visible} of 6 rows shown — the official form holds 6.
        </span>
      </div>
    </SectionCard>
  );
}

// --- Section 3: custodian -------------------------------------------

function CustodianSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const rows = sixDependents(formData);
  const flagged = rows
    .map((r, i) => ({ row: r, no: i + 1 }))
    .filter((x) => x.row.livesOutsideHousehold);
  const custodian = formData.custodian ?? { depNo: '', name: '', relationship: '', address: '' };

  const update = (patch: Partial<typeof custodian>) =>
    setFormData((prev) => ({
      ...prev,
      custodian: { ...(prev.custodian ?? { depNo: '', name: '', relationship: '', address: '' }), ...patch },
    }));

  return (
    <SectionCard icon={<Home className="mr-2 h-5 w-5" />} title="Section 3 — Custodian Information">
      {flagged.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dependent is flagged as living outside the member&apos;s household — Section 3 stays
          empty. Flag a dependent in Section 2 when a third party holds physical custody
          (docs/NAVMC_10922_SPEC.md section 5).
        </p>
      ) : (
        <>
          {flagged.length > 1 && (
            <p className="text-xs text-amber-600 mb-3">
              {flagged.length} dependents are flagged, but the official form holds ONE custodian
              row. If they have different custodians, a continuation sheet is required —
              continuation sheets are a later phase, and export will block until then.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dep No.</Label>
              <Select value={custodian.depNo || undefined} onValueChange={(v) => update({ depNo: v })}>
                <SelectTrigger><SelectValue placeholder="Row…" /></SelectTrigger>
                <SelectContent>
                  {flagged.map((x) => (
                    <SelectItem key={x.no} value={String(x.no)}>
                      {x.no}{x.row.name ? ` — ${x.row.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full Name of Custodian</Label>
              <Input value={custodian.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relationship to Dependent</Label>
              <Input value={custodian.relationship} onChange={(e) => update({ relationship: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address and Zip Code</Label>
              <Input value={custodian.address} onChange={(e) => update({ address: e.target.value })} />
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// --- Section 4: dissolution grid ------------------------------------

function DissolutionSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const needed =
    formData.memberPrevMarried === 'yes' || formData.spousePrevMarried === 'yes';
  const rows = fourDissolutions(formData);
  const marriage = parseDateLoose(formData.marriageDate as string);

  const rowHasContent = (r: Navmc10922Dissolution) =>
    Boolean(r.formerMarriageOf || r.spouseName || r.dateOfDissolution || r.placeOfDissolution || r.reason);
  const lastActive = rows.reduce((a, r, i) => (rowHasContent(r) ? i : a), -1);

  // Same collapse-and-add pattern as Section 2: populated rows plus
  // any blanks the user added, capped at the form's 4 rows. The effect
  // follows template loads (this component is not formKey-keyed).
  const [visible, setVisible] = React.useState(() => Math.max(1, lastActive + 1));
  React.useEffect(() => {
    setVisible((v) => Math.max(v, lastActive + 1, 1));
  }, [lastActive]);

  const updateRow = (index: number, patch: Partial<Navmc10922Dissolution>) => {
    setFormData((prev) => {
      const next = fourDissolutions(prev);
      next[index] = { ...next[index], ...patch };
      return { ...prev, dissolutions: next };
    });
  };

  return (
    <SectionCard
      icon={<HeartCrack className="mr-2 h-5 w-5" />}
      title="Section 4 — Dissolution of Former Marriages"
    >
      {!needed ? (
        <p className="text-sm text-muted-foreground">
          Required only when either prior-marriage answer above is YES. The form holds 4 rows —
          member and spouse combined.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Every dissolution date must precede the present marriage date — a later date makes the
            present marriage void for BAH purposes and routes the case to CMC (MFP-1)
            (MCO 1751.3 Ch 1 para 3.c).
          </p>
          {rows.slice(0, visible).map((row, i) => {
            const dis = parseDateLoose(row.dateOfDissolution);
            const invalid = dis && marriage && dis.getTime() >= marriage.getTime();
            return (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Former Marriage {i + 1}</span>
                  {row.reason === 'divorce' && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={!!row.foreignDivorce}
                        onCheckedChange={(v) => updateRow(i, { foreignDivorce: v === true })}
                      />
                      Foreign nation divorce (doubtful case — CO cannot approve; adds the para 4.b evidence set)
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Former Marriage Of</Label>
                    <Select
                      value={row.formerMarriageOf || undefined}
                      onValueChange={(v) => updateRow(i, { formerMarriageOf: v as Navmc10922Dissolution['formerMarriageOf'] })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Yourself</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Spouse in the Dissolved Marriage</Label>
                    <Input value={row.spouseName} onChange={(e) => updateRow(i, { spouseName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date of Dissolution</Label>
                    <Input type="date" value={row.dateOfDissolution} onChange={(e) => updateRow(i, { dateOfDissolution: e.target.value })} />
                    {invalid && (
                      <p className="text-[11px] text-destructive">
                        On or after the present marriage date — export will block
                        (MCO 1751.3 Ch 1 para 3.c).
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Place (County and State)</Label>
                    <Input value={row.placeOfDissolution} onChange={(e) => updateRow(i, { placeOfDissolution: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reason</Label>
                    <Select
                      value={row.reason || undefined}
                      onValueChange={(v) => updateRow(i, { reason: v as Navmc10922Dissolution['reason'] })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="death">Death</SelectItem>
                        <SelectItem value="annulment">Annulment</SelectItem>
                        <SelectItem value="divorce">Divorce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={visible >= 4}
              onClick={() => setVisible((v) => Math.min(4, v + 1))}
            >
              <HeartCrack className="w-3.5 h-3.5 mr-1.5" />
              Add former marriage
            </Button>
            <span className="text-xs text-muted-foreground">
              {visible} of 4 rows shown — beyond 4, the form directs a separate sheet
              (continuation sheets are a later phase; export blocks).
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// --- Section 7 aid: documents viewed with the field-93 meter ---------

function DocumentsViewedSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const value = (formData.documentsViewed as string) ?? '';
  const over = value.length > NAVMC10922_DOCS_VIEWED_CAPACITY;
  const items = parseDocItems(value);
  const suggestions = suggestedDocuments(formData);
  const [custom, setCustom] = React.useState('');

  const toggle = (label: string, on: boolean) => {
    setFormData((prev) => {
      const current = parseDocItems((prev.documentsViewed as string) ?? '');
      const next = on
        ? (current.includes(label) ? current : [...current, label])
        : current.filter((i) => i !== label);
      return { ...prev, documentsViewed: joinDocItems(next) };
    });
  };

  const addCustom = () => {
    const label = custom.trim().toUpperCase();
    if (!label) return;
    toggle(label, true);
    setCustom('');
  };

  // Items on the line that the scenario checklist did not suggest -
  // custom additions, the adopted loss narrative, imported content.
  // They render as checked rows; unchecking removes them.
  const suggestedLabels = new Set(suggestions.map((s) => s.label));
  const extras = items.filter((i) => !suggestedLabels.has(i));

  // STALE machine items: generated for a scenario that no longer holds
  // (marriage type switched, relationship removed, court order flipped).
  // Auto-remove them - only canonical machine labels match, so user
  // custom items and the LOSS narrative are untouched.
  const stale = extras.filter(isManagedDocLabel);
  React.useEffect(() => {
    if (stale.length === 0) return;
    setFormData((prev) => {
      const current = parseDocItems((prev.documentsViewed as string) ?? '');
      const kept = current.filter((i) => suggestedLabels.has(i) || !isManagedDocLabel(i));
      return kept.length === current.length ? prev : { ...prev, documentsViewed: joinDocItems(kept) };
    });
    // suggestion set is derived from formData each render; stale list
    // converges to empty after one removal pass
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale.join('|')]);

  return (
    <SectionCard
      icon={<FileCheck2 className="mr-2 h-5 w-5" />}
      title="Section 7 — Documents Viewed"
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm">
            Required for this {formData.reason === 'loss' ? 'LOSS' : 'application'} — each check
            becomes one item on the printed line
          </Label>
          {suggestions.map((s) => (
            <div key={s.label} className="flex items-start gap-2">
              <Checkbox
                id={`docv-${s.label}`}
                checked={items.includes(s.label)}
                onCheckedChange={(v) => toggle(s.label, v === true)}
                className="mt-0.5"
              />
              <label htmlFor={`docv-${s.label}`} className="cursor-pointer">
                <span className="text-sm">{s.label}</span>
                <span className="block text-[11px] text-muted-foreground">{s.citation}</span>
              </label>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No required documents derived yet — list dependents in Section 2 (or complete the
              LOSS panel) and the checklist fills itself.
            </p>
          )}
          {extras.filter((i) => !isManagedDocLabel(i)).map((label) => (
            <div key={label} className="flex items-start gap-2">
              <Checkbox
                id={`docv-x-${label}`}
                checked
                onCheckedChange={(v) => { if (v !== true) toggle(label, false); }}
                className="mt-0.5"
              />
              <label htmlFor={`docv-x-${label}`} className="cursor-pointer">
                <span className="text-sm">{label}</span>
                <span className="block text-[11px] text-muted-foreground">Added item — uncheck to remove</span>
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="navmc10922-docs-custom" className="text-xs">Add another document</Label>
            <Input
              id="navmc10922-docs-custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="e.g. COMMAND LETTER AUTHORIZING OFF-BASE RESIDENCE"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()}>
            Add
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Printed line (assembled from the checks)</Label>
          <div className={`rounded-md border border-input bg-muted/30 p-2 text-xs font-mono min-h-[2.25rem] ${over ? 'border-destructive' : ''}`}>
            {value || <span className="text-muted-foreground font-sans">Nothing checked yet.</span>}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              One narrow line on the form — overflow vanishes in Adobe with no indicator.{' '}
              {formData.reason === 'loss' &&
                'For a LOSS, the narrative from the reason panel belongs on this line too (secondary dependent losses require it - MCO 1751.3 Ch 1 para 10).'}
            </p>
            <span className={`text-xs font-mono ${over ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
              {value.length}/{NAVMC10922_DOCS_VIEWED_CAPACITY}
            </span>
          </div>
          {over && (
            <p className="text-xs text-destructive">
              Over capacity — export will block until this fits the printed line. Uncheck items
              or shorten custom ones.
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// --- Section 7: subscribed-and-sworn date ---------------------------

/**
 * One picker, three form elements. The paper certification line reads
 * "Subscribed and sworn before me this ___ day of ______ 20__" - the
 * XFA carries them as separate nodes (indices 85, 83, 84), so the
 * picked date parses into day, full month name, and 2-digit year.
 */
function SwornDateSection({ formData, setFormData }: {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const current = swornPartsToDate({
    swornDay: formData.swornDay as string,
    swornMonth: formData.swornMonth as string,
    swornYear2Digit: formData.swornYear2Digit as string,
  });

  const setDate = (d: Date | undefined) => {
    setFormData((prev) => ({
      ...prev,
      ...(d
        ? swornPartsFromDate(d)
        : { swornDay: '', swornMonth: '', swornYear2Digit: '' }),
    }));
  };

  return (
    <SectionCard icon={<FileCheck2 className="mr-2 h-5 w-5" />} title="Section 7 — Subscribed and Sworn">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-sm">Date sworn before the attesting officer</Label>
          <DatePicker date={current ?? undefined} setDate={setDate} placeholder="Pick the sworn date" />
        </div>
        <p className="text-xs text-muted-foreground">
          Prints as three elements: day <span className="font-mono">{(formData.swornDay as string) || '—'}</span>,
          month <span className="font-mono">{(formData.swornMonth as string) || '—'}</span>,
          year 20<span className="font-mono">{(formData.swornYear2Digit as string) || '——'}</span>.
          Leave unset for the attesting officer to complete in Adobe.
        </p>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="n10922-attesting" className="text-sm">Attesting Officer Name (not printed)</Label>
          <Input
            id="n10922-attesting"
            value={(formData.attestingOfficerName as string) ?? ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, attestingOfficerName: e.target.value }))}
            placeholder="STEWART, THOMAS J"
          />
          <p className="text-[11px] text-muted-foreground">
            Administrative personnel with by-direction authority. Self attestation is prohibited
            (MCO 1751.3 CH-1 para 3.a) — export blocks when this matches the member name. The
            officer signs the form itself in Adobe; this field only powers that check.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// --- Composition ----------------------------------------------------

export function Navmc10922FormSections({
  formData, setFormData, onDynamicSync, formKey,
}: Navmc10922SectionsProps) {
  return (
    <>
      <ReasonSection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm
          key={`navmc10922-${formKey}-header`}
          documentType={DEF_HEADER}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </div>
      <UnitStationSection formData={formData} setFormData={setFormData} />
      <DependentsSection formData={formData} setFormData={setFormData} />
      <CustodianSection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm
          key={`navmc10922-${formKey}-marital`}
          documentType={DEF_MARITAL}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </div>
      <DissolutionSection formData={formData} setFormData={setFormData} />
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm
          key={`navmc10922-${formKey}-support`}
          documentType={DEF_SUPPORT}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </div>
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <DynamicForm
          key={`navmc10922-${formKey}-tail`}
          documentType={DEF_TAIL}
          onSubmit={onDynamicSync}
          defaultValues={formData}
        />
      </div>
      <SwornDateSection formData={formData} setFormData={setFormData} />
      <DocumentsViewedSection formData={formData} setFormData={setFormData} />
    </>
  );
}
