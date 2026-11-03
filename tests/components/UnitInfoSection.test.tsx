
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnitInfoSection } from '@/components/letter/UnitInfoSection';
import { FormData } from '@/types';

// Mock dependencies
vi.mock('@/lib/units', () => ({
  UNITS: [
    { unitName: 'TEST UNIT', streetAddress: '123 TEST ST', cityState: 'TESTVILLE, TS', zip: '12345', ruc: 'T12345', mcc: 'T1' },
  ],
}));

describe('UnitInfoSection', () => {
  const mockSetFormData = vi.fn();
  const mockSetCurrentUnitCode = vi.fn();
  const mockSetCurrentUnitName = vi.fn();

  const defaultProps = {
    setFormData: mockSetFormData,
    setCurrentUnitCode: mockSetCurrentUnitCode,
    setCurrentUnitName: mockSetCurrentUnitName,
  };

  it('renders without crashing when optional formData props are missing', () => {
    const formData: Partial<Pick<FormData, 'line1' | 'line2' | 'line3'>> = {};

    render(<UnitInfoSection {...defaultProps} formData={formData} />);

    // Check that the main card is rendered
    expect(screen.getByText('Unit Information')).toBeInTheDocument();
    
    // Check that the search button shows the correct text when no unit is selected
    expect(screen.getByText('Search for a unit...')).toBeInTheDocument();
  });

  it('displays unit information when provided in formData', () => {
    const formData: Partial<Pick<FormData, 'line1' | 'line2' | 'line3'>> = {
      line1: 'HEADQUARTERS BATTALION',
      line2: 'TRAINING AND EDUCATION COMMAND',
      line3: 'QUANTICO, VA 22134',
    };

    render(<UnitInfoSection {...defaultProps} formData={formData} />);

    // The search button text should change
    expect(screen.getByText('Change Unit...')).toBeInTheDocument();
  });
});

describe('UnitInfoSection letterhead report', () => {
  const props = { setFormData: vi.fn(), setCurrentUnitCode: vi.fn(), setCurrentUnitName: vi.fn() };

  it('offers a report link once a letterhead is shown, and none before', () => {
    const { rerender } = render(<UnitInfoSection {...props} formData={{}} />);
    expect(screen.queryByText(/Letterhead outdated or incorrect/)).not.toBeInTheDocument();
    rerender(<UnitInfoSection {...props} formData={{ line1: 'X', line2: 'Y', line3: 'Z' }} />);
    expect(screen.getByText(/Letterhead outdated or incorrect/)).toBeInTheDocument();
  });

  it('shows every spelled-out heading line in the unit card', () => {
    render(<UnitInfoSection {...props} formData={{
      line1: '7TH COMMUNICATION BATTALION',
      line2: 'OPC 567 BOX 53',
      line3: 'FPO AP 96384-9001',
      headingLines: ['7TH COMMUNICATION BATTALION', 'III MARINE INFORMATION GROUP', 'III MARINE EXPEDITIONARY FORCE FMF'],
    } as Partial<FormData>} />);
    expect(screen.getByText('III MARINE INFORMATION GROUP')).toBeInTheDocument();
    expect(screen.getByText('III MARINE EXPEDITIONARY FORCE FMF')).toBeInTheDocument();
  });
});
