/**
 * Copy To Section Component
 * Manages the list of copy-to addressees with dynamic add/remove functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Copy, Plus, Trash2 } from 'lucide-react';

interface CopyToSectionProps {
  copyTos: string[];
  setCopyTos: (copies: string[]) => void;
}

export function CopyToSection({ copyTos, setCopyTos }: CopyToSectionProps) {
  const [showCopy, setShowCopy] = useState(false);

  useEffect(() => {
    setShowCopy(copyTos.some(c => c.trim() !== ''));
  }, [copyTos]);

  const addItem = useCallback(() => setCopyTos([...copyTos, '']), [copyTos, setCopyTos]);
  const removeItem = useCallback((index: number) => setCopyTos(copyTos.filter((_, i) => i !== index)), [copyTos, setCopyTos]);
  const updateItem = useCallback((index: number, value: string) => setCopyTos(copyTos.map((item, i) => i === index ? value : item)), [copyTos, setCopyTos]);

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowCopy(true);
      if (copyTos.length === 0) setCopyTos(['']);
    } else {
      setShowCopy(false);
      setCopyTos(['']);
    }
  };

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold">
          <Copy className="mr-2 h-5 w-5 text-primary-foreground" />
          Copy To
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-6">
          <RadioGroup 
            defaultValue={showCopy ? 'yes' : 'no'} 
            value={showCopy ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="copy-yes" />
              <Label htmlFor="copy-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="copy-no" />
              <Label htmlFor="copy-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {showCopy && (
          <div className="space-y-3 pt-2">
            <Label className="block font-semibold mb-2">
              Enter Addressee(s):
            </Label>
            {copyTos.map((copy, index) => (
              <div key={`copy-${index}`} className="flex w-full gap-2 items-center">
                 <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                  ({index + 1})
                </span>
                <Input
                  className="flex-1 border-input focus-visible:ring-primary"
                  type="text"
                  placeholder="Enter copy to information"
                  value={copy}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
                {index === copyTos.length - 1 ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    onClick={addItem}
                    title="Add Copy To"
                    aria-label="Add Copy To"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => removeItem(index)}
                    title="Remove Copy To"
                    aria-label="Remove Copy To"
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
