import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Plus, 
  Trash2, 
  Share2, 
} from 'lucide-react';
import { DistributionData } from '@/types';

interface DistributionSectionProps {
  distribution: DistributionData;
  onUpdateDistribution: (distribution: DistributionData) => void;
}

export function DistributionSection({
  distribution,
  onUpdateDistribution
}: DistributionSectionProps) {
  const [showDistribution, setShowDistribution] = useState(distribution?.type !== 'none' && distribution?.type !== undefined);

  useEffect(() => {
    // Initialize if undefined
    if (!distribution) {
      onUpdateDistribution({ type: 'none' });
    }
  }, []);

  const handleToggleDistribution = (enabled: boolean) => {
    setShowDistribution(enabled);
    if (!enabled) {
      onUpdateDistribution({ ...distribution, type: 'none' });
    } else {
      onUpdateDistribution({ 
        ...distribution, 
        type: 'pcn',
        pcn: distribution.pcn || '',
        copyTo: distribution.copyTo || []
      });
    }
  };

  const updateField = (field: keyof DistributionData, value: any) => {
    onUpdateDistribution({ ...distribution, [field]: value });
  };

  const addCopyTo = () => {
    const currentList = distribution.copyTo || [];
    onUpdateDistribution({
      ...distribution,
      copyTo: [...currentList, { code: '', qty: 1 }]
    });
  };

  const removeCopyTo = (index: number) => {
    const currentList = distribution.copyTo || [];
    const newList = [...currentList];
    newList.splice(index, 1);
    onUpdateDistribution({
      ...distribution,
      copyTo: newList
    });
  };

  const updateCopyTo = (index: number, field: 'code' | 'qty', value: any) => {
    const currentList = distribution.copyTo || [];
    const newList = [...currentList];
    newList[index] = { ...newList[index], [field]: value };
    onUpdateDistribution({
      ...distribution,
      copyTo: newList
    });
  };

  return (
    <Card className="border-border shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="text-lg flex items-center font-headline tracking-wide">
          <Share2 className="mr-2 h-5 w-5 text-primary-foreground" />
          Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup
            value={showDistribution ? "yes" : "no"}
            onValueChange={(val) => handleToggleDistribution(val === "yes")}
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

        {showDistribution && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="pcn">PCN (Publication Control Number)</Label>
              <Input 
                type="text" 
                id="pcn" 
                placeholder="e.g. 10203000000" 
                value={distribution?.pcn || ''}
                onChange={(e) => updateField('pcn', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Distribution List Codes (Copy To)</Label>
              {(distribution?.copyTo || []).map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input 
                    placeholder="Dist Code (e.g. 7000166)" 
                    value={item.code}
                    onChange={(e) => updateCopyTo(index, 'code', e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    type="number" 
                    placeholder="Qty" 
                    value={item.qty}
                    onChange={(e) => updateCopyTo(index, 'qty', parseInt(e.target.value) || 1)}
                    className="w-20"
                    min={1}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    aria-label="Remove copy-to recipient"
                    onClick={() => removeCopyTo(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addCopyTo}
                className="mt-2 text-primary border-primary/20 hover:bg-primary/5"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Code
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
