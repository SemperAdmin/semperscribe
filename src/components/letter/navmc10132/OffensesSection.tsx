'use client';

/**
 * NAVMC 10132 items 1 and 5, the Unit Punishment Book offense rows.
 *
 * The paper form splits an offense (item 1, article and summary) from its
 * finding (item 5, guilty or not guilty) into two separate rows on the page.
 * A clerk never thinks of them apart, so this component renders one offense
 * and its finding on a single line and leaves the item 1 versus item 5 split
 * to the emitter. Without this the UI would force a clerk to scroll between
 * two unrelated-looking rows to enter one thought.
 *
 * Two things here exist only because of paper-form defects, and removing
 * them reintroduces those defects:
 *
 * 1. The finding select stores 'Guilty' and 'Not Guilty', never 'G' or 'NG'.
 *    The PDF displays G and NG but its own export values are the long
 *    strings, and the item 6 script on the form tests for "Guilty" verbatim.
 *    Storing the short form ships a document whose own logic cannot read it.
 *
 * 2. The summary field is measured by rendered width (Arial 8pt, via the
 *    Phase 2 engine), not by character count. Every widget on this form is a
 *    fixed-width, non-shrinking field, and a proportional font overflows a
 *    field long before a naive character cap would warn anyone.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormData } from '@/types';
import {
  measureText, usableWidthOf, fitsInField, overflowBy,
  resolveArticle, NAVMC_10132_ARTICLES, NAVMC_10132_ARTICLE_GROUPS,
} from '@/lib/navmc10132-utils';
import {
  NAVMC_10132_EMPTY_OFFENSE, type Navmc10132Offense,
} from '@/types/navmc';
import { Gavel, Search, ShieldAlert, Plus } from 'lucide-react';

type SectionCardProps = { icon: React.ReactNode; title: string; children: React.ReactNode };

interface SectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  SectionCard: React.ComponentType<SectionCardProps>;
}

/** The engine's own article row shape, borrowed rather than redeclared. */
type Navmc10132ArticleEntry = (typeof NAVMC_10132_ARTICLES)[number];

/** The form has exactly five offense rows, lettered A through E. */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Pads or trims formData.offenses to the form's fixed five rows. */
function fiveOffenses(formData: FormData): Navmc10132Offense[] {
  const rows: Navmc10132Offense[] = Array.isArray(formData.offenses)
    ? [...(formData.offenses as Navmc10132Offense[])]
    : [];
  while (rows.length < 5) rows.push({ ...NAVMC_10132_EMPTY_OFFENSE });
  return rows.slice(0, 5);
}

/** A row counts as used if the clerk has touched its article, summary, or finding. */
function isOffenseActive(offense: Navmc10132Offense): boolean {
  return Boolean(offense.articleLabel || offense.summary || offense.finding);
}

export function OffensesSection({ formData, setFormData, SectionCard }: SectionProps) {
  const offenses = fiveOffenses(formData);

  const lastActive = offenses.reduce(
    (acc, offense, index) => (isOffenseActive(offense) ? index : acc),
    -1,
  );
  const [visible, setVisible] = React.useState(() => Math.max(1, lastActive + 1));
  React.useEffect(() => {
    setVisible((v) => Math.max(v, lastActive + 1, 1));
  }, [lastActive]);

  const updateOffense = (index: number, patch: Partial<Navmc10132Offense>) => {
    setFormData((prev) => {
      const rows = fiveOffenses(prev);
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, offenses: rows };
    });
  };

  return (
    <SectionCard icon={<Gavel className="mr-2 h-5 w-5" />} title="Offenses and findings (items 1 and 5)">
      <div className="space-y-4">
        {ROW_LETTERS.slice(0, visible).map((letter, index) => (
          <OffenseRow
            key={letter}
            letter={letter}
            offense={offenses[index]}
            onChange={(patch) => updateOffense(index, patch)}
          />
        ))}

        {visible < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisible((v) => Math.min(5, v + 1))}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add offense
          </Button>
        )}

        <p className="text-[11px] text-muted-foreground">
          The form has room for five offenses. Offense F and beyond, and their findings,
          do not go on this page. Record them in item 21 using the additional offenses
          format, lettered F, G, and so on, in chronological order, per the form's item 1
          instruction.
        </p>
      </div>
    </SectionCard>
  );
}

function OffenseRow({
  letter,
  offense,
  onChange,
}: {
  letter: (typeof ROW_LETTERS)[number];
  offense: Navmc10132Offense;
  onChange: (patch: Partial<Navmc10132Offense>) => void;
}) {
  const summaryField = `1${letter} SUMMARY`;
  const selectedArticle = offense.articleLabel ? resolveArticle(offense.articleLabel) : undefined;

  const usable = usableWidthOf(summaryField);
  const used = measureText(offense.summary, 8);
  const pct = usable > 0 ? Math.round((used / usable) * 100) : 0;
  const fits = fitsInField(summaryField, offense.summary);
  const over = overflowBy(summaryField, offense.summary);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
          {letter}
        </div>

        <div className="min-w-[220px] space-y-1">
          <Label className="text-[11px] text-muted-foreground">Article, item 1{letter}</Label>
          <ArticlePicker
            value={offense.articleLabel}
            onSelect={(entry) => onChange({ articleLabel: entry.formLabel, mctfsCode: entry.mctfsCode })}
          />
        </div>

        <div className="flex-1 min-w-[260px] space-y-1">
          <Label className="text-[11px] text-muted-foreground">Summary, item 1{letter}</Label>
          <Input
            value={offense.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            placeholder="Article, specific offense, date, and place"
          />
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${fits ? 'bg-primary' : 'bg-destructive'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground w-10 text-right">{pct}%</span>
          </div>
          {!fits && (
            <p className="text-[11px] text-destructive">
              This summary is {over} points too wide for item 1{letter} and will clip
              silently on the printed form. Trim it, or enter See Supplemental Page here
              and put the full text in item 21.
            </p>
          )}
        </div>

        <div className="w-40 space-y-1">
          <Label className="text-[11px] text-muted-foreground">Finding, item 5{letter}</Label>
          <Select
            value={offense.finding || undefined}
            onValueChange={(value) => onChange({ finding: value as Navmc10132Offense['finding'] })}
            disabled={!offense.articleLabel}
          >
            <SelectTrigger>
              <SelectValue placeholder="Blank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Guilty">Guilty (G)</SelectItem>
              <SelectItem value="Not Guilty">Not Guilty (NG)</SelectItem>
            </SelectContent>
          </Select>
          {!offense.articleLabel && (
            <p className="text-[11px] text-muted-foreground">
              Blank until item 1{letter} has an article, per the item 5 instruction.
            </p>
          )}
        </div>
      </div>

      {selectedArticle?.notOrdinarilyMinor && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <Badge variant="outline" className="border-amber-500 text-amber-700 shrink-0">
            <ShieldAlert className="mr-1 h-3 w-3" />
            Warning
          </Badge>
          <p className="text-[11px] text-amber-800">
            This article is ordinarily not a minor offense, so nonjudicial punishment is
            questionable here. A minor offense ordinarily carries no dishonorable
            discharge and no confinement over one year if tried by general
            court-martial, MCM Part V para 1.e. The commander decides whether NJP is
            appropriate for this offense.
          </p>
        </div>
      )}
    </div>
  );
}

function ArticlePicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (entry: Navmc10132ArticleEntry) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? NAVMC_10132_ARTICLES.filter((entry) => entry.formLabel.toLowerCase().includes(q))
    : NAVMC_10132_ARTICLES;

  const groups = NAVMC_10132_ARTICLE_GROUPS.map((articleNumber) => ({
    articleNumber,
    entries: filtered.filter((entry) => entry.articleNumber === articleNumber),
  })).filter((group) => group.entries.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{value || 'Select article'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select UCMJ article</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by offense, for example desertion"
          />
          <div className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
            {groups.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No offenses match that filter.</p>
            )}
            {groups.map((group) => (
              <div key={group.articleNumber}>
                <p className="sticky top-0 bg-background text-[11px] font-semibold text-muted-foreground">
                  {group.articleNumber}
                </p>
                <div className="space-y-0.5">
                  {group.entries.map((entry) => (
                    <button
                      key={entry.formLabel}
                      type="button"
                      className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        onSelect(entry);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      {entry.formLabel}
                      {entry.notOrdinarilyMinor && (
                        <span className="ml-2 text-[10px] text-amber-700">not ordinarily minor</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
