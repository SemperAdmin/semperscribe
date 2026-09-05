/**
 * DistributionSection: renders from the distribution it is given and
 * writes only through user action. The parent always supplies a value,
 * so the old initialise-if-undefined mount effect never fired and is
 * gone (Phase A.5).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DistributionSection } from '@/components/letter/DistributionSection';

afterEach(cleanup);

describe('DistributionSection', () => {
  it('does not call back on mount', () => {
    const onUpdate = vi.fn();
    render(<DistributionSection distribution={{ type: 'none' }} onUpdateDistribution={onUpdate} />);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/PCN/)).toBeNull();
  });

  it('opens the PCN fields when enabled and reports the change', () => {
    const onUpdate = vi.fn();
    render(<DistributionSection distribution={{ type: 'none' }} onUpdateDistribution={onUpdate} />);
    fireEvent.click(screen.getByLabelText('Yes'));
    expect(onUpdate).toHaveBeenCalledWith({ type: 'pcn', pcn: '', copyTo: [] });
    expect(screen.getByLabelText(/PCN/)).toBeInTheDocument();
  });
});
