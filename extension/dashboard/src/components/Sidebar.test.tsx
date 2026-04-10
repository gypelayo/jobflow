import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Sidebar } from '@/components/Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    activeTab: 'jobs' as const,
    onTabChange: vi.fn(),
  };

  it('renders all 6 tab buttons', () => {
    const { getByText } = render(<Sidebar {...defaultProps} />);
    expect(getByText('Jobs')).toBeTruthy();
    expect(getByText('Pipeline')).toBeTruthy();
    expect(getByText('Rejected')).toBeTruthy();
    expect(getByText('Analytics')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders the JobFlow title', () => {
    const { getByText } = render(<Sidebar {...defaultProps} />);
    expect(getByText('JobFlow')).toBeTruthy();
  });

  it('applies active class to the active tab', () => {
    const { getByText } = render(
      <Sidebar activeTab="pipeline" onTabChange={vi.fn()} />
    );
    expect(getByText('Pipeline').classList.contains('active')).toBe(true);
    expect(getByText('Jobs').classList.contains('active')).toBe(false);
  });

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    const { getByText } = render(
      <Sidebar activeTab="jobs" onTabChange={onTabChange} />
    );
    fireEvent.click(getByText('Analytics'));
    expect(onTabChange).toHaveBeenCalledWith('analytics');
  });

  it('calls onTabChange for each tab', () => {
    const onTabChange = vi.fn();
    const { getByText } = render(
      <Sidebar activeTab="jobs" onTabChange={onTabChange} />
    );
    fireEvent.click(getByText('Settings'));
    fireEvent.click(getByText('Profile'));
    expect(onTabChange).toHaveBeenCalledWith('settings');
    expect(onTabChange).toHaveBeenCalledWith('profile');
    expect(onTabChange).toHaveBeenCalledTimes(2);
  });
});
