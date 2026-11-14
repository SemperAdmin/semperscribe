import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { VideoLink } from '@/components/videos/VideoLink';
import { HowToVideoLinks } from '@/components/videos/HowToVideoLinks';
import { HowToVideosDialog } from '@/components/videos/HowToVideosDialog';
import { HOW_TO_VIDEOS } from '@/lib/how-to-videos';

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')); });
};
afterEach(() => setOnline(true));

const endorsement = HOW_TO_VIDEOS.find(v => v.id === 'endorsements')!;

describe('VideoLink', () => {
  it('renders a new-tab MarineNet anchor with the login badge and accessible name', () => {
    render(<VideoLink video={endorsement} />);
    const a = screen.getByRole('link', { name: /^Endorsements .*MarineNet login required, opens in a new tab$/ });
    // WCAG 2.5.3 label in name: the visible text (sr-only excluded) starts the accessible name.
    const visible = a.textContent!.replace('required, opens in a new tab', '').replace(/\s+/g, ' ').trim();
    expect(a).not.toHaveAttribute('aria-label');
    expect(visible.startsWith('Endorsements')).toBe(true);
    expect(visible.endsWith('MarineNet login')).toBe(true);
    expect(a).toHaveAttribute('href', endorsement.url!);
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(a).getByTestId('login-required-badge')).not.toHaveAttribute('aria-hidden');
  });
  it('coming soon: no anchor when url is null', () => {
    const { container } = render(<VideoLink video={{ ...endorsement, url: null }} />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
  it('offline: no anchor, reads "Needs a network connection", and recovers when online', () => {
    const { container } = render(<VideoLink video={endorsement} />);
    setOnline(false);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('Needs a network connection')).toBeInTheDocument();
    setOnline(true);
    expect(container.querySelector('a')).not.toBeNull();
  });
});

describe('HowToVideoLinks', () => {
  it('basic shows both letter videos', () => {
    render(<HowToVideoLinks typeId="basic" />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
  it('renders nothing for a type with no video', () => {
    const { container } = render(<HowToVideoLinks typeId="not-a-type" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('HowToVideosDialog', () => {
  it('lists 11 groups in spec order and 32 links', () => {
    render(<HowToVideosDialog open onOpenChange={() => {}} />);
    const groups = screen.getAllByTestId('howto-video-group').map(g => g.getAttribute('data-group'));
    expect(groups).toEqual([
      'getting-started', 'standard-letter', 'memorandums', 'staffing-papers', 'external-executive',
      'directives', 'forms', 'counseling-worksheets', 'amhs', 'check-export-share', 'power-tools',
    ]);
    expect(screen.getAllByRole('link')).toHaveLength(32);
  });
});

import { GuidanceDialog } from '@/components/GuidanceDialog';

describe('GuidanceDialog video row', () => {
  it('shows the Endorsements video for the endorsement entry', () => {
    render(<GuidanceDialog open onOpenChange={() => {}} documentType="endorsement" />);
    expect(screen.getByRole('link', { name: /^Watch how-to: Endorsements MarineNet login required/ })).toBeInTheDocument();
  });
});

import { CommandPalette } from '@/components/CommandPalette';
import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

describe('CommandPalette how-to videos item', () => {
  // jsdom has no scrollIntoView; cmdk calls it when an item becomes active.
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
  const noop = () => {};
  const base = {
    open: true, onOpenChange: noop, onSelectType: noop, onExportPdf: noop, onExportDocx: noop, onSave: noop,
    onOpenLibrary: noop, onShareLink: noop, onFindReplace: noop, onCompliance: noop, onGuide: noop,
    onSettings: noop, onClearForm: noop, hasDocument: true,
  };
  it('shows "How-to videos" when onVideos is passed, and runs it', async () => {
    vi.useFakeTimers();
    const onVideos = vi.fn();
    render(<CommandPalette {...base} onVideos={onVideos} />);
    fireEvent.click(screen.getByText('How-to videos'));
    vi.runAllTimers();
    vi.useRealTimers();
    expect(onVideos).toHaveBeenCalledTimes(1);
  });
  it('control: no item without onVideos', () => {
    render(<CommandPalette {...base} />);
    expect(screen.queryByText('How-to videos')).toBeNull();
  });
});
