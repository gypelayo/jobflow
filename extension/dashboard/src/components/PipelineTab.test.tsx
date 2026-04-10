import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { PipelineTab } from '@/components/PipelineTab';
import type { JobSummary, JobStatus } from '@/types';

function makeJob(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    id: 1,
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    jobType: 'Full-time',
    workplaceType: 'Remote',
    level: 'Senior',
    department: 'Engineering',
    salaryRange: '',
    status: 'saved' as JobStatus,
    maxStatus: 'saved' as JobStatus,
    extractedAt: '2025-01-01',
    sourceUrl: '',
    skills: [],
    ...overrides,
  };
}

describe('PipelineTab', () => {
  const defaultProps = {
    jobs: [] as JobSummary[],
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 7 active pipeline columns (no rejected)', () => {
    const { getByText, queryByText } = render(<PipelineTab {...defaultProps} />);
    expect(getByText('Saved')).toBeTruthy();
    expect(getByText('Applied')).toBeTruthy();
    expect(getByText('Interview: HR')).toBeTruthy();
    expect(getByText('Interview: Tech Intro')).toBeTruthy();
    expect(getByText('Interview: Tech System')).toBeTruthy();
    expect(getByText('Interview: Tech Code')).toBeTruthy();
    expect(getByText('Offer')).toBeTruthy();
    expect(queryByText('Rejected')).toBeNull();
  });

  it('shows correct count badges', () => {
    const jobs = [
      makeJob({ id: 1, status: 'saved' }),
      makeJob({ id: 2, status: 'saved' }),
      makeJob({ id: 3, status: 'applied' }),
    ];
    const { container } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );
    const counts = container.querySelectorAll('.count');
    // Saved=2, Applied=1, Interview-HR=0, Interview-Tech-Intro=0, Interview-Tech-System=0, Interview-Tech-Code=0, Offer=0
    const values = Array.from(counts).map((el) => el.textContent);
    expect(values).toEqual(['2', '1', '0', '0', '0', '0', '0']);
  });

  it('groups jobs into the correct columns', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Job A', status: 'saved' }),
      makeJob({ id: 2, title: 'Job B', status: 'interview-hr' }),
      makeJob({ id: 3, title: 'Job C', status: 'offer' }),
    ];
    const { container } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );

    const savedCol = container.querySelector('[data-status="saved"].pipeline-column-body');
    const interviewCol = container.querySelector('[data-status="interview-hr"].pipeline-column-body');
    const offerCol = container.querySelector('[data-status="offer"].pipeline-column-body');

    expect(savedCol?.textContent).toContain('Job A');
    expect(interviewCol?.textContent).toContain('Job B');
    expect(offerCol?.textContent).toContain('Job C');
  });

  it('excludes rejected jobs from the pipeline', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Active Job', status: 'saved' }),
      makeJob({ id: 2, title: 'Rejected Job', status: 'rejected' }),
    ];
    const { queryByText } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );
    expect(queryByText('Active Job')).toBeTruthy();
    expect(queryByText('Rejected Job')).toBeNull();
  });

  it('renders pipeline cards with title and company', () => {
    const jobs = [
      makeJob({ id: 1, title: 'Staff Eng', company: 'BigCo', status: 'applied' }),
    ];
    const { getByText } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );
    expect(getByText('Staff Eng')).toBeTruthy();
    expect(getByText('BigCo')).toBeTruthy();
  });

  it('renders cards as draggable', () => {
    const jobs = [makeJob({ id: 1, status: 'saved' })];
    const { container } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );
    const card = container.querySelector('.pipeline-card');
    expect(card?.getAttribute('draggable')).toBe('true');
  });

  it('shows location and workplace type in pipeline card meta', () => {
    const jobs = [
      makeJob({
        id: 1,
        status: 'saved',
        location: 'NYC',
        workplaceType: 'Hybrid',
      }),
    ];
    const { container } = render(
      <PipelineTab {...defaultProps} jobs={jobs} />
    );
    const meta = container.querySelector('.pipeline-card-meta');
    expect(meta?.textContent).toContain('NYC');
    expect(meta?.textContent).toContain('Hybrid');
  });
});
