
'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AutoSuggestInput } from '@/components/ui/AutoSuggestInput';
import { Textarea } from '@/components/ui/textarea';

export function BusinessLetterForm() {
  const { control } = useFormContext();

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg font-semibold">Business Letter Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          <FormField
            control={control}
            name="senderAddress"
            render={({ field }) => (
              <FormItem className="col-span-full">
                <FormLabel>Sender Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="123 Main St..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="date"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Date *</FormLabel>
                <FormControl>
                  <AutoSuggestInput
                        placeholder="DD MMM YY"
                        value={field.value}
                        onChange={field.onChange}
                      />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="recipientAddress"
            render={({ field }) => (
              <FormItem className="col-span-full">
                <FormLabel>Recipient Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="456 Oak Ave..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="salutation"
            render={({ field }) => (
              <FormItem className="col-span-full">
                <FormLabel>Salutation *</FormLabel>
                <FormControl>
                  <AutoSuggestInput placeholder="e.g., Dear Ms. Smith," {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name="complimentaryClose"
            render={({ field }) => (
              <FormItem className="md:col-span-1">
                <FormLabel>Closing *</FormLabel>
                <FormControl>
                  <AutoSuggestInput placeholder="e.g., Sincerely," {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="sig"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Signature Name *</FormLabel>
                <FormControl>
                  <AutoSuggestInput placeholder="John Doe" {...field} />
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
