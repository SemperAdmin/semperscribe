import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  IndentIncrease,
  IndentDecrease,
  Table2,
} from 'lucide-react';
import { canIndent, canOutdent, shiftBranch } from '@/hooks/useParagraphs';
import { ITypeRowTable } from './ITypeRowTable';
import {
  appendixCitation,
  COLUMN_LABEL,
  THREE_COL,
  FOUR_COL,
  LEAD_KEYS,
  type AppendixColumnKey,
  type AppendixLead,
  type AppendixParagraph,
} from '@/lib/i-type/appendix-paragraphs';

const MAX_LEVEL = 8;

interface ITypeAppendixEditorProps {
  paragraphs: AppendixParagraph[];
  onChange: (paragraphs: AppendixParagraph[]) => void;
}

// Free-form appendix paragraph editor, like the Marine Corps Order body, with a
// per-paragraph Insert Table action.
export const ITypeAppendixEditor: React.FC<ITypeAppendixEditorProps> = ({
  paragraphs,
  onChange,
}) => {
  const nextId = () => (paragraphs.length ? Math.max(...paragraphs.map((p) => p.id)) + 1 : 1);

  const patch = (id: number, change: Partial<AppendixParagraph>) =>
    onChange(paragraphs.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const addAfter = (id: number, type: 'same' | 'sub') => {
    const idx = paragraphs.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const level =
      type === 'sub' ? Math.min(paragraphs[idx].level + 1, MAX_LEVEL) : paragraphs[idx].level;
    const next = [...paragraphs];
    next.splice(idx + 1, 0, { id: nextId(), level, content: '' });
    onChange(next);
  };

  const remove = (id: number) => {
    if (paragraphs.length <= 1) {
      onChange(paragraphs.map((p) => (p.id === id ? { ...p, content: '', title: undefined, table: undefined } : p)));
      return;
    }
    onChange(paragraphs.filter((p) => p.id !== id));
  };

  // Indent/outdent move the whole branch and follow the same rules as the main
  // letter editor (see canIndent/canOutdent in useParagraphs).
  const [announcement, setAnnouncement] = React.useState('');
  const changeLevel = (id: number, delta: 1 | -1) => {
    const idx = paragraphs.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const ok = (delta === 1 ? canIndent(paragraphs, idx, MAX_LEVEL) : canOutdent(paragraphs, idx)).ok;
    if (!ok) return;
    const next = shiftBranch(paragraphs, idx, delta);
    onChange(next);
    setAnnouncement(`Paragraph is now ${appendixCitation(next, idx)}`);
  };

  // Alt+Shift+Right/Left on the paragraph's textarea (Tab stays free for focus).
  const onLevelKey = (e: React.KeyboardEvent, id: number) => {
    if (!e.altKey || !e.shiftKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); changeLevel(id, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); changeLevel(id, -1); }
  };

  const move = (id: number, dir: -1 | 1) => {
    const idx = paragraphs.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= paragraphs.length) return;
    const next = [...paragraphs];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const insertTable = (id: number, columns: AppendixColumnKey[]) =>
    patch(id, { table: { columns, rows: [] } });

  const removeTable = (id: number) => patch(id, { table: undefined });

  const updateTableRows = (id: number, rows: Array<Record<string, string>>) => {
    const p = paragraphs.find((x) => x.id === id);
    if (!p?.table) return;
    patch(id, { table: { columns: p.table.columns, rows } });
  };

  // Set the optional leading reference column (None, Item, or Fig. Item),
  // carrying any entered values over to the new key.
  const setLead = (id: number, lead: AppendixLead) => {
    const p = paragraphs.find((x) => x.id === id);
    if (!p?.table) return;
    const prevLead = p.table.columns.find((c) => LEAD_KEYS.includes(c)) as
      | AppendixColumnKey
      | undefined;
    const base = p.table.columns.filter((c) => !LEAD_KEYS.includes(c));
    let rows = p.table.rows;
    if (prevLead && lead === 'none') {
      rows = rows.map((r) => {
        const { [prevLead]: _omit, ...rest } = r;
        return rest;
      });
    } else if (prevLead && lead !== 'none' && prevLead !== lead) {
      rows = rows.map((r) => {
        const { [prevLead]: v, ...rest } = r;
        return { ...rest, [lead]: v ?? '' };
      });
    }
    const columns = lead === 'none' ? base : [lead as AppendixColumnKey, ...base];
    patch(id, { table: { columns, rows } });
  };

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      {paragraphs.map((p, i) => {
        const citation = appendixCitation(paragraphs, i);
        const indentState = canIndent(paragraphs, i, MAX_LEVEL);
        const outdentState = canOutdent(paragraphs, i);
        return (
          <div
            key={p.id}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
            style={{ marginLeft: `${Math.max(0, p.level - 1) * 16}px` }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2 py-1 rounded bg-secondary/30">
                L{p.level} · {citation}
              </span>
              {p.title ? (
                <span className="text-sm font-semibold px-2 py-1 rounded bg-primary/10 text-primary">
                  {p.title}
                </span>
              ) : null}
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  disabled={!outdentState.ok}
                  title={outdentState.ok ? 'Outdent' : outdentState.reason}
                  aria-label={`Outdent paragraph ${citation}`}
                  onClick={() => changeLevel(p.id, -1)}
                >
                  <IndentDecrease className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  disabled={!indentState.ok}
                  title={indentState.ok ? 'Indent' : indentState.reason}
                  aria-label={`Indent paragraph ${citation}`}
                  onClick={() => changeLevel(p.id, 1)}
                >
                  <IndentIncrease className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move up" onClick={() => move(p.id, -1)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move down" onClick={() => move(p.id, 1)}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Delete" onClick={() => remove(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>

            <textarea
              value={p.content}
              onChange={(e) => patch(p.id, { content: e.target.value })}
              onKeyDown={(e) => onLevelKey(e, p.id)}
              placeholder="Enter paragraph content..."
              className="w-full min-h-[60px] rounded-md border border-border bg-background p-2 text-sm"
            />

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => addAfter(p.id, 'same')}>
                <Plus className="w-4 h-4 mr-1" /> Paragraph
              </Button>
              <Button variant="outline" size="sm" onClick={() => addAfter(p.id, 'sub')}>
                <Plus className="w-4 h-4 mr-1" /> Sub-paragraph
              </Button>
              {p.table ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => removeTable(p.id)}>
                    <Table2 className="w-4 h-4 mr-1" /> Remove Table
                  </Button>
                  <span className="text-xs self-center text-muted-foreground">Lead:</span>
                  <Button variant="outline" size="sm" onClick={() => setLead(p.id, 'none')}>
                    None
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLead(p.id, 'item')}>
                    Item
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLead(p.id, 'figItem')}>
                    Fig. Item
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => insertTable(p.id, THREE_COL)}>
                    <Table2 className="w-4 h-4 mr-1" /> Insert Table (3-col)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => insertTable(p.id, FOUR_COL)}>
                    <Table2 className="w-4 h-4 mr-1" /> Insert Table (4-col)
                  </Button>
                </>
              )}
            </div>

            {p.table ? (
              <ITypeRowTable
                columns={p.table.columns.map((c) => ({ key: c, label: COLUMN_LABEL[c] }))}
                data={p.table.rows}
                onChange={(rows) => updateTableRows(p.id, rows)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
