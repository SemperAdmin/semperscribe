import React from 'react';
import { AMHSReference } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wand2 } from 'lucide-react';

interface ReferenceManagerProps {
  references: AMHSReference[];
  onChange: (refs: AMHSReference[]) => void;
  narrative?: string;
  onNarrativeChange?: (narrative: string) => void;
}

export function ReferenceManager({ references, onChange, narrative = '', onNarrativeChange }: ReferenceManagerProps) {

  const generateNarrative = () => {
    if (!onNarrativeChange) return;

    const narrativeParts = references
      .filter(ref => ref.title && ref.title.trim().length > 0)
      .map(ref => `REF ${ref.letter} IS THE ${ref.title.toUpperCase()}`);

    const generatedNarr = narrativeParts.length > 0
      ? narrativeParts.join('. ') + '.'
      : '';

    onNarrativeChange(generatedNarr);
  };

  const addReference = () => {
    const newLetter = String.fromCharCode(65 + references.length); // A, B, C...
    const newRef: AMHSReference = {
      id: crypto.randomUUID(),
      letter: newLetter,
      type: 'MSGID: DOC',
      docId: '',
      title: ''
    };
    onChange([...references, newRef]);
  };

  const removeReference = (index: number) => {
    const newRefs = references.filter((_, i) => i !== index);
    // Re-letter subsequent references
    const reLettered = newRefs.map((ref, i) => ({
      ...ref,
      letter: String.fromCharCode(65 + i)
    }));
    onChange(reLettered);
  };

  const updateReference = (index: number, field: keyof AMHSReference, value: string) => {
    const newRefs = [...references];
    newRefs[index] = { ...newRefs[index], [field]: value };
    onChange(newRefs);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-lg">References (REF/NARR)</CardTitle>
        <Button onClick={addReference} size="sm" variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Add Reference
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {references.length === 0 && (
          <div className="text-center text-muted-foreground py-4 text-sm">
            No references added. Click "Add Reference" to begin.
          </div>
        )}
        
        {references.map((ref, index) => (
          <div key={ref.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg bg-card/50">
            <div className="md:col-span-1 flex items-center justify-center font-mono text-lg font-bold bg-muted rounded">
              REF {ref.letter}
            </div>
            
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor={`type-${ref.id}`} className="text-xs">Type</Label>
              <Select 
                value={ref.type} 
                onValueChange={(val) => updateReference(index, 'type', val as any)}
              >
                <SelectTrigger id={`type-${ref.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSGID: DOC">MSGID: DOC</SelectItem>
                  <SelectItem value="MSGID: MSG">MSGID: MSG</SelectItem>
                  <SelectItem value="DOC">DOC</SelectItem>
                  <SelectItem value="MSG">MSG</SelectItem>
                  <SelectItem value="LTR">LTR</SelectItem>
                  <SelectItem value="MEMO">MEMO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor={`docId-${ref.id}`} className="text-xs">Document Identifier</Label>
              <Input
                id={`docId-${ref.id}`}
                placeholder="MCO 5354.1G"
                value={ref.docId}
                onChange={(e) => updateReference(index, 'docId', e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
            
            <div className="md:col-span-4 space-y-2">
              <Label htmlFor={`title-${ref.id}`} className="text-xs">Title (for NARR)</Label>
              <Input
                id={`title-${ref.id}`}
                placeholder="PROHIBITED ACTIVITIES POLICY"
                value={ref.title}
                onChange={(e) => updateReference(index, 'title', e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
            
            <div className="md:col-span-1 flex items-end justify-center pb-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove reference"
                onClick={() => removeReference(index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* NARR Section */}
        {onNarrativeChange && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Generated Narrative (NARR)</Label>
              <Button
                onClick={generateNarrative}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={references.length === 0}
              >
                <Wand2 className="h-4 w-4" /> Generate NARR
              </Button>
            </div>
            <Textarea
              value={narrative}
              onChange={(e) => onNarrativeChange(e.target.value.toUpperCase())}
              placeholder="Click 'Generate NARR' to auto-generate from reference titles, or type manually..."
              className="font-mono uppercase text-sm min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              NARR/ and // delimiters are added automatically in the preview.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
