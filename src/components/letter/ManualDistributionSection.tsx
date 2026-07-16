/**
 * Manual Distribution Section Component
 * Manages the list of distribution addressees with dynamic add/remove functionality
 * Behaves identically to CopyToSection but for "Distribution"
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Plus, Trash2 } from 'lucide-react';

interface ManualDistributionSectionProps {
  distList: string[];
  setDistList: (list: string[]) => void;
}

export function ManualDistributionSection({ distList, setDistList }: ManualDistributionSectionProps) {
  const [showDist, setShowDist] = useState(false);

  useEffect(() => {
    setShowDist(distList.some(c => c.trim() !== ''));
  }, [distList]);

  const addItem = useCallback(() => setDistList([...distList, '']), [distList, setDistList]);
  const removeItem = useCallback((index: number) => setDistList(distList.filter((_, i) => i !== index)), [distList, setDistList]);
  const updateItem = useCallback((index: number, value: string) => setDistList(distList.map((item, i) => i === index ? value : item)), [distList, setDistList]);

  const handleRadioChange = (value: string) => {
    if (value === 'yes') {
      setShowDist(true);
      if (distList.length === 0) setDistList(['']);
    } else {
      setShowDist(false);
      setDistList(['']);
    }
  };

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold">
          <Users className="mr-2 h-5 w-5 text-primary-foreground" />
          Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-6">
          <RadioGroup 
            defaultValue={showDist ? 'yes' : 'no'} 
            value={showDist ? 'yes' : 'no'}
            onValueChange={handleRadioChange}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="dist-yes" />
              <Label htmlFor="dist-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="dist-no" />
              <Label htmlFor="dist-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {showDist && (
          <div className="space-y-3 pt-2">
            <Label className="block font-semibold mb-2">
              Enter Addressee(s):
            </Label>
            {distList.map((dist, index) => (
              <div key={`dist-${index}`} className="flex w-full gap-2 items-center">
                 <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                  ({index + 1})
                </span>
                <Input
                  className="flex-1 border-input focus-visible:ring-primary"
                  type="text"
                  placeholder="Enter distribution information"
                  value={dist}
                  onChange={(e) => updateItem(index, e.target.value)}
                />
                {index === distList.length - 1 ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                    onClick={addItem}
                    title="Add Distribution"
                    aria-label="Add Distribution"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => removeItem(index)}
                    title="Remove Distribution"
                    aria-label="Remove Distribution"
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
