import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENT_GROUPS } from '@/lib/document-groups';

/**
 * Drift guard for src/lib/document-groups.ts (spec 2026-11-13 section 8.2).
 *
 * Sidebar.tsx is hand-written JSX and is deliberately NOT refactored to
 * read document-groups.ts (the how-to videos were recorded against it).
 * This parser reads the sidebar source as text and rebuilds the grouping:
 * every `AccordionItem value="..."` opens a group, every
 * `handleSelect('<literal>')` inside the accordion joins the open group,
 * and every `handleSelect('<literal>')` after `</Accordion>` is a
 * standalone group keyed by its own id. `handleSelect(SAME_PAGE_...)`
 * is a picker option, not a type id, and the literal-only regex skips it.
 */
export function parseSidebarGroups(source: string): { key: string; typeIds: string[] }[] {
  const start = source.indexOf('<Accordion');
  const end = source.indexOf('</Accordion>');
  if (start < 0 || end < 0 || end < start) throw new Error('Sidebar accordion not found');
  const groups: { key: string; typeIds: string[] }[] = [];
  const token = /AccordionItem value="([a-z0-9-]+)"|handleSelect\('([a-z0-9-]+)'\)/g;
  for (const m of source.slice(start, end).matchAll(token)) {
    if (m[1]) groups.push({ key: m[1], typeIds: [] });
    else if (m[2]) {
      if (groups.length === 0) throw new Error(`handleSelect('${m[2]}') before any AccordionItem`);
      groups[groups.length - 1].typeIds.push(m[2]);
    }
  }
  for (const m of source.slice(end).matchAll(/handleSelect\('([a-z0-9-]+)'\)/g)) {
    groups.push({ key: m[1], typeIds: [m[1]] });
  }
  return groups;
}

const SIDEBAR = readFileSync(join(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
const asData = DOCUMENT_GROUPS.map(g => ({ key: g.key, typeIds: [...g.typeIds] }));

describe('document-groups.ts matches Sidebar.tsx', () => {
  it('has the same group keys, members and order as the sidebar', () => {
    expect(parseSidebarGroups(SIDEBAR)).toEqual(asData);
  });

  it('negative control: two swapped type ids are reported as a mismatch', () => {
    const swapped = SIDEBAR
      .replace("handleSelect('mco')", "handleSelect('__TMP__')")
      .replace("handleSelect('bulletin')", "handleSelect('mco')")
      .replace("handleSelect('__TMP__')", "handleSelect('bulletin')");
    expect(swapped).not.toBe(SIDEBAR);
    expect(parseSidebarGroups(swapped)).not.toEqual(asData);
  });

  it('negative control: a type moved to another group is reported as a mismatch', () => {
    const moved = SIDEBAR.replace("handleSelect('mou')", "handleSelect('__X__')");
    expect(parseSidebarGroups(moved)).not.toEqual(asData);
  });
});
