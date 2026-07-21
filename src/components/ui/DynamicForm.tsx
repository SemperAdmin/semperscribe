'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentTypeDefinition, FieldDefinition } from '@/lib/schemas';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { AutoSuggestInput } from '@/components/ui/AutoSuggestInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSsics } from '@/hooks/useReferenceData';

function SSICCombobox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { ssics } = useSsics();

  const filtered = React.useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return ssics.filter(s =>
      s.code.toLowerCase().includes(q) || s.nomenclature.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [query, ssics]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder || 'Search SSIC by code or name...'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { setQuery(value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((s) => (
            <button
              key={`${s.code}-${s.nomenclature}`}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onPointerDown={(e) => {
                e.preventDefault();
                onChange(s.code);
                setOpen(false);
                inputRef.current?.blur();
              }}
            >
              <span className="font-mono font-bold">{s.code}</span>
              <span className="ml-2 text-muted-foreground">{s.nomenclature}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ISO date <-> Date without UTC parsing - `new Date('YYYY-MM-DD')`
// lands on the previous local day west of Greenwich.
function isoToLocalDate(value: string | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? undefined : d;
}
function localDateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DynamicFormProps {
  documentType: DocumentTypeDefinition;
  onSubmit: (data: any) => void;
  defaultValues?: any;
  children?: React.ReactNode;
}

export function DynamicForm({ documentType, onSubmit, defaultValues, children }: DynamicFormProps) {
  // Calculate allowed top-level keys based on document definitions
  const allowedTopLevelKeys = React.useMemo(() => {
    const keys = new Set<string>(['documentType']);
    documentType.sections.forEach(section => {
      section.fields.forEach(field => {
         const topLevel = field.name.split('.')[0];
         keys.add(topLevel);
      });
    });
    return keys;
  }, [documentType]);

  // Sanitize default values to only include fields relevant to this form
  const sanitizedDefaultValues = React.useMemo(() => {
      if (!defaultValues) return { documentType: documentType.id };

      const sanitized: any = {};
      Object.keys(defaultValues).forEach(key => {
          if (allowedTopLevelKeys.has(key)) {
              sanitized[key] = defaultValues[key];
          }
      });
      // Apply field-level defaultValues for any fields not already set
      documentType.sections.forEach(section => {
        section.fields.forEach(field => {
          const topLevel = field.name.split('.')[0];
          if (field.defaultValue !== undefined && (sanitized[topLevel] === undefined || sanitized[topLevel] === '')) {
            if (field.name.includes('.')) {
              // Nested field (e.g., 'distribution.pcn')
              const parts = field.name.split('.');
              if (!sanitized[parts[0]]) sanitized[parts[0]] = {};
              if (sanitized[parts[0]][parts[1]] === undefined) {
                sanitized[parts[0]][parts[1]] = field.defaultValue;
              }
            } else {
              sanitized[field.name] = field.defaultValue;
            }
          }
        });
      });
      // Ensure documentType is set
      sanitized.documentType = documentType.id;
      return sanitized;
  // documentType is a module-level definition object (DOCUMENT_TYPES),
  // referentially stable across renders - memo timing is unchanged.
  }, [defaultValues, allowedTopLevelKeys, documentType]);

  const form = useForm({
    resolver: zodResolver(documentType.schema),
    defaultValues: sanitizedDefaultValues,
    mode: 'onChange',
  });

  // Watch for changes to sync with parent immediately (optional but good for previews)
  // form.watch subscription (not useWatch) is deliberate: the callback
  // debounces without re-rendering this large form on every keystroke.
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value) => {
       if (onSubmit) {
         clearTimeout(timeoutId);
         timeoutId = setTimeout(() => {
           // Double-check filtering (though sanitizedDefaultValues should handle it)
           const filteredValue: any = {};
           Object.keys(value).forEach(key => {
               if (allowedTopLevelKeys.has(key)) {
                   filteredValue[key] = value[key];
               }
           });
           onSubmit(filteredValue);
         }, 500);
       }
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  // form is the stable useForm instance; allowedTopLevelKeys is memoized
  // per documentType - the subscription still attaches once per form.
  }, [form, onSubmit, allowedTopLevelKeys]);

  const renderField = (field: FieldDefinition) => {
    // Dynamic condition check
    if (field.condition && !field.condition(form.getValues())) {
      return null;
    }

    // Hidden fields: register in form data but don't render UI
    if (field.type === 'hidden') {
      return (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name}
          render={() => <></>}
        />
      );
    }

    // Skip field types rendered externally (not by DynamicForm)
    if (field.type === 'decision-grid' || field.type === 'radio') {
      return null;
    }

    return (
      <FormField
        key={field.name}
        control={form.control}
        name={field.name}
        render={({ field: formField }) => (
          <FormItem className={field.className}>
            <FormLabel>{field.label} {field.required && <span className="text-destructive">*</span>}</FormLabel>
            <FormControl>
              {field.type === 'combobox' ? (
                <SSICCombobox value={formField.value ?? ''} onChange={formField.onChange} placeholder={field.placeholder} />
              ) : field.type === 'text' ? (
                <Input placeholder={field.placeholder} {...formField} value={formField.value ?? ''} />
              ) : field.type === 'date' ? (
                <Input type="text" placeholder={field.placeholder || 'DD MMM YY'} {...formField} value={formField.value ?? ''} />
              ) : field.type === 'date-picker' ? (
                <DatePicker
                  date={isoToLocalDate(formField.value)}
                  setDate={(d) => formField.onChange(d ? localDateToIso(d) : '')}
                  placeholder={field.placeholder || 'Pick a date'}
                />
              ) : field.type === 'textarea' ? (
                <Textarea placeholder={field.placeholder} rows={field.rows} {...formField} value={formField.value ?? ''} />
              ) : field.type === 'autosuggest' ? (
                <AutoSuggestInput placeholder={field.placeholder} {...formField} />
              ) : field.type === 'number' ? (
                 <Input type="number" placeholder={field.placeholder} {...formField} value={formField.value ?? ''} />
              ) : field.type === 'select' ? (
                <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || "Select..."} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.filter(opt => opt.value !== '').map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                  <span className="text-sm font-medium">{field.placeholder}</span>
                </div>
              ) : (
                <Input placeholder={field.placeholder} {...formField} value={formField.value ?? ''} />
              )}
            </FormControl>
            {field.description && <FormDescription>{field.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form className="space-y-4"> {/* Removed onSubmit since we auto-sync */}
        {documentType.sections.map(section => (
          <Card key={section.id} className="mb-8 border-border shadow-sm">
             <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center">
                    {section.title}
                </CardTitle>
                {section.description && <p className="text-sm text-secondary-foreground/80">{section.description}</p>}
             </CardHeader>
             <CardContent className="pt-6">
                <div className={`grid gap-6 ${section.className || 'grid-cols-1 md:grid-cols-2'}`}>
                  {section.fields.map(renderField)}
                </div>
             </CardContent>
          </Card>
        ))}
        {children}
      </form>
    </Form>
  );
}
