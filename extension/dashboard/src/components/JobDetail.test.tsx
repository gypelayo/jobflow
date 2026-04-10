import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { JobDetail } from '@/components/JobDetail';
import type { JobFull } from '@/types';

vi.mock('@/hooks/useLicense', () => ({
  useLicense: vi.fn(() => ({ isActive: true, isExpired: false, daysRemaining: 90, expiry: '2099-01-01', purchaseDate: null })),
}));

const mockJob: JobFull = {
  id: 1,
  title: 'Senior Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  status: 'saved',
  url: 'https://example.com/job/1',
  skills: ['Go', 'TypeScript', 'PostgreSQL'],
  notes: 'Great opportunity',
  cvMarkdown: '',
  extracted: {
    metadata: {
      job_title: 'Senior Software Engineer',
      department: 'Platform',
      seniority_level: 'Senior',
      job_function: 'Engineering',
    },
    company_info: {
      company_name: 'Acme Corp',
      industry: 'SaaS',
      company_size: '200-500',
      location_full: 'San Francisco, CA',
      location_city: 'San Francisco',
      location_country: 'US',
    },
    role_details: {
      summary: 'Build platform services',
      key_responsibilities: ['Design APIs', 'Mentor juniors'],
      team_structure: '5 engineers',
    },
    requirements: {
      years_experience_min: 5,
      years_experience_max: 10,
      education_level: "Bachelor's",
      requires_specific_degree: false,
      technical_skills: {
        programming_languages: ['Go', 'TypeScript'],
        frameworks: ['React'],
        databases: ['PostgreSQL'],
        cloud_platforms: ['AWS'],
        devops_tools: ['Docker', 'Kubernetes'],
        other: [],
      },
      soft_skills: ['Communication', 'Leadership'],
      nice_to_have: ['Rust'],
    },
    compensation: {
      salary_min: 150000,
      salary_max: 200000,
      salary_currency: 'USD',
      has_equity: true,
      has_remote_stipend: true,
      benefits: ['Health', 'Dental'],
      offers_visa_sponsorship: false,
      offers_health_insurance: true,
      offers_pto: true,
      offers_professional_development: true,
      offers_401k: true,
    },
    work_arrangement: {
      workplace_type: 'Remote',
      job_type: 'Full-time',
      is_remote_friendly: true,
      timezone_requirements: 'US timezones',
    },
    market_signals: {
      urgency_level: 'High',
      interview_rounds: 4,
      has_take_home: false,
      has_pair_programming: true,
    },
    extracted_at: '2025-01-15T10:00:00Z',
    source_url: 'https://example.com/job/1',
  },
};

// Mock api module — factory cannot reference outer variables (hoisted)
vi.mock('@/lib/api', () => ({
  getJob: vi.fn(),
  updateJobNotes: vi.fn().mockResolvedValue(undefined),
  generateCv: vi.fn().mockResolvedValue('# CV'),
  updateJobCv: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/markdown', () => ({
  renderMarkdown: vi.fn((md: string) => `<p>${md}</p>`),
}));

vi.mock('@/lib/pdf', () => ({
  downloadCvAsPdf: vi.fn().mockResolvedValue(undefined),
}));

describe('JobDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getJob } = await import('@/lib/api');
    (getJob as ReturnType<typeof vi.fn>).mockResolvedValue(mockJob);
  });

  it('shows loading state initially', () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('renders job header after loading', async () => {
    const { getByRole, getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByRole('heading', { level: 2 })).toBeTruthy();
    });
    expect(getByRole('heading', { level: 2 }).textContent).toBe('Senior Software Engineer');
    expect(getByText(/Acme Corp/)).toBeTruthy();
    expect(getByText(/San Francisco, CA/)).toBeTruthy();
  });

  it('renders the Close button', async () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <JobDetail jobId={1} onClose={onClose} />
    );

    await waitFor(() => {
      expect(getByText('Close')).toBeTruthy();
    });

    fireEvent.click(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders all 6 inner tab buttons', async () => {
    const { getByRole } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByRole('button', { name: 'Overview' })).toBeTruthy();
    });
    expect(getByRole('button', { name: 'Company' })).toBeTruthy();
    expect(getByRole('button', { name: 'Role' })).toBeTruthy();
    expect(getByRole('button', { name: 'Requirements' })).toBeTruthy();
    expect(getByRole('button', { name: 'Comp' })).toBeTruthy();
    expect(getByRole('button', { name: 'CV' })).toBeTruthy();
  });

  it('shows overview panel by default', async () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Open original posting')).toBeTruthy();
    });
    expect(getByText(/Go, TypeScript, PostgreSQL/)).toBeTruthy();
  });

  it('switches to Company tab', async () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Company')).toBeTruthy();
    });

    fireEvent.click(getByText('Company'));

    await waitFor(() => {
      expect(getByText(/SaaS/)).toBeTruthy();
      expect(getByText(/200-500/)).toBeTruthy();
    });
  });

  it('switches to Role tab', async () => {
    const { getByRole, getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByRole('button', { name: 'Role' })).toBeTruthy();
    });

    fireEvent.click(getByRole('button', { name: 'Role' }));

    await waitFor(() => {
      expect(getByText('Build platform services')).toBeTruthy();
      expect(getByText(/Design APIs/)).toBeTruthy();
      expect(getByText(/Mentor juniors/)).toBeTruthy();
    });
  });

  it('switches to Requirements tab', async () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Requirements')).toBeTruthy();
    });

    fireEvent.click(getByText('Requirements'));

    await waitFor(() => {
      expect(getByText(/5–10 years/)).toBeTruthy();
      expect(getByText(/Bachelor's/)).toBeTruthy();
      expect(getByText(/Communication, Leadership/)).toBeTruthy();
    });
  });

  it('switches to Compensation tab', async () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByText('Comp')).toBeTruthy();
    });

    fireEvent.click(getByText('Comp'));

    await waitFor(() => {
      expect(getByText(/150000/)).toBeTruthy();
      expect(getByText(/200000/)).toBeTruthy();
    });
  });

  it('switches to CV tab', async () => {
    const { getByText } = render(
      <JobDetail jobId={1} onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(getByText('CV')).toBeTruthy();
    });

    fireEvent.click(getByText('CV'));

    await waitFor(() => {
      expect(getByText('Generate CV')).toBeTruthy();
    });
  });
});
