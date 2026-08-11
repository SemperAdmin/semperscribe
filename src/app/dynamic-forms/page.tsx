'use client';

import React, { useState } from 'react';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { getTemplateForType } from '@/lib/templates';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function DynamicFormsDemo() {
  const [selectedType, setSelectedType] = useState<string>('basic');
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSubmittedData(null); // Clear data on type switch
  };

  const handleFormSubmit = (data: any) => {
    console.log('Form Submitted:', data);
    setSubmittedData(data);
  };

  const currentDocType = DOCUMENT_TYPES[selectedType];

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dynamic Document System</h1>
            <p className="text-muted-foreground">
                Select a document type below to see the schema-driven form generation in action.
            </p>
        </div>

        <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
            <span className="font-medium">Select Document Type:</span>
            <div className="w-[300px]">
                <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                    {Object.values(DOCUMENT_TYPES).map(type => (
                    <SelectItem key={type.id} value={type.id}>
                        <span className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            {type.name}
                        </span>
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <DynamicForm 
                    key={selectedType} // Force re-render on type change
                    documentType={currentDocType} 
                    defaultValues={getTemplateForType(selectedType).defaultData}
                    onSubmit={handleFormSubmit} 
                />
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Schema Analysis</CardTitle>
                        <CardDescription>Key properties of {currentDocType.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">ID: {currentDocType.id}</Badge>
                            <Badge variant="outline">{currentDocType.sections.length} Sections</Badge>
                            <Badge variant="outline">
                                {currentDocType.sections.reduce((acc, sec) => acc + sec.fields.length, 0)} Fields
                            </Badge>
                        </div>
                        <div className="text-sm space-y-2 pt-2">
                            <h4 className="font-semibold">Fields defined:</h4>
                            <ul className="list-disc list-inside text-muted-foreground">
                                {currentDocType.sections.flatMap(s => s.fields).map(f => (
                                    <li key={f.name}>{f.label} <span className="text-xs opacity-50">({f.type})</span></li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {submittedData && (
                    <Card className="border-green-200 bg-green-50/50">
                        <CardHeader>
                            <CardTitle className="text-green-700">Submission Result</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-xs overflow-auto max-h-[400px]">
                                {JSON.stringify(submittedData, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
