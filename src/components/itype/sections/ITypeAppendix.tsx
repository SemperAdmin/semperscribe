import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import pageStyles from '@/styles/itype-preview.module.css';
import styles from '@/styles/itype-appendix.module.css';
import { APPENDIX_LABEL, ENCLOSURE_LABEL, appendixRunningHeader } from '@/lib/i-type/appendix-spec';
import {
  appendixCitation,
  COLUMN_LABEL,
  type AppendixInlineTable,
  type AppendixParagraph,
} from '@/lib/i-type/appendix-paragraphs';

interface ITypeAppendixProps {
  formData?: Record<string, any>;
}

// Space reserved at the bottom of each sheet for the page number.
const FOOTER_RESERVE = 36;

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
};

const InlineTable: React.FC<{ table: AppendixInlineTable }> = ({ table }) => (
  <table className={styles.table}>
    <thead>
      <tr>
        {table.columns.map((c) => (
          <th key={c} className={styles.th}>
            {COLUMN_LABEL[c]}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {table.rows.map((row, r) => (
        <tr key={r}>
          {table.columns.map((c) => (
            <td key={c} className={styles.td}>
              {(row?.[c] ?? '').toString()}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

type Block = { key: string; node: React.ReactNode };

const buildBlocks = (paragraphs: AppendixParagraph[]): Block[] => {
  const blocks: Block[] = [
    {
      key: 'labels',
      node: (
        <>
          <p className={styles.sectionLabel}>{APPENDIX_LABEL}</p>
          <p className={styles.sectionLabel}>{ENCLOSURE_LABEL}</p>
        </>
      ),
    },
  ];

  paragraphs.forEach((p, i) => {
    const citation = appendixCitation(paragraphs, i);
    const indent = Math.max(0, p.level - 1) * 0.25;
    const hasContent = !!(p.content && p.content.trim());
    blocks.push({
      key: `p-${p.id}`,
      node: (
        <div className={styles.item} style={{ marginLeft: `${indent}in` }}>
          <div className={styles.paraRow}>
            <span className={styles.markerCol}>{citation}</span>
            <span className={styles.bodyCol}>
            {p.title ? (
              <span className={styles.heading}>
                {p.title}
                {hasContent ? '.  ' : ''}
              </span>
            ) : null}
            {hasContent ? <span>{p.content}</span> : null}
            </span>
          </div>
          {p.table ? <InlineTable table={p.table} /> : null}
        </div>
      ),
    });
  });
  return blocks;
};

// Greedy packing: returns the block indices grouped per page, given each block
// height and the usable content height of one page.
export const paginateByHeight = (heights: number[], available: number): number[][] => {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    if (current.length && used + h > available) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(i);
    used += h;
  });
  if (current.length) pages.push(current);
  return pages.length ? pages : [heights.map((_, i) => i)];
};

export const ITypeAppendix: React.FC<ITypeAppendixProps> = ({ formData }) => {
  const header = appendixRunningHeader(formData?.shortTitle, formatDate(formData?.date));
  const paragraphs = useMemo(
    () => (formData?.appendixParagraphs as AppendixParagraph[]) ?? [],
    [formData?.appendixParagraphs]
  );
  const blocks = useMemo(() => buildBlocks(paragraphs), [paragraphs]);

  // Signature of the paragraph data and header. When it changes, re-measure.
  const dataSig = useMemo(
    () => JSON.stringify([header, paragraphs]),
    [header, paragraphs]
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastSig = useRef<string | null>(null);
  const [groups, setGroups] = useState<number[][] | null>(null);

  // Reset to a fresh measurement when the data or header changes.
  useEffect(() => {
    if (lastSig.current !== null && lastSig.current !== dataSig) {
      setGroups(null);
    }
    lastSig.current = dataSig;
  }, [dataSig]);

  useLayoutEffect(() => {
    if (groups) return;
    const sheet = sheetRef.current;
    const headerEl = headerRef.current;
    if (!sheet || !headerEl) return;
    const cs = getComputedStyle(sheet);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    // One page's height comes from the sheet min-height (10in), not the grown
    // measurement sheet, which holds every block at once.
    const minH = parseFloat(cs.minHeight);
    const pageHeight = Number.isFinite(minH) && minH > 200 ? minH : sheet.clientHeight;
    const contentHeight = pageHeight - padTop - padBottom;
    const headerHeight = headerEl.offsetHeight;
    const available = contentHeight - headerHeight - FOOTER_RESERVE;
    const heights = blockRefs.current.map((el) => (el ? el.offsetHeight : 0));
    if (available < 80 || heights.every((h) => h === 0)) {
      setGroups([blocks.map((_, i) => i)]);
      return;
    }
    setGroups(paginateByHeight(heights, available));
  }, [groups, blocks]);

  // Measurement pass: render all blocks in one sheet. useLayoutEffect splits
  // them before paint, so this also serves as the fallback if measuring fails.
  if (!groups) {
    return (
      <div ref={sheetRef} className={`${pageStyles.page} ${pageStyles.letterPage}`}>
        <div className={styles.appendix}>
          <div ref={headerRef} className={styles.runningHeader}>
            {header}
          </div>
          {blocks.map((b, i) => (
            <div
              key={b.key}
              ref={(el) => {
                blockRefs.current[i] = el;
              }}
            >
              {b.node}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Paginated render: one flex-column page sheet per group. Header on top,
  // body fills the middle, page number pinned to the bottom.
  return (
    <>
      {groups.map((group, pageIdx) => (
        <div
          key={pageIdx}
          className={`${pageStyles.page} ${pageStyles.letterPage} ${styles.appendixPage}`}
        >
          <div className={styles.runningHeader}>{header}</div>
          <div className={`${styles.appendix} ${styles.appendixBody}`}>
            {group.map((bi) => (
              <div key={blocks[bi].key}>{blocks[bi].node}</div>
            ))}
          </div>
          <div className={styles.pageNumber}>{pageIdx + 1}</div>
        </div>
      ))}
    </>
  );
};
