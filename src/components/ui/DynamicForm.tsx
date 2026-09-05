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
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { AutoSuggestInput } from '@/components/ui/AutoSuggestInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSsics } from '@/hooks/useReferenceData';
import { useListboxNavigation } from '@/hooks/useListboxNavigation';
import { cn } from '@/lib/utils';

/**
 * D.8 (UX audit finding 10): the SSIC picker as a WAI-ARIA combobox. It
 * was a plain div list whose entries fired on `onPointerDown` alone, so
 * no keyboard user reached an option and a screen reader was
 * told nothing about the list. Arrow keys move, Enter selects, Escape
 * closes, and a click works as well as a pointer down.
 */
function SSICCombobox({
  value,
  onChange,
  placeholder,
  label,
  ...controlProps
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * Accessible name, used when nothing else names the input. The audit
   * counted this control among the five named by placeholder alone.
   */
  label?: string;
} & Pick<React.ComponentProps<'input'>, 'id' | 'aria-describedby' | 'aria-invalid'>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
  const { ssics } = useSsics();

  const filtered = React.useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    return ssics.filter(s =>
      s.code.toLowerCase().includes(q) || s.nomenclature.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [query, ssics]);

  const commit = React.useCallback((index: number) => {
    const picked = filtered[index];
    if (!picked) return;
    onChange(picked.code);
    setOpen(false);
    inputRef.current?.blur();
  }, [filtered, onChange]);

  const nav = useListboxNavigation({
    idPrefix: listboxId,
    count: filtered.length,
    open,
    setOpen,
    onSelect: commit,
  });

  const expanded = open && filtered.length > 0;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        // FormControl clones this component with the id the visible
        // FormLabel points at, so forwarding it turns the label into a
        // real association instead of a placeholder standing in for one.
        {...controlProps}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listboxId : undefined}
        aria-activedescendant={nav.activeId}
        aria-autocomplete="list"
        aria-label={controlProps.id ? undefined : label}
        autoComplete="off"
        placeholder={placeholder || 'Search SSIC by code or name...'}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={nav.onKeyDown}
        onFocus={() => { setQuery(value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {expanded && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="SSIC matches"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {filtered.map((s, index) => (
            <li
              key={`${s.code}-${s.nomenclature}`}
              id={nav.optionId(index)}
              role="option"
              aria-selected={index === nav.activeIndex}
              className={cn(
                'px-3 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                index === nav.activeIndex && 'bg-accent text-accent-foreground',
              )}
              onMouseMove={() => nav.setActiveIndex(index)}
              // Pointer down beats the input's blur, which would close
              // the list before a click landed. Click stays wired for
              // pointer types and harnesses which emit no pointer event.
              onPointerDown={(e) => { e.preventDefault(); commit(index); }}
              onClick={() => commit(index)}
            >
              <span className="font-mono font-bold">{s.code}</span>
              <span className="ml-2 text-muted-foreground">{s.nomenclature}</span>
            </li>
          ))}
        </ul>
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

  // Watch for changes to sync with parent. form.watch subscription (not
  // useWatch) is deliberate: the callback debounces without re-rendering
  // this large form on every keystroke. The pending commit is kept in a
  // ref so a blur anywhere in the form flushes it at once: leaving a
  // field never leaves up to 500 ms of typing uncommitted for an export
  // or a save which follows immediately.
  const pendingCommit = React.useRef<(() => void) | null>(null);
  const commitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value) => {
      if (!onSubmit) return;
      if (commitTimer.current) clearTimeout(commitTimer.current);
      const commit = () => {
        pendingCommit.current = null;
        commitTimer.current = null;
        // Double-check filtering (though sanitizedDefaultValues should handle it)
        const filteredValue: any = {};
        Object.keys(value).forEach(key => {
          if (allowedTopLevelKeys.has(key)) {
            filteredValue[key] = value[key];
          }
        });
        onSubmit(filteredValue);
      };
      pendingCommit.current = commit;
      commitTimer.current = setTimeout(commit, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (commitTimer.current) clearTimeout(commitTimer.current);
      pendingCommit.current = null;
      commitTimer.current = null;
    };
  // form is the stable useForm instance; allowedTopLevelKeys is memoized
  // per documentType - the subscription still attaches once per form.
  }, [form, onSubmit, allowedTopLevelKeys]);

  const flushPendingCommit = () => {
    const commit = pendingCommit.current;
    if (!commit) return;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commit();
  };

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
          // D.4: the compliance dialog's jump-to-field action finds a
          // field by this attribute, so an issue which names a field
          // takes the drafter to it. It sits on the wrapper rather than
          // the control because a combobox, a select and a date picker
          // all render something other than a plain input.
          <FormItem className={field.className} data-field={field.name}>
            <FormLabel>{field.label} {field.required && <span className="text-destructive">*</span>}</FormLabel>
            <FormControl>
              {field.type === 'combobox' ? (
                <SSICCombobox value={formField.value ?? ''} onChange={formField.onChange} placeholder={field.placeholder} label={field.label} />
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
                <AutoSuggestInput placeholder={field.placeholder} preserveCase={field.preserveCase} {...formField} />
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
      <form className="space-y-4" onBlurCapture={flushPendingCommit}> {/* Removed onSubmit since we auto-sync */}
        {documentType.sections.map(section => (
          <Card key={section.id} className="mb-8 border-border shadow-sm">
             <CardHeader className="pb-3 bg-secondary text-secondary-foreground rounded-t-lg">
                {/* D.8: a real heading, so the editor is navigable by
                    heading. h3 sits under the document-type h2 that
                    DocumentLayout renders above this form. */}
                <CardTitle as="h3" className="text-lg font-semibold flex items-center">
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
