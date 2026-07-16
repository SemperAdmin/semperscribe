/**
 * References Section Component
 * Manages the list of document references with dynamic add/remove functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Book, Plus, Trash2, AlertTriangle, Bookmark } from 'lucide-react';
import { FormData } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ReferenceSuggestInput } from './ReferenceSuggestInput';

interface ReferencesSectionProps {
  references: string[];
  setReferences: (refs: string[]) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
}

export function ReferencesSection({ references, setReferences, formData, setFormData }: ReferencesSectionProps) {
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    setShowRef(references.some(r => r.trim() !== ''));
  }, [references]);

  const addItem = useCallback(() => setReferences([...references, '']), [references, setReferences]);
  const removeItem = useCallback((index: number) => setReferences(references.filter((_, i) => i !== index)), [references, setReferences]);
  const updateItem = useCallback((index: number, value: string) => setReferences(references.map((item, i) => i === index ? value : item)), [references, setReferences]);

  const getReferenceLetter = (index: number, startingLevel: string): string => {
    const startCharCode = (startingLevel || 'a').charCodeAt(0);
    return String.fromCharCode(startCharCode + index);
  };

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowRef(true);
      if (references.length === 0) setReferences(['']);
    } else {
      setShowRef(false);
      setReferences(['']);
    }
  };

  const generateReferenceOptions = () => {
    return Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)).map(letter => ({
      value: letter,
      label: `Start with reference (${letter})`
    }));
  };

  return (
    <Card className="shadow-sm border-border mb-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <Book className="mr-2 h-5 w-5 text-primary-foreground" />
          References
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup 
            defaultValue={showRef ? 'yes' : 'no'} 
            value={showRef ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="ref-yes" />
              <Label htmlFor="ref-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="ref-no" />
              <Label htmlFor="ref-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {!showRef && (
          <p className="text-sm text-muted-foreground pt-1">
            Select &quot;Yes&quot; to cite source documents (e.g., NAVADMIN, OPNAVINST, prior correspondence).
          </p>
        )}

        {showRef && (
          <div className="space-y-4 pt-2">
            {formData.documentType === 'endorsement' && (
              <>
                <Alert variant="default" className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold ml-2">Endorsement Reference Rules</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 ml-2">
                    Only add NEW references not mentioned in the basic letter or previous endorsements. Continue the lettering sequence from the last reference.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Starting Reference:</Label>
                  <Select
                    value={formData.startingReferenceLevel}
                    onValueChange={(val) => setFormData({ ...formData, startingReferenceLevel: val })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select starting letter" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateReferenceOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <Label className="font-semibold mb-2 flex items-center">
              <Bookmark className="mr-2 h-4 w-4" />
              Enter Reference(s):
            </Label>
            
            {references.map((ref, index) => (
              <div key={`ref-${index}`} className="flex w-full gap-2 items-center">
                <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                  ({getReferenceLetter(index, formData.startingReferenceLevel)})
                </span>
                <ReferenceSuggestInput
                  className="flex-1 border-input focus-visible:ring-primary"
                  placeholder="Enter reference information (e.g., NAVADMIN 123/24, OPNAVINST 5000.1)"
                  value={ref}
                  onChange={(value) => updateItem(index, value)}
                  aria-label={`Reference (${getReferenceLetter(index, formData.startingReferenceLevel)})`}
                />
                {index === references.length - 1 ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    onClick={addItem}
                    title="Add Reference"
                    aria-label="Add Reference"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => removeItem(index)}
                    title="Remove Reference"
                    aria-label="Remove Reference"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
