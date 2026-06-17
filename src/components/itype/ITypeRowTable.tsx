import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

export interface RowColumn {
  key: string;
  label: string;
}

interface ITypeRowTableProps {
  columns: RowColumn[];
  data: Array<Record<string, string>>;
  onChange: (rows: Array<Record<string, string>>) => void;
  // Minimum rows drawn for spacing, matching the borderless placeholder look.
  minRows?: number;
}

// Generic row editor for the appendix tables. Columns vary per table
// (Nomenclature/NSN/PN, or with a Qty column). Mirrors the Components Affected
// editor pattern.
export const ITypeRowTable: React.FC<ITypeRowTableProps> = ({
  columns,
  data,
  onChange,
  minRows = 2,
}) => {
  const blankRow = (): Record<string, string> =>
    Object.fromEntries(columns.map((c) => [c.key, '']));

  const displayCount = Math.max(data.length, minRows);
  const rows = [...data];
  while (rows.length < displayCount) rows.push(blankRow());

  const handleChange = (index: number, key: string, value: string) => {
    const updated = [...data];
    while (updated.length <= index) updated.push(blankRow());
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const handleAdd = () => onChange([...data, blankRow()]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-border bg-secondary/20" style={{ height: '40px' }}>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 text-left font-semibold"
                    style={{ height: '40px', verticalAlign: 'middle', padding: '8px 12px' }}
                  >
                    {c.label}
                  </th>
                ))}
                <th style={{ width: '40px', height: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className={
                    index < data.length ? 'border-b border-border' : 'border-b border-border/30'
                  }
                  style={{ height: '40px' }}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        height: '40px',
                        padding: '0 12px',
                        verticalAlign: 'middle',
                        overflow: 'hidden',
                      }}
                    >
                      <Input
                        value={row[c.key] ?? ''}
                        onChange={(e) => handleChange(index, c.key, e.target.value)}
                        placeholder={c.label}
                        className="text-xs border-0 bg-transparent px-0 h-full"
                        style={{ height: '24px', lineHeight: '1' }}
                      />
                    </td>
                  ))}
                  <td
                    style={{
                      height: '40px',
                      width: '40px',
                      padding: '0',
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {index < data.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Row
      </Button>
    </div>
  );
};
