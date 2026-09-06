import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Share2 } from 'lucide-react';
import { DistributionData } from '@/types';

interface SimpleDistributionSectionProps {
  distribution: DistributionData;
  onUpdateDistribution: (distribution: DistributionData) => void;
}

export function SimpleDistributionSection({
  distribution,
  onUpdateDistribution
}: SimpleDistributionSectionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const recipients = text.split('\n').filter(line => line.trim() !== '');
    onUpdateDistribution({
      ...distribution,
      type: 'standard',
      recipients: recipients
    });
  };

  const recipientsText = distribution?.recipients?.join('\n') || '';

  return (
    <Card className="border-border shadow-sm border-l-4 border-l-primary mb-6">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle as="h3" className="text-lg flex items-center font-headline tracking-wide">
          <Share2 className="mr-2 h-5 w-5 text-primary-foreground" />
          Distribution List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="distribution-list">Enter recipients (one per line)</Label>
          <Textarea
            id="distribution-list"
            placeholder="CO, 1st Bn, 1st Mar&#10;CO, 2d Bn, 1st Mar&#10;..."
            value={recipientsText}
            onChange={handleChange}
            rows={10}
            className="font-mono"
          />
        </div>
      </CardContent>
    </Card>
  );
}
