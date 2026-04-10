import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { CvSection } from '@/components/CvSection';

// Mock useLicense to always return active in tests
vi.mock('@/hooks/useLicense', () => ({
  useLicense: vi.fn(() => ({ isActive: true, isExpired: false, daysRemaining: 90, expiry: '2099-01-01', purchaseDate: null }),
  ),
}));

// Mock api module
vi.mock('@/lib/api', () => ({
  generateCv: vi.fn(),
  updateJobCv: vi.fn().mockResolvedValue(undefined),
}));

// Mock pdf module (dynamic import means we mock the module)
vi.mock('@/lib/pdf', () => ({
  downloadCvAsPdf: vi.fn().mockResolvedValue(undefined),
}));

// Mock markdown module
vi.mock('@/lib/markdown', () => ({
  renderMarkdown: vi.fn((md: string) => `<p>${md}</p>`),
}));

describe('CvSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial markdown', () => {
    const { getByDisplayValue } = render(
      <CvSection jobId={1} initialMarkdown="# My CV" />
    );
    expect(getByDisplayValue('# My CV')).toBeTruthy();
  });

  it('renders action buttons', () => {
    const { getByText } = render(
      <CvSection jobId={1} initialMarkdown="" />
    );
    expect(getByText('Generate CV')).toBeTruthy();
    expect(getByText('Save CV')).toBeTruthy();
    expect(getByText('Render Markdown')).toBeTruthy();
    expect(getByText('Download as PDF')).toBeTruthy();
  });

  it('shows preview placeholder initially', () => {
    const { container } = render(
      <CvSection jobId={1} initialMarkdown="" />
    );
    const preview = container.querySelector('.cv-rendered');
    expect(preview?.innerHTML).toContain('Render Markdown');
  });

  it('renders markdown preview when button clicked', async () => {
    const { getByText, container } = render(
      <CvSection jobId={1} initialMarkdown="Hello world" />
    );

    fireEvent.click(getByText('Render Markdown'));

    await waitFor(() => {
      const preview = container.querySelector('.cv-rendered');
      expect(preview?.innerHTML).toContain('<p>Hello world</p>');
    });
  });

  it('alerts when rendering empty markdown', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { getByText } = render(
      <CvSection jobId={1} initialMarkdown="" />
    );

    fireEvent.click(getByText('Render Markdown'));
    expect(alertSpy).toHaveBeenCalledWith('Generate a CV first.');
    alertSpy.mockRestore();
  });

  it('generates CV from API', async () => {
    const { generateCv } = await import('@/lib/api');
    (generateCv as ReturnType<typeof vi.fn>).mockResolvedValue(
      '# Generated CV\n\nContent here.'
    );

    const { getByText, container } = render(
      <CvSection jobId={42} initialMarkdown="" />
    );

    fireEvent.click(getByText('Generate CV'));

    await waitFor(() => {
      expect(generateCv).toHaveBeenCalledWith(42);
      const textarea = container.querySelector('textarea');
      expect(textarea?.value).toBe('# Generated CV\n\nContent here.');
    });
  });

  it('saves CV', async () => {
    const { updateJobCv } = await import('@/lib/api');

    const { getByText } = render(
      <CvSection jobId={5} initialMarkdown="draft content" />
    );

    fireEvent.click(getByText('Save CV'));

    await waitFor(() => {
      expect(updateJobCv).toHaveBeenCalledWith(5, 'draft content');
      expect(getByText('Saved!')).toBeTruthy();
    });
  });

  it('shows generating state', async () => {
    const { generateCv } = await import('@/lib/api');
    let resolveGen: (v: string) => void;
    (generateCv as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<string>((r) => {
        resolveGen = r;
      })
    );

    const { getByText } = render(
      <CvSection jobId={1} initialMarkdown="" />
    );

    fireEvent.click(getByText('Generate CV'));
    expect(getByText('Generating...')).toBeTruthy();

    resolveGen!('done');
    await waitFor(() => {
      expect(getByText('Generate CV')).toBeTruthy();
    });
  });
});
