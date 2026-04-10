import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { RejectedTab } from '@/components/RejectedTab';
import type { JobSummary, JobStatus } from '@/types';

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
    status: 'rejected' as JobStatus,
    maxStatus: 'interview-tech-code' as JobStatus,
    extractedAt: '2025-01-01',
    sourceUrl: 'https://example.com',
    skills: [],
    ...overrides,
  };
}

function makeGhostedJob(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    ...makeJob({ status: 'applied' as JobStatus, maxStatus: 'applied' as JobStatus }),
    daysGhosted: 21,
    ...overrides,
  };
}

vi.mock('@/lib/api', () => ({
  listRejectedJobs: vi.fn(),
  listGhostedJobs: vi.fn(),
}));

vi.mock('@/contexts/JobOpenContext', () => ({
  JobOpenContext: { register: vi.fn(), open: vi.fn() },
}));

describe('RejectedTab', () => {
  const defaultProps = {
    updateStatus: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    ghostedDays: 14,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (api.listGhostedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('shows loading state initially', async () => {
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (api.listGhostedJobs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('shows empty state when no jobs at all', async () => {
    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('No rejections or ghosts yet')).toBeTruthy();
    });
  });

  it('shows error message on failure', async () => {
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('Could not load: DB error')).toBeTruthy();
    });
  });

  it('renders rejected job cards with peak stage badge', async () => {
    const api = await import('@/lib/api');
    const jobs = [
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo', maxStatus: 'interview-tech-code' }),
      makeJob({ id: 2, title: 'Backend Dev', company: 'DataInc', maxStatus: 'applied' }),
    ];
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockResolvedValue(jobs);

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('Frontend Dev')).toBeTruthy();
      expect(getByText('Backend Dev')).toBeTruthy();
      expect(getByText('Interview: Tech Code')).toBeTruthy();
      expect(getByText('Applied')).toBeTruthy();
    });
  });

  it('shows combined job count in header', async () => {
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeJob({ id: 1 }),
      makeJob({ id: 2 }),
    ]);
    (api.listGhostedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeGhostedJob({ id: 3 }),
    ]);

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('3 jobs')).toBeTruthy();
    });
  });

  it('renders ghosted section when there are ghosted jobs', async () => {
    const api = await import('@/lib/api');
    (api.listGhostedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeGhostedJob({ id: 10, title: 'Ghost Job', company: 'Silent Corp', daysGhosted: 21 }),
    ]);

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('👻 Ghosted')).toBeTruthy();
      expect(getByText('Ghost Job')).toBeTruthy();
      expect(getByText('21d ago')).toBeTruthy();
      expect(getByText('Mark Rejected')).toBeTruthy();
    });
  });

  it('filters jobs by search text', async () => {
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeJob({ id: 1, title: 'Frontend Dev', company: 'WidgetCo' }),
      makeJob({ id: 2, title: 'Backend Dev', company: 'DataInc' }),
    ]);

    const { getByPlaceholderText, getByText, queryByText } = render(
      <RejectedTab {...defaultProps} />
    );

    await waitFor(() => {
      expect(getByText('Frontend Dev')).toBeTruthy();
    });

    fireEvent.input(getByPlaceholderText('Search...'), {
      target: { value: 'Frontend' },
    });

    expect(getByText('Frontend Dev')).toBeTruthy();
    expect(queryByText('Backend Dev')).toBeNull();
  });

  it('renders Restore and Delete buttons for rejected jobs', async () => {
    const api = await import('@/lib/api');
    (api.listRejectedJobs as ReturnType<typeof vi.fn>).mockResolvedValue([makeJob()]);

    const { getByText } = render(<RejectedTab {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('Restore')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();
    });
  });
});
