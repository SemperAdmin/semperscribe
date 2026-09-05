'use client';

import { FormData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSignature } from 'lucide-react';
import { StructuredReferenceInput } from '@/components/letter/StructuredReferenceInput';

interface EndorsementDetailsSectionProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

export function EndorsementDetailsSection({ formData, setFormData }: EndorsementDetailsSectionProps) {
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

        {/* Basic Letter Reference Builder */}
        {formData.endorsementLevel && (
          <div className="space-y-4">
            <StructuredReferenceInput formData={formData} setFormData={setFormData} />

            <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-lg text-sm font-mono text-muted-foreground flex items-center gap-2">
              <span className="font-bold text-primary">Preview:</span>
              {formData.endorsementLevel} ENDORSEMENT on {formData.basicLetterReference || "[Basic Letter Reference]"}
            </div>
          </div>
        )}

        {/* Page Numbering and Sequencing */}
        {formData.endorsementLevel && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
            {/* Page Numbering Section */}
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

            {/* Identifier Sequencing Section */}
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
