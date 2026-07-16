import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface MultipleToSectionProps {
  recipients: string[];
  setRecipients: (recipients: string[]) => void;
  toDistribution?: boolean;
  setToDistribution?: (value: boolean) => void;
}

export function MultipleToSection({ recipients, setRecipients, toDistribution, setToDistribution }: MultipleToSectionProps) {
  // Ensure we always have at least one input if empty
  useEffect(() => {
    if (recipients.length === 0) {
      setRecipients(['']);
    }
  }, [recipients.length, setRecipients]);

  const addItem = useCallback(() => setRecipients([...recipients, '']), [recipients, setRecipients]);
  const removeItem = useCallback((index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index);
    // If removing the last one, ensure we still have an empty string
    setRecipients(newRecipients.length > 0 ? newRecipients : ['']);
  }, [recipients, setRecipients]);

  const updateItem = useCallback((index: number, value: string) => {
    setRecipients(recipients.map((item, i) => i === index ? value : item));
  }, [recipients, setRecipients]);

  return (
    <Card className="shadow-sm border-border border-l-4 border-l-primary mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="flex items-center text-lg font-semibold font-headline tracking-wide">
          <Users className="mr-2 h-5 w-5 text-primary-foreground" />
          To (Multiple Addressees)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {setToDistribution && (
          <div className="flex items-center gap-3">
            <Switch
              id="to-distribution"
              checked={!!toDistribution}
              onCheckedChange={setToDistribution}
            />
            <Label htmlFor="to-distribution" className="cursor-pointer font-medium">
              To Distribution
            </Label>
            <span className="text-xs text-muted-foreground">
              {toDistribution
                ? 'To: line will show "Distribution" and addressees listed under Distribution section'
                : 'Addressees listed directly under the To: line'}
            </span>
          </div>
        )}
        <div className="space-y-3">
          <Label className="block font-semibold mb-2">
            Enter Addressees:
          </Label>
          {recipients.map((recipient, index) => (
            <div key={`recipient-${index}`} className="flex w-full gap-2 items-center">
              <span className="flex h-10 w-12 items-center justify-center flex-shrink-0 rounded-md bg-secondary text-secondary-foreground border border-secondary font-medium shadow-sm">
                ({index + 1})
              </span>
              <Input
                className="flex-1 border-input focus-visible:ring-primary"
                type="text"
                placeholder="Enter addressee (e.g., Commanding General, 1st Marine Division)"
                value={recipient}
                onChange={(e) => updateItem(index, e.target.value)}
              />
              {index === recipients.length - 1 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                  onClick={addItem}
                  title="Add Recipient"
                    aria-label="Add Recipient"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => removeItem(index)}
                  title="Remove Recipient"
                    aria-label="Remove Recipient"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
