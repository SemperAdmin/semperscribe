/**
 * Phase 0.4 (HARDENING_PLAN_2026-09): behaviour pin for the delegation
 * toggle in ClosingBlockSection, whose show flag mirrors
 * formData.delegationText through an effect. The section holds other
 * radio groups, so the delegation radios are addressed by id.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ClosingBlockSection } from '@/components/letter/ClosingBlockSection';
import type { FormData } from '@/types';

afterEach(cleanup);

function renderBlock(formData: Partial<FormData>) {
  const setFormData = vi.fn();
  const view = render(
    <ClosingBlockSection
      formData={{ documentType: 'basic', ...formData } as Partial<FormData>}
      setFormData={setFormData}
      copyTos={[]}
      setCopyTos={vi.fn()}
      distList={[]}
      setDistList={vi.fn()}
    />,
  );
  return { ...view, setFormData };
}

const delegationRadio = (container: HTMLElement, which: 'yes' | 'no') =>
  container.querySelector(`#delegation-${which}`) as HTMLElement;

describe('ClosingBlockSection delegation toggle', () => {
  it('reads No and hides the delegation type picker when there is no delegation text', () => {
    const { container } = renderBlock({ delegationText: '' });
    expect(delegationRadio(container, 'no')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Delegation Authority Type')).toBeNull();
  });

  it('reads Yes and shows the picker when delegation text is present', () => {
    const { container } = renderBlock({ delegationText: 'By direction' });
    expect(delegationRadio(container, 'yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Delegation Authority Type')).toBeInTheDocument();
  });

  it('follows a parent change in either direction', () => {
    const { container, rerender } = renderBlock({ delegationText: '' });
    expect(delegationRadio(container, 'no')).toHaveAttribute('aria-checked', 'true');
    const props = {
      setFormData: vi.fn(),
      copyTos: [] as string[],
      setCopyTos: vi.fn(),
      distList: [] as string[],
      setDistList: vi.fn(),
    };
    rerender(<ClosingBlockSection formData={{ documentType: 'basic', delegationText: 'Acting' } as Partial<FormData>} {...props} />);
    expect(delegationRadio(container, 'yes')).toHaveAttribute('aria-checked', 'true');
    rerender(<ClosingBlockSection formData={{ documentType: 'basic', delegationText: '' } as Partial<FormData>} {...props} />);
    expect(delegationRadio(container, 'no')).toHaveAttribute('aria-checked', 'true');
  });
});
