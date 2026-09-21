import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Check, X } from 'lucide-react';
import type { Block, Run } from '@/lib/schemas/volume-schema';

interface BlockEditorProps {
  block: Block;
  onChange: (block: Block) => void;
  /** Accessible label for the textarea, e.g. "010101. text". */
  label?: string;
}

/**
 * Edits a single Block. Simplification (noted in the task-12 report): the
 * run model here is one run per block, edited as plain text; "Mark changed"
 * and "Insert link" flags apply to that whole run. A richer per-span editor
 * (multiple runs per block, partial selections) is out of scope for this
 * tree-authoring pass.
 */
export function BlockEditor({ block, onChange, label }: BlockEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const run: Run = block.runs[0] ?? { text: '' };
  const [linkUrl, setLinkUrl] = useState(run.href ?? '');

  const setText = (text: string) => onChange({ ...block, runs: [{ ...run, text }] });
  const toggleChanged = () => onChange({ ...block, runs: [{ ...run, changed: !run.changed }] });
  const applyLink = () => {
    onChange({ ...block, runs: [{ ...run, link: true, href: linkUrl }] });
    setLinkOpen(false);
  };
  const removeLink = () => {
    const { link: _link, href: _href, ...rest } = run;
    onChange({ ...block, runs: [rest] });
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        value={run.text}
        onChange={(e) => setText(e.target.value)}
        aria-label={label ?? 'Block text'}
        className="min-h-[60px] text-sm"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant={run.changed ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggleChanged}
          aria-pressed={!!run.changed}
        >
          <Check className="w-3.5 h-3.5 mr-1" /> Mark changed
        </Button>
        {run.link ? (
          <Button type="button" variant="secondary" size="sm" onClick={removeLink}>
            <X className="w-3.5 h-3.5 mr-1" /> Remove link ({run.href})
          </Button>
        ) : linkOpen ? (
          <div className="flex items-center gap-1">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 w-56"
              aria-label="Link URL"
            />
            <Button type="button" size="sm" onClick={applyLink}>
              Apply
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> Insert link
          </Button>
        )}
      </div>
    </div>
  );
}
