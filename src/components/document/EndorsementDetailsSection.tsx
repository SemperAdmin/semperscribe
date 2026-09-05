'use client';

import { FormData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { FileSignature } from 'lucide-react';
import { StructuredReferenceInput } from '@/components/letter/StructuredReferenceInput';
import { endorsementLineText, omitsIdentification } from '@/lib/same-page-endorsement';

interface EndorsementDetailsSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function EndorsementDetailsSection({ formData, setFormData }: EndorsementDetailsSectionProps) {
  // E.1 (M-5216.5 9-1). Undefined placement reads as a new-page
  // endorsement, so a document saved before this control existed keeps
  // the placement it was written with.
  const placement = formData.endorsementPlacement === 'same-page' ? 'same-page' : 'new-page';
  const samePage = placement === 'same-page';
  const omits = omitsIdentification(formData);

  return (
    <Card className="border-primary/20 shadow-md overflow-hidden mb-6">
      <CardHeader className="bg-secondary text-secondary-foreground border-b border-secondary/10 p-4 flex flex-row items-center gap-2">
        <FileSignature className="w-5 h-5" />
        <CardTitle as="h3" className="text-lg font-bold font-headline tracking-wide">Endorsement Details</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Endorsement Level Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Endorsement Level <span className="text-destructive">*</span></Label>
          <Select
            value={formData.endorsementLevel}
            onValueChange={(val) => setFormData(prev => ({ ...prev, endorsementLevel: val as any }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select endorsement level..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIRST">FIRST ENDORSEMENT</SelectItem>
              <SelectItem value="SECOND">SECOND ENDORSEMENT</SelectItem>
              <SelectItem value="THIRD">THIRD ENDORSEMENT</SelectItem>
              <SelectItem value="FOURTH">FOURTH ENDORSEMENT</SelectItem>
              <SelectItem value="FIFTH">FIFTH ENDORSEMENT</SelectItem>
              <SelectItem value="SIXTH">SIXTH ENDORSEMENT</SelectItem>
              <SelectItem value="SEVENTH">SEVENTH ENDORSEMENT</SelectItem>
              <SelectItem value="EIGHTH">EIGHTH ENDORSEMENT</SelectItem>
              <SelectItem value="NINTH">NINTH ENDORSEMENT</SelectItem>
              <SelectItem value="TENTH">TENTH ENDORSEMENT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Placement (M-5216.5 9-1) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Placement</Label>
          <RadioGroup
            value={placement}
            onValueChange={(val) => setFormData(prev => ({
              ...prev,
              endorsementPlacement: val as 'new-page' | 'same-page',
              // 9-2.1.a is the manual's own default for a same-page
              // endorsement, so choosing same-page turns the omission
              // on unless the drafter has already turned it off.
              samePageOmitsIdentification: val === 'same-page'
                ? prev.samePageOmitsIdentification !== false
                : prev.samePageOmitsIdentification,
            }))}
            className="gap-3"
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="new-page" id="placement-new-page" className="mt-0.5" />
              <Label htmlFor="placement-new-page" className="text-sm font-normal leading-snug">
                New page
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="same-page" id="placement-same-page" className="mt-0.5" />
              <Label htmlFor="placement-same-page" className="text-sm font-normal leading-snug">
                Same page (added to the signature page of the document it endorses, when it fits)
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground italic">
            Paragraph 9-1: if the endorsement fits on the signature page of the basic letter or the
            preceding endorsement, it goes on that page. If not, it goes on a new page. The fit is
            measured when the package is assembled.
          </p>
        </div>

        {samePage && (
          <div className="flex items-start gap-2 p-3 bg-secondary/5 rounded-lg border border-secondary/10">
            <Checkbox
              id="same-page-omit-identification"
              className="mt-0.5"
              checked={omits}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                samePageOmitsIdentification: checked === true,
              }))}
            />
            <div className="space-y-1">
              <Label htmlFor="same-page-omit-identification" className="text-sm font-normal leading-snug">
                Omit SSIC, subject and the basic letter&apos;s identification (the whole page is photocopied)
              </Label>
              <p className="text-xs text-muted-foreground italic">
                Paragraph 9-2.1.a: when preparing a same-page endorsement, as long as the entire page
                will be photocopied, omit the SSIC, the subject and the basic letter&apos;s
                identification symbols. Figure 9-1 shows the line as the ordinal and the word alone.
              </p>
            </div>
          </div>
        )}

        {/* Basic Letter Reference Builder */}
        {formData.endorsementLevel && (
          <div className="space-y-4">
            <StructuredReferenceInput formData={formData} setFormData={setFormData} />

            <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-lg text-sm font-mono text-muted-foreground flex items-center gap-2">
              <span className="font-bold text-primary">Preview:</span>
              {omits
                ? endorsementLineText(formData)
                : `${formData.endorsementLevel} ENDORSEMENT on ${formData.basicLetterReference || '[Basic Letter Reference]'}`}
            </div>
          </div>
        )}

        {/* Page Numbering and Sequencing */}
        {formData.endorsementLevel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
            {/* Page Numbering Section. A same-page endorsement adds no
                page, so it has nothing to number: it lands on a page the
                document below it already numbered (9-1). */}
            {samePage ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="bg-secondary/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  Page Numbering
                </h4>
                <p className="text-sm text-muted-foreground">
                  A same-page endorsement adds no page, so it carries no page number of its own. It
                  keeps the number of the signature page it is added to.
                </p>
              </div>
            ) : (
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <span className="bg-secondary/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Page Numbering
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Last Page # of Previous Document</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.previousPackagePageCount}
                  onChange={(e) => {
                    const newPrevCount = parseInt(e.target.value) || 0;
                    setFormData(prev => ({
                      ...prev,
                      previousPackagePageCount: newPrevCount,
                      startingPageNumber: newPrevCount + 1
                    }))
                  }}
                />
                <p className="text-xs text-muted-foreground italic">
                  Enter the last page number of the document you are endorsing.
                </p>
              </div>

              <div className="p-3 bg-secondary/5 rounded-lg border border-secondary/10">
                <p className="text-sm text-foreground font-medium">
                  Endorsement starts on page <span className="font-bold text-lg text-primary">{formData.startingPageNumber}</span>
                </p>
              </div>
            </div>
            )}

            {/* Identifier Sequencing Section. 9-2.3 and 9-2.4 apply to
                both placements: added references and enclosures continue
                the sequences either way. */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <span className="bg-secondary/20 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Identifier Sequencing
              </h4>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start References At Letter</Label>
                <Select
                  value={formData.startingReferenceLevel}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, startingReferenceLevel: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)).map(char => (
                      <SelectItem key={char} value={char}>{char}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground italic">
                  If basic letter has refs (a) and (b), start here at (c).
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Enclosures At Number</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.startingEnclosureNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, startingEnclosureNumber: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground italic">
                  If basic letter has encl (1), start here at (2).
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
