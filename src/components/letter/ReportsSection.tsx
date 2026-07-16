import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Plus, 
  Trash2, 
  FileText, 
} from 'lucide-react';
import { ReportData } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';

interface ReportsSectionProps {
  reports: ReportData[];
  onUpdateReports: (reports: ReportData[]) => void;
}

export function ReportsSection({
  reports,
  onUpdateReports
}: ReportsSectionProps) {
  const [showReports, setShowReports] = useState(reports.length > 0);

  const handleToggleReports = (enabled: boolean) => {
    setShowReports(enabled);
    if (!enabled) {
      onUpdateReports([]);
    } else if (reports.length === 0) {
      // Add a default empty report to start
      onUpdateReports([{
        id: Date.now().toString(),
        title: '',
        controlSymbol: '',
        paragraphRef: '',
        exempt: false
      }]);
    }
  };

  const addReport = () => {
    onUpdateReports([
      ...reports,
      {
        id: Date.now().toString(),
        title: '',
        controlSymbol: '',
        paragraphRef: '',
        exempt: false
      }
    ]);
  };

  const removeReport = (index: number) => {
    const newReports = [...reports];
    newReports.splice(index, 1);
    onUpdateReports(newReports);
    if (newReports.length === 0) {
      setShowReports(false);
    }
  };

  const updateReport = (index: number, field: keyof ReportData, value: any) => {
    const newReports = [...reports];
    newReports[index] = { ...newReports[index], [field]: value };
    onUpdateReports(newReports);
  };

  return (
    <Card className="border-border shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
        <CardTitle className="text-lg flex items-center font-headline tracking-wide">
          <FileText className="mr-2 h-5 w-5 text-primary-foreground" />
          Reports Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6 pt-2">
          <RadioGroup
            value={showReports ? "yes" : "no"}
            onValueChange={(val) => handleToggleReports(val === "yes")}
            className="flex flex-row gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="reports-yes" />
              <Label htmlFor="reports-yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="reports-no" />
              <Label htmlFor="reports-no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        </div>

        {showReports && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            {reports.map((report, index) => (
              <div key={report.id} className="p-4 border border-secondary/10 rounded-lg bg-secondary/5 space-y-3 relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  aria-label="Remove report"
                    onClick={() => removeReport(index)}
                  className="absolute top-2 right-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor={`title-${index}`}>Report Title</Label>
                    <Input 
                      id={`title-${index}`}
                      value={report.title}
                      onChange={(e) => updateReport(index, 'title', e.target.value)}
                      placeholder="e.g. Monthly Status Report"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`symbol-${index}`}>Report Control Symbol</Label>
                    <Input 
                      id={`symbol-${index}`}
                      value={report.controlSymbol}
                      onChange={(e) => updateReport(index, 'controlSymbol', e.target.value)}
                      placeholder="e.g. DD-1234-01"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`exempt-${index}`} 
                      checked={report.exempt}
                      onCheckedChange={(checked) => updateReport(index, 'exempt', checked === true)}
                    />
                    <Label htmlFor={`exempt-${index}`} className="text-sm font-normal text-muted-foreground">Exempt from RCS?</Label>
                  </div>
                </div>
              </div>
            ))}

            <Button 
              variant="outline" 
              onClick={addReport}
              className="w-full border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Another Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
