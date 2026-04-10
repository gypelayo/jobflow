import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '@/App';

// Mock all API calls used by hooks
vi.mock('@/lib/api', () => ({
  listJobs: vi.fn().mockResolvedValue([]),
  listRejectedJobs: vi.fn().mockResolvedValue([]),
  listGhostedJobs: vi.fn().mockResolvedValue([]),
  getProfile: vi.fn().mockResolvedValue({
    id: 1,
    fullName: '',
    email: '',
    phone: '',
    location: '',
    currentRole: '',
    yearsExperience: 0,
    skills: [],
    links: [],
    storyMarkdown: '',
  }),
  pingHost: vi.fn().mockResolvedValue('1.0.0'),
  getAnalytics: vi.fn().mockResolvedValue({
    statusStats: {},
    skillsByCategory: {},
    skillsByStatus: {},
    topJobTitles: [],
  }),
  drainPendingJobs: vi.fn().mockResolvedValue(0),
  onExtractionStatus: vi.fn().mockReturnValue(() => {}),
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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the sidebar and main content', () => {
    const { getByText, container } = render(<App />);
    expect(getByText('JobFlow')).toBeTruthy();
    expect(container.querySelector('.main-content')).toBeTruthy();
  });

  it('shows Jobs tab by default', async () => {
    const { getByText } = render(<App />);
    // Jobs tab shows loading first, then empty state
    await waitFor(() => {
      expect(
        getByText('No jobs yet')
      ).toBeTruthy();
    });
  });

  it('switches to Pipeline tab', async () => {
    const { getByText, container } = render(<App />);
    fireEvent.click(getByText('Pipeline'));

    await waitFor(() => {
      expect(container.querySelector('.pipeline-board')).toBeTruthy();
    });
  });

  it('switches to Settings tab', async () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('Settings'));

    await waitFor(() => {
      expect(getByText('LLM Provider')).toBeTruthy();
    });
  });

  it('switches to Profile tab', async () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('Profile'));

    await waitFor(() => {
      expect(getByText('Your Profile')).toBeTruthy();
    });
  });

  it('highlights active sidebar tab', () => {
    const { getByText } = render(<App />);
    expect(getByText('Jobs').classList.contains('active')).toBe(true);

    fireEvent.click(getByText('Pipeline'));
    expect(getByText('Pipeline').classList.contains('active')).toBe(true);
    expect(getByText('Jobs').classList.contains('active')).toBe(false);
  });

  it('switches to Rejected tab', async () => {
    const { getByText } = render(<App />);
    fireEvent.click(getByText('Rejected'));

    await waitFor(() => {
      expect(getByText('No rejections or ghosts yet')).toBeTruthy();
    });
  });
});
