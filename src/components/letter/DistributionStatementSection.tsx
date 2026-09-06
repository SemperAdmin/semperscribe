import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertCircle } from 'lucide-react';
import { DistributionData, DistributionStatementCode } from '@/types';
import { DISTRIBUTION_STATEMENTS, COMMON_RESTRICTION_REASONS } from '@/lib/constants';
import { parseAndFormatDate } from '@/lib/date-utils';

interface DistributionStatementSectionProps {
  distribution: DistributionData;
  onUpdateDistribution: (distribution: DistributionData) => void;
}

type StatementKey = keyof typeof DISTRIBUTION_STATEMENTS;

export function DistributionStatementSection({
  distribution,
  onUpdateDistribution
}: DistributionStatementSectionProps) {
  const statementCode = distribution?.statementCode || '';
  const statement = statementCode ? DISTRIBUTION_STATEMENTS[statementCode as StatementKey] : null;

  const updateField = (field: keyof DistributionData, value: any) => {
    onUpdateDistribution({ ...distribution, [field]: value });
  };

  const handleStatementChange = (code: string) => {
    // Handle "none" selection by setting empty string
    const newCode = code === 'none' ? '' : code;
    onUpdateDistribution({
      ...distribution,
      statementCode: newCode as DistributionStatementCode,
      // Clear fill-in fields when changing statement
      statementReason: '',
      statementDate: '',
      statementAuthority: ''
    });
  };

  const fillInFields = (statement as any)?.fillInFields as string[] | undefined;
  const needsReason = fillInFields?.includes('reason');
  const needsDate = fillInFields?.includes('dateOfDetermination');
  const needsAuthority = fillInFields?.includes('originatingCommand');

  // Build the formatted statement text with fill-ins
  const getFormattedStatement = () => {
    if (!statement) return '';

    let text = statement.text;

    if (needsReason && distribution.statementReason) {
      text = text.replace('(fill in reason)', distribution.statementReason);
    }
    if (needsDate && distribution.statementDate) {
      const formattedDate = parseAndFormatDate(distribution.statementDate);
      text = text.replace('(date of determination)', formattedDate);
    }
    if (needsAuthority && distribution.statementAuthority) {
      text = text.replace('(insert originating command)', distribution.statementAuthority);
      text = text.replace('(originating command)', distribution.statementAuthority);
    }

    return text;
  };

  // Check if all required fill-ins are complete
  const isComplete = () => {
    if (!statement) return true;
    if (!statement.requiresFillIns) return true;

    const fields = (statement as any).fillInFields as string[] || [];
    if (fields.includes('reason') && !distribution.statementReason) return false;
    if (fields.includes('dateOfDetermination') && !distribution.statementDate) return false;
    if (fields.includes('originatingCommand') && !distribution.statementAuthority) return false;
    return true;
  };

  return (
    <Card className="border-border shadow-sm border-l-4 border-l-amber-500">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg flex items-center font-headline tracking-wide">
          <Shield className="mr-2 h-5 w-5 text-primary-foreground" />
          Distribution Statement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Statement Code Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Statement Code
          </Label>
          <Select
            value={statementCode || 'none'}
            onValueChange={handleStatementChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Distribution Statement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(DISTRIBUTION_STATEMENTS).map(([code, stmt]) => (
                <SelectItem key={code} value={code}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{code}</span>
                    <span className="text-muted-foreground">-</span>
                    <span className="text-sm">{stmt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fill-in Fields for restricted statements */}
        {statement && statement.requiresFillIns && (
          <div className="space-y-4 p-4 bg-accent/10 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Required information for Statement {statementCode}</span>
            </div>

            {/* Restriction Reason */}
            {needsReason && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Restriction Reason
                </Label>
                <Input
                  type="text"
                  value={distribution.statementReason || ''}
                  onChange={(e) => updateField('statementReason', e.target.value)}
                  placeholder="e.g., administrative/operational use"
                  list="common-reasons"
                  className="h-9"
                />
                <datalist id="common-reasons">
                  {COMMON_RESTRICTION_REASONS.map(reason => (
                    <option key={reason} value={reason} />
                  ))}
                </datalist>
                <p className="text-[10px] text-muted-foreground">
                  Why is distribution restricted?
                </p>
              </div>
            )}

            {/* Date of Determination */}
            {needsDate && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Date of Determination
                </Label>
                <DatePicker
                  date={distribution.statementDate ? new Date(distribution.statementDate + 'T00:00:00') : undefined}
                  setDate={(d) => updateField('statementDate', d ? format(d, 'yyyy-MM-dd') : '')}
                  placeholder="Pick determination date"
                />
                {distribution.statementDate && (
                  <p className="text-[10px] text-muted-foreground">
                    Will display as: <span className="font-semibold">{parseAndFormatDate(distribution.statementDate)}</span>
                  </p>
                )}
                {!distribution.statementDate && (
                  <p className="text-[10px] text-muted-foreground">
                    Date the distribution determination was made
                  </p>
                )}
              </div>
            )}

            {/* Originating Command/Authority */}
            {needsAuthority && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Originating Command
                </Label>
                <Input
                  type="text"
                  value={distribution.statementAuthority || ''}
                  onChange={(e) => updateField('statementAuthority', e.target.value)}
                  placeholder="e.g., Commandant of the Marine Corps (CMC)"
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Command to direct requests for this document
                </p>
              </div>
            )}
          </div>
        )}

        {/* Preview of formatted statement */}
        {statement && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Statement Preview
            </Label>
            <div className={`p-3 rounded-md border text-sm font-mono ${
              isComplete()
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              {getFormattedStatement()}
            </div>
            {!isComplete() && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Please fill in all required fields above
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
