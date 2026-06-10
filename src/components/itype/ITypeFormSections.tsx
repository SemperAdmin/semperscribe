import React from 'react';
import { FormData } from '@/types';
import { ITypeDefinition } from '@/lib/i-type/definition';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { ITypeComponentsAffectedTable } from './ITypeComponentsAffectedTable';

interface ITypeFormSectionsProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
}

export const ITypeFormSections: React.FC<ITypeFormSectionsProps> = ({
  formData,
  setFormData,
}) => {
  const handleFormSubmit = (data: any) => {
    setFormData(data as FormData);
  };

  const handleComponentsAffectedChange = (rows: any[]) => {
    setFormData({
      ...formData,
      componentsAffected: rows,
    });
  };

  return (
    <div className="space-y-6">
      <DynamicForm
        documentType={ITypeDefinition}
        onSubmit={handleFormSubmit}
        defaultValues={formData}
      />

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Components Affected</h3>
        <p className="text-sm text-muted-foreground">
          Enter the NSN, TAMCN, ID, and MODEL for each component. First 6 rows display on page 1; additional rows continue on page 2.
        </p>
        <ITypeComponentsAffectedTable
          data={formData.componentsAffected || []}
          onChange={handleComponentsAffectedChange}
        />
      </div>
    </div>
  );
};
