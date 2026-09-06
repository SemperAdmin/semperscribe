
'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useFieldArray } from 'react-hook-form';
import { AutoSuggestInput } from '../ui/AutoSuggestInput';

export function DecisionPaperForm() {
  const { control } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'discussionPoints',
  });

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg font-semibold">Decision Paper Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-6 grid-cols-1">
          <FormField
            control={control}
            name="problem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Problem *</FormLabel>
                <FormControl>
                  <Textarea placeholder="State the problem clearly and concisely." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Discussion Points</FormLabel>
            <div className="grid gap-4 mt-2">
              {fields.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <FormField
                    control={control}
                    name={`discussionPoints.${index}.point`}
                    render={({ field }) => (
                      <FormItem className="flex-grow">
                        <FormControl>
                          <AutoSuggestInput placeholder={`Point ${index + 1}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => append({ point: '' })}
            >
              Add Discussion Point
            </Button>
          </div>

          <FormField
            control={control}
            name="recommendation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recommendation *</FormLabel>
                <FormControl>
                  <AutoSuggestInput placeholder="State your recommended course of action." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
