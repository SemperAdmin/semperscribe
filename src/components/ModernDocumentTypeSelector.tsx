/**
 * Modern Document Type Selector Component
 * Demonstrates improved UI/UX patterns for Semper Scribe
 */

import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle2, FileText, Megaphone, ArrowRightLeft } from 'lucide-react';

interface DocumentType {
  id: 'mco' | 'mcbul' | 'supplement';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  timeline: string;
}

const documentTypes: DocumentType[] = [
  {
    id: 'mco',
    title: 'Orders',
    description: 'Marine Corps Order - Permanent policy directives with long-term applicability',
    icon: <FileText className="h-6 w-6" />,
    color: 'bg-red-500',
    features: ['Permanent Policy', 'Long-term Guidance', 'Comprehensive Coverage'],
    timeline: 'Permanent'
  },
  {
    id: 'mcbul',
    title: 'Bulletins', 
    description: 'Marine Corps Bulletin - Temporary directives for short-term requirements',
    icon: <Megaphone className="h-6 w-6" />,
    color: 'bg-blue-500',
    features: ['Temporary Directive', 'Time-sensitive', 'Quick Distribution'],
    timeline: '1 Year Max'
  },
  {
    id: 'supplement',
    title: 'Transmittal',
    description: 'Change Transmittal - Modifications to existing directives',
    icon: <ArrowRightLeft className="h-6 w-6" />,
    color: 'bg-purple-500',
    features: ['Modify Existing', 'Page Replacements', 'Incremental Updates'],
    timeline: 'As Needed'
  }
];

interface ModernDocumentTypeSelectorProps {
  selectedType: 'mco' | 'mcbul' | 'supplement';
  onTypeChange: (type: 'mco' | 'mcbul' | 'supplement') => void;
}

export const ModernDocumentTypeSelector: React.FC<ModernDocumentTypeSelectorProps> = ({
  selectedType,
  onTypeChange
}) => {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Choose Document Type</h2>
        <p className="text-gray-600 text-sm">Select the type of Marine Corps directive you want to create</p>
      </div>

      {/* Document Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {documentTypes.map((docType) => {
          const isSelected = selectedType === docType.id;
          
          return (
            <Card
              key={docType.id}
              className={`
                relative cursor-pointer transition-all duration-300 hover:scale-105
                ${isSelected 
                  ? 'ring-2 ring-red-500 shadow-lg bg-gradient-to-br from-red-50 to-yellow-50' 
                  : 'hover:shadow-md border-gray-200 hover:border-gray-300'
                }
              `}
              onClick={() => onTypeChange(docType.id)}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600" />
                </div>
              )}

              <CardContent className="p-6 space-y-4">
                {/* Icon & Title */}
                <div className="flex items-center space-x-3">
                  <div className={`
                    p-2 rounded-lg text-white
                    ${docType.color}
                  `}>
                    {docType.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {docType.title}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {docType.timeline}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {docType.description}
                </p>

                {/* Features */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key Features
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {docType.features.map((feature) => (
                      <Badge 
                        key={feature} 
                        variant="secondary" 
                        className="text-xs px-2 py-1"
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Selection State Visual */}
                <div className={`
                  h-1 w-full rounded-full transition-colors duration-300
                  ${isSelected ? docType.color : 'bg-gray-100'}
                `} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <div className="text-blue-600 mt-0.5">ℹ️</div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Need help choosing?</p>
            <p>
              <strong>Orders</strong> for permanent policies, 
              <strong> Bulletins</strong> for temporary announcements, 
              <strong> Transmittals</strong> for updating existing directives.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};