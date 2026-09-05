'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { AutoSuggestInput } from '@/components/ui/AutoSuggestInput';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ExecutiveCorrespondenceForm() {
  const { control } = useFormContext();
  const execFormat = useWatch({ control, name: 'execFormat' });
  const isLetter = execFormat === 'letter';
  const isMemo = execFormat === 'standard-memo';
  const isActionMemo = execFormat === 'action-memo';
  const isInfoMemo = execFormat === 'info-memo';
  const isMemoFormat = isMemo || isActionMemo || isInfoMemo;

  return (
    <>
      {/* Memo-specific fields */}
      {isMemoFormat && (
        <Card className="mb-6 border-border shadow-sm">
          <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
            <CardTitle as="h3" className="text-lg font-semibold">
              {isActionMemo ? 'Action Memorandum' : isInfoMemo ? 'Information Memorandum' : 'Standard Memorandum'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              <FormField
                control={control}
                name="memoFor"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>{isInfoMemo ? 'FOR' : 'MEMORANDUM FOR'} *</FormLabel>
                    <FormControl>
                      <AutoSuggestInput
                        placeholder="SECRETARY OF DEFENSE"
                        value={field.value || ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {isMemo ? 'Single or multiple addressees' : 'Principal addressee'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(isActionMemo || isInfoMemo) && (
                <FormField
                  control={control}
                  name="memoFrom"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>FROM *</FormLabel>
                      <FormControl>
                        <AutoSuggestInput
                          placeholder="Paul S. Rogers, General Counsel of the Navy"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {isMemo && (
                <FormField
                  control={control}
                  name="subj"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>SUBJECT</FormLabel>
                      <FormControl>
                        <AutoSuggestInput
                          placeholder="Preparing a Memorandum for OSD"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(isActionMemo || isInfoMemo) && (
                <FormField
                  control={control}
                  name="subj"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>SUBJECT</FormLabel>
                      <FormControl>
                        <AutoSuggestInput
                          placeholder={isActionMemo ? 'Action Memo Subject' : 'Info Memo Subject'}
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={control}
                name="preparedBy"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Prepared By</FormLabel>
                    <FormControl>
                      <Input placeholder="Name, Organization" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="preparedByPhone"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(703) 555-1234" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Letter-specific fields */}
      {isLetter && (
        <Card className="mb-6 border-border shadow-sm">
          <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
            <CardTitle as="h3" className="text-lg font-semibold">Inside Address</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              <FormField
                control={control}
                name="recipientAddress"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Washington, DC 20515" {...field} value={field.value || ''} rows={2} />
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
                      <AutoSuggestInput
                        placeholder="Dear Mr. Chairman:"
                        value={field.value || ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>Must be formal per SECNAV M-5216.5, Ch 12</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="complimentaryClose"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Complimentary Close</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || 'Sincerely,'}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sincerely,">Sincerely, (Routine/Congressional)</SelectItem>
                          <SelectItem value="Respectfully,">Respectfully, (Junior Flag/GO)</SelectItem>
                          <SelectItem value="Very respectfully,">Very respectfully, (Senior Flag/GO)</SelectItem>
                          <SelectItem value="Warm regards,">Warm regards, (Thank you/Condolences)</SelectItem>
                          <SelectItem value="Sincerely yours,">Sincerely yours, (Senators/Congress)</SelectItem>
                          <SelectItem value="With great respect,">With great respect, (High-ranking civilians)</SelectItem>
                          <SelectItem value="All the best,">All the best, (General personal)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="courtesyCopyTo"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Courtesy Copy (Congressional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="The Honorable Jane Doe, Ranking Minority Member"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>Required when writing Committee/Subcommittee Chairpersons</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signature Block (shared) */}
      <Card className="mb-6 border-border shadow-sm">
        <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
          <CardTitle as="h3" className="text-lg font-semibold">Signature Block</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <FormField
              control={control}
              name="omitSignatureBlock"
              render={({ field }) => (
                <FormItem className="col-span-full flex items-center gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="mb-0">Omit Signature Block</FormLabel>
                    <FormDescription>For SecDef/DepSecDef/SECNAV/UNSECNAV signature</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="sig"
              render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel>Signer Name</FormLabel>
                  <FormControl>
                    <AutoSuggestInput
                      placeholder="CARLOS DEL TORO"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>Centered, 4th line below text</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="signerTitle"
              render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel>Official Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Secretary of the Navy" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
