/**
 * Phase 0.4 (HARDENING_PLAN_2026-09): behaviour pins for the list
 * sections whose show/hide flag mirrors the list contents through an
 * effect. Phase A.1 replaces those effects; these tests are the contract
 * they must keep: collapsed when the list is empty, expanded when any
 * item has text, and add/remove flowing through the parent callback.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ViaSection } from '@/components/letter/ViaSection';
import { CopyToSection } from '@/components/letter/CopyToSection';
import { ManualDistributionSection } from '@/components/letter/ManualDistributionSection';

afterEach(cleanup);

function radio(name: 'Yes' | 'No') {
  return screen.getByRole('radio', { name });
}

describe('ViaSection', () => {
  it('collapses when every via is blank', () => {
    render(<ViaSection vias={[]} setVias={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByPlaceholderText(/Enter via information/)).toBeNull();
  });

  it('expands when a via has text', () => {
    render(<ViaSection vias={['Commanding Officer, 1st Marine Division']} setVias={vi.fn()} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByDisplayValue('Commanding Officer, 1st Marine Division')).toBeInTheDocument();
  });

  it('treats whitespace-only entries as blank', () => {
    render(<ViaSection vias={['   ']} setVias={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });

  it('re-syncs when the list changes from the parent', () => {
    const { rerender } = render(<ViaSection vias={[]} setVias={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    rerender(<ViaSection vias={['Commanding General, II MEF']} setVias={vi.fn()} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    rerender(<ViaSection vias={[]} setVias={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
  });

  it('adds and removes through the parent callback', () => {
    const setVias = vi.fn();
    render(<ViaSection vias={['A', 'B']} setVias={setVias} />);
    // The last row carries the Add button, earlier rows carry Remove.
    fireEvent.click(screen.getByRole('button', { name: 'Add Via' }));
    expect(setVias).toHaveBeenLastCalledWith(['A', 'B', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Via' }));
    expect(setVias).toHaveBeenLastCalledWith(['B']);
  });

  it('edits an item through the parent callback', () => {
    const setVias = vi.fn();
    render(<ViaSection vias={['A']} setVias={setVias} />);
    fireEvent.change(screen.getByDisplayValue('A'), { target: { value: 'AB' } });
    expect(setVias).toHaveBeenLastCalledWith(['AB']);
  });
});

describe('CopyToSection', () => {
  it('collapses when every copy-to is blank', () => {
    render(<CopyToSection copyTos={['']} setCopyTos={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByPlaceholderText('Enter copy to information')).toBeNull();
  });

  it('expands when a copy-to has text', () => {
    render(<CopyToSection copyTos={['CMC (MMSB)']} setCopyTos={vi.fn()} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByDisplayValue('CMC (MMSB)')).toBeInTheDocument();
  });

  it('adds and removes through the parent callback', () => {
    const setCopyTos = vi.fn();
    render(<CopyToSection copyTos={['X', 'Y']} setCopyTos={setCopyTos} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Copy To' }));
    expect(setCopyTos).toHaveBeenLastCalledWith(['X', 'Y', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Copy To' }));
    expect(setCopyTos).toHaveBeenLastCalledWith(['Y']);
  });
});

describe('ManualDistributionSection', () => {
  it('collapses when every entry is blank', () => {
    render(<ManualDistributionSection distList={[]} setDistList={vi.fn()} />);
    expect(radio('No')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByPlaceholderText('Enter distribution information')).toBeNull();
  });

  it('expands when an entry has text', () => {
    render(<ManualDistributionSection distList={['List I']} setDistList={vi.fn()} />);
    expect(radio('Yes')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByDisplayValue('List I')).toBeInTheDocument();
  });

  it('adds and removes through the parent callback', () => {
    const setDistList = vi.fn();
    render(<ManualDistributionSection distList={['List I', 'List II']} setDistList={setDistList} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Distribution' }));
    expect(setDistList).toHaveBeenLastCalledWith(['List I', 'List II', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Distribution' }));
    expect(setDistList).toHaveBeenLastCalledWith(['List II']);
  });
});
