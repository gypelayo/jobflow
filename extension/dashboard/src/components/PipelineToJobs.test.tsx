// Mock API used by the app
vi.mock('@/lib/api', () => ({
  listJobs: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: 'Pipeline Job',
      company: 'Acme',
      location: 'Remote',
      jobType: 'Full-time',
      workplaceType: 'Remote',
      level: 'Senior',
      department: 'Engineering',
      salaryRange: '',
      status: 'saved',
      maxStatus: 'saved',
      extractedAt: '2025-01-01',
      sourceUrl: '',
      skills: [],
    },
  ]),
  listRejectedJobs: vi.fn().mockResolvedValue([]),
  listGhostedJobs: vi.fn().mockResolvedValue([]),
  getJob: vi.fn().mockImplementation(async (id: number) => ({
    id,
    title: 'Pipeline Job',
    company: 'Acme',
    location: 'Remote',
    skills: ['TS'],
    extracted: {
      metadata: { job_title: 'Pipeline Job' },
      company_info: { company_name: 'Acme', location_full: 'Remote' },
      role_details: {},
      requirements: {},
      compensation: {},
      work_arrangement: {},
      market_signals: {},
    },
    cvMarkdown: '',
  })),
  drainPendingJobs: vi.fn().mockResolvedValue(0),
  onExtractionStatus: vi.fn().mockReturnValue(() => {}),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
  deleteJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/storage', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    provider: 'ollama',
    ollamaModel: 'qwen2.5:7b',
    perplexityKey: '',
    perplexityModel: 'sonar-pro',
    perplexityApiKey: '',
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getPerplexityKey: vi.fn().mockReturnValue(''),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '@/App';

describe('Pipeline -> Jobs integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clicking a pipeline card switches to Jobs tab and opens the job', async () => {
    const { getByText, container } = render(<App />);

    // Open pipeline
    fireEvent.click(getByText('Pipeline'));

    await waitFor(() => {
      expect(container.querySelector('.pipeline-board')).toBeTruthy();
    });

    // Wait for the pipeline card to render, then click its title
    await waitFor(() => {
      expect(container.querySelector('.pipeline-card-title')).toBeTruthy();
    });
    const cardTitle = container.querySelector('.pipeline-card-title');
    expect(cardTitle).toBeTruthy();
    fireEvent.click(cardTitle as Element);

    // Jobs tab should be active and the job detail should appear
    await waitFor(() => {
      const detail = container.querySelector('.job-detail-collapsible');
      expect(detail).toBeTruthy();
    });
  });
});
