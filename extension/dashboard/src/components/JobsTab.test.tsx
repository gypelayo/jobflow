import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { JobsTab } from '@/components/JobsTab';
import type { JobSummary, JobStatus } from '@/types';
import type { ExtractionStatus } from '@/lib/api';

function makeJob(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: 1,
    title: 'Senior Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    jobType: 'Full-time',
    workplaceType: 'Remote',
    level: 'Senior',
    department: 'Engineering',
    salaryRange: '100k-150k',
    status: 'saved' as JobStatus,
    maxStatus: 'saved' as JobStatus,
    extractedAt: '2025-01-01',
    sourceUrl: 'https://example.com',
    skills: ['Go', 'TypeScript'],
    ...overrides,
  };
}

describe('JobsTab', () => {
  const defaultProps = {
    jobs: [] as JobSummary[],
    loading: false,
    error: null as string | null,
    reload: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    extractionStatus: 'idle' as ExtractionStatus,
    extractionError: null as string | null,
    dismissExtraction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading message when loading', () => {
    const { getByText } = render(
      <JobsTab {...defaultProps} loading={true} />
    );
    expect(getByText('Loading jobs...')).toBeTruthy();
  });

  it('shows error message on error', () => {
    const { getByText } = render(
      <JobsTab {...defaultProps} error="Connection failed" />
    );
    expect(
      getByText('Could not load jobs: Connection failed')
    ).toBeTruthy();
  });

  it('shows empty state when no jobs', () => {
    const { getByText } = render(<JobsTab {...defaultProps} />);
    expect(getByText('No jobs yet')).toBeTruthy();
    expect(
      getByText(
        'Navigate to a job posting and click the extension icon to extract it. Your saved jobs will appear here.'
      )
    ).toBeTruthy();
  });

  it('shows "no match" message when search has no results', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo' }),
    ];
    const { getByPlaceholderText, getByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    const input = getByPlaceholderText('Search jobs...');
    fireEvent.input(input, { target: { value: 'zzz-no-match' } });
    expect(getByText('No jobs match your search.')).toBeTruthy();
  });

  it('hides filters when no jobs exist', () => {
    const { container } = render(<JobsTab {...defaultProps} />);
    expect(container.querySelector('.filters')).toBeNull();
  });

  it('shows filters when jobs exist', () => {
    const jobs = [makeJob({ id: 1 })];
    const { container } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    expect(container.querySelector('.filters')).toBeTruthy();
  });

  it('renders job cards', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo' }),
      makeJob({ id: 2, title: 'Backend Dev', company: 'DataInc' }),
    ];
    const { getByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    expect(getByText('Frontend Dev')).toBeTruthy();
    expect(getByText('Backend Dev')).toBeTruthy();
    expect(getByText('WidgetCo')).toBeTruthy();
    expect(getByText('DataInc')).toBeTruthy();
  });

  it('filters jobs by search text', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo' }),
      makeJob({ id: 2, title: 'Backend Dev', company: 'DataInc' }),
    ];
    const { getByPlaceholderText, queryByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    const input = getByPlaceholderText('Search jobs...');
    fireEvent.input(input, { target: { value: 'Frontend' } });
    expect(queryByText('Frontend Dev')).toBeTruthy();
    expect(queryByText('Backend Dev')).toBeNull();
  });

  it('filters jobs by company name', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo' }),
      makeJob({ id: 2, title: 'Backend Dev', company: 'DataInc' }),
    ];
    const { getByPlaceholderText, queryByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    const input = getByPlaceholderText('Search jobs...');
    fireEvent.input(input, { target: { value: 'DataInc' } });
    expect(queryByText('Backend Dev')).toBeTruthy();
    expect(queryByText('Frontend Dev')).toBeNull();
  });

  it('filters jobs by status', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Job A', status: 'saved' }),
      makeJob({ id: 2, title: 'Job B', status: 'applied' }),
      makeJob({ id: 3, title: 'Job C', status: 'saved' }),
    ];
    const { container, queryByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    const select = container.querySelector('.status-filter') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'applied' } });
    expect(queryByText('Job B')).toBeTruthy();
    expect(queryByText('Job A')).toBeNull();
    expect(queryByText('Job C')).toBeNull();
  });

  it('shows View and Delete buttons for each job', () => {
    const jobs = [makeJob({ id: 1 })];
    const { getByText } = render(
      <JobsTab {...defaultProps} jobs={jobs} />
    );
    expect(getByText('View')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  // ---- Extraction banner tests ----

  it('shows extracting banner with spinner', () => {
    const { getByText, container } = render(
      <JobsTab {...defaultProps} extractionStatus="extracting" />
    );
    expect(getByText('Scraping page...')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeTruthy();
    // No dismiss button while extracting
    expect(container.querySelector('.extraction-banner-dismiss')).toBeNull();
  });

  it('shows success banner when done', () => {
    const { getByText, container } = render(
      <JobsTab {...defaultProps} extractionStatus="done" />
    );
    expect(getByText('Job extracted successfully')).toBeTruthy();
    expect(container.querySelector('.extraction-banner.done')).toBeTruthy();
    expect(container.querySelector('.extraction-banner-dismiss')).toBeTruthy();
  });

  it('shows error banner with message', () => {
    const { getByText, container } = render(
      <JobsTab
        {...defaultProps}
        extractionStatus="error"
        extractionError="LLM timeout"
      />
    );
    expect(getByText('LLM timeout')).toBeTruthy();
    expect(container.querySelector('.extraction-banner.error')).toBeTruthy();
  });

  it('calls dismissExtraction when dismiss button clicked', () => {
    const dismiss = vi.fn();
    const { container } = render(
      <JobsTab
        {...defaultProps}
        extractionStatus="done"
        dismissExtraction={dismiss}
      />
    );
    const btn = container.querySelector('.extraction-banner-dismiss') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('does not show banner when idle', () => {
    const { container } = render(
      <JobsTab {...defaultProps} extractionStatus="idle" />
    );
    expect(container.querySelector('.extraction-banner')).toBeNull();
  });
});
