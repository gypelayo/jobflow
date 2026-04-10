import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { ProfileTab } from '@/components/ProfileTab';

// Mock api module
vi.mock('@/lib/api', () => ({
  getProfile: vi.fn().mockResolvedValue({
    id: 1,
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1234567890',
    location: 'NYC',
    currentRole: 'Staff Engineer',
    yearsExperience: 10,
    skills: ['Go', 'TypeScript'],
    links: ['https://github.com/jane'],
    storyMarkdown: '# My Story',
  }),
  saveProfile: vi.fn().mockResolvedValue({ saved: true }),
}));

describe('ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    const { getByText } = render(<ProfileTab />);
    expect(getByText('Loading profile...')).toBeTruthy();
  });

  it('renders profile form after loading', async () => {
    const { getByText, getByDisplayValue } = render(<ProfileTab />);

    await waitFor(() => {
      expect(getByText('Your Profile')).toBeTruthy();
    });

    expect(getByDisplayValue('Jane Doe')).toBeTruthy();
    expect(getByDisplayValue('jane@example.com')).toBeTruthy();
    expect(getByDisplayValue('+1234567890')).toBeTruthy();
    expect(getByDisplayValue('NYC')).toBeTruthy();
    expect(getByDisplayValue('Staff Engineer')).toBeTruthy();
    expect(getByDisplayValue('10')).toBeTruthy();
  });

  it('renders skills as comma-separated', async () => {
    const { getByDisplayValue } = render(<ProfileTab />);

    await waitFor(() => {
      expect(getByDisplayValue('Go, TypeScript')).toBeTruthy();
    });
  });

  it('renders links as comma-separated', async () => {
    const { getByDisplayValue } = render(<ProfileTab />);

    await waitFor(() => {
      expect(getByDisplayValue('https://github.com/jane')).toBeTruthy();
    });
  });

  it('renders save button', async () => {
    const { getByText } = render(<ProfileTab />);

    await waitFor(() => {
      expect(getByText('Save Profile')).toBeTruthy();
    });
  });

  it('renders career story textarea', async () => {
    const { getByDisplayValue } = render(<ProfileTab />);

    await waitFor(() => {
      expect(getByDisplayValue('# My Story')).toBeTruthy();
    });
  });
});
