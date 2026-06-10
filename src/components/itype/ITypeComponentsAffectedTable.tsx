import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

interface ComponentRow {
  nsn: string;
  tamcn: string;
  id: string;
  model: string;
}

interface ITypeComponentsAffectedTableProps {
  data: ComponentRow[];
  onChange: (data: ComponentRow[]) => void;
}

export const ITypeComponentsAffectedTable: React.FC<ITypeComponentsAffectedTableProps> = ({
  data,
  onChange,
}) => {
  const MAX_ROWS_FIRST_PAGE = 6;

  // Always show at least 6 rows for first page spacing
  const displayRows = Math.max(data.length, MAX_ROWS_FIRST_PAGE);
  const rows = [...data];
  while (rows.length < displayRows) {
    rows.push({ nsn: '', tamcn: '', id: '', model: '' });
  }

  const handleRowChange = (index: number, field: keyof ComponentRow, value: string) => {
    const updatedData = [...data];
    if (index < data.length) {
      updatedData[index] = { ...updatedData[index], [field]: value };
    } else if (value.trim()) {
      // Add new row if not exists and has value
      while (updatedData.length <= index) {
        updatedData.push({ nsn: '', tamcn: '', id: '', model: '' });
      }
      updatedData[index] = { ...updatedData[index], [field]: value };
    }
    onChange(updatedData);
  };

  const handleRemoveRow = (index: number) => {
    const updatedData = data.filter((_, i) => i !== index);
    onChange(updatedData);
  };

  const handleAddRow = () => {
    onChange([...data, { nsn: '', tamcn: '', id: '', model: '' }]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-border bg-secondary/20" style={{ height: '40px' }}>
                <th className="px-3 text-left font-semibold" style={{ height: '40px', verticalAlign: 'middle', padding: '8px 12px' }}>NSN</th>
                <th className="px-3 text-left font-semibold" style={{ height: '40px', verticalAlign: 'middle', padding: '8px 12px' }}>TAMCN</th>
                <th className="px-3 text-left font-semibold" style={{ height: '40px', verticalAlign: 'middle', padding: '8px 12px' }}>ID</th>
                <th className="px-3 text-left font-semibold" style={{ height: '40px', verticalAlign: 'middle', padding: '8px 12px' }}>MODEL</th>
                <th style={{ width: '40px', height: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className={index < data.length ? 'border-b border-border' : 'border-b border-border/30'}
                  style={{ height: '40px' }}
                >
                  <td style={{ height: '40px', padding: '0 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    <Input
                      value={row.nsn}
                      onChange={(e) => handleRowChange(index, 'nsn', e.target.value)}
                      placeholder="NSN"
                      className="text-xs border-0 bg-transparent px-0 h-full"
                      style={{ height: '24px', lineHeight: '1' }}
                    />
                  </td>
                  <td style={{ height: '40px', padding: '0 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    <Input
                      value={row.tamcn}
                      onChange={(e) => handleRowChange(index, 'tamcn', e.target.value)}
                      placeholder="TAMCN"
                      className="text-xs border-0 bg-transparent px-0 h-full"
                      style={{ height: '24px', lineHeight: '1' }}
                    />
                  </td>
                  <td style={{ height: '40px', padding: '0 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    <Input
                      value={row.id}
                      onChange={(e) => handleRowChange(index, 'id', e.target.value)}
                      placeholder="ID"
                      className="text-xs border-0 bg-transparent px-0 h-full"
                      style={{ height: '24px', lineHeight: '1' }}
                    />
                  </td>
                  <td style={{ height: '40px', padding: '0 12px', verticalAlign: 'middle', overflow: 'hidden' }}>
                    <Input
                      value={row.model}
                      onChange={(e) => handleRowChange(index, 'model', e.target.value)}
                      placeholder="MODEL"
                      className="text-xs border-0 bg-transparent px-0 h-full"
                      style={{ height: '24px', lineHeight: '1' }}
                    />
                  </td>
                  <td style={{ height: '40px', width: '40px', padding: '0', verticalAlign: 'middle', textAlign: 'center', overflow: 'hidden' }}>
                    {index < data.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRow(index)}
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

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddRow}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Row
      </Button>

      <div className="text-xs text-muted-foreground">
        {data.length > MAX_ROWS_FIRST_PAGE ? (
          <p>
            First 6 rows on page 1, {data.length - MAX_ROWS_FIRST_PAGE} row{data.length - MAX_ROWS_FIRST_PAGE !== 1 ? 's' : ''} on page 2+
          </p>
        ) : (
          <p>Space reserved for 6 rows on first page</p>
        )}
      </div>
    </div>
  );
};
