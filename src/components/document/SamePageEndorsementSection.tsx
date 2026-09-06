'use client';

/**
 * E.5: the second half of a same-page endorsement written from scratch
 * (SECNAV M-5216.5 9-1, 9-2, Figure 9-1). The main sections above are
 * the letter, signed by signer 1. This card is the endorsement: its
 * From and To derived from the letter (9-2.2) and editable, the
 * remaining Vias, its Ser line and date, its body, signer 2, its Copy
 * to, and any references or enclosures it adds, lettered and numbered
 * after the letter's (9-2.3, 9-2.4).
 */
import { useEffect } from 'react';
import type { FormData, ParagraphData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileSignature, RotateCcw } from 'lucide-react';
import { ParagraphSection } from '@/components/letter/ParagraphSection';
import { useParagraphs, getUiCitation, validateParagraphNumbering } from '@/hooks/useParagraphs';
import {
  samePagePart, deriveEndorsementAddressing, derivedBasicLetterReference,
  nextReferenceLetter, nextEnclosureNumber, type SamePageEndorsementPart,
} from '@/lib/same-page-composite';
import { endorsementLineText } from '@/lib/same-page-endorsement';
import { describePlacement, type SamePageStatus } from '@/lib/same-page-host';

interface SamePageEndorsementSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  /** The letter's lists, for the derivation and the numbering. */
  vias: string[];
  references: string[];
  enclosures: string[];
  /** Where the endorsement landed on the last preview render. */
  samePageStatus?: SamePageStatus | null;
}

function ListEditor({ id, label, hint, items, onChange, placeholder }: {
  id: string; label: string; hint?: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const rows = items.length > 0 ? items : [''];
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {rows.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            id={`${id}-${i}`}
            aria-label={`${label} ${i + 1}`}
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? e.target.value : r)))}
          />
          <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${label} ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, ''])}>Add</Button>
    </div>
  );
}

export function SamePageEndorsementSection({ formData, setFormData, vias, references, enclosures, samePageStatus }: SamePageEndorsementSectionProps) {
  const part = samePagePart(formData);
  const update = (patch: Partial<SamePageEndorsementPart>) =>
    setFormData((prev) => ({ ...prev, samePageEndorsement: { ...samePagePart(prev), ...patch } }));

  const letter = { from: String(formData.from ?? ''), to: String(formData.to ?? ''), vias };
  const derived = deriveEndorsementAddressing(letter);
  const derivedKey = `${derived.from}|${derived.to}|${derived.vias.join('|')}`;

  // 9-2.2: the addressing follows the letter until the drafter edits it.
  useEffect(() => {
    if (part.addressingEdited) return;
    if (part.from === derived.from && part.to === derived.to && part.vias.join('|') === derived.vias.join('|')) return;
    update({ from: derived.from, to: derived.to, vias: derived.vias });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedKey, part.addressingEdited]);

  // The body is a paragraph editor of its own. It owns its state and
  // mirrors into the part; the parent remounts it on a document load.
  const body = useParagraphs(part.paragraphs);
  const bodyKey = JSON.stringify(body.paragraphs);
  useEffect(() => {
    const current = JSON.stringify(samePagePart(formData).paragraphs);
    if (current !== bodyKey) update({ paragraphs: body.paragraphs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey]);

  const endorsementLine = endorsementLineText({
    ...formData, endorsementPlacement: 'same-page',
    basicLetterReference: part.basicLetterReference || derivedBasicLetterReference(formData),
  } as FormData);

  return (
    <Card className="border-primary/20 shadow-md overflow-hidden mb-6" data-testid="same-page-endorsement-section">
      <CardHeader className="bg-secondary text-secondary-foreground border-b border-secondary/10 p-4 flex flex-row items-center gap-2">
        <FileSignature className="w-5 h-5" />
        <CardTitle as="h3" className="text-lg font-bold font-headline tracking-wide">Endorsement (second half)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <p className="text-xs text-muted-foreground italic">
          Figure 9-1: the sections above are the letter, signed by its writer. This half is the endorsement,
          added below the letter&apos;s signature and signed by the endorser. Its From and To follow the letter
          (9-2.2): the first Via endorses to the letter&apos;s addressee; with no Via, the addressee endorses
          back to the writer.
        </p>

        {samePageStatus && samePageStatus.status !== 'no-host' && (
          <p
            className={samePageStatus.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
            role={samePageStatus.status === 'error' ? 'alert' : undefined}
            data-testid="same-page-composite-status"
          >
            {describePlacement(samePageStatus)}
          </p>
        )}

        <div className="text-sm">
          <span className="text-muted-foreground">Preview: </span>
          <span className="font-mono" data-testid="same-page-endorsement-line">{endorsementLine || '(set the endorsement level above)'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="same-page-from">From (endorser)</Label>
            <Input id="same-page-from" value={part.from}
              onChange={(e) => update({ from: e.target.value, addressingEdited: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="same-page-to">To</Label>
            <Input id="same-page-to" value={part.to}
              onChange={(e) => update({ to: e.target.value, addressingEdited: true })} />
          </div>
        </div>
        {part.addressingEdited && (
          <Button type="button" variant="ghost" size="sm" onClick={() => update({ from: derived.from, to: derived.to, vias: derived.vias, addressingEdited: false })}>
            <RotateCcw className="w-4 h-4 mr-1" /> Derive from the letter again
          </Button>
        )}

        <ListEditor id="same-page-via" label="Via (remaining)" hint="9-2.2: the Via addressees still to come, numbered when two or more."
          items={part.vias} onChange={(items) => update({ vias: items, addressingEdited: true })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="same-page-ser">Ser line (endorser&apos;s)</Label>
            <Input id="same-page-ser" value={part.originatorCode} placeholder="Ser 019/870"
              onChange={(e) => update({ originatorCode: e.target.value })} />
            <p className="text-xs text-muted-foreground">9-2.1.a: with the SSIC and subject omitted, the identification is the Ser line and the date alone.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="same-page-date">Date</Label>
            <Input id="same-page-date" value={part.date} placeholder="23 Apr 15"
              onChange={(e) => update({ date: e.target.value })} />
          </div>
        </div>

        <ParagraphSection
          paragraphs={body.paragraphs}
          documentType="endorsement"
          activeVoiceInput={null}
          validateParagraphNumbering={validateParagraphNumbering}
          getUiCitation={getUiCitation}
          moveParagraphUp={body.moveParagraphUp}
          moveParagraphDown={body.moveParagraphDown}
          updateParagraphContent={body.updateParagraphContent}
          toggleVoiceInput={() => {}}
          addParagraph={body.addParagraph}
          removeParagraph={body.removeParagraph}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="same-page-sig">Signature name (endorser, signer 2)</Label>
            <Input id="same-page-sig" value={part.sig} placeholder="R. L. GABEL"
              onChange={(e) => update({ sig: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="same-page-delegation">Delegation line (optional)</Label>
            <Input id="same-page-delegation" value={part.delegationText} placeholder="By direction"
              onChange={(e) => update({ delegationText: e.target.value })} />
          </div>
        </div>

        <ListEditor id="same-page-copy" label="Copy to" hint="9-2.5: a significant endorsement copies every earlier endorser and the originator, and every Copy to before it."
          items={part.copyTos} onChange={(items) => update({ copyTos: items })} />

        <ListEditor id="same-page-ref" label={`References added (from (${nextReferenceLetter(references, String(formData.startingReferenceLevel ?? 'a'))}))`}
          hint="9-2.3: only references the endorsement adds, lettered after the letter's."
          items={part.references} onChange={(items) => update({ references: items })} />

        <ListEditor id="same-page-encl" label={`Enclosures added (from (${nextEnclosureNumber(enclosures, String(formData.startingEnclosureNumber ?? '1'))}))`}
          hint="9-2.4: only enclosures the endorsement adds, numbered after the letter's."
          items={part.enclosures} onChange={(items) => update({ enclosures: items })} />

        <div className="space-y-2">
          <Label htmlFor="same-page-basic-ref">The letter in reference style (used if the endorsement moves to a new page)</Label>
          <Textarea id="same-page-basic-ref" rows={2} value={part.basicLetterReference ?? ''}
            placeholder={derivedBasicLetterReference(formData)}
            onChange={(e) => update({ basicLetterReference: e.target.value || undefined })} />
          <p className="text-xs text-muted-foreground">9-2.1.b: "ENDORSEMENT on" the letter in reference style. Derived from the letter above when left blank.</p>
        </div>
      </CardContent>
    </Card>
  );
}
