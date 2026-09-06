/**
 * D.4: the compliance dialog was a dead end. It listed issues with
 * citations and offered no way back to the field each one belonged to
 * (UX audit, persona 2). An issue which names a field now renders a
 * jump-to-field action, and focusDocumentField takes the drafter there.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComplianceDialog } from '@/components/ComplianceDialog';
import { focusDocumentField } from '@/lib/field-focus';
import type { ValidationIssue } from '@/lib/letter-validators';

afterEach(cleanup);

const SSIC_ISSUE: ValidationIssue = {
  id: 'schema-basic-ssic',
  severity: 'fail',
  field: 'ssic',
  rule: 'An SSIC is required on every naval letter',
  citation: 'SECNAV M-5216.5 7-2.3.a(1)',
  detail: 'SSIC is empty. Look the code up in SECNAV M-5210.2.',
};

const NO_FIELD_ISSUE: ValidationIssue = {
  id: 'window-via',
  severity: 'block',
  rule: 'A window-envelope letter carries no Via addressee',
  citation: 'SECNAV M-5216.5 Fig 7-3',
  detail: 'Remove the Via addressee or turn the window format off.',
};

function renderDialog(issues: ValidationIssue[], onJumpToField?: (field: string) => void) {
  return render(
    <ComplianceDialog
      open
      onOpenChange={() => {}}
      issues={issues}
      onFix={() => {}}
      onFixAll={() => {}}
      onJumpToField={onJumpToField}
    />,
  );
}

describe('ComplianceDialog jump-to-field', () => {
  it('offers the action on an issue which names a field', () => {
    const onJumpToField = vi.fn();
    renderDialog([SSIC_ISSUE], onJumpToField);
    fireEvent.click(screen.getByText('Go to field'));
    expect(onJumpToField).toHaveBeenCalledWith('ssic');
  });

  it('renders the requirement and the paragraph, never a source path', () => {
    renderDialog([SSIC_ISSUE], vi.fn());
    expect(screen.getByText('An SSIC is required on every naval letter')).toBeInTheDocument();
    expect(screen.getByText('SECNAV M-5216.5 7-2.3.a(1)')).toBeInTheDocument();
    expect(screen.queryByText(/src\/lib/)).toBeNull();
  });

  it('offers no action on an issue which names no field', () => {
    renderDialog([NO_FIELD_ISSUE], vi.fn());
    expect(screen.queryByText('Go to field')).toBeNull();
  });

  it('offers no action when the surface wires no handler', () => {
    renderDialog([SSIC_ISSUE]);
    expect(screen.queryByText('Go to field')).toBeNull();
  });
});

describe('focusDocumentField', () => {
  it('focuses the control inside the wrapper the form marks', () => {
    render(
      <div>
        <div data-field="from"><input aria-label="From" /></div>
        <div data-field="ssic"><input aria-label="SSIC" /></div>
      </div>,
    );
    expect(focusDocumentField('ssic')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('SSIC'));
  });

  it('reports false for a field which is not on screen', () => {
    render(<div data-field="ssic"><input aria-label="SSIC" /></div>);
    expect(focusDocumentField('subj')).toBe(false);
  });

  it('refuses a field name which is not a plain identifier', () => {
    render(<div data-field="ssic"><input aria-label="SSIC" /></div>);
    expect(focusDocumentField('ssic"], [data-field="subj')).toBe(false);
  });
});
