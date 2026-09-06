/**
 * ITypePreview: six Components Affected rows always drawn on the cover,
 * rows seven onward on page two. Phase A.5 memoised the row source so
 * the two derived lists key on a stable input.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { ITypePreview } from '@/components/itype/ITypePreview';

afterEach(cleanup);

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ nsn: `NSN${i + 1}`, tamcn: '', id: '', model: '' }));

function bodyRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.querySelector('td')?.textContent ?? '');
}

describe('ITypePreview components table', () => {
  it('pads to six rows on the cover with no overflow page', () => {
    const { container } = render(<ITypePreview formData={{ componentsAffected: rows(2), longTitle: 'T' }} />);
    expect(bodyRows(container)).toEqual(['NSN1', 'NSN2', '', '', '', '']);
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  it('sends rows seven onward to a second table', () => {
    const { container } = render(<ITypePreview formData={{ componentsAffected: rows(8), longTitle: 'T' }} />);
    expect(container.querySelectorAll('table')).toHaveLength(2);
    expect(bodyRows(container)).toEqual(['NSN1', 'NSN2', 'NSN3', 'NSN4', 'NSN5', 'NSN6', 'NSN7', 'NSN8']);
  });

  it('draws six empty rows when there are none', () => {
    const { container } = render(<ITypePreview formData={{ longTitle: 'T' }} />);
    expect(bodyRows(container)).toEqual(['', '', '', '', '', '']);
  });
});
