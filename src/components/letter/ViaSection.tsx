/**
 * Via Section Component
 * Manages the list of via addressees with dynamic add/remove functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Route, Plus, Trash2 } from 'lucide-react';

interface ViaSectionProps {
  vias: string[];
  setVias: (vias: string[]) => void;
}

export function ViaSection({ vias, setVias }: ViaSectionProps) {
  const [showVia, setShowVia] = useState(false);

  useEffect(() => {
    setShowVia(vias.some(v => v.trim() !== ''));
  }, [vias]);

  const addItem = useCallback(() => setVias([...vias, '']), [vias, setVias]);
  const removeItem = useCallback((index: number) => setVias(vias.filter((_, i) => i !== index)), [vias, setVias]);
  const updateItem = useCallback((index: number, value: string) => setVias(vias.map((item, i) => i === index ? value : item)), [vias, setVias]);

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowVia(true);
      if (vias.length === 0) setVias(['']);
    } else {
      setShowVia(false);
      setVias(['']);
    }
  };

  return (
    <Card className="shadow-sm border-border border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <Route className="mr-2 h-5 w-5 text-primary-foreground" />
          Via
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup 
            defaultValue={showVia ? 'yes' : 'no'} 
            value={showVia ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="via-yes" />
              <Label htmlFor="via-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="via-no" />
              <Label htmlFor="via-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {showVia && (
          <div className="space-y-3 pt-2">
            <Label className="block font-semibold mb-2">
              Enter Via Addressee(s):
            </Label>
            {vias.map((via, index) => (
              <div key={`via-${index}`} className="flex w-full gap-2 items-center">
                <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                  ({index + 1})
                </span>
                <Input
                  className="flex-1 border-input focus-visible:ring-primary"
                  type="text"
                  placeholder="Enter via information (e.g., Commanding Officer, 1st Marine Division)"
                  value={via}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
                {index === vias.length - 1 ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    onClick={addItem}
                    title="Add Via"
                    aria-label="Add Via"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => removeItem(index)}
                    title="Remove Via"
                    aria-label="Remove Via"
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
