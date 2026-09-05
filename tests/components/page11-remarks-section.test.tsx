/**
 * Page11RemarksSection: the template list loads from the button press
 * which opens the picker (Phase A.4), once per non-empty result, and a
 * failed load toasts and retries on the next open.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import { Page11RemarksSection } from '@/components/letter/Page11RemarksSection';
import type { FormData } from '@/types';

const INDEX = [
  { id: 'p11-a', title: 'Counseling entry', documentType: 'page11', url: '/templates/global/p11-a.json' },
  { id: 'letter-x', title: 'Not a page 11', documentType: 'basic', url: '/templates/global/x.json' },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  toast.mockClear();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(INDEX), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [formData, setFormData] = React.useState<FormData>({ documentType: 'page11', remarksLeft: 'x', remarksRight: '' } as unknown as FormData);
  return <Page11RemarksSection formData={formData} setFormData={setFormData} />;
}

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /Insert template/ }));

describe('Page11RemarksSection template picker', () => {
  it('does not fetch until the picker opens, then lists only Page 11 entries', async () => {
    render(<Harness />);
    expect(fetchMock).not.toHaveBeenCalled();
    openPicker();
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Counseling entry')).toBeInTheDocument());
    expect(screen.queryByText('Not a page 11')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/templates\/global\/index\.json$/);
  });

  it('toasts on a failed load and retries on the next open', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline'); });
    render(<Harness />);
    openPicker();
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Templates Unavailable' })));
    expect(screen.getByText('No Page 11 templates found.')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    openPicker();
    await waitFor(() => expect(screen.getByText('Counseling entry')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
