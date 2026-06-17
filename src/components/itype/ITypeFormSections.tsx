import React from 'react';
import { FormData } from '@/types';
import { ITypeDefinition } from '@/lib/i-type/definition';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { ITypeComponentsAffectedTable } from './ITypeComponentsAffectedTable';
import { ITypeAppendixEditor } from './ITypeAppendixEditor';
import { defaultAppendixParagraphs, type AppendixParagraph } from '@/lib/i-type/appendix-paragraphs';

interface ITypeFormSectionsProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
}

export const ITypeFormSections: React.FC<ITypeFormSectionsProps> = ({ formData, setFormData }) => {
  const handleFormSubmit = (data: any) => {
    setFormData(data as FormData);
  };

  const updateField = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value } as FormData);
  };

  const appendixParagraphs =
    ((formData as any).appendixParagraphs as AppendixParagraph[]) ?? defaultAppendixParagraphs();

  return (
    <div className="space-y-6">
      <DynamicForm
        documentType={ITypeDefinition}
        onSubmit={handleFormSubmit}
        defaultValues={formData}
      />

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">End Items</h3>
        <p className="text-sm text-muted-foreground">
          Cover End Items table. Enter the NSN, TAMCN, ID, and MODEL for each item. First 6 rows
          display on page 1; additional rows continue on page 2.
        </p>
        <ITypeComponentsAffectedTable
          data={(formData as any).componentsAffected || []}
          onChange={(rows) => updateField('componentsAffected', rows)}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Appendix A</h3>
        <p className="text-sm text-muted-foreground">
          Free-form paragraphs, like a Marine Corps Order. Indent for sub-paragraphs and use Insert
          Table to add a Nomenclature/NSN/PN(/Qty) table under a paragraph.
        </p>
        <ITypeAppendixEditor
          paragraphs={appendixParagraphs}
          onChange={(p) => updateField('appendixParagraphs', p)}
        />
      </div>
    </div>
  );
};
