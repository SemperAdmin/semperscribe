/**
 * D.7: the templates picker. Audit finding 5 measured 69 shipped
 * templates and a picker which hard-filtered to the current document
 * type with no visible filter and no way to clear it, so 68 of the 69
 * were unreachable from a basic letter. The chip, the count label and
 * the type-switching pick are what replaced the hidden rule.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { HeaderActions } from '@/components/layout/HeaderActions';

const GLOBAL_INDEX = [
  { id: 'basic-1', title: 'Standard Naval Letter', documentType: 'basic', url: '/templates/global/basic.nldp' },
  { id: 'mfr-1', title: 'Memorandum for the Record', documentType: 'mfr', url: '/templates/global/mfr.nldp' },
  { id: 'aa-1', title: 'AA Form BAH', documentType: 'aa-form', url: '/templates/global/aa-bah.nldp' },
  { id: 'aa-2', title: 'AA Form POV', documentType: 'aa-form', url: '/templates/global/aa-pov.nldp' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    ({ ok: true, json: async () => (url.includes('/templates/global/') ? GLOBAL_INDEX : []) })
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function actions(documentType: string, onLoadTemplateUrl = vi.fn()) {
  return (
    <HeaderActions
      onSave={vi.fn()}
      onLoadDraft={vi.fn()}
      onImport={vi.fn()}
      onExportDocx={vi.fn()}
      onGeneratePdf={vi.fn()}
      onClearForm={vi.fn()}
      savedLetters={[]}
      onLoadTemplateUrl={onLoadTemplateUrl}
      documentType={documentType}
    />
  );
}

async function openPicker(documentType: string, onLoadTemplateUrl = vi.fn()) {
  render(actions(documentType, onLoadTemplateUrl));
  fireEvent.click(screen.getByRole('button', { name: /Templates/ }));
  await screen.findByText('Browse Templates');
  return onLoadTemplateUrl;
}

const chip = () => screen.getByRole('switch', { name: /Matches this document type/ });
const label = () => screen.getByTestId('template-filter-label').textContent ?? '';

describe('templates picker filter chip', () => {
  it('starts on, and labels the active filter with the visible count', async () => {
    await openPicker('aa-form');
    expect(chip()).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(label()).toContain('Showing 2 of 4'));
    expect(label()).toContain('filtered to aa-form');
    expect(label()).toContain('2 match this document type');
  });

  it('reaches every template when the chip is turned off', async () => {
    await openPicker('aa-form');
    await waitFor(() => expect(label()).toContain('Showing 2 of 4'));
    expect(screen.queryByText('Memorandum for the Record')).not.toBeInTheDocument();

    fireEvent.click(chip());

    expect(chip()).toHaveAttribute('aria-checked', 'false');
    expect(label()).toContain('Showing 4 of 4');
    expect(label()).toContain('every document type');
    expect(screen.getByText('Memorandum for the Record')).toBeInTheDocument();
  });

  it('starts off when the current document type has no templates of its own', async () => {
    await openPicker('endorsement');
    await waitFor(() => expect(label()).toContain('Showing 4 of 4'));
    expect(chip()).toHaveAttribute('aria-checked', 'false');
    expect(label()).toContain('0 match this document type');
  });

  it('marks each card as a match or as a switch to another type', async () => {
    await openPicker('basic');
    await waitFor(() => expect(label()).toContain('Showing 1 of 4'));
    fireEvent.click(chip());

    // Scoped to the list: the chip carries the same words as the badge.
    const list = within(screen.getByRole('tabpanel'));
    expect(list.getAllByText('Matches this document type')).toHaveLength(1);
    expect(list.getAllByText('Switches to aa-form')).toHaveLength(2);
    expect(list.getByText('Switches to mfr')).toBeInTheDocument();
  });

  it('sends the picked template\'s own document type back with its url', async () => {
    const onLoad = await openPicker('basic');
    await waitFor(() => expect(label()).toContain('Showing 1 of 4'));
    fireEvent.click(chip());

    fireEvent.click(screen.getByText('Memorandum for the Record'));

    expect(onLoad).toHaveBeenCalledWith('/templates/global/mfr.nldp', 'mfr');
  });
});
